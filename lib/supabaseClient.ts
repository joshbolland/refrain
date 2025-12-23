import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';

import type { Database } from '../types/supabase';

WebBrowser.maybeCompleteAuthSession();

const summarize = (value: string | undefined) =>
  value ? { length: value.length, last4: value.slice(-4) } : { length: 0, last4: null };

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const authBypass = process.env.EXPO_PUBLIC_AUTH_BYPASS === 'true';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

if (authBypass) {
  throw new Error('EXPO_PUBLIC_AUTH_BYPASS is no longer supported. Supabase auth is required.');
}

if (__DEV__) {
  console.info('[supabase] env loaded', {
    url: summarize(supabaseUrl),
    anonKey: summarize(supabaseAnonKey),
  });
}

export const supabase = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'refrain/supabase' },
  },
});
