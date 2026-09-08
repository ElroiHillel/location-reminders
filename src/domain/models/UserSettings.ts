import { NotificationStyle } from "./NotificationStyle";

export interface UserSettings {
  defaultRadiusEnter: number;
  defaultRadiusExit: number;
  defaultRadiusNearby: number;
  nlpProviderPreference: "local" | "gemini" | "hybrid";
  geminiApiKey?: string;
  geminiModel?: string;
  googlePlacesApiKey?: string;
  defaultNotificationStyle: NotificationStyle;
}
