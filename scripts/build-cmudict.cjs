const fs = require('fs');
const path = require('path');

const CMUDICT_SOURCE = path.join(__dirname, '..', 'data', 'cmudict.txt');
const OUTPUT_PATH = path.join(__dirname, '..', 'lib', 'rhyme', 'cmudict.compact.json');

const VOWELS = new Set([
  'AA',
  'AE',
  'AH',
  'AO',
  'AW',
  'AY',
  'EH',
  'ER',
  'EY',
  'IH',
  'IY',
  'OW',
  'OY',
  'UH',
  'UW',
]);

/**
 * Extract the rhyme key from a pronunciation by taking the phoneme tail that
 * starts at the last stressed vowel (1 > 2) or, if none is present, the last
 * vowel. Stress priority helps us pick the best pronunciation when multiple
 * exist for a word.
 */
const extractRhymeInfo = (phonemes) => {
  let lastPrimary = -1;
  let lastSecondary = -1;
  let lastVowel = -1;

  phonemes.forEach((phoneme, index) => {
    const base = phoneme.replace(/[0-9]/g, '');
    if (!VOWELS.has(base)) {
      return;
    }

    lastVowel = index;
    if (phoneme.endsWith('1')) {
      lastPrimary = index;
    } else if (phoneme.endsWith('2')) {
      lastSecondary = index;
    }
  });

  const startIndex = lastPrimary >= 0 ? lastPrimary : lastSecondary >= 0 ? lastSecondary : lastVowel;
  if (startIndex < 0) {
    return null;
  }

  const key = phonemes.slice(startIndex).join('-');
  const stressPriority = lastPrimary >= 0 ? 2 : lastSecondary >= 0 ? 1 : 0;

  return { key, stressPriority };
};

const normalizeWord = (rawWord) => {
  const lower = rawWord.toLowerCase();
  const parenIndex = lower.indexOf('(');
  const normalized = parenIndex >= 0 ? lower.slice(0, parenIndex) : lower;
  return normalized;
};

const shouldIncludeWord = (word) => /^[a-z]+$/.test(word) && word.length <= 20;

const buildCompactDictionary = (lines) => {
  const bestPronunciations = new Map();

  for (const line of lines) {
    if (!line || line.startsWith(';;;')) {
      continue;
    }

    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) {
      continue;
    }

    const [rawWord, ...phonemes] = parts;
    const word = normalizeWord(rawWord);
    if (!shouldIncludeWord(word)) {
      continue;
    }

    const rhymeInfo = extractRhymeInfo(phonemes);
    if (!rhymeInfo) {
      continue;
    }

    const existing = bestPronunciations.get(word);
    if (!existing || rhymeInfo.stressPriority > existing.stressPriority) {
      bestPronunciations.set(word, rhymeInfo);
    }
  }

  const wordToRhymeKey = {};
  const rhymeKeyToWords = {};

  for (const [word, info] of bestPronunciations.entries()) {
    wordToRhymeKey[word] = info.key;

    if (!rhymeKeyToWords[info.key]) {
      rhymeKeyToWords[info.key] = [];
    }
    rhymeKeyToWords[info.key].push(word);
  }

  for (const key of Object.keys(rhymeKeyToWords)) {
    const uniqueWords = Array.from(new Set(rhymeKeyToWords[key]));
    uniqueWords.sort();
    rhymeKeyToWords[key] = uniqueWords;
  }

  return { wordToRhymeKey, rhymeKeyToWords };
};

const main = () => {
  const source = fs.readFileSync(CMUDICT_SOURCE, 'utf8');
  const lines = source.split(/\r?\n/);
  const compact = buildCompactDictionary(lines);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(compact));

  console.log(
    `Built compact CMUdict with ${Object.keys(compact.wordToRhymeKey).length} words and ${Object.keys(compact.rhymeKeyToWords).length} rhyme keys.`,
  );
};

main();
