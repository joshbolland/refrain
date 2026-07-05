'use client';

import {
  formatDurationClock,
  formatDurationSeconds,
  formatShortDate,
  recordingNeedsRepair,
  type RecordingItem,
  type SectionType,
} from '@refrain/domain';
import { cleanupSectionTypes, ensureDefaultSectionTypes, getRhymes, getValidSectionStartSet } from '@refrain/editor-core';
import { Download, FileImage, FolderKanban, Mic2, Music, PanelRight, Plus, Radio, Search, Square, Trash2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspaceStore } from '@/lib/workspace-store';

import {
  AppFrame,
  HeaderBand,
  NativeListRow,
  Pane,
  SegmentedControl,
  TextActionButton,
  ToolbarIconButton,
  cx,
} from './workspace-primitives';

type InspectorTab = 'rhymes' | 'syllables' | 'projects';
type LibraryFilter = 'all' | 'lyrics' | 'recordings';
type SelectedLibraryItem =
  | { type: 'lyric'; id: string }
  | { type: 'recording'; id: string }
  | null;

const sectionOptions: { type: SectionType; label: string }[] = [
  { type: 'verse', label: 'Verse' },
  { type: 'pre-chorus', label: 'Pre' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'bridge', label: 'Bridge' },
  { type: 'intro', label: 'Intro' },
  { type: 'outro', label: 'Outro' },
  { type: 'other', label: 'Other' },
];

const sectionClasses: Record<SectionType, string> = {
  verse: 'border-[#9DACFF] bg-[#EEF0FF] text-[#4B5FD6]',
  chorus: 'border-[#F4C95D] bg-[#FFF4D6] text-[#8A6516]',
  bridge: 'border-[#4CC9B0] bg-[#D9FBF4] text-[#167565]',
  'pre-chorus': 'border-[#FF9F8A] bg-[#FFE6E0] text-[#A64632]',
  intro: 'border-[#65B9FF] bg-[#E0F2FF] text-[#1E70AA]',
  outro: 'border-[#B79BFF] bg-[#F0E9FF] text-[#6240B2]',
  other: 'border-[#9CA3AF] bg-[#F3F4F6] text-[#4B5563]',
};

