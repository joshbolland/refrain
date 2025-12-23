import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../store/useAuthStore';

export default function LoginScreen() {
  const { signInWithPassword, signUp, signInWithOAuth, status, error } = useAuthStore((state) => ({
    signInWithPassword: state.signInWithPassword,
    signUp: state.signUp,
    signInWithOAuth: state.signInWithOAuth,
    status: state.status,
    error: state.error,
  }));
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [message, setMessage] = useState<string | null>(null);

  const isLoading = status === 'loading';
  const isSignUp = mode === 'sign-up';
  const passwordsMatch = !isSignUp || password === confirmPassword;
  const canSubmit = isSignUp
    ? Boolean(email.trim() && firstName.trim() && lastName.trim() && password && confirmPassword && passwordsMatch)
    : Boolean(email.trim() && password);

  const handleAuth = async () => {
    setMessage(null);
    if (isSignUp && password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    try {
      if (isSignUp) {
        await signUp({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        setMessage(null);
      } else {
        await signInWithPassword(email.trim(), password);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not sign in.');
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setMessage(null);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not start sign-in.');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/splash.jpg')}
      defaultSource={require('../assets/images/splash.jpg')}
      style={{ flex: 1 }}
      resizeMode="cover"
      blurRadius={4}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.2)']}
        locations={[0.1, 0.55, 0.95]}
        style={{ ...StyleSheet.absoluteFillObject }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ marginBottom: 28 }}>
              <Text className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: '#4B5563' }}>
                {isSignUp ? 'Create account' : 'Welcome back'}
              </Text>
              <Text className="mt-2 text-3xl font-semibold text-ink">
                {isSignUp ? 'Join Refrain' : 'Sign in to Refrain'}
              </Text>
              <Text className="mt-2 text-sm text-ink" style={{ color: '#3F3F46' }}>
                {isSignUp
                  ? 'Use your name, email, and a password to start saving your lyrics.'
                  : 'Sign in with your password or continue with a provider to sync your lyrics across devices.'}
              </Text>
            </View>

            <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 24 }}>
              <BlurView
                intensity={60}
                tint="light"
                style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.38)' }}
                experimentalBlurMethod="dimezisBlurView"
              />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.35)']}
                locations={[0, 0.45, 1]}
                style={{ ...StyleSheet.absoluteFillObject }}
              />

              <View style={{ paddingHorizontal: 16, paddingVertical: 20, gap: 12 }}>
                {isSignUp && (
                  <>
                    <Text className="text-sm font-semibold text-ink">First name</Text>
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Syd"
                      autoCapitalize="words"
                      className="rounded-xl px-4 py-3 text-base text-ink"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.72)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.75)',
                      }}
                      selectionColor="#9DACFF"
                      cursorColor="#9DACFF"
                      placeholderTextColor="#6B7280"
                      accessibilityLabel="First name"
                      accessibilityHint="Enter your first name"
                    />
                    <Text className="text-sm font-semibold text-ink">Last name</Text>
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Barrett"
                      autoCapitalize="words"
                      className="rounded-xl px-4 py-3 text-base text-ink"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.72)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.75)',
                      }}
                      selectionColor="#9DACFF"
                      cursorColor="#9DACFF"
                      placeholderTextColor="#6B7280"
                      accessibilityLabel="Last name"
                      accessibilityHint="Enter your last name"
                    />
                  </>
                )}

                <Text className="text-sm font-semibold text-ink">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="rounded-xl px-4 py-3 text-base text-ink"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.72)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.75)',
                  }}
                  selectionColor="#9DACFF"
                  cursorColor="#9DACFF"
                  placeholderTextColor="#6B7280"
                  accessibilityLabel="Email"
                  accessibilityHint="Enter the email you use to sign in"
                />
                <Text className="text-sm font-semibold text-ink">Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  className="rounded-xl px-4 py-3 text-base text-ink"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.72)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.75)',
                  }}
                  selectionColor="#9DACFF"
                  cursorColor="#9DACFF"
                  placeholderTextColor="#6B7280"
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your password"
                />
                {isSignUp && (
                  <>
                    <Text className="text-sm font-semibold text-ink">Confirm password</Text>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      secureTextEntry
                      className="rounded-xl px-4 py-3 text-base text-ink"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.72)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.75)',
                      }}
                      selectionColor="#9DACFF"
                      cursorColor="#9DACFF"
                      placeholderTextColor="#6B7280"
                      accessibilityLabel="Confirm password"
                      accessibilityHint="Re-enter your password"
                    />
                  </>
                )}

                <Pressable
                  disabled={!canSubmit || isLoading}
                  onPress={handleAuth}
                  className="mt-1 rounded-xl bg-accent px-4 py-3"
                  style={({ pressed }) => ({
                    opacity: !canSubmit || isLoading ? 0.6 : pressed ? 0.9 : 1,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowOffset: { width: 0, height: 8 },
                    shadowRadius: 12,
                    elevation: 3,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
                >
                  <Text className="text-center text-base font-semibold text-white">
                    {isLoading ? 'Submitting...' : isSignUp ? 'Create account' : 'Sign in'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMode(isSignUp ? 'sign-in' : 'sign-up');
                    setMessage(null);
                    setConfirmPassword('');
                  }}
                  className="self-center px-3 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  accessibilityRole="button"
                  accessibilityLabel={isSignUp ? 'Switch to sign in' : 'Switch to create an account'}
                >
                  <Text className="text-xs uppercase tracking-[0.12em]" style={{ color: '#374151' }}>
                    {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
                  </Text>
                </Pressable>

                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <View className="flex-1 border-t border-white/70" />
                  <Text className="text-xs uppercase tracking-[0.12em]" style={{ color: '#4B5563' }}>
                    or continue with
                  </Text>
                  <View className="flex-1 border-t border-white/70" />
                </View>

                <View className="flex-row" style={{ columnGap: 10 }}>
                  <Pressable
                    onPress={() => void handleOAuth('google')}
                    disabled={isLoading}
                    className="flex-1 rounded-xl px-4 py-3"
                    style={({ pressed }) => ({
                      backgroundColor: 'rgba(255,255,255,0.82)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.85)',
                      opacity: isLoading ? 0.7 : pressed ? 0.9 : 1,
                      transform: [{ translateY: pressed ? 1 : 0 }],
                    })}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Google"
                  >
                    <Text className="text-center text-base font-semibold text-ink">Google</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleOAuth('apple')}
                    disabled={isLoading}
                    className="flex-1 rounded-xl px-4 py-3"
                    style={({ pressed }) => ({
                      backgroundColor: 'rgba(255,255,255,0.82)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.85)',
                      opacity: isLoading ? 0.7 : pressed ? 0.9 : 1,
                      transform: [{ translateY: pressed ? 1 : 0 }],
                    })}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                  >
                    <Text className="text-center text-base font-semibold text-ink">Apple</Text>
                  </Pressable>
                </View>

                {(message || error) && (
                  <Text className="text-sm text-accent" numberOfLines={3}>
                    {message ?? error}
                  </Text>
                )}

                {isLoading && (
                  <View className="mt-2 items-center">
                    <ActivityIndicator color="#9DACFF" />
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
