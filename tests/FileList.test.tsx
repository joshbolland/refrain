import { render, screen } from '@testing-library/react-native';

import { FileList } from '../components/files/FileList';
import { useRefrainStore } from '../store/useRefrainStore';
import type { LyricFile } from '../types/lyricFile';

const mockFiles: LyricFile[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
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
