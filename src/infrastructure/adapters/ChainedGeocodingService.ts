import { GeocodeQuery, GeocodeResult } from "../../domain/interfaces/types";
import { IGeocodingService } from "../contracts/ServiceContracts";

/**
 * Tries each geocoder in order and returns the first hit. Lets us prefer Google
 * Places (great business coverage) while still falling back to keyless Nominatim
 * (streets/cities) when Google finds nothing or is unavailable.
 */
export class ChainedGeocodingService implements IGeocodingService {
  constructor(private readonly services: IGeocodingService[]) {}

  async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
    for (const service of this.services) {
      try {
        const result = await service.geocode(query);
        if (result) {
          return result;
        }
      } catch {
        // Move on to the next provider.
      }
    }
    return null;
  }
}
