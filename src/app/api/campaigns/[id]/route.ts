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
        include: {
          contact: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Compute aggregated stats on the fly for definitive accuracy
  const uniqueOpenCount = campaign.emails.filter((e: any) => e.openedAt !== null).length;
  const totalOpenCount = campaign.emails.reduce((sum: number, e: any) => sum + (e.openCount || 0), 0);
  const sentCount = campaign.emails.filter((e: any) => e.status === 'sent').length;
  const failedCount = campaign.emails.filter((e: any) => e.status === 'failed').length;

  return NextResponse.json({
    ...campaign,
    uniqueOpenCount,
    totalOpenCount,
    sentCount, 
    failedCount,
  });
}

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
