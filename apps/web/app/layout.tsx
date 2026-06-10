import './globals.css';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Refrain Web',
  description: 'Desktop workspace for lyrics, collections, and recordings.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
