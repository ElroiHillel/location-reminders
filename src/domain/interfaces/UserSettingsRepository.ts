import { UserSettings } from "../models/UserSettings";

export interface UserSettingsRepository {
  get(): Promise<UserSettings | null>;
  save(settings: UserSettings): Promise<UserSettings>;
}