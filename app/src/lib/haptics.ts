import * as Haptics from 'expo-haptics';
import { getState } from '../store/store';

type Kind = 'light' | 'medium' | 'success' | 'error' | 'select';

export function haptic(kind: Kind) {
  const s = getState().settings;
  if (!s.haptics) return;
  try {
    const lvl = s.hapticLevel;
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'error') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (kind === 'select') void Haptics.selectionAsync();
    else {
      const styles = [Haptics.ImpactFeedbackStyle.Light, Haptics.ImpactFeedbackStyle.Medium, Haptics.ImpactFeedbackStyle.Heavy];
      const base = kind === 'light' ? Math.max(0, lvl - 1) : lvl;
      void Haptics.impactAsync(styles[Math.min(2, base)]);
    }
  } catch {
    /* ignore */
  }
}
