import type { PostgrestError } from '@supabase/supabase-js';

import type { LyricFile, LyricFileId, SectionType } from '../../types/lyricFile';
import type { Database } from '../../types/supabase';
import { supabase } from '../supabaseClient';

export interface LyricRepository {
  init(): Promise<void>;
  listFiles(): Promise<LyricFile[]>;
  getFile(id: LyricFileId): Promise<LyricFile | null>;
  upsertFile(file: LyricFile): Promise<void>;
  deleteFile(id: LyricFileId): Promise<void>;
  clearAll(): Promise<void>;
}

type LyricRow = Database['public']['Tables']['lyric_files']['Row'];

const mapRowToLyricFile = (row: LyricRow): LyricFile => ({
  id: row.id,
  title: row.title ?? '',
  body: row.body ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  sectionTypes: (row.section_types ?? {}) as Record<number, SectionType>,
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
    throw new Error('No authenticated user for lyric operation.');
  }
  return userId;
};

export const createSupabaseLyricRepository = (): LyricRepository => ({
  async init() {
    // No-op for Supabase; session restoration happens in the auth store.
  },

  async listFiles(): Promise<LyricFile[]> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('lyric_files')
      .select('id, title, body, section_types, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    handleError(error);
    return (data ?? []).map(mapRowToLyricFile);
  },

  async getFile(id: LyricFileId): Promise<LyricFile | null> {
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from('lyric_files')
      .select('id, title, body, section_types, created_at, updated_at, deleted_at')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    handleError(error);
    return data ? mapRowToLyricFile(data) : null;
  },

  async upsertFile(file: LyricFile): Promise<void> {
    const userId = await getUserIdOrThrow();
    const payload = {
      id: file.id,
      user_id: userId,
      title: file.title ?? '',
      body: file.body ?? '',
      section_types: file.sectionTypes ?? {},
      created_at: new Date(file.createdAt).toISOString(),
      updated_at: new Date(file.updatedAt).toISOString(),
      deleted_at: null,
    };
    const { error } = await supabase.from('lyric_files').upsert(payload, { onConflict: 'id' });
    handleError(error);
  },

  async deleteFile(id: LyricFileId): Promise<void> {
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from('lyric_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    handleError(error);
  },

  async clearAll(): Promise<void> {
    const userId = await getUserIdOrThrow();
    const { error } = await supabase.from('lyric_files').delete().eq('user_id', userId);
    handleError(error);
  },
});

const repository = createSupabaseLyricRepository();

export const getLyricRepository = (): LyricRepository => repository;
