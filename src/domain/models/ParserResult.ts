import { BluetoothDevice } from "./BluetoothDevice";
import { SavedLocation } from "./SavedLocation";
import { TriggerType } from "./TriggerType";

export interface ParserResult {
  action: string;
  locationTarget: string | null;
  triggerType: TriggerType | null;
  confidence: number;
  matchedSavedLocation: SavedLocation | null;
  matchedBluetoothDevice: BluetoothDevice | null;
  requiresFallback: boolean;
}