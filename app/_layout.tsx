import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { useRefrainStore } from '../store/useRefrainStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const { session, status, restoreSession } = useAuthStore((state) => ({
    session: state.session,
    status: state.status,
    restoreSession: state.restoreSession,
  }));
  const resetLibrary = useRefrainStore((state) => state.reset);

  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) {
        return;
      }
      const hasAuthParams = url.includes('code=') && url.includes('code_verifier=');
      if (!hasAuthParams) {
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) {
        console.warn('Supabase auth redirect failed', error.message);
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      void handleDeepLink(event.url);
    });

    void Linking.getInitialURL().then((url) => handleDeepLink(url));

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const isChecking = status === 'loading' || status === 'idle';
    if (isChecking) {
      return;
    }
    const onLoginRoute = pathname.startsWith('/login');
    if (!session && !onLoginRoute) {
      console.info('[auth] redirecting to /login (no active session)');
      resetLibrary();
      router.replace('/login');
      return;
    }
    if (session && onLoginRoute) {
      console.info('[auth] session detected, redirecting to /library');
      router.replace('/library');
    }
  }, [pathname, resetLibrary, router, session, status]);

  const isCheckingAuth = useMemo(
    () => status === 'loading' || status === 'idle',
    [status],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {isCheckingAuth ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#9DACFF" />
            </View>
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            />
          )}
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
