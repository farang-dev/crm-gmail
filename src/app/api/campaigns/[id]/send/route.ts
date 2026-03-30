import { prisma } from '@/lib/prisma';
import { sendSingleEmail, sleep } from '@/lib/mailer';
import { verifyEmail } from '@/lib/verifier';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Worker function (Hardened Edition)
 * Zero-hanging logic with strict timeouts for validation.
 */
async function runCampaignWorker(campaignId: string, baseUrl: string) {
  console.log(`[Worker] INITIATING loop for Campaign: ${campaignId}`);
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings?.gmailAddress || !settings?.gmailAppPassword) {
      console.error('[Worker] ABORT: Gmail settings invalid');
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
      return;
    }
    
    const currentEmail = settings.gmailAddress.trim();
    const dailyLimit = settings.dailyLimit || 500;
    console.log(`[Worker] Active Sender: "${currentEmail}" | Limit: ${dailyLimit}`);

    const campaign = await prisma.campaign.findUnique({ 
      where: { id: campaignId },
      include: {
        emails: { where: { status: 'pending' }, include: { contact: true } }
      }
    });

    if (!campaign || campaign.status !== 'sending') {
      console.log(`[Worker] TERMINATING: Campaign status is ${campaign?.status}`);
      return;
    }

    for (const recipient of campaign.emails) {
      // 1. DYNAMIC STATUS CHECK
      const freshCamp = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (freshCamp && freshCamp.status === 'sending') {
        
        // 2. LIMIT CHECK
        const rolling24h = new Date();
        rolling24h.setHours(rolling24h.getHours() - 24);
        const countFromThisAccount = await prisma.emailRecipient.count({
          where: { fromEmail: currentEmail, status: 'sent', sentAt: { gte: rolling24h } }
        });

        console.log(`[Worker] Progress: ${countFromThisAccount}/${dailyLimit} used for ${currentEmail}`);

        if (countFromThisAccount < dailyLimit) {
          const contact = await prisma.contact.findUnique({ where: { id: recipient.contactId } });
          
          if (contact && !contact.unsubscribed) {
            
            // --- BOUNCE GUARD WITH ABSOLUTE TIMEOUT ---
            let validation = { valid: true, reason: '' };
            try {
              console.log(`[Worker] Verifying: ${recipient.contact.email} ...`);
              
              // Increased to 10s for slower DNS lookups
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
              validation = await Promise.race([
                verifyEmail(recipient.contact.email),
                timeoutPromise
              ]) as any;

              console.log(`[Worker] Validation Result: ${validation.valid ? 'OK' : 'FAIL (' + validation.reason + ')'}`);
            } catch (vErr: any) {
              console.warn(`[Worker] Bounce Guard Skipped for ${recipient.contact.email} (Timeout). Assuming DNS ok.`);
              // Reverted to true for restricted local dev environments
              validation = { valid: true, reason: 'Verification Timeout (Skipped)' };
            }
            
            if (validation.valid) {
              // 4. DISPATCH
              try {
                console.log(`[Worker] Sending to ${recipient.contact.email}...`);
                await prisma.emailRecipient.update({ where: { id: recipient.id }, data: { status: 'sending' } });
                
                await sendSingleEmail({
                  to: recipient.contact.email,
                  subject: campaign.subject,
                  html: campaign.bodyHtml,
                  text: campaign.bodyText || campaign.subject,
                  senderName: settings.senderName,
                  senderEmail: currentEmail,
                  trackingId: recipient.trackingId,
                  baseUrl,
                  campaignId: campaign.id,
                  contactName: recipient.contact.name,
                  contactCompany: recipient.contact.company,
                });
                
                await prisma.emailRecipient.update({
                  where: { id: recipient.id },
                  data: { status: 'sent', sentAt: new Date(), fromEmail: currentEmail }
                });
                console.log(`[Worker] ✅ Success: ${recipient.contact.email}`);
              } catch (sendErr: any) {
                const msg = sendErr.message || 'Unknown error';
                console.error(`[Worker] ❌ Gmail Error: ${msg}`);
                if (msg.includes('limit exceeded') || msg.includes('550 5.4.5')) {
                  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'waiting' } });
                  return;
                }
                await prisma.emailRecipient.update({ 
                  where: { id: recipient.id }, 
                  data: { status: 'failed', errorMsg: msg } 
                });
              }
            } else {
              await prisma.emailRecipient.update({
                where: { id: recipient.id },
                data: { status: 'failed', errorMsg: `Bounce Guard: ${validation.reason}` }
              });
            }
          } else if (contact?.unsubscribed) {
            console.log(`[Worker] SKIP: Unsubscribed user ${recipient.contact.email}`);
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: { status: 'failed', errorMsg: 'User Unsubscribed' }
            });
          }
        } else {
          console.warn(`[Worker] LIMIT REACHED for ${currentEmail}`);
          await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'waiting' } });
          return;
        }

        // Stats update
        const [sc, fc] = await Promise.all([
          prisma.emailRecipient.count({ where: { campaignId, status: 'sent' } }),
          prisma.emailRecipient.count({ where: { campaignId, status: 'failed' } }),
        ]);
        await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: sc, failedCount: fc } });
        
        // Fixed delay for stability
        const waitMs = (settings.delayBetween || 5) * 1000;
        console.log(`[Worker] Delaying ${waitMs/1000}s...`);
        await sleep(settings.delayBetween || 5);

      } else {
        console.log(`[Worker] STOPPED: Campaign status changed to ${freshCamp?.status || 'unknown'}`);
        break;
      }
    }

    // Finalize
    const pendingTotal = await prisma.emailRecipient.count({ where: { campaignId, status: 'pending' } });
    if (pendingTotal === 0) {
      console.log(`[Worker] COMPLETED campaign: ${campaignId}`);
      const totalCount = await prisma.emailRecipient.count({ where: { campaignId } });
      const failCount = await prisma.emailRecipient.count({ where: { campaignId, status: 'failed' } });
      await prisma.campaign.update({ 
        where: { id: campaignId }, 
        data: { status: failCount === totalCount ? 'failed' : 'sent' } 
      });
      
      const nextCamp = await prisma.campaign.findFirst({ where: { status: 'waiting' }, orderBy: { updatedAt: 'asc' } });
      if (nextCamp) {
        console.log(`[Worker] QUEUED: Starting next campaign: ${nextCamp.name}`);
        await prisma.campaign.update({ where: { id: nextCamp.id }, data: { status: 'sending' } });
        runCampaignWorker(nextCamp.id, baseUrl).catch(e => console.error(e));
      }
    }
  } catch (err) {
    console.error('[Worker Fatal Error]', err);
  }
}

