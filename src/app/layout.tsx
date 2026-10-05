import { FirebaseAuthProvider } from '@/providers/firebase-auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Metadata } from 'next';

import '@/styles/globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Ping Target',
  description: 'Theo dõi mục tiêu, ghi nhận tiến độ và nhận nhắc nhở qua Telegram.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`antialiased`}>
        <QueryProvider>
          <FirebaseAuthProvider>{children}</FirebaseAuthProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
