import * as SQLite from 'expo-sqlite';

import type { LyricFile, LyricFileId, SectionType } from '../../types/lyricFile';
import type { LyricRepository } from './lyricRepo';

type Database = SQLite.SQLiteDatabase;

const dbPromise: Promise<Database> = SQLite.openDatabaseAsync('refrain.db');

const getDb = async (): Promise<Database> => dbPromise;

type LyricFileRow = Omit<LyricFile, 'sectionTypes'> & { sections?: string | null };

const isSectionType = (value: unknown): value is SectionType =>
  value === 'verse' ||
  value === 'chorus' ||
  value === 'bridge' ||
  value === 'pre-chorus' ||
  value === 'intro' ||
  value === 'outro' ||
  value === 'other';

const parseSectionTypes = (raw: string | null | undefined): Record<number, SectionType> => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return Object.entries(parsed).reduce<Record<number, SectionType>>((acc, [key, value]) => {
      const index = Number(key);
      if (Number.isInteger(index) && isSectionType(value)) {
        acc[index] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const mapRowToLyricFile = (row: LyricFileRow): LyricFile => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  sectionTypes: parseSectionTypes(row.sections),
});

export const createNativeLyricRepository = (): LyricRepository => ({
  async init() {
    const db = await getDb();
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS lyric_files (id TEXT PRIMARY KEY NOT NULL, title TEXT, body TEXT, createdAt INTEGER, updatedAt INTEGER, sections TEXT);',
    );
    try {
      await db.execAsync('ALTER TABLE lyric_files ADD COLUMN sections TEXT');
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate column name')) {
        // Column already exists; safe to ignore for idempotent migration.
        return;
      }
      throw error;
    }
  },

  async listFiles(): Promise<LyricFile[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LyricFileRow>(
      'SELECT id, title, body, createdAt, updatedAt, sections FROM lyric_files ORDER BY updatedAt DESC',
    );
    return rows.map(mapRowToLyricFile);
  },

  async getFile(id: LyricFileId): Promise<LyricFile | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<LyricFileRow>(
      'SELECT id, title, body, createdAt, updatedAt, sections FROM lyric_files WHERE id = ? LIMIT 1',
      [id],
    );
    return row ? mapRowToLyricFile(row) : null;
  },

  async upsertFile(file: LyricFile): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO lyric_files (id, title, body, createdAt, updatedAt, sections) VALUES (?, ?, ?, ?, ?, ?)',
      [file.id, file.title, file.body, file.createdAt, file.updatedAt, JSON.stringify(file.sectionTypes ?? {})],
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
