import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET settings
export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  
  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 'default' },
    });
  }

  // Mask the password for security
  return NextResponse.json({
    ...settings,
    gmailAppPassword: settings.gmailAppPassword ? '••••••••' : '',
  });
}

// PUT update settings
export async function PUT(req: Request) {
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.gmailAddress !== undefined) data.gmailAddress = body.gmailAddress;
  if (body.gmailAppPassword !== undefined && body.gmailAppPassword !== '••••••••') {
    data.gmailAppPassword = body.gmailAppPassword;
  }
  if (body.senderName !== undefined) data.senderName = body.senderName;
  if (body.dailyLimit !== undefined) data.dailyLimit = parseInt(body.dailyLimit);
  if (body.delayBetween !== undefined) data.delayBetween = parseInt(body.delayBetween);

  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data } as Record<string, unknown> & { id: string },
  });

  return NextResponse.json({
    ...settings,
    gmailAppPassword: settings.gmailAppPassword ? '••••••••' : '',
  });
}
