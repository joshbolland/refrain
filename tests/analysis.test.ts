import { parseLyricBody } from '../analysis/parse';
import { countSyllablesInLine, countSyllablesInWord } from '../analysis/syllables';

describe('parseLyricBody', () => {
  it('classifies annotations, lyrics, and empty lines', () => {
    const parsed = parseLyricBody('[Verse]\n// capo 2\nHere comes the sun\n   ');

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toMatchObject({ type: 'lyric', text: '[Verse]' });
    expect(parsed[1]).toMatchObject({ type: 'annotation', text: '// capo 2', syllableCount: null });
    expect(parsed[2]).toMatchObject({ type: 'lyric', syllableCount: expect.any(Number) });
    expect(parsed[3]).toMatchObject({ type: 'empty', syllableCount: null });
  });
});

describe('syllable counting', () => {
  it('counts syllables in common words', () => {
    expect(countSyllablesInWord("don't")).toBe(1);
    expect(countSyllablesInWord('candle')).toBe(2);
    expect(countSyllablesInWord('played')).toBe(1);
    expect(countSyllablesInWord('sing-along')).toBe(3);
  });

  it('counts syllables across a lyric line', () => {
    expect(countSyllablesInLine('Singing softly in the rain')).toBe(7);
  });
});
