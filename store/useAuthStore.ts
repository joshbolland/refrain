import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';
import type { AuthChangeEvent, OAuthResponse, Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import { useRefrainStore } from './useRefrainStore';

const redirectTo = Linking.createURL('/auth/callback', { scheme: 'refrain' });

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
  signInWithOAuth(provider: 'google' | 'apple'): Promise<void>;
  signOut(): Promise<void>;
}

let hasRegisteredListener = false;
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  const safeLocal = local ? `${local.slice(0, 2)}***` : 'unknown';
  return domain ? `${safeLocal}@${domain}` : safeLocal;
};
const logAuth = (event: string, payload?: Record<string, unknown>) => {
  console.info(`[auth] ${event}`, payload ?? {});
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  status: 'idle',
  error: null,

  async restoreSession() {
    if (get().status === 'loading') {
      return;
    }
    logAuth('restoreSession:start');
    set({ status: 'loading', error: null });

    if (!hasRegisteredListener) {
      supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        const isAuthed = session !== null;
        logAuth('authStateChange', {
          event,
          hasSession: Boolean(session),
          userId: session?.user?.id,
        });
        set({
          session,
          user: session?.user ?? null,
          status: isAuthed ? 'authenticated' : 'unauthenticated',
        });
      });
      hasRegisteredListener = true;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logAuth('restoreSession:error', { message: error.message, status: error.status });
      set({ status: 'unauthenticated', error: error.message, session: null, user: null });
      return;
    }

    const session = data.session ?? null;
    logAuth('restoreSession:complete', { hasSession: Boolean(session), userId: session?.user?.id });
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    });
  },

  async signInWithPassword(email: string, password: string) {
    logAuth('signInWithPassword:start', { email: maskEmail(email) });
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      logAuth('signInWithPassword:error', { message: error.message, status: error.status });
      set({ status: 'unauthenticated', error: error.message });
      throw error;
    }
    if (!data.session || !data.session.user) {
      set({ status: 'unauthenticated', error: 'Sign-in did not return a session.' });
      throw new Error('Sign-in did not return a session.');
    }
    set({
      session: data.session,
      user: data.session.user,
      status: 'authenticated',
      error: null,
    });
    logAuth('signInWithPassword:success', {
      userId: data.session.user.id,
      hasSession: Boolean(data.session),
    });
  },

  async signUp({ email, password, firstName, lastName }) {
    logAuth('signUp:start', { email: maskEmail(email) });
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
      logAuth('signUp:error', { message: error.message, status: error.status });
      set({ status: 'unauthenticated', error: error.message });
      throw error;
    }

    let session = data.session ?? null;
    if (!session) {
      logAuth('signUp:noSession', { note: 'signUp returned no session; attempting password sign-in' });
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        logAuth('signUp:loginAfterSignupFailed', {
          message: loginError.message,
          status: loginError.status,
        });
        set({ status: 'unauthenticated', error: loginError.message });
        throw loginError;
      }
      session = loginData.session ?? null;
    }
    if (!session || !session.user) {
      logAuth('signUp:missingSession', { hasSession: Boolean(session) });
      set({ status: 'unauthenticated', error: 'Signup did not return a session.' });
      throw new Error('Signup did not return a session.');
    }

    set({
      session,
      user: session.user,
      status: 'authenticated',
      error: null,
    });
    logAuth('signUp:success', { userId: session.user.id, hasSession: true });
  },

  async signInWithOAuth(provider) {
    logAuth('signInWithOAuth:start', { provider });
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
    if (error) {
      logAuth('signInWithOAuth:error', { message: error.message, status: error.status });
      set({ status: 'unauthenticated', error: error.message });
      throw error;
    }

    const url = (data as OAuthResponse | null)?.url;
    if (url) {
      await WebBrowser.openBrowserAsync(url);
    }
    set({ status: 'loading' });
  },

  async signOut() {
    logAuth('signOut:start');
    set({ status: 'loading', error: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      logAuth('signOut:error', { message: error.message, status: error.status });
      set({ status: 'authenticated', error: error.message });
      throw error;
    }
    useRefrainStore.getState().reset();
    logAuth('signOut:success');
    set({ session: null, user: null, status: 'unauthenticated' });
  },
}));
