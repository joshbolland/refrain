import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/icon-symbol';

import { useRefrainStore } from '../../store/useRefrainStore';

const formatDuration = (millis: number): string => {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function RecordingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const recording = useRefrainStore((state) =>
    state.recordings.find((rec) => rec.id === id),
  );
  const updateRecording = useRefrainStore((state) => state.updateRecording);
  const progressAnim = useRef(new Animated.Value(0));
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(recording?.title ?? '');
  const titleInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!sound) {
      return;
    }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const refreshStatus = async () => {
      const status = await sound.getStatusAsync();
      if (cancelled || !status.isLoaded) {
        return;
      }
      setIsPlaying(status.isPlaying);
      setPositionMs(status.positionMillis ?? 0);
      if (typeof status.durationMillis === 'number') {
        setDurationMs(status.durationMillis);
      }
    };

    if (isPlaying) {
      interval = setInterval(() => {
        void refreshStatus();
      }, 50);
      void refreshStatus();
    } else {
      void refreshStatus();
    }

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [sound, isPlaying]);

  useEffect(() => {
    if (!recording) {
      return;
    }
    setPositionMs(0);
    setIsPlaying(false);
    setDurationMs(recording.durationMs ?? 0);
    setTitleDraft(recording.title);
    setIsEditingTitle(false);
    let mounted = true;
    let currentSound: Audio.Sound | null = null;
    const load = async () => {
      const onStatus = (status: AVPlaybackStatus) => {
        if (!mounted || !status.isLoaded) {
          return;
        }
        setIsPlaying(status.isPlaying);
        setPositionMs(status.positionMillis ?? 0);
        if (typeof status.durationMillis === 'number') {
          setDurationMs(status.durationMillis);
        }
      };
      const { sound: createdSound } = await Audio.Sound.createAsync(
        { uri: recording.uri },
        { progressUpdateIntervalMillis: 50 },
        onStatus,
      );
      currentSound = createdSound;
      if (mounted) {
        setSound(createdSound);
      }
    };
    void load();
    return () => {
      mounted = false;
      if (currentSound) {
        currentSound.setOnPlaybackStatusUpdate(null);
        void currentSound.unloadAsync();
      }
    };
  }, [recording]);

  const handleTogglePlay = async () => {
    if (!sound) {
      return;
    }
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) {
      return;
    }
    const finished =
      status.didJustFinish ||
      ((status.positionMillis ?? 0) >= (status.durationMillis ?? 0) &&
        (status.durationMillis ?? 0) > 0);
    if (status.isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (finished) {
      await sound.setPositionAsync(0);
      setPositionMs(0);
    }
    await sound.playAsync();
    setIsPlaying(true);
  };

  const durationForPercent = durationMs || recording?.durationMs || 0;
  const percent = durationForPercent > 0 ? Math.min(100, (positionMs / durationForPercent) * 100) : 0;

  const commitTitle = async () => {
    if (!recording) {
      return;
    }
    const trimmed = titleDraft.trim() || 'Untitled recording';
    setTitleDraft(trimmed);
    setIsEditingTitle(false);
    if (trimmed !== recording.title) {
      await updateRecording(recording.id, { title: trimmed });
    }
  };

  const startEditingTitle = () => {
    if (!recording) {
      return;
    }
    setIsEditingTitle(true);
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  };

  useEffect(() => {
    Animated.timing(progressAnim.current, {
      toValue: percent,
      duration: 80,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  if (!recording) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-[#FAFAF7]"
        style={{ paddingTop: top + 24, paddingBottom: bottom + 24 }}
      >
        <Text className="text-base font-semibold text-ink">Recording not found.</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 rounded-full px-3 py-1.5"
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
            borderColor: '#C7D1FF',
            borderWidth: 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <IconSymbol name="chevron.left" size={18} color="#7C8FFF" />
          <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7C8FFF]">
            Back
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        if (isEditingTitle) {
          void commitTitle();
        }
        Keyboard.dismiss();
      }}
      accessible={false}
    >
      <SafeAreaView
        className="flex-1 bg-[#FAFAF7] px-4"
        style={{ paddingTop: top + 12, paddingBottom: bottom + 12 }}
      >
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
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
              <IconSymbol name="chevron.left" size={18} color="#7C8FFF" />
              <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7C8FFF]">
                Back
              </Text>
            </Pressable>
            <View style={{ width: 60 }} />
          </View>

          <View className="mt-5 items-center px-4">
            {isEditingTitle ? (
              <TextInput
                ref={titleInputRef}
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={commitTitle}
                onSubmitEditing={commitTitle}
                onFocus={() => {
                  const length = titleDraft.length;
                  titleInputRef.current?.setSelection?.(length, length);
                }}
                autoFocus
                className="text-3xl font-semibold tracking-tight text-ink text-center"
                style={{ textAlign: 'center', backgroundColor: 'transparent' }}
                placeholder="Title"
                placeholderTextColor="#9CA3AF"
                selectionColor="#9DACFF"
                cursorColor="#9DACFF"
                returnKeyType="done"
              />
            ) : (
              <Pressable onPress={startEditingTitle} hitSlop={8}>
                <Text className="text-3xl font-semibold tracking-tight text-ink text-center" numberOfLines={2}>
                  {titleDraft || 'Untitled recording'}
                </Text>
              </Pressable>
            )}
          </View>

          <View className="flex-1 items-center justify-center" style={{ gap: 16 }}>
            <View className="w-[90%] max-w-xl px-2">
              <View className="h-2 rounded-full bg-[#E3E5F0]" style={{ overflow: 'hidden' }}>
                <Animated.View
                  style={{
                    width: progressAnim.current.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                    height: '100%',
                    backgroundColor: '#9DACFF',
                  }}
                />
              </View>
            </View>

            <Text className="text-4xl font-semibold" style={{ color: '#111827' }}>
              {formatDuration(positionMs)}
            </Text>
          </View>

          <View style={{ paddingHorizontal: 12, paddingBottom: bottom + 8, alignItems: 'center' }}>
            <Pressable onPress={handleTogglePlay} hitSlop={16} className="items-center">
              {({ pressed }) => (
                <>
                  <View
                    style={{
                      height: 56,
                      width: 56,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#9DACFF',
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                      shadowColor: '#000',
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 5,
                    }}
                  >
                    <IconSymbol name={isPlaying ? 'pause' : 'play.fill'} size={22} color="#ffffff" />
                  </View>
                  <Text className="mt-1 text-xs font-semibold text-ink">
                    {isPlaying ? 'Pause' : 'Play'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
