export const isBlankLine = (line: string): boolean => line.trim().length === 0;

export const getSectionStartLineIndices = (body: string): number[] => {
  const lines = body.split('\n');
  const indices = new Set<number>();

  const firstNonBlankIndex = lines.findIndex((line) => !isBlankLine(line));
  if (firstNonBlankIndex !== -1) {
    indices.add(firstNonBlankIndex);
  }

  for (let i = 1; i < lines.length; i += 1) {
    if (isBlankLine(lines[i - 1])) {
      indices.add(i);
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
};
