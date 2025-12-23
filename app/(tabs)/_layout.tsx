import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../../components/ui/BottomSheet';

const TAB_LABELS: Record<string, string> = {
  'library/index': 'Library',
  'collections/index': 'Collections',
};

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'library/index': 'book-outline',
  'collections/index': 'grid-outline',
};

function TabItem({
  route,
  state,
  navigation,
}: {
  route: BottomTabBarProps['state']['routes'][number];
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
  containerStyle?: object;
}) {
  const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
  const label = TAB_LABELS[route.name] ?? route.name;
  const icon = TAB_ICONS[route.name] ?? 'ellipse-outline';

  const onPress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center rounded-xl px-3 py-2"
      style={({ pressed }) => [
        {
          backgroundColor: isFocused ? '#EEF0FF' : 'transparent',
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={isFocused ? '#7C8FFF' : '#6B7280'}
      />
      <Text
        className="ml-2 text-sm font-semibold"
        style={{ color: isFocused ? '#7C8FFF' : '#6B7280' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryTabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const libraryRoute = useMemo(
    () => state.routes.find((route) => route.name === 'library/index'),
    [state.routes],
  );
  const collectionsRoute = useMemo(
    () => state.routes.find((route) => route.name === 'collections/index'),
    [state.routes],
  );

  const activeRouteName = state.routes[state.index]?.name;
  const hideTabBar = activeRouteName === 'record/index';

  if (hideTabBar) {
    return null;
  }

  return (
    <>
      <View style={[styles.tabWrapper, { paddingBottom: bottom + 10 }]}>
        <View style={styles.tabBar}>
          {libraryRoute ? (
            <View style={styles.sideSlot}>
              <TabItem route={libraryRoute} state={state} navigation={navigation} />
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Create"
            onPress={() => setIsSheetOpen(true)}
            style={({ pressed }) => [
              styles.fab,
              pressed && {
                backgroundColor: '#7C8FFF',
                transform: [{ translateY: 1 }],
              },
            ]}
          >
            <View style={styles.fabInner}>
              <Text className="text-2xl font-bold text-white">+</Text>
            </View>
          </Pressable>

          {collectionsRoute ? (
            <View style={styles.sideSlot}>
              <TabItem route={collectionsRoute} state={state} navigation={navigation} />
            </View>
          ) : null}
        </View>
      </View>

      <BottomSheet
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      >
        <View style={styles.actionGrid}>
          <Pressable
            onPress={() => {
              setIsSheetOpen(false);
              router.push('/files/new');
            }}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionPrimary,
              pressed && { transform: [{ translateY: 2 }] },
            ]}
          >
            <View style={styles.actionRow}>
              <View style={styles.actionIcon}>
                <Ionicons name="musical-notes-outline" size={22} color="#7C8FFF" />
              </View>
              <View style={styles.actionText}>
                <Text className="text-base font-semibold text-ink" style={{ textAlign: 'center' }}>
                  New Lyric
                </Text>
                <Text className="text-xs text-muted/80" style={{ textAlign: 'center' }}>
                  Draft a fresh refrain.
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              setIsSheetOpen(false);
              router.push('/record');
            }}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionSecondary,
              pressed && { transform: [{ translateY: 2 }] },
            ]}
          >
            <View style={styles.actionRow}>
              <View style={styles.actionIcon}>
                <Ionicons name="mic-outline" size={22} color="#7C8FFF" />
              </View>
              <View style={styles.actionText}>
                <Text className="text-base font-semibold text-ink" style={{ textAlign: 'center' }}>
                  New Recording
                </Text>
                <Text className="text-xs text-muted/80" style={{ textAlign: 'center' }}>
                  Capture a quick idea.
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="library/index"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <PrimaryTabBar {...props} />}
    >
      <Tabs.Screen
        name="library/index"
        options={{
          title: 'Library',
        }}
      />
      <Tabs.Screen
        name="collections/index"
        options={{
          title: 'Collections',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrapper: {
    backgroundColor: '#FAFAF7',
    paddingHorizontal: 16,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  sideSlot: {
    flex: 1,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: 'transparent',
    flexShrink: 0,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
  },
  fabInner: {
    backgroundColor: '#9DACFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#7C8FFF',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionCard: {
    minHeight: 140,
    flexBasis: '48%',
    padding: 16,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderColor: '#E3E5F0',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  actionPrimary: {
    backgroundColor: '#F4F6FF',
    borderColor: '#D5DAF1',
  },
  actionSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE2F0',
  },
  actionRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#D5DAF1',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 18,
  },
  actionText: {
    gap: 4,
    alignItems: 'center',
  },
  actionIcon: {
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(124,143,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
