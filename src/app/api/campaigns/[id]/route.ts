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

  return NextResponse.json(campaign);
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
