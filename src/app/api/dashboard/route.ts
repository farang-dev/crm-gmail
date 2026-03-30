import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET dashboard stats
export async function GET() {
  const rolling24h = new Date();
  rolling24h.setHours(rolling24h.getHours() - 24);

  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  const currentEmail = settings?.gmailAddress || '';

  const [totalContacts, totalCampaigns, campaigns, sentToday, stats] = await Promise.all([
    prisma.contact.count(),
    prisma.campaign.count(),
    prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        emails: {
          select: {
            status: true,
            openedAt: true,
            openCount: true,
          },
        },
      },
    }),
    prisma.emailRecipient.count({
      where: {
        status: 'sent',
        fromEmail: currentEmail, // Filter by current address!
        sentAt: {
          gte: rolling24h,
        },
      },
    }),
    prisma.campaign.aggregate({
      _sum: {
        sentCount: true,
        openCount: true,
      }
    })
  ]);

  const totalSent = stats._sum.sentCount || 0;
  const totalOpened = stats._sum.openCount || 0;

  // Calculate NEXT AVAILABLE SLOT (Rolling 24h Window)
  // Get the single oldest email sent in the last 24 hours (rolling24h already defined above)
  const oldestEmailToday = await prisma.emailRecipient.findFirst({
    where: { status: 'sent', sentAt: { gte: rolling24h } },
    orderBy: { sentAt: 'asc' },
    select: { sentAt: true }
  });

  let nextAvailableAt = null;
  if (oldestEmailToday?.sentAt) {
    nextAvailableAt = new Date(oldestEmailToday.sentAt.getTime() + 24 * 60 * 60 * 1000);
  }

  const campaignStats = campaigns.map(c => {
    const sentEmails = c.emails.filter(e => e.status === 'sent').length;
    const openedEmails = c.emails.filter(e => e.openedAt !== null).length;
    const openRate = sentEmails > 0 ? (openedEmails / sentEmails) * 100 : 0;

    return {
      id: c.id,
      name: c.name,
      subject: c.subject,
      status: c.status,
      totalCount: c.totalCount,
      sentCount: c.sentCount,
      openCount: c.openCount,
      failedCount: c.failedCount,
      openRate: Math.round(openRate * 10) / 10,
      sentAt: c.sentAt,
      createdAt: c.createdAt,
    };
  });

  return NextResponse.json({
    totalContacts,
    totalCampaigns,
    totalSent,
    totalOpened,
    sentToday,
    dailyLimit: settings?.dailyLimit || 500,
    nextAvailableAt,
    overallOpenRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
    campaigns: campaignStats,
  });
}
