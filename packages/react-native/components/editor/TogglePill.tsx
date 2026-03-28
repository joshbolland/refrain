import { Pressable, Text } from 'react-native';

type TogglePillProps = {
  label: string;
  isActive: boolean;
  onPress: () => void;
};

export const TogglePill = ({ label, isActive, onPress }: TogglePillProps) => {
  const primaryColor = '#9DACFF';
  const inactiveBackground = '#E8EBFF';
  const inactiveBorder = '#C7D1FF';
  const inactiveTextColor = '#7C8FFF';
  const activeTextColor = '#0B1024';
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-full bg-accentSoft px-3 py-1.5"
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? '#D7DDFF'
          : isActive
            ? primaryColor
            : inactiveBackground,
        borderColor: isActive ? primaryColor : inactiveBorder,
        borderWidth: 1,
        opacity: pressed ? 0.9 : 1,
        transform: [{ translateY: pressed ? 1 : 0 }],
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOpacity: isActive ? 0.12 : 0,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: isActive ? 2 : 0 },
      })}
    >
      <Text
        className="text-xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: isActive ? activeTextColor : inactiveTextColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
