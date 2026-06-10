'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export function LoginForm() {
  const router = useRouter();
  const {
    session,
    status,
    error,
    clearError,
    restoreSession,
    signInWithPassword,
    signInWithGoogle,
    signUp,
  } = useAuthStore((state) => ({
    session: state.session,
    status: state.status,
    error: state.error,
    clearError: state.clearError,
    restoreSession: state.restoreSession,
    signInWithPassword: state.signInWithPassword,
    signInWithGoogle: state.signInWithGoogle,
    signUp: state.signUp,
  }));
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (session) {
      router.replace('/library');
    }
  }, [router, session]);

  const isLoading = status === 'loading';
  const isSignUp = mode === 'sign-up';

  const handleSubmit = async () => {
    clearError();
    setMessage(null);
    if (isSignUp && password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    try {
      if (isSignUp) {
        await signUp({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      } else {
        await signInWithPassword(email.trim(), password);
      }
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : 'Could not authenticate.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-white/60 bg-gradient-to-br from-white/90 via-accentSoft/40 to-white/90 p-8 shadow-float backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted/70">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight text-ink">
            {isSignUp ? 'Bring your writing desk onto the web.' : 'Pick up your ideas wherever you are.'}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted/85">
            Refrain Web gives you a purpose-built desktop workspace for drafting lyrics, organizing collections,
            and syncing recordings across devices.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['Desktop editor', 'Persistent panes for writing, browsing, and rhyme search.'],
              ['Shared collections', 'Organize lyrics and recordings without leaving the writing flow.'],
              ['Synced media', 'New recordings upload to storage so playback works across platforms.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-soft">
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted/80">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/60 bg-white/88 p-8 shadow-soft backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/70">
            {isSignUp ? 'Sign up' : 'Sign in'}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">
            {isSignUp ? 'Create your Refrain account' : 'Enter your workspace'}
          </h2>
          <div className="mt-6 space-y-4">
            {isSignUp ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-ink">First name</span>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                    placeholder="Syd"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-ink">Last name</span>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                    placeholder="Barrett"
                  />
                </label>
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                placeholder="you@example.com"
                type="email"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                placeholder="••••••••"
                type="password"
              />
            </label>

            {isSignUp ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-ink">Confirm password</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="••••••••"
                  type="password"
                />
              </label>
            ) : null}
          </div>

          {(message || error) ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {message ?? error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading}
            className="mt-6 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accentPressed disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={isLoading}
            className="mt-3 w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(isSignUp ? 'sign-in' : 'sign-up');
              setMessage(null);
              clearError();
            }}
            className="mt-5 text-sm font-semibold text-muted transition hover:text-ink"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </section>
      </div>
    </main>
  );
}
