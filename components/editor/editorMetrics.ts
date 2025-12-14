export const editorFontSize = 15;
export const editorLineHeight = 28;
export const editorPaddingTop = 32;
export const editorPaddingBottom = 12;
export const editorHorizontalPadding = 16; // px-4

export const editorMetrics = {
  fontSize: editorFontSize,
  lineHeight: editorLineHeight,
  paddingTop: editorPaddingTop,
  paddingBottom: editorPaddingBottom,
  horizontalPadding: editorHorizontalPadding,
} as const;

export type EditorMetrics = typeof editorMetrics;
