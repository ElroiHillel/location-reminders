import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Reminder } from "../../domain/models/Reminder";
import { NotificationStyle } from "../../domain/models/NotificationStyle";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_IDS: Record<NotificationStyle, string> = {
  [NotificationStyle.SILENT]: "location-reminders-silent",
  [NotificationStyle.SOUND]: "location-reminders-sound",
  [NotificationStyle.PERSISTENT]: "location-reminders-nag",
};

// A bounded "nag": re-fire this many extra times, this many seconds apart, so a
// PERSISTENT reminder doesn't just show once and get missed — without looping forever.
const NAG_REPEAT_COUNT = 2;
const NAG_REPEAT_INTERVAL_SECONDS = 180;

let permissionEnsured = false;

export async function ensureNotificationPermission(): Promise<boolean> {
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
  const style = reminder.notificationStyle ?? NotificationStyle.SOUND;
  const channelId = CHANNEL_IDS[style];

  const content: Notifications.NotificationContentInput = {
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
