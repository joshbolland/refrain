import type { LyricFileId } from './lyricFile';
import type { RecordingId } from './recording';

export type RecordingLyricLinkId = string;

export interface RecordingLyricLink {
  id: RecordingLyricLinkId;
  recordingId: RecordingId;
  lyricFileId: LyricFileId;
  createdAt: number;
}
