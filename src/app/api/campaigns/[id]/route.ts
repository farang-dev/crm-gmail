import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      emails: {
        include: { contact: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Current system settings
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  const currentEmail = settings?.gmailAddress?.trim() || '';

  // Compute aggregated stats
  const uniqueOpenCount = campaign.emails.filter((e: any) => e.openedAt !== null).length;
  const totalOpenCount = campaign.emails.reduce((sum: number, e: any) => sum + (e.openCount || 0), 0);
  const sentCount = campaign.emails.filter((e: any) => e.status === 'sent').length;
  const failedCount = campaign.emails.filter((e: any) => e.status === 'failed').length;

  // Calculate NEXT AVAILABLE SLOT for THIS account (Rolling 24h Window)
  const rolling24h = new Date();
  rolling24h.setHours(rolling24h.getHours() - 24);
  const oldestEmailToday = await prisma.emailRecipient.findFirst({
    where: { fromEmail: currentEmail, status: 'sent', sentAt: { gte: rolling24h } },
    orderBy: { sentAt: 'asc' },
    select: { sentAt: true }
  });

  let nextAvailableAt = null;
  if (oldestEmailToday?.sentAt) {
    nextAvailableAt = new Date(oldestEmailToday.sentAt.getTime() + 24 * 60 * 60 * 1000);
  }

  return NextResponse.json({
    ...campaign,
    uniqueOpenCount,
    totalOpenCount,
    sentCount, 
    failedCount,
    nextAvailableAt,
  });
}

/**
 * Update whole campaign content (PUT)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    },
  });

  return NextResponse.json(campaign);
}

/**
 * Partially update campaign status (PATCH)
 * CRITICAL: This was missing, causing Pause/Stop buttons to fail!
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  console.log(`[API PATCH] Updating campaign ${id} to status: ${body.status}`);

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      status: body.status, // Accepts 'waiting', 'sent', etc.
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(campaign);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
