import nodemailer from 'nodemailer';
import { prisma } from './prisma';

export async function getTransporter() {
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  
  if (!settings || !settings.gmailAddress || !settings.gmailAppPassword) {
    throw new Error('Gmail settings not configured. Please configure in Settings.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: settings.gmailAddress,
      pass: settings.gmailAppPassword,
    },
  });

  return { transporter, settings };
}

export async function sendSingleEmail({
  to,
  subject,
  html,
  text,
  senderName,
  senderEmail,
  trackingId,
  baseUrl,
  campaignId,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  senderName: string;
  senderEmail: string;
  trackingId: string;
  baseUrl: string;
  campaignId?: string;
}) {
  const { transporter } = await getTransporter();

  // NON-DESTRUCTIVE CLEANING
  const cleanTo = to.trim().replace(/\s/g, '');
  const cleanFrom = senderEmail.trim();

  // VERIFIED: Hex trace is perfect. No hidden characters.
  const hex = Buffer.from(cleanTo).toString('hex');
  console.log(`[SMTP DEBUG] Sending to: "${cleanTo}" | Hex: ${hex}`);

  // NO BS: Send the raw HTML from the editor exactly as it is.
  // No extra wrappers, no forced fonts, no automatic styling.
  let finalHtml = html;
  
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  if (!isLocal) {
    const trackingPixel = `<img src="${baseUrl}/api/track/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
    finalHtml = html + trackingPixel;
  }

  const mailOptions: any = {
    from: senderName ? `"${senderName}" <${cleanFrom}>` : cleanFrom,
    to: cleanTo,
    subject: subject.trim(),
    html: finalHtml,
    text: text || subject.trim(), // CRITICAL: Missing text equivalent is a major spam trigger
    headers: {
      'X-Mailer': undefined, // Removed identifying bot header
    },
  };

  return transporter.sendMail(mailOptions);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
