import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import type { RecordingItem } from '../../types/recording';

interface RecordingListItemProps {
  recording: RecordingItem;
  onPress: () => void;
  onDelete: () => Promise<void>;
  onLongPress?: () => void;
  onSwipeOpen?: (instance: Swipeable | null) => void;
  onSwipeClose?: (instance: Swipeable | null) => void;
}

const formatUpdated = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatDurationSeconds = (ms: number): string => {
  const sec = Math.max(1, Math.round(ms / 1000));
  return `${sec}s`;
};

export const RecordingListItem = ({
  recording,
  onPress,
  onDelete,
  onLongPress,
  onSwipeOpen,
  onSwipeClose,
}: RecordingListItemProps) => {
  const swipeableRef = useRef<Swipeable | null>(null);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const isWeb = Platform.OS === 'web';

  const closeSwipe = () => {
    swipeableRef.current?.close();
    setIsSwipeOpen(false);
  };

  const handleConfirmDelete = () => {
    const remove = async () => {
      await onDelete();
      closeSwipe();
    };

    if (isWeb && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm('Delete recording?\n\nThis can’t be undone.');
      if (confirmed) {
        void remove();
      } else {
        closeSwipe();
      }
      return;
    }

    Alert.alert('Delete recording?', "This can’t be undone.", [
      { text: 'Cancel', style: 'cancel', onPress: closeSwipe },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<string | number>,
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [32, 12, 0],
    });
    const opacity = progress.interpolate({
      inputRange: [0, 0.4, 0.6, 1],
      outputRange: [0, 0, 0.8, 1],
    });

    return (
      <View className="flex-row justify-end items-stretch">
        <Animated.View
          style={{
            transform: [{ translateX }],
            opacity,
            height: '100%',
            justifyContent: 'center',
          }}
        >
          <Pressable
            className="items-center justify-center rounded-xl"
            onPress={handleConfirmDelete}
            style={({ pressed }) => ({
              backgroundColor: '#e71d36',
              width: 108,
              height: '100%',
              opacity: pressed ? 0.92 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              alignSelf: 'stretch',
            })}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#FAFAF7',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Ionicons name="trash" size={18} color="#e71d36" />
            </View>
            <Text className="text-base font-semibold text-white">Delete</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  const content = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={isSwipeOpen}
      className="rounded-xl px-4 py-4"
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#EEF0FF' : 'transparent',
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="rounded-full bg-accentSoft px-3 py-1">
            <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Recording
            </Text>
          </View>
          <Text className="text-base font-semibold text-ink" numberOfLines={1}>
            {recording.title}
          </Text>
        </View>
        <Text className="text-xs uppercase tracking-[0.08em] text-muted/80">
          {formatDurationSeconds(recording.durationMs)}
        </Text>
      </View>
      <Text className="mt-2 text-sm text-muted/90" numberOfLines={2}>
        Saved {formatUpdated(recording.updatedAt)}
      </Text>
    </Pressable>
  );

  if (isWeb) {
    return content;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={28}
      onSwipeableWillOpen={() => {
        setIsSwipeOpen(true);
        onSwipeOpen?.(swipeableRef.current);
      }}
      onSwipeableClose={() => {
        setIsSwipeOpen(false);
        onSwipeClose?.(swipeableRef.current);
      }}
    >
      {content}
    </Swipeable>
  );
};
