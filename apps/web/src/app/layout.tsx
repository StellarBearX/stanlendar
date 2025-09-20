import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import QueryProvider from '@/components/providers/QueryProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ToastProvider } from '@/components/common/Toast';
import { OfflineIndicator } from '@/components/common/OfflineIndicator';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Class Schedule Sync',
  description: 'Manage your class schedule with Google Calendar integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <ToastProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
            <OfflineIndicator />
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}