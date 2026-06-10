'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { useAuthStore } from '@/lib/auth-store';
import { useWorkspaceStore } from '@/lib/workspace-store';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, restoreSession } = useAuthStore((state) => ({
    status: state.status,
    restoreSession: state.restoreSession,
  }));
  const init = useWorkspaceStore((state) => state.init);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (status === 'authenticated') {
      void init();
      return;
    }
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [init, router, status]);

  if (status === 'idle' || status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[28px] border border-divider/70 bg-white/90 p-8 shadow-soft backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/70">Refrain</p>
          <h1 className="mt-3 text-2xl font-semibold text-ink">Loading workspace</h1>
          <p className="mt-2 text-sm text-muted/80">Restoring your session, library, and recordings.</p>
        </div>
      </main>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
