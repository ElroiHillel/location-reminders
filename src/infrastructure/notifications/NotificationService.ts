import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Reminder } from "../../domain/models/Reminder";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = "location-reminders-triggers";

let permissionEnsured = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "תזכורות מיקום ובלוטות'",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
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
  await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title || "תזכורת",
      body: reminder.action || "הגיע הזמן לתזכורת שלך.",
      sound: true,
      data: { reminderId: reminder.id },
    },
    trigger: Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null,
  });
}
