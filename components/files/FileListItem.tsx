import { useRef, useState } from 'react';
import { Alert, Animated, GestureResponderEvent, Platform, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import type { LyricFile } from '../../types/lyricFile';

interface FileListItemProps {
  file: LyricFile;
  isSelected?: boolean;
  onPress: () => void;
  onDelete: () => Promise<void>;
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

export const FileListItem = ({
  file,
  isSelected = false,
  onPress,
  onDelete,
  onSwipeOpen,
  onSwipeClose,
}: FileListItemProps) => {
  const swipeableRef = useRef<Swipeable | null>(null);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const isWeb = Platform.OS === 'web';

  const closeSwipe = () => {
    swipeableRef.current?.close();
    setIsSwipeOpen(false);
  };

  const handleConfirmDelete = () => {
    const removeFile = async () => {
      await onDelete();
      closeSwipe();
    };

    if (isWeb && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm('Delete lyric?\n\nThis can’t be undone.');
      if (confirmed) {
        void removeFile();
      } else {
        closeSwipe();
      }
      return;
    }

    Alert.alert('Delete lyric?', "This can’t be undone.", [
      { text: 'Cancel', style: 'cancel', onPress: closeSwipe },
      { text: 'Delete', style: 'destructive', onPress: () => void removeFile() },
    ]);
  };

  const handleWebDeletePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    handleConfirmDelete();
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
                backgroundColor: '#ffffff',
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
      disabled={isSwipeOpen}
      className="rounded-xl px-4 py-4"
      style={({ pressed }) => ({
        backgroundColor: pressed || isSelected ? '#EEF0FF' : '#FFFFFF',
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`flex-1 text-base font-semibold ${isSelected ? 'text-accent' : 'text-ink'}`}
          numberOfLines={1}
        >
          {file.title || 'Untitled'}
        </Text>
        <View className="ml-3 flex-row items-center">
          {isWeb ? (
            <Pressable
              onPress={handleWebDeletePress}
              hitSlop={10}
              className="rounded-full p-2"
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#F3F3F3' : 'transparent',
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Ionicons name="trash" size={18} color="#e71d36" />
            </Pressable>
          ) : null}
          <Text className="ml-3 text-xs uppercase tracking-[0.08em] text-muted/80">
            {formatUpdated(file.updatedAt)}
          </Text>
        </View>
      </View>
      <Text className="mt-2 text-sm leading-relaxed text-muted/90" numberOfLines={2}>
        {file.body.trim().length > 0 ? file.body.trim() : 'Every song starts somewhere.'}
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
