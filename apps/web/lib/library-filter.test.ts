import { describe, expect, it } from 'vitest';
import type { LyricFile, ProjectAssignment, RecordingItem } from '@refrain/domain';
import { adjacentEntryIndex, filterLibraryEntries } from './library-filter';

const lyric = (id: string, title: string, body: string, updatedAt: number): LyricFile => ({
  id, title, body, updatedAt, createdAt: updatedAt, sectionTypes: {},
});
const recording = (id: string, title: string, updatedAt: number): RecordingItem => ({
  id, title, updatedAt, createdAt: updatedAt, durationMs: 10_000, storageBucket: null,
  storagePath: null, mimeType: null, localUri: null, syncStatus: 'needs-reupload',
});

describe('filterLibraryEntries', () => {
  const files = [lyric('l1', 'Paper Satellites', 'signal in the static', 20), lyric('l2', 'Blue Hour', 'indigo', 10)];
  const recordings = [recording('r1', 'Bridge idea', 30)];
  const assignments: ProjectAssignment[] = [{ projectId: 'p1', itemId: 'l1', itemType: 'lyric', createdAt: 1 }];

  it('combines and sorts all item types by edited time', () => {
    expect(filterLibraryEntries({ files, recordings, assignments, view: 'all', projectId: null, query: '' }).map((entry) => entry.data.id)).toEqual(['r1', 'l1', 'l2']);
  });

  it('scopes by type, project, title, and lyric body', () => {
    expect(filterLibraryEntries({ files, recordings, assignments, view: 'lyrics', projectId: null, query: 'static' }).map((entry) => entry.data.id)).toEqual(['l1']);
    expect(filterLibraryEntries({ files, recordings, assignments, view: 'all', projectId: 'p1', query: '' }).map((entry) => entry.data.id)).toEqual(['l1']);
  });
});

describe('adjacentEntryIndex', () => {
  it('clamps keyboard navigation at both ends', () => {
    expect(adjacentEntryIndex(0, 'previous', 3)).toBe(0);
    expect(adjacentEntryIndex(2, 'next', 3)).toBe(2);
    expect(adjacentEntryIndex(0, 'next', 3)).toBe(1);
  });
});
