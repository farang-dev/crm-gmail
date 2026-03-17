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
      // Update open tracking
      const isFirstOpen = !recipient.openedAt;
      
      await prisma.emailRecipient.update({
        where: { trackingId },
        data: {
          openedAt: recipient.openedAt || new Date(),
          openCount: { increment: 1 },
        },
      });

      // Update campaign open count on first open
      if (isFirstOpen) {
        await prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: {
            openCount: { increment: 1 },
          },
        });
      }
    }
  } catch (e) {
    console.error('Tracking error:', e);
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