export async function POST(req: NextRequest, { params }: { params: any }) {
  const resolved = await params;
  const id = resolved.id;
  try {
    const { contactIds } = await req.json();
    if (!contactIds?.length) return NextResponse.json({ error: 'No contacts' }, { status: 400 });
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    await prisma.emailRecipient.deleteMany({ where: { campaignId: id, status: 'pending', contactId: { notIn: contactIds } } });
    for (const cId of contactIds) {
      await prisma.emailRecipient.upsert({
        where: { campaignId_contactId: { campaignId: id, contactId: cId } },
        update: { status: 'pending', errorMsg: null },
        create: { campaignId: id, contactId: cId }
      });
    }

    const active = await prisma.campaign.findFirst({ where: { status: 'sending' } });
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    if (active && active.id !== id) {
      await prisma.campaign.update({ where: { id }, data: { status: 'waiting', totalCount: await prisma.emailRecipient.count({ where: { campaignId: id } }), updatedAt: new Date() } });
      return NextResponse.json({ status: 'waiting' });
    } else {
      await prisma.campaign.update({ where: { id }, data: { status: 'sending', totalCount: await prisma.emailRecipient.count({ where: { campaignId: id } }), updatedAt: new Date() } });
      runCampaignWorker(id, baseUrl).catch(e => console.error(e));
      return NextResponse.json({ status: 'sending' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
