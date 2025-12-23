import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useRefrainStore } from '../../store/useRefrainStore';
import type { CollectionId } from '../../types/collection';
import { BottomSheet } from '../ui/BottomSheet';

interface LibraryFilterSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LibraryFilterSheet({ visible, onClose }: LibraryFilterSheetProps) {
  const filterType = useRefrainStore((state) => state.filterType);
  const filterCollectionIds = useRefrainStore((state) => state.filterCollectionIds);
  const setFilterType = useRefrainStore((state) => state.setFilterType);
  const setFilterCollections = useRefrainStore((state) => state.setFilterCollections);
  const clearFilters = useRefrainStore((state) => state.clearFilters);
  const collections = useRefrainStore((state) => state.collectionsWithCounts());

  const toggleCollection = (id: CollectionId) => {
    const next = filterCollectionIds.includes(id)
      ? filterCollectionIds.filter((item) => item !== id)
      : [...filterCollectionIds, id];
    setFilterCollections(next);
  };

  const typeOptions: Array<{
    key: 'all' | 'lyrics' | 'recordings';
    label: string;
  }> = useMemo(
    () => [
      { key: 'all', label: 'Everything' },
      { key: 'lyrics', label: 'Lyrics' },
      { key: 'recordings', label: 'Recordings' },
    ],
    [],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filter library">
      <View className="mb-2">
        <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/80">Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {typeOptions.map((option) => {
            const isActive = filterType === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilterType(option.key)}
                className="flex-1 rounded-xl border px-3 py-2"
                style={({ pressed }) => ({
                  backgroundColor: isActive ? '#EEF0FF' : '#FFFFFF',
                  borderColor: isActive ? '#D7DDFF' : '#E3E5F0',
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ translateY: pressed ? 1 : 0 }],
                })}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: isActive ? '#7C8FFF' : '#111827' }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-3">
        <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/80">
          Collections
        </Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {collections.length === 0 ? (
            <Text className="text-sm text-muted/80">Create a collection to filter.</Text>
          ) : (
            collections.map((collection) => {
              const isSelected = filterCollectionIds.includes(collection.id);
              const countLabel =
                typeof collection.itemCount === 'number'
                  ? `${collection.itemCount} ${collection.itemCount === 1 ? 'item' : 'items'}`
                  : '';
              return (
                <Pressable
                  key={collection.id}
                  onPress={() => toggleCollection(collection.id)}
                  className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-white px-4 py-3"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  })}
                >
                  <View
                    className="mr-3 h-6 w-6 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isSelected ? '#9DACFF' : '#EEF0FF',
                      borderWidth: 1,
                      borderColor: isSelected ? '#7C8FFF' : '#D7DDFF',
                    }}
                  >
                    {isSelected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">{collection.title}</Text>
                    {countLabel ? (
                      <Text className="text-xs text-muted/80">{countLabel}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <Pressable
        onPress={clearFilters}
        className="mt-4 self-start rounded-full px-3 py-1.5"
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
          borderColor: '#C7D1FF',
          borderWidth: 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        })}
      >
        <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Clear filters</Text>
      </Pressable>
    </BottomSheet>
  );
}
