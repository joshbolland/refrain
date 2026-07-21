export const LYRIC_EDITOR_LINE_HEIGHT = 28;
export const LYRIC_EDITOR_TOP_INSET = 32;
export const LYRIC_SECTION_PILL_HEIGHT = 24;

export const buildDisplayLineNumbers = (
  lines: string[],
  validSectionStarts: ReadonlySet<number>,
): Array<number | null> => {
  let nextNumber = 1;

  return lines.map((line, index) => {
    const isBlank = line.trim().length === 0;
    const separatesSection = isBlank && validSectionStarts.has(index + 1);
    if (separatesSection) return null;

    const number = nextNumber;
    nextNumber += 1;
    return number;
  });
};

export const buildLineTopOffsets = (
  lineHeights: number[],
  lineCount: number,
  defaultLineHeight = LYRIC_EDITOR_LINE_HEIGHT,
  topInset = LYRIC_EDITOR_TOP_INSET,
): number[] => {
  const offsets: number[] = [];
  let top = topInset;

  for (let index = 0; index < lineCount; index += 1) {
    offsets.push(top);
    top += lineHeights[index] ?? defaultLineHeight;
  }

  return offsets;
};

export const getSectionPillAnchorTop = (
  lineIndex: number,
  lineTops: number[],
  lineHeights: number[],
  defaultLineHeight = LYRIC_EDITOR_LINE_HEIGHT,
  pillHeight = LYRIC_SECTION_PILL_HEIGHT,
): number => {
  if (lineIndex <= 0) {
    return Math.max(0, ((lineTops[0] ?? LYRIC_EDITOR_TOP_INSET) - pillHeight) / 2);
  }

  const separatorIndex = lineIndex - 1;
  const separatorTop = lineTops[separatorIndex]
    ?? Math.max(0, (lineTops[lineIndex] ?? LYRIC_EDITOR_TOP_INSET) - defaultLineHeight);
  const separatorHeight = lineHeights[separatorIndex] ?? defaultLineHeight;
  return separatorTop + Math.max(0, (separatorHeight - pillHeight) / 2);
};

