import { GeofenceRegistrationResult, GeofenceRequest } from "./types";

export interface GeofencingService {
  register(request: GeofenceRequest): Promise<GeofenceRegistrationResult>;
  unregister(geofenceId: string): Promise<void>;
}