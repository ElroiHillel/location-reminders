import * as Haptics from "expo-haptics";

/**
 * Thin, always-safe wrappers around expo-haptics. Haptics can be unavailable
 * (some devices, web) and the calls can reject — every wrapper swallows errors
 * so a missing haptic engine never breaks an interaction.
 */

export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function hapticMedium(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => undefined);
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticWarning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}
