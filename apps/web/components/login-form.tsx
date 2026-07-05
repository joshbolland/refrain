'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { isWebSupabaseConfigured, webSupabaseConfigError } from '@/lib/supabase';

type AuthMode = 'sign-in' | 'sign-up';

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
    signInWithApple,
    signUp,
  } = useAuthStore((state) => ({
    session: state.session,
    status: state.status,
    error: state.error,
    clearError: state.clearError,
    restoreSession: state.restoreSession,
    signInWithPassword: state.signInWithPassword,
    signInWithGoogle: state.signInWithGoogle,
    signInWithApple: state.signInWithApple,
    signUp: state.signUp,
  }));
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
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
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSignIn = email.trim().length > 0 && password.length > 0;
  const canSignUp = canSignIn && passwordsMatch && password.length >= 8;
  const canSubmit = isSignUp ? canSignUp : canSignIn;

  const helperMessage = useMemo(() => {
    if (!isWebSupabaseConfigured) {
      return webSupabaseConfigError;
    }
    if (message) {
      return message;
    }
    return error;
  }, [error, message]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    clearError();
    setMessage(null);

    if (!isWebSupabaseConfigured) {
      setMessage(webSupabaseConfigError);
      return;
    }

    if (isSignUp && password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (isSignUp && !passwordsMatch) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      if (isSignUp) {
        await signUp({
          email: email.trim(),
          password,
          firstName: '',
          lastName: '',
        });
        setMessage('Account created. Check your email to verify your account.');
      } else {
        await signInWithPassword(email.trim(), password);
      }
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : 'Could not authenticate.');
    }
  };

  const toggleMode = () => {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setMessage(null);
    setConfirmPassword('');
    clearError();
  };

  return (
    <main className="auth-screen">
      <Image
        src="/assets/refrain-auth-background.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="auth-background-image"
      />
      <div className="auth-background-wash" />

      <div className="auth-content">
        <header className="auth-header">
          <Image
            src="/assets/refrain-bird.png"
            alt="Refrain"
            width={320}
            height={276}
            priority
            className={isSignUp ? 'auth-bird auth-bird-compact' : 'auth-bird'}
          />
          <p className="auth-kicker">{isSignUp ? 'Create account' : 'Welcome back'}</p>
          <h1 className="auth-title">{isSignUp ? 'Join Refrain' : 'Sign in to Refrain'}</h1>
          <p className="auth-subtitle">
            {isSignUp ? 'Create an account to save your lyrics.' : 'Sign in to keep your lyrics in sync.'}
          </p>
        </header>

        <form className="auth-card" onSubmit={(event) => void handleSubmit(event)}>
          <div className="auth-fields">
            <label className="auth-field">
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="........"
                type="password"
                value={password}
              />
            </label>

            {isSignUp ? (
              <>
                <label className="auth-field">
                  <span>Confirm password</span>
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="........"
                    type="password"
                    value={confirmPassword}
                  />
                </label>

                {password.length > 0 && password.length < 8 ? (
                  <p className="auth-inline-warning">Password must be at least 8 characters</p>
                ) : null}

                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <p className="auth-inline-error">Passwords do not match</p>
                ) : null}
              </>
            ) : null}
          </div>

          {helperMessage ? <p className="auth-message">{helperMessage}</p> : null}

          <button className="auth-primary-button" disabled={isLoading || !canSubmit} type="submit">
            {isLoading ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <button className="auth-mode-button" onClick={toggleMode} type="button">
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>

          <div className="auth-divider" aria-hidden="true">
            <span />
            <p>or</p>
            <span />
          </div>

          <div className="auth-social-row">
            <button
              className="auth-secondary-button"
              disabled={isLoading}
              onClick={() => void signInWithGoogle().catch((oauthError) => {
                setMessage(oauthError instanceof Error ? oauthError.message : 'Could not start Google sign-in.');
              })}
              type="button"
            >
              <Image src="/assets/google-g.svg" alt="" width={18} height={18} style={{ height: 18, width: 18 }} />
              <span>Google</span>
            </button>

            <button
              className="auth-secondary-button"
              disabled={isLoading}
              onClick={() => void signInWithApple().catch((oauthError) => {
                setMessage(oauthError instanceof Error ? oauthError.message : 'Could not start Apple sign-in.');
              })}
              type="button"
            >
              <Image src="/assets/apple-logo.svg" alt="" width={18} height={18} style={{ height: 18, width: 18 }} />
              <span>Apple</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
