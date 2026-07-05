/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/*/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: 'var(--rf-color-ink)',
        muted: 'var(--rf-color-muted)',
        paper: 'var(--rf-color-paper)',
        panel: 'var(--rf-color-panel)',
        accent: 'var(--rf-color-accent)',
        accentPressed: 'var(--rf-color-accent-pressed)',
        accentSoft: 'var(--rf-color-accent-soft)',
        divider: 'var(--rf-color-divider)',
        canvas: 'var(--rf-color-canvas)',
        header: 'var(--rf-color-header)',
        headerTitle: 'var(--rf-color-header-title)',
        headerSubtitle: 'var(--rf-color-header-subtitle)',
        danger: 'var(--rf-color-danger)',
      },
      boxShadow: {
        soft: 'var(--rf-shadow-soft)',
        float: 'var(--rf-shadow-float)',
      },
      borderRadius: {
        shell: 'var(--rf-radius-shell)',
      },
      fontFamily: {
        sans: ['var(--rf-font-sans)'],
        serif: ['var(--rf-font-serif)'],
        mono: ['var(--rf-font-mono)'],
      },
    },
  },
  plugins: [],
};
