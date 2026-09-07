import { BluetoothDeviceRepository } from "../../domain/interfaces/BluetoothDeviceRepository";
import { BluetoothTriggerService } from "../../domain/interfaces/BluetoothTriggerService";
import { GeocodingService } from "../../domain/interfaces/GeocodingService";
import { GeofencingService } from "../../domain/interfaces/GeofencingService";
import { ReminderRepository } from "../../domain/interfaces/ReminderRepository";
import { SavedLocationRepository } from "../../domain/interfaces/SavedLocationRepository";
import { UserSettingsRepository } from "../../domain/interfaces/UserSettingsRepository";
import { GeocodeResult, GeofenceRegistrationResult } from "../../domain/interfaces/types";
import { BluetoothDevice } from "../../domain/models/BluetoothDevice";
import { Reminder, ResolvedLocation } from "../../domain/models/Reminder";
import { SavedLocation } from "../../domain/models/SavedLocation";
import { TriggerType } from "../../domain/models/TriggerType";
import { UserSettings } from "../../domain/models/UserSettings";
import { normalizeLocationQueryForGeocoding } from "../../domain/services/normalizeLocationQuery";

export interface UpdateReminderUseCaseInput {
  reminderId: string;
  changes: Partial<Pick<Reminder, "title" | "action" | "triggerType" | "parsedLocationQuery" | "resolvedLocation" | "radiusMeters" | "isRecurring" | "targetBluetoothDeviceId" | "status" | "notificationStyle">>;
  confidenceThreshold?: number;
}

export interface UpdateReminderUseCaseResult {
  reminder: Reminder;
  requiresFallback: boolean;
  geofenceRegistration?: GeofenceRegistrationResult;
  bluetoothTriggerRegistration?: { triggerId: string; active: boolean };
}

