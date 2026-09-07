import { BluetoothDeviceRepository } from "../../domain/interfaces/BluetoothDeviceRepository";
import { BluetoothTriggerService } from "../../domain/interfaces/BluetoothTriggerService";
import { GeocodingService } from "../../domain/interfaces/GeocodingService";
import { GeofencingService } from "../../domain/interfaces/GeofencingService";
import { ReminderRepository } from "../../domain/interfaces/ReminderRepository";
import { SavedLocationRepository } from "../../domain/interfaces/SavedLocationRepository";
import { UserSettingsRepository } from "../../domain/interfaces/UserSettingsRepository";
import { GeocodeResult, GeofenceRegistrationResult } from "../../domain/interfaces/types";
import { BluetoothDevice } from "../../domain/models/BluetoothDevice";
import { ParserResult } from "../../domain/models/ParserResult";
import { Reminder, ResolvedLocation } from "../../domain/models/Reminder";
import { SavedLocation } from "../../domain/models/SavedLocation";
import { TriggerType } from "../../domain/models/TriggerType";
import { UserSettings } from "../../domain/models/UserSettings";
import { NotificationStyle } from "../../domain/models/NotificationStyle";
import { normalizeLocationQueryForGeocoding } from "../../domain/services/normalizeLocationQuery";

export interface CreateReminderUseCaseInput {
  title: string;
  action?: string;
  triggerType?: TriggerType;
  parsedLocationQuery?: string;
  parserResult?: ParserResult;
  radiusMeters?: number;
  isRecurring?: boolean;
  targetBluetoothDeviceId?: string | null;
  manualResolvedLocation?: ResolvedLocation | null;
  confidenceThreshold?: number;
  notificationStyle?: NotificationStyle;
}

export interface CreateReminderUseCaseResult {
  reminder: Reminder;
  requiresFallback: boolean;
  geofenceRegistration?: GeofenceRegistrationResult;
  bluetoothTriggerRegistration?: { triggerId: string; active: boolean };
}

