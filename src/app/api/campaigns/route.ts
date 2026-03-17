import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET all campaigns
export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { emails: true },
      },
    },
  });

  return NextResponse.json({ campaigns });
}

// POST create campaign
export async function POST(req: Request) {
  const body = await req.json();

  if (!body.name || !body.subject || !body.bodyHtml) {
    return NextResponse.json(
      { error: 'Name, subject, and body are required' },
      { status: 400 }
    );
  }

  // Parse recipients if provided
  let contactIds: string[] = [];
  if (body.recipients && typeof body.recipients === 'string') {
    const emailRegex = /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = body.recipients.match(emailRegex) || [];
    const uniqueEmails: string[] = Array.from(new Set(matches.map((e: string) => e.toLowerCase())));

    for (const email of uniqueEmails) {
      // Find or create contact
      const contact = await prisma.contact.upsert({
        where: { email },
        update: {},
        create: { email },
      });
      contactIds.push(contact.id);
    }
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: (body.bodyText as string) || null,
      totalCount: contactIds.length,
      emails: {
        create: contactIds.map(id => ({
          contactId: id,
        }))
      }
    },
  });

  return NextResponse.json(campaign);
}
