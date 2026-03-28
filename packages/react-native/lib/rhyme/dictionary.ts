import compactDictionary from './cmudict.compact.json';

type CompactDictionary = {
  wordToRhymeKey: Record<string, string>;
  rhymeKeyToWords: Record<string, string[]>;
};

const { wordToRhymeKey, rhymeKeyToWords } = compactDictionary as CompactDictionary;

const baseKeyToWords: Record<string, string[]> = {};

for (const [rhymeKey, words] of Object.entries(rhymeKeyToWords)) {
  const baseKey = rhymeKey.replace(/[0-9]/g, '');
  if (!baseKeyToWords[baseKey]) {
    baseKeyToWords[baseKey] = [];
  }

  for (const word of words) {
    baseKeyToWords[baseKey].push(word);
  }
}

for (const baseKey of Object.keys(baseKeyToWords)) {
  const unique = Array.from(new Set(baseKeyToWords[baseKey]));
  unique.sort();
  baseKeyToWords[baseKey] = unique;
}

const MAX_RESULTS = 50;

const normalize = (word: string): string => {
  const trimmed = word.trim().toLowerCase();
  const stripped = trimmed.replace(/^[^a-z']+|[^a-z']+$/g, '');
  return stripped;
};

export const getRhymes = (word: string): string[] => {
  const normalized = normalize(word);
  if (!normalized) {
    return [];
  }

  const rhymeKey = wordToRhymeKey[normalized];
  if (!rhymeKey) {
    return [];
  }

  const perfectMatches = (rhymeKeyToWords[rhymeKey] ?? []).filter((entry) => entry !== normalized);
  if (perfectMatches.length >= MAX_RESULTS) {
    return perfectMatches.slice(0, MAX_RESULTS);
  }

  const nearKey = rhymeKey.replace(/[0-9]/g, '');
  const nearMatches = (baseKeyToWords[nearKey] ?? []).filter(
    (entry) => entry !== normalized && !perfectMatches.includes(entry),
  );

  return [...perfectMatches, ...nearMatches].slice(0, MAX_RESULTS);
};
