import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CollectionWithCount } from '../../types/collection';

interface CollectionCardProps {
  collection: CollectionWithCount;
  onPress?: (id: string) => void;
  onLongPress?: (collection: CollectionWithCount) => void;
}

export function CollectionCard({ collection, onPress, onLongPress }: CollectionCardProps) {
  const { id, title, itemCount = 0, lyricCount = 0, recordingCount = 0 } = collection;
  const derivedCount = itemCount || lyricCount + recordingCount;
  const countLabel = derivedCount === 1 ? '1 item' : `${derivedCount} items`;

  return (
    <Pressable
      onPress={() => onPress?.(id)}
      onLongPress={() => onLongPress?.(collection)}
      className="flex-1 rounded-2xl bg-white px-4 py-5"
      style={({ pressed }) => ({
        transform: [{ translateY: pressed ? 1 : 0 }],
        shadowColor: '#000',
        shadowOpacity: pressed ? 0.12 : 0.08,
        shadowRadius: pressed ? 10 : 8,
        shadowOffset: { width: 0, height: pressed ? 4 : 2 },
        elevation: pressed ? 4 : 2,
        borderColor: '#E3E5F0',
        borderWidth: 1,
      })}
    >
      <View className="self-start rounded-full bg-accentSoft px-3 py-1">
        <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          Collection
        </Text>
      </View>
      <Text className="mt-3 text-lg font-semibold text-ink" numberOfLines={2}>
        {title || 'Untitled collection'}
      </Text>
      <Text className="mt-2 text-sm text-muted/80">{countLabel}</Text>
    </Pressable>
  );
}

export const collectionCardGap = StyleSheet.create({
  gap: {
    marginBottom: 12,
  },
});
