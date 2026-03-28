import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

interface RepeatBlockProps {
  top: number;
  width: number;
  previewLines: string[];
  onEditChorus(): void;
  onConvertToText(): void;
}

export const RepeatBlock = ({
  top,
  width,
  previewLines,
  onEditChorus,
  onConvertToText,
}: RepeatBlockProps) => {
  const [showMenu, setShowMenu] = useState(false);

  const limitedPreview = useMemo(() => previewLines.slice(0, 4), [previewLines]);
  const hasEllipsis = previewLines.length > limitedPreview.length;

  const handlePress = () => {
    setShowMenu((prev) => !prev);
  };

  const handleSelect = (action: 'edit' | 'convert' | 'cancel') => {
    setShowMenu(false);
    if (action === 'edit') {
      onEditChorus();
    } else if (action === 'convert') {
      onConvertToText();
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        left: 0,
        width,
      }}
    >
      <Pressable
        onPress={handlePress}
        className="rounded-lg px-3 py-2"
        style={({ pressed }) => ({
          backgroundColor: '#EEF0FF',
          borderColor: '#9DACFF',
          borderWidth: 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
          opacity: pressed ? 0.96 : 1,
        })}
      >
        <View className="mb-2 flex-row items-center">
          <View 
            className="rounded-full px-2 py-1"
            style={{ backgroundColor: 'rgba(250, 250, 247, 0.9)' }}
          >
            <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
              ↻ Chorus
            </Text>
          </View>
          <Text className="ml-2 text-[12px] uppercase tracking-[0.12em] text-accent/80">
            Tap to edit or convert
          </Text>
        </View>
        <View className="space-y-1">
          {limitedPreview.map((line, index) => (
            <Text key={`${line}-${index}`} className="text-sm text-ink/90">
              {line.trim().length > 0 ? line : ' '}
            </Text>
          ))}
          {hasEllipsis ? <Text className="text-sm text-muted/80">…</Text> : null}
          {limitedPreview.length === 0 ? (
            <Text className="text-sm text-muted/80">Chorus preview unavailable.</Text>
          ) : null}
        </View>
      </Pressable>
      {showMenu ? (
        <View
          className="mt-2 w-full rounded-lg shadow"
          style={{
            backgroundColor: '#FAFAF7',
            borderColor: '#E5E7EB',
            borderWidth: 1,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <Pressable
            onPress={() => handleSelect('edit')}
            className="px-4 py-3"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#F3F4F6' : 'transparent',
            })}
          >
            <Text className="text-sm font-semibold text-accent">Edit Chorus</Text>
            <Text className="text-xs text-muted/80">Jump to the original chorus</Text>
          </Pressable>
          <View className="h-px bg-[#E5E7EB]" />
          <Pressable
            onPress={() => handleSelect('convert')}
            className="px-4 py-3"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#F3F4F6' : 'transparent',
            })}
          >
            <Text className="text-sm font-semibold text-ink">Convert to text</Text>
            <Text className="text-xs text-muted/80">Insert chorus lines here</Text>
          </Pressable>
          <View className="h-px bg-[#E5E7EB]" />
          <Pressable
            onPress={() => handleSelect('cancel')}
            className="px-4 py-3"
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#F3F4F6' : 'transparent',
            })}
          >
            <Text className="text-sm font-semibold text-muted/80">Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};
