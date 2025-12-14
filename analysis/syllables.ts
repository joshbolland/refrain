const vowelPattern = /[aeiouy]+/gi;

const endsWithConsonantLe = (word: string): boolean => {
  if (word.length < 2) {
    return false;
  }
  const lower = word.toLowerCase();
  return lower.endsWith('le') && /[^aeiouy]/.test(lower.charAt(lower.length - 3));
};

const stripPunctuation = (word: string): string =>
  word
    .toLowerCase()
    .replace(/[^a-z'\-]/g, '')
    .replace(/^'+|'+$/g, '');

const baseCount = (word: string): number => {
  const sanitized = word.replace(/'/g, '');
  if (sanitized.length === 0) {
    return 0;
  }

  const vowelGroups = sanitized.match(vowelPattern) ?? [];
  let count = vowelGroups.length;

  if (sanitized.endsWith('e') && !endsWithConsonantLe(sanitized) && count > 1) {
    count -= 1;
  }

  if (sanitized.endsWith('ed') && !/[td]ed$/.test(sanitized) && count > 1) {
    count -= 1;
  }

  return count > 0 ? count : 1;
};

export const countSyllablesInWord = (rawWord: string): number => {
  const cleaned = stripPunctuation(rawWord);
  if (cleaned.length === 0) {
    return 0;
  }

  return cleaned
    .split('-')
    .filter(Boolean)
    .reduce((total, part) => total + baseCount(part), 0);
};

export const countSyllablesInLine = (line: string): number => {
  const words = line
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 0;
  }

  return words.reduce((total, word) => total + countSyllablesInWord(word), 0);
};
