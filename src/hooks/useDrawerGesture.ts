import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { rubberBandClamp } from '../lib/rubberband';

/**
 * Drawer lifecycle, mirrored in the TelemetryHud.
 * 0 closed · 1 dragging · 2 settling · 3 open.
 */
export const DrawerStatus = {
  closed: 0,
  dragging: 1,
  settling: 2,
  open: 3,
} as const;

/** Release spring — stiff and slightly under-damped, feels native. */
const SPRING_CONFIG = { stiffness: 320, damping: 32 };

/** Built by Gesture.Pan() — typed without reaching into RNGH internals. */
type PanGestureType = ReturnType<typeof Gesture.Pan>;

/** Everything the app needs to read or drive the drawer. */
export type DrawerApi = {
  /** Drawer width: W = min(screenWidth * 0.82, 320). */
  W: number;
  /** React-state mirror of the position — flips backdrop pointer-events only. */
  open: boolean;
  /** Drawer translateX ∈ [-W, 0], plus rubber-band overshoot up to ±24 px. */
  x: SharedValue<number>;
  /** Live drag velocity in px/s; 0 while no gesture is active. */
  velocity: SharedValue<number>;
  /** DrawerStatus value: 0 closed · 1 dragging · 2 settling · 3 open. */
  status: SharedValue<number>;
  /** Menu button / programmatic open. */
  openDrawer: () => void;
  /** Conversation-row taps / backdrop tap / programmatic close. */
  closeDrawer: () => void;
  /** Edge-swipe open gesture (attached to the invisible left strip). */
  edgePan: PanGestureType;
  /** Swipe-to-close gesture (attached to the drawer surface). */
  surfacePan: PanGestureType;
  /** Swipe-to-close gesture (attached to the backdrop). */
  backdropPan: PanGestureType;
};

/** The subset of the pan event payload the drag math needs. */
type DragEvent = { translationX: number; velocityX: number };

/**
 * Owns all drawer motion.
 *
 * Worklet architecture (Reanimated best practice): every frame of drawer
 * motion is computed on the UI thread from shared values — the pan callbacks
 * below are worklets ('worklet' directives). The JS thread is involved only
 * via runOnJS, exactly twice per gesture: once for the open/closed state
 * flag, plus the quantized TelemetryHud updates (see TelemetryHud.tsx).
 * Nothing animates "after the gesture ends" — x follows the finger 1:1 in
 * onUpdate, and the release merely springs from wherever the finger left x.
 */
export function useDrawerGesture(W: number): DrawerApi {
  const [open, setOpen] = useState(false);

  // ---- Shared values (UI thread) -------------------------------------------
  const x = useSharedValue(-W); // translateX, clamped to [-W, 0] + rubber-band
  const velocity = useSharedValue(0); // px/s, written on every drag update
  const status = useSharedValue<number>(DrawerStatus.closed);
  // Plays the role of RNGH's per-gesture `context.startX`, kept in a shared
  // value so the callbacks stay strictly typed worklets.
  const dragStartX = useSharedValue(0);

  const openRef = useRef(false);
  openRef.current = open;

  // If the window resizes (rotation / foldable), snap back into range.
  useEffect(() => {
    x.value = openRef.current ? 0 : -W;
  }, [W, x]);

  // ---- Drag worklets (shared by all three pan gestures) --------------------
  const onDragStart = useCallback(() => {
    'worklet';
    dragStartX.value = x.value; // == context.startX
    velocity.value = 0;
    status.value = DrawerStatus.dragging;
  }, [dragStartX, x, velocity, status]);

  const onDragUpdate = useCallback(
    (event: DragEvent) => {
      'worklet';
      // LIVE finger tracking: the drawer follows translationX 1:1 on every
      // frame. rubberBandClamp keeps x inside [-W, 0]; past either edge the
      // overshoot maps sub-linearly (× 0.175) and hard-caps at ±24 px.
      velocity.value = event.velocityX;
      x.value = rubberBandClamp(dragStartX.value + event.translationX, -W, 0);
    },
    [velocity, x, dragStartX, W]
  );

  const onDragEnd = useCallback(
    (event: DragEvent) => {
      'worklet';
      velocity.value = 0;
      // Project the release ~0.25 s out: land open past the halfway point,
      // or immediately on a rightward fling above 500 px/s.
      const projected = x.value + event.velocityX * 0.25;
      const shouldOpen = projected > -W / 2 || event.velocityX > 500;
      status.value = DrawerStatus.settling;
      x.value = withSpring(shouldOpen ? 0 : -W, SPRING_CONFIG, (finished) => {
        'worklet';
        if (finished) {
          status.value = shouldOpen ? DrawerStatus.open : DrawerStatus.closed;
        }
      });
      // The only JS-thread hop per gesture: the open/closed state flag.
      runOnJS(setOpen)(shouldOpen);
    },
    [velocity, x, status, W]
  );

  // One factory builds all three pan gestures. A gesture object should not be
  // shared between GestureDetectors, so each zone gets its own instance.
  const makePan = useCallback(
    (): PanGestureType =>
      Gesture.Pan()
        // Activate on a horizontal move; vertical drags fall through so the
        // FlashLists keep scrolling.
        .activeOffsetX([-8, 8])
        .failOffsetY([-24, 24])
        .onStart(onDragStart)
        .onUpdate(onDragUpdate)
        .onEnd(onDragEnd)
        // Safety net: if the system cancels an ACTIVE drag (phone call,
        // notification shade), settle the drawer instead of freezing it.
        // status === dragging is only true after activation, so touches that
        // merely land on the zones (taps) never trigger a settle.
        .onFinalize((event) => {
          'worklet';
          if (status.value === DrawerStatus.dragging) {
            onDragEnd(event);
          }
        }),
    [onDragStart, onDragUpdate, onDragEnd, status]
  );

  const edgePan = useMemo(makePan, [makePan]);
  const surfacePan = useMemo(makePan, [makePan]);
  const backdropPan = useMemo(makePan, [makePan]);

  // ---- JS-thread helpers (menu button, conversation-row taps) ---------------
  const openDrawer = useCallback(() => {
    setOpen(true);
    status.value = DrawerStatus.settling;
    x.value = withSpring(0, SPRING_CONFIG, (finished) => {
      'worklet';
      if (finished) status.value = DrawerStatus.open;
    });
  }, [x, status]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    status.value = DrawerStatus.settling;
    x.value = withSpring(-W, SPRING_CONFIG, (finished) => {
      'worklet';
      if (finished) status.value = DrawerStatus.closed;
    });
  }, [W, x, status]);

  return {
    W,
    open,
    x,
    velocity,
    status,
    openDrawer,
    closeDrawer,
    edgePan,
    surfacePan,
    backdropPan,
  };
}
