import { BluetoothDevice } from "../models/BluetoothDevice";

export interface BluetoothDeviceRepository {
  getById(id: string): Promise<BluetoothDevice | null>;
  list(): Promise<BluetoothDevice[]>;
  save(device: BluetoothDevice): Promise<BluetoothDevice>;
  delete(id: string): Promise<void>;
}