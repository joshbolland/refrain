import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputSelectionChangeEventData,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  findPreviousChorusStart,
  findPreviousSectionStartOfType,
  getSectionBlockRange,
  isBlankLine,
} from '../../analysis/sections';
import { useRefrainStore } from '../../store/useRefrainStore';
import type { SectionType } from '../../types/lyricFile';
import { RhymePanel } from '../rhyme/RhymePanel';
import {
  editorFontSize,
  editorHorizontalPadding,
  editorLineHeight,
  editorPaddingBottom,
  editorPaddingTop,
} from './editorMetrics';
import { SECTION_TYPE_COLORS, SectionChipsRow } from './SectionChipsRow';
import { TogglePill } from './TogglePill';

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

const getDisplayedLineNumbers = (lines: string[]): (number | null)[] => {
  let counter = 0;
  return lines.map((line) => {
    if (isBlankLine(line)) {
      return null;
    }
    counter += 1;
    return counter;
  });
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
  const [pickerMode, setPickerMode] = useState<'new' | 'edit'>('new');
  const [pickerHeight, setPickerHeight] = useState(0);
  const [editPickerHeight, setEditPickerHeight] = useState(0);
  const [editingSectionLineIndex, setEditingSectionLineIndex] = useState<number | null>(null);
  const [lineHeights, setLineHeights] = useState<number[]>([]);
  const [textColumnWidth, setTextColumnWidth] = useState(0);
  const [badgeViewportHeight, setBadgeViewportHeight] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const caretIndexRef = useRef(0);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const bodyRef = useRef('');
  const isDraggingRef = useRef(false);
  const lastAutoScrollKey = useRef<string | null>(null);
  const BADGE_Y_OFFSET = 10;
  const BADGE_HEIGHT = 22;
  const BADGE_GAP = 6;
  const EDIT_PICKER_EST_HEIGHT = 44;
  const GUTTER_NUMBER_Y_OFFSET = 4;
  const VISIBILITY_MARGIN = 16;
  const AUTO_SCROLL_EPSILON = 6;
  const FALLBACK_PICKER_HEIGHT = 44;

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
  const displayedLineNumbers = useMemo(() => getDisplayedLineNumbers(lines), [lines]);
  useEffect(() => {
    setLineHeights((prev) => {
      if (prev.length === lines.length) {
        return prev;
      }
      const next = new Array(lines.length);
      for (let i = 0; i < lines.length; i += 1) {
        next[i] = prev[i] ?? editorLineHeight;
      }
      return next;
    });
  }, [lines.length]);
  const fallbackHeights = useMemo(
    () => Array.from({ length: lines.length }, (_, index) => lineHeights[index] ?? editorLineHeight),
    [lineHeights, lines.length],
  );
  const yOffsets = useMemo(() => {
    const offsets = new Array(fallbackHeights.length + 1).fill(0);
    for (let i = 0; i < fallbackHeights.length; i += 1) {
      offsets[i + 1] = offsets[i] + fallbackHeights[i];
    }
    return offsets;
  }, [fallbackHeights]);
  const getLineOffset = useCallback(
    (index: number) => (index >= 0 && index < yOffsets.length ? yOffsets[index] : index * editorLineHeight),
    [yOffsets],
  );
  const contentHeight = yOffsets[yOffsets.length - 1] ?? editorLineHeight * lines.length;
  const gutterHeight = Math.max(inputHeight, contentHeight, editorLineHeight * lines.length);
  const targetRhymeWord = selectedWord;
  const sectionTypes = useMemo<Record<number, SectionType>>(
    () => selectedFile?.sectionTypes ?? {},
    [selectedFile?.sectionTypes],
  );
  const firstNonBlankLineIndex = useMemo(
    () => lines.findIndex((line) => !isBlankLine(line)),
    [lines],
  );
  const isEmpty = firstNonBlankLineIndex === -1;

  const sectionBadges = useMemo(() => {
    if (lines.length === 0) {
      return [];
    }
    return Object.entries(sectionTypes)
      .map(([key, type]) => {
        const index = Number(key);
        return Number.isInteger(index) ? { index, type } : null;
      })
      .filter((entry): entry is { index: number; type: SectionType } => entry !== null)
      .filter(({ index }) => index >= 0 && index < lines.length)
      .filter(({ index }) => {
        if (firstNonBlankLineIndex === -1) {
          return false;
        }
        if (index === firstNonBlankLineIndex) {
          return true;
        }
        return index > 0 && isBlankLine(lines[index - 1]);
      })
      .sort((a, b) => a.index - b.index);
  }, [firstNonBlankLineIndex, lines, sectionTypes]);

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
    void updateSelectedFile({ body: text });
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
  const handleMeasuredLineHeight = useCallback((index: number, height: number) => {
    setLineHeights((prev) => {
      if (prev[index] === height) {
        return prev;
      }
      const next = [...prev];
      next[index] = height;
      return next;
    });
  }, []);

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
        setPickerMode('new');
        return;
      }
      if (__DEV__) {

        console.log('Section picker apply', { lineIndex, type, value: nextSectionTypes[lineIndex] });
      }
      void updateSelectedFile({ sectionTypes: nextSectionTypes });
      setPickerLineIndex(null);
      setPickerMode('new');
    },
    [selectedFile, updateSelectedFile],
  );

  const closePicker = useCallback(
    (options?: { defaultToVerse?: boolean; lineIndex?: number }) => {
      const targetLineIndex = options?.lineIndex ?? pickerLineIndex;
      const shouldDefault = options?.defaultToVerse && pickerMode === 'new';
      setPickerLineIndex(null);
      setPickerMode('new');
      if (shouldDefault && typeof targetLineIndex === 'number') {
        if (targetLineIndex !== 0) {
          applySectionType(targetLineIndex, 'verse');
        }
      }
    },
    [applySectionType, pickerLineIndex, pickerMode],
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
      closePicker({ defaultToVerse: pickerMode === 'new', lineIndex: pickerLineIndex });
      return;
    }

    const currentLine = lines[pickerLineIndex] ?? '';
    if (!isBlankLine(currentLine)) {
      closePicker({ defaultToVerse: true, lineIndex: pickerLineIndex });
    }
  }, [closePicker, lines, pickerLineIndex, pickerMode]);

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

    closePicker({ defaultToVerse: pickerMode === 'new', lineIndex: pickerLineIndex });
  }, [closePicker, currentLineIndex, lines, pickerLineIndex, pickerMode]);

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
      setPickerMode('new');
      setPickerLineIndex(currentLineIndex);
      return;
    }

    if (!shouldOpen && pickerLineIndex === currentLineIndex) {
      setPickerLineIndex(null);
    }
  }, [currentLineIndex, lines, pickerLineIndex, sectionTypes]);

  const promptRepeatChoice = useCallback(async (targetType: SectionType): Promise<'repeat' | 'new' | 'cancel'> => {
    const label = targetType === 'pre-chorus' ? 'pre-chorus' : 'chorus';
    if (Platform.OS === 'web') {
      const choice =
        (window.prompt(`Repeat existing ${label}? Type repeat / new / cancel`, 'repeat') ?? '').toLowerCase();
      if (choice.startsWith('rep')) {
        return 'repeat';
      }
      if (choice.startsWith('new')) {
        return 'new';
      }
      return 'cancel';
    }

    return new Promise((resolve) => {
      Alert.alert(`Repeat existing ${label}?`, undefined, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'New', onPress: () => resolve('new') },
        { text: 'Repeat', style: 'default', onPress: () => resolve('repeat') },
      ]);
    });
  }, []);

  const handleSelectSectionType = useCallback(
    async (type: SectionType) => {
      // Edit overlay flow
      if (editingSectionLineIndex !== null) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('Section picker select', { targetLineIndex: editingSectionLineIndex, type });
        }
        applySectionType(editingSectionLineIndex, type);
        setEditingSectionLineIndex(null);
        setPickerLineIndex(null);
        setPickerMode('new');
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          if (selectionRef.current) {
            inputRef.current?.setNativeProps({ selection: selectionRef.current });
          }
        });
        return;
      }

      // New section flow
      if (pickerMode !== 'new' || pickerLineIndex === null) {
        return;
      }

      if (type === 'chorus' || type === 'pre-chorus') {
        const finder =
          type === 'chorus'
            ? findPreviousChorusStart
            : (bodyValue: string, types: Record<number, SectionType>, target: number) =>
                findPreviousSectionStartOfType(bodyValue, types, target, 'pre-chorus');
        const prevStart = finder(bodyRef.current, sectionTypes, pickerLineIndex);
        if (prevStart !== null) {
          const choice = await promptRepeatChoice(type);
          if (choice === 'cancel') {
            return;
          }
          if (choice === 'repeat') {
            const lines = bodyRef.current.split('\n');
            const range = getSectionBlockRange(bodyRef.current, prevStart);
            const chorusLines = lines.slice(range.start, range.endExclusive);
            const target = pickerLineIndex;
            const targetLine = lines[target] ?? '';
            const replaceTarget = isBlankLine(targetLine);
            const newLines = replaceTarget
              ? [...lines.slice(0, target), ...chorusLines, ...lines.slice(target + 1)]
              : [...lines.slice(0, target), ...chorusLines, ...lines.slice(target)];
            const delta = newLines.length - lines.length;

            const nextSectionTypes: Record<number, SectionType> = {};
            Object.entries(sectionTypes).forEach(([key, value]) => {
              const idx = Number(key);
              if (!Number.isInteger(idx)) {
                return;
              }
              if (idx < target) {
                nextSectionTypes[idx] = value;
              } else if (idx > target) {
                nextSectionTypes[idx + delta] = value;
              }
            });
            nextSectionTypes[target] = type;

            const newBody = newLines.join('\n');
            setBody(newBody);
            bodyRef.current = newBody;
            void updateSelectedFile({ body: newBody, sectionTypes: nextSectionTypes });
            setPickerLineIndex(null);
            setPickerMode('new');

            const caretLine = target + chorusLines.length - 1;
            const caretCol = chorusLines.length > 0 ? chorusLines[chorusLines.length - 1].length : 0;
            let caretPos = 0;
            for (let i = 0; i < caretLine; i += 1) {
              caretPos += newLines[i].length + 1;
            }
            caretPos += caretCol;
            const selection = { start: caretPos, end: caretPos };
            selectionRef.current = selection;
            setCaretIndex(caretPos);
            setCurrentLineIndex(caretLine);
            setActiveLineIndex(caretLine);
            requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.setNativeProps({ selection });
            });
            return;
          }
        }
      }

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('Section picker select', { targetLineIndex: pickerLineIndex, type });
      }
      applySectionType(pickerLineIndex, type);
      setEditingSectionLineIndex(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (selectionRef.current) {
          inputRef.current?.setNativeProps({ selection: selectionRef.current });
        }
      });
    },
    [
      applySectionType,
      bodyRef,
      editingSectionLineIndex,
      pickerLineIndex,
      pickerMode,
      promptRepeatChoice,
      sectionTypes,
      setActiveLineIndex,
      setCaretIndex,
    ],
  );

  const handleSelectStartSectionType = useCallback(
    (type: SectionType) => {
      applySectionType(0, type);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        const selection = selectionRef.current ?? { start: 0, end: 0 };
        selectionRef.current = selection;
        setCaretIndex(selection.start);
        const lineIndex = getLineIndexAtChar(bodyRef.current, selection.start);
        setCurrentLineIndex(lineIndex);
        setActiveLineIndex(lineIndex);
        inputRef.current?.setNativeProps({ selection });
      });
    },
    [applySectionType, setActiveLineIndex, setCaretIndex],
  );

  const overlayTop = useMemo(() => {
    if (pickerMode !== 'new' || pickerLineIndex === null) {
      return null;
    }
    const baseTop = getLineOffset(pickerLineIndex) - scrollOffset + editorPaddingTop;
    if (!viewportHeight || !pickerHeight) {
      return Math.max(0, baseTop);
    }
    const maxTop = viewportHeight - pickerHeight - 8;
    return Math.min(Math.max(0, baseTop), maxTop);
  }, [getLineOffset, pickerHeight, pickerLineIndex, pickerMode, scrollOffset, viewportHeight]);

  const activePickerType =
    pickerLineIndex !== null && pickerMode === 'edit'
      ? sectionTypes[pickerLineIndex] ?? null
      : editingSectionLineIndex !== null
        ? sectionTypes[editingSectionLineIndex] ?? null
        : null;

  const computeBadgeTop = useCallback(
    (lineIndex: number) =>
      getLineOffset(lineIndex) - scrollOffset + editorPaddingTop - BADGE_HEIGHT - BADGE_GAP + BADGE_Y_OFFSET,
    [BADGE_GAP, BADGE_HEIGHT, BADGE_Y_OFFSET, getLineOffset, scrollOffset],
  );

  useEffect(() => {
    if (pickerMode !== 'new' || pickerLineIndex === null || overlayTop === null) {
      lastAutoScrollKey.current = null;
      return;
    }
    if (!viewportHeight) {
      return;
    }
    if (isDraggingRef.current) {
      return;
    }

    const pickerHeightWithFallback = pickerHeight || FALLBACK_PICKER_HEIGHT;
    const absolutePickerTop = overlayTop + scrollOffset;
    const absolutePickerBottom = absolutePickerTop + pickerHeightWithFallback;
    const lineTop = getLineOffset(pickerLineIndex) + editorPaddingTop;
    const lineBottom = lineTop + (fallbackHeights[pickerLineIndex] ?? editorLineHeight);
    const desiredTop = Math.min(absolutePickerTop, lineTop);
    const desiredBottom = Math.max(absolutePickerBottom, lineBottom);
    const lowerBound = desiredBottom - (viewportHeight - VISIBILITY_MARGIN);
    const upperBound = desiredTop - VISIBILITY_MARGIN;
    const autoScrollKey = `${pickerLineIndex}-${pickerHeightWithFallback}-${Math.round(overlayTop)}-${Math.round(viewportHeight)}`;

    if (lastAutoScrollKey.current === autoScrollKey) {
      return;
    }

    let targetY = scrollOffset;
    if (targetY < lowerBound) {
      targetY = lowerBound;
    } else if (targetY > upperBound) {
      targetY = upperBound;
    }

    const extraBottomPadding = 24 + editorPaddingBottom + (showRhymePanel ? rhymePanelHeight : 0);
    const estimatedContentHeight = gutterHeight + editorPaddingTop + editorPaddingBottom + extraBottomPadding;
    const maxScroll = Math.max(0, estimatedContentHeight - viewportHeight);
    targetY = Math.max(0, Math.min(targetY, maxScroll));

    if (Math.abs(targetY - scrollOffset) < AUTO_SCROLL_EPSILON) {
      lastAutoScrollKey.current = autoScrollKey;
      return;
    }

    lastAutoScrollKey.current = autoScrollKey;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [
    FALLBACK_PICKER_HEIGHT,
    VISIBILITY_MARGIN,
    AUTO_SCROLL_EPSILON,
    gutterHeight,
    pickerHeight,
    pickerLineIndex,
    pickerMode,
    overlayTop,
    viewportHeight,
    scrollOffset,
    getLineOffset,
    fallbackHeights,
    showRhymePanel,
    rhymePanelHeight,
  ]);

  const shouldShowStartPicker = useMemo(() => {
    const hasStartType = sectionTypes[0] !== undefined;
    return isEmpty && !hasStartType && isEditorFocused;
  }, [isEditorFocused, isEmpty, sectionTypes]);

  const textLeft = useMemo(() => lineNumberWidth + editorHorizontalPadding * 2, [lineNumberWidth]);

  const startPickerTop = useMemo(() => {
    if (!shouldShowStartPicker) {
      return null;
    }
    const offset = editorPaddingTop + editorLineHeight * 0.25;
    return Math.max(0, offset - scrollOffset);
  }, [scrollOffset, shouldShowStartPicker]);

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
            <View
              className="flex-1 rounded-lg bg-white"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: 24 + editorPaddingBottom + (showRhymePanel ? rhymePanelHeight : 0),
                }}
                onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
                onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
                onScrollBeginDrag={() => {
                  isDraggingRef.current = true;
                }}
                onScrollEndDrag={() => {
                  isDraggingRef.current = false;
                }}
                onMomentumScrollEnd={() => {
                  isDraggingRef.current = false;
                }}
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
                        numberOfLines={1}
                        style={{
                          height: fallbackHeights[index],
                          lineHeight: editorLineHeight,
                          fontSize: 12,
                          color: '#9CA3AF',
                          paddingTop: GUTTER_NUMBER_Y_OFFSET,
                        }}
                        className="text-right font-mono"
                      >
                        {displayedLineNumbers[index] ?? ''}
                      </Text>
                    ))}
                  </View>
                  <View
                    className="flex-1"
                    style={{ paddingTop: editorPaddingTop, paddingBottom: editorPaddingBottom }}
                    onLayout={(event: LayoutChangeEvent) => setTextColumnWidth(event.nativeEvent.layout.width)}
                  >
                    <TextInput
                      ref={inputRef}
                      value={body}
                      multiline
                      scrollEnabled={false}
                      onChangeText={handleChangeBody}
                      onSelectionChange={handleSelectionChange}
                      onContentSizeChange={handleContentSizeChange}
                      onFocus={() => setIsEditorFocused(true)}
                      onBlur={() => setIsEditorFocused(false)}
                      style={{
                        minHeight: gutterHeight,
                        flexGrow: 1,
                        lineHeight: editorLineHeight,
                        fontSize: editorFontSize,
                        paddingHorizontal: editorHorizontalPadding,
                        paddingVertical: 0,
                        color: '#111827',
                        textAlignVertical: 'top',
                      }}
                      className="font-mono text-ink"
                      placeholderTextColor="#9CA3AF"
                      selectionColor="#9DACFF"
                      cursorColor="#9DACFF"
                      autoCorrect={false}
                      autoCapitalize="sentences"
                      underlineColorAndroid="transparent"
                      placeholder={shouldShowStartPicker ? '' : 'Start writing your verse...'}
                    />
                  </View>
                </View>
              </ScrollView>
              {shouldShowStartPicker && startPickerTop !== null && (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: startPickerTop,
                    left: textLeft,
                    right: editorHorizontalPadding,
                  }}
                >
                  <SectionChipsRow
                    startLineIndex={0}
                    mode="new"
                    activeType={sectionTypes[0] ?? null}
                    onSelect={handleSelectStartSectionType}
                  />
                </View>
              )}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  left: lineNumberWidth,
                  right: 0,
                  paddingTop: editorPaddingTop,
                  paddingBottom: editorPaddingBottom,
                  paddingHorizontal: editorHorizontalPadding,
                }}
              >
                {lines.map((line, index) => (
                  <Text
                    key={`measure-${index}`}
                    className="font-mono"
                    style={{
                      width: textColumnWidth || undefined,
                      lineHeight: editorLineHeight,
                      fontSize: editorFontSize,
                    }}
                    onLayout={(event) => handleMeasuredLineHeight(index, event.nativeEvent.layout.height)}
                  >
                    {line.length === 0 ? ' ' : line}
                  </Text>
                ))}
              </View>
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                onLayout={(event) => setBadgeViewportHeight(event.nativeEvent.layout.height)}
              >
                {sectionBadges.map(({ index, type }) => {
                  if (editingSectionLineIndex === index) {
                    return null;
                  }
                  const colors = SECTION_TYPE_COLORS[type];
                  const top = computeBadgeTop(index);
                  const cullMargin = 80;
                  if (badgeViewportHeight && top > badgeViewportHeight + cullMargin) {
                    return null;
                  }
                  return (
                    <View
                      key={`badge-${index}`}
                      pointerEvents="box-none"
                      style={{
                        position: 'absolute',
                        top,
                        left: lineNumberWidth + editorHorizontalPadding,
                      }}
                    >
                      <Pressable
                        pointerEvents="auto"
                        onPress={() => {
                          setPickerMode('edit');
                          setPickerLineIndex(null);
                          setEditingSectionLineIndex(index);
                        }}
                        className="rounded-full px-2.5 py-1"
                        style={{
                          backgroundColor: colors.tint,
                          borderColor: colors.accent,
                          borderWidth: 1,
                        }}
                      >
                        <Text
                          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                          style={{ color: colors.accent }}
                        >
                          {type.replace('-', ' ').toUpperCase()}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              {pickerMode === 'new' && pickerLineIndex !== null && overlayTop !== null && (
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
                    mode={pickerMode}
                    activeType={activePickerType}
                    onSelect={handleSelectSectionType}
                  />
                </View>
              )}
              {editingSectionLineIndex !== null && (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: (() => {
                      const pickerH = editPickerHeight || EDIT_PICKER_EST_HEIGHT;
                      const badgeTop = computeBadgeTop(editingSectionLineIndex);
                      const boundedTop =
                        badgeViewportHeight !== 0
                          ? Math.max(0, Math.min(badgeTop, badgeViewportHeight - pickerH))
                          : Math.max(0, badgeTop);
                      return boundedTop;
                    })(),
                    left: lineNumberWidth + editorHorizontalPadding,
                    right: editorHorizontalPadding,
                  }}
                >
                  <Pressable
                    pointerEvents="auto"
                    onPress={() => setEditingSectionLineIndex(null)}
                    style={{
                      position: 'absolute',
                      top: -32,
                      bottom: -32,
                      left: -40,
                      right: -40,
                    }}
                  />
                  <SectionChipsRow
                    startLineIndex={editingSectionLineIndex}
                    mode="edit"
                    activeType={sectionTypes[editingSectionLineIndex] ?? null}
                    onSelect={handleSelectSectionType}
                    onLayout={(event) => setEditPickerHeight(event.nativeEvent.layout.height || EDIT_PICKER_EST_HEIGHT)}
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
