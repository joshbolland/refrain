import { render, screen } from '@testing-library/react-native';

import { FileList } from '../components/files/FileList';
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
      onAuthStateChange: jest.fn(() => ({
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      })),
      signOut: jest.fn(async () => ({ error: null })),
    },
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
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

jest.mock('../lib/repo/lyricRepo', () => ({
  getLyricRepository: () => ({
    init: jest.fn(async () => { }),
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

describe('FileList', () => {
  beforeEach(() => {
    mockFiles.splice(0, mockFiles.length);
    const now = Date.now();
    const sample: LyricFile[] = [
      { id: 'a', title: 'First Light', body: 'Hello world', createdAt: now, updatedAt: now },
      { id: 'b', title: 'Second Song', body: 'Line two', createdAt: now, updatedAt: now + 1 },
    ];
    mockFiles.push(...sample);
    useRefrainStore.setState({
      files: sample,
      selectedId: 'a',
      query: '',
      isLoading: false,
      error: null,
      editorSelection: null,
      selectedWord: null,
      activeLineIndex: -1,
      showSyllableCounts: false,
      isInitialized: true,
    });
  });

  it('renders available files', async () => {
    render(<FileList isDesktop />);

    expect(await screen.findByText('First Light')).toBeTruthy();
    expect(screen.getByText('Second Song')).toBeTruthy();
  });
});
