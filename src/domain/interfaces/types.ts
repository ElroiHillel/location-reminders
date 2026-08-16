import { BluetoothDevice } from "../models/BluetoothDevice";
import { ParserResult } from "../models/ParserResult";
import { Reminder } from "../models/Reminder";
import { SavedLocation } from "../models/SavedLocation";
import { TriggerType } from "../models/TriggerType";
import { UserSettings } from "../models/UserSettings";

export interface AudioInput {
  uri: string;
  language?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  provider: string;
}

export interface GeocodeQuery {
  text: string;
  preferredLanguage?: string;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult extends LocationCoordinates {
  address: string;
  provider: string;
  confidence: number;
}

export interface GeofenceRequest {
  reminderId: string;
  triggerType: TriggerType;
  location: LocationCoordinates;
  radiusMeters: number;
}

export interface GeofenceRegistrationResult {
  geofenceId: string;
  active: boolean;
}

export interface BluetoothConnectionState {
  deviceId: string;
  connected: boolean;
  lastSeenAt?: Date;
}

export interface ParserContext {
  savedLocations: SavedLocation[];
  bluetoothDevices: BluetoothDevice[];
  userSettings?: UserSettings;
}

export interface ParserInput {
  text: string;
  context: ParserContext;
}

export type ParsedReminder = ParserResult;
export type ReminderEntity = Reminder;