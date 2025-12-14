import { Text, View } from 'react-native';

import type { ParsedLine } from '../../analysis/parse';
import { editorFontSize } from './editorMetrics';

export type LineMeta = {
  rawIndex: number;
  rawText: string;
  isBlank: boolean;
  displayNumber: number | null;
};

interface LineNumbersProps {
  lines: ParsedLine[];
  lineMeta: LineMeta[];
  lineHeight?: number;
  lineHeights?: number[];
}

export const LineNumbers = ({
  lines,
  lineMeta,
  lineHeight = 32,
  lineHeights,
}: LineNumbersProps) => (
  <View className="mr-3 items-end pr-1">
    {lines.map((line, index) => {
      const height = lineHeights?.[index] ?? lineHeight;
      const meta = lineMeta[index];
      const parsedLine = lines[index];
      const resolvedLineNumber = meta?.displayNumber ?? null;

      return (
        <View key={index} className="justify-start" style={{ height }}>
          <Text
            className={`w-fit text-right font-mono ${
              parsedLine?.type === 'lyric' ? 'text-muted/80' : 'text-muted/60'
            }`}
            style={{
              lineHeight,
              fontSize: editorFontSize,
              opacity: resolvedLineNumber ? 1 : 0,
              marginTop: 4,
            }}
          >
            {resolvedLineNumber}
          </Text>
        </View>
      );
    })}
  </View>
);
