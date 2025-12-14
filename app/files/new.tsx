import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useRefrainStore } from '../../store/useRefrainStore';

export default function NewFileScreen() {
  const router = useRouter();
  const { createNewFile, selectFile, init } = useRefrainStore((state) => ({
    createNewFile: state.createNewFile,
    selectFile: state.selectFile,
    init: state.init,
  }));

  useEffect(() => {
    const create = async () => {
      await init();
      const file = await createNewFile();
      selectFile(file.id);
      router.replace(`/files/${file.id}`);
    };
    void create();
  }, [createNewFile, init, router, selectFile]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-4 py-6">
      <ActivityIndicator color="#9DACFF" />
      <Text className="mt-2 text-sm text-muted/90">Creating a new refrain...</Text>
    </View>
  );
}
