import { act } from '@testing-library/react-native';

import { useRefrainStore } from '../store/useRefrainStore';
import type { LyricFile } from '../types/lyricFile';

const mockFiles: LyricFile[] = [];

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      })),
    },
  },
}));

jest.mock('../lib/repo/lyricRepo', () => ({
  getLyricRepository: () => ({
    init: jest.fn(async () => {}),
    listFiles: jest.fn(async () => [...mockFiles]),
    getFile: jest.fn(async (id: string) => mockFiles.find((file) => file.id === id) ?? null),
    upsertFile: jest.fn(async (file: LyricFile) => {
      const index = mockFiles.findIndex((existing) => existing.id === file.id);
      if (index >= 0) {
        mockFiles[index] = file;
      } else {
        mockFiles.push(file);
      }
    }),
    deleteFile: jest.fn(async (id: string) => {
      const index = mockFiles.findIndex((file) => file.id === id);
      if (index >= 0) {
        mockFiles.splice(index, 1);
      }
    }),
    clearAll: jest.fn(async () => {
      mockFiles.splice(0, mockFiles.length);
    }),
  }),
}));

jest.mock('../lib/repo/collectionRepo', () => ({
  getCollectionRepository: () => ({
    init: jest.fn(async () => {}),
    listCollections: jest.fn(async () => []),
    listAssignments: jest.fn(async () => []),
  }),
}));

jest.mock('../lib/repo/recordingRepo', () => ({
  getRecordingRepository: () => ({
    init: jest.fn(async () => {}),
    listRecordings: jest.fn(async () => []),
  }),
}));

const resetStore = () => {
  useRefrainStore.setState({
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
  });
  mockFiles.splice(0, mockFiles.length);
};

describe('useRefrainStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('filters files by query', () => {
    const now = Date.now();
    const files: LyricFile[] = [
      { id: 'a', title: 'First Light', body: 'look at the sky', createdAt: now, updatedAt: now },
      { id: 'b', title: 'Heart Song', body: 'heart beats loud', createdAt: now, updatedAt: now + 1 },
    ];
    useRefrainStore.setState({ files });
    useRefrainStore.getState().setQuery('heart');

    const filtered = useRefrainStore.getState().filteredFiles();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.type).toBe('lyric');
    if (filtered[0]?.type === 'lyric') {
      expect(filtered[0].data.id).toBe('b');
    }
  });

  it('creates and deletes a file while maintaining selection', async () => {
    useRefrainStore.setState({ isInitialized: true });

    await act(async () => {
      const created = await useRefrainStore.getState().createNewFile();
      expect(useRefrainStore.getState().files.find((file) => file.id === created.id)).toBeTruthy();

      useRefrainStore.getState().selectFile(created.id);
      await useRefrainStore.getState().deleteSelectedFile();
    });

    expect(useRefrainStore.getState().files).toHaveLength(0);
    expect(useRefrainStore.getState().selectedId).toBeNull();
  });
});
