import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '../components/profile/UserAvatar';
import { getUserProfile } from '../lib/userProfile';
import { useAuthStore } from '../store/useAuthStore';

const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <View
    className="mt-4 rounded-2xl bg-white p-4"
    style={{
      borderColor: '#E3E5F0',
      borderWidth: 1,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 2,
    }}
  >
    <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</Text>
    <View className="mt-3">{children}</View>
  </View>
);

interface RowProps {
  label: string;
  value?: string;
  helper?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap | null;
  onPress?: () => void;
  destructive?: boolean;
}

const Row = ({
  label,
  value,
  helper,
  icon,
  rightIcon = 'chevron-forward',
  onPress,
  destructive = false,
}: RowProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center rounded-xl px-2 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ translateY: pressed && onPress ? 1 : 0 }],
      })}
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-accentSoft">
        <Ionicons name={icon ?? 'person-circle-outline'} size={20} color={destructive ? '#DC2626' : '#7C8FFF'} />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${destructive ? 'text-red-500' : 'text-ink'}`}>{label}</Text>
        {value ? <Text className="text-sm text-muted/80">{value}</Text> : null}
        {helper ? <Text className="text-xs text-muted/70">{helper}</Text> : null}
      </View>
      {rightIcon && (
        <Ionicons
          name={rightIcon}
          size={16}
          color={destructive ? '#DC2626' : '#9DACFF'}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore((state) => ({
    user: state.user,
    signOut: state.signOut,
  }));
  const [isSigningOut, setIsSigningOut] = useState(false);

  const profile = useMemo(() => getUserProfile(user), [user]);
  const appVersion = Constants?.expoConfig?.version ?? Constants?.manifest?.version ?? '0.0.0';

  const handlePlaceholder = (title: string) => {
    Alert.alert(title, 'This action will be available soon.');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Account deletion is not available yet. Contact support to remove your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Understood', style: 'destructive' },
      ],
    );
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not sign out. Please try again.';
      Alert.alert('Sign out failed', message);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View
      className="flex-1 bg-accentSoft"
      style={{ paddingTop: insets.top + 10 }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-center justify-between px-1">
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
            <Ionicons name="chevron-back" size={18} color="#7C8FFF" />
            <Text className="ml-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7C8FFF]">
              Back
            </Text>
          </Pressable>

          <Text className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Profile</Text>
        </View>

        <View className="rounded-2xl bg-white p-4" style={{ borderColor: '#E3E5F0', borderWidth: 1 }}>
          <View className="flex-row items-center">
            <UserAvatar size={64} uri={profile.avatarUrl} initials={profile.initials} />
            <View className="ml-3 flex-1">
              <Text className="text-xl font-semibold text-ink">{profile.displayName}</Text>
              <Text className="text-sm text-muted/80">{profile.email}</Text>
            </View>
          </View>
        </View>

        <SectionCard title="Account">
          <Row
            label="Sign out"
            value={isSigningOut ? 'Signing out...' : 'Switch accounts or exit'}
            icon="log-out-outline"
            rightIcon={null}
            onPress={isSigningOut ? undefined : handleSignOut}
          />
        </SectionCard>

        <SectionCard title="Your data">
          <Row
            label="Manage recordings"
            helper="Review and clean up takes"
            icon="mic-outline"
            onPress={() => handlePlaceholder('Manage recordings')}
          />
          <Row
            label="Manage lyrics"
            helper="Organize drafts and collections"
            icon="musical-notes-outline"
            onPress={() => handlePlaceholder('Manage lyrics')}
          />
        </SectionCard>

        <SectionCard title="App">
          <Row
            label="Help / Support"
            helper="Get in touch with the team"
            icon="help-buoy-outline"
            onPress={() => handlePlaceholder('Help / Support')}
          />
          <Row
            label="Privacy policy"
            icon="shield-checkmark-outline"
            onPress={() => handlePlaceholder('Privacy policy')}
          />
          <Row
            label="Terms"
            icon="document-text-outline"
            onPress={() => handlePlaceholder('Terms')}
          />
          <Row
            label="Version"
            value={`v${appVersion}`}
            icon="information-circle-outline"
            rightIcon={null}
          />
        </SectionCard>

        <SectionCard title="Danger zone">
          <Row
            label="Delete account"
            helper="Remove your data from Refrain"
            icon="trash-outline"
            rightIcon="chevron-forward"
            onPress={handleDeleteAccount}
            destructive
          />
        </SectionCard>
      </ScrollView>
    </View>
  );
}
