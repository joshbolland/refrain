import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '../profile/UserAvatar';
import { useRefrainStore } from '../../store/useRefrainStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { LyricFileId } from '../../types/lyricFile';
import type { LibraryItem } from '../../types/library';
import type { RecordingId } from '../../types/recording';
import { getUserProfile } from '../../lib/userProfile';
import { CollectionsSheet } from '../collections/CollectionsSheet';
import { BottomSheet } from '../ui/BottomSheet';
import { FileListItem } from './FileListItem';
import { FileSearchBar } from './FileSearchBar';
import { LibraryFilterSheet } from './LibraryFilterSheet';
import { RecordingListItem } from './RecordingListItem';

interface FileListProps {
  isDesktop?: boolean;
}

export const FileList = ({ isDesktop = false }: FileListProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, status } = useAuthStore((state) => ({
    user: state.user,
    status: state.status,
  }));
  const items = useRefrainStore((state) => state.filteredFiles());
  const filterType = useRefrainStore((state) => state.filterType);
  const filterCollectionIds = useRefrainStore((state) => state.filterCollectionIds);
  const { query, setQuery, selectedId, selectFile, createNewFile, init, isLoading, deleteFile, deleteRecording } =
    useRefrainStore((state) => ({
      query: state.query,
      setQuery: state.setQuery,
      selectedId: state.selectedId,
      selectFile: state.selectFile,
      createNewFile: state.createNewFile,
      init: state.init,
      isLoading: state.isLoading,
      deleteFile: state.deleteFile,
      deleteRecording: state.deleteRecording,
    }));
  const openSwipeRef = useRef<Swipeable | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [collectionSheetVisible, setCollectionSheetVisible] = useState(false);
  const [targetItem, setTargetItem] = useState<{ type: LibraryItem['type']; id: string } | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const hasFilters = filterType !== 'all' || filterCollectionIds.length > 0;
  const profile = useMemo(() => getUserProfile(user), [user]);
  const isAuthLoading = status === 'loading' || status === 'idle';

  useEffect(() => {
    void init();
  }, [init]);

  const handleSelect = (item: LibraryItem) => {
    if (item.type === 'recording') {
      router.push(`/record/${item.data.id}`);
      return;
    }
    const id = item.data.id;
    selectFile(id);
    if (!isDesktop) {
      router.push(`/files/${id}`);
    }
  };

  const handleCreate = async () => {
    const file = await createNewFile();
    selectFile(file.id);
    if (!isDesktop) {
      router.push(`/files/${file.id}`);
    }
  };

  const handleDelete = async (id: LyricFileId) => {
    await deleteFile(id);
  };
  const handleDeleteRecording = async (id: RecordingId) => {
    await deleteRecording(id);
  };

  const handleOpenActions = (item: { type: LibraryItem['type']; id: string }) => {
    setTargetItem(item);
    setActionSheetVisible(true);
  };

  const handleAddToCollection = () => {
    if (!targetItem) {
      return;
    }
    setActionSheetVisible(false);
    setCollectionSheetVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetItem) {
      return;
    }
    setActionSheetVisible(false);
    if (targetItem.type === 'lyric') {
      await handleDelete(targetItem.id as LyricFileId);
    } else {
      await handleDeleteRecording(targetItem.id as RecordingId);
    }
    setTargetItem(null);
  };

  const handleSwipeOpen = (instance: Swipeable | null) => {
    if (openSwipeRef.current && openSwipeRef.current !== instance) {
      openSwipeRef.current.close();
    }
    openSwipeRef.current = instance;
  };

  const handleSwipeClose = (instance: Swipeable | null) => {
    if (openSwipeRef.current === instance) {
      openSwipeRef.current = null;
    }
  };

  return (
    <>
      <View style={styles.container}>
        {/* full-bleed purple background behind header (reaches status bar edges) */}
        <View style={[styles.headerBg, { height: insets.top + 120 }]} />

        <SafeAreaView
          className="w-full"
          style={{ backgroundColor: 'transparent', paddingTop: insets.top + 18, paddingBottom: 28, width: '100%', zIndex: 2 }}
        >
          <View className="px-5 pb-4 flex-row items-center justify-between">
            <View>
              <View className="self-start rounded-full bg-accentSoft px-3 py-1">
                <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Library
                </Text>
              </View>
              <Text className="mt-1.5 text-3xl font-semibold text-ink">Your ideas</Text>
              <Text className="mt-1 text-sm text-muted/80">
                {query.trim() ? `Showing results for "${query}"` : `${items.length} ideas`}
              </Text>
            </View>

            <View className="flex-row items-center" style={{ columnGap: 10 }}>
              <Pressable
                onPress={() => setFilterSheetVisible(true)}
                className="flex-row items-center rounded-full border border-[#E3E5F0] bg-white px-3 py-1.5"
                style={({ pressed }) => ({
                  transform: [{ translateY: pressed ? 1 : 0 }],
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-ink">Filter</Text>
                {hasFilters ? (
                  <View className="ml-2 h-2 w-2 rounded-full" style={{ backgroundColor: '#9DACFF' }} />
                ) : null}
              </Pressable>
              <UserAvatar
                size={36}
                uri={profile.avatarUrl}
                initials={profile.initials}
                isLoading={isAuthLoading}
                accessibilityLabel="Open profile and settings"
                onPress={() => router.push('/profile')}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                style={{ borderColor: '#E3E5F0', borderWidth: 1 }}
              />
            </View>
          </View>
        </SafeAreaView>

        <View
          className="flex-1"
          style={[styles.paper, { zIndex: 1 }]}
        >
          <View className="px-5 flex-1">
            <FileSearchBar value={query} onChangeText={setQuery} />

            {isLoading ? (
              <View className="mt-8 items-center">
                <ActivityIndicator color="#9DACFF" />
                <Text className="mt-2 text-sm text-muted">Loading your ideas...</Text>
              </View>
            ) : items.length === 0 ? (
              <View className="mt-8 items-center rounded-xl bg-accentSoft px-5 py-8">
                <Text className="text-lg font-semibold text-ink">This is your first idea.</Text>
                <Text className="mt-2 text-sm text-muted/90">Every song starts somewhere.</Text>
                <Pressable
                  onPress={handleCreate}
                  className="mt-4 rounded-full px-3 py-1.5"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
                    borderColor: '#C7D1FF',
                    borderWidth: 1,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  })}
                >
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7C8FFF]">
                    Create lyric
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                className="mt-5"
                contentContainerStyle={{
                  paddingBottom: 32,
                  width: '100%',
                }}
                showsVerticalScrollIndicator={false}
              >
                {items.map((item, index) => {
                  const isLast = index === items.length - 1;
                  if (item.type === 'recording') {
                    const recording = item.data;
                    return (
                      <View
                        key={`rec-${recording.id}`}
                        style={[
                          styles.rowSeparator,
                          isLast && styles.rowSeparatorLast,
                        ]}
                      >
                        <RecordingListItem
                          recording={recording}
                          onPress={() => handleSelect(item)}
                          onDelete={() => handleDeleteRecording(recording.id)}
                          onLongPress={() => handleOpenActions({ type: 'recording', id: recording.id })}
                          onSwipeOpen={handleSwipeOpen}
                          onSwipeClose={handleSwipeClose}
                        />
                      </View>
                    );
                  }

                  const file = item.data;
                  return (
                    <View
                      key={`lyric-${file.id}`}
                      style={[
                        styles.rowSeparator,
                        isLast && styles.rowSeparatorLast,
                      ]}
                    >
                      <FileListItem
                        file={file}
                        isSelected={isDesktop && file.id === selectedId}
                        onPress={() => handleSelect(item)}
                        onDelete={() => handleDelete(file.id)}
                        onLongPress={() => handleOpenActions({ type: 'lyric', id: file.id })}
                        onSwipeOpen={handleSwipeOpen}
                        onSwipeClose={handleSwipeClose}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </View>

      <BottomSheet
        visible={actionSheetVisible}
        onClose={() => {
          setActionSheetVisible(false);
          setTargetItem(null);
        }}
        title={targetItem?.type === 'recording' ? 'Recording actions' : 'Lyric actions'}
      >
        <Pressable
          disabled={!targetItem}
          onPress={handleAddToCollection}
          className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-accentSoft px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-base font-semibold text-ink">Add to collection</Text>
          <Text className="ml-auto text-xs uppercase tracking-[0.12em] text-muted/80">Select</Text>
        </Pressable>
        <Pressable
          disabled={!targetItem}
          onPress={handleConfirmDelete}
          className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-white px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-base font-semibold text-red-500">
            {targetItem?.type === 'recording' ? 'Delete recording' : 'Delete lyric'}
          </Text>
        </Pressable>
      </BottomSheet>

      <CollectionsSheet
        visible={collectionSheetVisible}
        item={targetItem}
        onClose={() => {
          setCollectionSheetVisible(false);
          setTargetItem(null);
        }}
      />
      <LibraryFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  rowSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E3E5F0',
  },
  rowSeparatorLast: {
    borderBottomWidth: 0,
  },
  paper: {
    backgroundColor: '#FAFAF7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    // subtle shadow / elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    paddingTop: 22,
    width: '100%',
    marginHorizontal: 0,
  },
  headerBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#E8EBFF',
    zIndex: 0,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFAF7',
  },
});
