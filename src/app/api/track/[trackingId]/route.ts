import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - tracking pixel endpoint (records email opens)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  try {
    const recipient = await prisma.emailRecipient.findUnique({
      where: { trackingId },
    });

    if (recipient) {
      const ua = req.headers.get('user-agent') || '';
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const now = new Date();

      // BOT DETECTION (MailChimp style)
      // Filters out corporate scanners that open emails automatically, 
      // but ALLOWS GoogleImageProxy because that's how Gmail identifies human opens.
      const isBot = /Mimecast|Proofpoint|Datadog|Bot|Crawl|Spider/i.test(ua);
      
      // RATE LIMITING (Throttling)
      // Prevent double-counting from quick double-clicks or browser refreshes
      const lastUpdate = recipient.sentAt ? recipient.sentAt.getTime() : 0; // Use sentAt as fallback if never opened
      const timeSinceLast = recipient.openedAt ? now.getTime() - recipient.openedAt.getTime() : 99999;
      
      const shouldTrack = !isBot && timeSinceLast > 1000; // 1 second throttle

      if (shouldTrack) {
        const isFirstOpen = !recipient.openedAt;

        await prisma.$transaction(async (tx) => {
          await tx.emailRecipient.update({
            where: { trackingId },
            data: {
              openedAt: recipient.openedAt || now,
              openCount: { increment: 1 },
            },
          });

          // Only increment campaign unique open count once
          if (isFirstOpen) {
            await tx.campaign.update({
              where: { id: recipient.campaignId },
              data: {
                openCount: { increment: 1 },
              },
            });
          }
        });
        
        console.log(`[TRACK] Opened: ${recipient.contactId} (UA: ${ua.substring(0, 30)}...)`);
      }
    }
  } catch (e: any) {
    console.error('Tracking error:', e.message);
  }

  // Return 1x1 transparent PNG
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  return new NextResponse(pixel, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
