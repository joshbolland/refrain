import { Platform } from 'react-native';

import type { LyricFile, LyricFileId } from '../../types/lyricFile';

export interface LyricRepository {
  init(): Promise<void>;
  listFiles(): Promise<LyricFile[]>;
  getFile(id: LyricFileId): Promise<LyricFile | null>;
  upsertFile(file: LyricFile): Promise<void>;
  deleteFile(id: LyricFileId): Promise<void>;
  clearAll(): Promise<void>;
}

type CreateRepo = () => LyricRepository;

const loadRepository = (): LyricRepository => {
  if (Platform.OS === 'web') {
    const { createWebLyricRepository } = require('./lyricRepo.web') as { createWebLyricRepository: CreateRepo };
    return createWebLyricRepository();
  }

  const { createNativeLyricRepository } = require('./lyricRepo.native') as { createNativeLyricRepository: CreateRepo };
  return createNativeLyricRepository();
};

const repository = loadRepository();

export const getLyricRepository = (): LyricRepository => repository;
