export type LyricFileId = string;

export type SectionType =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'pre-chorus'
  | 'intro'
  | 'outro'
  | 'other';

export interface LyricFile {
  id: LyricFileId;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  sectionTypes?: Record<number, SectionType>;
}
