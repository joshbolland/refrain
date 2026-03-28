import type { LyricFile } from './lyricFile';
import type { RecordingItem } from './recording';

export type LibraryItem =
  | { type: 'lyric'; data: LyricFile }
  | { type: 'recording'; data: RecordingItem };
