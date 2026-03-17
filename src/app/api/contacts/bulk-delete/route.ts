import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    
    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
    }

    const result = await prisma.contact.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    return NextResponse.json({ 
      success: true, 
      count: result.count 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
