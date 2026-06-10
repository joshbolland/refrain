import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@refrain/domain';

export type RefrainSupabaseClient = SupabaseClient<Database>;

export type AuthStorageAdapter = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

interface CreateRefrainSupabaseClientOptions {
  url: string;
  anonKey: string;
  storage: AuthStorageAdapter;
  hasRuntimeStorage?: boolean;
  detectSessionInUrl?: boolean;
  clientInfo?: string;
}

export const createMemoryStorageAdapter = (): AuthStorageAdapter => ({
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
});

export const createBrowserStorageAdapter = (): AuthStorageAdapter => ({
  getItem: async (key) => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(key);
  },
});

export const createRefrainSupabaseClient = ({
  url,
  anonKey,
  storage,
  hasRuntimeStorage = true,
  detectSessionInUrl = false,
  clientInfo = 'refrain/supabase',
}: CreateRefrainSupabaseClientOptions): RefrainSupabaseClient =>
  createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: hasRuntimeStorage,
      persistSession: hasRuntimeStorage,
      detectSessionInUrl,
      flowType: 'pkce',
    },
    global: {
      headers: { 'X-Client-Info': clientInfo },
    },
  });
