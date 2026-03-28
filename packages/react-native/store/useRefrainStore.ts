import { create } from 'zustand';

import { cleanupSectionTypes, ensureDefaultSectionTypes } from '../analysis/sections';
import type {
  Collection,
  CollectionAssignment,
  CollectionId,
  CollectionItemType,
  CollectionWithCount,
} from '../types/collection';
import { getLyricRepository } from '../lib/repo/lyricRepo';
import { getRecordingRepository } from '../lib/repo/recordingRepo';
import { supabase } from '../lib/supabaseClient';
import type { LyricFile, LyricFileId } from '../types/lyricFile';
import { getCollectionRepository } from '../lib/repo/collectionRepo';
import type { RecordingItem, RecordingId } from '../types/recording';
import type { LibraryItem } from '../types/library';

type SelectionRange = { start: number; end: number };

interface RefrainState {
  files: LyricFile[];
  selectedId: LyricFileId | null;
  query: string;
  filterType: 'all' | 'lyrics' | 'recordings';
  filterCollectionIds: CollectionId[];
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
  collections: CollectionWithCount[];
  collectionAssignments: CollectionAssignment[];
  recordings: RecordingItem[];
  filteredFiles(): LibraryItem[];
  selectedFile(): LyricFile | null;
  collectionsWithCounts(): CollectionWithCount[];
  collectionIdsForItem(itemType: CollectionItemType, itemId: string): CollectionId[];
  init(): Promise<void>;
  refreshFiles(): Promise<void>;
  selectFile(id: LyricFileId | null): void;
  setQuery(q: string): void;
  setFilterType(type: 'all' | 'lyrics' | 'recordings'): void;
  setFilterCollections(ids: CollectionId[]): void;
  clearFilters(): void;
  createNewFile(): Promise<LyricFile>;
  updateSelectedFile(patch: { title?: string; body?: string; sectionTypes?: LyricFile['sectionTypes'] }): Promise<void>;
  saveSelectedFile(): Promise<void>;
  deleteFile(id: LyricFileId): Promise<void>;
  deleteSelectedFile(): Promise<void>;
  setEditorSelection(selection: SelectionRange | null): void;
  setSelectedWord(word: string | null): void;
  setActiveLineIndex(index: number): void;
  setShowSyllableCounts(show: boolean): void;
  createCollection(title: string, description?: string | null): Promise<Collection>;
  renameCollection(id: CollectionId, title: string, description?: string | null): Promise<void>;
  deleteCollection(id: CollectionId): Promise<void>;
  assignItemToCollection(itemId: string, itemType: CollectionItemType, collectionId: CollectionId): Promise<void>;
  removeItemFromCollection(itemId: string, itemType: CollectionItemType, collectionId: CollectionId): Promise<void>;
  assignLyricToCollection(lyricId: LyricFileId, collectionId: CollectionId): Promise<void>;
  removeLyricFromCollection(lyricId: LyricFileId, collectionId: CollectionId): Promise<void>;
  assignRecordingToCollection(recordingId: RecordingId, collectionId: CollectionId): Promise<void>;
  removeRecordingFromCollection(recordingId: RecordingId, collectionId: CollectionId): Promise<void>;
  addRecording(recording: RecordingItem): Promise<void>;
  updateRecording(id: RecordingId, patch: { title?: string }): Promise<void>;
  deleteRecording(id: RecordingId): Promise<void>;
  reset(): void;
}

const repo = getLyricRepository();
const collectionRepo = getCollectionRepository();
const recordingRepo = getRecordingRepository();
const AUTOSAVE_MS = 500;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

const generateId = (): LyricFileId => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122-ish UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const sortFiles = (files: LyricFile[]): LyricFile[] => [...files].sort((a, b) => b.updatedAt - a.updatedAt);
const sortCollections = (collections: CollectionWithCount[]): CollectionWithCount[] =>
  [...collections].sort((a, b) => b.updatedAt - a.updatedAt);

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

const toCollectionWithCount = (collection: Collection | CollectionWithCount): CollectionWithCount => ({
  ...collection,
  itemCount: (collection as CollectionWithCount).itemCount ?? 0,
  lyricCount: (collection as CollectionWithCount).lyricCount ?? 0,
  recordingCount: (collection as CollectionWithCount).recordingCount ?? 0,
});

