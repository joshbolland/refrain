import './globals.css';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Refrain Web',
  description: 'Desktop workspace for lyrics, projects, and recordings.',
};

const themeScript = `(() => { try { const value = localStorage.getItem('refrain-theme-v1') || 'system'; const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; } catch (_) {} })();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
