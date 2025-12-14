import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

export type SectionPickerOption = 'verse' | 'chorus' | 'bridge' | 'other' | 'repeat-chorus';

interface SectionPickerProps {
  top: number;
  width: number;
  onSelect(option: SectionPickerOption): void;
  onDismiss(): void;
  hasChorus: boolean;
}

const LABELS: Record<SectionPickerOption, string> = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  other: 'Other',
  'repeat-chorus': 'Repeat Chorus',
};

export const SectionPicker = ({ top, width, onSelect, onDismiss, hasChorus }: SectionPickerProps) => {
  const translate = useRef(new Animated.Value(-6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, bounciness: 2, speed: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [opacity, translate]);

  const options = useMemo(() => {
    const base: SectionPickerOption[] = ['verse', 'chorus', 'bridge', 'other'];
    if (hasChorus) {
      base.push('repeat-chorus');
    }
    return base;
  }, [hasChorus]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        left: 0,
        width,
        opacity,
        transform: [{ translateY: translate }],
      }}
    >
      <View
        className="self-start rounded-lg bg-white px-3 py-2 shadow-sm"
        style={{
          borderColor: '#9DACFF',
          borderWidth: 1,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] uppercase tracking-[0.14em] text-accent">New section</Text>
          <Pressable hitSlop={12} onPress={onDismiss}>
            <Text className="text-xs text-muted/70">Skip</Text>
          </Pressable>
        </View>
        <View className="mt-2 flex-row flex-wrap">
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              className="mr-2 mb-2 rounded-full bg-[#EEF0FF] px-3 py-1.5"
              style={({ pressed }) => ({
                transform: [{ translateY: pressed ? 1 : 0 }],
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                {LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};
