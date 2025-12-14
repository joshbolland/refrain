import * as SQLite from 'expo-sqlite';

import type { LyricFile, LyricFileId } from '../../types/lyricFile';
import type { LyricRepository } from './lyricRepo';

type Database = SQLite.SQLiteDatabase;

const dbPromise: Promise<Database> = SQLite.openDatabaseAsync('refrain.db');

const getDb = async (): Promise<Database> => dbPromise;

export const createNativeLyricRepository = (): LyricRepository => ({
  async init() {
    const db = await getDb();
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS lyric_files (id TEXT PRIMARY KEY NOT NULL, title TEXT, body TEXT, createdAt INTEGER, updatedAt INTEGER);',
    );
  },

  async listFiles(): Promise<LyricFile[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LyricFile>('SELECT * FROM lyric_files ORDER BY updatedAt DESC');
    return rows;
  },

  async getFile(id: LyricFileId): Promise<LyricFile | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<LyricFile>('SELECT * FROM lyric_files WHERE id = ? LIMIT 1', [id]);
    return row ?? null;
  },

  async upsertFile(file: LyricFile): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO lyric_files (id, title, body, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [file.id, file.title, file.body, file.createdAt, file.updatedAt],
    );
  },

  async deleteFile(id: LyricFileId): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM lyric_files WHERE id = ?', [id]);
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM lyric_files');
  },
});

export const getLyricRepository = (): LyricRepository => createNativeLyricRepository();
