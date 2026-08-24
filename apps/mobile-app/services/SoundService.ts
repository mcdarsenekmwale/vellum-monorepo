import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Central sound/audio service. Audio playback is a best-effort feature:
 * - We don't ship binary audio assets in this audit pass, so we implement a
 *   "soft tap" haptic feedback fallback that mirrors sound semantics
 *   (nothing plays when user mutes audio, tap plays haptic instead, etc.).
 * - Consumers only care whether sound is "effectively delivered".
 * - No crashes; every method catches and swallows unavailability errors.
 *
 * A future integration would swap `playTap`/`playNotification` to play
 * short audio assets (via `expo-av`) when `soundEnabled === true` and the
 * platform supports it, then fall back to haptic when the asset fails to load.
 */
export type SoundEffect = 'tap' | 'notification' | 'success' | 'error' | 'pullRefresh';

let hapticsAvailable: boolean | null = null;

function isHapticsAvailable(): boolean {
  if (hapticsAvailable !== null) return hapticsAvailable;
  try {
    if (Platform.OS === 'web') {
      hapticsAvailable = !!navigator?.vibrate;
      return hapticsAvailable;
    }
    hapticsAvailable = !!Haptics && typeof Haptics.impactAsync === 'function';
  } catch {
    hapticsAvailable = false;
  }
  return hapticsAvailable;
}

export class SoundService {
  constructor(private readonly isEnabled: () => boolean) {}

  private maybeHaptic(kind: SoundEffect): void {
    if (!this.isEnabled()) return;
    try {
      if (Platform.OS === 'web') {
        if (navigator.vibrate) {
          const pattern =
            kind === 'error' ? [40, 30, 40] : kind === 'success' ? [20, 20, 30] : [15];
          navigator.vibrate(pattern);
        }
        return;
      }
      switch (kind) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          break;
        case 'notification':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          break;
        case 'pullRefresh':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          break;
        case 'tap':
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          break;
      }
    } catch {
      // Haptic unavailable; keep quiet (user already disabled audio if they did).
    }
  }

  /** Called for primary button / row taps. */
  play(effect: SoundEffect = 'tap'): void {
    try {
      // When an audio subsystem is wired, replace this with:
      //   if (this.isEnabled()) AudioPlayer.play(`sfx/${effect}.mp3`).catch(fallback);
      if (!isHapticsAvailable()) {
        // Absolute last-resort: use deprecated RN Vibration for web/native fallbacks.
        try {
          if (this.isEnabled()) Vibration.vibrate(effect === 'tap' ? 10 : 25);
        } catch {
          /* ignore */
        }
        return;
      }
      this.maybeHaptic(effect);
    } catch {
      /* never crash for "cute" UX affordances */
    }
  }

  playTap(): void {
    this.play('tap');
  }
  playSuccess(): void {
    this.play('success');
  }
  playError(): void {
    this.play('error');
  }
  playPullRefresh(): void {
    this.play('pullRefresh');
  }
  playNotification(): void {
    this.play('notification');
  }
}

// Global singleton — consumers use this directly; it reads sound-enabled
// via the getter so changes to the setting are reflected immediately without
// requiring a new service reference.
let shared: SoundService | null = null;

export function createSoundService(getter: () => boolean): SoundService {
  shared = new SoundService(getter);
  return shared;
}

export function sounds(): SoundService {
  if (!shared) {
    shared = new SoundService(() => true);
  }
  return shared;
}
