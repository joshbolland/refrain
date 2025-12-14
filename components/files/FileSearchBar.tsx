import { TextInput } from 'react-native';

interface FileSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const FileSearchBar = ({ value, onChangeText }: FileSearchBarProps) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder="Search lyrics"
    className="w-full rounded-xl bg-accentSoft px-4 py-3 text-base text-ink"
    placeholderTextColor="#9CA3AF"
    selectionColor="#9DACFF"
    cursorColor="#9DACFF"
  />
);
