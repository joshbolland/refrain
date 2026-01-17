import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { Database } from '../types/supabase';

// Guard WebBrowser auth-session completion so SSR / route extraction doesn't crash
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch (error) {
    // ignore
  }
}

const summarize = (value: string | undefined) =>
  value ? { length: value.length, last4: value.slice(-4) } : { length: 0, last4: null };

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const authBypass = process.env.EXPO_PUBLIC_AUTH_BYPASS === 'true';

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const hasWindow = typeof window !== 'undefined';

const memoryStorage = {
  getItem: (key: string) => Promise.resolve(null),
  setItem: (key: string, value: string) => Promise.resolve(),
  removeItem: (key: string) => Promise.resolve(),
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

if (authBypass) {
  throw new Error('EXPO_PUBLIC_AUTH_BYPASS is no longer supported. Supabase auth is required.');
}

export const supabase = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // Use AsyncStorage on native / browser; fall back to memory during SSR to avoid window reference errors.
    storage: isReactNative || hasWindow ? AsyncStorage : memoryStorage,
    autoRefreshToken: isReactNative || hasWindow,
    persistSession: isReactNative || hasWindow,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    headers: { 'X-Client-Info': 'refrain/supabase' },
  },
});
