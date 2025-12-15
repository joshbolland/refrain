import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputSelectionChangeEventData,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRefrainStore } from '../../store/useRefrainStore';
import { RhymePanel } from '../rhyme/RhymePanel';
import {
  editorFontSize,
  editorHorizontalPadding,
  editorLineHeight,
  editorPaddingBottom,
  editorPaddingTop,
} from './editorMetrics';
import { TogglePill } from './TogglePill';
import { getSectionStartLineIndices, isBlankLine } from '../../analysis/sections';
import type { SectionType } from '../../types/lyricFile';
import { SectionChipsRow } from './SectionChipsRow';

const isInBlankRun = (lines: string[], index: number): boolean => {
  const currentBlank = isBlankLine(lines[index] ?? '');
  if (!currentBlank) {
    return false;
  }
  const previousBlank = index > 0 ? isBlankLine(lines[index - 1]) : false;
  const nextBlank = index + 1 < lines.length ? isBlankLine(lines[index + 1]) : false;
  return previousBlank || nextBlank;
};

const findWordAtSelection = (text: string, position: number): string | null => {
  if (position < 0) {
    return null;
  }

  const left = text.slice(0, position).match(/[A-Za-z']+$/)?.[0] ?? '';
  const right = text.slice(position).match(/^[A-Za-z']+/)?.[0] ?? '';
  const word = `${left}${right}`;
  return word.length > 0 ? word.toLowerCase() : null;
};

const getLineIndexAtChar = (text: string, position: number): number => {
  const before = text.slice(0, position);
  return before.split('\n').length - 1;
};

const SAVE_MESSAGE_DURATION = 1500;

const SaveStatus = () => {
  const { isSaving, lastSavedAt, saveError } = useRefrainStore((state) => ({
    isSaving: state.isSaving,
    lastSavedAt: state.lastSavedAt,
    saveError: state.saveError,
  }));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (isSaving) {
      setStatus('saving');
      return;
    }

    if (saveError) {
      setStatus('error');
      return;
    }

    if (lastSavedAt !== null) {
      setStatus('saved');
      hideTimer.current = setTimeout(() => setStatus('idle'), SAVE_MESSAGE_DURATION);
      return;
    }

    setStatus('idle');
  }, [isSaving, lastSavedAt, saveError]);

  useEffect(
    () => () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    },
    [],
  );

  if (status === 'idle') {
    return null;
  }

  const label = status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : "Couldn't save";
  const textClass = status === 'error' ? 'text-red-500' : 'text-muted';

  return <Text className={`text-xs uppercase tracking-[0.14em] ${textClass}`}>{label}</Text>;
};

export const LyricEditor = () => {
  const { width } = useWindowDimensions();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isDesktop = width >= 1024;
  const [showRhymePanel, setShowRhymePanel] = useState(isDesktop);
  const [body, setBody] = useState('');
  const [inputHeight, setInputHeight] = useState(editorLineHeight * 8);
  const [rhymePanelHeight, setRhymePanelHeight] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [caretIndex, setCaretIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [lineNumberWidth, setLineNumberWidth] = useState(0);
  const [pickerLineIndex, setPickerLineIndex] = useState<number | null>(null);
  const [pickerHeight, setPickerHeight] = useState(0);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const caretIndexRef = useRef(0);
  const bodyRef = useRef('');

  const {
    selectedFile,
    updateSelectedFile,
    selectedWord,
    setEditorSelection,
    setSelectedWord,
    setActiveLineIndex,
  } = useRefrainStore((state) => ({
    selectedFile: state.selectedFile(),
    updateSelectedFile: state.updateSelectedFile,
    selectedWord: state.selectedWord,
    setEditorSelection: state.setEditorSelection,
    setSelectedWord: state.setSelectedWord,
    setActiveLineIndex: state.setActiveLineIndex,
  }));

  useEffect(() => {
    setShowRhymePanel(isDesktop);
  }, [isDesktop]);

  useEffect(() => {
    if (!selectedFile) {
      setBody('');
      bodyRef.current = '';
      setEditorSelection(null);
      setSelectedWord(null);
      setActiveLineIndex(-1);
      setPickerLineIndex(null);
      return;
    }
    setBody(selectedFile.body ?? '');
    bodyRef.current = selectedFile.body ?? '';
    setPickerLineIndex(null);
  }, [selectedFile, setActiveLineIndex, setEditorSelection, setSelectedWord]);

  const lines = useMemo(() => body.split('\n'), [body]);
  const gutterHeight = Math.max(inputHeight, editorLineHeight * lines.length);
  const targetRhymeWord = selectedWord;
  const sectionTypes = selectedFile?.sectionTypes ?? {};

  const evaluatePickerOpen = useCallback(
    (bodyValue: string, caret: number) => {
      const lineIndex = getLineIndexAtChar(bodyValue, caret);
      setCurrentLineIndex(lineIndex);
      return lineIndex;
    },
    [],
  );

  const handleChangeBody = (text: string) => {
    bodyRef.current = text;
    setBody(text);
    const validStartIndices = new Set(getSectionStartLineIndices(text));
    const existingSectionTypes = selectedFile?.sectionTypes ?? {};

    const prunedSectionTypes = Object.entries(existingSectionTypes).reduce<Record<number, SectionType>>(
      (acc, [key, value]) => {
        const index = Number(key);
        if (Number.isInteger(index) && validStartIndices.has(index)) {
          acc[index] = value;
        }
        return acc;
      },
      {},
    );

    const sectionTypesChanged =
      Object.keys(prunedSectionTypes).length !== Object.keys(existingSectionTypes).length ||
      Object.entries(prunedSectionTypes).some(
        ([key, value]) => existingSectionTypes[Number(key)] !== value,
      );

    const patch = sectionTypesChanged ? { body: text, sectionTypes: prunedSectionTypes } : { body: text };

    void updateSelectedFile(patch);
    const caret = selectionRef.current?.start ?? caretIndexRef.current ?? caretIndex;
    evaluatePickerOpen(text, caret);
  };

  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const selection = event.nativeEvent.selection;
      setEditorSelection(selection);
      selectionRef.current = selection;
      const caret = selection.start;
      setCaretIndex(caret);
      caretIndexRef.current = caret;
      const lineIndex = evaluatePickerOpen(bodyRef.current, caret);
      const word = findWordAtSelection(bodyRef.current, caret);
      setActiveLineIndex(lineIndex);
      setSelectedWord(word);
    },
    [evaluatePickerOpen, setActiveLineIndex, setEditorSelection, setSelectedWord],
  );

  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const nextHeight = event.nativeEvent.contentSize.height;
    if (Number.isFinite(nextHeight)) {
      setInputHeight((prev) => (prev === nextHeight ? prev : Math.max(nextHeight, editorLineHeight * 6)));
    }
  };

  const applySectionType = useCallback(
    (lineIndex: number, type: SectionType) => {
      if (!selectedFile) {
        return;
      }
      const nextSectionTypes = {
        ...(selectedFile.sectionTypes ?? {}),
        [lineIndex]: type,
      };
      if (selectedFile.sectionTypes?.[lineIndex] === type) {
        setPickerLineIndex(null);
        return;
      }
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('Section picker apply', { lineIndex, type, value: nextSectionTypes[lineIndex] });
      }
      void updateSelectedFile({ sectionTypes: nextSectionTypes });
      setPickerLineIndex(null);
    },
    [selectedFile, updateSelectedFile],
  );

  const closePicker = useCallback(
    (options?: { defaultToVerse?: boolean; lineIndex?: number }) => {
      const targetLineIndex = options?.lineIndex ?? pickerLineIndex;
      setPickerLineIndex(null);
      if (options?.defaultToVerse && typeof targetLineIndex === 'number') {
        applySectionType(targetLineIndex, 'verse');
      }
    },
    [applySectionType, pickerLineIndex],
  );

  useEffect(() => {
    if (pickerLineIndex === null) {
      return;
    }
    if (pickerLineIndex >= lines.length) {
      setPickerLineIndex(null);
    }
  }, [lines.length, pickerLineIndex]);

  useEffect(() => {
    if (pickerLineIndex === null) {
      return;
    }

    if (pickerLineIndex >= lines.length) {
      setPickerLineIndex(null);
      return;
    }

    const previousLineBlank = pickerLineIndex > 0 && isBlankLine(lines[pickerLineIndex - 1]);
    if (!previousLineBlank) {
      setPickerLineIndex(null);
      return;
    }

    const currentLine = lines[pickerLineIndex] ?? '';
    if (!isBlankLine(currentLine)) {
      closePicker({ defaultToVerse: true, lineIndex: pickerLineIndex });
    }
  }, [closePicker, lines, pickerLineIndex]);

  useEffect(() => {
    if (pickerLineIndex === null) {
      return;
    }

    if (pickerLineIndex >= lines.length) {
      setPickerLineIndex(null);
      return;
    }

    if (currentLineIndex === pickerLineIndex) {
      return;
    }

    const previousLineBlank = pickerLineIndex > 0 && isBlankLine(lines[pickerLineIndex - 1]);
    if (!previousLineBlank) {
      setPickerLineIndex(null);
      return;
    }

    closePicker({ defaultToVerse: true, lineIndex: pickerLineIndex });
  }, [closePicker, currentLineIndex, lines, pickerLineIndex]);

  useEffect(() => {
    if (currentLineIndex >= lines.length) {
      if (pickerLineIndex !== null) {
        setPickerLineIndex(null);
      }
      return;
    }

    const previousLineBlank =
      currentLineIndex > 0 ? isBlankLine(lines[currentLineIndex - 1]) : false;
    const currentLineBlank = isBlankLine(lines[currentLineIndex] ?? '');
    const nextLineBlank =
      currentLineIndex + 1 < lines.length ? isBlankLine(lines[currentLineIndex + 1]) : false;
    const inBlankRun = isInBlankRun(lines, currentLineIndex);
    const readyTypingLine = previousLineBlank && (!inBlankRun || (currentLineBlank && !nextLineBlank));
    const hasType = sectionTypes[currentLineIndex] !== undefined;
    const shouldOpen = currentLineIndex > 0 && readyTypingLine && !hasType;

    if (shouldOpen && pickerLineIndex !== currentLineIndex) {
      setPickerLineIndex(currentLineIndex);
      return;
    }

    if (!shouldOpen && pickerLineIndex === currentLineIndex) {
      setPickerLineIndex(null);
    }
  }, [currentLineIndex, lines, pickerLineIndex, sectionTypes]);

  const handleSelectSectionType = useCallback(
    (type: SectionType) => {
      if (pickerLineIndex === null) {
        return;
      }
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('Section picker select', { targetLineIndex: pickerLineIndex, type });
      }
      applySectionType(pickerLineIndex, type);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (selectionRef.current) {
          inputRef.current?.setNativeProps({ selection: selectionRef.current });
        }
      });
    },
    [applySectionType, pickerLineIndex],
  );

  const overlayTop = useMemo(() => {
    if (pickerLineIndex === null) {
      return null;
    }
    const baseTop = pickerLineIndex * editorLineHeight - scrollOffset + editorPaddingTop;
    if (!viewportHeight || !pickerHeight) {
      return Math.max(0, baseTop);
    }
    const maxTop = viewportHeight - pickerHeight - 8;
    return Math.min(Math.max(0, baseTop), maxTop);
  }, [pickerHeight, pickerLineIndex, scrollOffset, viewportHeight]);

  if (!selectedFile) {
    return (
      <View className="flex-1 items-center justify-center rounded-xl bg-accentSoft px-6 py-12">
        <Text className="text-lg font-semibold text-ink">Select a file to start writing.</Text>
        <Text className="mt-2 text-sm text-muted/90">Every song starts somewhere.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ paddingBottom: safeAreaBottom }}>
      <View className="flex-1 rounded-xl bg-white">
        <View className="w-full" style={{ borderTopWidth: 2, borderTopColor: '#9DACFF' }} />
        <View className="flex-1">
          <View className="px-5 pt-4">
            <TextInput
              value={selectedFile.title}
              onChangeText={(text) => void updateSelectedFile({ title: text })}
              placeholder="Title"
              className="text-3xl font-semibold tracking-tight text-ink"
              style={{ textAlign: 'center' }}
              placeholderTextColor="#9CA3AF"
              selectionColor="#9DACFF"
              cursorColor="#9DACFF"
            />
          </View>
          <View className="mt-4 w-full" style={{ borderTopWidth: 2, borderTopColor: '#9DACFF' }} />
          <View className="flex-1 px-5 pb-4">
            <View className="flex-1 rounded-lg bg-white" style={{ position: 'relative' }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: 24 + editorPaddingBottom + (showRhymePanel ? rhymePanelHeight : 0),
                }}
                onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
                onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
              >
                <View className="flex-row">
                  <View
                    style={{
                      paddingTop: editorPaddingTop,
                      paddingBottom: editorPaddingBottom,
                      paddingHorizontal: 12,
                      minHeight: gutterHeight,
                    }}
                    onLayout={(event) => setLineNumberWidth(event.nativeEvent.layout.width)}
                  >
                    {lines.map((_, index) => (
                      <Text
                        key={`line-${index}`}
                        style={{
                          height: editorLineHeight,
                          lineHeight: editorLineHeight,
                          fontSize: 12,
                          color: '#9CA3AF',
                        }}
                        className="text-right font-mono"
                      >
                        {index + 1}
                      </Text>
                    ))}
                  </View>
                  <View
                    className="flex-1"
                    style={{ paddingTop: editorPaddingTop, paddingBottom: editorPaddingBottom }}
                  >
                    <TextInput
                      ref={inputRef}
                      value={body}
                      multiline
                      scrollEnabled={false}
                      onChangeText={handleChangeBody}
                      onSelectionChange={handleSelectionChange}
                      onContentSizeChange={handleContentSizeChange}
                      style={{
                        minHeight: editorLineHeight * 6,
                        height: gutterHeight,
                        lineHeight: editorLineHeight,
                        fontSize: editorFontSize,
                        paddingHorizontal: editorHorizontalPadding,
                        paddingVertical: 0,
                        color: '#111827',
                        textAlignVertical: 'top',
                      }}
                      className="font-mono text-ink"
                      placeholder="Start writing your verse..."
                      placeholderTextColor="#9CA3AF"
                      selectionColor="#9DACFF"
                      cursorColor="#9DACFF"
                      autoCorrect={false}
                      autoCapitalize="sentences"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                </View>
              </ScrollView>
              {pickerLineIndex !== null && overlayTop !== null && (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: overlayTop,
                    left: lineNumberWidth + editorHorizontalPadding,
                    right: editorHorizontalPadding,
                  }}
                  onLayout={(event) => setPickerHeight(event.nativeEvent.layout.height)}
                >
                  <SectionChipsRow
                    startLineIndex={pickerLineIndex}
                    mode="new"
                    activeType={null}
                    onSelect={handleSelectSectionType}
                  />
                </View>
              )}
            </View>
            <View className="mt-3 flex-row items-center">
              <SaveStatus />
              <View className="ml-auto flex-row items-center" style={{ columnGap: 12 }}>
                <TogglePill
                  label="Rhymes"
                  isActive={showRhymePanel}
                  onPress={() => setShowRhymePanel((prev) => !prev)}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
      {showRhymePanel && (
        <View
          className="mt-4 rounded-xl bg-white p-4"
          style={{ borderTopWidth: 2, borderTopColor: '#9DACFF' }}
          onLayout={(event) => setRhymePanelHeight(event.nativeEvent.layout.height)}
        >
          <RhymePanel targetWord={targetRhymeWord} />
        </View>
      )}
    </View>
  );
};
