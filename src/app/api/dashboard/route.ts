import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET dashboard stats
export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalContacts, totalCampaigns, campaigns, sentToday, settings, stats] = await Promise.all([
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
        sentAt: {
          gte: today,
        },
      },
    }),
    prisma.settings.findUnique({ where: { id: 'default' } }),
    prisma.campaign.aggregate({
      _sum: {
        sentCount: true,
        openCount: true,
      }
    })
  ]);

  const totalSent = stats._sum.sentCount || 0;
  const totalOpened = stats._sum.openCount || 0;

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
    overallOpenRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
    campaigns: campaignStats,
  });
}
