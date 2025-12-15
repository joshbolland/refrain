import {
  cleanupSectionTypes,
  ensureDefaultSectionTypes,
  extractBlockText,
  findPreviousChorusStart,
  findPreviousSectionStartOfType,
  getSectionBlockRange,
} from '../analysis/sections';
import type { SectionType } from '../types/lyricFile';

describe('cleanupSectionTypes', () => {
  it('keeps valid section starts when separator exists', () => {
    const body = 'Line1\n\nLine2';
    const sectionTypes: Record<number, SectionType> = { 2: 'chorus' };

    const cleaned = cleanupSectionTypes(body, sectionTypes);

    expect(cleaned).toEqual({ 2: 'chorus' });
  });

  it('allows selection on empty start line after a separator', () => {
    const body = 'Line1\n\n';
    const sectionTypes: Record<number, SectionType> = { 2: 'chorus' };

    const cleaned = cleanupSectionTypes(body, sectionTypes);

    expect(cleaned).toEqual({ 2: 'chorus' });
  });

  it('removes section starts when separator is removed', () => {
    const body = 'Line1\nLine2';
    const sectionTypes: Record<number, SectionType> = { 2: 'chorus' };

    const cleaned = cleanupSectionTypes(body, sectionTypes);

    expect(cleaned).toEqual({});
  });

  it('treats leading blanks only as part of the first non-blank section start', () => {
    const body = '\n\nLine1';
    const sectionTypes: Record<number, SectionType> = { 1: 'verse', 2: 'chorus' };

    const cleaned = cleanupSectionTypes(body, sectionTypes);

    expect(cleaned).toEqual({ 2: 'chorus' });
  });

  describe('ensureDefaultSectionTypes', () => {
    it('defaults first block to verse', () => {
      const body = 'Line1\nLine2';
      const sectionTypes: Record<number, SectionType> = {};

      const result = ensureDefaultSectionTypes(body, sectionTypes);

      expect(result).toEqual({ 0: 'verse' });
    });

    it('defaults multi-block pasted content to verse per section start', () => {
      const body = 'V1 line\nV1 line2\n\nV2 line\nV2 line2';
      const sectionTypes: Record<number, SectionType> = {};

      const result = ensureDefaultSectionTypes(body, sectionTypes);

      expect(result).toEqual({ 0: 'verse', 3: 'verse' });
    });

    it('does not default empty new section lines', () => {
      const body = 'Line1\n\n';
      const sectionTypes: Record<number, SectionType> = {};

      const result = ensureDefaultSectionTypes(body, sectionTypes);

      expect(result).toEqual({ 0: 'verse' });
    });

    it('does not override existing types', () => {
      const body = 'V1 line\nV1 line2\n\nV2 line\nV2 line2';
      const sectionTypes: Record<number, SectionType> = { 3: 'chorus' };

      const result = ensureDefaultSectionTypes(body, sectionTypes);

      expect(result).toEqual({ 0: 'verse', 3: 'chorus' });
    });
  });

  describe('chorus helpers', () => {
    it('finds previous chorus start before target', () => {
      const body = 'V1\n\nChorus line\n\nVerse 2';
      const sectionTypes: Record<number, SectionType> = { 0: 'verse', 2: 'chorus', 4: 'verse' };

      expect(findPreviousChorusStart(body, sectionTypes, 4)).toBe(2);
      expect(findPreviousChorusStart(body, sectionTypes, 2)).toBeNull();
    });

    it('finds previous section start of type', () => {
      const body = 'V1\n\nChorus line\n\nPre-chorus A\n\nVerse 2';
      const sectionTypes: Record<number, SectionType> = {
        0: 'verse',
        2: 'chorus',
        4: 'pre-chorus',
        6: 'verse',
      };

      expect(findPreviousSectionStartOfType(body, sectionTypes, 6, 'pre-chorus')).toBe(4);
      expect(findPreviousSectionStartOfType(body, sectionTypes, 4, 'pre-chorus')).toBeNull();
    });

    it('extracts section block text', () => {
      const lines = ['V1 line', '', 'Chorus A', 'Chorus B', '', 'Bridge'];
      const body = lines.join('\n');
      const range = getSectionBlockRange(body, 2);
      const block = extractBlockText(lines, range);

      expect(range).toEqual({ start: 2, endExclusive: 5 });
      expect(block).toBe('Chorus A\nChorus B\n');
    });
  });
});
