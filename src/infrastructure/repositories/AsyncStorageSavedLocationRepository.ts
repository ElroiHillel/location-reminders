import AsyncStorage from "@react-native-async-storage/async-storage";
import { SavedLocationRepository } from "../../domain/interfaces/SavedLocationRepository";
import { SavedLocation } from "../../domain/models/SavedLocation";
import { isNullish } from "./storage";

const STORAGE_KEY = "location-reminders:saved-locations";

export class AsyncStorageSavedLocationRepository implements SavedLocationRepository {
  constructor(private readonly initialLocations: SavedLocation[] = []) {}

  async getById(id: string): Promise<SavedLocation | null> {
    const locations = await this.loadAll();
    return locations.find((location) => location.id === id) ?? null;
  }

  async list(): Promise<SavedLocation[]> {
    return this.loadAll();
  }

  async save(location: SavedLocation): Promise<SavedLocation> {
    const locations = await this.loadAll();
    const index = locations.findIndex((current) => current.id === location.id);

    if (index >= 0) {
      locations[index] = location;
    } else {
      locations.push(location);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
    return location;
  }

  async delete(id: string): Promise<void> {
    const locations = await this.loadAll();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locations.filter((location) => location.id !== id)));
  }

  private async loadAll(): Promise<SavedLocation[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (isNullish(raw)) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.initialLocations));
      return [...this.initialLocations];
    }

    return JSON.parse(raw) as SavedLocation[];
  }
}