import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { LyricFile, LyricFileId } from '../../types/lyricFile';
import type { LyricRepository } from './lyricRepo';

interface RefrainDB extends DBSchema {
  lyric_files: {
    key: LyricFileId;
    value: LyricFile;
  };
}

const withDefaultSectionTypes = (file: LyricFile): LyricFile => ({
  ...file,
  sectionTypes: file.sectionTypes ?? {},
});

const dbPromise = openDB<RefrainDB>('refrain', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('lyric_files')) {
      db.createObjectStore('lyric_files', { keyPath: 'id' });
    }
  },
});

const getDb = async (): Promise<IDBPDatabase<RefrainDB>> => dbPromise;

export const createWebLyricRepository = (): LyricRepository => ({
  async init() {
    await getDb();
  },

  async listFiles(): Promise<LyricFile[]> {
    const db = await getDb();
    const files = await db.getAll('lyric_files');
    return files.map(withDefaultSectionTypes).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getFile(id: LyricFileId): Promise<LyricFile | null> {
    const db = await getDb();
    const file = await db.get('lyric_files', id);
    return file ? withDefaultSectionTypes(file) : null;
  },

  async upsertFile(file: LyricFile): Promise<void> {
    const db = await getDb();
    await db.put('lyric_files', withDefaultSectionTypes(file));
  },

  async deleteFile(id: LyricFileId): Promise<void> {
    const db = await getDb();
    await db.delete('lyric_files', id);
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.clear('lyric_files');
  },
});

export const getLyricRepository = (): LyricRepository => createWebLyricRepository();
