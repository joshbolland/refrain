import type { PostgrestError } from '@supabase/supabase-js';

import type { RecordingId, RecordingItem } from '../../types/recording';
import type { Database } from '../../types/supabase';
import { supabase } from '../supabaseClient';

export interface RecordingRepository {
  init(): Promise<void>;
  listRecordings(): Promise<RecordingItem[]>;
  upsertRecording(recording: RecordingItem): Promise<void>;
  deleteRecording(id: RecordingId): Promise<void>;
  clearAll(): Promise<void>;
}

type RecordingRow = Database['public']['Tables']['recordings']['Row'];

const mapRow = (row: RecordingRow): RecordingItem => ({
  id: row.id,
  title: row.title ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  durationMs: row.duration_ms ?? 0,
  uri: row.uri ?? '',
});

const handleError = (error: PostgrestError | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const getUserIdOrThrow = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }
  const userId = data.user?.id;
  if (!userId) {
    throw new Error('No authenticated user for recording operation.');
  }
  return userId;
};

export const createSupabaseRecordingRepository = (): RecordingRepository => ({
  async init() {
    // No-op; auth/session handled elsewhere.
  },

  async listRecordings(): Promise<RecordingItem[]> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('recordings')
      .select('id, title, duration_ms, uri, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    handleError(error);
    return (data ?? []).map(mapRow);
  },

  async upsertRecording(recording: RecordingItem): Promise<void> {
    const userId = await getUserIdOrThrow();
    const payload = {
      id: recording.id,
      user_id: userId,
      title: recording.title ?? '',
      duration_ms: recording.durationMs ?? 0,
      uri: recording.uri ?? '',
      created_at: new Date(recording.createdAt).toISOString(),
      updated_at: new Date(recording.updatedAt).toISOString(),
    };
    const { error } = await supabase.from('recordings').upsert(payload, { onConflict: 'id' });
    handleError(error);
  },

  async deleteRecording(id: RecordingId) {
    const userId = await getUserIdOrThrow();
    const { error } = await supabase.from('recordings').delete().eq('id', id).eq('user_id', userId);
    handleError(error);
  },

  async clearAll() {
    const userId = await getUserIdOrThrow();
    const { error } = await supabase.from('recordings').delete().eq('user_id', userId);
    handleError(error);
  },
});

const repository = createSupabaseRecordingRepository();

export const getRecordingRepository = (): RecordingRepository => repository;
