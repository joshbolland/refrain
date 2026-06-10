/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

import { colors, fontStacks } from '@refrain/design-tokens';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Avenir Next',
    serif: 'ui-serif',
    rounded: 'Avenir Next',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Avenir Next',
    serif: 'serif',
    rounded: 'Avenir Next',
    mono: 'monospace',
  },
  web: {
    sans: fontStacks.sans,
    serif: fontStacks.serif,
    rounded: fontStacks.sans,
    mono: fontStacks.mono,
  },
});

export const RefrainColors = colors;
