export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'refrain-theme-v1';
export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' =>
  preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
