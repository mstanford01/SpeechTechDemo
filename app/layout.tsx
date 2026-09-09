import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Experis Voice Studio',
  description:
    'Create spoken audio from text, documents, and articles. A local demo from Experis.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
