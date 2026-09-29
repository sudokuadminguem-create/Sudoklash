// Haptic feedback through the Vibration API. Absent on iOS Safari and desktops: every call is a
// harmless no-op there.

export type Haptic = "tap" | "good" | "bad" | "win" | "lose";

/** Vibration pattern in milliseconds (vibrate, pause, vibrate…) for each kind of feedback. */
export const hapticPatterns: Record<Haptic, number | number[]> = {
  tap: 8,
  good: 14,
  bad: 180,
  win: [30, 60, 30, 60, 90],
  lose: [120, 60, 240],
};

/** Whether this device can vibrate at all. */
export const canVibrate = () => typeof navigator !== "undefined" && "vibrate" in navigator;

/** Plays the feedback when the device can; never throws. */
export function haptic(kind: Haptic) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(hapticPatterns[kind]);
  } catch {
    // Some browsers refuse without a recent tap: feedback is optional anyway.
  }
}