export class CreateReminderUseCase {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly savedLocationRepository: SavedLocationRepository,
    private readonly bluetoothDeviceRepository: BluetoothDeviceRepository,
    private readonly userSettingsRepository: UserSettingsRepository,
    private readonly geocodingService: GeocodingService,
    private readonly geofencingService: GeofencingService,
    private readonly bluetoothTriggerService: BluetoothTriggerService,
  ) {}

  async execute(input: CreateReminderUseCaseInput): Promise<CreateReminderUseCaseResult> {
    const parserResult = input.parserResult;
    const triggerType = input.triggerType ?? parserResult?.triggerType ?? TriggerType.NEARBY;
    const action = input.action ?? parserResult?.action ?? input.title;
    const parsedLocationQuery = input.parsedLocationQuery ?? parserResult?.locationTarget ?? null;
    const confidence = parserResult?.confidence ?? 1;
    const confidenceThreshold = input.confidenceThreshold ?? 0.6;

    const [userSettings, savedLocations, bluetoothDevices] = await Promise.all([
      this.loadUserSettings(),
      this.savedLocationRepository.list(),
      this.bluetoothDeviceRepository.list(),
    ]);

    const matchedSavedLocation = this.resolveSavedLocation(parserResult?.matchedSavedLocation, savedLocations);
    const matchedBluetoothDevice = this.resolveBluetoothDevice(parserResult?.matchedBluetoothDevice, bluetoothDevices);
    const radiusMeters = input.radiusMeters ?? this.resolveDefaultRadius(triggerType, userSettings);

    const resolvedLocation = input.manualResolvedLocation ?? (await this.resolveLocation(triggerType, matchedSavedLocation, parsedLocationQuery));
    const targetBluetoothDeviceId = this.resolveBluetoothTarget(triggerType, input.targetBluetoothDeviceId, matchedBluetoothDevice);

    const requiresFallback =
      confidence < confidenceThreshold ||
      (this.isSpatialTrigger(triggerType) && resolvedLocation === null) ||
      (this.isBluetoothTrigger(triggerType) && targetBluetoothDeviceId === null);

    const reminder: Reminder = {
      id: this.generateId(),
      title: input.title,
      action,
      triggerType,
      isRecurring: input.isRecurring ?? false,
      targetBluetoothDeviceId,
      parsedLocationQuery,
      resolvedLocation,
      radiusMeters,
      notificationStyle: input.notificationStyle ?? userSettings?.defaultNotificationStyle ?? NotificationStyle.SOUND,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.reminderRepository.save(reminder);

    let geofenceRegistration: GeofenceRegistrationResult | undefined;
    let bluetoothTriggerRegistration: { triggerId: string; active: boolean } | undefined;

    if (this.isSpatialTrigger(triggerType) && resolvedLocation) {
      geofenceRegistration = await this.geofencingService.register({
        reminderId: reminder.id,
        triggerType,
        location: resolvedLocation,
        radiusMeters,
      });
    }

    if (this.isBluetoothTrigger(triggerType) && targetBluetoothDeviceId) {
      bluetoothTriggerRegistration = await this.bluetoothTriggerService.register(
        targetBluetoothDeviceId,
        reminder.id,
        triggerType === TriggerType.BLUETOOTH_CONNECT,
      );
    }

    return {
      reminder,
      requiresFallback,
      geofenceRegistration,
      bluetoothTriggerRegistration,
    };
  }

  private async loadUserSettings(): Promise<UserSettings | null> {
    return this.userSettingsRepository.get();
  }

  private resolveSavedLocation(matchedSavedLocation: SavedLocation | null | undefined, savedLocations: SavedLocation[]): SavedLocation | null {
    if (!matchedSavedLocation) {
      return null;
    }

    return savedLocations.find((location) => location.id === matchedSavedLocation.id) ?? matchedSavedLocation;
  }

  private resolveBluetoothDevice(
    matchedBluetoothDevice: BluetoothDevice | null | undefined,
    bluetoothDevices: BluetoothDevice[],
  ): BluetoothDevice | null {
    if (!matchedBluetoothDevice) {
      return null;
    }

    return bluetoothDevices.find((device) => device.id === matchedBluetoothDevice.id) ?? matchedBluetoothDevice;
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

  private async resolveLocation(
    triggerType: TriggerType,
    matchedSavedLocation: SavedLocation | null,
    parsedLocationQuery: string | null,
  ): Promise<ResolvedLocation | null> {
    if (!this.isSpatialTrigger(triggerType)) {
      return null;
    }

    if (matchedSavedLocation) {
      return {
        latitude: matchedSavedLocation.latitude,
        longitude: matchedSavedLocation.longitude,
        address: matchedSavedLocation.address,
      };
    }

    if (!parsedLocationQuery) {
      return null;
    }

    const geocodedLocation: GeocodeResult | null = await this.geocodingService.geocode({
      text: normalizeLocationQueryForGeocoding(parsedLocationQuery),
    });

    if (!geocodedLocation) {
      return null;
    }

    return {
      latitude: geocodedLocation.latitude,
      longitude: geocodedLocation.longitude,
      address: geocodedLocation.address,
    };
  }

  private resolveBluetoothTarget(
    triggerType: TriggerType,
    explicitTargetBluetoothDeviceId: string | null | undefined,
    matchedBluetoothDevice: BluetoothDevice | null,
  ): string | null {
    if (!this.isBluetoothTrigger(triggerType)) {
      return explicitTargetBluetoothDeviceId ?? null;
    }

    return explicitTargetBluetoothDeviceId ?? matchedBluetoothDevice?.id ?? null;
  }

  private isSpatialTrigger(triggerType: TriggerType): boolean {
    return triggerType === TriggerType.ENTER || triggerType === TriggerType.EXIT || triggerType === TriggerType.NEARBY;
  }

  private isBluetoothTrigger(triggerType: TriggerType): boolean {
    return triggerType === TriggerType.BLUETOOTH_CONNECT || triggerType === TriggerType.BLUETOOTH_DISCONNECT;
  }

  private generateId(): string {
    return `rem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}