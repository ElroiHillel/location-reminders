import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { GeofencingService } from "../../domain/interfaces/GeofencingService";
import { GeofenceRegistrationResult, GeofenceRequest } from "../../domain/interfaces/types";
import { TriggerType } from "../../domain/models/TriggerType";
import { presentReminderNotification } from "../notifications/NotificationService";
import { AsyncStorageReminderRepository } from "../repositories/AsyncStorageReminderRepository";

const GEOFENCING_TASK_NAME = "LOCATION_REMINDERS_GEOFENCING_TASK";
const REGISTRY_KEY = "location-reminders:geofences";

interface StoredGeofence {
  reminderId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

interface GeofencingTaskEventData {
  eventType: Location.LocationGeofencingEventType;
  region: Location.LocationRegion;
}

if (!TaskManager.isTaskDefined(GEOFENCING_TASK_NAME)) {
  TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn("Geofencing task error", error.message);
      return;
    }

    if (!data) {
      return;
    }

    const { eventType, region } = data as GeofencingTaskEventData;
    const reminderId = region.identifier;
    if (!reminderId) {
      return;
    }

    const reminderRepository = new AsyncStorageReminderRepository();
    const reminder = await reminderRepository.getById(reminderId);
    if (!reminder || reminder.status !== "ACTIVE") {
      return;
    }

    const matchesEvent =
      (eventType === Location.LocationGeofencingEventType.Enter && reminder.triggerType !== TriggerType.EXIT) ||
      (eventType === Location.LocationGeofencingEventType.Exit && reminder.triggerType !== TriggerType.ENTER);

    if (!matchesEvent) {
      return;
    }

    await presentReminderNotification(reminder);

    if (!reminder.isRecurring) {
      await reminderRepository.save({ ...reminder, status: "TRIGGERED", updatedAt: new Date() });
      await new ExpoLocationGeofencingService().unregister(reminderId);
    }
  });
}

export class ExpoLocationGeofencingService implements GeofencingService {
  async register(request: GeofenceRequest): Promise<GeofenceRegistrationResult> {
    const available = await this.isGeofencingAvailable();
    if (!available) {
      return { geofenceId: request.reminderId, active: false };
    }

    const granted = await this.ensurePermissions();
    if (!granted) {
      return { geofenceId: request.reminderId, active: false };
    }

    const registry = await this.loadRegistry();
    const nextRegion = this.toStoredRegion(request);
    const nextRegistry = [...registry.filter((item) => item.reminderId !== request.reminderId), nextRegion];

    await this.persistRegistry(nextRegistry);
    await this.startOrUpdateGeofencing(nextRegistry);

    return {
      geofenceId: request.reminderId,
      active: true,
    };
  }

  async unregister(geofenceId: string): Promise<void> {
    const registry = await this.loadRegistry();
    const nextRegistry = registry.filter((item) => item.reminderId !== geofenceId);

    await this.persistRegistry(nextRegistry);
    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK_NAME);

    if (nextRegistry.length === 0) {
      if (isRunning) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      }

      return;
    }

    await this.startOrUpdateGeofencing(nextRegistry);
  }

  private async isGeofencingAvailable(): Promise<boolean> {
    return Location.isBackgroundLocationAvailableAsync();
  }

  private async ensurePermissions(): Promise<boolean> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    return background.granted;
  }

  private toStoredRegion(request: GeofenceRequest): StoredGeofence {
    const triggerFlags = this.triggerFlags(request.triggerType);
    return {
      reminderId: request.reminderId,
      latitude: request.location.latitude,
      longitude: request.location.longitude,
      radiusMeters: Math.max(25, Math.min(5000, request.radiusMeters)),
      notifyOnEnter: triggerFlags.notifyOnEnter,
      notifyOnExit: triggerFlags.notifyOnExit,
    };
  }

  private triggerFlags(triggerType: TriggerType): { notifyOnEnter: boolean; notifyOnExit: boolean } {
    switch (triggerType) {
      case TriggerType.ENTER:
        return { notifyOnEnter: true, notifyOnExit: false };
      case TriggerType.EXIT:
        return { notifyOnEnter: false, notifyOnExit: true };
      case TriggerType.NEARBY:
      default:
        return { notifyOnEnter: true, notifyOnExit: true };
    }
  }

  private async startOrUpdateGeofencing(registry: StoredGeofence[]): Promise<void> {
    const regions = registry.map((item) => ({
      identifier: item.reminderId,
      latitude: item.latitude,
      longitude: item.longitude,
      radius: item.radiusMeters,
      notifyOnEnter: item.notifyOnEnter,
      notifyOnExit: item.notifyOnExit,
    }));

    await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
  }

  private async loadRegistry(): Promise<StoredGeofence[]> {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as StoredGeofence[];
  }

  private async persistRegistry(registry: StoredGeofence[]): Promise<void> {
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  }
}