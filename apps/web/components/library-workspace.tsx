'use client';

import { getRhymes } from '@refrain/editor-core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useWorkspaceStore } from '@/lib/workspace-store';

const wordAtPosition = (text: string, position: number): string | null => {
  const left = text.slice(0, position).match(/[A-Za-z']+$/)?.[0] ?? '';
  const right = text.slice(position).match(/^[A-Za-z']+/)?.[0] ?? '';
  const word = `${left}${right}`.trim().toLowerCase();
  return word.length > 0 ? word : null;
};

export function LibraryWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('lyric');
  const {
    files,
    collections,
    isLoading,
    createLyric,
    deleteLyric,
    updateLyric,
    collectionIdsForItem,
    toggleItemCollection,
  } = useWorkspaceStore((state) => ({
    files: state.files,
    collections: state.collections,
    isLoading: state.isLoading,
    createLyric: state.createLyric,
    deleteLyric: state.deleteLyric,
    updateLyric: state.updateLyric,
    collectionIdsForItem: state.collectionIdsForItem,
    toggleItemCollection: state.toggleItemCollection,
  }));
  const selectedFile = files.find((file) => file.id === selectedId) ?? files[0] ?? null;
  const [titleDraft, setTitleDraft] = useState(selectedFile?.title ?? '');
  const [bodyDraft, setBodyDraft] = useState(selectedFile?.body ?? '');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile && selectedFile.id !== selectedId) {
      router.replace(`/library?lyric=${selectedFile.id}`);
    }
  }, [router, selectedFile, selectedId]);

  useEffect(() => {
    setTitleDraft(selectedFile?.title ?? '');
    setBodyDraft(selectedFile?.body ?? '');
    setSelectedWord(null);
  }, [selectedFile?.body, selectedFile?.id, selectedFile?.title]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }
    const timer = setTimeout(() => {
      if (titleDraft !== selectedFile.title || bodyDraft !== selectedFile.body) {
        void updateLyric(selectedFile.id, { title: titleDraft, body: bodyDraft });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [bodyDraft, selectedFile, titleDraft, updateLyric]);

  const selectedCollectionIds = selectedFile ? collectionIdsForItem('lyric', selectedFile.id) : [];
  const rhymes = useMemo(() => (selectedWord ? getRhymes(selectedWord) : []), [selectedWord]);

  return (
    <section className="grid h-full min-h-[78vh] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Library</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Lyrics</h2>
          </div>
          <button
            type="button"
            onClick={async () => {
              const lyric = await createLyric();
              router.push(`/library?lyric=${lyric.id}`);
            }}
            className="rounded-full bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-accentPressed"
          >
            New lyric
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {files.map((file) => {
            const active = file.id === selectedFile?.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => router.push(`/library?lyric=${file.id}`)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active ? 'border-accent/50 bg-accentSoft shadow-soft' : 'border-transparent bg-paper hover:border-divider'
                }`}
              >
                <p className="text-base font-semibold text-ink">{file.title || 'Untitled'}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted/75">{file.body || 'Start writing your lyric here.'}</p>
              </button>
            );
          })}
          {!files.length && !isLoading ? (
            <div className="rounded-2xl border border-dashed border-divider px-4 py-6 text-sm text-muted/80">
              Create your first lyric to start writing on desktop.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-5 shadow-soft">
        {selectedFile ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Editor</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">Write without leaving the library</h2>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await deleteLyric(selectedFile.id);
                  router.push('/library');
                }}
                className="rounded-full border border-divider bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-red-200 hover:text-red-500"
              >
                Delete
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-2xl font-semibold text-ink outline-none transition focus:border-accent"
                placeholder="Untitled lyric"
              />

              <textarea
                value={bodyDraft}
                onChange={(event) => setBodyDraft(event.target.value)}
                onSelect={(event) => {
                  const position = event.currentTarget.selectionStart ?? 0;
                  setSelectedWord(wordAtPosition(bodyDraft, position));
                }}
                className="min-h-[520px] w-full rounded-[24px] border border-divider bg-[#fbfbf8] px-5 py-5 font-mono text-[15px] leading-7 text-ink outline-none transition focus:border-accent"
                placeholder="Draft your lyric here..."
              />
            </div>

            <div className="mt-4 rounded-2xl border border-divider/70 bg-paper px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">Collections</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {collections.map((collection) => {
                  const checked = selectedCollectionIds.includes(collection.id);
                  return (
                    <label
                      key={collection.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                        checked ? 'border-accent/50 bg-accentSoft text-ink' : 'border-divider bg-white text-muted'
                      }`}
                    >
                      <input
                        checked={checked}
                        onChange={() => void toggleItemCollection('lyric', selectedFile.id, collection.id)}
                        type="checkbox"
                      />
                      {collection.title}
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-divider bg-paper/70 p-10 text-center text-muted/80">
            Choose a lyric from the library to start editing.
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-4 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Rhyme</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Quick lookup</h2>
        <p className="mt-2 text-sm text-muted/80">
          Click inside the editor and move your caret through a word to surface phonetic rhyme matches.
        </p>
        <div className="mt-4 rounded-2xl border border-divider bg-paper px-4 py-4">
          <p className="text-sm font-semibold text-ink">{selectedWord ? `"${selectedWord}"` : 'No word selected yet'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {rhymes.length ? (
              rhymes.map((rhyme) => (
                <span
                  key={rhyme}
                  className="rounded-full border border-divider bg-white px-3 py-1 text-sm text-muted"
                >
                  {rhyme}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted/75">Select a word in the editor to see rhyme suggestions.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
