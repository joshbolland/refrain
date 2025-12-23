import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';

interface UserAvatarProps {
  size?: number;
  uri?: string | null;
  initials?: string;
  isLoading?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
  hitSlop?: number | { top?: number; right?: number; bottom?: number; left?: number };
  style?: StyleProp<ViewStyle>;
}

export const UserAvatar = ({
  size = 34,
  uri,
  initials,
  isLoading = false,
  accessibilityLabel,
  onPress,
  hitSlop = { top: 8, right: 8, bottom: 8, left: 8 },
  style,
}: UserAvatarProps) => {
  const dimension = useMemo(() => ({ width: size, height: size, borderRadius: size / 2 }), [size]);

  const avatarContent = (
    <View
      style={[
        {
          backgroundColor: '#E8EBFF',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        dimension,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            resizeMode: 'cover',
          }}
        />
      ) : isLoading ? (
        <ActivityIndicator size="small" color="#7C8FFF" />
      ) : (
        <Text className="text-base font-semibold text-accent">{initials}</Text>
      )}
    </View>
  );

  if (!onPress) {
    return avatarContent;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      {avatarContent}
    </Pressable>
  );
};
