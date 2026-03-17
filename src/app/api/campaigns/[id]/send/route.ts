import { prisma } from '@/lib/prisma';
import { sendSingleEmail, sleep } from '@/lib/mailer';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: any }
) {
  // In Next.js 15+, params is a Promise
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

    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    if (!settings || !settings.gmailAddress || !settings.gmailAppPassword) {
      return NextResponse.json(
        { error: 'Gmail settings not configured' },
        { status: 400 }
      );
    }

    // Prepare recipients
    const recipients = [];
    for (const contactId of contactIds) {
      const r = await prisma.emailRecipient.upsert({
        where: {
          campaignId_contactId: {
            campaignId: id,
            contactId: contactId,
          }
        },
        update: {
          status: 'pending',
          errorMsg: null,
        },
        create: {
          campaignId: id,
          contactId: contactId,
        }
      });
      recipients.push(r);
    }

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
    });

    // Mark campaign as sending
    const currentTotal = await prisma.emailRecipient.count({ where: { campaignId: id } });
    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'sending',
        totalCount: currentTotal,
        sentAt: new Date(),
      },
    });

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Perform sending in the background
    const processEmails = async () => {
      for (const recipient of recipients) {
        const contact = contacts.find(c => c.id === recipient.contactId);
        if (!contact) continue;

        try {
          await sendSingleEmail({
            to: contact.email,
            subject: campaign.subject,
            html: campaign.bodyHtml,
            text: campaign.bodyText || campaign.subject,
            senderName: settings.senderName,
            senderEmail: settings.gmailAddress,
            trackingId: recipient.trackingId,
            baseUrl,
            campaignId: id,
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

        // Update counts
        const [sent, failed] = await Promise.all([
          prisma.emailRecipient.count({ where: { campaignId: id, status: 'sent' } }),
          prisma.emailRecipient.count({ where: { campaignId: id, status: 'failed' } }),
        ]);

        await prisma.campaign.update({
          where: { id },
          data: { sentCount: sent, failedCount: failed },
        });

        // Forced minimum 5s delay for humanization
        const delay = Math.max(settings.delayBetween || 5, 5);
        await sleep(delay * 1000);
      }

      // Final wrap up
      const [finalSent, finalFailed, finalTotal] = await Promise.all([
        prisma.emailRecipient.count({ where: { campaignId: id, status: 'sent' } }),
        prisma.emailRecipient.count({ where: { campaignId: id, status: 'failed' } }),
        prisma.emailRecipient.count({ where: { campaignId: id } }),
      ]);

      await prisma.campaign.update({
        where: { id },
        data: {
          status: finalFailed === finalTotal ? 'failed' : 'sent',
          sentCount: finalSent,
          failedCount: finalFailed,
        },
      });
    };

    processEmails().catch(err => console.error('[BG Send Error]', err));

    return NextResponse.json({
      message: 'Campaign sending started (GMASS-style Staggering enabled)',
      count: recipients.length
    });

  } catch (err: any) {
    console.error('[API Send Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
