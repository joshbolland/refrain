export type RecordingId = string;

export type RecordingSyncStatus = 'ready' | 'needs-reupload';

export interface RecordingItem {
  id: RecordingId;
  title: string;
  createdAt: number;
  updatedAt: number;
  durationMs: number;
  storageBucket: string | null;
  storagePath: string | null;
  mimeType: string | null;
  localUri: string | null;
  syncStatus: RecordingSyncStatus;
}

export const recordingHasRemoteMedia = (recording: RecordingItem): boolean =>
  Boolean(recording.storageBucket && recording.storagePath);

export const recordingNeedsRepair = (recording: RecordingItem): boolean =>
  recording.syncStatus === 'needs-reupload' || !recordingHasRemoteMedia(recording);
