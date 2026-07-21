import type { LyricFile, ProjectAssignment, RecordingItem } from '@refrain/domain';

export type LibraryEntry = { type: 'lyric'; data: LyricFile } | { type: 'recording'; data: RecordingItem };

export function filterLibraryEntries({ files, recordings, assignments, view, projectId, query }: {
  files: LyricFile[];
  recordings: RecordingItem[];
  assignments: ProjectAssignment[];
  view: string;
  projectId: string | null;
  query: string;
}): LibraryEntry[] {
  let entries: LibraryEntry[] = [
    ...files.map((data) => ({ type: 'lyric' as const, data })),
    ...recordings.map((data) => ({ type: 'recording' as const, data })),
  ];
  if (projectId) {
    const allowed = new Set(assignments.filter((item) => item.projectId === projectId).map((item) => `${item.itemType}:${item.itemId}`));
    entries = entries.filter((entry) => allowed.has(`${entry.type}:${entry.data.id}`));
  } else if (view === 'lyrics') entries = entries.filter((entry) => entry.type === 'lyric');
  else if (view === 'recordings') entries = entries.filter((entry) => entry.type === 'recording');
  const needle = query.trim().toLowerCase();
  if (needle) entries = entries.filter((entry) => entry.data.title.toLowerCase().includes(needle) || (entry.type === 'lyric' && entry.data.body.toLowerCase().includes(needle)));
  return entries.sort((a, b) => b.data.updatedAt - a.data.updatedAt);
}

export function adjacentEntryIndex(current: number, direction: 'next' | 'previous', length: number): number {
  if (!length) return -1;
  return direction === 'next' ? Math.min(length - 1, current + 1) : Math.max(0, current - 1);
}