export class UpdateReminderUseCase {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly savedLocationRepository: SavedLocationRepository,
    private readonly bluetoothDeviceRepository: BluetoothDeviceRepository,
    private readonly userSettingsRepository: UserSettingsRepository,
    private readonly geocodingService: GeocodingService,
    private readonly geofencingService: GeofencingService,
    private readonly bluetoothTriggerService: BluetoothTriggerService,
  ) {}

  async execute(input: UpdateReminderUseCaseInput): Promise<UpdateReminderUseCaseResult> {
    const existingReminder = await this.reminderRepository.getById(input.reminderId);

    if (!existingReminder) {
      throw new Error(`Reminder not found: ${input.reminderId}`);
    }

    const mergedReminder = this.mergeReminder(existingReminder, input.changes);
    const [userSettings, savedLocations, bluetoothDevices] = await Promise.all([
      this.loadUserSettings(),
      this.savedLocationRepository.list(),
      this.bluetoothDeviceRepository.list(),
    ]);
    const triggerType = mergedReminder.triggerType;
    const radiusMeters = mergedReminder.radiusMeters ?? this.resolveDefaultRadius(triggerType, userSettings);
    const parsedLocationQuery = mergedReminder.parsedLocationQuery;

    const { resolvedLocation, requiresFallback } = await this.resolveUpdatedLocation(mergedReminder, parsedLocationQuery, savedLocations);
    const targetBluetoothDeviceId = this.resolveBluetoothTarget(triggerType, mergedReminder.targetBluetoothDeviceId, bluetoothDevices);

    const updatedReminder: Reminder = {
      ...mergedReminder,
      radiusMeters,
      resolvedLocation,
      targetBluetoothDeviceId,
      updatedAt: new Date(),
    };

    const effectiveFallback = requiresFallback || (this.isBluetoothTrigger(triggerType) && !targetBluetoothDeviceId);
    const shouldArmTriggers = updatedReminder.status === "ACTIVE";

    await this.unregisterPreviousTrigger(existingReminder);

    let geofenceRegistration: GeofenceRegistrationResult | undefined;
    let bluetoothTriggerRegistration: { triggerId: string; active: boolean } | undefined;

    if (shouldArmTriggers && this.isSpatialTrigger(triggerType) && updatedReminder.resolvedLocation) {
      geofenceRegistration = await this.geofencingService.register({
        reminderId: updatedReminder.id,
        triggerType,
        location: updatedReminder.resolvedLocation,
        radiusMeters: updatedReminder.radiusMeters,
      });
    }

    if (shouldArmTriggers && this.isBluetoothTrigger(triggerType) && updatedReminder.targetBluetoothDeviceId) {
      bluetoothTriggerRegistration = await this.bluetoothTriggerService.register(
        updatedReminder.targetBluetoothDeviceId,
        updatedReminder.id,
        triggerType === TriggerType.BLUETOOTH_CONNECT,
      );
    }

    const savedReminder = await this.reminderRepository.save(updatedReminder);

    return {
      reminder: savedReminder,
      requiresFallback: effectiveFallback,
      geofenceRegistration,
      bluetoothTriggerRegistration,
    };
  }

  private mergeReminder(existingReminder: Reminder, changes: UpdateReminderUseCaseInput["changes"]): Reminder {
    return {
      ...existingReminder,
      ...changes,
      resolvedLocation: changes.resolvedLocation ?? existingReminder.resolvedLocation,
      targetBluetoothDeviceId: changes.targetBluetoothDeviceId ?? existingReminder.targetBluetoothDeviceId,
      parsedLocationQuery: changes.parsedLocationQuery ?? existingReminder.parsedLocationQuery,
      updatedAt: existingReminder.updatedAt,
    };
  }

  private async loadUserSettings(): Promise<UserSettings | null> {
    return this.userSettingsRepository.get();
  }

  private resolveDefaultRadius(triggerType: TriggerType, userSettings: UserSettings | null): number {
    if (!userSettings) {
      return 100;
    }

    switch (triggerType) {
      case TriggerType.ENTER:
        return userSettings.defaultRadiusEnter;
      case TriggerType.EXIT:
        return userSettings.defaultRadiusExit;
      case TriggerType.NEARBY:
      default:
        return userSettings.defaultRadiusNearby;
    }
  }

  private async resolveUpdatedLocation(
    reminder: Reminder,
    parsedLocationQuery: string | null,
    savedLocations: SavedLocation[],
  ): Promise<{ resolvedLocation: ResolvedLocation | null; requiresFallback: boolean }> {
    if (!this.isSpatialTrigger(reminder.triggerType)) {
      return { resolvedLocation: null, requiresFallback: false };
    }

    if (reminder.resolvedLocation) {
      return { resolvedLocation: reminder.resolvedLocation, requiresFallback: false };
    }

    const matchedSavedLocation = this.findSavedLocationByQuery(parsedLocationQuery, savedLocations);

    if (matchedSavedLocation) {
      return {
        resolvedLocation: {
          latitude: matchedSavedLocation.latitude,
          longitude: matchedSavedLocation.longitude,
          address: matchedSavedLocation.address,
        },
        requiresFallback: false,
      };
    }

    if (!parsedLocationQuery) {
      return { resolvedLocation: null, requiresFallback: true };
    }

    const geocodedLocation: GeocodeResult | null = await this.geocodingService.geocode({
      text: normalizeLocationQueryForGeocoding(parsedLocationQuery),
    });

    if (!geocodedLocation) {
      return { resolvedLocation: null, requiresFallback: true };
    }

    return {
      resolvedLocation: {
        latitude: geocodedLocation.latitude,
        longitude: geocodedLocation.longitude,
        address: geocodedLocation.address,
      },
      requiresFallback: false,
    };
  }

  private findSavedLocationByQuery(parsedLocationQuery: string | null, savedLocations: SavedLocation[]): SavedLocation | null {
    if (!parsedLocationQuery) {
      return null;
    }

    const normalizedQuery = parsedLocationQuery.trim().toLowerCase();

    return (
      savedLocations.find((location) => location.label.toLowerCase() === normalizedQuery || location.address.toLowerCase() === normalizedQuery) ??
      null
    );
  }

  private resolveBluetoothTarget(
    triggerType: TriggerType,
    targetBluetoothDeviceId: string | null,
    bluetoothDevices: BluetoothDevice[],
  ): string | null {
    if (!this.isBluetoothTrigger(triggerType)) {
      return targetBluetoothDeviceId;
    }

    if (!targetBluetoothDeviceId) {
      return null;
    }

    return bluetoothDevices.some((device) => device.id === targetBluetoothDeviceId) ? targetBluetoothDeviceId : null;
  }

  private async unregisterPreviousTrigger(existingReminder: Reminder): Promise<void> {
    if (this.isSpatialTrigger(existingReminder.triggerType)) {
      await this.geofencingService.unregister(existingReminder.id);
    }

    if (this.isBluetoothTrigger(existingReminder.triggerType)) {
      await this.bluetoothTriggerService.unregister(existingReminder.id);
    }
  }

  private isSpatialTrigger(triggerType: TriggerType): boolean {
    return triggerType === TriggerType.ENTER || triggerType === TriggerType.EXIT || triggerType === TriggerType.NEARBY;
  }

  private isBluetoothTrigger(triggerType: TriggerType): boolean {
    return triggerType === TriggerType.BLUETOOTH_CONNECT || triggerType === TriggerType.BLUETOOTH_DISCONNECT;
  }
}