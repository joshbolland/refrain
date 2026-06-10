/** @type {import('tailwindcss').Config} */
const { colors } = require('@refrain/design-tokens');

module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/*/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: colors.ink,
        muted: colors.muted,
        paper: colors.paper,
        panel: colors.panel,
        accent: colors.accent,
        accentPressed: colors.accentPressed,
        accentSoft: colors.accentSoft,
        divider: colors.divider,
      },
    },
  },
  plugins: [],
};
