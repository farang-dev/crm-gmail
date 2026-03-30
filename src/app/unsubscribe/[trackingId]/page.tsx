import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

/**
 * One-Click Unsubscribe Page
 * Decodes trackingId -> Updates Contact -> Shows Success
 */
export default async function UnsubscribePage({
  params
}: {
  params: Promise<{ trackingId: string }>
}) {
  const { trackingId } = await params;

  try {
    // 1. Locate the recipient
    const recipient = await prisma.emailRecipient.findUnique({
      where: { trackingId },
      include: { contact: true }
    });

    if (!recipient) {
      return notFound();
    }

    // 2. Perform the database update
    await prisma.contact.update({
      where: { id: recipient.contactId },
      data: { unsubscribed: true }
    });

    console.log(`[UI Unsubscribe] Opt-out confirmed for: ${recipient.contact.email}`);

    // 3. Return a clean, minimal UI
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #eee',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#111' }}>Unsubscribed</h1>
          <p style={{ color: '#666', lineHeight: '1.5' }}>
            We've removed <strong>{recipient.contact.email}</strong> from our mailing list.
          </p>
          <p style={{ marginTop: '20px', fontSize: '0.875rem', color: '#999' }}>
            You won't receive further emails from this campaign or any future messages from us.
          </p>
        </div>
      </div>
    );
  } catch (err) {
    console.error('Unsubscribe UI Error:', err);
    return (
      <div style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>Something went wrong.</h2>
        <p>We couldn't process your request. Please try again later.</p>
      </div>
    );
  }
}
