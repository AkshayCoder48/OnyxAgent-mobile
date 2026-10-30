import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useOnyxStore } from '../store';
import { shortModelName } from '../lib/pollinations';
import type { DrawerApi } from '../hooks/useDrawerGesture';
import { useTheme } from '../theme';

type ChatHeaderProps = {
  drawer: DrawerApi;
  /** Opens the model picker sheet. */
  onOpenModelPicker: () => void;
};

/**
 * Top bar (web glass top bar): menu button (morphs menu → × live off the
 * drawer shared value), the conversation title (serif-weight display text,
 * "New conversation" fallback) and the model chip, which opens the model
 * picker sheet.
 */
export default function ChatHeader({ drawer, onOpenModelPicker }: ChatHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { x, W, openDrawer } = drawer;

  const title = useOnyxStore((s) => {
    const conversation = s.conversations.find((c) => c.id === s.activeConversationId);
    return conversation?.title ?? 'New conversation';
  });
  const modelLabel = useOnyxStore((s) => shortModelName(s.settings.defaultModel));

  // The hamburger morphs into an × as the drawer opens — driven LIVE by the
  // shared x value (drags and springs both animate through it), never by
  // React state. 0 = hamburger, 1 = ×.
  const topLineStyle = useAnimatedStyle(() => {
    'worklet';
    const p = interpolate(x.value, [-W, 0], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: p * 6 }, { rotate: `${-p * 45}deg` }],
    };
  });
  const bottomLineStyle = useAnimatedStyle(() => {
    'worklet';
    const p = interpolate(x.value, [-W, 0], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: -p * 6 }, { rotate: `${p * 45}deg` }],
    };
  });
  const middleLineStyle = useAnimatedStyle(() => {
    'worklet';
    const p = interpolate(x.value, [-W, 0], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - p };
  });

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          // Left inset clears the 28px edge-swipe strip (which sits above the
          // content in AppDrawer) so the button stays tappable at rest.
          paddingTop: insets.top + 8,
          paddingLeft: 32,
          paddingRight: 12,
        },
      ]}
    >
      <Pressable
        onPress={openDrawer}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Open conversations drawer"
        style={styles.menuButton}
      >
        <Animated.View style={[styles.menuLine, { backgroundColor: colors.foreground }, topLineStyle]} />
        <Animated.View style={[styles.menuLine, { backgroundColor: colors.foreground }, middleLineStyle]} />
        <Animated.View style={[styles.menuLine, { backgroundColor: colors.foreground }, bottomLineStyle]} />
      </Pressable>

      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change model"
        onPress={onOpenModelPicker}
        hitSlop={6}
        style={({ pressed }) => [
          styles.modelChip,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="hardware-chip-outline" size={11} color={colors.primary} />
        <Text style={[styles.modelChipText, { color: colors.foreground }]} numberOfLines={1}>
          {modelLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  menuButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  center: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 132,
  },
  modelChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
