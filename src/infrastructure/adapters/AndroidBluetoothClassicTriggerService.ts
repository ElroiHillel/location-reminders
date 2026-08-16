import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { addDeviceConnectedListener, addDeviceDisconnectedListener, isAvailable as isAclListenerAvailable, BluetoothAclEvent } from "bluetooth-acl-listener";
import { BluetoothTriggerRegistrationResult, BluetoothTriggerService } from "../../domain/interfaces/BluetoothTriggerService";
import { AsyncStorageBluetoothDeviceRepository } from "../repositories/AsyncStorageBluetoothDeviceRepository";
import { AsyncStorageReminderRepository } from "../repositories/AsyncStorageReminderRepository";
import { presentReminderNotification } from "../notifications/NotificationService";

const REGISTRY_KEY = "location-reminders:bluetooth-triggers";

interface StoredBluetoothTrigger {
  triggerId: string;
  deviceId: string;
  wantsConnect: boolean;
}

export function isBluetoothAclDetectionSupported(): boolean {
  return Platform.OS === "android" && isAclListenerAvailable();
}

/**
 * Detects real Bluetooth Classic ACL connect/disconnect events (e.g. auto-connecting
 * to a car head unit) via the local `bluetooth-acl-listener` native module.
 *
 * That module is only linked in a real Android build (`expo prebuild` / `expo run:android`
 * / EAS build) — inside Expo Go it is absent, so this service still records the
 * registration (so the reminder shows as armed) but reports `active: false`.
 */
export class AndroidBluetoothClassicTriggerService implements BluetoothTriggerService {
  private listenersStarted = false;

  constructor() {
    this.ensureListeners();
  }

  async register(deviceId: string, reminderId: string, connected: boolean): Promise<BluetoothTriggerRegistrationResult> {
    const registry = await this.loadRegistry();
    const nextRegistry = [
      ...registry.filter((item) => item.triggerId !== reminderId),
      { triggerId: reminderId, deviceId, wantsConnect: connected },
    ];
    await this.persistRegistry(nextRegistry);

    return { triggerId: reminderId, active: isBluetoothAclDetectionSupported() };
  }

  async unregister(triggerId: string): Promise<void> {
    const registry = await this.loadRegistry();
    await this.persistRegistry(registry.filter((item) => item.triggerId !== triggerId));
  }

  private ensureListeners(): void {
    if (this.listenersStarted || !isBluetoothAclDetectionSupported()) {
      return;
    }

    this.listenersStarted = true;
    addDeviceConnectedListener((event) => this.handleAclEvent(event, true));
    addDeviceDisconnectedListener((event) => this.handleAclEvent(event, false));
  }

  private async handleAclEvent(event: BluetoothAclEvent, connected: boolean): Promise<void> {
    const [registry, devices] = await Promise.all([this.loadRegistry(), new AsyncStorageBluetoothDeviceRepository().list()]);

    const matchedDevice = devices.find((device) => device.macAddressOrUuid.toLowerCase() === event.address.toLowerCase());
    if (!matchedDevice) {
      return;
    }

    const matches = registry.filter((item) => item.deviceId === matchedDevice.id && item.wantsConnect === connected);
    if (matches.length === 0) {
      return;
    }

    const reminderRepository = new AsyncStorageReminderRepository();
    for (const match of matches) {
      const reminder = await reminderRepository.getById(match.triggerId);
      if (!reminder || reminder.status !== "ACTIVE") {
        continue;
      }

      await presentReminderNotification(reminder);

      if (!reminder.isRecurring) {
        await reminderRepository.save({ ...reminder, status: "TRIGGERED", updatedAt: new Date() });
        await this.unregister(reminder.id);
      }
    }
  }

  private async loadRegistry(): Promise<StoredBluetoothTrigger[]> {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as StoredBluetoothTrigger[]) : [];
  }

  private async persistRegistry(registry: StoredBluetoothTrigger[]): Promise<void> {
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  }
}
