import { getRhymes } from '../lib/rhyme/dictionary';

describe('getRhymes', () => {
  it('returns phonetic rhymes for time', () => {
    const results = getRhymes('time');
    expect(results).toContain('rhyme');
  });

  it('strips punctuation before lookup', () => {
    expect(getRhymes('time,')).toEqual(getRhymes('time'));
  });

  it('returns an empty list for unknown words', () => {
    expect(getRhymes('qwertyuiop')).toEqual([]);
  });
});
