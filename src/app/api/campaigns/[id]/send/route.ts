import { prisma } from '@/lib/prisma';
import { sendSingleEmail, sleep } from '@/lib/mailer';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Worker function to process a single campaign's emails.
 * Refactored to handle Gmail daily limits and error-based stopping.
 */
async function runCampaignWorker(campaignId: string, baseUrl: string) {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings || !settings.gmailAddress || !settings.gmailAppPassword) {
      console.error('[Worker] Gmail settings missing');
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
      return;
    }

    const campaign = await prisma.campaign.findUnique({ 
      where: { id: campaignId },
      include: {
        emails: {
          where: { status: 'pending' },
          include: { contact: true }
        }
      }
    });

    if (!campaign || campaign.status !== 'sending') return;

    console.log(`[Worker] Started Campaign: ${campaign.name}. Pending: ${campaign.emails.length}`);

    for (const recipient of campaign.emails) {
      // 1. RE-CHECK STATUS (In case of manual cancel)
      const currentCamp = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!currentCamp || currentCamp.status !== 'sending') break;

      // 2. SAFEGUARD: DAILY LIMIT CHECK
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const sentToday = await prisma.emailRecipient.count({
        where: {
          status: 'sent',
          sentAt: { gte: startOfDay }
        }
      });

      if (sentToday >= (settings.dailyLimit || 500)) {
        console.warn(`[Worker] SAFEGUARD: Daily limit reached (${sentToday}). Pausing campaign.`);
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'waiting' } // Move back to queue
        });
        return; // EXIT loop and worker
      }

      // 3. ATTEMPT SEND
      try {
        await sendSingleEmail({
          to: recipient.contact.email,
          subject: campaign.subject,
          html: campaign.bodyHtml,
          text: campaign.bodyText || campaign.subject,
          senderName: settings.senderName,
          senderEmail: settings.gmailAddress,
          trackingId: recipient.trackingId,
          baseUrl,
          campaignId: campaign.id,
        });

        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      } catch (e: any) {
        const errorMsg = e.message || 'Unknown error';
        
        // 4. PANIC STOP: DETECT RATE LIMITING
        const isRateLimited = errorMsg.includes('limit exceeded') || errorMsg.includes('550 5.4.5');
        
        if (isRateLimited) {
          console.error(`[Worker] PANIC: Gmail reported limit exceeded. Stopping immediately.`);
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'waiting' } // Don't mark failed, just wait for next day
          });
          return; // STOP THE ENTIRE WORKER
        }

        // Generic error: match individual failure and continue to next person
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', errorMsg },
        });
      }

      // Update aggregate counts
      const [sent, failed] = await Promise.all([
        prisma.emailRecipient.count({ where: { campaignId, status: 'sent' } }),
        prisma.emailRecipient.count({ where: { campaignId, status: 'failed' } }),
      ]);

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: sent, failedCount: failed },
      });

      // Humanization delay
      const delay = Math.max(settings.delayBetween || 5, 5);
      await sleep(delay * 1000);
    }

    // Finalize current campaign
    const finalTotal = await prisma.emailRecipient.count({ where: { campaignId } });
    const finalPending = await prisma.emailRecipient.count({ where: { campaignId, status: 'pending' } });
    const finalFailed = await prisma.emailRecipient.count({ where: { campaignId, status: 'failed' } });
    
    // Only mark DONE if nothing is pending
    if (finalPending === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: finalFailed === finalTotal ? 'failed' : 'sent' },
      });

      // QUEUE LOGIC: Trigger next waiting campaign
      const nextWaiting = await prisma.campaign.findFirst({
        where: { status: 'waiting' },
        orderBy: { sentAt: 'asc' }
      });

      if (nextWaiting) {
        await prisma.campaign.update({ where: { id: nextWaiting.id }, data: { status: 'sending' } });
        await runCampaignWorker(nextWaiting.id, baseUrl);
      }
    }

  } catch (err) {
    console.error('[Worker Error]', err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: any }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  try {
    const body = await req.json();
    const contactIds: string[] = body.contactIds;

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json({ error: 'No contacts selected' }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Prepare recipients
    for (const contactId of contactIds) {
      await prisma.emailRecipient.upsert({
        where: { campaignId_contactId: { campaignId: id, contactId } },
        update: { status: 'pending', errorMsg: null },
        create: { campaignId: id, contactId }
      });
    }

    // Start or Queue
    const activeCampaign = await prisma.campaign.findFirst({ where: { status: 'sending' } });
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    if (activeCampaign && activeCampaign.id !== id) {
      await prisma.campaign.update({
        where: { id },
        data: {
          status: 'waiting',
          totalCount: await prisma.emailRecipient.count({ where: { campaignId: id } }),
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ message: 'Queued (Waiting)', status: 'waiting' });
    } else {
      await prisma.campaign.update({
        where: { id },
        data: {
          status: 'sending',
          totalCount: await prisma.emailRecipient.count({ where: { campaignId: id } }),
          sentAt: new Date(),
        },
      });
      runCampaignWorker(id, baseUrl).catch(err => console.error('[Fatal Worker Error]', err));
      return NextResponse.json({ message: 'Sending started', status: 'sending' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
