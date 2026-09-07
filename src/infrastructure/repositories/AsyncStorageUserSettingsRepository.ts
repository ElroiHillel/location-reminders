import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSettingsRepository } from "../../domain/interfaces/UserSettingsRepository";
import { UserSettings } from "../../domain/models/UserSettings";
import { NotificationStyle } from "../../domain/models/NotificationStyle";
import { isNullish } from "./storage";

const STORAGE_KEY = "location-reminders:user-settings";

const DEFAULT_SETTINGS: UserSettings = {
  defaultRadiusEnter: 150,
  defaultRadiusExit: 120,
  defaultRadiusNearby: 300,
  nlpProviderPreference: "hybrid",
  geminiApiKey: "",
  defaultNotificationStyle: NotificationStyle.SOUND,
};

const VALID_NOTIFICATION_STYLES = new Set<string>(Object.values(NotificationStyle));

export class AsyncStorageUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly initialSettings: UserSettings | null = null) {}

  async get(): Promise<UserSettings | null> {
    return this.load();
  }

  async save(settings: UserSettings): Promise<UserSettings> {
    const normalized = this.normalize(settings);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  private async load(): Promise<UserSettings | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (isNullish(raw)) {
      const seeded = this.normalize(this.initialSettings ?? DEFAULT_SETTINGS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    const normalized = this.normalize(parsed);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  private normalize(settings: Partial<UserSettings>): UserSettings {
    return {
      defaultRadiusEnter: settings.defaultRadiusEnter ?? DEFAULT_SETTINGS.defaultRadiusEnter,
      defaultRadiusExit: settings.defaultRadiusExit ?? DEFAULT_SETTINGS.defaultRadiusExit,
      defaultRadiusNearby: settings.defaultRadiusNearby ?? DEFAULT_SETTINGS.defaultRadiusNearby,
      nlpProviderPreference:
        settings.nlpProviderPreference === "gemini" || settings.nlpProviderPreference === "local"
          ? settings.nlpProviderPreference
          : "hybrid",
      geminiApiKey: settings.geminiApiKey ?? "",
      geminiModel: settings.geminiModel ?? "",
      defaultNotificationStyle:
        settings.defaultNotificationStyle && VALID_NOTIFICATION_STYLES.has(settings.defaultNotificationStyle)
          ? settings.defaultNotificationStyle
          : DEFAULT_SETTINGS.defaultNotificationStyle,
    };
  }
}