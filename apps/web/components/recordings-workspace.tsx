'use client';

import { recordingNeedsRepair } from '@refrain/domain';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { formatDurationClock, formatDurationSeconds, formatShortDate } from '@refrain/domain';

import { useWorkspaceStore } from '@/lib/workspace-store';

export function RecordingsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('recording');
  const {
    recordings,
    collections,
    createRecordingFromBlob,
    updateRecordingTitle,
    deleteRecording,
    toggleItemCollection,
    collectionIdsForItem,
    resolveRecordingUrl,
  } = useWorkspaceStore((state) => ({
    recordings: state.recordings,
    collections: state.collections,
    createRecordingFromBlob: state.createRecordingFromBlob,
    updateRecordingTitle: state.updateRecordingTitle,
    deleteRecording: state.deleteRecording,
    toggleItemCollection: state.toggleItemCollection,
    collectionIdsForItem: state.collectionIdsForItem,
    resolveRecordingUrl: state.resolveRecordingUrl,
  }));
  const selectedRecording = recordings.find((recording) => recording.id === selectedId) ?? recordings[0] ?? null;
  const selectedCollectionIds = selectedRecording
    ? collectionIdsForItem('recording', selectedRecording.id)
    : [];

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [titleDraft, setTitleDraft] = useState(selectedRecording?.title ?? '');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (selectedRecording && selectedRecording.id !== selectedId) {
      router.replace(`/recordings?recording=${selectedRecording.id}`);
    }
  }, [router, selectedId, selectedRecording]);

  useEffect(() => {
    setTitleDraft(selectedRecording?.title ?? '');
  }, [selectedRecording?.id, selectedRecording?.title]);

  useEffect(() => {
    let active = true;
    if (!selectedRecording) {
      setPlaybackUrl(null);
      return;
    }

    const load = async () => {
      try {
        const url = await resolveRecordingUrl(selectedRecording);
        if (active) {
          setPlaybackUrl(url);
        }
      } catch (error) {
        if (active) {
          setRecorderError(error instanceof Error ? error.message : 'Could not load recording playback.');
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [resolveRecordingUrl, selectedRecording]);

  const supportsRecording = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
  const recordingCountLabel = useMemo(() => `${recordings.length} recordings synced`, [recordings.length]);

  const startRecording = async () => {
    if (!supportsRecording) {
      setRecorderError('This browser does not support audio capture.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        const durationMs = Date.now() - (startedAtRef.current ?? Date.now());
        if (blob.size > 0) {
          setIsCreating(true);
          try {
            const created = await createRecordingFromBlob(blob, durationMs);
            router.push(`/recordings?recording=${created.id}`);
          } catch (error) {
            setRecorderError(error instanceof Error ? error.message : 'Could not save recording.');
          } finally {
            setIsCreating(false);
          }
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
      };
      mediaRecorder.start();
      setRecorderError(null);
      setIsRecording(true);
    } catch (error) {
      setRecorderError(error instanceof Error ? error.message : 'Microphone access failed.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      return;
    }
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <section className="grid h-full min-h-[78vh] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-4 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Recordings</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Capture and sync</h2>
        <p className="mt-2 text-sm text-muted/80">{recordingCountLabel}</p>

        <div className="mt-4 rounded-[24px] border border-divider bg-paper p-4">
          <p className="text-sm font-semibold text-ink">Browser recorder</p>
          <p className="mt-2 text-sm text-muted/80">
            New web recordings upload immediately so playback works on both mobile and web.
          </p>
          <button
            type="button"
            onClick={() => void (isRecording ? stopRecording() : startRecording())}
            disabled={isCreating}
            className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-accentPressed disabled:opacity-60"
          >
            {isCreating ? 'Saving…' : isRecording ? 'Stop recording' : 'Start recording'}
          </button>
          {recorderError ? <p className="mt-3 text-sm text-red-500">{recorderError}</p> : null}
        </div>

        <div className="mt-4 space-y-2">
          {recordings.map((recording) => {
            const active = recording.id === selectedRecording?.id;
            return (
              <button
                key={recording.id}
                type="button"
                onClick={() => router.push(`/recordings?recording=${recording.id}`)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active ? 'border-accent/50 bg-accentSoft shadow-soft' : 'border-transparent bg-paper hover:border-divider'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink">{recording.title || 'Untitled recording'}</p>
                    <p className="mt-1 text-sm text-muted/75">
                      {recordingNeedsRepair(recording)
                        ? 'Needs repair before web playback works everywhere.'
                        : `Saved ${formatShortDate(recording.updatedAt)}`}
                    </p>
                  </div>
                  <span className="text-sm text-muted/75">{formatDurationSeconds(recording.durationMs)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-divider/70 bg-white/80 p-5 shadow-soft">
        {selectedRecording ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted/70">Playback</p>
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => void updateRecordingTitle(selectedRecording.id, titleDraft)}
                className="mt-3 w-full rounded-2xl border border-divider bg-paper px-4 py-3 text-2xl font-semibold text-ink outline-none transition focus:border-accent"
              />

              {recordingNeedsRepair(selectedRecording) ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-800">Legacy recording requires repair</p>
                  <p className="mt-2 text-sm text-amber-800/85">
                    This recording was created before cloud media sync. Web keeps it visible, but playback depends on
                    the source mobile device repairing the upload.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 rounded-[24px] border border-divider bg-paper p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">Audio</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{formatDurationClock(selectedRecording.durationMs)}</p>
                {playbackUrl ? (
                  <audio className="mt-4 w-full" controls src={playbackUrl} />
                ) : (
                  <p className="mt-4 text-sm text-muted/80">Playback will appear here once the recording is available.</p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-divider bg-paper p-4">
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
                        onChange={() => void toggleItemCollection('recording', selectedRecording.id, collection.id)}
                        type="checkbox"
                      />
                      {collection.title}
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={async () => {
                  await deleteRecording(selectedRecording.id);
                  router.push('/recordings');
                }}
                className="mt-6 rounded-full border border-divider bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-red-200 hover:text-red-500"
              >
                Delete recording
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-divider bg-paper/70 p-10 text-center text-muted/80">
            Record or select an item to preview playback and manage collections.
          </div>
        )}
      </div>
    </section>
  );
}
