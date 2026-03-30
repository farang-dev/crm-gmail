'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const [loading, setLoading] = useState(false);
  const [fetchingTemplate, setFetchingTemplate] = useState(!!templateId);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    bodyHtml: '',
    recipients: '',
  });

  const isResend = searchParams.get('autoSend') === 'true';

  useEffect(() => {
    if (templateId) {
      fetch(`/api/campaigns/${templateId}`)
        .then(res => res.json())
        .then(data => {
          setFormData(prev => ({
            ...prev,
            name: isResend ? `${data.name} (Resent ${new Date().toLocaleDateString()})` : '',
            subject: data.subject || '',
            bodyHtml: data.bodyHtml || '',
            recipients: isResend ? (data.emails || []).map((e: any) => e.contact?.email).filter(Boolean).join('\n') : '',
          }));
        })
        .catch(err => console.error('Failed to fetch template:', err))
        .finally(() => setFetchingTemplate(false));
    }
  }, [templateId]);

  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'clean']
    ],
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Basic text conversion from HTML for bodyText (can be improved later)
      const bodyText = formData.bodyHtml.replace(/<[^>]*>?/gm, '');

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, bodyText }),
      });

      if (res.ok) {
        const campaign = await res.json();
        router.push(`/campaigns/${campaign.id}`);
      } else {
        throw new Error('Failed to create campaign');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating campaign');
      setLoading(false);
    }
  };

  if (fetchingTemplate) return <div className="animate-fade-in" style={{ padding: '2rem' }}>Loading template content...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">{isResend ? 'Resend Campaign' : 'New Campaign'}</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Campaign Name (Internal)</label>
            <input
              type="text"
              required
              className="input-field"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Q4 Newsletter"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Initial Recipients (To)</label>
            <textarea
              className="input-field"
              style={{ minHeight: '80px', resize: 'vertical' }}
              value={formData.recipients}
              onChange={e => setFormData({...formData, recipients: e.target.value})}
              placeholder="Paste email addresses here (comma or line separated)..."
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                Emails will be automatically added to your contact list.
              </span>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: formData.recipients.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)?.length ? 'var(--success)' : 'var(--muted-foreground)' 
              }}>
                {formData.recipients.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)?.length || 0} emails detected
              </span>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Email Subject</label>
            <input
              type="text"
              required
              className="input-field"
              value={formData.subject}
              onChange={e => setFormData({...formData, subject: e.target.value})}
              placeholder="Exciting news for you!"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Email Body</label>
            <div className="editor-container" style={{ minHeight: '300px', backgroundColor: 'var(--background)' }}>
              <ReactQuill 
                theme="snow"
                value={formData.bodyHtml}
                onChange={content => setFormData({...formData, bodyHtml: content})}
                modules={modules}
                formats={formats}
                placeholder="Compose your email here... Format will be preserved."
                style={{ height: '300px', marginBottom: '40px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Draft & Select Recipients'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
