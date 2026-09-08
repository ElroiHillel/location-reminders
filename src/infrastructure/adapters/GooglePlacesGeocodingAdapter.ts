import { GeocodeQuery, GeocodeResult } from "../../domain/interfaces/types";
import { IGeocodingService } from "../contracts/ServiceContracts";

interface PlacesTextSearchResponse {
  status: string;
  results?: Array<{
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }>;
}

/**
 * Geocodes free-text queries via Google Places Text Search, which — unlike
 * OpenStreetMap/Nominatim — has strong coverage of Israeli businesses ("רמי לוי
 * חדרה", "תחנת דלק סדש"). Used only when the user provides a Google API key in
 * Settings; otherwise the app falls back to the keyless Nominatim adapter.
 */
export class GooglePlacesGeocodingAdapter implements IGeocodingService {
  constructor(private readonly apiKey: string) {}

  async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", query.text);
    url.searchParams.set("language", query.preferredLanguage ?? "he");
    url.searchParams.set("region", "il");
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Google Places request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as PlacesTextSearchResponse;
    if (payload.status !== "OK" || !payload.results || payload.results.length === 0) {
      return null;
    }

    const best = payload.results[0];
    const location = best.geometry?.location;
    if (!location) {
      return null;
    }

    const address = [best.name, best.formatted_address].filter(Boolean).join(", ") || best.formatted_address || query.text;

    return {
      latitude: location.lat,
      longitude: location.lng,
      address,
      provider: "google-places",
      confidence: 0.9,
    };
  }
}
