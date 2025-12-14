import { useEffect, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { LyricEditor } from '../../components/editor/LyricEditor';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { useRefrainStore } from '../../store/useRefrainStore';

export default function FileDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? null;
  const router = useRouter();

  const { selectFile, init } = useRefrainStore((state) => ({
    selectFile: state.selectFile,
    init: state.init,
  }));

  useEffect(() => {
    void init();
  }, [init]);

  useFocusEffect(
    useCallback(() => {
      if (typeof id === 'string') {
        selectFile(id);
      }
    }, [id, selectFile]),
  );

  return (
    <View className="flex-1 bg-white px-4 py-4">
      <View className="mb-4 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center rounded-full px-3 py-1.5"
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#D7DDFF' : '#E8EBFF',
            borderColor: '#C7D1FF',
            borderWidth: 1,
            transform: [{ translateY: pressed ? 1 : 0 }],
          })}
        >
          <IconSymbol name="chevron.left" size={18} color="#7C8FFF" />
          <Text className="ml-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7C8FFF]">
            Back
          </Text>
        </Pressable>
      </View>
      <LyricEditor />
    </View>
  );
}
