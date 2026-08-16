import { GeocodeQuery, GeocodeResult } from "./types";

export interface GeocodingService {
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}