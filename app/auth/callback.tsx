import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../store/useAuthStore';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const handleOAuthCallback = useAuthStore((state) => state.handleOAuthCallback);

  useEffect(() => {
    const finishAuth = async () => {
      const url = (await Linking.getInitialURL()) ?? null;
      await handleOAuthCallback(url);
      router.replace('/');
    };

    finishAuth().catch((error) => {
      router.replace('/login');
    });
  }, [handleOAuthCallback, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <ActivityIndicator color="#9DACFF" />
      <Text style={{ marginTop: 12, color: '#374151' }}>Completing sign-in...</Text>
    </View>
  );
}
