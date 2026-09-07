import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import type * as ExpoNotifications from "expo-notifications";
import { Reminder } from "../../domain/models/Reminder";
import { NotificationStyle } from "../../domain/models/NotificationStyle";

// Since SDK 53, expo-notifications removed push support from Expo Go — and on
// Android (SDK 57) merely *importing* the module throws at load time. This app
// only uses LOCAL notifications, so in that one environment we degrade to no-ops
// so the app still runs; a real build (APK/dev client) uses notifications fully.
const NOTIFICATIONS_BLOCKED_IN_EXPO_GO = isRunningInExpoGo() && Platform.OS === "android";

const CHANNEL_IDS: Record<NotificationStyle, string> = {
  [NotificationStyle.SILENT]: "location-reminders-silent",
  [NotificationStyle.SOUND]: "location-reminders-sound",
  [NotificationStyle.PERSISTENT]: "location-reminders-nag",
};

// A bounded "nag": re-fire this many extra times, this many seconds apart, so a
// PERSISTENT reminder doesn't just show once and get missed — without looping forever.
const NAG_REPEAT_COUNT = 2;
const NAG_REPEAT_INTERVAL_SECONDS = 180;

let notificationsModule: typeof ExpoNotifications | null = null;
let handlerConfigured = false;

/**
 * Lazily loads expo-notifications, but never in the one environment where its
 * import throws (Android + Expo Go). Returns null there so callers no-op.
 */
function loadNotifications(): typeof ExpoNotifications | null {
  if (NOTIFICATIONS_BLOCKED_IN_EXPO_GO) {
    return null;
  }

  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications") as typeof ExpoNotifications;
  }

  if (!handlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  return notificationsModule;
}

export function areNotificationsAvailable(): boolean {
  return !NOTIFICATIONS_BLOCKED_IN_EXPO_GO;
}

let permissionEnsured = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_IDS[NotificationStyle.SILENT], {
      name: "תזכורות שקטות",
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      sound: null,
    });

    await Notifications.setNotificationChannelAsync(CHANNEL_IDS[NotificationStyle.SOUND], {
      name: "תזכורות עם צליל",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });

    await Notifications.setNotificationChannelAsync(CHANNEL_IDS[NotificationStyle.PERSISTENT], {
      name: "תזכורות נודניקיות",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      bypassDnd: true,
    });
  }

  if (permissionEnsured) {
    return true;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    permissionEnsured = true;
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  permissionEnsured = requested.granted;
  return requested.granted;
}

export async function presentReminderNotification(reminder: Reminder): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return;
  }

  const style = reminder.notificationStyle ?? NotificationStyle.SOUND;
  const channelId = CHANNEL_IDS[style];

  const content: ExpoNotifications.NotificationContentInput = {
    title: reminder.title || "תזכורת",
    body: reminder.action || "הגיע הזמן לתזכורת שלך.",
    sound: style !== NotificationStyle.SILENT,
    data: { reminderId: reminder.id },
  };

  if (style === NotificationStyle.PERSISTENT) {
    content.priority = "max";
    content.sticky = true;
    content.autoDismiss = false;
  }

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: Platform.OS === "android" ? { channelId } : null,
  });

  if (style === NotificationStyle.PERSISTENT) {
    for (let attempt = 1; attempt <= NAG_REPEAT_COUNT; attempt += 1) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: attempt * NAG_REPEAT_INTERVAL_SECONDS,
          channelId: Platform.OS === "android" ? channelId : undefined,
        },
      });
    }
  }
}
