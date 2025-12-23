import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, SafeAreaView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '../../components/ui/icon-symbol';
import { useRefrainStore } from '../../store/useRefrainStore';
import type { RecordingItem } from '../../types/recording';

const formatDuration = (millis: number): string => {
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

const METERS_COUNT = 48;
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: {
    ...(Audio.RecordingOptionsPresets.HIGH_QUALITY.android ?? {}),
    ...({ isMeteringEnabled: true } as Record<string, unknown>),
  },
  ios: {
    ...(Audio.RecordingOptionsPresets.HIGH_QUALITY.ios ?? {}),
    ...({ isMeteringEnabled: true } as Record<string, unknown>),
  },
};

export default function RecordScreen() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const metersRef = useRef<number[]>(new Array(METERS_COUNT).fill(4));
  const [meters, setMeters] = useState<number[]>(metersRef.current);
  const addRecording = useRefrainStore((state) => state.addRecording);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const requestPermission = async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    void requestPermission();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
      }
      recordingRef.current?.stopAndUnloadAsync().catch(() => { });
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [isRecording, pulse]);

  const startTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(async () => {
      const rec = recordingRef.current;
      if (!rec) {
        return;
      }
      const status = await rec.getStatusAsync();
      if (status.isRecording || isPaused) {
        setDurationMs(status.durationMillis ?? durationMs);
      }
    }, 300);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startMetering = () => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
    }
    meterIntervalRef.current = setInterval(async () => {
      const rec = recordingRef.current;
      if (!rec) {
        return;
      }
      const status = await rec.getStatusAsync();
      if (!status.isRecording || status.metering === undefined) {
        return;
      }
      const db = status.metering;
      const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
      const height = 4 + normalized * 28;
      metersRef.current = [...metersRef.current.slice(1), height];
      setMeters(metersRef.current);
    }, 100);
  };

  const stopMetering = () => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    if (hasPermission === false) {
      Alert.alert('Microphone permission needed', 'Please enable microphone access to record.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      setDurationMs(0);
      setRecordingUri(null);
      startTimer();
      startMetering();
    } catch (error) {
      Alert.alert('Recording failed', 'Could not start recording. Please try again.');
      console.error('start recording error', error);
    }
  };

  const handlePauseRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) {
      return;
    }
    await rec.pauseAsync();
    setIsRecording(false);
    setIsPaused(true);
    stopTimer();
    stopMetering();
  };

  const handleResumeRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) {
      return;
    }
    await rec.startAsync();
    setIsRecording(true);
    setIsPaused(false);
    startTimer();
    startMetering();
  };

  const handleDiscard = async () => {
    stopTimer();
    stopMetering();
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch { }
      recordingRef.current = null;
    }
    if (recordingUri) {
      await FileSystem.deleteAsync(recordingUri, { idempotent: true });
    }
    setRecordingUri(null);
    setDurationMs(0);
    setIsRecording(false);
    setIsPaused(false);
    metersRef.current = new Array(METERS_COUNT).fill(4);
    setMeters(metersRef.current);
  };

  const handleSave = async () => {
    try {
      let finalUri = recordingUri;
      let finalDuration = durationMs;

      if (recordingRef.current) {
        stopTimer();
        stopMetering();
        const rec = recordingRef.current;
        await rec.stopAndUnloadAsync();
        const status = await rec.getStatusAsync();
        finalUri = rec.getURI() ?? null;
        finalDuration = status.durationMillis ?? durationMs;
        recordingRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        setRecordingUri(finalUri);
        setDurationMs(finalDuration);
      }

      if (!finalUri) {
        return;
      }

      const now = Date.now();
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.floor(Math.random() * 16);
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
      const title = `Idea ${new Date(now).toLocaleString()}`;
      const recording: RecordingItem = {
        id,
        title,
        createdAt: now,
        updatedAt: now,
        durationMs: finalDuration,
        uri: finalUri,
      };
      await addRecording(recording);
      router.back();
    } catch (error) {
      Alert.alert('Save failed', 'Could not finalize recording. Please try again.');
      console.error('save error', error);
    }
  };

  const waveformValues =
    meters.length > 0 && (isRecording || isPaused || recordingUri)
      ? meters
      : new Array(METERS_COUNT).fill(6);

  const primaryLabel = isRecording ? 'Pause' : isPaused ? 'Resume' : 'Start';

  return (
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
          <Text className="text-base font-semibold text-ink">Capture an idea</Text>
          <View style={{ width: 60 }} />
        </View>

        <View className="flex-1 items-center justify-center" style={{ gap: 16 }}>
          <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/80 text-center">
            {isRecording ? 'Recording…' : isPaused ? 'Paused' : 'Ready to record'}
          </Text>

          <View className="w-full items-center justify-center" style={{ height: 180 }}>
            <View className="flex-row items-center justify-center" style={{ gap: 2 }}>
              {waveformValues.map((value, index) => (
                <Animated.View
                  key={index}
                  style={{
                    width: 4,
                    height: value,
                    borderRadius: 2,
                    backgroundColor: isRecording ? '#e71d36' : '#9DACFF',
                    opacity: isRecording || isPaused ? 1 : 0.4,
                  }}
                />
              ))}
            </View>
          </View>

          <Text
            className="text-4xl font-semibold text-center"
            style={{ color: isRecording ? '#e71d36' : '#111827' }}
          >
            {formatDuration(durationMs)}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 12, paddingBottom: bottom + 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              // backgroundColor: '#ffffff',
              borderRadius: 36,
              paddingVertical: 12,
              paddingHorizontal: 18,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            <Pressable
              disabled={isRecording && !isPaused && !recordingUri}
              onPress={handleDiscard}
              hitSlop={12}
              className="items-center"
            >
              {({ pressed }) => (
                <>
                  <View
                    style={{
                      height: 48,
                      width: 48,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: '#F5B5B5',
                      backgroundColor: pressed ? '#FDECEC' : '#FFF6F6',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isRecording && !isPaused && !recordingUri ? 0.5 : 1,
                      transform: [{ translateY: pressed ? 1 : 0 }],
                    }}
                  >
                    <IconSymbol name="trash" size={20} color="#e71d36" />
                  </View>
                  <Text className="mt-1 text-xs font-semibold text-red-500">Delete</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={
                primaryLabel === 'Start'
                  ? handleStartRecording
                  : primaryLabel === 'Pause'
                    ? handlePauseRecording
                    : handleResumeRecording
              }
              hitSlop={16}
              className="items-center"
            >
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
                      shadowOpacity: 0.14,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 6,
                    }}
                  >
                    <IconSymbol
                      name={isRecording ? 'pause' : 'mic'}
                      size={22}
                      color="#ffffff"
                    />
                  </View>
                  <Text className="mt-1 text-xs font-semibold text-ink">
                    {primaryLabel === 'Pause' ? 'Pause' : primaryLabel === 'Resume' ? 'Resume' : 'Start'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              disabled={!recordingUri && !recordingRef.current}
              onPress={handleSave}
              hitSlop={12}
              className="items-center"
            >
              {({ pressed }) => (
                <>
                  <View
                    style={{
                      height: 48,
                      width: 48,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: '#C7D1FF',
                      backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: recordingUri || recordingRef.current ? 1 : 0.5,
                      transform: [{ translateY: pressed ? 1 : 0 }],
                    }}
                  >
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#7C8FFF" />
                  </View>
                  <Text className="mt-1 text-xs font-semibold text-ink">Save</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
