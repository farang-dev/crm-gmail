'use client';

import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    gmailAddress: '',
    gmailAppPassword: '',
    senderName: '',
    dailyLimit: 500,
    delayBetween: 3,
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setFormData({
          gmailAddress: data.gmailAddress || '',
          gmailAppPassword: data.gmailAppPassword || '',
          senderName: data.senderName || '',
          dailyLimit: data.dailyLimit || 500,
          delayBetween: data.delayBetween || 3,
        });
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/test', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Connection successful! Your credentials are correct.' });
      } else {
        throw new Error(data.message || 'Connection failed');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px' }}>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          marginBottom: '2rem',
          borderRadius: 'var(--radius)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--destructive)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--destructive)'
        }}>
          {message.text}
        </div>
      )}

      <div className="card text-foreground">
        <form onSubmit={handleSubmit}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600 }}>Gmail SMTP Setup</h2>
          
          <div style={{ marginBottom: '2rem', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            To send emails, you need to use a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Gmail App Password</a> instead of your regular password. Ensure 2-Step Verification is enabled on your Google account.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="input-group">
              <label className="input-label">Gmail Address</label>
              <input
                type="email"
                required
                className="input-field"
                value={formData.gmailAddress}
                onChange={e => setFormData({...formData, gmailAddress: e.target.value})}
                placeholder="your.email@gmail.com"
              />
            </div>

            <div className="input-group">
              <label className="input-label">App Password</label>
              <input
                type="password"
                className="input-field"
                value={formData.gmailAppPassword}
                onChange={e => setFormData({...formData, gmailAppPassword: e.target.value})}
                placeholder={formData.gmailAppPassword ? '•••••••• (Set)' : '16-character app password'}
              />
            </div>
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label className="input-label">Sender Name (Optional)</label>
            <input
              type="text"
              className="input-field"
              value={formData.senderName}
              onChange={e => setFormData({...formData, senderName: e.target.value})}
              placeholder="e.g. John Doe from Acme Corp"
            />
          </div>

          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', marginTop: '3rem', fontWeight: 600 }}>Sending Limits</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="input-group">
              <label className="input-label">Daily Limit</label>
              <input
                type="number"
                min="1"
                max="500"
                className="input-field"
                value={formData.dailyLimit}
                onChange={e => setFormData({...formData, dailyLimit: parseInt(e.target.value)})}
                placeholder="500"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Regular Gmail limit is 500/day</span>
            </div>

            <div className="input-group">
              <label className="input-label">Delay Between Emails (seconds)</label>
              <input
                type="number"
                min="1"
                max="60"
                className="input-field"
                value={formData.delayBetween}
                onChange={e => setFormData({...formData, delayBetween: parseInt(e.target.value)})}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Prevents getting blocked by Gmail algorithms</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={testConnection}
              disabled={testing || !formData.gmailAddress || (!formData.gmailAppPassword && formData.gmailAppPassword === '')}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
