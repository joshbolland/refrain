import {
  createBrowserStorageAdapter,
  createRefrainSupabaseClient,
  createSupabaseCollectionRepository,
  createSupabaseLyricRepository,
  createSupabaseRecordingRepository,
} from '@refrain/supabase-client';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const webSupabaseConfigError =
  'Web env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

export const isWebSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const assertWebSupabaseConfigured = () => {
  if (!isWebSupabaseConfigured) {
    throw new Error(webSupabaseConfigError);
  }
};

export const supabase = createRefrainSupabaseClient({
  url: supabaseUrl ?? 'https://placeholder.supabase.co',
  anonKey: supabaseAnonKey ?? 'placeholder-anon-key',
  storage: createBrowserStorageAdapter(),
  hasRuntimeStorage: typeof window !== 'undefined',
  detectSessionInUrl: false,
  clientInfo: 'refrain/web',
});

export const lyricRepo = createSupabaseLyricRepository(supabase);
export const collectionRepo = createSupabaseCollectionRepository(supabase);
export const recordingRepo = createSupabaseRecordingRepository(supabase);
