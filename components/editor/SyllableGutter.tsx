import { Text, View } from 'react-native';

import type { ParsedLine } from '../../analysis/parse';
import type { RhymeGroupMap } from '../../analysis/rhymes';
import { getRhymeColorClass } from './RhymeHighlighter';
import { editorMetrics } from './editorMetrics';

interface SyllableGutterProps {
  lines: ParsedLine[];
  rhymeMap: RhymeGroupMap;
  lineHeight?: number;
  showSyllables: boolean;
  activeLineIndex?: number;
  lineHeights?: number[];
  gutterPaddingTop?: number;
  gutterPaddingBottom?: number;
}

const formatCount = (line: ParsedLine): string =>
  line.type === 'lyric' && line.syllableCount && line.syllableCount > 0 ? `${line.syllableCount}` : '–';

const typeLabel = (line: ParsedLine): string => (line.type === 'annotation' ? 'NOTE' : '');

export const SyllableGutter = ({
  lines,
  rhymeMap,
  lineHeight = editorMetrics.lineHeight,
  showSyllables,
  activeLineIndex = -1,
  lineHeights,
  gutterPaddingTop = editorMetrics.paddingTop,
  gutterPaddingBottom = editorMetrics.paddingBottom,
}: SyllableGutterProps) => {
  if (!showSyllables) {
    return null;
  }

  return (
    <View
      className="mr-3 items-end pr-3"
      style={{ paddingTop: gutterPaddingTop, paddingBottom: gutterPaddingBottom }}
    >
      {lines.map((line, index) => {
        const height = lineHeights?.[index] ?? lineHeight;
        const rhyme = rhymeMap[line.index];
        const color = rhyme ? getRhymeColorClass(rhyme.groupId) : '';
        const label = typeLabel(line);
        const isActive = line.index === activeLineIndex;
        const baseColor =
          line.type === 'lyric'
            ? isActive
              ? 'text-accent'
              : 'text-muted/80'
            : 'text-muted/60 italic';

        return (
          <View key={line.index} className="flex-row items-start" style={{ height }}>
            <Text
              className={`w-7 text-right text-[10px] font-mono ${baseColor}`}
              style={{ lineHeight }}
            >
              {formatCount(line)}
            </Text>
            {label ? (
              <Text className="ml-2 text-[10px] uppercase tracking-[0.12em] text-muted/70">
                {label}
              </Text>
            ) : rhyme ? (
              <View className={`ml-2 h-2 w-2 rounded-full opacity-70 ${color}`} />
            ) : (
              <View className="ml-2 h-2 w-2" />
            )}
          </View>
        );
      })}
    </View>
  );
};
