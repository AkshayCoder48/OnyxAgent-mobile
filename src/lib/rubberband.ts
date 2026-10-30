/**
 * Rubber-band clamp for drawer overscroll.
 *
 * The drawer's position lives in the shared value `x ∈ [-W, 0]`. When the
 * user drags past either edge of that range we don't want a hard stop — we
 * want the iOS-style rubber-band: the visible overshoot still grows with the
 * finger, but sub-linearly (factor 0.175) and hard-capped (24 px).
 *
 * This helper is a worklet ('worklet' directive below), so it can be called
 * directly inside Reanimated / react-native-gesture-handler callbacks that
 * run on the UI thread.
 */
export function rubberBandClamp(
  value: number,
  min: number,
  max: number,
  overshootFactor = 0.175,
  cap = 24
): number {
  'worklet';
  if (value < min) {
    // Overshooting below the minimum (slammed past fully closed).
    const overshoot = min - value;
    return min - Math.min(overshoot * overshootFactor, cap);
  }
  if (value > max) {
    // Overshooting above the maximum (dragged past fully open).
    const overshoot = value - max;
    return max + Math.min(overshoot * overshootFactor, cap);
  }
  return value;
}
