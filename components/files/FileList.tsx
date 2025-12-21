import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRefrainStore } from '../../store/useRefrainStore';
import type { LyricFileId } from '../../types/lyricFile';
import { FileListItem } from './FileListItem';
import { FileSearchBar } from './FileSearchBar';

interface FileListProps {
  isDesktop?: boolean;
}

export const FileList = ({ isDesktop = false }: FileListProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const files = useRefrainStore((state) => state.filteredFiles());
  const { query, setQuery, selectedId, selectFile, createNewFile, init, isLoading, deleteFile } =
    useRefrainStore((state) => ({
      query: state.query,
      setQuery: state.setQuery,
      selectedId: state.selectedId,
      selectFile: state.selectFile,
      createNewFile: state.createNewFile,
      init: state.init,
      isLoading: state.isLoading,
      deleteFile: state.deleteFile,
    }));
  const openSwipeRef = useRef<Swipeable | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  const handleSelect = (id: string) => {
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
            <Text className="mt-1.5 text-3xl font-semibold text-ink">Your refrains</Text>
            <Text className="mt-1 text-sm text-muted/80">
              {query.trim() ? `Showing results for "${query}"` : `${files.length} lyrics`}
            </Text>
          </View>

          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border border-accent bg-accentSoft"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#e1e5ff' : undefined,
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
            onPress={handleCreate}
          >
            <Text className="text-xl font-bold text-accent">+</Text>
          </Pressable>
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
              <Text className="mt-2 text-sm text-muted">Loading your refrains...</Text>
            </View>
          ) : files.length === 0 ? (
            <View className="mt-8 items-center rounded-xl bg-accentSoft px-5 py-8">
              <Text className="text-lg font-semibold text-ink">This is your first refrain.</Text>
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
              {files.map((file, index) => {
                const isLast = index === files.length - 1;
                return (
                  <View
                    key={file.id}
                    style={[
                      styles.rowSeparator,
                      isLast && styles.rowSeparatorLast,
                    ]}
                  >
                    <FileListItem
                      file={file}
                      isSelected={isDesktop && file.id === selectedId}
                      onPress={() => handleSelect(file.id)}
                      onDelete={() => handleDelete(file.id)}
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
