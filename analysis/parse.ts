import { getLineEndWord } from './rhymes';
import { countSyllablesInLine } from './syllables';

export type ParsedLineType = 'annotation' | 'lyric' | 'empty';

export interface ParsedLine {
  index: number;
  raw: string;
  text: string;
  type: ParsedLineType;
  syllableCount: number | null;
  endWord: string | null;
}

export const isAnnotationLine = (line: string): boolean => line.trim().startsWith('//');

export const parseLyricBody = (body: string): ParsedLine[] => {
  const rows = body.split(/\r?\n/);

  return rows.map((line, index) => {
    const trimmedRight = line.replace(/\s+$/, '');
    const cleaned = trimmedRight.trim();

    const annotation = isAnnotationLine(trimmedRight);
    const empty = cleaned.length === 0;

    const type: ParsedLineType = annotation ? 'annotation' : empty ? 'empty' : 'lyric';
    const syllableCount = type === 'lyric' ? countSyllablesInLine(trimmedRight) : null;
    const endWord = type === 'lyric' ? getLineEndWord(trimmedRight) : null;

    return {
      index,
      raw: line,
      text: trimmedRight,
      type,
      syllableCount,
      endWord,
    };
  });
};
