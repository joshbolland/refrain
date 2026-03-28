import { View } from 'react-native';
import type { ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
}

export const SplitPane = ({ left, right }: SplitPaneProps) => (
  <View 
    className="flex-1 flex-row"
    style={{ backgroundColor: '#FAFAF7' }}
  >
    <View className="w-[360px] bg-accentSoft">{left}</View>
    <View 
      className="flex-1 px-6 py-5"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <View className="w-full">{right}</View>
    </View>
  </View>
);
