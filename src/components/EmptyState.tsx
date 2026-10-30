import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { useTheme } from '../theme';

type EmptyStateProps = {
  /** contentOffset.y of the scroll container — negative while iOS-bouncing. */
  scrollY: SharedValue<number>;
  onPick: (prompt: string) => void;
};

/** Feature badges — verbatim web labels. */
const FEATURES = [
  { icon: 'code-slash-outline', label: '22 Tools · 50+ Actions' },
  { icon: 'construct-outline', label: 'Code Runner' },
  { icon: 'folder-open-outline', label: 'File System' },
  { icon: 'globe-outline', label: 'Web Search' },
  { icon: 'bulb-outline', label: 'Memory' },
  { icon: 'sparkles-outline', label: 'Workflows' },
] as const;

/** Prompt cards — verbatim web titles + prompts. */
const PROMPTS = [
  {
    icon: 'code-slash-outline' as const,
    color: '#3B82F6',
    title: 'Write some code',
    prompt: 'Write a Python function that hashes a password with bcrypt and verifies it.',
  },
  {
    icon: 'document-text-outline' as const,
    color: '#10B981',
    title: 'Analyze files',
    prompt: 'List all files in my workspace and summarize what each one does.',
  },
  {
    icon: 'globe-outline' as const,
    color: '#22D3EE',
    title: 'Search the web',
    prompt: 'Search the web for the latest news about AI agents and summarize the top 3 results.',
  },
  {
    icon: 'bulb-outline' as const,
    color: '#F97316',
    title: 'Brainstorm ideas',
    prompt: 'Give me 5 ideas for an onboarding email sequence for a developer tool.',
  },
] as const;

/** The personality orb — pulsing cyan core in a wash ring (web PersonalityOrb). */
function Orb() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.orbOuter, { borderColor: colors.accentMuted, backgroundColor: colors.accent }]}
    >
      <MotiView
        from={{ opacity: 0.55, scale: 0.86 }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.86, 1, 0.86] }}
        transition={{ type: 'timing', duration: 1600, loop: true }}
        style={[styles.orbCore, { backgroundColor: colors.primary }]}
      />
    </View>
  );
}

/**
 * The chat empty state — a total port of the web's ChatEmptyState (orb,
 * "Welcome to OnyxAgent", subtitle, feature badges, prompt cards, footer),
 * plus the scroll BULGE: when the container overscrolls at the top
 * (contentOffset.y < 0 on iOS bounce) the whole state scales up with the
 * pull —
 *   scale      = 1 + min(-y / 240, 0.15)   (capped at +15 %)
 *   translateY = y * 0.5                   (slides up at half speed)
 * On Android 12+ the OS stretch overscroll (overScrollMode="always") provides
 * the native rubber-band, so the native stretch is the effect there.
 */
export default function EmptyState({ scrollY, onPick }: EmptyStateProps) {
  const { colors, fonts } = useTheme();

  const bulgeStyle = useAnimatedStyle(() => {
    'worklet';
    const y = scrollY.value;
    // Only the top overscroll (y < 0) bulges; regular scrolling is identity.
    const overscroll = Math.min(y, 0);
    const scale = 1 + Math.min(-overscroll / 240, 0.15);
    const translateY = overscroll * 0.5;
    return { transform: [{ translateY }, { scale }] };
  });

  return (
    <Animated.View style={[styles.root, bulgeStyle]}>
      <Orb />

      {/* Title — "Welcome to" + the decorated OnyxAgent wordmark. */}
      <Text style={[styles.title, { color: colors.foreground }]}>
        Welcome to{' '}
        <Text style={{ fontFamily: fonts.sansBold }}>
          <Text style={{ color: colors.primary, fontStyle: 'italic' }}>O</Text>
          nyx
          <Text style={{ color: colors.mutedForeground }}>Agent</Text>
        </Text>
      </Text>

      {/* Subtitle — verbatim web copy. */}
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your AI-powered assistant with 22 tools (50+ actions), code execution, web search, file
        management, memory, and more. Start a conversation or pick a prompt below.
      </Text>

      {/* Feature badges. */}
      <View style={styles.badges}>
        {FEATURES.map((f) => (
          <View
            key={f.label}
            style={[
              styles.badge,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name={f.icon} size={10} color={colors.mutedForeground} />
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* Prompt cards — staggered entrance, tap to send. */}
      <View style={styles.cards}>
        {PROMPTS.map((p, index) => (
          <MotiView
            key={p.title}
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 260, delay: 60 + index * 50 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={p.title}
              onPress={() => onPick(p.prompt)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
              ]}
            >
              <Ionicons
                name={p.icon}
                size={17}
                color={p.color}
                style={{ marginTop: 1 }}
              />
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.title}</Text>
                <Text
                  numberOfLines={2}
                  style={[styles.cardPrompt, { color: colors.mutedForeground }]}
                >
                  {p.prompt}
                </Text>
              </View>
            </Pressable>
          </MotiView>
        ))}
      </View>

      {/* Footer. */}
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Powered by Onyx AI Framework
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 20,
  },
  orbOuter: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  orbCore: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 330,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  badgeText: { fontSize: 9.5, fontWeight: '500' },
  cards: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 13.5, fontWeight: '600' },
  cardPrompt: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  footer: { fontSize: 11, marginTop: 16 },
});