const applyCountsToCollections = (
  collections: (Collection | CollectionWithCount)[],
  assignments: CollectionAssignment[],
): CollectionWithCount[] => {
  const totals: Record<CollectionId, number> = {};
  const lyricCounts: Record<CollectionId, number> = {};
  const recordingCounts: Record<CollectionId, number> = {};

  assignments.forEach((assignment) => {
    totals[assignment.collectionId] = (totals[assignment.collectionId] ?? 0) + 1;
    if (assignment.itemType === 'lyric') {
      lyricCounts[assignment.collectionId] = (lyricCounts[assignment.collectionId] ?? 0) + 1;
    }
    if (assignment.itemType === 'recording') {
      recordingCounts[assignment.collectionId] = (recordingCounts[assignment.collectionId] ?? 0) + 1;
    }
  });

  return sortCollections(
    collections.map((collection) => {
      const base = toCollectionWithCount(collection);
      return {
        ...base,
        itemCount: totals[collection.id] ?? base.itemCount ?? 0,
        lyricCount: lyricCounts[collection.id] ?? base.lyricCount ?? 0,
        recordingCount: recordingCounts[collection.id] ?? base.recordingCount ?? 0,
      };
    }),
  );
};

export const useRefrainStore = create<RefrainState>((set, get) => ({
  files: [],
  selectedId: null,
  query: '',
  filterType: 'all',
  filterCollectionIds: [],
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
  collections: [],
  collectionAssignments: [],
  recordings: [],

  filteredFiles() {
    const { files, query, filterType, filterCollectionIds, collectionAssignments, recordings } = get();

    const lyricIdsByCollection = collectionAssignments.reduce<Record<CollectionId, Set<LyricFileId>>>(
      (acc, assignment) => {
        if (assignment.itemType !== 'lyric') {
          return acc;
        }
        if (!acc[assignment.collectionId]) {
          acc[assignment.collectionId] = new Set();
        }
        acc[assignment.collectionId].add(assignment.itemId as LyricFileId);
        return acc;
      },
      {},
    );

    const recordingIdsByCollection = collectionAssignments.reduce<Record<CollectionId, Set<RecordingId>>>(
      (acc, assignment) => {
        if (assignment.itemType !== 'recording') {
          return acc;
        }
        if (!acc[assignment.collectionId]) {
          acc[assignment.collectionId] = new Set();
        }
        acc[assignment.collectionId].add(assignment.itemId as RecordingId);
        return acc;
      },
      {},
    );

    const matchesCollections = (file: LyricFile): boolean => {
      if (filterCollectionIds.length === 0) {
        return true;
      }
      return filterCollectionIds.some((collectionId) => lyricIdsByCollection[collectionId]?.has(file.id));
    };

    const matchesRecordingCollections = (recording: RecordingItem): boolean => {
      if (filterCollectionIds.length === 0) {
        return true;
      }
      return filterCollectionIds.some((collectionId) => recordingIdsByCollection[collectionId]?.has(recording.id));
    };

    const q = query.trim().toLowerCase();
    const lyricResults = files
      .filter((file) => {
        if (filterType === 'recordings') {
          return false;
        }
        const baseMatch =
          !q ||
          file.title.toLowerCase().includes(q) ||
          file.body.toLowerCase().includes(q);
        if (!baseMatch) {
          return false;
        }
        return matchesCollections(file);
      })
      .map((file) => ({ type: 'lyric' as const, data: file }));

    const recordingResults =
      filterType === 'lyrics'
        ? []
        : recordings
            .filter((rec) => {
              if (q && !rec.title.toLowerCase().includes(q)) {
                return false;
              }
              return matchesRecordingCollections(rec);
            })
            .map((rec) => ({ type: 'recording' as const, data: rec }));

    const combined: LibraryItem[] = [...lyricResults, ...recordingResults];
    return combined.sort((a, b) => {
      const aUpdated =
        a.type === 'lyric' ? a.data.updatedAt : a.data.updatedAt;
      const bUpdated =
        b.type === 'lyric' ? b.data.updatedAt : b.data.updatedAt;
      return bUpdated - aUpdated;
    });
  },

  selectedFile() {
    const { files, selectedId } = get();
    if (!selectedId) {
      return null;
    }
    return files.find((file) => file.id === selectedId) ?? null;
  },

  collectionsWithCounts() {
    const { collections, collectionAssignments } = get();
    return applyCountsToCollections(collections, collectionAssignments);
  },

  collectionIdsForItem(itemType: CollectionItemType, itemId: string) {
    const { collectionAssignments } = get();
    return collectionAssignments
      .filter((assignment) => assignment.itemType === itemType && assignment.itemId === itemId)
      .map((assignment) => assignment.collectionId);
  },

  async init() {
    if (get().isInitialized) {
      return;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      set({
        files: [],
        selectedId: null,
        isInitialized: false,
        error: sessionError.message,
      });
      return;
    }
    if (!sessionData.session) {
      set({ files: [], selectedId: null, isInitialized: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      await Promise.all([repo.init(), collectionRepo.init(), recordingRepo.init()]);
      const [files, collections, collectionAssignments, recordings] = await Promise.all([
        repo.listFiles(),
        collectionRepo.listCollections(),
        collectionRepo.listAssignments(),
        recordingRepo.listRecordings(),
      ]);
      const sorted = sortFiles(files);
      set({
        files: sorted,
        collections: applyCountsToCollections(collections, collectionAssignments),
        collectionAssignments,
        recordings,
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        set({ error: sessionError.message, files: [], selectedId: null, isInitialized: false });
        return;
      }
      if (!sessionData.session) {
        set({ files: [], selectedId: null, isInitialized: false });
        return;
      }
      const [files, collections, collectionAssignments, recordings] = await Promise.all([
        repo.listFiles(),
        collectionRepo.listCollections(),
        collectionRepo.listAssignments(),
        recordingRepo.listRecordings(),
      ]);
      set({
        files: sortFiles(files),
        collections: applyCountsToCollections(collections, collectionAssignments),
        collectionAssignments,
        recordings,
      });
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

  setFilterType(type) {
    set({ filterType: type });
  },

  setFilterCollections(ids) {
    set({ filterCollectionIds: ids });
  },

  clearFilters() {
    set({ filterType: 'all', filterCollectionIds: [] });
  },

  async createNewFile(): Promise<LyricFile> {
    if (!get().isInitialized) {
      await get().init();
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message);
    }
    if (!sessionData.session) {
      throw new Error('Sign in required to create a file.');
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
    const defaultedSectionTypes = ensureDefaultSectionTypes(nextBody, cleanedSectionTypes);
    const nextSectionTypes =
      sectionTypesEqual(rawSectionTypes, defaultedSectionTypes) && patch.sectionTypes === undefined
        ? baseFile.sectionTypes ?? {}
        : defaultedSectionTypes;

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
    const { files, selectedId, collectionAssignments, collections } = get();
    if (!id) {
      return;
    }
    if (saveTimer && selectedId === id) {
      clearTimeout(saveTimer);
      saveTimer = null;
      set({ isSaving: false });
    }
    const remainingAssignments = collectionAssignments.filter(
      (assignment) => !(assignment.itemType === 'lyric' && assignment.itemId === id),
    );
    const toRemove = collectionAssignments.filter(
      (assignment) => assignment.itemType === 'lyric' && assignment.itemId === id,
    );
    await repo.deleteFile(id);
    await Promise.all(
      toRemove.map((assignment) =>
        collectionRepo.removeItemFromCollection({
          itemId: assignment.itemId,
          itemType: assignment.itemType,
          collectionId: assignment.collectionId,
        }),
      ),
    );
    const remaining = files.filter((file) => file.id !== id);
    set({
      files: sortFiles(remaining),
      collectionAssignments: remainingAssignments,
      collections: applyCountsToCollections(collections, remainingAssignments),
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

  async createCollection(title: string, description?: string | null) {
    if (!get().isInitialized) {
      await get().init();
    }
    const safeTitle = title.trim() || 'Untitled';
    const collection = await collectionRepo.createCollection({
      title: safeTitle,
      description: description ?? null,
    });
    const withCounts = toCollectionWithCount(collection);
    set((state) => ({
      collections: applyCountsToCollections([withCounts, ...state.collections], state.collectionAssignments),
    }));
    return withCounts;
  },

  async renameCollection(id: CollectionId, title: string, description?: string | null) {
    const safeTitle = title.trim() || 'Untitled';
    const updated = await collectionRepo.renameCollection(id, safeTitle, description ?? null);
    set((state) => {
      const index = state.collections.findIndex((c) => c.id === id);
      if (index === -1) {
        return {};
      }
      const nextCollections = [...state.collections];
      nextCollections[index] = toCollectionWithCount(updated);
      return { collections: applyCountsToCollections(nextCollections, state.collectionAssignments) };
    });
  },

  async deleteCollection(id: CollectionId) {
    const { collections, collectionAssignments } = get();
    const filteredCollections = collections.filter((collection) => collection.id !== id);
    const filteredAssignments = collectionAssignments.filter(
      (assignment) => assignment.collectionId !== id,
    );
    set({
      collections: applyCountsToCollections(filteredCollections, filteredAssignments),
      collectionAssignments: filteredAssignments,
    });
    await collectionRepo.deleteCollection(id);
  },

  async assignItemToCollection(itemId, itemType, collectionId) {
    const { collectionAssignments, collections } = get();
    const exists = collectionAssignments.some(
      (assignment) =>
        assignment.itemId === itemId &&
        assignment.itemType === itemType &&
        assignment.collectionId === collectionId,
    );
    if (exists) {
      return;
    }
    const assignment = await collectionRepo.addItemToCollection({ itemId, itemType, collectionId });
    const nextAssignments = [assignment, ...collectionAssignments];
    set({
      collectionAssignments: nextAssignments,
      collections: applyCountsToCollections(collections, nextAssignments),
    });
  },

  async removeItemFromCollection(itemId, itemType, collectionId) {
    const { collectionAssignments, collections } = get();
    const filtered = collectionAssignments.filter(
      (assignment) =>
        !(
          assignment.itemId === itemId &&
          assignment.itemType === itemType &&
          assignment.collectionId === collectionId
        ),
    );
    set({
      collectionAssignments: filtered,
      collections: applyCountsToCollections(collections, filtered),
    });
    await collectionRepo.removeItemFromCollection({ itemId, itemType, collectionId });
  },

  async assignLyricToCollection(lyricId: LyricFileId, collectionId: CollectionId) {
    await get().assignItemToCollection(lyricId, 'lyric', collectionId);
  },

  async removeLyricFromCollection(lyricId: LyricFileId, collectionId: CollectionId) {
    await get().removeItemFromCollection(lyricId, 'lyric', collectionId);
  },

  async assignRecordingToCollection(recordingId: RecordingId, collectionId: CollectionId) {
    await get().assignItemToCollection(recordingId, 'recording', collectionId);
  },

  async removeRecordingFromCollection(recordingId: RecordingId, collectionId: CollectionId) {
    await get().removeItemFromCollection(recordingId, 'recording', collectionId);
  },

  async addRecording(recording) {
    set((state) => ({
      recordings: [...state.recordings, recording].sort((a, b) => b.updatedAt - a.updatedAt),
    }));
    await recordingRepo.upsertRecording(recording);
  },

  async updateRecording(id, patch) {
    const { recordings } = get();
    const index = recordings.findIndex((rec) => rec.id === id);
    if (index === -1) {
      return;
    }
    const base = recordings[index];
    const updated: RecordingItem = {
      ...base,
      ...patch,
      updatedAt: Date.now(),
    };
    const next = [...recordings];
    next[index] = updated;
    set({ recordings: next.sort((a, b) => b.updatedAt - a.updatedAt) });
    await recordingRepo.upsertRecording(updated);
  },

  async deleteRecording(id) {
    const { collectionAssignments, collections } = get();
    const remainingAssignments = collectionAssignments.filter(
      (assignment) => !(assignment.itemType === 'recording' && assignment.itemId === id),
    );
    const toRemove = collectionAssignments.filter(
      (assignment) => assignment.itemType === 'recording' && assignment.itemId === id,
    );
    set((state) => ({
      recordings: state.recordings.filter((rec) => rec.id !== id),
      collectionAssignments: remainingAssignments,
      collections: applyCountsToCollections(collections, remainingAssignments),
    }));
    await Promise.all(
      toRemove.map((assignment) =>
        collectionRepo.removeItemFromCollection({
          itemId: assignment.itemId,
          itemType: assignment.itemType,
          collectionId: assignment.collectionId,
        }),
      ),
    );
    await recordingRepo.deleteRecording(id);
  },

  reset() {
    set({
      files: [],
      selectedId: null,
      query: '',
      filterType: 'all',
      filterCollectionIds: [],
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
      collections: [],
      collectionAssignments: [],
      recordings: [],
    });
  },
}));
