export type SectionType = 'verse' | 'chorus' | 'bridge' | 'other';

export type RenderRow =
  | { kind: 'badge'; sectionType: SectionType; sectionStartLineIndex: number }
  | { kind: 'line'; rawLineIndex: number; text: string };
