'use client';

import type { SectionType } from '@refrain/domain';
import { getValidSectionStartSet } from '@refrain/editor-core/sections';
import { ChevronDown } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  buildDisplayLineNumbers,
  buildLineTopOffsets,
  getSectionPillAnchorTop,
  LYRIC_EDITOR_LINE_HEIGHT,
  LYRIC_EDITOR_TOP_INSET,
} from '@/lib/lyric-editor-layout';

import { cx } from './workspace-primitives';

const sectionOptions: Array<{ type: SectionType; label: string }> = [
  { type: 'verse', label: 'Verse' },
  { type: 'pre-chorus', label: 'Pre-Chorus' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'bridge', label: 'Bridge' },
  { type: 'intro', label: 'Intro' },
  { type: 'outro', label: 'Outro' },
  { type: 'other', label: 'Other' },
];

const MIN_EDITOR_HEIGHT = 360;

export function LyricWritingSurface({
  value,
  sectionTypes,
  currentLine,
  onChange,
  onSelectionChange,
  onSectionChange,
}: {
  value: string;
  sectionTypes: Record<number, SectionType>;
  currentLine: number;
  onChange: (value: string) => void;
  onSelectionChange: (position: number, value: string) => void;
  onSectionChange: (lineIndex: number, sectionType: SectionType) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textColumnRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => value.split('\n'), [value]);
  const validStarts = useMemo(() => getValidSectionStartSet(value), [value]);
  const sectionStarts = useMemo(() => Array.from(validStarts).sort((a, b) => a - b), [validStarts]);
  const displayNumbers = useMemo(() => buildDisplayLineNumbers(lines, validStarts), [lines, validStarts]);
  const [lineHeights, setLineHeights] = useState<number[]>(() => lines.map(() => LYRIC_EDITOR_LINE_HEIGHT));
  const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT);
  const [openSection, setOpenSection] = useState<number | null>(null);
  const lineTops = useMemo(() => buildLineTopOffsets(lineHeights, lines.length), [lineHeights, lines.length]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    const textColumn = textColumnRef.current;
    if (!textarea || !mirror || !textColumn) return;

    let frame = 0;
    const measure = () => {
      const measuredLines = Array.from(mirror.querySelectorAll<HTMLElement>('[data-lyric-line]'));
      const nextHeights = lines.map((_, index) => Math.max(
        LYRIC_EDITOR_LINE_HEIGHT,
        Math.ceil(measuredLines[index]?.getBoundingClientRect().height ?? LYRIC_EDITOR_LINE_HEIGHT),
      ));
      setLineHeights((current) => (
        current.length === nextHeights.length && current.every((height, index) => height === nextHeights[index])
          ? current
          : nextHeights
      ));

      textarea.style.height = '0px';
      const nextEditorHeight = Math.max(MIN_EDITOR_HEIGHT, textarea.scrollHeight);
      textarea.style.height = `${nextEditorHeight}px`;
      setEditorHeight((current) => current === nextEditorHeight ? current : nextEditorHeight);
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(textColumn);
    void document.fonts?.ready.then(scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [lines, value]);

  useEffect(() => {
    if (openSection === null) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenSection(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenSection(null);
      rootRef.current?.querySelector<HTMLElement>(`[data-section-pill="${openSection}"]`)?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openSection]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const activeIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (activeIndex + 1) % options.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (activeIndex - 1 + options.length) % options.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex === null || !options[nextIndex]) return;
    event.preventDefault();
    options[nextIndex].focus();
  };

  const updateSelection = (textarea: HTMLTextAreaElement) => {
    onSelectionChange(textarea.selectionStart ?? 0, textarea.value);
  };

  return (
    <div ref={rootRef} className="relative grid grid-cols-[40px_minmax(0,1fr)]">
      <div aria-hidden="true" className="relative border-r border-divider/70" style={{ height: editorHeight }}>
        {lines.map((line, index) => {
          const number = displayNumbers[index];
          if (number === null) return null;
          return (
            <span
              key={`${index}-${line}`}
              className={cx(
                'absolute right-2 flex w-6 justify-end rounded font-mono text-[11px] leading-7 text-muted/45 transition-colors',
                currentLine === index && 'bg-accentSoft pr-1 font-semibold text-accentPressed',
              )}
              style={{ top: lineTops[index] ?? LYRIC_EDITOR_TOP_INSET }}
            >
              {number}
            </span>
          );
        })}
      </div>

      <div ref={textColumnRef} className="relative min-w-0">
        <textarea
          ref={textareaRef}
          value={value}
          wrap="soft"
          spellCheck
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => updateSelection(event.currentTarget)}
          onKeyUp={(event) => updateSelection(event.currentTarget)}
          onSelect={(event) => updateSelection(event.currentTarget)}
          className="block w-full resize-none overflow-hidden border-0 bg-transparent px-5 pb-7 pt-8 font-mono text-[16px] leading-7 tracking-[-0.01em] outline-none placeholder:text-muted/35 md:px-6"
          style={{ height: editorHeight }}
          placeholder="Draft your lyric here…"
        />

        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute inset-x-0 top-8 px-5 font-mono text-[16px] leading-7 tracking-[-0.01em] md:px-6"
        >
          {lines.map((line, index) => (
            <div key={`${index}-${line}`} data-lyric-line className="min-h-7 whitespace-pre-wrap break-words">
              {line || '\u200b'}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 px-5 md:px-6">
          {sectionStarts.map((lineIndex) => {
            const sectionType = sectionTypes[lineIndex] ?? 'verse';
            const label = sectionOptions.find((option) => option.type === sectionType)?.label ?? 'Verse';
            const top = getSectionPillAnchorTop(lineIndex, lineTops, lineHeights);
            const isOpen = openSection === lineIndex;
            return (
              <div key={lineIndex} className="absolute left-5 right-2 md:left-6" style={{ top }}>
                <button
                  type="button"
                  data-section-pill={lineIndex}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  aria-controls={`section-menu-${lineIndex}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setOpenSection((current) => current === lineIndex ? null : lineIndex)}
                  className="pointer-events-auto inline-flex h-6 items-center gap-1 rounded-full border border-accent/50 bg-accentSoft/90 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accentPressed shadow-sm transition hover:border-accent hover:bg-accentSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {label}<ChevronDown size={11} strokeWidth={2.25} />
                </button>

                {isOpen ? (
                  <div
                    ref={menuRef}
                    id={`section-menu-${lineIndex}`}
                    role="menu"
                    aria-label={`Section at lyric line ${lineIndex + 1}`}
                    onKeyDown={handleMenuKeyDown}
                    className="pointer-events-auto absolute left-0 top-7 z-30 flex max-w-[calc(100%_-_0.5rem)] flex-wrap gap-1.5 rounded-xl border border-divider bg-paper/95 p-2 shadow-float backdrop-blur-xl"
                  >
                    {sectionOptions.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sectionType === option.type}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onSectionChange(lineIndex, option.type);
                          setOpenSection(null);
                          textareaRef.current?.focus({ preventScroll: true });
                        }}
                        className={cx(
                          'rounded-full border border-divider px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-accent hover:bg-accentSoft hover:text-accentPressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                          sectionType === option.type && 'border-accent bg-accentSoft font-semibold text-accentPressed',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
