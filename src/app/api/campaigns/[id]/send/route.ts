import { prisma } from '@/lib/prisma';
import { sendSingleEmail, sleep } from '@/lib/mailer';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Worker function to process a single campaign's emails.
 * Now refactored to support sequential queueing.
 */
async function runCampaignWorker(campaignId: string, baseUrl: string) {
  try {
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

    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings || !settings.gmailAddress || !settings.gmailAppPassword) {
      console.error('[Worker] Gmail settings missing');
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
      return;
    }

    console.log(`[Worker] Starting sequential processing for Campaign: ${campaign.name}`);

    for (const recipient of campaign.emails) {
      // Re-fetch to check if user cancelled or status changed
      const currentCamp = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!currentCamp || currentCamp.status !== 'sending') break;

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
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', errorMsg: e.message || 'Unknown error' },
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
    const finalFailed = await prisma.emailRecipient.count({ where: { campaignId, status: 'failed' } });
    
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: finalFailed === finalTotal ? 'failed' : 'sent',
      },
    });

    console.log(`[Worker] Finished Campaign: ${campaign.name}. Checking for next in queue...`);

    // QUEUE LOGIC: Trigger next waiting campaign
    const nextWaiting = await prisma.campaign.findFirst({
      where: { status: 'waiting' },
      orderBy: { sentAt: 'asc' } // Start the one that clicked send first
    });

    if (nextWaiting) {
      console.log(`[Worker] Found waiting campaign: ${nextWaiting.name}. Automatic start.`);
      await prisma.campaign.update({
        where: { id: nextWaiting.id },
        data: { status: 'sending' }
      });
      // Recursive call to process next
      await runCampaignWorker(nextWaiting.id, baseUrl);
    } else {
      console.log('[Worker] Queue empty. All campaigns processed.');
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

    // Setup recipients as pending
    for (const contactId of contactIds) {
      await prisma.emailRecipient.upsert({
        where: { campaignId_contactId: { campaignId: id, contactId } },
        update: { status: 'pending', errorMsg: null },
        create: { campaignId: id, contactId }
      });
    }

    // Check if another campaign is already sending
    const activeCampaign = await prisma.campaign.findFirst({
      where: { status: 'sending' }
    });

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    if (activeCampaign && activeCampaign.id !== id) {
      // QUEUE IT: Set to waiting
      await prisma.campaign.update({
        where: { id },
        data: {
          status: 'waiting',
          totalCount: await prisma.emailRecipient.count({ where: { campaignId: id } }),
          sentAt: new Date(), // Track when it was queued
        },
      });

      return NextResponse.json({
        message: 'A campaign is already running. This campaign has been added to the queue (WAITING).',
        status: 'waiting'
      });
    } else {
      // START NOW: Set to sending and trigger worker
      await prisma.campaign.update({
        where: { id },
        data: {
          status: 'sending',
          totalCount: await prisma.emailRecipient.count({ where: { campaignId: id } }),
          sentAt: new Date(),
        },
      });

      // Background the worker
      runCampaignWorker(id, baseUrl).catch(err => console.error('[Fatal Worker Error]', err));

      return NextResponse.json({
        message: 'Campaign sending started.',
        status: 'sending'
      });
    }

  } catch (err: any) {
    console.error('[API Send Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
