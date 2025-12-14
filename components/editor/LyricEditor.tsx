import { useEffect, useMemo, useRef, useState } from 'react';
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

const findWordAtSelection = (text: string, position: number): string | null => {
  if (position < 0) {
    return null;
  }

  const left = text.slice(0, position).match(/[A-Za-z']+$/)?.[0] ?? '';
  const right = text.slice(position).match(/^[A-Za-z']+/)?.[0] ?? '';
  const word = `${left}${right}`;
  return word.length > 0 ? word.toLowerCase() : null;
};

const findLineIndex = (text: string, position: number): number => {
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
      setEditorSelection(null);
      setSelectedWord(null);
      setActiveLineIndex(-1);
      return;
    }
    setBody(selectedFile.body ?? '');
  }, [selectedFile, setActiveLineIndex, setEditorSelection, setSelectedWord]);

  const lines = useMemo(() => body.split('\n'), [body]);
  const gutterHeight = Math.max(inputHeight, editorLineHeight * lines.length);
  const targetRhymeWord = selectedWord;

  const handleChangeBody = (text: string) => {
    setBody(text);
    void updateSelectedFile({ body: text });
  };

  const handleSelectionChange = (
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    const selection = event.nativeEvent.selection;
    setEditorSelection(selection);
    const lineIndex = findLineIndex(body, selection.start);
    setActiveLineIndex(lineIndex);
    const word = findWordAtSelection(body, selection.start);
    setSelectedWord(word);
  };

  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const nextHeight = event.nativeEvent.contentSize.height;
    if (Number.isFinite(nextHeight)) {
      setInputHeight((prev) => (prev === nextHeight ? prev : Math.max(nextHeight, editorLineHeight * 6)));
    }
  };

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
            <View className="flex-1 rounded-lg bg-white">
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: 24 + editorPaddingBottom + (showRhymePanel ? rhymePanelHeight : 0),
                }}
              >
                <View className="flex-row">
                  <View
                    style={{
                      paddingTop: editorPaddingTop,
                      paddingBottom: editorPaddingBottom,
                      paddingHorizontal: 12,
                      minHeight: gutterHeight,
                    }}
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
