/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        muted: '#374151',
        paper: '#ffffff',
        panel: '#eef0ff',
        accent: '#9dacff',
        accentPressed: '#7c8fff',
        accentSoft: '#eef0ff',
        divider: '#e5e7eb',
      },
    },
  },
  plugins: [],
};
