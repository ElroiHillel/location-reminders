import { SavedLocation } from "../models/SavedLocation";

export interface SavedLocationRepository {
  getById(id: string): Promise<SavedLocation | null>;
  list(): Promise<SavedLocation[]>;
  save(location: SavedLocation): Promise<SavedLocation>;
  delete(id: string): Promise<void>;
}