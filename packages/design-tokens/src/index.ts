export const colors = {
  ink: '#111827',
  muted: '#374151',
  paper: '#ffffff',
  panel: '#eef0ff',
  accent: '#9dacff',
  accentPressed: '#7c8fff',
  accentSoft: '#eef0ff',
  divider: '#e5e7eb',
  canvas: '#fafaf7',
  danger: '#e71d36',
  success: '#1f9d55',
} as const;

export const radii = {
  card: 24,
  pill: 999,
  input: 16,
  shell: 32,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const shadows = {
  soft: '0 18px 40px rgba(17, 24, 39, 0.08)',
  float: '0 24px 60px rgba(17, 24, 39, 0.12)',
} as const;

export const fontStacks = {
  sans: "'Avenir Next', 'Segoe UI', sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', serif",
  mono: "'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

export const assets = {
  splash: 'splash.jpg',
  favicon: 'favicon.png',
  icon: 'icon.png',
} as const;
