import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMemoryStorageAdapter, createRefrainSupabaseClient } from '@refrain/supabase-client';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Guard WebBrowser auth-session completion so SSR / route extraction doesn't crash
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch (error) {
    // ignore
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const authBypass = process.env.EXPO_PUBLIC_AUTH_BYPASS === 'true';

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const hasWindow = typeof window !== 'undefined';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

if (authBypass) {
  throw new Error('EXPO_PUBLIC_AUTH_BYPASS is no longer supported. Supabase auth is required.');
}

export const supabase = createRefrainSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storage: isReactNative || hasWindow ? AsyncStorage : createMemoryStorageAdapter(),
  hasRuntimeStorage: isReactNative || hasWindow,
  detectSessionInUrl: false,
});
