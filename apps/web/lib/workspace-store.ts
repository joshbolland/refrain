'use client';

import { create } from 'zustand';

import type {
  Collection,
  CollectionAssignment,
  CollectionId,
  CollectionItemType,
  CollectionWithCount,
  LibraryItem,
  LyricFile,
  LyricFileId,
  RecordingId,
  RecordingItem,
} from '@refrain/domain';

import { collectionRepo, lyricRepo, recordingRepo, supabase } from './supabase';

const sortFiles = (files: LyricFile[]) => [...files].sort((a, b) => b.updatedAt - a.updatedAt);
const sortCollections = (collections: CollectionWithCount[]) => [...collections].sort((a, b) => b.updatedAt - a.updatedAt);
const sortRecordings = (recordings: RecordingItem[]) => [...recordings].sort((a, b) => b.updatedAt - a.updatedAt);

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `rf-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
    } else {
      recordingCounts[assignment.collectionId] = (recordingCounts[assignment.collectionId] ?? 0) + 1;
    }
  });

  return sortCollections(
    collections.map((collection) => ({
      ...collection,
      itemCount: totals[collection.id] ?? 0,
      lyricCount: lyricCounts[collection.id] ?? 0,
      recordingCount: recordingCounts[collection.id] ?? 0,
    })),
  );
};

const extensionForMime = (mimeType: string): string => {
  if (mimeType.includes('webm')) {
    return 'webm';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  if (mimeType.includes('mpeg')) {
    return 'mp3';
  }
  return 'm4a';
};

interface WorkspaceState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  files: LyricFile[];
  collections: CollectionWithCount[];
  assignments: CollectionAssignment[];
  recordings: RecordingItem[];
  init(): Promise<void>;
  refresh(): Promise<void>;
  createLyric(): Promise<LyricFile>;
  updateLyric(id: LyricFileId, patch: Partial<Pick<LyricFile, 'title' | 'body' | 'sectionTypes'>>): Promise<void>;
  deleteLyric(id: LyricFileId): Promise<void>;
  createCollection(title: string, description?: string | null): Promise<Collection>;
  renameCollection(id: CollectionId, title: string, description?: string | null): Promise<void>;
  deleteCollection(id: CollectionId): Promise<void>;
  toggleItemCollection(itemType: CollectionItemType, itemId: string, collectionId: CollectionId): Promise<void>;
  collectionIdsForItem(itemType: CollectionItemType, itemId: string): CollectionId[];
  collectionItems(collectionId: CollectionId): LibraryItem[];
  createRecordingFromBlob(blob: Blob, durationMs: number): Promise<RecordingItem>;
  updateRecordingTitle(id: RecordingId, title: string): Promise<void>;
  deleteRecording(id: RecordingId): Promise<void>;
  replaceRecording(recording: RecordingItem): void;
  resolveRecordingUrl(recording: RecordingItem): Promise<string | null>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  isInitialized: false,
  isLoading: false,
  error: null,
  files: [],
  collections: [],
  assignments: [],
  recordings: [],

  async init() {
    if (get().isInitialized) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      if (!data.session) {
        set({ files: [], collections: [], assignments: [], recordings: [], isInitialized: false });
        return;
      }
      const [files, collections, assignments, recordings] = await Promise.all([
        lyricRepo.listFiles(),
        collectionRepo.listCollections(),
        collectionRepo.listAssignments(),
        recordingRepo.listRecordings(),
      ]);
      set({
        files: sortFiles(files),
        collections: applyCountsToCollections(collections, assignments),
        assignments,
        recordings: sortRecordings(recordings),
        isInitialized: true,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize workspace.' });
    } finally {
      set({ isLoading: false });
    }
  },

  async refresh() {
    set({ isLoading: true, error: null });
    try {
      const [files, collections, assignments, recordings] = await Promise.all([
        lyricRepo.listFiles(),
        collectionRepo.listCollections(),
        collectionRepo.listAssignments(),
        recordingRepo.listRecordings(),
      ]);
      set({
        files: sortFiles(files),
        collections: applyCountsToCollections(collections, assignments),
        assignments,
        recordings: sortRecordings(recordings),
        isInitialized: true,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh workspace.' });
    } finally {
      set({ isLoading: false });
    }
  },

  async createLyric() {
    const now = Date.now();
    const lyric: LyricFile = {
      id: generateId(),
      title: 'Untitled',
      body: '',
      createdAt: now,
      updatedAt: now,
      sectionTypes: {},
    };
    set((state) => ({ files: sortFiles([lyric, ...state.files]) }));
    await lyricRepo.upsertFile(lyric);
    return lyric;
  },

  async updateLyric(id, patch) {
    const current = get().files.find((file) => file.id === id);
    if (!current) {
      return;
    }
    const next: LyricFile = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    set((state) => ({
      files: sortFiles(state.files.map((file) => (file.id === id ? next : file))),
    }));
    await lyricRepo.upsertFile(next);
  },

  async deleteLyric(id) {
    await lyricRepo.deleteFile(id);
    set((state) => {
      const assignments = state.assignments.filter(
        (assignment) => !(assignment.itemType === 'lyric' && assignment.itemId === id),
      );
      return {
        files: state.files.filter((file) => file.id !== id),
        assignments,
        collections: applyCountsToCollections(state.collections, assignments),
      };
    });
  },

  async createCollection(title, description) {
    const collection = await collectionRepo.createCollection({
      title: title.trim() || 'Untitled collection',
      description: description ?? null,
    });
    set((state) => ({
      collections: applyCountsToCollections([collection, ...state.collections], state.assignments),
    }));
    return collection;
  },

  async renameCollection(id, title, description) {
    const updated = await collectionRepo.renameCollection(id, title.trim() || 'Untitled collection', description ?? null);
    set((state) => ({
      collections: applyCountsToCollections(
        state.collections.map((collection) => (collection.id === id ? { ...collection, ...updated } : collection)),
        state.assignments,
      ),
    }));
  },

  async deleteCollection(id) {
    await collectionRepo.deleteCollection(id);
    set((state) => {
      const assignments = state.assignments.filter((assignment) => assignment.collectionId !== id);
      return {
        assignments,
        collections: applyCountsToCollections(
          state.collections.filter((collection) => collection.id !== id),
          assignments,
        ),
      };
    });
  },

  async toggleItemCollection(itemType, itemId, collectionId) {
    const exists = get().assignments.some(
      (assignment) =>
        assignment.collectionId === collectionId &&
        assignment.itemId === itemId &&
        assignment.itemType === itemType,
    );
    if (exists) {
      await collectionRepo.removeItemFromCollection({ collectionId, itemId, itemType });
      set((state) => {
        const assignments = state.assignments.filter(
          (assignment) =>
            !(
              assignment.collectionId === collectionId &&
              assignment.itemId === itemId &&
              assignment.itemType === itemType
            ),
        );
        return {
          assignments,
          collections: applyCountsToCollections(state.collections, assignments),
        };
      });
      return;
    }

    const assignment = await collectionRepo.addItemToCollection({ collectionId, itemId, itemType });
    set((state) => {
      const assignments = [assignment, ...state.assignments];
      return {
        assignments,
        collections: applyCountsToCollections(state.collections, assignments),
      };
    });
  },

  collectionIdsForItem(itemType, itemId) {
    return get()
      .assignments.filter((assignment) => assignment.itemType === itemType && assignment.itemId === itemId)
      .map((assignment) => assignment.collectionId);
  },

  collectionItems(collectionId) {
    const { assignments, files, recordings } = get();
    return assignments
      .filter((assignment) => assignment.collectionId === collectionId)
      .map<LibraryItem | null>((assignment) => {
        if (assignment.itemType === 'lyric') {
          const lyric = files.find((file) => file.id === assignment.itemId);
          return lyric ? { type: 'lyric', data: lyric } : null;
        }
        const recording = recordings.find((entry) => entry.id === assignment.itemId);
        return recording ? { type: 'recording', data: recording } : null;
      })
      .filter(Boolean) as LibraryItem[];
  },

  async createRecordingFromBlob(blob, durationMs) {
    const now = Date.now();
    const id = generateId();
    const media = await recordingRepo.uploadMedia({
      recordingId: id,
      data: blob,
      contentType: blob.type || 'audio/webm',
      extension: extensionForMime(blob.type || 'audio/webm'),
      createdAt: now,
      localUri: null,
    });
    const recording: RecordingItem = {
      id,
      title: `Idea ${new Date(now).toLocaleString()}`,
      createdAt: now,
      updatedAt: now,
      durationMs,
      ...media,
    };
    set((state) => ({ recordings: sortRecordings([recording, ...state.recordings]) }));
    await recordingRepo.upsertRecording(recording);
    return recording;
  },

  async updateRecordingTitle(id, title) {
    const current = get().recordings.find((recording) => recording.id === id);
    if (!current) {
      return;
    }
    const next: RecordingItem = {
      ...current,
      title: title.trim() || 'Untitled recording',
      updatedAt: Date.now(),
    };
    set((state) => ({
      recordings: sortRecordings(state.recordings.map((recording) => (recording.id === id ? next : recording))),
    }));
    await recordingRepo.upsertRecording(next);
  },

  async deleteRecording(id) {
    const current = get().recordings.find((recording) => recording.id === id);
    if (!current) {
      return;
    }
    await recordingRepo.deleteRecording(current);
    set((state) => {
      const assignments = state.assignments.filter(
        (assignment) => !(assignment.itemType === 'recording' && assignment.itemId === id),
      );
      return {
        recordings: state.recordings.filter((recording) => recording.id !== id),
        assignments,
        collections: applyCountsToCollections(state.collections, assignments),
      };
    });
  },

  replaceRecording(recording) {
    set((state) => ({
      recordings: sortRecordings([
        recording,
        ...state.recordings.filter((existing) => existing.id !== recording.id),
      ]),
    }));
  },

  async resolveRecordingUrl(recording) {
    return recordingRepo.resolvePlaybackUrl(recording);
  },
}));
