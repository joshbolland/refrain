import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { getRhymes } from '../../rhyme/dictionary';
import { RhymeResults } from './RhymeResults';
import { RhymeSearchInput } from './RhymeSearchInput';

interface RhymePanelProps {
  targetWord: string | null;
}

export const RhymePanel = ({ targetWord }: RhymePanelProps) => {
  const [query, setQuery] = useState(targetWord ?? '');

  useEffect(() => {
    if (targetWord) {
      setQuery(targetWord);
    }
  }, [targetWord]);

  const searchTerm = query || targetWord || '';

  const results = useMemo(() => getRhymes(searchTerm), [searchTerm]);

  const handleSelect = async (word: string) => {
    await Clipboard.setStringAsync(word);
    setQuery(word);
  };

  return (
    <View>
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Rhymes</Text>
        <Text className="text-xs text-muted/80">
          {searchTerm ? `for “${searchTerm}”` : 'Pick a word to see rhymes'}
        </Text>
      </View>
      <RhymeSearchInput value={query} onChangeText={setQuery} />
      <Text className="mt-2 text-xs text-muted/80">Tap a rhyme to copy it over.</Text>
      <RhymeResults results={results} onSelect={handleSelect} />
    </View>
  );
};
