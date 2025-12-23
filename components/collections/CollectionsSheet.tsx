import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useRefrainStore } from '../../store/useRefrainStore';
import type { CollectionId, CollectionItemType } from '../../types/collection';
import { BottomSheet } from '../ui/BottomSheet';

interface CollectionsSheetProps {
  visible: boolean;
  item: { id: string; type: CollectionItemType } | null;
  onClose: () => void;
}

export function CollectionsSheet({ visible, item, onClose }: CollectionsSheetProps) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const collections = useRefrainStore((state) => state.collectionsWithCounts());
  const assignedIds = useRefrainStore((state) =>
    item ? state.collectionIdsForItem(item.type, item.id) : [],
  );
  const createCollection = useRefrainStore((state) => state.createCollection);
  const assignItemToCollection = useRefrainStore((state) => state.assignItemToCollection);
  const removeItemFromCollection = useRefrainStore((state) => state.removeItemFromCollection);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setIsCreating(false);
    }
  }, [visible]);

  const hasCollections = collections.length > 0;
  const canAssign = Boolean(item);
  const titleTrimmed = title.trim();

  const sortedCollections = useMemo(() => collections, [collections]);

  const handleToggle = async (collectionId: CollectionId) => {
    if (!canAssign || !item) {
      return;
    }
    if (assignedIds.includes(collectionId)) {
      await removeItemFromCollection(item.id, item.type, collectionId);
    } else {
      await assignItemToCollection(item.id, item.type, collectionId);
    }
  };

  const handleCreate = async () => {
    if (!titleTrimmed) {
      return;
    }
    setIsCreating(true);
    const collection = await createCollection(titleTrimmed);
    if (canAssign && item) {
      await assignItemToCollection(item.id, item.type, collection.id);
    }
    setTitle('');
    setIsCreating(false);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Collections">
      <View className="mb-3 flex-row items-center rounded-2xl border border-[#E3E5F0] bg-accentSoft px-3 py-2.5">
        <Ionicons name="folder-open-outline" size={18} color="#7C8FFF" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Create a collection"
          placeholderTextColor="#9CA3AF"
          className="ml-2 flex-1 text-base text-ink"
          selectionColor="#9DACFF"
          cursorColor="#9DACFF"
          editable={!isCreating}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <Pressable
          disabled={!titleTrimmed || isCreating}
          onPress={handleCreate}
          className="rounded-full px-3 py-1"
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
            opacity: !titleTrimmed || isCreating ? 0.6 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            Create
          </Text>
        </Pressable>
      </View>

      {hasCollections ? (
        <View style={{ gap: 8, paddingBottom: 4 }}>
          {sortedCollections.map((collection) => {
            const isSelected = assignedIds.includes(collection.id);
            const countLabel =
              typeof collection.itemCount === 'number'
                ? `${collection.itemCount} ${collection.itemCount === 1 ? 'item' : 'items'}`
                : null;
            return (
              <Pressable
                key={collection.id}
                onPress={() => void handleToggle(collection.id)}
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
          })}
        </View>
      ) : (
        <View className="rounded-2xl bg-white px-4 py-4" style={{ borderColor: '#E3E5F0', borderWidth: 1 }}>
          <Text className="text-base font-semibold text-ink">No collections yet</Text>
          <Text className="mt-1 text-sm text-muted/80">Create one above to get started.</Text>
        </View>
      )}
    </BottomSheet>
  );
}
