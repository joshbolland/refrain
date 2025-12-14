import type { ParsedLine } from './parse';

export interface RhymeGroup {
  groupId: number;
  word: string;
}

export type RhymeGroupMap = Record<number, RhymeGroup>;

export const getLineEndWord = (line: string): string | null => {
  const cleaned = line.trim();
  if (!cleaned) {
    return null;
  }

  const tokens = cleaned.split(/\s+/);
  const lastToken = tokens[tokens.length - 1]?.replace(/[^a-zA-Z']/g, '') ?? '';
  const normalized = lastToken.toLowerCase();

  return normalized.length > 0 ? normalized : null;
};

export const computeRhymeGroups = (lines: ParsedLine[]): RhymeGroupMap => {
  const assignments: RhymeGroupMap = {};
  const seenWords: Record<string, number> = {};
  let counter = 0;

  lines.forEach((line) => {
    if (!line.endWord) {
      return;
    }

    if (seenWords[line.endWord] === undefined) {
      seenWords[line.endWord] = counter;
      counter += 1;
    }

    assignments[line.index] = {
      groupId: seenWords[line.endWord],
      word: line.endWord,
    };
  });

  return assignments;
};
