import type { Metadata } from 'next';
import './globals.css';
import 'react-quill-new/dist/quill.snow.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Gmail CRM',
  description: 'Local CRM for bulk sending emails via Gmail SMTP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ 
            flex: 1, 
            padding: '2rem 3rem',
            marginLeft: '260px',
            width: 'calc(100% - 260px)',
            maxWidth: '1200px',
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
