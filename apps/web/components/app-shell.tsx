'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/lib/auth-store';

const navItems = [
  { href: '/library', label: 'Library', kicker: 'Write' },
  { href: '/collections', label: 'Collections', kicker: 'Organize' },
  { href: '/recordings', label: 'Recordings', kicker: 'Capture' },
  { href: '/settings', label: 'Settings', kicker: 'Account' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuthStore((state) => ({
    user: state.user,
    signOut: state.signOut,
  }));

  return (
    <div className="min-h-screen px-4 py-4 md:px-6">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-soft backdrop-blur">
          <div className="rounded-[28px] bg-gradient-to-br from-accentSoft to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/70">Refrain</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">Desktop studio</h1>
            <p className="mt-2 text-sm text-muted/80">
              Keep lyrics, collections, and recordings in one desktop workspace.
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    active
                      ? 'border-accent/50 bg-accentSoft text-ink shadow-soft'
                      : 'border-transparent bg-white/60 text-muted hover:border-divider'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">{item.kicker}</p>
                  <p className="mt-1 text-lg font-semibold">{item.label}</p>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-divider/70 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">Signed in</p>
            <p className="mt-2 text-sm font-semibold text-ink">{user?.email ?? 'Unknown user'}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-4 rounded-full border border-divider bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-accent hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="rounded-[32px] border border-white/60 bg-white/70 p-4 shadow-soft backdrop-blur md:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
