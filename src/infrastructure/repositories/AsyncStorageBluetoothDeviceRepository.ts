import AsyncStorage from "@react-native-async-storage/async-storage";
import { BluetoothDeviceRepository } from "../../domain/interfaces/BluetoothDeviceRepository";
import { BluetoothDevice } from "../../domain/models/BluetoothDevice";
import { isNullish } from "./storage";

const STORAGE_KEY = "location-reminders:bluetooth-devices";

export class AsyncStorageBluetoothDeviceRepository implements BluetoothDeviceRepository {
  constructor(private readonly initialDevices: BluetoothDevice[] = []) {}

  async getById(id: string): Promise<BluetoothDevice | null> {
    const devices = await this.loadAll();
    return devices.find((device) => device.id === id) ?? null;
  }

  async list(): Promise<BluetoothDevice[]> {
    return this.loadAll();
  }

  async save(device: BluetoothDevice): Promise<BluetoothDevice> {
    const devices = await this.loadAll();
    const index = devices.findIndex((current) => current.id === device.id);

    if (index >= 0) {
      devices[index] = device;
    } else {
      devices.push(device);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    return device;
  }

  async delete(id: string): Promise<void> {
    const devices = await this.loadAll();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(devices.filter((device) => device.id !== id)));
  }

  private async loadAll(): Promise<BluetoothDevice[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (isNullish(raw)) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.initialDevices));
      return [...this.initialDevices];
    }

    return JSON.parse(raw) as BluetoothDevice[];
  }
}