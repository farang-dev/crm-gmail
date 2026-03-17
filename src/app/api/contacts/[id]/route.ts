import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  
  const contact = await prisma.contact.update({
    where: { id },
    data: {
      email: body.email?.trim().toLowerCase(),
      name: body.name?.trim() || null,
      company: body.company?.trim() || null,
      tags: body.tags?.trim() || null,
    },
  });
  
  return NextResponse.json(contact);
}
