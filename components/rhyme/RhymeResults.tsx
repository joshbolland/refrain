import { Pressable, ScrollView, Text, View } from 'react-native';

interface RhymeResultsProps {
  results: string[];
  onSelect: (word: string) => void;
  isKeyboardVisible: boolean;
}

export const RhymeResults = ({ results, onSelect, isKeyboardVisible }: RhymeResultsProps) => {
  if (results.length === 0) {
    return (
      <View 
        className="mt-2 rounded-xl px-4 py-3" 
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
      className="mt-2"
      style={isKeyboardVisible ? { maxHeight: 100 } : undefined}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
      contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 6 }}
    >
      {results.map((word) => (
        <Pressable
          key={word}
          onPress={() => onSelect(word)}
          className="mr-1.5 mb-1.5 rounded-full px-4 py-2"
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
