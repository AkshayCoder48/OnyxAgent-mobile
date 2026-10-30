import { useMemo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Panel max height as a fraction of the sheet viewport. */
  maxHeightFraction?: number;
};

/**
 * Reusable bottom sheet: dimmed backdrop + spring-slid panel, mounted
 * in-tree at the app root (renders above the drawer). Both enter AND exit
 * animate through Moti — the panel's translateY is driven by the `open`
 * prop, so closing plays the reverse spring instead of vanishing.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxHeightFraction = 0.78,
}: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // The panel is anchored to the bottom and never taller than
  // maxHeightFraction of the window, so a full-window-height translateY is
  // always enough to park it fully off-screen when closed. (A fixed 640 was
  // shorter than the panel on tall devices, leaving a closed-sheet peek.)
  const { height: windowHeight } = useWindowDimensions();

  const backdrop = useMemo(
    () => (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ type: 'timing', duration: 180 }}
        style={StyleSheet.absoluteFill}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Pressable
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: 0.62 }]}
        />
      </MotiView>
    ),
    [open, onClose, colors.scrim, title],
  );

  return (
    <View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.root]}>
      {backdrop}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <MotiView
          from={{ translateY: windowHeight }}
          animate={{ translateY: open ? 0 : windowHeight }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              maxHeight: `${Math.round(maxHeightFraction * 100)}%`,
            },
          ]}
        >
          <View style={styles.grabRow}>
            <View style={[styles.grabHandle, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.secondary },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
          <View style={{ height: Math.max(insets.bottom, 12) }} />
        </MotiView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 90 },
  kav: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  grabHandle: { width: 36, height: 4, borderRadius: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
