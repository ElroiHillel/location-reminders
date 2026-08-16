import { BluetoothDeviceRepository } from "../domain/interfaces/BluetoothDeviceRepository";
import { SavedLocationRepository } from "../domain/interfaces/SavedLocationRepository";
import { GeofencingService } from "../domain/interfaces/GeofencingService";
import { BluetoothTriggerService } from "../domain/interfaces/BluetoothTriggerService";
import { BluetoothDevice } from "../domain/models/BluetoothDevice";
import { SavedLocation } from "../domain/models/SavedLocation";
import { UserSettings } from "../domain/models/UserSettings";
import { InfrastructureEnvironment, loadInfrastructureEnvironment } from "./config/environment";
import { Platform } from "react-native";
import { GeminiNLPAdapter } from "./adapters/GeminiNLPAdapter";
import { NativeSpeechToTextAdapter } from "./adapters/NativeSpeechToTextAdapter";
import { NominatimGeocodingAdapter } from "./adapters/NominatimGeocodingAdapter";
import { ExpoLocationGeofencingService } from "./adapters/ExpoLocationGeofencingService";
import { LocalHebrewNLPAdapter } from "./adapters/LocalHebrewNLPAdapter";
import { HybridNLPAdapter } from "./adapters/HybridNLPAdapter";
import { AndroidBluetoothClassicTriggerService } from "./adapters/AndroidBluetoothClassicTriggerService";
import { IGeocodingService, INLPParsingService, ISpeechToTextService } from "./contracts/ServiceContracts";

class InMemoryBluetoothDeviceRepository implements BluetoothDeviceRepository {
  constructor(private seed: BluetoothDevice[] = []) {}

  async getById(id: string): Promise<BluetoothDevice | null> {
    return this.seed.find((device) => device.id === id) ?? null;
  }

  async list(): Promise<BluetoothDevice[]> {
    return [...this.seed];
  }

  async save(device: BluetoothDevice): Promise<BluetoothDevice> {
    const existingIndex = this.seed.findIndex((current) => current.id === device.id);
    if (existingIndex >= 0) {
      this.seed[existingIndex] = device;
    } else {
      this.seed.push(device);
    }

    return device;
  }

  async delete(id: string): Promise<void> {
    this.seed = this.seed.filter((device) => device.id !== id);
  }
}

class InMemorySavedLocationRepository implements SavedLocationRepository {
  constructor(private seed: SavedLocation[] = []) {}

  async getById(id: string): Promise<SavedLocation | null> {
    return this.seed.find((location) => location.id === id) ?? null;
  }

  async list(): Promise<SavedLocation[]> {
    return [...this.seed];
  }

  async save(location: SavedLocation): Promise<SavedLocation> {
    const existingIndex = this.seed.findIndex((current) => current.id === location.id);
    if (existingIndex >= 0) {
      this.seed[existingIndex] = location;
    } else {
      this.seed.push(location);
    }

    return location;
  }

  async delete(id: string): Promise<void> {
    this.seed = this.seed.filter((location) => location.id !== id);
  }
}

export class ProviderFactory {
  private readonly baseEnvironment = loadInfrastructureEnvironment();

  createNlpService(options: {
    userSettings?: UserSettings | null;
    savedLocationRepository: SavedLocationRepository;
    bluetoothDeviceRepository: BluetoothDeviceRepository;
  }): INLPParsingService {
    const environment = this.resolveEnvironment(options.userSettings);
    switch (environment.nlpProvider) {
      case "hybrid":
        return new HybridNLPAdapter(
          new LocalHebrewNLPAdapter(options.savedLocationRepository, options.bluetoothDeviceRepository),
          environment.geminiApiKey ? new GeminiNLPAdapter(environment) : undefined,
        );
      case "local":
        return new LocalHebrewNLPAdapter(options.savedLocationRepository, options.bluetoothDeviceRepository);
      case "gemini":
      case "mock":
      default:
        return environment.geminiApiKey
          ? new GeminiNLPAdapter(environment)
          : new LocalHebrewNLPAdapter(options.savedLocationRepository, options.bluetoothDeviceRepository);
    }
  }

  createGeocodingService(): IGeocodingService {
    switch (this.baseEnvironment.geocodingProvider) {
      case "nominatim":
      case "mock":
      default:
        return new NominatimGeocodingAdapter(this.baseEnvironment);
    }
  }

  createSpeechToTextService(userSettings?: UserSettings | null): ISpeechToTextService {
    const environment = this.resolveEnvironment(userSettings);
    switch (environment.speechToTextProvider) {
      case "native":
      case "mock":
      default:
        return new NativeSpeechToTextAdapter(environment);
    }
  }

  createGeofencingService(): GeofencingService {
    switch (this.baseEnvironment.geofencingProvider) {
      case "expo-location":
      case "mock":
      default:
        return new ExpoLocationGeofencingService();
    }
  }

  createBluetoothTriggerService(): BluetoothTriggerService {
    if (Platform.OS === "android") {
      return new AndroidBluetoothClassicTriggerService();
    }

    return {
      register: async (_deviceId: string, reminderId: string) => ({ triggerId: reminderId, active: false }),
      unregister: async () => undefined,
    };
  }

  createBluetoothDeviceRepository(seed: BluetoothDevice[] = []): BluetoothDeviceRepository {
    return new InMemoryBluetoothDeviceRepository(seed);
  }

  createSavedLocationRepository(seed: SavedLocation[] = []): SavedLocationRepository {
    return new InMemorySavedLocationRepository(seed);
  }

  private resolveEnvironment(userSettings?: UserSettings | null): InfrastructureEnvironment {
    const preference = userSettings?.nlpProviderPreference;
    const resolvedNlpProvider = preference ? preference : this.baseEnvironment.nlpProvider === "gemini" ? "gemini" : "local";

    return {
      ...this.baseEnvironment,
      nlpProvider: resolvedNlpProvider,
      geminiApiKey: userSettings?.geminiApiKey?.trim() || this.baseEnvironment.geminiApiKey,
      geminiModel: userSettings?.geminiModel?.trim() || this.baseEnvironment.geminiModel,
    };
  }
}