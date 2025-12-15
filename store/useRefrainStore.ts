import { create } from 'zustand';

import { getLyricRepository } from '../lib/repo/lyricRepo';
import type { LyricFile, LyricFileId } from '../types/lyricFile';
import { cleanupSectionTypes } from '../analysis/sections';

type SelectionRange = { start: number; end: number };

interface RefrainState {
  files: LyricFile[];
  selectedId: LyricFileId | null;
  query: string;
  isLoading: boolean;
  error: string | null;
  editorSelection: SelectionRange | null;
  selectedWord: string | null;
  activeLineIndex: number;
  isInitialized: boolean;
  showSyllableCounts: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  saveError: string | null;
  filteredFiles(): LyricFile[];
  selectedFile(): LyricFile | null;
  init(): Promise<void>;
  refreshFiles(): Promise<void>;
  selectFile(id: LyricFileId | null): void;
  setQuery(q: string): void;
  createNewFile(): Promise<LyricFile>;
  updateSelectedFile(patch: { title?: string; body?: string; sectionTypes?: LyricFile['sectionTypes'] }): Promise<void>;
  saveSelectedFile(): Promise<void>;
  deleteFile(id: LyricFileId): Promise<void>;
  deleteSelectedFile(): Promise<void>;
  setEditorSelection(selection: SelectionRange | null): void;
  setSelectedWord(word: string | null): void;
  setActiveLineIndex(index: number): void;
  setShowSyllableCounts(show: boolean): void;
}

const repo = getLyricRepository();
const AUTOSAVE_MS = 500;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

const generateId = (): LyricFileId => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const sortFiles = (files: LyricFile[]): LyricFile[] => [...files].sort((a, b) => b.updatedAt - a.updatedAt);

const sectionTypesEqual = (
  a: Record<number, string> | undefined,
  b: Record<number, string> | undefined,
): boolean => {
  if (a === b) {
    return true;
  }
  const aKeys = Object.keys(a ?? {});
  const bKeys = Object.keys(b ?? {});
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => (a ?? {})[Number(key)] === (b ?? {})[Number(key)]);
};

export const useRefrainStore = create<RefrainState>((set, get) => ({
  files: [],
  selectedId: null,
  query: '',
  isLoading: false,
  error: null,
  editorSelection: null,
  selectedWord: null,
  activeLineIndex: -1,
  isInitialized: false,
  showSyllableCounts: false,
  isSaving: false,
  lastSavedAt: null,
  saveError: null,

  filteredFiles() {
    const { files, query } = get();
    const q = query.trim().toLowerCase();
    if (!q) {
      return sortFiles(files);
    }
    return sortFiles(
      files.filter(
        (file) =>
          file.title.toLowerCase().includes(q) ||
          file.body.toLowerCase().includes(q),
      ),
    );
  },

  selectedFile() {
    const { files, selectedId } = get();
    if (!selectedId) {
      return null;
    }
    return files.find((file) => file.id === selectedId) ?? null;
  },

  async init() {
    if (get().isInitialized) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      await repo.init();
      const files = await repo.listFiles();
      const sorted = sortFiles(files);
      set({
        files: sorted,
        isInitialized: true,
        selectedId: sorted[0]?.id ?? null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize library.' });
    } finally {
      set({ isLoading: false });
    }
  },

  async refreshFiles() {
    try {
      const files = await repo.listFiles();
      set({ files: sortFiles(files) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh files.' });
    }
  },

  selectFile(id: LyricFileId | null) {
    set({ selectedId: id });
  },

  setQuery(q: string) {
    set({ query: q });
  },

  async createNewFile(): Promise<LyricFile> {
    if (!get().isInitialized) {
      await repo.init();
    }
    const timestamp = Date.now();
    const newFile: LyricFile = {
      id: generateId(),
      title: 'Untitled',
      body: '',
      createdAt: timestamp,
      updatedAt: timestamp,
      sectionTypes: {},
    };
    set((state) => ({ files: sortFiles([newFile, ...state.files]), selectedId: newFile.id }));
    await repo.upsertFile(newFile);
    return newFile;
  },

  async updateSelectedFile(patch) {
    const { selectedId, files } = get();
    if (!selectedId) {
      return;
    }

    const index = files.findIndex((file) => file.id === selectedId);
    if (index === -1) {
      return;
    }

    const baseFile: LyricFile = {
      ...files[index],
      sectionTypes: files[index].sectionTypes ?? {},
    };

    const nextBody = patch.body ?? baseFile.body;
    const rawSectionTypes = patch.sectionTypes ?? baseFile.sectionTypes ?? {};
    const cleanedSectionTypes = cleanupSectionTypes(nextBody, rawSectionTypes);
    const nextSectionTypes =
      sectionTypesEqual(rawSectionTypes, cleanedSectionTypes) && patch.sectionTypes === undefined
        ? baseFile.sectionTypes ?? {}
        : cleanedSectionTypes;

    const updated: LyricFile = {
      ...baseFile,
      ...patch,
      body: nextBody,
      sectionTypes: nextSectionTypes,
      updatedAt: Date.now(),
    };

    const nextFiles = [...files];
    nextFiles[index] = updated;
    set({ files: sortFiles(nextFiles), isSaving: true });

    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(async () => {
      set({ isSaving: true });
      try {
        await repo.upsertFile(updated);
        set({ lastSavedAt: Date.now(), saveError: null });
      } catch (error) {
        set({
          saveError: error instanceof Error ? error.message : "Couldn't save your changes.",
        });
      } finally {
        set({ isSaving: false });
        saveTimer = null;
      }
    }, AUTOSAVE_MS);
  },

  async saveSelectedFile() {
    const selected = get().selectedFile();
    if (!selected) {
      return;
    }
    set({ isSaving: true });
    try {
      await repo.upsertFile(selected);
      set({ lastSavedAt: Date.now(), saveError: null });
    } catch (error) {
      set({
        saveError: error instanceof Error ? error.message : "Couldn't save your changes.",
      });
    } finally {
      set({ isSaving: false });
    }
  },

  async deleteFile(id: LyricFileId) {
    const { files, selectedId } = get();
    if (!id) {
      return;
    }
    if (saveTimer && selectedId === id) {
      clearTimeout(saveTimer);
      saveTimer = null;
      set({ isSaving: false });
    }
    await repo.deleteFile(id);
    const remaining = files.filter((file) => file.id !== id);
    set({
      files: sortFiles(remaining),
      selectedId: selectedId === id ? remaining[0]?.id ?? null : selectedId,
    });
  },

  async deleteSelectedFile() {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }
    await get().deleteFile(selectedId);
  },

  setEditorSelection(selection) {
    set({ editorSelection: selection });
  },

  setSelectedWord(word) {
    set({ selectedWord: word });
  },

  setActiveLineIndex(index) {
    set({ activeLineIndex: index });
  },

  setShowSyllableCounts(show) {
    set({ showSyllableCounts: show });
  },
}));
