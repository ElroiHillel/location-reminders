import { GeocodeQuery, GeocodeResult } from "../../domain/interfaces/types";
import { IGeocodingService } from "../contracts/ServiceContracts";
import { clearGeocodingIssue, setGeocodingIssue } from "./geocodingDiagnostics";

interface PlacesSearchTextResponse {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

/**
 * Geocodes free-text queries via the **Places API (New)** Text Search endpoint,
 * which — unlike OpenStreetMap/Nominatim — has strong coverage of Israeli
 * businesses ("מאפיית לוליטה חדרה", "תחנת דלק סדש"). The legacy Places endpoint
 * is deprecated and not enabled on new Google projects, so this uses the current
 * v1 API. Used only when the user provides a Google key in Settings.
 */
export class GooglePlacesGeocodingAdapter implements IGeocodingService {
  constructor(private readonly apiKey: string) {}

  async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        // The field mask is required by the New API; without it the request is rejected.
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: query.text,
        languageCode: query.preferredLanguage ?? "he",
        regionCode: "IL",
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as PlacesSearchTextResponse;

    // A non-OK response / error object means the key or project is misconfigured
    // (Places API (New) not enabled, billing off, or a blocking restriction).
    if (!response.ok || payload.error) {
      const status = payload.error?.status ?? String(response.status);
      const detail = payload.error?.message ? ` — ${payload.error.message}` : "";
      setGeocodingIssue(`חיפוש Google נכשל (${status})${detail}`);
      return null;
    }

    const best = payload.places?.[0];
    const location = best?.location;
    if (!best || !location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      return null; // No matching place.
    }

    clearGeocodingIssue();
    const address =
      [best.displayName?.text, best.formattedAddress].filter(Boolean).join(", ") || best.formattedAddress || query.text;

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      address,
      provider: "google-places",
      confidence: 0.9,
    };
  }
}
