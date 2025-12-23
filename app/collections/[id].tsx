import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionsSheet } from '../../components/collections/CollectionsSheet';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { getCollectionRepository } from '../../lib/repo/collectionRepo';
import { supabase } from '../../lib/supabaseClient';
import { useRefrainStore } from '../../store/useRefrainStore';
import type {
  CollectionId,
  CollectionItemType,
  CollectionItemWithData,
} from '../../types/collection';
import type { LyricFile } from '../../types/lyricFile';
import type { RecordingItem } from '../../types/recording';
import type { Database } from '../../types/supabase';

type LyricRow = Database['public']['Tables']['lyric_files']['Row'];
type RecordingRow = Database['public']['Tables']['recordings']['Row'];

const collectionRepo = getCollectionRepository();

const mapLyric = (row: LyricRow): LyricFile => ({
  id: row.id,
  title: row.title ?? '',
  body: row.body ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  sectionTypes: (row.section_types ?? {}) as Record<number, string>,
});

const mapRecording = (row: RecordingRow): RecordingItem => ({
  id: row.id,
  title: row.title ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  durationMs: row.duration_ms ?? 0,
  uri: row.uri ?? '',
});

const formatAdded = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const collectionId: CollectionId | null = typeof id === 'string' ? id : null;
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();

  const init = useRefrainStore((state) => state.init);
  const refreshFiles = useRefrainStore((state) => state.refreshFiles);
  const removeItemFromCollection = useRefrainStore((state) => state.removeItemFromCollection);
  const collection = useRefrainStore((state) =>
    state.collectionsWithCounts().find((c) => c.id === collectionId) ?? null,
  );

  const [items, setItems] = useState<CollectionItemWithData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [manageSheetVisible, setManageSheetVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: CollectionItemType; id: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!collectionId) {
      setError('Collection not found.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const assignments = await collectionRepo.listCollectionItems(collectionId);
      const lyricIds = assignments.filter((a) => a.itemType === 'lyric').map((a) => a.itemId);
      const recordingIds = assignments.filter((a) => a.itemType === 'recording').map((a) => a.itemId);

      const [{ data: lyricRows, error: lyricError }, { data: recordingRows, error: recordingError }] =
        await Promise.all([
          lyricIds.length
            ? supabase
                .from('lyric_files')
                .select('id, title, body, section_types, created_at, updated_at, deleted_at')
                .in('id', lyricIds)
                .is('deleted_at', null)
            : Promise.resolve({ data: [] as LyricRow[], error: null }),
          recordingIds.length
            ? supabase
                .from('recordings')
                .select('id, title, duration_ms, uri, created_at, updated_at')
                .in('id', recordingIds)
            : Promise.resolve({ data: [] as RecordingRow[], error: null }),
        ]);

      if (lyricError || recordingError) {
        throw new Error(lyricError?.message ?? recordingError?.message ?? 'Failed to load items.');
      }

      const lyricMap = new Map<string, LyricFile>();
      (lyricRows ?? []).forEach((row) => {
        lyricMap.set(row.id, mapLyric(row));
      });

      const recordingMap = new Map<string, RecordingItem>();
      (recordingRows ?? []).forEach((row) => {
        recordingMap.set(row.id, mapRecording(row));
      });

      const merged = assignments
        .map<CollectionItemWithData | null>((assignment) => {
          if (assignment.itemType === 'lyric') {
            const lyric = lyricMap.get(assignment.itemId);
            if (!lyric) {
              return null;
            }
            return { assignment, item: { type: 'lyric' as const, data: lyric } };
          }
          const recording = recordingMap.get(assignment.itemId);
          if (!recording) {
            return null;
          }
          return { assignment, item: { type: 'recording' as const, data: recording } };
        })
        .filter(Boolean) as CollectionItemWithData[];

      setItems(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection items.');
    } finally {
      setIsLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    void init();
    void refreshFiles();
  }, [init, refreshFiles]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const headerTitle = useMemo(() => collection?.title ?? 'Collection', [collection?.title]);

  const handleOpenItem = (item: CollectionItemWithData['item']) => {
    if (item.type === 'recording') {
      router.push(`/record/${item.data.id}`);
      return;
    }
    router.push(`/files/${item.data.id}`);
  };

  const handleOpenActions = (item: CollectionItemWithData['item']) => {
    setSelectedItem({ type: item.type, id: item.data.id });
    setActionSheetVisible(true);
  };

  const handleRemoveFromThisCollection = async () => {
    if (!collectionId || !selectedItem) {
      return;
    }
    setIsRemoving(true);
    try {
      await removeItemFromCollection(selectedItem.id, selectedItem.type, collectionId);
      setItems((prev) =>
        prev.filter(
          (entry) =>
            !(
              entry.assignment.collectionId === collectionId &&
              entry.assignment.itemId === selectedItem.id &&
              entry.assignment.itemType === selectedItem.type
            ),
        ),
      );
    } catch (err) {
      Alert.alert('Remove failed', err instanceof Error ? err.message : 'Could not update the collection.');
    } finally {
      setIsRemoving(false);
      setActionSheetVisible(false);
    }
  };

  const handleManageCollections = () => {
    setActionSheetVisible(false);
    setManageSheetVisible(true);
  };

  const renderItem = ({ item }: { item: CollectionItemWithData }) => {
    const { assignment, item: entry } = item;
    const isRecording = entry.type === 'recording';
    const title = entry.data.title || (isRecording ? 'Untitled recording' : 'Untitled lyric');
    const subtitle = isRecording ? 'Recording' : 'Lyric';
    const addedOn = formatAdded(assignment.createdAt);

    return (
      <Pressable
        onPress={() => handleOpenItem(entry)}
        onLongPress={() => handleOpenActions(entry)}
        className="rounded-xl bg-white px-4 py-4"
        style={({ pressed }) => ({
          opacity: pressed ? 0.94 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
          borderColor: '#E3E5F0',
          borderWidth: 1,
        })}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ columnGap: 8 }}>
            <View className="rounded-full bg-accentSoft px-3 py-1">
              <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {subtitle}
              </Text>
            </View>
            <Text className="text-base font-semibold text-ink" numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Text className="text-xs uppercase tracking-[0.08em] text-muted/80">Added {addedOn}</Text>
        </View>
      </Pressable>
    );
  };

  const emptyState = (
    <View className="mt-6 rounded-2xl bg-white px-4 py-5" style={{ borderColor: '#E3E5F0', borderWidth: 1 }}>
      <Text className="text-lg font-semibold text-ink">No items yet</Text>
      <Text className="mt-1 text-sm text-muted/80">
        Long-press items in your library to add them here.
      </Text>
      <Pressable
        onPress={() => router.replace('/library')}
        className="mt-4 self-start rounded-full px-3 py-1.5"
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
          borderColor: '#C7D1FF',
          borderWidth: 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        })}
      >
        <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7C8FFF]">
          Go to library
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#FAFAF7' }}>
      <View style={[styles.headerBg, { height: top + 120 }]} />
      <View
        className="flex-1 px-4"
        style={{
          paddingTop: top + 14,
          paddingBottom: bottom + 12,
        }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
              borderColor: '#C7D1FF',
              borderWidth: 1,
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
          >
            <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7C8FFF]">
              Back
            </Text>
          </Pressable>
          <Text className="text-xs uppercase tracking-[0.1em] text-muted/80">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <View className="mb-4 rounded-2xl bg-white px-4 py-4" style={{ borderColor: '#E3E5F0', borderWidth: 1 }}>
          <Text className="text-xl font-semibold text-ink">{headerTitle}</Text>
          {collection?.description ? (
            <Text className="mt-1 text-sm text-muted/80">{collection.description}</Text>
          ) : null}
          <Text className="mt-2 text-xs uppercase tracking-[0.1em] text-muted/60">
            {collection?.itemCount ?? 0} {collection?.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {isLoading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator color="#9DACFF" />
            <Text className="mt-2 text-sm text-muted/80">Loading collection...</Text>
          </View>
        ) : error ? (
          <View className="mt-8 items-center">
            <Text className="text-base font-semibold text-red-500">{error}</Text>
            <Pressable
              onPress={() => void fetchItems()}
              className="mt-3 rounded-full px-3 py-1.5"
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
                borderColor: '#C7D1FF',
                borderWidth: 1,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7C8FFF]">
                Retry
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) =>
              `${item.assignment.collectionId}:${item.assignment.itemType}:${item.assignment.itemId}`
            }
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={emptyState}
          />
        )}
      </View>

      <BottomSheet
        visible={actionSheetVisible}
        onClose={() => {
          setActionSheetVisible(false);
          setSelectedItem(null);
        }}
        title="Item actions"
      >
        <Pressable
          onPress={handleManageCollections}
          className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-accentSoft px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-base font-semibold text-ink">Manage collections</Text>
          <Text className="ml-auto text-xs uppercase tracking-[0.12em] text-muted/80">Edit</Text>
        </Pressable>
        <Pressable
          disabled={isRemoving}
          onPress={handleRemoveFromThisCollection}
          className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-white px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-base font-semibold text-red-500">
            {isRemoving ? 'Removing…' : 'Remove from this collection'}
          </Text>
        </Pressable>
      </BottomSheet>

      <CollectionsSheet
        visible={manageSheetVisible}
        item={selectedItem}
        onClose={() => {
          setManageSheetVisible(false);
          setSelectedItem(null);
          void fetchItems();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#E8EBFF',
    zIndex: 0,
  },
});
