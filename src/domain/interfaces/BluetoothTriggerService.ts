export interface BluetoothTriggerRegistrationResult {
  triggerId: string;
  active: boolean;
}

export interface BluetoothTriggerService {
  register(deviceId: string, reminderId: string, connected: boolean): Promise<BluetoothTriggerRegistrationResult>;
  unregister(triggerId: string): Promise<void>;
}