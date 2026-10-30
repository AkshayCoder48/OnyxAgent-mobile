import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { useDrawerGesture, type DrawerApi } from '../hooks/useDrawerGesture';
import { useOnyxStore } from '../store';
import { useTheme } from '../theme';
import ConversationSidebar from './ConversationSidebar';

type AppDrawerProps = {
  /** Render-prop: receives the drawer API so the chat screen can react to
   *  drawer motion live (header morph, etc.). */
  children: (drawer: DrawerApi) => ReactElement;
  /** Called when the sidebar asks for the settings sheet. */
  onOpenSettings: () => void;
};

/**
 * Drawer shell over the chat screen.
 *
 * Layer order (later siblings sit on top):
 *   1. main content  — subtly reacts to the drawer (parallax + scale)
 *   2. edge strip    — 28px invisible strip carrying the edge-swipe open pan
 *   3. backdrop      — dims with drawer progress; tap or swipe closes
 *   4. drawer surface — the sidebar; swipe-to-close with live tracking
 *
 * Every visual is a pure function of the shared value x — no React state
 * changes while the drawer moves. The drawer content (ConversationSidebar)
 * reads conversations straight from the app store.
 */
export default function AppDrawer({ children, onOpenSettings }: AppDrawerProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Drawer width: W = min(screenWidth * 0.82, 320).
  const W = Math.min(screenWidth * 0.82, 320);
  const drawer = useDrawerGesture(W);
  const { x, open, closeDrawer, edgePan, surfacePan, backdropPan } = drawer;

  // Conversation rows switch the active thread, then spring the drawer shut.
  const selectConversation = useMemo(() => {
    return (id: string) => {
      useOnyxStore.getState().selectConversation(id);
      closeDrawer();
    };
  }, [closeDrawer]);

  const handleNewChat = useMemo(() => {
    return () => {
      useOnyxStore.getState().createConversation();
      closeDrawer();
    };
  }, [closeDrawer]);

  const handleOpenSettings = useMemo(() => {
    return () => {
      // Settings opens above a closed drawer — close first for context.
      closeDrawer();
      onOpenSettings();
    };
  }, [closeDrawer, onOpenSettings]);

  // Tap the backdrop → spring closed. Raced with the backdrop pan so a swipe
  // never double-fires a close.
  const backdropTap = useMemo(
    () =>
      Gesture.Tap().onEnd((_event, success) => {
        'worklet';
        if (success) {
          runOnJS(closeDrawer)();
        }
      }),
    [closeDrawer],
  );

  const backdropGesture = useMemo(
    () => Gesture.Race(backdropPan, backdropTap),
    [backdropPan, backdropTap],
  );

  // Backdrop opacity = drawer progress, live.
  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: interpolate(x.value, [-W, 0], [0, 0.7], Extrapolation.CLAMP),
    };
  });

  // While any drag (or settle spring) is active, the main content subtly
  // reacts: it drifts a quarter of the drawer width and shrinks 2 %.
  const contentStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(x.value, [-W, 0], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: progress * W * 0.25 },
        { scale: 1 - progress * 0.02 },
      ],
    };
  });

  const drawerStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: x.value }] };
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* 1 — Main chat content. */}
      <Animated.View style={[styles.content, contentStyle]}>
        {children(drawer)}
      </Animated.View>

      {/* 2 — Invisible edge strip: absolute, left 0, width 28, full height,
             above the content. Carries the edge-swipe open gesture; vertical
             drags fail the pan and pass through, so the list still scrolls. */}
      <GestureDetector gesture={edgePan}>
        <View style={styles.edgeStrip} />
      </GestureDetector>

      {/* 3 — Backdrop. pointerEvents flips with the open flag (a React state
              change once per gesture — never per frame). */}
      <Animated.View
        style={[styles.backdrop, backdropStyle]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <GestureDetector gesture={backdropGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </Animated.View>

      {/* 4 — Drawer surface: swipe-to-close, live finger tracking. */}
      <Animated.View
        style={[
          styles.drawerSurface,
          {
            width: W,
            backgroundColor: colors.secondary,
            borderRightColor: colors.border,
          },
          drawerStyle,
        ]}
      >
        <GestureDetector gesture={surfacePan}>
          <ConversationSidebar
            onSelect={selectConversation}
            onNewChat={handleNewChat}
            onOpenSettings={handleOpenSettings}
          />
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  edgeStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 28 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  drawerSurface: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 10, height: 0 },
    elevation: 18,
  },
});
