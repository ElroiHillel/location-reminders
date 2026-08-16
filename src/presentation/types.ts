import { BluetoothDevice } from "../domain/models/BluetoothDevice";
import { ParserResult } from "../domain/models/ParserResult";
import { ResolvedLocation, Reminder, ReminderStatus } from "../domain/models/Reminder";
import { SavedLocation } from "../domain/models/SavedLocation";
import { UserSettings } from "../domain/models/UserSettings";
import { TriggerType } from "../domain/models/TriggerType";

export interface LocationSelection extends ResolvedLocation {}

export interface ReminderEditorDraft {
  title: string;
  action: string;
  triggerType: TriggerType;
  isRecurring: boolean;
  radiusMeters: number;
  parsedLocationQuery: string;
  resolvedLocation: LocationSelection | null;
  targetBluetoothDeviceId: string | null;
  status: ReminderStatus;
}

export interface ReminderEditModalProps {
  visible: boolean;
  mode: "create" | "edit";
  reminderId?: string;
  parserResult?: ParserResult | null;
  initialDraft: ReminderEditorDraft;
  availableBluetoothDevices: BluetoothDevice[];
  onCancel: () => void;
  onOpenMapPicker: () => void;
  onConfirm: (draft: ReminderEditorDraft) => void;
}

export interface MapPickerModalProps {
  visible: boolean;
  initialQuery?: string;
  initialLocation?: LocationSelection | null;
  onCancel: () => void;
  onSearchLocation: (query: string) => Promise<LocationSelection | null>;
  onConfirm: (location: LocationSelection) => void;
}

export interface AppBootstrapState {
  reminders: Reminder[];
  savedLocations: SavedLocation[];
  bluetoothDevices: BluetoothDevice[];
  userSettings: UserSettings | null;
}

export interface SavedLocationsPanelProps {
  locations: SavedLocation[];
  selectedLocationId?: string;
  onSelectLocation: (location: SavedLocation) => void;
  onDeleteLocation: (locationId: string) => void;
}

export interface SavedLocationsModalProps {
  visible: boolean;
  locations: SavedLocation[];
  onCancel: () => void;
  onSearchLocation: (query: string) => Promise<LocationSelection | null>;
  onSaveLocation: (location: SavedLocation) => Promise<void>;
  onDeleteLocation: (locationId: string) => Promise<void>;
}

export interface SettingsModalProps {
  visible: boolean;
  initialSettings: UserSettings;
  onCancel: () => void;
  onSave: (settings: UserSettings) => Promise<void>;
}

export interface BluetoothDevicesModalProps {
  visible: boolean;
  devices: BluetoothDevice[];
  onCancel: () => void;
  onSaveDevice: (device: BluetoothDevice) => Promise<void>;
  onDeleteDevice: (deviceId: string) => Promise<void>;
}