'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  createdAt: string;
  _count: { emails: number };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(res => res.json())
      .then(data => {
        setCampaigns(data.campaigns);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCampaigns(campaigns.filter(c => c.id !== id));
      } else {
        alert('Failed to delete campaign');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting campaign');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Campaigns</h1>
        <Link href="/campaigns/new" className="btn btn-primary">
          + Draft Campaign
        </Link>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)' }}>
                  No campaigns found. <Link href="/campaigns/new" style={{ color: 'var(--primary)' }}>Create one</Link> now.
                </td>
              </tr>
            ) : (
              campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>
                    <Link href={`` + `/campaigns/${c.id}`} style={{ color: 'var(--foreground)' }}>
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.subject}</td>
                  <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                  <td>{c._count.emails}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href={`` + `/campaigns/${c.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.75rem' }}>
                      View
                    </Link>
                    <Link 
                      href={`` + `/campaigns/new?templateId=${c.id}`} 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.75rem', backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.2)' }}
                    >
                      Duplicate
                    </Link>
                    <button 
                      className="btn btn-destructive" 
                      style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.75rem' }}
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
