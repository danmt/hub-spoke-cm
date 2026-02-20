// packages/mobile/utils/vibe.ts
import * as Haptics from "expo-haptics";

export class Vibe {
  /**
   * A light impact used when an agent begins a new thought or step.
   */
  static async agentHeartbeat() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  /**
   * A heavier impact used when a major phase ends or user attention is needed.
   */
  static async handoff() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /**
   * Selection feedback for UI interactions.
   */
  static async selection() {
    await Haptics.selectionAsync();
  }

  /**
   * Success feedback for completed evolutions, saves, or forks.
   */
  static async success() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /**
   * Error feedback for hard conflicts, rejected operations, or failures.
   */
  static async error() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  /**
   * Warning feedback for cautious actions or destructive prompts.
   */
  static async warning() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}
