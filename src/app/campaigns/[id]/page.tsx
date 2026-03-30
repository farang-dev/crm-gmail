'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function CampaignDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${resolvedParams.id}`).then(res => res.json()),
      fetch('/api/contacts?limit=1000').then(res => res.json())
    ]).then(([campData, contData]) => {
      setCampaign(campData);
      setContacts(contData.contacts || []);
      
      if (campData.status === 'draft' && campData.emails) {
        const preselected = new Set<string>(campData.emails.map((e: any) => e.contactId));
        setSelectedContacts(preselected);
      }
      
      setLoading(false);
    });
  }, [resolvedParams.id]);

  // Polling for active campaigns
  useEffect(() => {
    if (campaign?.status !== 'sending') return;

    const timer = setInterval(() => {
      fetch(`/api/campaigns/${resolvedParams.id}`)
        .then(res => res.json())
        .then(data => {
          setCampaign(data);
        })
        .catch(err => console.error('Polling error:', err));
    }, 5000);

    return () => clearInterval(timer);
  }, [campaign?.status, resolvedParams.id]);

  const handleSend = async () => {
    if (selectedContacts.size === 0) {
      alert('Select at least one contact to send to');
      return;
    }

    const repeatContacts = Array.from(selectedContacts).filter(id => {
      const contact = contacts.find(c => c.id === id);
      return (contact?._count?.emails || 0) > 0;
    });

    let contactIdsToSend = Array.from(selectedContacts);

    if (repeatContacts.length > 0) {
      const skipRepeats = confirm(
        `${repeatContacts.length} of the selected contacts have already received emails previously.\n\n` +
        `Click [OK] to SKIP these contacts and only send to new people (${selectedContacts.size - repeatContacts.length} total).\n` +
        `Click [Cancel] to SEND to everyone anyway (${selectedContacts.size} total).`
      );
      
      if (skipRepeats) {
        contactIdsToSend = contactIdsToSend.filter(id => !repeatContacts.includes(id));
        if (contactIdsToSend.length === 0) {
          alert('No new contacts to send to.');
          return;
        }
      }
    } else {
      if (!confirm(`Are you sure you want to send this email to ${selectedContacts.size} recipients?`)) {
        return;
      }
    }

    setSending(true);

    try {
      const res = await fetch(`/api/campaigns/${resolvedParams.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: contactIdsToSend }),
      });

      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status}`);
      }
      
      if (res.ok) {
        window.location.reload();
      } else {
        throw new Error(data.error || 'Failed to start sending');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setSending(false);
    }
  };

  const handleRetryFailed = async () => {
    const failedIds = (campaign.emails || [])
      .filter((e: any) => e.status === 'failed' && !(e.errorMsg || '').includes('550') && !(e.errorMsg || '').toLowerCase().includes('unknown'))
      .map((e: any) => e.contactId);
    
    if (failedIds.length === 0) {
      alert('No retryable failures found.');
      return;
    }

    if (!confirm(`Retry sending to ${failedIds.length} failed recipients?`)) return;

    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${resolvedParams.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: failedIds }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to retry');
        setSending(false);
      }
    } catch (err: any) {
      alert(err.message);
      setSending(false);
    }
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContacts(next);
  };

  const toggleAll = () => {
    const filtered = contacts.filter(c => 
      c.email.toLowerCase().includes(search.toLowerCase()) || 
      (c.name && c.name.toLowerCase().includes(search.toLowerCase()))
    );
    if (selectedContacts.size === filtered.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filtered.map(c => c.id)));
    }
  };

  if (loading) return <div>Loading campaign...</div>;
  if (!campaign) return <div>Campaign not found</div>;

  const filteredContacts = contacts.filter(c => 
    c.email.toLowerCase().includes(search.toLowerCase()) || 
    (c.name && c.name.toLowerCase().includes(search.toLowerCase()))
  );

  const isDraft = campaign.status === 'draft';

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="page-title">{campaign.name}</h1>
          <span className={`badge badge-${campaign?.status || 'draft'}`} style={{ fontSize: '1rem', padding: '0.25rem 1rem' }}>
            {String(campaign?.status || 'DRAFT').toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(campaign.status === 'draft' || campaign.status === 'failed') && (
            <button 
              className="btn btn-secondary" 
              onClick={() => router.push(`/campaigns/${resolvedParams.id}/edit`)}
            >
              Edit Content
            </button>
          )}

          {campaign.status === 'sending' && (
            <button 
              className="btn btn-destructive" 
              onClick={async () => {
                if (!confirm('Pause this campaign?')) return;
                try {
                  const res = await fetch(`/api/campaigns/${resolvedParams.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'waiting' }),
                  });
                  if (res.ok) window.location.reload();
                } catch (err) {
                  alert('Failed to pause');
                }
              }}
            >
              Pause Sending
            </button>
          )}

          {(campaign.status === 'waiting' || campaign.status === 'failed') && (campaign.emails || []).some((e: any) => e.status === 'pending') && (
            <button 
              className="btn btn-primary" 
              disabled={sending}
              onClick={async () => {
                const pendingIds = (campaign.emails || [])
                  .filter((e: any) => e.status === 'pending')
                  .map((e: any) => e.contactId);
                
                if (pendingIds.length === 0) return;
                
                setSending(true);
                try {
                  const res = await fetch(`/api/campaigns/${resolvedParams.id}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactIds: pendingIds }),
                  });
                  if (res.ok) {
                    window.location.reload();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to resume');
                    setSending(false);
                  }
                } catch (err: any) {
                  alert(err.message);
                  setSending(false);
                }
              }}
            >
              {sending ? 'Starting...' : `Resume Sending (${(campaign.emails || []).filter((e: any) => e.status === 'pending').length} left)`}
            </button>
          )}
        </div>
      </div>

      {campaign.status === 'waiting' && (
        <div style={{ 
          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
          border: '1px solid var(--primary)', 
          padding: '1rem', 
          borderRadius: 'var(--radius)', 
          marginBottom: '2rem',
          fontSize: '0.875rem'
        }}>
          💡 <strong>Paused / Queued Mode</strong>: This campaign is currently on hold. This happens if:
          <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
            <li>You reached your <strong>Daily Sending Limit</strong> in Settings.</li>
            <li>Another campaign is currently being sent.</li>
          </ul>
          Please check your <strong>Settings</strong> to increase your limit or wait until tomorrow for the automatic reset.
          {campaign.nextAvailableAt && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 'calc(var(--radius) - 2px)', fontWeight: 600 }}>
              🚀 Next sending slot opens around: {new Date(campaign.nextAvailableAt).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '2rem', color: 'var(--muted-foreground)' }}>
        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>Subject:</span> {campaign.subject}
      </div>

      <div className="card" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)', margin: '1.5rem 1.5rem 1rem 1.5rem', textTransform: 'uppercase' }}>Preview</h3>
        <div className="ql-container ql-snow" style={{ border: 'none' }}>
          <div 
            className="ql-editor" 
            style={{ 
              minHeight: '100px',
              borderTop: '1px solid var(--border)'
            }} 
            dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }} 
          />
        </div>
      </div>

      {!isDraft && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Recipients</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{campaign.totalCount}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Dispatched</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{campaign.sentCount}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Total Opens</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{campaign.totalOpenCount || 0}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Unique Opens</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{campaign.uniqueOpenCount || 0}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Open Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{campaign.sentCount > 0 ? ((campaign.uniqueOpenCount / campaign.sentCount) * 100).toFixed(1) : 0}%</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Domain Insights (Delivery Analysis)</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
              Analyze delivery performance by company domain. High "Dispatched" but low "Opened" may indicate temporary blocks or delivery delays.
            </p>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Dispatched</th>
                    <th>Opened</th>
                    <th>Confirmed Rate</th>
                    <th>Status Hint</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    (campaign.emails || []).reduce((acc: any, e: any) => {
                      const domain = e.contact?.email?.split('@')[1];
                      if (!domain) return acc;
                      if (!acc[domain]) acc[domain] = { sent: 0, opened: 0 };
                      if (e.status === 'sent') acc[domain].sent++;
                      if (e.openedAt) acc[domain].opened++;
                      return acc;
                    }, {})
                  ).sort((a: any, b: any) => b[1].sent - a[1].sent).map(([domain, stats]: [string, any]) => (
                    <tr key={domain}>
                      <td style={{ fontWeight: 600 }}>@{domain}</td>
                      <td>{stats.sent}</td>
                      <td>{stats.opened}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                            <div style={{ 
                              width: `${stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0}%`, 
                              height: '100%', 
                              backgroundColor: 'var(--primary)' 
                            }}></div>
                          </div>
                          <span>{stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(0) : 0}%</span>
                        </div>
                      </td>
                      <td>
                        {stats.sent > 1 && stats.opened === 0 ? (
                          <span style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>⚠️ Potential Block/Delay</span>
                        ) : (
                          <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✓ Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isDraft ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select Recipients</h2>
            <button 
              className="btn btn-primary" 
              onClick={handleSend}
              disabled={sending || selectedContacts.size === 0}
            >
              {sending ? 'Sending via Gmail...' : `Send to ${selectedContacts.size} Contacts`}
            </button>
          </div>

          <input
            type="search"
            placeholder="Search contacts..."
            className="input-field"
            style={{ width: '100%', maxWidth: '400px', marginBottom: '1rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th>
                    <input 
                      type="checkbox" 
                      checked={selectedContacts.size > 0 && selectedContacts.size === filteredContacts.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Sent Emails</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map(c => (
                  <tr key={c.id} onClick={() => toggleContact(c.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedContacts.has(c.id)}
                        onChange={() => toggleContact(c.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td>{c.email}</td>
                    <td>{c.name || '-'}</td>
                    <td>{c.company || '-'}</td>
                    <td>
                      <span className={`badge ${c._count?.emails ? 'badge-sent' : ''}`} style={{ 
                        backgroundColor: c._count?.emails ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                        color: c._count?.emails ? 'var(--success)' : 'var(--muted-foreground)',
                        border: '1px solid currentColor',
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem'
                      }}>
                        {c._count?.emails || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recipient Status</h2>
            {(campaign.emails || []).some((e: any) => e.status === 'failed' && !(e.errorMsg || '').includes('550') && !(e.errorMsg || '').toLowerCase().includes('unknown')) && (
              <button 
                className="btn btn-secondary" 
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
                onClick={handleRetryFailed}
                disabled={sending}
              >
                🔄 Retry All Non-Permanent Failures
              </button>
            )}
          </div>
          
          {(campaign.emails || []).some((e: any) => (e.errorMsg || '').includes('550') || (e.errorMsg || '').toLowerCase().includes('unknown')) && (
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid var(--destructive)', 
              padding: '1rem', 
              borderRadius: 'var(--radius)', 
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong style={{ color: 'var(--destructive)' }}>Invalid Addresses Detected</strong>
                <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Some emails bounced because the addresses do not exist (User Unknown). 
                  Cleaning these will improve your delivery reputation.
                </p>
              </div>
              <button 
                className="btn btn-destructive" 
                onClick={async () => {
                  if (!confirm('Remove these invalid emails from your master contact list?')) return;
                  const invalidIds = (campaign.emails || [])
                    .filter((e: any) => (e.errorMsg || '').includes('550') || (e.errorMsg || '').toLowerCase().includes('unknown'))
                    .map((e: any) => e.contactId);
                  
                  try {
                    await fetch('/api/contacts/bulk-delete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids: invalidIds }),
                    });
                    alert('Invalid contacts removed from your database.');
                    window.location.reload();
                  } catch (err) {
                    alert('Failed to clean contacts');
                  }
                }}
              >
                Clean Invalid Contacts
              </button>
            </div>
          )}
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Date Sent</th>
                  <th>Error Details</th>
                </tr>
              </thead>
              <tbody>
                {(campaign.emails || []).map((e: any) => {
                  const isPermanentFail = (e.errorMsg || '').includes('550') || (e.errorMsg || '').toLowerCase().includes('unknown');
                  return (
                    <tr key={e.id}>
                      <td>{e.contact.email}</td>
                      <td>
                        <span className={`badge badge-${e.status}`}>
                          {isPermanentFail ? 'BOUNCED' : e.status}
                        </span>
                      </td>
                      <td>
                        {e.openedAt ? (
                          <span style={{ color: 'var(--success)' }}>
                            Yes ({e.openCount}x)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted-foreground)' }}>No</span>
                        )}
                      </td>
                      <td>{e.sentAt ? new Date(e.sentAt).toLocaleString() : '-'}</td>
                      <td style={{ color: isPermanentFail ? 'var(--destructive)' : 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: isPermanentFail ? 600 : 400 }}>
                        {isPermanentFail ? `❌ ${e.errorMsg}` : (e.errorMsg || '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
