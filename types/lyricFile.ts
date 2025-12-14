export type LyricFileId = string;

export interface LyricFile {
  id: LyricFileId;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}
