import { describe, expect, it } from 'vitest';
import { cleanupSectionTypes, ensureDefaultSectionTypes } from '@refrain/editor-core/sections';

import {
  buildDisplayLineNumbers,
  buildLineTopOffsets,
  getSectionPillAnchorTop,
} from './lyric-editor-layout';

describe('buildDisplayLineNumbers', () => {
  it('numbers ordinary lyric rows and blank rows', () => {
    expect(buildDisplayLineNumbers(['one', '', 'two'], new Set([0]))).toEqual([1, 2, 3]);
  });

  it('leaves the separator immediately before a section unnumbered', () => {
    expect(buildDisplayLineNumbers(['one', '', 'two', '', 'three'], new Set([0, 2, 4])))
      .toEqual([1, null, 2, null, 3]);
  });

  it('only suppresses the final blank in a run of section separators', () => {
    expect(buildDisplayLineNumbers(['one', '', '', 'two'], new Set([0, 3])))
      .toEqual([1, 2, null, 3]);
  });
});

describe('editor row positioning', () => {
  it('builds offsets from measured wrapped-line heights', () => {
    expect(buildLineTopOffsets([28, 56, 28], 3)).toEqual([32, 60, 116]);
  });

  it('centres the first section pill in the reserved top inset', () => {
    const tops = buildLineTopOffsets([28, 28], 2);
    expect(getSectionPillAnchorTop(0, tops, [28, 28])).toBe(4);
  });

  it('centres later pills in the separator row even after a wrapped line', () => {
    const heights = [56, 28, 28];
    const tops = buildLineTopOffsets(heights, 3);
    expect(getSectionPillAnchorTop(2, tops, heights)).toBe(90);
  });
});

describe('section metadata while editing separators', () => {
  it('adds the default section type after inserting a separator', () => {
    expect(ensureDefaultSectionTypes('one\n\ntwo', {})).toEqual({ 2: 'verse' });
  });

  it('removes a section type when its separator is deleted', () => {
    expect(cleanupSectionTypes('one\ntwo', { 0: 'verse', 2: 'chorus' })).toEqual({ 0: 'verse' });
  });
});
