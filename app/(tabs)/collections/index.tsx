import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionGrid } from '../../../components/collections/CollectionGrid';
import { UserAvatar } from '../../../components/profile/UserAvatar';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { useRefrainStore } from '../../../store/useRefrainStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { CollectionId, CollectionWithCount } from '../../../types/collection';
import { getUserProfile } from '../../../lib/userProfile';

export default function CollectionsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const init = useRefrainStore((state) => state.init);
  const refreshFiles = useRefrainStore((state) => state.refreshFiles);
  const collections = useRefrainStore((state) => state.collectionsWithCounts());
  const isLoading = useRefrainStore((state) => state.isLoading);
  const createCollection = useRefrainStore((state) => state.createCollection);
  const renameCollection = useRefrainStore((state) => state.renameCollection);
  const deleteCollection = useRefrainStore((state) => state.deleteCollection);
  const { user, status } = useAuthStore((state) => ({
    user: state.user,
    status: state.status,
  }));
  const profile = useMemo(() => getUserProfile(user), [user]);
  const isAuthLoading = status === 'loading' || status === 'idle';

  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'rename'>('create');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCollection, setActiveCollection] = useState<CollectionWithCount | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        await init();
        await refreshFiles();
      };
      void load();
    }, [init, refreshFiles]),
  );

  const headerSubtitle = useMemo(() => {
    if (collections.length === 0) {
      return 'Group lyrics and recordings for quick access.';
    }
    const totalItems = collections.reduce((sum, c) => sum + (c.itemCount ?? 0), 0);
    return `${collections.length} ${collections.length === 1 ? 'collection' : 'collections'} • ${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
  }, [collections]);

  const openCreateForm = () => {
    setFormMode('create');
    setFormTitle('');
    setFormDescription('');
    setFormVisible(true);
    setActiveCollection(null);
  };

  const openRenameForm = (collection: CollectionWithCount) => {
    setFormMode('rename');
    setFormTitle(collection.title);
    setFormDescription(collection.description ?? '');
    setFormVisible(true);
    setActiveCollection(collection);
  };

  const handleSubmitForm = async () => {
    const titleTrimmed = formTitle.trim();
    if (!titleTrimmed) {
      return;
    }
    setIsSubmitting(true);
    try {
      const descriptionTrimmed = formDescription.trim() ? formDescription.trim() : null;
      if (formMode === 'create') {
        await createCollection(titleTrimmed, descriptionTrimmed);
      } else if (activeCollection) {
        await renameCollection(activeCollection.id, titleTrimmed, descriptionTrimmed);
      }
      setFormVisible(false);
      setActiveCollection(null);
      setFormTitle('');
      setFormDescription('');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save the collection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCollection = (id: CollectionId) => {
    const target = collections.find((c) => c.id === id);
    if (!target) {
      return;
    }
    Alert.alert('Delete collection?', `"${target.title}" will be removed. Items stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionSheetVisible(false);
          setActiveCollection(null);
          await deleteCollection(id);
        },
      },
    ]);
  };

  const handlePressCollection = (id: string) => {
    router.push(`/collections/${id}`);
  };

  const handleLongPressCollection = (collection: CollectionWithCount) => {
    setActiveCollection(collection);
    setActionSheetVisible(true);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#FAFAF7' }}>
      <View style={[styles.headerBg, { height: top + 120 }]} />

      <SafeAreaView
        className="w-full"
        style={{
          backgroundColor: 'transparent',
          paddingTop: top + 18,
          paddingBottom: 28,
          width: '100%',
          zIndex: 2,
        }}
      >
        <View className="px-5 pb-4 flex-row items-center justify-between">
          <View>
            <View className="self-start rounded-full bg-accentSoft px-3 py-1">
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                Collections
              </Text>
            </View>
            <Text className="mt-1.5 text-3xl font-semibold text-ink">Group your ideas</Text>
            <Text className="mt-1 text-sm text-muted/80">{headerSubtitle}</Text>
          </View>

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
      </SafeAreaView>

      <View
        className="flex-1 px-5"
        style={[
          styles.paper,
          { paddingBottom: bottom + 16 },
        ]}
      >
        {isLoading ? (
          <View className="mt-8 items-center justify-center">
            <ActivityIndicator color="#9DACFF" />
            <Text className="mt-2 text-sm text-muted/80">Loading your collections...</Text>
          </View>
        ) : collections.length === 0 ? (
          <View className="mt-8 rounded-2xl bg-white px-4 py-5" style={{ borderColor: '#E3E5F0', borderWidth: 1 }}>
            <Text className="text-lg font-semibold text-ink">No collections yet</Text>
            <Text className="mt-2 text-sm text-muted/80">
              Organize lyrics and recordings into sets for projects, shows, or moods.
            </Text>
            <Pressable
              onPress={openCreateForm}
              className="mt-4 self-start rounded-full px-3 py-1.5"
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
                borderColor: '#C7D1FF',
                borderWidth: 1,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7C8FFF]">
                Create collection
              </Text>
            </Pressable>
          </View>
        ) : (
          <CollectionGrid
            collections={collections}
            onCreatePress={openCreateForm}
            onPressCollection={handlePressCollection}
            onLongPressCollection={handleLongPressCollection}
          />
        )}
      </View>

      <BottomSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={formMode === 'create' ? 'Create collection' : 'Rename collection'}
      >
        <View className="gap-3">
          <View className="rounded-xl border border-[#E3E5F0] bg-white px-3 py-2">
            <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/70">Title</Text>
            <TextInput
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Tour setlist"
              placeholderTextColor="#9CA3AF"
              className="mt-1 text-base text-ink"
              cursorColor="#9DACFF"
            />
          </View>
          <View className="rounded-xl border border-[#E3E5F0] bg-white px-3 py-2">
            <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/70">Description</Text>
            <TextInput
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Optional notes"
              placeholderTextColor="#9CA3AF"
              className="mt-1 text-base text-ink"
              cursorColor="#9DACFF"
              multiline
            />
          </View>
          <Pressable
            disabled={!formTitle.trim() || isSubmitting}
            onPress={handleSubmitForm}
            className="items-center rounded-xl bg-accent px-4 py-3"
            style={({ pressed }) => ({
              opacity: !formTitle.trim() || isSubmitting ? 0.5 : pressed ? 0.9 : 1,
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
          >
            <Text className="text-base font-semibold text-white">
              {formMode === 'create' ? 'Create' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={actionSheetVisible}
        onClose={() => {
          setActionSheetVisible(false);
          setActiveCollection(null);
        }}
        title="Collection actions"
      >
        <Pressable
          onPress={() => {
            if (activeCollection) {
              openRenameForm(activeCollection);
            }
            setActionSheetVisible(false);
          }}
          className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-accentSoft px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-base font-semibold text-ink">Rename</Text>
          <Text className="ml-auto text-xs uppercase tracking-[0.12em] text-muted/80">Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (activeCollection) {
              handleDeleteCollection(activeCollection.id);
            }
          }}
          className="flex-row items-center rounded-2xl border border-[#E3E5F0] bg-white px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <Text className="text-base font-semibold text-red-500">Delete</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: '#FAFAF7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    paddingTop: 6,
  },
  headerBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#E8EBFF',
    zIndex: 0,
  },
});
