import { GeocodingService } from "../../domain/interfaces/GeocodingService";
import { GeocodeQuery, GeocodeResult } from "../../domain/interfaces/types";
import { IGeocodingService } from "../contracts/ServiceContracts";
import { InfrastructureEnvironment } from "../config/environment";

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
}

export class NominatimGeocodingAdapter implements IGeocodingService {
  constructor(private readonly environment: InfrastructureEnvironment) {}

  async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query.text);
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    if (query.preferredLanguage) {
      url.searchParams.set("accept-language", query.preferredLanguage);
    }

    if (this.environment.nominatimEmail) {
      url.searchParams.set("email", this.environment.nominatimEmail);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": this.environment.nominatimUserAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim request failed with status ${response.status}`);
    }

    const results = (await response.json()) as NominatimSearchResult[];
    const result = results[0];

    if (!result) {
      return null;
    }

    return {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      address: result.display_name,
      provider: "nominatim",
      confidence: this.resolveConfidence(result.importance),
    };
  }

  private resolveConfidence(importance?: number): number {
    if (typeof importance !== "number" || Number.isNaN(importance)) {
      return 0.7;
    }

    return Math.max(0, Math.min(1, importance));
  }
}