const wordAtPosition = (text: string, position: number): string | null => {
  const left = text.slice(0, position).match(/[A-Za-z']+$/)?.[0] ?? '';
  const right = text.slice(position).match(/^[A-Za-z']+/)?.[0] ?? '';
  const word = `${left}${right}`.trim().toLowerCase();
  return word.length > 0 ? word : null;
};

const lineAtPosition = (text: string, position: number): number => text.slice(0, position).split('\n').length - 1;

const countSyllables = (line: string): number => {
  const words = line.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.reduce((total, word) => {
    const groups = word.replace(/e$/, '').match(/[aeiouy]+/g);
    return total + Math.max(1, groups?.length ?? 0);
  }, 0);
};

const downloadText = (title: string, body: string) => {
  const safeTitle = (title.trim() || 'Untitled').replace(/[/\\?%*|"<>:]/g, '-');
  const blob = new Blob([`${title.trim() || 'Untitled'}${body.trim() ? `\n\n${body}` : ''}`], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function LibraryWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('lyric');
  const selectedRecordingId = searchParams.get('recording');
  const shouldCapture = searchParams.get('capture') === '1';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [sectionDraft, setSectionDraft] = useState<Record<number, SectionType>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('rhymes');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recordingTitleDraft, setRecordingTitleDraft] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const [isCreatingRecording, setIsCreatingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const {
    files,
    recordings,
    projects,
    isLoading,
    createLyric,
    deleteLyric,
    updateLyric,
    createRecordingFromBlob,
    updateRecordingTitle,
    deleteRecording,
    resolveRecordingUrl,
    projectIdsForItem,
    toggleItemProject,
  } = useWorkspaceStore((state) => ({
    files: state.files,
    recordings: state.recordings,
    projects: state.projects,
    isLoading: state.isLoading,
    createLyric: state.createLyric,
    deleteLyric: state.deleteLyric,
    updateLyric: state.updateLyric,
    createRecordingFromBlob: state.createRecordingFromBlob,
    updateRecordingTitle: state.updateRecordingTitle,
    deleteRecording: state.deleteRecording,
    resolveRecordingUrl: state.resolveRecordingUrl,
    projectIdsForItem: state.projectIdsForItem,
    toggleItemProject: state.toggleItemProject,
  }));

  const filteredFiles = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return files;
    }
    return files.filter(
      (file) => file.title.toLowerCase().includes(trimmed) || file.body.toLowerCase().includes(trimmed),
    );
  }, [files, query]);

  const filteredRecordings = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return recordings;
    }
    return recordings.filter((recording) => recording.title.toLowerCase().includes(trimmed));
  }, [query, recordings]);

  const visibleItems = useMemo(
    () =>
      [
        ...(filter !== 'recordings'
          ? filteredFiles.map((file) => ({ type: 'lyric' as const, id: file.id, updatedAt: file.updatedAt, data: file }))
          : []),
        ...(filter !== 'lyrics'
          ? filteredRecordings.map((recording) => ({
              type: 'recording' as const,
              id: recording.id,
              updatedAt: recording.updatedAt,
              data: recording,
            }))
          : []),
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    [filter, filteredFiles, filteredRecordings],
  );

  const selectedItem: SelectedLibraryItem = selectedRecordingId
    ? { type: 'recording', id: selectedRecordingId }
    : selectedId
      ? { type: 'lyric', id: selectedId }
      : visibleItems[0]
        ? { type: visibleItems[0].type, id: visibleItems[0].id }
        : null;
  const selectedFile =
    selectedItem?.type === 'lyric'
      ? files.find((file) => file.id === selectedItem.id) ?? filteredFiles[0] ?? null
      : null;
  const selectedRecording =
    selectedItem?.type === 'recording'
      ? recordings.find((recording) => recording.id === selectedItem.id) ?? filteredRecordings[0] ?? null
      : null;
  const lines = bodyDraft.split('\n');
  const validSectionStarts = useMemo(() => getValidSectionStartSet(bodyDraft), [bodyDraft]);
  const selectedProjectIds = selectedFile ? projectIdsForItem('lyric', selectedFile.id) : [];
  const selectedRecordingProjectIds = selectedRecording ? projectIdsForItem('recording', selectedRecording.id) : [];
  const rhymes = useMemo(() => (selectedWord ? getRhymes(selectedWord).slice(0, 30) : []), [selectedWord]);
  const currentLineSyllables = countSyllables(lines[currentLine] ?? '');
  const totalSyllables = lines.reduce((total, line) => total + countSyllables(line), 0);
  const itemCount = files.length + recordings.length;
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'idea' : 'ideas'}`;
  const supportsRecording = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  useEffect(() => {
    if (!selectedId && !selectedRecordingId && selectedItem) {
      router.replace(selectedItem.type === 'lyric' ? `/library?lyric=${selectedItem.id}` : `/library?recording=${selectedItem.id}`);
      return;
    }
    if (selectedFile && selectedFile.id !== selectedId) {
      router.replace(`/library?lyric=${selectedFile.id}`);
    }
    if (selectedRecording && selectedRecording.id !== selectedRecordingId) {
      router.replace(`/library?recording=${selectedRecording.id}`);
    }
  }, [router, selectedFile, selectedId, selectedItem, selectedRecording, selectedRecordingId]);

  useEffect(() => {
    setTitleDraft(selectedFile?.title ?? '');
    setBodyDraft(selectedFile?.body ?? '');
    setSectionDraft(selectedFile?.sectionTypes ?? {});
    setSelectedWord(null);
    setCurrentLine(0);
  }, [selectedFile?.body, selectedFile?.id, selectedFile?.sectionTypes, selectedFile?.title]);

  useEffect(() => {
    setRecordingTitleDraft(selectedRecording?.title ?? '');
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

  useEffect(() => {
    if (!selectedFile) {
      return;
    }
    const timer = setTimeout(() => {
      const nextSections = cleanupSectionTypes(bodyDraft, ensureDefaultSectionTypes(bodyDraft, sectionDraft));
      if (
        titleDraft !== selectedFile.title ||
        bodyDraft !== selectedFile.body ||
        JSON.stringify(nextSections) !== JSON.stringify(selectedFile.sectionTypes ?? {})
      ) {
        void updateLyric(selectedFile.id, { title: titleDraft, body: bodyDraft, sectionTypes: nextSections });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [bodyDraft, sectionDraft, selectedFile, titleDraft, updateLyric]);

  const setSectionType = (lineIndex: number, type: SectionType) => {
    setSectionDraft((current) => cleanupSectionTypes(bodyDraft, { ...current, [lineIndex]: type }));
  };

  const handleOcrFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    setImportError(null);
    setIsRecognizing(true);
    try {
      const { recognize } = await import('tesseract.js');
      const result = await recognize(file, 'eng');
      setImportText(result.data.text.trim());
      setImportTitle(importTitle || file.name.replace(/\.[^.]+$/, ''));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read text from that image.');
    } finally {
      setIsRecognizing(false);
    }
  };

  const createFromImport = async () => {
    const lyric = await createLyric();
    await updateLyric(lyric.id, {
      title: importTitle.trim() || 'Imported lyric',
      body: importText,
      sectionTypes: cleanupSectionTypes(importText, ensureDefaultSectionTypes(importText, {})),
    });
    setImportOpen(false);
    setImportTitle('');
    setImportText('');
    router.push(`/library?lyric=${lyric.id}`);
  };

  const createBlankLyric = async () => {
    const lyric = await createLyric();
    router.push(`/library?lyric=${lyric.id}`);
  };

  const startRecording = async () => {
    if (!supportsRecording) {
      setRecorderError('This browser does not support audio capture. Use a current Chromium, Safari, or Firefox release.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError('Microphone access is not available in this browser context.');
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
          setIsCreatingRecording(true);
          try {
            const created = await createRecordingFromBlob(blob, durationMs);
            setFilter('all');
            router.push(`/library?recording=${created.id}`);
          } catch (error) {
            setRecorderError(error instanceof Error ? error.message : 'Could not save recording.');
          } finally {
            setIsCreatingRecording(false);
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
      setRecorderError(error instanceof Error ? error.message : 'Microphone permission or capture failed.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      return;
    }
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    if (!shouldCapture || isRecording || isCreatingRecording) {
      return;
    }
    void startRecording();
    router.replace('/library');
  }, [isCreatingRecording, isRecording, router, shouldCapture]);

  const inspector = (
    <LyricInspector
      currentLineSyllables={currentLineSyllables}
      inspectorTab={inspectorTab}
      projects={projects}
      rhymes={rhymes}
      selectedFileId={selectedFile?.id ?? null}
      selectedProjectIds={selectedProjectIds}
      selectedWord={selectedWord}
      setInspectorTab={setInspectorTab}
      toggleItemProject={toggleItemProject}
      totalSyllables={totalSyllables}
    />
  );

  return (
    <AppFrame>
      <HeaderBand
        eyebrow="Library"
        title="Library"
        subtitle={query.trim() ? `Showing results for "${query.trim()}"` : 'Write, scan, and organize song ideas.'}
        meta={<span className="pb-1 text-sm font-semibold text-headerSubtitle">{itemCountLabel}</span>}
        actions={
          <>
            <TextActionButton onClick={() => setImportOpen(true)}>
              <FileImage size={15} />
              Import
            </TextActionButton>
            <TextActionButton onClick={() => void createBlankLyric()} variant="primary">
              <Plus size={15} />
              New lyric
            </TextActionButton>
            <TextActionButton
              onClick={() => void (isRecording ? stopRecording() : startRecording())}
              disabled={isCreatingRecording}
              variant={isRecording ? 'danger' : 'secondary'}
            >
              {isRecording ? <Square size={14} /> : <Mic2 size={15} />}
              {isCreatingRecording ? 'Saving' : isRecording ? 'Stop' : 'Record'}
            </TextActionButton>
            <ToolbarIconButton
              icon={PanelRight}
              label="Inspector"
              onClick={() => setInspectorOpen(true)}
              variant="secondary"
            />
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-b border-divider bg-paper lg:grid-cols-[292px_minmax(0,1fr)] 2xl:grid-cols-[292px_minmax(0,1fr)_308px]">
        <Pane className="border-b lg:border-b-0 lg:border-r" scroll>
          <div className="sticky top-0 z-10 border-b border-divider bg-paper/95 px-4 py-3 backdrop-blur">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-divider bg-white px-3 text-sm text-muted transition focus-within:border-accent">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none"
                placeholder="Search library"
              />
            </label>
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              className="mt-3 grid-cols-3"
              options={[
                { value: 'all', label: 'All' },
                { value: 'lyrics', label: 'Lyrics' },
                { value: 'recordings', label: 'Audio' },
              ]}
            />
            {recorderError ? (
              <p className="mt-3 rounded-xl border border-danger/25 bg-red-50 px-3 py-2 text-sm leading-5 text-danger">
                {recorderError}
              </p>
            ) : null}
          </div>

          <div className="space-y-1 px-3 py-3">
            {visibleItems.map((item) => {
              if (item.type === 'recording') {
                const recording = item.data;
                return (
                  <NativeListRow
                    key={`recording-${recording.id}`}
                    active={recording.id === selectedRecording?.id}
                    icon={<Radio size={17} />}
                    meta={formatDurationSeconds(recording.durationMs)}
                    onClick={() => router.push(`/library?recording=${recording.id}`)}
                    subtitle={
                      recordingNeedsRepair(recording)
                        ? 'Needs repair before web playback works everywhere.'
                        : `Saved ${formatShortDate(recording.updatedAt)}`
                    }
                    title={recording.title || 'Untitled recording'}
                  />
                );
              }
              const file = item.data;
              return (
                <NativeListRow
                  key={`lyric-${file.id}`}
                  active={file.id === selectedFile?.id}
                  icon={<Music size={17} />}
                  onClick={() => router.push(`/library?lyric=${file.id}`)}
                  subtitle={file.body || 'Start writing your lyric here.'}
                  title={file.title || 'Untitled'}
                />
              );
            })}
            {!itemCount && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-divider px-4 py-6 text-sm leading-6 text-muted/80">
                Create a lyric, import a scan, or record your first idea.
              </div>
            ) : null}
            {itemCount > 0 && !visibleItems.length ? (
              <div className="rounded-2xl border border-dashed border-divider px-4 py-6 text-sm leading-6 text-muted/80">
                No library items match this view.
              </div>
            ) : null}
          </div>
        </Pane>

        <Pane className="overflow-hidden bg-[#fbfbf8]">
          {selectedFile ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-divider bg-paper px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-divider bg-canvas px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted/75">
                    Autosaves
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectorTab('rhymes');
                        setInspectorOpen(true);
                      }}
                      className={cx(
                        'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition',
                        inspectorTab === 'rhymes'
                          ? 'border-accent/50 bg-accentSoft text-accentPressed'
                          : 'border-divider bg-paper text-muted hover:text-ink',
                      )}
                    >
                      Rhymes
                    </button>
                    <ToolbarIconButton
                      icon={Download}
                      label="Export lyric"
                      onClick={() => downloadText(titleDraft, bodyDraft)}
                    />
                    <ToolbarIconButton
                      icon={Trash2}
                      label="Delete lyric"
                      onClick={async () => {
                        await deleteLyric(selectedFile.id);
                        router.push('/library');
                      }}
                      variant="danger"
                    />
                  </div>
                </div>
                <input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  className="mt-3 w-full border-0 border-b border-accent/60 bg-transparent px-2 pb-3 text-center text-[28px] font-semibold leading-tight text-ink outline-none"
                  placeholder="Untitled lyric"
                />
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[82px_minmax(0,1fr)] overflow-hidden">
                <div className="border-r border-divider bg-paper/78 py-4 font-mono text-xs text-muted/65">
                  {lines.map((line, index) => {
                    const type = sectionDraft[index] ?? (index === 0 ? 'verse' : undefined);
                    return (
                      <div key={`${index}-${line}`} className="flex h-8 items-center justify-between gap-1 px-2">
                        <span className={index === currentLine ? 'font-semibold text-ink' : ''}>{index + 1}</span>
                        {validSectionStarts.has(index) ? (
                          <select
                            value={type ?? 'verse'}
                            onChange={(event) => setSectionType(index, event.target.value as SectionType)}
                            className={`max-w-[54px] rounded-md border px-1 py-0.5 text-[10px] font-semibold outline-none ${
                              sectionClasses[type ?? 'verse']
                            }`}
                          >
                            {sectionOptions.map((option) => (
                              <option key={option.type} value={option.type}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <textarea
                  value={bodyDraft}
                  onChange={(event) => {
                    const nextBody = event.target.value;
                    setBodyDraft(nextBody);
                    setSectionDraft((current) =>
                      cleanupSectionTypes(nextBody, ensureDefaultSectionTypes(nextBody, current)),
                    );
                  }}
                  onSelect={(event) => {
                    const position = event.currentTarget.selectionStart ?? 0;
                    setCurrentLine(lineAtPosition(bodyDraft, position));
                    setSelectedWord(wordAtPosition(bodyDraft, position));
                  }}
                  className="h-full min-h-0 resize-none overflow-y-auto border-0 bg-transparent px-7 py-5 font-mono text-[15px] leading-8 text-ink outline-none"
                  placeholder="Draft your lyric here..."
                />
              </div>
            </div>
          ) : selectedRecording ? (
            <RecordingDetail
              deleteRecording={deleteRecording}
              playbackUrl={playbackUrl}
              projects={projects}
              recording={selectedRecording}
              selectedProjectIds={selectedRecordingProjectIds}
              titleDraft={recordingTitleDraft}
              setTitleDraft={setRecordingTitleDraft}
              toggleItemProject={toggleItemProject}
              updateRecordingTitle={updateRecordingTitle}
            />
          ) : (
            <div className="flex h-full min-h-0 items-center justify-center p-8 text-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Library</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Choose an idea</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted/80">
                  Select a lyric or recording from the rail, or create a new idea.
                </p>
              </div>
            </div>
          )}
        </Pane>

        <Pane className="hidden border-l 2xl:block" scroll>
          {inspector}
        </Pane>
      </div>

      {inspectorOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/25 2xl:hidden">
          <div className="h-full w-full max-w-sm border-l border-divider bg-paper shadow-float">
            <div className="flex items-center justify-between border-b border-divider px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Inspector</p>
              <ToolbarIconButton icon={X} label="Close inspector" onClick={() => setInspectorOpen(false)} />
            </div>
            <div className="h-[calc(100%-57px)] overflow-y-auto">{inspector}</div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-divider bg-white shadow-float">
            <HeaderBand
              eyebrow="Import"
              title="Scan review"
              subtitle="Upload a lyric image, then review the detected text before creating the file."
              actions={<TextActionButton onClick={() => setImportOpen(false)}>Close</TextActionButton>}
            />
            <div className="grid gap-4 p-5 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-divider bg-paper p-4">
                <input
                  className="w-full text-sm text-muted"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleOcrFile(event.target.files?.[0] ?? null)}
                />
                {isRecognizing ? <p className="mt-3 text-sm font-semibold text-accentPressed">Reading image...</p> : null}
                {importError ? <p className="mt-3 text-sm text-danger">{importError}</p> : null}
              </div>
              <div>
                <input
                  value={importTitle}
                  onChange={(event) => setImportTitle(event.target.value)}
                  className="w-full rounded-xl border border-divider bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
                  placeholder="Imported lyric title"
                />
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  className="mt-3 min-h-[300px] w-full rounded-2xl border border-divider bg-paper px-4 py-3 font-mono text-sm leading-6 text-ink outline-none transition focus:border-accent"
                  placeholder="Paste lyrics here or upload an image to run OCR."
                />
                <TextActionButton
                  onClick={() => void createFromImport()}
                  disabled={!importText.trim()}
                  variant="primary"
                >
                  Create lyric
                </TextActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}

function RecordingDetail({
  deleteRecording,
  playbackUrl,
  projects,
  recording,
  selectedProjectIds,
  setTitleDraft,
  titleDraft,
  toggleItemProject,
  updateRecordingTitle,
}: {
  deleteRecording: (id: string) => Promise<void>;
  playbackUrl: string | null;
  projects: Array<{ id: string; title: string }>;
  recording: RecordingItem;
  selectedProjectIds: string[];
  setTitleDraft: (title: string) => void;
  titleDraft: string;
  toggleItemProject: (itemType: 'recording', itemId: string, projectId: string) => Promise<void>;
  updateRecordingTitle: (id: string, title: string) => Promise<void>;
}) {
  const router = useRouter();

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-h-0 overflow-y-auto border-b border-divider xl:border-b-0 xl:border-r">
        <div className="border-b border-divider bg-paper px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Recording</p>
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => void updateRecordingTitle(recording.id, titleDraft)}
            className="mt-1 w-full border-0 bg-transparent p-0 text-3xl font-semibold leading-tight text-ink outline-none"
          />
          <p className="mt-2 text-sm text-muted/80">{formatDurationClock(recording.durationMs)}</p>
        </div>

        <div className="p-5">
          {recordingNeedsRepair(recording) ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-800">Legacy recording requires repair</p>
              <p className="mt-2 text-sm leading-6 text-amber-800/85">
                This recording was created before cloud media sync. Web keeps it visible, but playback depends on the
                source native device repairing the upload.
              </p>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-divider bg-paper p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accentPressed">
                <Radio size={20} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Audio</p>
                <p className="text-sm text-muted/80">Synced playback from Supabase storage.</p>
              </div>
            </div>
            {playbackUrl ? (
              <audio className="mt-5 w-full" controls src={playbackUrl} />
            ) : (
              <p className="mt-5 text-sm leading-6 text-muted/80">
                Playback will appear here once the recording is available.
              </p>
            )}
          </div>
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto bg-paper p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Projects</p>
        <div className="mt-4 space-y-2">
          {projects.map((project) => {
            const checked = selectedProjectIds.includes(project.id);
            return (
              <label
                key={project.id}
                className={cx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                  checked ? 'border-accent/50 bg-accentSoft text-ink' : 'border-divider bg-canvas text-muted',
                )}
              >
                <input
                  checked={checked}
                  onChange={() => void toggleItemProject('recording', recording.id, project.id)}
                  type="checkbox"
                />
                <FolderKanban size={15} />
                <span className="truncate">{project.title}</span>
              </label>
            );
          })}
          {!projects.length ? <p className="text-sm leading-6 text-muted/75">Create projects to group recordings.</p> : null}
        </div>

        <div className="mt-5 border-t border-divider pt-4">
          <ToolbarIconButton
            icon={Trash2}
            label="Delete recording"
            variant="danger"
            onClick={async () => {
              await deleteRecording(recording.id);
              router.push('/library');
            }}
          />
        </div>
      </aside>
    </div>
  );
}

function LyricInspector({
  currentLineSyllables,
  inspectorTab,
  projects,
  rhymes,
  selectedFileId,
  selectedProjectIds,
  selectedWord,
  setInspectorTab,
  toggleItemProject,
  totalSyllables,
}: {
  currentLineSyllables: number;
  inspectorTab: InspectorTab;
  projects: Array<{ id: string; title: string }>;
  rhymes: string[];
  selectedFileId: string | null;
  selectedProjectIds: string[];
  selectedWord: string | null;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleItemProject: (itemType: 'lyric', itemId: string, projectId: string) => Promise<void>;
  totalSyllables: number;
}) {
  return (
    <aside className="p-4">
      <SegmentedControl
        value={inspectorTab}
        onChange={setInspectorTab}
        className="grid-cols-3"
        options={[
          { value: 'rhymes', label: 'Rhymes' },
          { value: 'syllables', label: 'Syllables' },
          { value: 'projects', label: 'Projects' },
        ]}
      />

      {inspectorTab === 'rhymes' ? (
        <section className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Rhyme</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{selectedWord ? selectedWord : 'Select a word'}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {rhymes.length ? (
              rhymes.map((rhyme) => (
                <span key={rhyme} className="rounded-full border border-divider bg-canvas px-3 py-1 text-sm text-muted">
                  {rhyme}
                </span>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted/75">Move the caret through a word to show phonetic rhymes.</p>
            )}
          </div>
        </section>
      ) : null}

      {inspectorTab === 'syllables' ? (
        <section className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Syllables</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-divider bg-canvas p-3">
              <p className="text-xs text-muted/75">Current line</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{currentLineSyllables}</p>
            </div>
            <div className="rounded-2xl border border-divider bg-canvas p-3">
              <p className="text-xs text-muted/75">Total</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{totalSyllables}</p>
            </div>
          </div>
        </section>
      ) : null}

      {inspectorTab === 'projects' ? (
        <section className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">Projects</p>
          <div className="mt-4 space-y-2">
            {selectedFileId && projects.length ? (
              projects.map((project) => {
                const checked = selectedProjectIds.includes(project.id);
                return (
                  <label
                    key={project.id}
                    className={cx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                      checked ? 'border-accent/50 bg-accentSoft text-ink' : 'border-divider bg-canvas text-muted',
                    )}
                  >
                    <input
                      checked={checked}
                      onChange={() => void toggleItemProject('lyric', selectedFileId, project.id)}
                      type="checkbox"
                    />
                    <FolderKanban size={15} />
                    <span className="truncate">{project.title}</span>
                  </label>
                );
              })
            ) : (
              <p className="text-sm leading-6 text-muted/75">Create projects to group lyrics and recordings.</p>
            )}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
