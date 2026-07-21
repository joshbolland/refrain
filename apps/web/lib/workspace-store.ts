'use client';

import { create } from 'zustand';

import type {
  LibraryItem,
  LyricFile,
  LyricFileId,
  Project,
  ProjectAssignment,
  ProjectId,
  ProjectItemType,
  ProjectWithCount,
  RecordingId,
  RecordingItem,
  RecordingLyricLink,
} from '@refrain/domain';

import { lyricRepo, projectRepo, recordingLyricLinkRepo, recordingRepo, supabase } from './supabase';

const sortFiles = (files: LyricFile[]) => [...files].sort((a, b) => b.updatedAt - a.updatedAt);
const sortProjects = (projects: ProjectWithCount[]) => [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
const sortRecordings = (recordings: RecordingItem[]) => [...recordings].sort((a, b) => b.updatedAt - a.updatedAt);

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `rf-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const applyCountsToProjects = (
  projects: (Project | ProjectWithCount)[],
  assignments: ProjectAssignment[],
): ProjectWithCount[] => {
  const totals: Record<ProjectId, number> = {};
  const lyricCounts: Record<ProjectId, number> = {};
  const recordingCounts: Record<ProjectId, number> = {};

  assignments.forEach((assignment) => {
    totals[assignment.projectId] = (totals[assignment.projectId] ?? 0) + 1;
    if (assignment.itemType === 'lyric') {
      lyricCounts[assignment.projectId] = (lyricCounts[assignment.projectId] ?? 0) + 1;
    } else {
      recordingCounts[assignment.projectId] = (recordingCounts[assignment.projectId] ?? 0) + 1;
    }
  });

  return sortProjects(
    projects.map((project) => ({
      ...project,
      itemCount: totals[project.id] ?? 0,
      lyricCount: lyricCounts[project.id] ?? 0,
      recordingCount: recordingCounts[project.id] ?? 0,
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
  activeUserId: string | null;
  error: string | null;
  files: LyricFile[];
  projects: ProjectWithCount[];
  assignments: ProjectAssignment[];
  recordings: RecordingItem[];
  recordingLyricLinks: RecordingLyricLink[];
  init(): Promise<void>;
  refresh(): Promise<void>;
  createLyric(): Promise<LyricFile>;
  updateLyric(id: LyricFileId, patch: Partial<Pick<LyricFile, 'title' | 'body' | 'sectionTypes'>>): Promise<void>;
  deleteLyric(id: LyricFileId): Promise<void>;
  createProject(title: string, description?: string | null): Promise<Project>;
  renameProject(id: ProjectId, title: string, description?: string | null): Promise<void>;
  deleteProject(id: ProjectId): Promise<void>;
  toggleItemProject(itemType: ProjectItemType, itemId: string, projectId: ProjectId): Promise<void>;
  projectIdsForItem(itemType: ProjectItemType, itemId: string): ProjectId[];
  projectItems(projectId: ProjectId): LibraryItem[];
  createRecordingFromBlob(blob: Blob, durationMs: number): Promise<RecordingItem>;
  updateRecordingTitle(id: RecordingId, title: string): Promise<void>;
  deleteRecording(id: RecordingId): Promise<void>;
  replaceRecording(recording: RecordingItem): void;
  resolveRecordingUrl(recording: RecordingItem): Promise<string | null>;
  linkRecordingToLyric(recordingId: RecordingId, lyricFileId: LyricFileId): Promise<void>;
  unlinkRecordingFromLyric(recordingId: RecordingId, lyricFileId: LyricFileId): Promise<void>;
  recordingsForLyric(lyricFileId: LyricFileId): RecordingItem[];
  lyricsForRecording(recordingId: RecordingId): LyricFile[];
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  isInitialized: false,
  isLoading: false,
  activeUserId: null,
  error: null,
  files: [],
  projects: [],
  assignments: [],
  recordings: [],
  recordingLyricLinks: [],

  async init() {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      if (!data.session) {
        set({
          files: [],
          projects: [],
          assignments: [],
          recordings: [],
          recordingLyricLinks: [],
          activeUserId: null,
          isInitialized: false,
        });
        return;
      }
      const userId = data.session.user.id;
      if (get().isInitialized && get().activeUserId === userId) {
        return;
      }
      const results = await Promise.allSettled([
        lyricRepo.listFiles(),
        projectRepo.listProjects(),
        projectRepo.listAssignments(),
        recordingRepo.listRecordings(),
        recordingLyricLinkRepo.listLinks(),
      ]);
      const [filesResult, projectsResult, assignmentsResult, recordingsResult, linksResult] = results;
      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => (result.reason instanceof Error ? result.reason.message : 'Unknown workspace load error.'));
      const files = filesResult.status === 'fulfilled' ? filesResult.value : [];
      const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
      const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
      const recordings = recordingsResult.status === 'fulfilled' ? recordingsResult.value : [];
      const recordingLyricLinks = linksResult.status === 'fulfilled' ? linksResult.value : [];
      set({
        files: sortFiles(files),
        projects: applyCountsToProjects(projects, assignments),
        assignments,
        recordings: sortRecordings(recordings),
        recordingLyricLinks,
        activeUserId: userId,
        isInitialized: true,
        error: errors.length ? `Some workspace data could not load: ${errors.join(' ')}` : null,
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
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      const userId = data.session?.user.id ?? null;
      const results = await Promise.allSettled([
        lyricRepo.listFiles(),
        projectRepo.listProjects(),
        projectRepo.listAssignments(),
        recordingRepo.listRecordings(),
        recordingLyricLinkRepo.listLinks(),
      ]);
      const [filesResult, projectsResult, assignmentsResult, recordingsResult, linksResult] = results;
      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => (result.reason instanceof Error ? result.reason.message : 'Unknown workspace refresh error.'));
      const files = filesResult.status === 'fulfilled' ? filesResult.value : [];
      const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
      const assignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
      const recordings = recordingsResult.status === 'fulfilled' ? recordingsResult.value : [];
      const recordingLyricLinks = linksResult.status === 'fulfilled' ? linksResult.value : [];
      set({
        files: sortFiles(files),
        projects: applyCountsToProjects(projects, assignments),
        assignments,
        recordings: sortRecordings(recordings),
        recordingLyricLinks,
        activeUserId: userId,
        isInitialized: true,
        error: errors.length ? `Some workspace data could not refresh: ${errors.join(' ')}` : null,
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
    await recordingLyricLinkRepo.deleteLinksForLyric(id);
    await lyricRepo.deleteFile(id);
    set((state) => {
      const assignments = state.assignments.filter(
        (assignment) => !(assignment.itemType === 'lyric' && assignment.itemId === id),
      );
      return {
        files: state.files.filter((file) => file.id !== id),
        assignments,
        projects: applyCountsToProjects(state.projects, assignments),
        recordingLyricLinks: state.recordingLyricLinks.filter((link) => link.lyricFileId !== id),
      };
    });
  },

  async createProject(title, description) {
    const project = await projectRepo.createProject({
      title: title.trim() || 'Untitled project',
      description: description ?? null,
    });
    set((state) => ({
      projects: applyCountsToProjects([project, ...state.projects], state.assignments),
    }));
    return project;
  },

  async renameProject(id, title, description) {
    const updated = await projectRepo.renameProject(id, title.trim() || 'Untitled project', description ?? null);
    set((state) => ({
      projects: applyCountsToProjects(
        state.projects.map((project) => (project.id === id ? { ...project, ...updated } : project)),
        state.assignments,
      ),
    }));
  },

  async deleteProject(id) {
    await projectRepo.deleteProject(id);
    set((state) => {
      const assignments = state.assignments.filter((assignment) => assignment.projectId !== id);
      return {
        assignments,
        projects: applyCountsToProjects(
          state.projects.filter((project) => project.id !== id),
          assignments,
        ),
      };
    });
  },

  async toggleItemProject(itemType, itemId, projectId) {
    const exists = get().assignments.some(
      (assignment) =>
        assignment.projectId === projectId &&
        assignment.itemId === itemId &&
        assignment.itemType === itemType,
    );
    if (exists) {
      await projectRepo.removeItemFromProject({ projectId, itemId, itemType });
      set((state) => {
        const assignments = state.assignments.filter(
          (assignment) =>
            !(
              assignment.projectId === projectId &&
              assignment.itemId === itemId &&
              assignment.itemType === itemType
            ),
        );
        return {
          assignments,
          projects: applyCountsToProjects(state.projects, assignments),
        };
      });
      return;
    }

    const assignment = await projectRepo.addItemToProject({ projectId, itemId, itemType });
    set((state) => {
      const assignments = [assignment, ...state.assignments];
      return {
        assignments,
        projects: applyCountsToProjects(state.projects, assignments),
      };
    });
  },

  projectIdsForItem(itemType, itemId) {
    return get()
      .assignments.filter((assignment) => assignment.itemType === itemType && assignment.itemId === itemId)
      .map((assignment) => assignment.projectId);
  },

  projectItems(projectId) {
    const { assignments, files, recordings } = get();
    return assignments
      .filter((assignment) => assignment.projectId === projectId)
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
    await recordingLyricLinkRepo.deleteLinksForRecording(id);
    await recordingRepo.deleteRecording(current);
    set((state) => {
      const assignments = state.assignments.filter(
        (assignment) => !(assignment.itemType === 'recording' && assignment.itemId === id),
      );
      return {
        recordings: state.recordings.filter((recording) => recording.id !== id),
        assignments,
        projects: applyCountsToProjects(state.projects, assignments),
        recordingLyricLinks: state.recordingLyricLinks.filter((link) => link.recordingId !== id),
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

  async linkRecordingToLyric(recordingId, lyricFileId) {
    if (get().recordingLyricLinks.some((link) => link.recordingId === recordingId && link.lyricFileId === lyricFileId)) return;
    const optimistic: RecordingLyricLink = {
      id: `optimistic-${recordingId}-${lyricFileId}`,
      recordingId,
      lyricFileId,
      createdAt: Date.now(),
    };
    set((state) => ({ recordingLyricLinks: [optimistic, ...state.recordingLyricLinks], error: null }));
    try {
      const saved = await recordingLyricLinkRepo.createLink({ recordingId, lyricFileId });
      set((state) => ({
        recordingLyricLinks: state.recordingLyricLinks.map((link) => (link.id === optimistic.id ? saved : link)),
      }));
    } catch (error) {
      set((state) => ({
        recordingLyricLinks: state.recordingLyricLinks.filter((link) => link.id !== optimistic.id),
        error: error instanceof Error ? error.message : 'Could not link recording.',
      }));
      throw error;
    }
  },

  async unlinkRecordingFromLyric(recordingId, lyricFileId) {
    const existing = get().recordingLyricLinks.find(
      (link) => link.recordingId === recordingId && link.lyricFileId === lyricFileId,
    );
    if (!existing) return;
    set((state) => ({ recordingLyricLinks: state.recordingLyricLinks.filter((link) => link.id !== existing.id) }));
    try {
      await recordingLyricLinkRepo.deleteLink(existing.id);
    } catch (error) {
      set((state) => ({
        recordingLyricLinks: [existing, ...state.recordingLyricLinks],
        error: error instanceof Error ? error.message : 'Could not unlink recording.',
      }));
      throw error;
    }
  },

  recordingsForLyric(lyricFileId) {
    const state = get();
    const ids = new Set(state.recordingLyricLinks.filter((link) => link.lyricFileId === lyricFileId).map((link) => link.recordingId));
    return state.recordings.filter((recording) => ids.has(recording.id));
  },

  lyricsForRecording(recordingId) {
    const state = get();
    const ids = new Set(state.recordingLyricLinks.filter((link) => link.recordingId === recordingId).map((link) => link.lyricFileId));
    return state.files.filter((file) => ids.has(file.id));
  },
}));
