import { useCallback } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { LyricEditor } from '../../components/editor/LyricEditor';
import { SplitPane } from '../../components/editor/SplitPane';
import { FileList } from '../../components/files/FileList';
import { useRefrainStore } from '../../store/useRefrainStore';

export default function FilesScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const init = useRefrainStore((state) => state.init);
  const refreshFiles = useRefrainStore((state) => state.refreshFiles);
  const selectFile = useRefrainStore((state) => state.selectFile);

  useFocusEffect(
    useCallback(() => {
      if (!isDesktop) {
        selectFile(null);
      }
      const loadFiles = async () => {
        await init();
        await refreshFiles();
      };
      void loadFiles();
      return () => {
        if (!isDesktop) {
          selectFile(null);
        }
      };
    }, [init, refreshFiles, isDesktop, selectFile]),
  );

  if (isDesktop) {
    return (
      <View className="flex-1 bg-white px-4 py-4">
        <SplitPane left={<FileList isDesktop />} right={<LyricEditor />} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white px-4 py-4">
      <FileList />
    </View>
  );
}
