export type RecordingId = string;

export interface RecordingItem {
  id: RecordingId;
  title: string;
  createdAt: number;
  updatedAt: number;
  durationMs: number;
  uri: string;
}
