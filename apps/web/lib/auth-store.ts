'use client';

import { create } from 'zustand';
import type { AuthChangeEvent, Session, User, UserIdentity } from '@supabase/supabase-js';

import { formatAuthError } from '@refrain/supabase-client';

import { supabase } from './supabase';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  error: string | null;
  restoreSession(): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(credentials: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<void>;
  signInWithGoogle(): Promise<void>;
  handleOAuthCallback(url: string): Promise<void>;
  signOut(): Promise<void>;
  clearError(): void;
}

let hasRegisteredListener = false;

const hasIdentity = (identities: UserIdentity[] | null | undefined, provider: string) =>
  Boolean(identities?.some((identity) => identity.provider?.toLowerCase() === provider.toLowerCase()));

const getRedirectTo = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return new URL('/auth/callback', window.location.origin).toString();
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  status: 'idle',
  error: null,

  clearError() {
    set({ error: null });
  },

  async restoreSession() {
    if (get().status === 'loading') {
      return;
    }
    set({ status: 'loading', error: null });

    if (!hasRegisteredListener) {
      supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        const isAuthed = session !== null;
        set({
          session,
          user: session?.user ?? null,
          status: isAuthed ? 'authenticated' : 'unauthenticated',
        });
        if (event === 'SIGNED_OUT') {
          set({ error: null });
        }
      });
      hasRegisteredListener = true;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ status: 'unauthenticated', error: formatAuthError(error.message), session: null, user: null });
      return;
    }

    set({
      session: data.session ?? null,
      user: data.session?.user ?? null,
      status: data.session ? 'authenticated' : 'unauthenticated',
      error: null,
    });
  },

  async signInWithPassword(email, password) {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ status: 'unauthenticated', error: formatAuthError(error.message) });
      throw error;
    }
    set({
      session: data.session,
      user: data.session?.user ?? null,
      status: data.session ? 'authenticated' : 'unauthenticated',
      error: null,
    });
  },

  async signUp({ email, password, firstName, lastName }) {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          username: email,
        },
      },
    });
    if (error) {
      set({ status: 'unauthenticated', error: formatAuthError(error.message) });
      throw error;
    }
    if (!data.session) {
      await get().signInWithPassword(email, password);
      return;
    }
    set({
      session: data.session,
      user: data.session.user,
      status: 'authenticated',
      error: null,
    });
  },

  async signInWithGoogle() {
    set({ status: 'loading', error: null });
    const redirectTo = getRedirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      const message = error?.message ?? 'Could not start Google sign-in.';
      set({ status: 'unauthenticated', error: formatAuthError(message) });
      throw error ?? new Error(message);
    }
    window.location.assign(data.url);
  },

  async handleOAuthCallback(url) {
    const parsed = new URL(url);
    const errorParam = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
    const code = parsed.searchParams.get('code');

    if (errorParam) {
      const friendly = formatAuthError(errorParam);
      set({ status: 'unauthenticated', error: friendly });
      throw new Error(friendly);
    }

    if (!code) {
      throw new Error('Missing OAuth code.');
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const friendly = formatAuthError(error.message);
      set({ status: 'unauthenticated', error: friendly });
      throw error;
    }

    const session = data.session ?? null;
    const hasGoogle = hasIdentity(session?.user?.identities, 'google');
    if (!session || !session.user || !hasGoogle) {
      const friendly = 'Google sign-in did not complete successfully.';
      set({ status: 'unauthenticated', error: friendly, session: null, user: null });
      throw new Error(friendly);
    }

    set({
      session,
      user: session.user,
      status: 'authenticated',
      error: null,
    });
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, user: null, status: 'unauthenticated', error: null });
  },
}));
