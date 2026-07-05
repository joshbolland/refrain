import {
  createBrowserStorageAdapter,
  createRefrainSupabaseClient,
  createSupabaseLyricRepository,
  createSupabaseProjectRepository,
  createSupabaseRecordingRepository,
} from '@refrain/supabase-client';

const defaultSupabaseUrl = 'https://zagkrkugmwuqnheyvybm.supabase.co';
const defaultSupabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZ2tya3VnbXd1cW5oZXl2eWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDgwMTcsImV4cCI6MjA4MTg4NDAxN30.WlDR_QOR79yAjr_eSRifaXn7La0ANHGy64Bin5kJzUg';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? defaultSupabaseUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? defaultSupabaseAnonKey;
const configuredWebAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

export const webSupabaseConfigError =
  'Web auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

export const isWebSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const getConfiguredWebAppUrl = () => configuredWebAppUrl;

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
export const projectRepo = createSupabaseProjectRepository(supabase);
export const recordingRepo = createSupabaseRecordingRepository(supabase);
