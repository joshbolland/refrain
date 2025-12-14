import { TextInput } from 'react-native';

interface RhymeSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const RhymeSearchInput = ({ value, onChangeText }: RhymeSearchInputProps) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder="Search a word"
    className="rounded-xl bg-accentSoft px-4 py-3 text-base text-ink"
    placeholderTextColor="#9CA3AF"
    selectionColor="#9DACFF"
    cursorColor="#9DACFF"
    autoCapitalize="none"
    autoCorrect={false}
  />
);
