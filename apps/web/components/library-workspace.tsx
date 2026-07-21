'use client';

import {
  formatDurationClock,
  formatDurationSeconds,
  formatShortDate,
  recordingNeedsRepair,
  type LyricFile,
  type RecordingItem,
} from '@refrain/domain';
import { cleanupSectionTypes, ensureDefaultSectionTypes } from '@refrain/editor-core/sections';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Download,
  FileImage,
  Folder,
  Link2,
  Mic2,
  Music2,
  PanelRight,
  Paperclip,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspaceStore } from '@/lib/workspace-store';
import { adjacentEntryIndex, filterLibraryEntries, type LibraryEntry } from '@/lib/library-filter';
import { LyricWritingSurface } from './lyric-writing-surface';
import { cx } from './workspace-primitives';

type InspectorTab = 'rhymes' | 'syllables' | 'projects';
type SaveState = 'saved' | 'saving' | 'error';

const countSyllables = (line: string) => (line.toLowerCase().match(/[a-z]+/g) ?? []).reduce((total, word) => {
  const groups = word.replace(/e$/, '').match(/[aeiouy]+/g);
  return total + Math.max(1, groups?.length ?? 0);
}, 0);
const lineAtPosition = (text: string, position: number) => text.slice(0, position).split('\n').length - 1;
const wordAtPosition = (text: string, position: number) => {
  const left = text.slice(0, position).match(/[A-Za-z']+$/)?.[0] ?? '';
  const right = text.slice(position).match(/^[A-Za-z']+/)?.[0] ?? '';
  return `${left}${right}`.trim().toLowerCase() || null;
};
const relativeDate = (timestamp: number) => {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return 'Now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 604_800_000) return `${Math.floor(delta / 86_400_000)}d ago`;
  return formatShortDate(timestamp);
};
const downloadText = (title: string, body: string) => {
  const blob = new Blob([`${title || 'Untitled'}\n\n${body}`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${(title || 'Untitled').replace(/[/\\?%*|"<>:]/g, '-')}.txt`; anchor.click();
  URL.revokeObjectURL(url);
};

export function LibraryWorkspace({ initialSelectedWord = null }: { initialSelectedWord?: string | null } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const routeBase = pathname === '/preview' ? '/preview' : '/library';
  const view = params.get('view') ?? 'all';
  const projectId = params.get('project');
  const lyricId = params.get('lyric');
  const recordingId = params.get('recording');
  const importRequested = params.get('import') === '1';
  const captureRequested = params.get('capture') === '1';
  const [query, setQuery] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('rhymes');
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LibraryEntry | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const store = useWorkspaceStore();
  const { files, recordings, projects, assignments, isInitialized } = store;

  const entries = useMemo(() => filterLibraryEntries({ files, recordings, assignments, view, projectId, query }), [assignments, files, projectId, query, recordings, view]);

  const selectedFileById = lyricId ? files.find((file) => file.id === lyricId) : undefined;
  const selectedRecordingById = recordingId ? recordings.find((recording) => recording.id === recordingId) : undefined;
  const explicitEntry: LibraryEntry | null = lyricId
    ? entries.find((entry) => entry.type === 'lyric' && entry.data.id === lyricId) ?? (selectedFileById ? { type: 'lyric', data: selectedFileById } : null)
    : recordingId
      ? entries.find((entry) => entry.type === 'recording' && entry.data.id === recordingId) ?? (selectedRecordingById ? { type: 'recording', data: selectedRecordingById } : null)
      : null;
  const selected = explicitEntry ?? entries[0] ?? null;
  const hasExplicitSelection = Boolean(lyricId || recordingId);
  const selectedProject = projects.find((project) => project.id === projectId);
  const heading = selectedProject?.title ?? (view === 'lyrics' ? 'Lyrics' : view === 'recordings' ? 'Recordings' : 'All Items');

  const entryUrl = (entry: LibraryEntry) => {
    const scope = projectId ? `project=${projectId}` : `view=${view}`;
    return `${routeBase}?${scope}&${entry.type === 'lyric' ? 'lyric' : 'recording'}=${entry.data.id}`;
  };

  useEffect(() => {
    if (!isInitialized) return;
    const invalidLyric = lyricId && !files.some((file) => file.id === lyricId);
    const invalidRecording = recordingId && !recordings.some((recording) => recording.id === recordingId);
    if (invalidLyric || invalidRecording) router.replace(`${routeBase}?${projectId ? `project=${projectId}` : `view=${view}`}`);
  }, [files, isInitialized, lyricId, projectId, recordingId, recordings, routeBase, router, view]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); searchRef.current?.focus(); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'i') { event.preventDefault(); setInspectorOpen((open) => !open); }
      if (event.key === 'Escape') { setInspectorOpen(false); setAttachmentOpen(false); }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && document.activeElement === searchRef.current) {
        const index = selected ? entries.findIndex((entry) => entry.type === selected.type && entry.data.id === selected.data.id) : -1;
        const next = adjacentEntryIndex(index, event.key === 'ArrowDown' ? 'next' : 'previous', entries.length);
        if (entries[next]) { event.preventDefault(); router.push(entryUrl(entries[next])); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setRecordingError('Audio capture is not supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream; mediaRecorderRef.current = recorder; chunksRef.current = []; startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (!blob.size) throw new Error('No audio was captured.');
          const created = await store.createRecordingFromBlob(blob, Date.now() - startedAtRef.current);
          if (lyricId) { await store.linkRecordingToLyric(created.id, lyricId); router.replace(`${routeBase}?${projectId ? `project=${projectId}` : `view=${view}`}&lyric=${lyricId}`); }
          else router.replace(`${routeBase}?view=all&recording=${created.id}`);
        } catch (error) { setRecordingError(error instanceof Error ? error.message : 'Could not save recording.'); }
        finally { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; mediaRecorderRef.current = null; }
      };
      recorder.start(); setRecordingError(null); setIsRecording(true);
    } catch (error) { setRecordingError(error instanceof Error ? error.message : 'Microphone permission was denied.'); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  useEffect(() => {
    if (!captureRequested || isRecording) return;
    void startRecording();
    const next = new URLSearchParams(params.toString()); next.delete('capture');
    router.replace(`${routeBase}?${next.toString()}`);
  }, [captureRequested]);

  return (
    <section className={cx('grid h-full min-h-0 overflow-hidden bg-paper', inspectorOpen ? 'xl:grid-cols-[320px_minmax(0,1fr)_320px]' : 'md:grid-cols-[320px_minmax(0,1fr)]')}>
      <ItemList
        entries={entries} entryUrl={entryUrl} heading={heading} hasExplicitSelection={hasExplicitSelection}
        projectId={projectId} query={query} searchRef={searchRef} selected={selected} setQuery={setQuery}
      />

      <div className={cx('min-h-0 overflow-hidden bg-paper', hasExplicitSelection ? 'block' : 'hidden md:block')}>
        {selected?.type === 'lyric' ? (
          <LyricEditor
            file={selected.data} initialSelectedWord={initialSelectedWord} inspectorOpen={inspectorOpen}
            isRecording={isRecording} onBack={() => router.push(`${routeBase}?${projectId ? `project=${projectId}` : `view=${view}`}`)}
            onDelete={() => setConfirmDelete(selected)} onInspector={() => setInspectorOpen(!inspectorOpen)}
            onRecord={() => void (isRecording ? stopRecording() : startRecording())}
            onShowAttachments={() => setAttachmentOpen(true)} recordingError={recordingError}
          />
        ) : selected?.type === 'recording' ? (
          <RecordingDetail entry={selected} onBack={() => router.push(`${routeBase}?${projectId ? `project=${projectId}` : `view=${view}`}`)} onDelete={() => setConfirmDelete(selected)} />
        ) : <EmptyDetail />}
      </div>

      {inspectorOpen && selected?.type === 'lyric' ? (
        <div className="fixed inset-0 z-50 bg-paper md:left-auto md:w-[360px] md:border-l md:border-divider md:shadow-float xl:static xl:w-auto xl:shadow-none">
          <Inspector file={selected.data} tab={inspectorTab} setTab={setInspectorTab} onClose={() => setInspectorOpen(false)} />
        </div>
      ) : null}

      {attachmentOpen && selected?.type === 'lyric' ? <AttachmentPicker file={selected.data} onClose={() => setAttachmentOpen(false)} /> : null}
      {importRequested ? <ImportDialog routeBase={routeBase} onClose={() => { const next = new URLSearchParams(params.toString()); next.delete('import'); router.replace(`${routeBase}?${next.toString()}`); }} /> : null}
      {confirmDelete ? <ConfirmDelete entry={confirmDelete} onCancel={() => setConfirmDelete(null)} onConfirm={async () => { if (confirmDelete.type === 'lyric') await store.deleteLyric(confirmDelete.data.id); else await store.deleteRecording(confirmDelete.data.id); setConfirmDelete(null); router.push(`${routeBase}?${projectId ? `project=${projectId}` : `view=${view}`}`); }} /> : null}
    </section>
  );
}

function ItemList({ entries, entryUrl, heading, hasExplicitSelection, projectId, query, searchRef, selected, setQuery }: {
  entries: LibraryEntry[]; entryUrl: (entry: LibraryEntry) => string; heading: string; hasExplicitSelection: boolean;
  projectId: string | null; query: string; searchRef: RefObject<HTMLInputElement | null>; selected: LibraryEntry | null; setQuery: (value: string) => void;
}) {
  return <div className={cx('rf-list rf-scrollbar min-h-0 overflow-y-auto border-r border-divider', hasExplicitSelection ? 'hidden md:block' : 'block')}>
    <div className="rf-glass sticky top-0 z-10 border-b border-divider px-3 pb-3 pt-3">
      <div className="flex h-9 items-center gap-2">
        <Link href="/library" className="notes-icon-button md:hidden" aria-label="Back to sidebar"><ChevronLeft size={19} /></Link>
        <h1 className="min-w-0 flex-1 truncate px-1 text-[22px] font-bold tracking-[-0.03em]">{heading}</h1>
        <span className="text-xs text-muted">{entries.length}</span>
      </div>
      <label className="mt-2 flex h-9 items-center gap-2 rounded-lg bg-canvas px-2.5 text-muted ring-1 ring-divider focus-within:ring-2 focus-within:ring-accent">
        <Search size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${projectId ? 'project' : 'items'}`} className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" />
        <kbd className="hidden text-[10px] text-muted/60 lg:block">⌘F</kbd>
      </label>
    </div>
    <div className="p-2">
      {entries.map((entry) => <ItemRow key={`${entry.type}-${entry.data.id}`} entry={entry} href={entryUrl(entry)} active={selected?.type === entry.type && selected.data.id === entry.data.id} />)}
      {!entries.length ? <div className="px-5 py-16 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accentSoft text-accentPressed"><Search size={20} /></div><p className="mt-4 text-sm font-medium">Nothing here yet</p><p className="mt-1 text-xs leading-5 text-muted">Try another search or create a new idea.</p></div> : null}
    </div>
  </div>;
}

function ItemRow({ entry, href, active }: { entry: LibraryEntry; href: string; active: boolean }) {
  const store = useWorkspaceStore();
  const projectCount = store.projectIdsForItem(entry.type, entry.data.id).length;
  const attachmentCount = entry.type === 'lyric' ? store.recordingsForLyric(entry.data.id).length : store.lyricsForRecording(entry.data.id).length;
  const excerpt = entry.type === 'lyric' ? entry.data.body.replace(/\s+/g, ' ').trim() || 'No additional text' : `${formatDurationSeconds(entry.data.durationMs)} audio recording${recordingNeedsRepair(entry.data) ? ' · Needs repair' : ''}`;
  return <Link href={href} className={cx('mb-1 block rounded-xl px-3 py-3 transition', active ? 'rf-selection' : 'hover:bg-paper')}>
    <div className="flex items-start gap-2"><span className={cx('mt-0.5 text-accentPressed', entry.type === 'recording' && 'text-muted')}>{entry.type === 'lyric' ? <Music2 size={14} /> : <Mic2 size={14} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{entry.data.title || (entry.type === 'lyric' ? 'Untitled lyric' : 'Untitled recording')}</span><span className="mt-1 line-clamp-2 min-h-9 text-[12px] leading-[18px] text-muted">{excerpt}</span><span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted/70"><span>{relativeDate(entry.data.updatedAt)}</span>{projectCount ? <span className="flex items-center gap-1"><Folder size={10} />{projectCount}</span> : null}{attachmentCount ? <span className="flex items-center gap-1"><Link2 size={10} />{attachmentCount}</span> : null}</span></span></div>
  </Link>;
}

function LyricEditor({ file, initialSelectedWord, inspectorOpen, isRecording, onBack, onDelete, onInspector, onRecord, onShowAttachments, recordingError }: {
  file: LyricFile; initialSelectedWord: string | null; inspectorOpen: boolean; isRecording: boolean; onBack: () => void; onDelete: () => void; onInspector: () => void; onRecord: () => void; onShowAttachments: () => void; recordingError: string | null;
}) {
  const updateLyric = useWorkspaceStore((state) => state.updateLyric);
  const linked = useWorkspaceStore((state) => state.recordingsForLyric(file.id));
  const [title, setTitle] = useState(file.title);
  const [body, setBody] = useState(file.body);
  const [sections, setSections] = useState(file.sectionTypes ?? {});
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [currentLine, setCurrentLine] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(initialSelectedWord);
  const lines = body.split('\n');

  useEffect(() => { setTitle(file.title); setBody(file.body); setSections(file.sectionTypes ?? {}); setSaveState('saved'); }, [file.id, file.title, file.body, file.sectionTypes]);
  useEffect(() => {
    const cleaned = cleanupSectionTypes(body, ensureDefaultSectionTypes(body, sections));
    if (title === file.title && body === file.body && JSON.stringify(cleaned) === JSON.stringify(file.sectionTypes ?? {})) return;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try { await updateLyric(file.id, { title, body, sectionTypes: cleaned }); setSaveState('saved'); }
      catch { setSaveState('error'); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [body, file, sections, title, updateLyric]);

  return <div className="flex h-full min-h-0 flex-col">
    <header className="rf-glass z-10 flex min-h-14 shrink-0 items-center gap-1 border-b border-divider px-2 md:px-3">
      <button type="button" onClick={onBack} className="notes-icon-button md:hidden" aria-label="Back to list"><ArrowLeft size={18} /></button>
      <div className="min-w-0 flex-1" />
      <span className={cx('mr-2 hidden items-center gap-1 text-[11px] sm:flex', saveState === 'error' ? 'text-danger' : 'text-muted')}>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : <><Check size={12} />Saved</>}</span>
      <button type="button" onClick={onShowAttachments} className="notes-icon-button" aria-label="Add recording attachment"><Paperclip size={17} /></button>
      <button type="button" onClick={onRecord} className={cx('notes-icon-button', isRecording && 'bg-red-100 text-danger')} aria-label={isRecording ? 'Stop recording' : 'Record audio'}>{isRecording ? <Square size={15} /> : <Mic2 size={17} />}</button>
      <button type="button" onClick={onInspector} className={cx('notes-icon-button', inspectorOpen && 'rf-selection')} aria-label="Toggle writing tools" title="Writing tools (⌘⇧I)"><PanelRight size={17} /></button>
      <button type="button" onClick={() => downloadText(title, body)} className="notes-icon-button" aria-label="Export lyric"><Download size={17} /></button>
      <button type="button" onClick={onDelete} className="notes-icon-button hover:text-danger" aria-label="Delete lyric"><Trash2 size={17} /></button>
    </header>
    <div className="rf-scrollbar min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto w-full max-w-[780px] px-4 pb-20 pt-7 md:px-8 md:pt-10">
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full border-0 bg-transparent text-[30px] font-bold tracking-[-0.035em] outline-none placeholder:text-muted/40 md:text-[36px]" placeholder="Untitled lyric" />
        <p className="mt-2 text-xs text-muted">Edited {relativeDate(file.updatedAt)}</p>
        {recordingError ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{recordingError}</p> : null}
        {linked.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{linked.map((recording) => <AudioAttachment key={recording.id} recording={recording} lyricId={file.id} />)}</div> : null}
        <div className="mt-6">
          <LyricWritingSurface
            value={body}
            sectionTypes={sections}
            currentLine={currentLine}
            onChange={(nextBody) => {
              setBody(nextBody);
              setSections((current) => cleanupSectionTypes(nextBody, ensureDefaultSectionTypes(nextBody, current)));
            }}
            onSelectionChange={(position, currentBody) => {
              setCurrentLine(lineAtPosition(currentBody, position));
              setSelectedWord(wordAtPosition(currentBody, position));
            }}
            onSectionChange={(lineIndex, sectionType) => {
              setSections((current) => ({ ...current, [lineIndex]: sectionType }));
            }}
          />
        </div>
        <div className="mt-3 grid grid-cols-[40px_minmax(0,1fr)]">
          <p className="col-start-2 px-5 text-[11px] text-muted/60 md:px-6">{lines.length} lines · {lines.reduce((total, line) => total + countSyllables(line), 0)} syllables{selectedWord ? ` · “${selectedWord}” selected` : ''}</p>
        </div>
      </article>
    </div>
  </div>;
}

function AudioAttachment({ recording, lyricId }: { recording: RecordingItem; lyricId: string }) {
  const resolve = useWorkspaceStore((state) => state.resolveRecordingUrl);
  const unlink = useWorkspaceStore((state) => state.unlinkRecordingFromLyric);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { let live = true; void resolve(recording).then((value) => live && setUrl(value)).catch(() => live && setUrl(null)); return () => { live = false; }; }, [recording, resolve]);
  const togglePlayback = async () => { if (!audioRef.current || !url) return; if (audioRef.current.paused) { await audioRef.current.play(); setPlaying(true); } else { audioRef.current.pause(); setPlaying(false); } };
  return <div className="flex min-w-0 items-center gap-2 rounded-xl border border-divider bg-canvas/70 p-2.5">
    <button type="button" disabled={!url} onClick={() => void togglePlayback()} aria-label={playing ? `Pause ${recording.title}` : `Play ${recording.title}`} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentPressed disabled:text-muted">{url ? playing ? <Square size={12} fill="currentColor" /> : <Play size={14} fill="currentColor" /> : <Mic2 size={14} />}</button>
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{recording.title}</span><span className="text-[11px] text-muted">{formatDurationSeconds(recording.durationMs)}</span></span>
    {url ? <audio ref={audioRef} className="hidden" src={url} onEnded={() => setPlaying(false)} /> : null}
    <button type="button" className="notes-icon-button size-7" onClick={() => void unlink(recording.id, lyricId)} aria-label={`Unlink ${recording.title}`}><Unlink size={13} /></button>
  </div>;
}

function AttachmentPicker({ file, onClose }: { file: LyricFile; onClose: () => void }) {
  const recordings = useWorkspaceStore((state) => state.recordings);
  const linked = useWorkspaceStore((state) => state.recordingsForLyric(file.id));
  const link = useWorkspaceStore((state) => state.linkRecordingToLyric);
  const [query, setQuery] = useState('');
  const linkedIds = new Set(linked.map((recording) => recording.id));
  const available = recordings.filter((recording) => !linkedIds.has(recording.id) && recording.title.toLowerCase().includes(query.toLowerCase()));
  return <Modal title="Attach a recording" onClose={onClose}><label className="flex h-10 items-center gap-2 rounded-lg bg-canvas px-3 ring-1 ring-divider"><Search size={15} className="text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search recordings" /></label><div className="mt-3 max-h-[360px] overflow-y-auto">{available.map((recording) => <button key={recording.id} type="button" onClick={async () => { await link(recording.id, file.id); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accentSoft"><span className="flex size-8 items-center justify-center rounded-full bg-canvas"><Mic2 size={14} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{recording.title}</span><span className="text-xs text-muted">{formatDurationSeconds(recording.durationMs)}</span></span><Plus size={15} /></button>)}{!available.length ? <p className="py-10 text-center text-sm text-muted">No unlinked recordings found.</p> : null}</div></Modal>;
}

function Inspector({ file, tab, setTab, onClose }: { file: LyricFile; tab: InspectorTab; setTab: (tab: InspectorTab) => void; onClose: () => void }) {
  const store = useWorkspaceStore();
  const [word, setWord] = useState('');
  const [rhymes, setRhymes] = useState<string[]>([]);
  useEffect(() => { if (!word) { setRhymes([]); return; } let live = true; void import('@refrain/editor-core/dictionary').then(({ getRhymes }) => live && setRhymes(getRhymes(word).slice(0, 24))); return () => { live = false; }; }, [word]);
  const total = file.body.split('\n').reduce((sum, line) => sum + countSyllables(line), 0);
  const assigned = store.projectIdsForItem('lyric', file.id);
  return <div className="flex h-full flex-col bg-paper"><header className="rf-glass flex h-14 items-center border-b border-divider px-3"><h2 className="flex-1 text-sm font-semibold">Writing Tools</h2><button type="button" className="notes-icon-button" onClick={onClose}><X size={17} /></button></header><div className="grid grid-cols-3 border-b border-divider p-2">{(['rhymes', 'syllables', 'projects'] as InspectorTab[]).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={cx('rounded-lg px-2 py-2 text-xs capitalize', tab === value ? 'rf-selection font-semibold' : 'text-muted hover:bg-canvas')}>{value}</button>)}</div><div className="rf-scrollbar min-h-0 flex-1 overflow-y-auto p-4">{tab === 'rhymes' ? <><input value={word} onChange={(event) => setWord(event.target.value)} placeholder="Type a word" className="h-10 w-full rounded-lg border border-divider bg-canvas px-3 text-sm outline-none focus:border-accent" /><div className="mt-4 flex flex-wrap gap-2">{rhymes.map((rhyme) => <span key={rhyme} className="rounded-full bg-accentSoft px-2.5 py-1 text-xs text-accentPressed">{rhyme}</span>)}</div></> : null}{tab === 'syllables' ? <><p className="text-4xl font-semibold">{total}</p><p className="mt-1 text-sm text-muted">Estimated syllables across {file.body.split('\n').length} lines</p><div className="mt-5 space-y-2">{file.body.split('\n').map((line, index) => line ? <div key={index} className="flex gap-3 text-xs"><span className="w-5 text-right text-muted">{countSyllables(line)}</span><span className="min-w-0 flex-1 truncate">{line}</span></div> : null)}</div></> : null}{tab === 'projects' ? <div className="space-y-1">{store.projects.map((project) => <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas"><input type="checkbox" checked={assigned.includes(project.id)} onChange={() => void store.toggleItemProject('lyric', file.id, project.id)} className="accent-[#7c8fff]" /><Folder size={15} className="text-accentPressed" /><span className="min-w-0 flex-1 truncate text-sm">{project.title}</span></label>)}</div> : null}</div></div>;
}

function RecordingDetail({ entry, onBack, onDelete }: { entry: Extract<LibraryEntry, { type: 'recording' }>; onBack: () => void; onDelete: () => void }) {
  const recording = entry.data;
  const store = useWorkspaceStore();
  const linkedLyrics = store.lyricsForRecording(recording.id);
  const assigned = store.projectIdsForItem('recording', recording.id);
  const [title, setTitle] = useState(recording.title);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { setTitle(recording.title); let live = true; void store.resolveRecordingUrl(recording).then((value) => live && setUrl(value)).catch(() => live && setUrl(null)); return () => { live = false; }; }, [recording.id, recording.title]);
  return <div className="flex h-full min-h-0 flex-col"><header className="rf-glass flex h-14 items-center gap-1 border-b border-divider px-2 md:px-3"><button type="button" onClick={onBack} className="notes-icon-button md:hidden"><ArrowLeft size={18} /></button><div className="flex-1" />{url ? <a href={url} download className="notes-icon-button" aria-label="Download recording"><Download size={17} /></a> : null}<button type="button" onClick={onDelete} className="notes-icon-button hover:text-danger"><Trash2 size={17} /></button></header><div className="rf-scrollbar min-h-0 flex-1 overflow-y-auto"><article className="mx-auto max-w-[760px] px-5 py-10 md:px-10 md:py-14"><div className="flex size-16 items-center justify-center rounded-2xl bg-accentSoft text-accentPressed"><Mic2 size={27} /></div><input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => void store.updateRecordingTitle(recording.id, title)} className="mt-6 w-full bg-transparent text-[30px] font-bold tracking-[-0.03em] outline-none md:text-[36px]" /><p className="mt-2 text-sm text-muted">{formatDurationClock(recording.durationMs)} · Recorded {formatShortDate(recording.createdAt)}</p>{recordingNeedsRepair(recording) ? <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">This older recording needs to be re-uploaded before it can play on the web.</div> : url ? <audio className="mt-8 w-full" controls src={url} /> : <div className="mt-8 rounded-xl bg-canvas p-5 text-sm text-muted">Playback is not currently available.</div>}<section className="mt-10"><h2 className="text-sm font-semibold">Linked lyrics</h2><div className="mt-2 space-y-1">{linkedLyrics.map((file) => <Link key={file.id} href={`/library?view=all&lyric=${file.id}`} className="flex items-center gap-3 rounded-xl border border-divider px-3 py-3 hover:bg-canvas"><Music2 size={16} className="text-accentPressed" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{file.title}</span><Link2 size={13} className="text-muted" /></Link>)}{!linkedLyrics.length ? <p className="py-3 text-sm text-muted">This recording is not linked to a lyric.</p> : null}</div></section><section className="mt-8"><h2 className="text-sm font-semibold">Projects</h2><div className="mt-2 grid gap-1 sm:grid-cols-2">{store.projects.map((project) => <label key={project.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-canvas"><input type="checkbox" checked={assigned.includes(project.id)} onChange={() => void store.toggleItemProject('recording', recording.id, project.id)} /><Folder size={14} className="text-accentPressed" /><span className="truncate text-sm">{project.title}</span></label>)}</div></section></article></div></div>;
}

function ImportDialog({ routeBase, onClose }: { routeBase: string; onClose: () => void }) {
  const router = useRouter(); const store = useWorkspaceStore();
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const recognize = async (file: File | null) => { if (!file) return; setBusy(true); setError(null); try { const { recognize } = await import('tesseract.js'); const result = await recognize(file, 'eng'); setText(result.data.text.trim()); setTitle(file.name.replace(/\.[^.]+$/, '')); } catch (value) { setError(value instanceof Error ? value.message : 'Could not read that image.'); } finally { setBusy(false); } };
  const save = async () => { const lyric = await store.createLyric(); await store.updateLyric(lyric.id, { title: title.trim() || 'Imported lyric', body: text, sectionTypes: ensureDefaultSectionTypes(text, {}) }); router.push(`${routeBase}?view=all&lyric=${lyric.id}`); };
  return <Modal title="Import lyric image" onClose={onClose} wide><div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]"><label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-divider bg-canvas p-4 text-center"><FileImage size={28} className="text-accentPressed" /><span className="mt-3 text-sm font-medium">Choose an image</span><span className="mt-1 text-xs text-muted">{busy ? 'Reading text…' : 'PNG, JPEG, or HEIC'}</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => void recognize(event.target.files?.[0] ?? null)} /></label><div><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Lyric title" className="h-10 w-full rounded-lg border border-divider bg-canvas px-3 text-sm outline-none" /><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Recognized lyric text" className="mt-3 h-56 w-full resize-none rounded-lg border border-divider bg-canvas p-3 font-serif text-sm outline-none" />{error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}<div className="mt-3 flex justify-end"><button type="button" disabled={!text.trim() || busy} onClick={() => void save()} className="rounded-lg bg-accentPressed px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Lyric</button></div></div></div></Modal>;
}

function ConfirmDelete({ entry, onCancel, onConfirm }: { entry: LibraryEntry; onCancel: () => void; onConfirm: () => Promise<void> }) {
  return <Modal title={`Delete ${entry.type}?`} onClose={onCancel}><p className="text-sm leading-6 text-muted">“{entry.data.title || 'Untitled'}” will be removed from your library, Projects, and links. This cannot be undone from the web app.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm hover:bg-canvas">Cancel</button><button type="button" onClick={() => void onConfirm()} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white">Delete</button></div></Modal>;
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="rf-overlay fixed inset-0 z-[70] flex items-center justify-center p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div role="dialog" aria-modal="true" aria-label={title} className={cx('w-full rounded-2xl border border-divider bg-paper p-4 shadow-float md:p-5', wide ? 'max-w-3xl' : 'max-w-md')}><header className="mb-4 flex items-center"><h2 className="flex-1 text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="notes-icon-button"><X size={17} /></button></header>{children}</div></div>;
}

function EmptyDetail() { return <div className="flex h-full items-center justify-center p-8 text-center"><div><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accentSoft text-accentPressed"><Music2 size={25} /></div><h2 className="mt-5 text-xl font-semibold">Choose an idea</h2><p className="mt-2 text-sm text-muted">Select a lyric or recording, or create something new.</p></div></div>; }
