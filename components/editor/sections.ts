export type { SectionType } from '../../types/lyricFile';

export type RenderRow =
  | { kind: 'badge'; sectionType: SectionType; sectionStartLineIndex: number }
  | { kind: 'line'; rawLineIndex: number; text: string };
