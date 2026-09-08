export type ProviderKey = "gemini" | "local" | "hybrid" | "nominatim" | "native" | "mock";

export interface InfrastructureEnvironment {
  nlpProvider: ProviderKey;
  geocodingProvider: ProviderKey;
  speechToTextProvider: ProviderKey;
  geofencingProvider: "expo-location" | "mock";
  geminiApiKey: string;
  geminiModel: string;
  nominatimUserAgent: string;
  nominatimEmail?: string;
  nativeSpeechToTextModuleName: string;
}

function readEnv(key: string): string | undefined {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  const directProcess = typeof process !== "undefined" ? process : undefined;
  return directProcess?.env?.[key] ?? runtime.process?.env?.[key] ?? undefined;
}

function readProviderKey(value: string | undefined, fallback: ProviderKey): ProviderKey {
  switch ((value ?? fallback).toLowerCase()) {
    case "gemini":
      return "gemini";
    case "local":
      return "local";
    case "hybrid":
      return "hybrid";
    case "nominatim":
      return "nominatim";
    case "native":
      return "native";
    case "mock":
      return "mock";
    default:
      return fallback;
  }
}

function readGeofencingProvider(value: string | undefined): "expo-location" | "mock" {
  return value === "mock" ? "mock" : "expo-location";
}

export function loadInfrastructureEnvironment(): InfrastructureEnvironment {
  return {
    nlpProvider: readProviderKey(readEnv("EXPO_PUBLIC_NLP_PROVIDER"), "local"),
    geocodingProvider: readProviderKey(readEnv("EXPO_PUBLIC_GEOCODING_PROVIDER"), "nominatim"),
    speechToTextProvider: readProviderKey(readEnv("EXPO_PUBLIC_SPEECH_TO_TEXT_PROVIDER"), "native"),
    geofencingProvider: readGeofencingProvider(readEnv("EXPO_PUBLIC_GEOFENCING_PROVIDER")),
    geminiApiKey: readEnv("EXPO_PUBLIC_GEMINI_API_KEY") ?? "",
    geminiModel: readEnv("EXPO_PUBLIC_GEMINI_MODEL") ?? "gemini-2.5-flash",
    nominatimUserAgent: readEnv("EXPO_PUBLIC_NOMINATIM_USER_AGENT") ?? "location-reminders/1.0",
    nominatimEmail: readEnv("EXPO_PUBLIC_NOMINATIM_EMAIL"),
    nativeSpeechToTextModuleName: readEnv("EXPO_PUBLIC_NATIVE_STT_MODULE_NAME") ?? "NativeSpeechToText",
  };
}