'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  totalContacts: number;
  totalCampaigns: number;
  totalSent: number;
  totalOpened: number;
  sentToday: number;
  dailyLimit: number;
  nextAvailableAt: string | null;
  overallOpenRate: number;
  campaigns: {
    id: string;
    name: string;
    status: string;
    totalCount: number;
    sentCount: number;
    openCount: number;
    failedCount: number;
    openRate: number;
    sentAt: string | null;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load dashboard:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="animate-fade-in">Loading dashboard...</div>;

  const remainingToday = Math.max(0, (stats?.dailyLimit || 500) - (stats?.sentToday || 0));
  const usagePercent = Math.min(100, ((stats?.sentToday || 0) / (stats?.dailyLimit || 500)) * 100);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <Link href="/campaigns/new" className="btn btn-primary">
          + New Campaign
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2.5rem'
      }}>
        <StatCard title="Total Contacts" value={stats?.totalContacts || 0} color="var(--primary)" />
        <StatCard title="Total Campaigns" value={stats?.totalCampaigns || 0} color="#a855f7" />
        <StatCard 
          title="Daily Limit (via this app)" 
          value={`${stats?.sentToday || 0} / ${stats?.dailyLimit || 500}`} 
          color={usagePercent > 80 ? 'var(--destructive)' : usagePercent > 50 ? 'var(--warning)' : 'var(--success)'}
          footer={
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${usagePercent}%`, height: '100%', backgroundColor: usagePercent > 80 ? 'var(--destructive)' : usagePercent > 50 ? 'var(--warning)' : 'var(--success)', transition: 'width 0.5s ease' }}></div>
              </div>
              <div style={{ fontSize: '0.65rem', marginTop: '0.5rem', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                {remainingToday} remaining. This only tracks emails sent via this app.
                {stats?.nextAvailableAt && (
                  <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem' }}>
                    Next slot available around: {new Date(stats.nextAvailableAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          }
        />
        <StatCard title="Emails Sent" value={stats?.totalSent || 0} color="var(--success)" />
        <StatCard title="Emails Opened" value={stats?.totalOpened || 0} color="var(--primary)" />
        <StatCard 
          title="Avg Open Rate" 
          value={`${stats?.overallOpenRate || 0}%`} 
          color={stats && stats.overallOpenRate > 30 ? 'var(--success)' : 'var(--warning)'} 
        />
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: 600 }}>Recent Campaigns</h2>
      
      {stats?.campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>No campaigns yet</h3>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
            Create your first campaign to start sending emails.
          </p>
          <Link href="/campaigns/new" className="btn btn-primary">
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Status</th>
                <th>Sent / Total</th>
                <th>Open Rate</th>
                <th>Sent Date</th>
              </tr>
            </thead>
            <tbody>
              {stats?.campaigns.map(camp => (
                <tr key={camp.id}>
                  <td style={{ fontWeight: 500 }}>
                    <Link href={`/campaigns/${camp.id}`} style={{ color: 'var(--primary)' }}>
                      {camp.name}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge badge-${camp.status}`}>
                      {camp.status}
                    </span>
                  </td>
                  <td>{camp.sentCount} / {camp.totalCount}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: camp.openRate > 0 ? 'var(--success)' : 'inherit' }}>
                        {camp.openRate}%
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        ({camp.openCount})
                      </span>
                    </div>
                  </td>
                  <td>{camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color, footer }: { title: string, value: string | number, color: string, footer?: React.ReactNode }) {
  return (
    <div className="card" style={{ 
      position: 'relative', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>{title}</h3>
          <div style={{ 
            background: `color-mix(in srgb, ${color} 15%, transparent)`, 
            width: '8px', height: '8px',
            borderRadius: '50%',
            marginTop: '0.5rem'
          }}>
          </div>
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>
          {value}
        </div>
      </div>
      
      {footer && footer}
      
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '4px',
        background: `linear-gradient(to right, ${color}, transparent)`
      }}></div>
    </div>
  );
}
