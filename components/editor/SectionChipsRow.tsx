import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text } from 'react-native';

import type { SectionType } from '../../types/lyricFile';

type ChipOption = { value: SectionType; label: string };

type SectionChipsRowProps = {
  activeType: SectionType | null;
  mode: 'edit' | 'new';
  startLineIndex: number;
  onSelect(type: SectionType): void;
};

const CHIP_OPTIONS: ChipOption[] = [
  { value: 'verse', label: 'Verse' },
  { value: 'chorus', label: 'Chorus' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'pre-chorus', label: 'Pre-chorus' },
  { value: 'intro', label: 'Intro' },
  { value: 'outro', label: 'Outro' },
  { value: 'other', label: 'Other' },
];

export const SECTION_TYPE_COLORS: Record<SectionType, { accent: string; tint: string }> = {
  verse: { accent: '#9DACFF', tint: '#EEF0FF' },
  chorus: { accent: '#F4C95D', tint: '#FFF4D6' },
  bridge: { accent: '#4CC9B0', tint: '#D9FBF4' },
  'pre-chorus': { accent: '#FF9F8A', tint: '#FFE6E0' },
  intro: { accent: '#65B9FF', tint: '#E0F2FF' },
  outro: { accent: '#B79BFF', tint: '#F0E9FF' },
  other: { accent: '#9CA3AF', tint: '#F3F4F6' },
};

export const SectionChipsRow = ({
  activeType,
  mode,
  startLineIndex,
  onSelect,
}: SectionChipsRowProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
    ]).start();
  }, [opacity, translate]);

  const options = useMemo(() => {
    if (mode === 'edit' && activeType) {
      return CHIP_OPTIONS.filter((option) => option.value !== activeType);
    }
    return CHIP_OPTIONS;
  }, [activeType, mode]);

  if (options.length === 0) {
    return null;
  }

  return (
    <Animated.View
      className={mode === 'edit' ? 'ml-3' : undefined}
      pointerEvents="auto"
      style={{ opacity, transform: [{ translateX: translate }] }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}
      >
        {options.map(({ value, label }) => {
          const colors = SECTION_TYPE_COLORS[value];
          const isActive = activeType === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                onSelect(value);
              }}
              className="rounded-full px-3 py-1.5"
              style={({ pressed }) => ({
                backgroundColor: isActive ? colors.accent : colors.tint,
                borderColor: colors.accent,
                borderWidth: isActive ? 1.5 : 1,
                opacity: pressed ? 0.9 : 1,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Text
                className="text-[12px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  color: isActive ? '#FFFFFF' : colors.accent,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
};
