import { requireOptionalNativeModule } from "expo-modules-core";

export interface BluetoothAclEvent {
  address: string;
  name: string;
}

export interface BluetoothAclSubscription {
  remove(): void;
}

interface BluetoothAclNativeModule {
  addListener(eventName: "onDeviceConnected" | "onDeviceDisconnected", listener: (event: BluetoothAclEvent) => void): BluetoothAclSubscription;
}

const nativeModule = requireOptionalNativeModule<BluetoothAclNativeModule>("BluetoothAclListener");

export function isAvailable(): boolean {
  return nativeModule !== null;
}

export function addDeviceConnectedListener(listener: (event: BluetoothAclEvent) => void): BluetoothAclSubscription | null {
  return nativeModule?.addListener("onDeviceConnected", listener) ?? null;
}

export function addDeviceDisconnectedListener(listener: (event: BluetoothAclEvent) => void): BluetoothAclSubscription | null {
  return nativeModule?.addListener("onDeviceDisconnected", listener) ?? null;
}
