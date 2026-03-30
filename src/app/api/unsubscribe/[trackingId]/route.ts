import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Handle Unsubscribe Request
 * URL: /api/unsubscribe/[trackingId]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  try {
    // 1. Find the recipient record by tracking ID
    const recipient = await prisma.emailRecipient.findUnique({
      where: { trackingId },
      include: { contact: true }
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 404 });
    }

    // 2. Mark the contact as unsubscribed in the main database
    await prisma.contact.update({
      where: { id: recipient.contactId },
      data: { unsubscribed: true }
    });

    console.log(`[Unsubscribe] Contact unsubscribed: ${recipient.contact.email}`);

    // Redirect to a confirmation page or return success
    // For now, redirect to a simple static URL or just return a response
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    
    // Redirect to the frontend confirmation page we are about to create
    return NextResponse.redirect(`${protocol}://${host}/unsubscribe/success`);

  } catch (err) {
    console.error('[Unsubscribe Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
