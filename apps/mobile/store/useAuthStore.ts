import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { formatAuthError } from '@refrain/supabase-client';
import { create } from 'zustand';
import { Platform } from 'react-native';
import type { AuthChangeEvent, OAuthResponse, Session, User, UserIdentity } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import { useRefrainStore } from './useRefrainStore';

// Use the environment-aware Expo link helper so it resolves to:
// - exp://... in Expo Go/dev client
// - custom scheme (app.json "scheme") in standalone/dev build
const getRedirectTo = () => Linking.createURL('/auth/callback');

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
type OAuthIntent = 'sign-in' | 'link';

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  error: string | null;
  linkingProvider: null | 'google';
  restoreSession(): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(credentials: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<void>;
  signInWithOAuth(provider: 'google' | 'apple'): Promise<void>;
  linkWithOAuth(provider: 'google'): Promise<void>;
  handleOAuthCallback(url: string | null, intent?: OAuthIntent): Promise<void>;
  clearError(): void;
  signOut(): Promise<void>;
}

let hasRegisteredListener = false;
let lastHandledOAuthUrl: string | null = null;

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  const safeLocal = local ? `${local.slice(0, 2)}***` : 'unknown';
  return domain ? `${safeLocal}@${domain}` : safeLocal;
};

const logAuth = (..._args: unknown[]) => { };

const hasIdentity = (identities: UserIdentity[] | null | undefined, provider: string) =>
  Boolean(identities?.some((identity) => identity.provider?.toLowerCase() === provider.toLowerCase()));

const resetOAuthDedup = () => {
  lastHandledOAuthUrl = null;
};

const dedupeOAuthUrl = (url: string) => {
  if (url === lastHandledOAuthUrl) {
    return false;
  }
  lastHandledOAuthUrl = url;
  return true;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  status: 'idle',
  error: null,
  linkingProvider: null,

  clearError() {
    set({ error: null });
  },

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
      set({ status: 'unauthenticated', error: formatAuthError(error.message), session: null, user: null });
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
      set({ status: 'unauthenticated', error: formatAuthError(error.message) });
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
      set({ status: 'unauthenticated', error: formatAuthError(error.message) });
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
        set({ status: 'unauthenticated', error: formatAuthError(loginError.message) });
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
    const redirectTo = getRedirectTo();
    logAuth('signInWithOAuth:start', { provider, redirectTo });
    resetOAuthDedup();
    set({ status: 'loading', error: null });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      const message = error?.message ?? 'Could not start sign-in.';
      logAuth('signInWithOAuth:error', { message, status: error?.status });
      set({ status: 'unauthenticated', error: formatAuthError(message) });
      throw error ?? new Error(message);
    }

    if (Platform.OS === 'web') {
      logAuth('signInWithOAuth:webRedirect', { urlLength: data.url.length });
      if (typeof window !== 'undefined') {
        window.location.assign(data.url);
      } else {
        void Linking.openURL(data.url);
      }
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      logAuth('signInWithOAuth:cancel', { resultType: result.type });
      set({
        status: 'unauthenticated',
        error: result.type === 'cancel' || result.type === 'dismiss' ? null : 'Could not finish sign-in.',
      });
      return;
    }

    await get().handleOAuthCallback(result.url, 'sign-in');
    if (get().error) {
      throw new Error(get().error ?? 'Unable to sign in.');
    }
  },

  async linkWithOAuth(provider) {
    const currentUser = get().user;
    if (!currentUser) {
      set({ error: 'You need to be signed in to link another provider.' });
      throw new Error('Cannot link provider without an active session.');
    }

    if (hasIdentity(currentUser.identities ?? null, provider)) {
      logAuth('linkWithOAuth:alreadyLinked', { provider });
      set({ error: null, linkingProvider: null });
      return;
    }

    const redirectTo = getRedirectTo();
    logAuth('linkWithOAuth:start', { provider, redirectTo });
    resetOAuthDedup();
    set({ linkingProvider: provider, error: null });

    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      const message = error?.message ?? 'Could not start linking.';
      logAuth('linkWithOAuth:error', { message, status: error?.status });
      set({ linkingProvider: null, error: formatAuthError(message) });
      throw error ?? new Error(message);
    }

    if (Platform.OS === 'web') {
      logAuth('linkWithOAuth:webRedirect', { urlLength: data.url.length });
      if (typeof window !== 'undefined') {
        window.location.assign(data.url);
      } else {
        void Linking.openURL(data.url);
      }
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      logAuth('linkWithOAuth:cancel', { resultType: result.type });
      set({
        linkingProvider: null,
        error: result.type === 'cancel' || result.type === 'dismiss' ? null : 'Could not finish linking.',
      });
      return;
    }

    await get().handleOAuthCallback(result.url, 'link');
    if (get().error) {
      throw new Error(get().error ?? 'Unable to link this provider.');
    }
  },

  async handleOAuthCallback(url, intent) {
    if (!url || !dedupeOAuthUrl(url)) {
      return;
    }

    const parsed = Linking.parse(url);
    const params = parsed.queryParams ?? {};
    const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
    const fragmentParams =
      fragment.includes('=') ? Object.fromEntries(new URLSearchParams(fragment)) : {};
    const mergedParams = { ...params, ...fragmentParams };

    const errorParam =
      (typeof mergedParams.error_description === 'string' && mergedParams.error_description) ||
      (typeof mergedParams.error === 'string' && mergedParams.error) ||
      null;
    const code = typeof mergedParams.code === 'string' ? mergedParams.code : null;
    const resolvedIntent: OAuthIntent = intent ?? (get().session ? 'link' : 'sign-in');

    if (errorParam) {
      const friendly = formatAuthError(errorParam);
      logAuth('handleOAuthCallback:errorParam', { intent: resolvedIntent, message: friendly });
      set({
        status: resolvedIntent === 'link' && Boolean(get().session) ? 'authenticated' : 'unauthenticated',
        error: friendly,
        linkingProvider: null,
      });
      return;
    }

    if (!code) {
      logAuth('handleOAuthCallback:missingParams', { intent: resolvedIntent });
      return;
    }

    logAuth('handleOAuthCallback:exchange', { intent: resolvedIntent });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const friendly = formatAuthError(error.message);
      logAuth('handleOAuthCallback:exchangeError', { intent: resolvedIntent, message: friendly });
      set({
        status: resolvedIntent === 'link' && Boolean(get().session) ? 'authenticated' : 'unauthenticated',
        error: friendly,
        linkingProvider: null,
      });
      return;
    }

    const session = data.session ?? null;
    const userFromSession = data.user ?? session?.user ?? null;
    const { data: refreshedUser, error: userError } = await supabase.auth.getUser();
    const updatedUser = refreshedUser?.user ?? userFromSession;

    if (userError) {
      logAuth('handleOAuthCallback:userRefreshError', { message: userError.message });
    }

    const nextStatus: AuthStatus =
      session || (resolvedIntent === 'link' && Boolean(get().session)) ? 'authenticated' : 'unauthenticated';

    set({
      session: session ?? get().session,
      user: updatedUser ?? get().user,
      status: nextStatus,
      error: null,
      linkingProvider: null,
    });
  },

  async signOut() {
    logAuth('signOut:start');
    set({ status: 'loading', error: null, linkingProvider: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      logAuth('signOut:error', { message: error.message, status: error.status });
      set({ status: 'authenticated', error: error.message });
      throw error;
    }
    useRefrainStore.getState().reset();
    logAuth('signOut:success');
    set({ session: null, user: null, status: 'unauthenticated', linkingProvider: null });
  },
}));
