# Refrain

A cross-platform lyric-writing scaffold (Expo Router + NativeWind + Zustand) with syllable counts, rhyme highlights, and an offline rhyming panel.

## Running locally
- Install deps: `npm install`
- Start dev server: `npx expo start` (press `i` for iOS simulator, `w` for web)
- Run tests: `npm test`

## Architecture
- **Routing**: Expo Router with `/files`, `/files/[id]`, and `/files/new`. Desktop (`>=1024px`) uses a split pane (file list + editor); mobile splits into list/detail screens.
- **State**: `store/useRefrainStore` (Zustand) holds files, selection, search query, and editor metadata with debounced autosave.
- **Storage**: Repository abstraction in `lib/repo/lyricRepo.*` (expo-sqlite on native, IndexedDB via `idb` on web). Sorting is most-recently updated first; `clearAll` is available for tests/dev.
- **Analysis pipeline**: `analysis/parse` tags section headers (`[Verse]` style) and annotations (`//`), `analysis/syllables` counts syllables, and `analysis/rhymes` groups end-of-line words for highlights.
- **Rhymes**: Offline CMUdict-based phonetic lookup in `lib/rhyme/dictionary.ts` with `getRhymes` helper feeding the side panel.
- **UI**: NativeWind styling; gutters show line numbers, syllable counts, and rhyme color markers. The rhyme panel toggles in the editor and supports copy-to-clipboard suggestions.

## Notes
- App name is “Refrain”. No auth/back-end; everything stays local.
- Works on web and iOS via `npx expo start` (web with `w`, iOS with `i`).

## Rebuilding the rhyme dictionary
- Source data: `data/cmudict.txt` (CMU Pronouncing Dictionary, public domain).
- Generate the compact lookup tables: `npm run build:dict` (writes `lib/rhyme/cmudict.compact.json`).
