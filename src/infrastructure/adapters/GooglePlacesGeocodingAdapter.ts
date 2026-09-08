import { GeocodeQuery, GeocodeResult } from "../../domain/interfaces/types";
import { IGeocodingService } from "../contracts/ServiceContracts";
import { clearGeocodingIssue, setGeocodingIssue } from "./geocodingDiagnostics";

interface PlacesTextSearchResponse {
  status: string;
  error_message?: string;
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

    // ZERO_RESULTS is a normal "not found"; other non-OK statuses mean the key
    // is misconfigured (Places API off, billing off, or a referrer/Android
    // restriction that blocks REST calls) — surface that so the user can fix it.
    if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      const detail = payload.error_message ? ` — ${payload.error_message}` : "";
      setGeocodingIssue(`חיפוש Google נכשל (${payload.status})${detail}`);
      return null;
    }

    if (!payload.results || payload.results.length === 0) {
      return null;
    }

    clearGeocodingIssue();

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
