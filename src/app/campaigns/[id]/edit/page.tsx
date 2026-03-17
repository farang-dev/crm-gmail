'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { use } from 'react';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export default function EditCampaignPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    bodyHtml: '',
  });

  useEffect(() => {
    fetch(`/api/campaigns/${resolvedParams.id}`)
      .then(res => res.json())
      .then(data => {
        setFormData({
          name: data.name,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        alert('Error loading campaign');
        router.push('/campaigns');
      });
  }, [resolvedParams.id, router]);

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
    setSaving(true);

    try {
      const bodyText = formData.bodyHtml.replace(/<[^>]*>?/gm, '');

      const res = await fetch(`/api/campaigns/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, bodyText }),
      });

      if (res.ok) {
        router.push(`/campaigns/${resolvedParams.id}`);
      } else {
        throw new Error('Failed to update campaign');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating campaign');
      setSaving(false);
    }
  };

  if (loading) return <div>Loading campaign...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">Edit Campaign</h1>
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
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
