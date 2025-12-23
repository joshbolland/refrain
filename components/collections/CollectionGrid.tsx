import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import type { CollectionId, CollectionWithCount } from '../../types/collection';
import { CollectionCard, collectionCardGap } from './CollectionCard';

interface CollectionGridProps {
  collections: CollectionWithCount[];
  onCreatePress: () => void;
  onPressCollection?: (id: CollectionId) => void;
  onLongPressCollection?: (collection: CollectionWithCount) => void;
}

type GridItem =
  | { type: 'create' }
  | { type: 'collection'; value: CollectionWithCount };

export function CollectionGrid({
  collections,
  onCreatePress,
  onPressCollection,
  onLongPressCollection,
}: CollectionGridProps) {
  const data: GridItem[] = useMemo(
    () => [{ type: 'create' }, ...collections.map((value) => ({ type: 'collection', value }))],
    [collections],
  );

  const renderItem = ({ item }: { item: GridItem }) => {
    if (item.type === 'create') {
      return (
        <View style={collectionCardGap.gap} className="flex-1">
          <Pressable
            onPress={onCreatePress}
            className="flex-1 rounded-2xl border-2 border-dashed border-[#D7DDFF] bg-accentSoft px-4 py-5"
            style={({ pressed }) => ({
              transform: [{ translateY: pressed ? 1 : 0 }],
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl border border-[#D7DDFF] bg-white">
              <Text className="text-xl font-bold text-accent">+</Text>
            </View>
            <Text className="text-lg font-semibold text-accent">Create collection</Text>
            <Text className="mt-1 text-sm text-muted/80">Group lyrics or recordings.</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={collectionCardGap.gap} className="flex-1">
        <CollectionCard
          collection={item.value}
          onPress={onPressCollection}
          onLongPress={onLongPressCollection}
        />
      </View>
    );
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item, index) =>
        item.type === 'collection' ? item.value.id : `create-${index}`
      }
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      renderItem={renderItem}
      contentContainerStyle={{
        paddingBottom: 32,
        paddingTop: 4,
        gap: 0,
      }}
      ListFooterComponent={
        collections.length === 0 ? (
          <View className="mt-4 rounded-2xl bg-white px-4 py-4" style={{ borderColor: '#E3E5F0', borderWidth: 1 }}>
            <Text className="text-base font-semibold text-ink">No collections yet</Text>
            <Text className="mt-1 text-sm text-muted/80">
              Draft a collection to keep lyrics and recordings together.
            </Text>
          </View>
        ) : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
