import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CBT Platform — Enterprise Examination Management',
  description: 'Secure, AI-powered computer-based testing for universities, recruitment, and certification bodies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
