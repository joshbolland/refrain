'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { formatDurationSeconds, formatShortDate } from '@refrain/domain';

import { useWorkspaceStore } from '@/lib/workspace-store';

export function CollectionsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('collection');
  const {
    collections,
    createCollection,
    renameCollection,
    deleteCollection,
    collectionItems,
  } = useWorkspaceStore((state) => ({
    collections: state.collections,
    createCollection: state.createCollection,
    renameCollection: state.renameCollection,
    deleteCollection: state.deleteCollection,
    collectionItems: state.collectionItems,
  }));
  const selectedCollection = collections.find((collection) => collection.id === selectedId) ?? collections[0] ?? null;
  const items = useMemo(
    () => (selectedCollection ? collectionItems(selectedCollection.id) : []),
    [collectionItems, selectedCollection],
  );
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [renameTitle, setRenameTitle] = useState(selectedCollection?.title ?? '');
  const [renameDescription, setRenameDescription] = useState(selectedCollection?.description ?? '');

  useEffect(() => {
    if (selectedCollection && selectedCollection.id !== selectedId) {
      router.replace(`/collections?collection=${selectedCollection.id}`);
    }
  }, [router, selectedCollection, selectedId]);

  useEffect(() => {
    setRenameTitle(selectedCollection?.title ?? '');
    setRenameDescription(selectedCollection?.description ?? '');
  }, [selectedCollection?.description, selectedCollection?.id, selectedCollection?.title]);

  return (
    <section className="grid h-full min-h-[78vh] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-4 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Collections</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Organize by project</h2>
        <div className="mt-4 rounded-2xl border border-divider bg-paper p-4">
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            className="w-full rounded-2xl border border-divider bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            placeholder="New collection title"
          />
          <textarea
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            className="mt-3 min-h-[96px] w-full rounded-2xl border border-divider bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            placeholder="Optional description"
          />
          <button
            type="button"
            onClick={async () => {
              const collection = await createCollection(titleDraft, descriptionDraft);
              setTitleDraft('');
              setDescriptionDraft('');
              router.push(`/collections?collection=${collection.id}`);
            }}
            className="mt-3 rounded-full bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-accentPressed"
          >
            Create collection
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {collections.map((collection) => {
            const active = collection.id === selectedCollection?.id;
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => {
                  setRenameTitle(collection.title);
                  setRenameDescription(collection.description ?? '');
                  router.push(`/collections?collection=${collection.id}`);
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active ? 'border-accent/50 bg-accentSoft shadow-soft' : 'border-transparent bg-paper hover:border-divider'
                }`}
              >
                <p className="text-base font-semibold text-ink">{collection.title}</p>
                <p className="mt-1 text-sm text-muted/80">
                  {collection.itemCount} items • Updated {formatShortDate(collection.updatedAt)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-5 shadow-soft">
        {selectedCollection ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Contents</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{selectedCollection.title}</h2>
                <p className="mt-2 text-sm text-muted/80">
                  {selectedCollection.description || 'Keep related lyrics and recordings together for one project view.'}
                </p>

                <div className="mt-5 space-y-3">
                  {items.length ? (
                    items.map((item) => (
                      <button
                        key={`${item.type}-${item.data.id}`}
                        type="button"
                        onClick={() =>
                          router.push(
                            item.type === 'lyric'
                              ? `/library?lyric=${item.data.id}`
                              : `/recordings?recording=${item.data.id}`,
                          )
                        }
                        className="flex w-full items-center justify-between rounded-2xl border border-divider bg-paper px-4 py-4 text-left transition hover:border-accent"
                      >
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted/70">
                            {item.type === 'lyric' ? 'Lyric' : 'Recording'}
                          </p>
                          <p className="mt-1 text-base font-semibold text-ink">{item.data.title || 'Untitled'}</p>
                        </div>
                        <p className="text-sm text-muted/80">
                          {item.type === 'lyric' ? formatShortDate(item.data.updatedAt) : formatDurationSeconds(item.data.durationMs)}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-divider px-4 py-6 text-sm text-muted/80">
                      Add items from Library or Recordings to populate this collection.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-divider bg-paper p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">Edit</p>
                <input
                  value={renameTitle}
                  onChange={(event) => setRenameTitle(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-divider bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="Collection title"
                />
                <textarea
                  value={renameDescription}
                  onChange={(event) => setRenameDescription(event.target.value)}
                  className="mt-3 min-h-[140px] w-full rounded-2xl border border-divider bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="Collection description"
                />
                <button
                  type="button"
                  onClick={() => void renameCollection(selectedCollection.id, renameTitle, renameDescription)}
                  className="mt-3 rounded-full bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-accentPressed"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteCollection(selectedCollection.id);
                    router.push('/collections');
                  }}
                  className="mt-3 rounded-full border border-divider bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-red-200 hover:text-red-500"
                >
                  Delete collection
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-divider bg-paper/70 p-10 text-center text-muted/80">
            Create a collection to start organizing your lyrics and recordings.
          </div>
        )}
      </div>
    </section>
  );
}
