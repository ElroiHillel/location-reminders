import { Reminder } from "../models/Reminder";

export interface ReminderRepository {
  getById(id: string): Promise<Reminder | null>;
  list(): Promise<Reminder[]>;
  save(reminder: Reminder): Promise<Reminder>;
  delete(id: string): Promise<void>;
}