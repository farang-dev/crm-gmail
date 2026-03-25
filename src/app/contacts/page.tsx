'use client';

import { useEffect, useState } from 'react';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  tags: string | null;
  createdAt: string;
  _count?: { emails: number };
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [page, search, sortBy, sortOrder]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
      const data = await res.json();
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);

    try {
      // 1. Parse text to extract emails/names
      const parseRes = await fetch('/api/contacts/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText }),
      });
      const { contacts: parsed } = await parseRes.json();

      if (parsed.length === 0) {
        alert('No valid emails found in the text.');
        setImporting(false);
        return;
      }

      // 2. Validate for duplicates
      const valRes = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsed, validate: true }),
      });
      const valData = await valRes.json();

      let mode = 'skip';
      if (valData.duplicateCount > 0) {
        const msg = `Found ${valData.duplicateCount} existing contacts.\n\n` +
                    `Click OK to UPDATE existing contacts with new info.\n` +
                    `Click Cancel to SKIP existing contacts and only add new ones.`;
        mode = confirm(msg) ? 'overwrite' : 'skip';
      }

      // 3. Final save
      const saveRes = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsed, mode }),
      });
      const results = await saveRes.json();

      const summary = mode === 'overwrite' 
        ? `${results.created} created, ${results.updated} updated.`
        : `${results.created} created, ${results.skipped} skipped.`;
      
      alert(`Import complete: ${summary}`);
      setIsImportModalOpen(false);
      setImportText('');
      setPage(1);
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Error during import');
    } finally {
      setImporting(false);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async () => {
    try {
      // Fetch ALL contacts for export (no limit)
      const res = await fetch('/api/contacts?limit=10000');
      const data = await res.json();
      const allContacts = data.contacts || [];

      if (allContacts.length === 0) {
        alert('No contacts to export');
        return;
      }

      // CSV Header
      const headers = ['Email', 'Name', 'Company', 'Created At', 'Emails Sent'];
      
      // Map rows
      const rows = allContacts.map((c: any) => [
        c.email,
        c.name || '',
        c.company || '',
        new Date(c.createdAt).toLocaleDateString(),
        c._count?.emails || 0
      ]);

      // Combine into CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Add BOM for Excel UTF-8 compatibility (important for Japanese chars)
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Trigger download
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export contacts');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Contacts</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={handleExport}>
            Export to Excel
          </button>
          <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
            Import (Paste Text)
          </button>
        </div>
      </div>

      {isImportModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>Bulk Import Contacts</h2>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Paste data from Excel, Google Sheets, or CSV here. We automatically detect emails and associated names.
            </p>
            
            <textarea
              className="input-field"
              style={{ width: '100%', height: '200px', resize: 'vertical', marginBottom: '1.5rem', fontFamily: 'monospace' }}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Elon Musk, elon@tesla.com\nTim Cook <tim@apple.com>\n..."
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)} disabled={importing}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? 'Importing...' : 'Extract & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <input
          type="search"
          placeholder="Search by email, name or company..."
          className="input-field"
          style={{ width: '100%', maxWidth: '400px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Email {getSortIcon('email')}
              </th>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Name {getSortIcon('name')}
              </th>
              <th onClick={() => handleSort('company')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Company {getSortIcon('company')}
              </th>
              <th onClick={() => handleSort('sentCount')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center' }}>
                Sent Emails {getSortIcon('sentCount')}
              </th>
              <th>Tags</th>
              <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Date Added {getSortIcon('createdAt')}
              </th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No contacts found</td></tr>
            ) : (
              contacts.map(c => (
                <tr key={c.id}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 500, color: 'var(--foreground)' }}>{c.email}</td>
                  <td>{c.name || '-'}</td>
                  <td>{c.company || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${c._count?.emails ? 'badge-sent' : ''}`} style={{ 
                      backgroundColor: c._count?.emails ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                      color: c._count?.emails ? 'var(--success)' : 'var(--muted-foreground)',
                      border: '1px solid currentColor'
                    }}>
                      {c._count?.emails || 0}
                    </span>
                  </td>
                  <td>
                    {c.tags ? (
                      <span className="badge badge-draft">{c.tags}</span>
                    ) : '-'}
                  </td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="btn btn-destructive" 
                      style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.75rem' }}
                      onClick={() => deleteContact(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} Contacts
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button 
              className="btn btn-secondary"
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
