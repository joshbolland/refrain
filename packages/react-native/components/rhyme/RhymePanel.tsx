import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';

import { getRhymes } from '../../rhyme/dictionary';
import { RhymeResults } from './RhymeResults';
import { RhymeSearchInput } from './RhymeSearchInput';

interface RhymePanelProps {
  targetWord: string | null;
}

export const RhymePanel = ({ targetWord }: RhymePanelProps) => {
  const [query, setQuery] = useState(targetWord ?? '');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (targetWord) {
      setQuery(targetWord);
    }
  }, [targetWord]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const searchTerm = query || targetWord || '';

  const results = useMemo(() => getRhymes(searchTerm), [searchTerm]);

  const handleSelect = async (word: string) => {
    await Clipboard.setStringAsync(word);
    setQuery(word);
  };

  return (
    <View
      className="rounded-2xl"
      style={isKeyboardVisible ? { maxHeight: 160, overflow: 'hidden' } : undefined}
    >
      <RhymeSearchInput value={query} onChangeText={setQuery} />
      <RhymeResults
        results={results}
        onSelect={handleSelect}
        isKeyboardVisible={isKeyboardVisible}
      />
    </View>
  );
};
