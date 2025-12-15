import type { SectionType } from '../types/lyricFile';

export const isBlankLine = (line: string): boolean => line.trim().length === 0;

export const getSectionStartLineIndices = (body: string): number[] => {
  return Array.from(getValidSectionStartSet(body)).sort((a, b) => a - b);
};

export const getValidSectionStartSet = (body: string): Set<number> => {
  const lines = body.split('\n');
  const indices = new Set<number>();
  const firstNonBlankIndex = lines.findIndex((line) => !isBlankLine(line));

  if (firstNonBlankIndex !== -1) {
    indices.add(firstNonBlankIndex);
  }

  const hasPriorNonBlank = (upToIndex: number): boolean => {
    for (let j = upToIndex; j >= 0; j -= 1) {
      if (!isBlankLine(lines[j])) {
        return true;
      }
    }
    return false;
  };

  for (let i = 1; i < lines.length; i += 1) {
    if (isBlankLine(lines[i - 1]) && hasPriorNonBlank(i - 2)) {
      indices.add(i);
    }
  }

  return indices;
};

export const cleanupSectionTypes = (
  body: string,
  sectionTypes: Record<number, SectionType>,
): Record<number, SectionType> => {
  const validStarts = getValidSectionStartSet(body);
  const cleaned = Object.entries(sectionTypes).reduce<Record<number, SectionType>>((acc, [key, value]) => {
    const index = Number(key);
    if (Number.isInteger(index) && validStarts.has(index)) {
      acc[index] = value;
    }
    return acc;
  }, {});

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const removed = Object.keys(sectionTypes).filter((key) => !validStarts.has(Number(key)));
    if (removed.length > 0) {
      // eslint-disable-next-line no-console
      console.log('cleanupSectionTypes removed invalid starts', { removed });
    }
  }

  return cleaned;
};

export const ensureDefaultSectionTypes = (
  body: string,
  sectionTypes: Record<number, SectionType>,
): Record<number, SectionType> => {
  const lines = body.split('\n');
  const validStarts = getValidSectionStartSet(body);
  const next: Record<number, SectionType> = { ...sectionTypes };

  validStarts.forEach((index) => {
    if (next[index] !== undefined) {
      return;
    }
    if (!isBlankLine(lines[index] ?? '')) {
      next[index] = 'verse';
    }
  });

  return next;
};
