'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Contacts', path: '/contacts' },
    { name: 'Campaigns', path: '/campaigns' },
    { name: 'Settings', path: '/settings' },
  ];

  if (!mounted) return null;

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      borderRight: '1px solid var(--border)',
      backgroundColor: 'rgba(22, 27, 34, 0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      <div style={{
        padding: '2rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 700,
          background: 'linear-gradient(45deg, var(--primary), #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          GmailCRM
        </h1>
      </div>

      <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          
          return (
            <Link 
              key={item.path} 
              href={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                transition: 'all 0.2s',
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive ? '0 4px 14px 0 rgba(59, 130, 246, 0.39)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'var(--foreground)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--muted-foreground)';
                }
              }}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
        <p>Local environment only</p>
        <p>Limit: 500 emails / day</p>
      </div>
    </aside>
  );
}
