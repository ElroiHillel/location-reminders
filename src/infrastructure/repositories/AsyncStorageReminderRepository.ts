import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReminderRepository } from "../../domain/interfaces/ReminderRepository";
import { Reminder, ResolvedLocation } from "../../domain/models/Reminder";
import { NotificationStyle } from "../../domain/models/NotificationStyle";
import { deserializeDate, isNullish, serializeDate } from "./storage";

type StoredReminder = Omit<Reminder, "createdAt" | "updatedAt" | "resolvedLocation"> & {
  createdAt: string;
  updatedAt: string;
  resolvedLocation: ResolvedLocation | null;
};

const STORAGE_KEY = "location-reminders:reminders";

export class AsyncStorageReminderRepository implements ReminderRepository {
  async getById(id: string): Promise<Reminder | null> {
    const reminders = await this.loadAll();
    return reminders.find((reminder) => reminder.id === id) ?? null;
  }

  async list(): Promise<Reminder[]> {
    return this.loadAll();
  }

  async save(reminder: Reminder): Promise<Reminder> {
    const reminders = await this.loadAll();
    const index = reminders.findIndex((current) => current.id === reminder.id);

    if (index >= 0) {
      reminders[index] = reminder;
    } else {
      reminders.push(reminder);
    }

    await this.persist(reminders);
    return reminder;
  }

  async delete(id: string): Promise<void> {
    const reminders = await this.loadAll();
    await this.persist(reminders.filter((reminder) => reminder.id !== id));
  }

  private async loadAll(): Promise<Reminder[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (isNullish(raw)) {
      return [];
    }

    const stored = JSON.parse(raw) as StoredReminder[];
    return stored.map(this.deserializeReminder);
  }

  private async persist(reminders: Reminder[]): Promise<void> {
    const stored = reminders.map(this.serializeReminder);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  private serializeReminder(reminder: Reminder): StoredReminder {
    return {
      ...reminder,
      createdAt: serializeDate(reminder.createdAt),
      updatedAt: serializeDate(reminder.updatedAt),
    };
  }

  private deserializeReminder(stored: StoredReminder): Reminder {
    return {
      ...stored,
      notificationStyle: stored.notificationStyle ?? NotificationStyle.SOUND,
      createdAt: deserializeDate(stored.createdAt),
      updatedAt: deserializeDate(stored.updatedAt),
    };
  }
}