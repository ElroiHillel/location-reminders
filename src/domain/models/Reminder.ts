import { TriggerType } from "./TriggerType";
import { NotificationStyle } from "./NotificationStyle";

export type ReminderStatus = "DRAFT" | "ACTIVE" | "TRIGGERED" | "COMPLETED" | "CANCELLED";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface Reminder {
  id: string;
  title: string;
  action: string;
  triggerType: TriggerType;
  isRecurring: boolean;
  targetBluetoothDeviceId: string | null;
  parsedLocationQuery: string | null;
  resolvedLocation: ResolvedLocation | null;
  radiusMeters: number;
  notificationStyle: NotificationStyle;
  status: ReminderStatus;
  createdAt: Date;
  updatedAt: Date;
}