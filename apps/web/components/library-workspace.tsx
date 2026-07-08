'use client';

import {
  formatDurationClock,
  formatDurationSeconds,
  formatShortDate,
  recordingNeedsRepair,
  type RecordingItem,
  type SectionType,
} from '@refrain/domain';
import { cleanupSectionTypes, ensureDefaultSectionTypes, getValidSectionStartSet } from '@refrain/editor-core/sections';
import {
  Check,
  ChevronLeft,
  Download,
  FileImage,
  FolderKanban,
  Mic2,
  Music,
  PanelRight,
  Plus,
  Radio,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  { type: 'pre-chorus', label: 'Pre-Chorus' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'bridge', label: 'Bridge' },
  { type: 'intro', label: 'Intro' },
  { type: 'outro', label: 'Outro' },
  { type: 'other', label: 'Other' },
];

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

const formatEditedDate = (timestamp: number): string => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(timestamp);
  startOfDate.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (daysAgo <= 0) {
    return 'today';
  }
  if (daysAgo === 1) {
    return 'yesterday';
  }
  if (daysAgo < 7) {
    return `${daysAgo} days ago`;
  }
  return formatShortDate(timestamp);
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

export function LibraryWorkspace({ initialSelectedWord = null }: { initialSelectedWord?: string | null } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeBase = pathname === '/preview' ? '/preview' : '/library';
  const selectedId = searchParams.get('lyric');
  const selectedRecordingId = searchParams.get('recording');
  const shouldCapture = searchParams.get('capture') === '1';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [sectionDraft, setSectionDraft] = useState<Record<number, SectionType>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(initialSelectedWord);
  const [rhymes, setRhymes] = useState<string[]>([]);
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
  const currentSectionStart = useMemo(() => {
    const starts = Array.from(validSectionStarts).filter((lineIndex) => lineIndex <= currentLine);
    return starts.length ? starts[starts.length - 1] : 0;
  }, [currentLine, validSectionStarts]);
  const currentSectionType = sectionDraft[currentSectionStart] ?? 'verse';
  const selectedProjectIds = selectedFile ? projectIdsForItem('lyric', selectedFile.id) : [];
  const selectedRecordingProjectIds = selectedRecording ? projectIdsForItem('recording', selectedRecording.id) : [];
  const currentLineSyllables = countSyllables(lines[currentLine] ?? '');
  const totalSyllables = lines.reduce((total, line) => total + countSyllables(line), 0);
  const itemCount = files.length + recordings.length;
  const supportsRecording = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
  const hasExplicitSelection = Boolean(selectedId || selectedRecordingId);

  useEffect(() => {
    if (selectedId && selectedFile && selectedFile.id !== selectedId) {
      router.replace(`${routeBase}?lyric=${selectedFile.id}`);
    }
    if (selectedRecordingId && selectedRecording && selectedRecording.id !== selectedRecordingId) {
      router.replace(`${routeBase}?recording=${selectedRecording.id}`);
    }
  }, [routeBase, router, selectedFile, selectedId, selectedRecording, selectedRecordingId]);

  useEffect(() => {
    setTitleDraft(selectedFile?.title ?? '');
    setBodyDraft(selectedFile?.body ?? '');
    setSectionDraft(selectedFile?.sectionTypes ?? {});
    setSelectedWord(initialSelectedWord);
    setCurrentLine(0);
  }, [initialSelectedWord, selectedFile?.body, selectedFile?.id, selectedFile?.sectionTypes, selectedFile?.title]);

  useEffect(() => {
    let active = true;
    if (!selectedWord) {
      setRhymes([]);
      return;
    }

    void import('@refrain/editor-core/dictionary').then(({ getRhymes }) => {
      if (active) {
        setRhymes(getRhymes(selectedWord).slice(0, 30));
      }
    });

    return () => {
      active = false;
    };
  }, [selectedWord]);

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
    router.push(`${routeBase}?lyric=${lyric.id}`);
  };

  const createBlankLyric = async () => {
    const lyric = await createLyric();
    router.push(`${routeBase}?lyric=${lyric.id}`);
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
            router.push(`${routeBase}?recording=${created.id}`);
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
    router.replace(routeBase);
  }, [isCreatingRecording, isRecording, routeBase, router, shouldCapture]);

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
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-paper md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <Pane className={cx('border-r', hasExplicitSelection ? 'hidden md:block' : 'block')} scroll>
          <div className="sticky top-0 z-10 border-b border-divider bg-paper px-5 pb-5 pt-7 md:pb-4 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-[44px] font-semibold tracking-[-0.045em] text-ink md:text-[30px]">Library</h1>
                <p className="mt-1 text-xs text-muted/70">{itemCount} {itemCount === 1 ? 'idea' : 'ideas'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <ToolbarIconButton icon={FileImage} label="Import lyric image" onClick={() => setImportOpen(true)} />
                <ToolbarIconButton icon={Plus} label="New lyric" onClick={() => void createBlankLyric()} variant="primary" />
                <ToolbarIconButton
                  icon={isRecording ? Square : Mic2}
                  label={isCreatingRecording ? 'Saving recording' : isRecording ? 'Stop recording' : 'New recording'}
                  onClick={() => void (isRecording ? stopRecording() : startRecording())}
                  disabled={isCreatingRecording}
                  variant={isRecording ? 'danger' : 'secondary'}
                />
              </div>
            </div>

            <label className="mt-6 flex h-12 items-center gap-2.5 rounded-lg border border-divider bg-paper px-3 text-sm text-muted transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accentSoft md:mt-5 md:h-11">
              <Search size={18} strokeWidth={1.75} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted/55"
                placeholder="Search ideas"
              />
            </label>
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              className="mt-4 grid-cols-3"
              options={[
                { value: 'all', label: 'All' },
                { value: 'lyrics', label: 'Lyrics' },
                { value: 'recordings', label: 'Audio' },
              ]}
            />
            {recorderError ? (
              <p className="mt-3 rounded-lg border border-danger/25 bg-red-50 px-3 py-2 text-sm leading-5 text-danger">
                {recorderError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col py-1">
            {visibleItems.map((item) => {
              if (item.type === 'recording') {
                const recording = item.data;
                return (
                  <NativeListRow
                    key={`recording-${recording.id}`}
                    active={recording.id === selectedRecording?.id}
                    icon={<Radio size={18} strokeWidth={1.75} />}
                    meta={formatDurationSeconds(recording.durationMs)}
                    onClick={() => router.push(`${routeBase}?recording=${recording.id}`)}
                    subtitle={
                      recordingNeedsRepair(recording)
                        ? 'Audio · Needs repair'
                        : `Audio · Edited ${formatEditedDate(recording.updatedAt)}`
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
                  icon={<Music size={18} strokeWidth={1.75} />}
                  onClick={() => router.push(`${routeBase}?lyric=${file.id}`)}
                  subtitle={`Lyric · Edited ${formatEditedDate(file.updatedAt)}`}
                  title={file.title || 'Untitled'}
                />
              );
            })}
            {!itemCount && !isLoading ? (
              <div className="mx-5 my-6 border-l-2 border-accent px-4 py-2 text-sm leading-6 text-muted/80">
                Create a lyric, import a scan, or record your first idea.
              </div>
            ) : null}
            {itemCount > 0 && !visibleItems.length ? (
              <div className="mx-5 my-6 border-l-2 border-divider px-4 py-2 text-sm leading-6 text-muted/80">
                No library items match this view.
              </div>
            ) : null}
          </div>
        </Pane>

        <Pane className={cx('overflow-hidden bg-[#fbfbf8]', hasExplicitSelection ? 'block' : 'hidden md:block')}>
          {selectedFile ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-divider bg-paper px-4 py-3 md:px-6 md:py-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(routeBase)}
                    aria-label="Back to library"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider text-muted md:hidden"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[24px] font-semibold tracking-[-0.025em] text-ink outline-none md:text-[28px]"
                    placeholder="Untitled lyric"
                  />
                  <span className="hidden items-center gap-1.5 text-xs text-muted/70 sm:flex">
                    <Check size={14} strokeWidth={2} />
                    Saved
                  </span>
                  <ToolbarIconButton
                    icon={PanelRight}
                    label="Open inspector"
                    onClick={() => setInspectorOpen(true)}
                  />
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
                      router.push(routeBase);
                    }}
                    variant="danger"
                  />
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[110px_minmax(0,1fr)] overflow-hidden bg-paper sm:grid-cols-[118px_minmax(0,1fr)]">
                <div className="border-r border-divider bg-canvas/45 py-8 text-muted/60">
                  {lines.map((line, index) => {
                    const type = sectionDraft[index] ?? (index === 0 ? 'verse' : undefined);
                    return (
                      <div key={`${index}-${line}`} className="flex h-10 items-center px-3 sm:px-4">
                        {validSectionStarts.has(index) ? (
                          <select
                            aria-label={`Section starting at line ${index + 1}`}
                            value={type ?? 'verse'}
                            onChange={(event) => setSectionType(index, event.target.value as SectionType)}
                            className="max-w-full appearance-none border-0 bg-transparent p-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-accentPressed outline-none"
                          >
                            {sectionOptions.map((option) => (
                              <option key={option.type} value={option.type}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={cx('font-mono text-[10px]', index === currentLine && 'font-semibold text-ink')}>{index + 1}</span>
                        )}
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
                  className="h-full min-h-0 resize-none overflow-y-auto border-0 bg-paper px-6 py-8 font-serif text-[20px] leading-10 text-ink outline-none placeholder:text-muted/35 md:px-10 md:text-[23px]"
                  placeholder="Draft your lyric here..."
                />
              </div>

              <div className="h-14 shrink-0 border-t border-divider bg-paper px-4 text-xs text-muted/75 md:px-6">
                <div className="flex h-full items-center justify-between md:hidden">
                  <span>{lines.length} {lines.length === 1 ? 'line' : 'lines'} · {totalSyllables} syllables</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorTab('rhymes');
                      setInspectorOpen(true);
                    }}
                    className="font-medium text-accentPressed xl:hidden"
                  >
                    Open analysis
                  </button>
                </div>
                <div className="hidden h-full items-center justify-between md:flex">
                  <div className="flex items-center gap-5 text-sm text-muted">
                    <span aria-hidden="true" className="font-serif text-xl">¶</span>
                    <span>Aa</span>
                    <span className="text-xs text-muted/60">{lines.length} lines · {totalSyllables} syllables</span>
                  </div>
                  <label className="flex items-center gap-3 text-xs text-muted">
                    Section
                    <select
                      value={currentSectionType}
                      onChange={(event) => setSectionType(currentSectionStart, event.target.value as SectionType)}
                      className="min-h-9 rounded-lg border border-divider bg-paper px-3 text-sm font-medium text-ink outline-none focus:border-accent"
                    >
                      {sectionOptions.map((option) => (
                        <option key={option.type} value={option.type}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
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
                <h2 className="text-2xl font-semibold text-ink">Choose an idea</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted/80">
                  Select a lyric or recording from the library, or create a new idea.
                </p>
              </div>
            </div>
          )}
        </Pane>

        <Pane className="hidden border-l xl:block" scroll>
          {inspector}
        </Pane>
      </div>

      {inspectorOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/20 xl:hidden">
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
    <aside>
      <div className="grid grid-cols-3 border-b border-divider px-4" role="tablist" aria-label="Lyric analysis">
        {[
          { value: 'rhymes' as const, label: 'Rhymes' },
          { value: 'syllables' as const, label: 'Syllables' },
          { value: 'projects' as const, label: 'Projects' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={inspectorTab === option.value}
            onClick={() => setInspectorTab(option.value)}
            className={cx(
              'relative h-16 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
              inspectorTab === option.value
                ? 'text-accentPressed after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accentPressed'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {inspectorTab === 'rhymes' ? (
        <section className="px-5 py-6">
          <p className="text-xs text-muted/70">Showing rhymes for</p>
          <h2 className="mt-2 font-serif text-[34px] leading-tight text-ink">{selectedWord ? selectedWord : 'Select a word'}</h2>
          <div className="mt-5 overflow-hidden rounded-lg border border-divider">
            {rhymes.length ? (
              rhymes.slice(0, 8).map((rhyme) => (
                <button
                  key={rhyme}
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between border-b border-divider px-4 text-left text-sm text-ink transition last:border-b-0 hover:bg-canvas"
                >
                  {rhyme}
                  <span className="text-xs text-muted/50">Use word</span>
                </button>
              ))
            ) : (
              <p className="px-4 py-5 text-sm leading-6 text-muted/75">
                Move the caret through a word to show phonetic rhymes.
              </p>
            )}
          </div>
          <ProjectAssignments
            className="mt-8 border-t border-divider pt-6"
            projects={projects}
            selectedFileId={selectedFileId}
            selectedProjectIds={selectedProjectIds}
            toggleItemProject={toggleItemProject}
          />
        </section>
      ) : null}

      {inspectorTab === 'syllables' ? (
        <section className="px-5 py-6">
          <h2 className="text-sm font-semibold text-ink">Syllable count</h2>
          <div className="mt-4 grid grid-cols-2 border-y border-divider">
            <div className="border-r border-divider py-5">
              <p className="text-xs text-muted/75">Current line</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{currentLineSyllables}</p>
            </div>
            <div className="py-5 pl-5">
              <p className="text-xs text-muted/75">Total</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{totalSyllables}</p>
            </div>
          </div>
        </section>
      ) : null}

      {inspectorTab === 'projects' ? (
        <ProjectAssignments
          className="px-5 py-6"
          projects={projects}
          selectedFileId={selectedFileId}
          selectedProjectIds={selectedProjectIds}
          toggleItemProject={toggleItemProject}
        />
      ) : null}
    </aside>
  );
}

function ProjectAssignments({
  className,
  projects,
  selectedFileId,
  selectedProjectIds,
  toggleItemProject,
}: {
  className?: string;
  projects: Array<{ id: string; title: string }>;
  selectedFileId: string | null;
  selectedProjectIds: string[];
  toggleItemProject: (itemType: 'lyric', itemId: string, projectId: string) => Promise<void>;
}) {
  return (
    <section className={className}>
      <h2 className="text-sm font-semibold text-ink">Projects</h2>
      <p className="mt-1 text-xs text-muted/70">Assign this lyric to a writing project.</p>
      <div className="mt-4 flex flex-col gap-2">
        {selectedFileId && projects.length ? (
          projects.map((project) => {
            const checked = selectedProjectIds.includes(project.id);
            return (
              <label
                key={project.id}
                className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-muted transition hover:text-ink"
              >
                <input
                  checked={checked}
                  onChange={() => void toggleItemProject('lyric', selectedFileId, project.id)}
                  type="checkbox"
                  className="size-4 rounded border-divider accent-[#7C8FFF]"
                />
                <FolderKanban size={16} strokeWidth={1.75} />
                <span className={cx('truncate', checked && 'font-medium text-accentPressed')}>{project.title}</span>
              </label>
            );
          })
        ) : (
          <p className="text-sm leading-6 text-muted/75">Create projects to group lyrics and recordings.</p>
        )}
      </div>
    </section>
  );
}
