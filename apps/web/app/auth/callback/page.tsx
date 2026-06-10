'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const handleOAuthCallback = useAuthStore((state) => state.handleOAuthCallback);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await handleOAuthCallback(window.location.href);
        if (active) {
          router.replace('/library');
        }
      } catch (callbackError) {
        if (active) {
          setError(callbackError instanceof Error ? callbackError.message : 'Could not finish sign-in.');
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [handleOAuthCallback, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-divider/70 bg-white/90 p-8 shadow-soft backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/70">Authenticating</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Finishing sign-in</h1>
        <p className="mt-2 text-sm text-muted/80">
          {error ?? 'Completing your secure session and restoring your workspace.'}
        </p>
      </div>
    </main>
  );
}
