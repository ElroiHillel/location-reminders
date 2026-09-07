import { NotificationStyle } from "../domain/models/NotificationStyle";

export interface NotificationStyleDisplayMeta {
  label: string;
  icon: string;
  help: string;
}

const NOTIFICATION_STYLE_DISPLAY: Record<NotificationStyle, NotificationStyleDisplayMeta> = {
  [NotificationStyle.SILENT]: {
    label: "פוש שקט",
    icon: "🔕",
    help: "התראה שקטה על המסך, בלי צליל ובלי רטט.",
  },
  [NotificationStyle.SOUND]: {
    label: "עם צליל",
    icon: "🔔",
    help: "התראה רגילה עם צליל.",
  },
  [NotificationStyle.PERSISTENT]: {
    label: "נודניק",
    icon: "🚨",
    help: "צליל, רטט חזק, אי אפשר לסגור בהחלקה, ותזכורת חוזרת אם לא הגבת.",
  },
};

export function getNotificationStyleDisplay(style: NotificationStyle): NotificationStyleDisplayMeta {
  return NOTIFICATION_STYLE_DISPLAY[style] ?? NOTIFICATION_STYLE_DISPLAY[NotificationStyle.SOUND];
}

export const NOTIFICATION_STYLE_OPTIONS: NotificationStyle[] = [
  NotificationStyle.SILENT,
  NotificationStyle.SOUND,
  NotificationStyle.PERSISTENT,
];
