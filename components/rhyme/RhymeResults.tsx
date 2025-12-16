import { Pressable, ScrollView, Text, View } from 'react-native';

interface RhymeResultsProps {
  results: string[];
  onSelect: (word: string) => void;
}

export const RhymeResults = ({ results, onSelect }: RhymeResultsProps) => {
  if (results.length === 0) {
    return (
      <View 
        className="mt-3 rounded-xl px-4 py-4" 
        style={{ 
          backgroundColor: '#FAFAF7',
          borderTopWidth: 2, 
          borderTopColor: '#9DACFF' 
        }}
      >
        <Text className="text-sm text-muted/90">No rhymes found yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="mt-4"
      style={{ maxHeight: 224 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 }}
    >
      {results.map((word) => (
        <Pressable
          key={word}
          onPress={() => onSelect(word)}
          className="mr-2 mb-2 rounded-full px-4 py-2"
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#7C8FFF' : '#EEF0FF',
          })}
        >
          <Text className="text-sm font-semibold text-accent">{word}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};
