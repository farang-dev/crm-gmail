import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET all contacts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;

  let orderBy: any = {};
  if (sortBy === 'sentCount') {
    orderBy = {
      emails: {
        _count: sortOrder
      }
    };
  } else {
    orderBy = { [sortBy]: sortOrder };
  }

  const where = search
    ? {
        OR: [
          { email: { contains: search } },
          { name: { contains: search } },
          { company: { contains: search } },
        ],
      }
    : {};

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            emails: {
              where: { status: 'sent' }
            }
          }
        }
      }
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({ contacts, total, page, limit });
}

// POST create contact(s) - supports bulk
export async function POST(req: NextRequest) {
  const body = await req.json();

  // If body is an array, bulk create
  if (Array.isArray(body) || (typeof body === 'object' && body.contacts)) {
    const contacts = Array.isArray(body) ? body : body.contacts;
    const mode = body.mode || 'skip'; // 'skip' or 'overwrite'
    const validate = body.validate || false;

    if (validate) {
      const emails = contacts.map((c: any) => c.email?.trim().toLowerCase()).filter(Boolean);
      const existing = await prisma.contact.findMany({
        where: { email: { in: emails } },
        select: { email: true }
      });
      const existingEmails = existing.map(e => e.email);
      const duplicates = contacts.filter((c: any) => existingEmails.includes(c.email?.trim().toLowerCase()));
      const news = contacts.filter((c: any) => !existingEmails.includes(c.email?.trim().toLowerCase()));
      
      return NextResponse.json({
        duplicateCount: duplicates.length,
        newCount: news.length,
        duplicates: duplicates.slice(0, 10), // Return some for preview
      });
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
    
    for (const item of contacts) {
      try {
        const email = item.email?.trim().toLowerCase();
        if (!email) {
          results.skipped++;
          continue;
        }
        
        const existing = await prisma.contact.findUnique({ where: { email } });
        if (existing) {
          if (mode === 'overwrite') {
            await prisma.contact.update({
              where: { email },
              data: {
                name: item.name?.trim() || existing.name,
                company: item.company?.trim() || existing.company,
                tags: item.tags?.trim() || existing.tags,
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
          continue;
        }

        await prisma.contact.create({
          data: {
            email,
            name: item.name?.trim() || null,
            company: item.company?.trim() || null,
            tags: item.tags?.trim() || null,
          },
        });
        results.created++;
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        results.errors.push(`${item.email}: ${errorMsg}`);
      }
    }

    return NextResponse.json(results);
  }

  // Single create
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        email,
        name: body.name?.trim() || null,
        company: body.company?.trim() || null,
        tags: body.tags?.trim() || null,
      },
    });
    return NextResponse.json(contact);
  } catch {
    return NextResponse.json({ error: 'Contact already exists' }, { status: 409 });
  }
}

// DELETE all contacts
export async function DELETE() {
  await prisma.contact.deleteMany();
  return NextResponse.json({ success: true });
}
