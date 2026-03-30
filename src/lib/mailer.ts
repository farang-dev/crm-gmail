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
  contactName,
  contactCompany,
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
  contactName?: string | null;
  contactCompany?: string | null;
}) {
  const { transporter } = await getTransporter();

  // NON-DESTRUCTIVE CLEANING
  const cleanTo = to.trim().replace(/\s/g, '');
  const cleanFrom = senderEmail.trim();

  // VERIFIED: Hex trace is perfect. No hidden characters.
  const hex = Buffer.from(cleanTo).toString('hex');
  console.log(`[SMTP DEBUG] Sending to: "${cleanTo}" | Hex: ${hex}`);

  // NO BS: Send the raw HTML from the editor exactly as it is.
  let finalHtml = html;
  let finalText = text || subject.trim();
  
  const unsubscribeUrl = `${baseUrl}/unsubscribe/${trackingId}`;
  const unSubFooter = `
    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-family: sans-serif; font-size: 12px; color: #999;">
      You received this email from ${senderName || senderEmail}.<br>
      <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Unsubscribe from this list</a>
    </div>
  `;
  const unSubTextFooter = `\n\n---\nTo unsubscribe, visit: ${unsubscribeUrl}`;

  if (finalHtml.includes('{{unsubscribe}}')) {
    finalHtml = finalHtml.replace(/\{\{unsubscribe\}\}/g, unsubscribeUrl);
  } else {
    finalHtml += unSubFooter;
  }

  if (finalText.includes('{{unsubscribe}}')) {
    finalText = finalText.replace(/\{\{unsubscribe\}\}/g, unsubscribeUrl);
  } else {
    finalText += unSubTextFooter;
  }
  
  // PERSONALIZATION (MERGE TAGS)
  const replaceTags = (input: string) => {
    return input
      .replace(/\{\{name\}\}/g, contactName || 'there')
      .replace(/\{\{company\}\}/g, contactCompany || 'your company');
  };

  finalHtml = replaceTags(finalHtml);
  finalText = replaceTags(finalText);
  const finalSubject = replaceTags(subject.trim());
  
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  
  if (!isLocal) {
    const trackingPixel = `<img src="${baseUrl}/api/track/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
    finalHtml = finalHtml + trackingPixel;
  }

  const mailOptions: any = {
    from: senderName ? `"${senderName}" <${cleanFrom}>` : cleanFrom,
    to: cleanTo,
    subject: finalSubject,
    html: finalHtml,
    text: finalText,
    headers: {
      'X-Mailer': undefined,
    },
  };

  // Only add List-Unsubscribe if we have a public URL
  if (!isLocal) {
    mailOptions.headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
  }

  return transporter.sendMail(mailOptions);
}

/**
 * Returns a randomized delay based on the base seconds to mimic human behavior (Jitter)
 */
export function sleep(seconds: number) {
  // Add 80% to 150% jitter
  const variance = 0.8 + Math.random() * 0.7; 
  const ms = seconds * 1000 * variance;
  return new Promise(resolve => setTimeout(resolve, ms));
}
