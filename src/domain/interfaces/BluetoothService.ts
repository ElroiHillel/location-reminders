import { BluetoothConnectionState } from "./types";

export interface BluetoothService {
  getConnectionState(deviceId: string): Promise<BluetoothConnectionState>;
  isDeviceConnected(deviceId: string): Promise<boolean>;
}