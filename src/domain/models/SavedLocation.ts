export interface SavedLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address: string;
  radiusMeters?: number;
  aliases?: string[];
}