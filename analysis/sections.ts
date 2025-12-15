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
  const lines = body.split('\n');
  const validStarts = getValidSectionStartSet(body);
  const hasNonBlankLines = lines.some((line) => !isBlankLine(line));
  const cleaned = Object.entries(sectionTypes).reduce<Record<number, SectionType>>((acc, [key, value]) => {
    const index = Number(key);
    const isEmptyStart = !hasNonBlankLines && index === 0;
    if (Number.isInteger(index) && (validStarts.has(index) || isEmptyStart)) {
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

export const findPreviousSectionStartOfType = (
  body: string,
  sectionTypes: Record<number, SectionType>,
  targetStartIndex: number,
  targetType: SectionType,
): number | null => {
  const starts = Array.from(getValidSectionStartSet(body)).filter((index) => index < targetStartIndex);
  let candidate: number | null = null;
  starts.forEach((index) => {
    if (index < targetStartIndex && sectionTypes[index] === targetType) {
      candidate = index;
    }
  });
  return candidate;
};

export const findPreviousChorusStart = (
  body: string,
  sectionTypes: Record<number, SectionType>,
  targetStartIndex: number,
): number | null => findPreviousSectionStartOfType(body, sectionTypes, targetStartIndex, 'chorus');

export const getSectionBlockRange = (
  body: string,
  startIndex: number,
): { start: number; endExclusive: number } => {
  const lines = body.split('\n');
  const starts = Array.from(getValidSectionStartSet(body)).filter((index) => index >= 0).sort((a, b) => a - b);
  const nextStart = starts.find((value) => value > startIndex);
  const endExclusive = nextStart !== undefined ? nextStart : lines.length;
  return { start: startIndex, endExclusive };
};

export const extractBlockText = (lines: string[], range: { start: number; endExclusive: number }): string => {
  const slice = lines.slice(range.start, range.endExclusive);
  return slice.join('\n');
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
    if (index === 0) {
      return;
    }
    if (!isBlankLine(lines[index] ?? '')) {
      next[index] = 'verse';
    }
  });

  return next;
};
