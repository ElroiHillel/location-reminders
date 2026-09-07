import { GeofencingService } from "../domain/interfaces/GeofencingService";
import { BluetoothTriggerService } from "../domain/interfaces/BluetoothTriggerService";
import { SpeechToTextService } from "../domain/interfaces/SpeechToTextService";
import { CreateReminderUseCase } from "../application/usecases/CreateReminderUseCase";
import { ParseReminderIntentUseCase } from "../application/usecases/ParseReminderIntentUseCase";
import { UpdateReminderUseCase } from "../application/usecases/UpdateReminderUseCase";
import { ProviderFactory } from "../infrastructure/ProviderFactory";
import { BluetoothDeviceRepository } from "../domain/interfaces/BluetoothDeviceRepository";
import { GeocodingService } from "../domain/interfaces/GeocodingService";
import { NaturalLanguageParserService } from "../domain/interfaces/NaturalLanguageParserService";
import { ReminderRepository } from "../domain/interfaces/ReminderRepository";
import { SavedLocationRepository } from "../domain/interfaces/SavedLocationRepository";
import { UserSettingsRepository } from "../domain/interfaces/UserSettingsRepository";
import { AsyncStorageBluetoothDeviceRepository } from "../infrastructure/repositories/AsyncStorageBluetoothDeviceRepository";
import { AsyncStorageReminderRepository } from "../infrastructure/repositories/AsyncStorageReminderRepository";
import { AsyncStorageSavedLocationRepository } from "../infrastructure/repositories/AsyncStorageSavedLocationRepository";
import { AsyncStorageUserSettingsRepository } from "../infrastructure/repositories/AsyncStorageUserSettingsRepository";
import { TriggerType } from "../domain/models/TriggerType";
import { AppBootstrapState } from "./types";
import { Reminder } from "../domain/models/Reminder";
import { UserSettings } from "../domain/models/UserSettings";
import { NotificationStyle } from "../domain/models/NotificationStyle";
import { ensureNotificationPermission } from "../infrastructure/notifications/NotificationService";

class DynamicNlpService implements NaturalLanguageParserService {
  constructor(private readonly resolver: () => NaturalLanguageParserService) {}

  parseReminder(input: Parameters<NaturalLanguageParserService["parseReminder"]>[0]) {
    return this.resolver().parseReminder(input);
  }
}

class DynamicSpeechToTextService implements SpeechToTextService {
  constructor(private readonly resolver: () => SpeechToTextService) {}

  transcribe(input: Parameters<SpeechToTextService["transcribe"]>[0]) {
    return this.resolver().transcribe(input);
  }

  startRecording(language?: string) {
    return this.resolver().startRecording(language);
  }

  stopRecording() {
    return this.resolver().stopRecording();
  }
}

export class CompositionRoot {
  private readonly providerFactory = new ProviderFactory();
  private activeUserSettings: UserSettings;
  private activeNlpService: NaturalLanguageParserService;
  private activeSpeechToTextService: SpeechToTextService;

  readonly reminderRepository: ReminderRepository;
  readonly savedLocationRepository: SavedLocationRepository;
  readonly bluetoothDeviceRepository: BluetoothDeviceRepository;
  readonly userSettingsRepository: UserSettingsRepository;
  readonly nlpService: NaturalLanguageParserService;
  readonly geocodingService: GeocodingService;
  readonly speechToTextService: SpeechToTextService;
  readonly geofencingService: GeofencingService;
  readonly bluetoothTriggerService: BluetoothTriggerService;
  readonly parseReminderIntentUseCase: ParseReminderIntentUseCase;
  readonly createReminderUseCase: CreateReminderUseCase;
  readonly updateReminderUseCase: UpdateReminderUseCase;

  constructor() {
    this.reminderRepository = new AsyncStorageReminderRepository();
    this.savedLocationRepository = new AsyncStorageSavedLocationRepository([]);
    this.bluetoothDeviceRepository = new AsyncStorageBluetoothDeviceRepository([]);
    this.userSettingsRepository = new AsyncStorageUserSettingsRepository({
      defaultRadiusEnter: 150,
      defaultRadiusExit: 120,
      defaultRadiusNearby: 300,
      nlpProviderPreference: "hybrid",
      geminiApiKey: "",
      defaultNotificationStyle: NotificationStyle.SOUND,
    });

    this.activeUserSettings = {
      defaultRadiusEnter: 150,
      defaultRadiusExit: 120,
      defaultRadiusNearby: 300,
      nlpProviderPreference: "hybrid",
      geminiApiKey: "",
      defaultNotificationStyle: NotificationStyle.SOUND,
    };

    this.activeNlpService = this.providerFactory.createNlpService({
      userSettings: this.activeUserSettings,
      savedLocationRepository: this.savedLocationRepository,
      bluetoothDeviceRepository: this.bluetoothDeviceRepository,
    });

    this.activeSpeechToTextService = this.providerFactory.createSpeechToTextService(this.activeUserSettings);

    this.nlpService = new DynamicNlpService(() => this.activeNlpService);
    this.geocodingService = this.providerFactory.createGeocodingService();
    this.speechToTextService = new DynamicSpeechToTextService(() => this.activeSpeechToTextService);
    this.geofencingService = this.providerFactory.createGeofencingService();
    this.bluetoothTriggerService = this.providerFactory.createBluetoothTriggerService();

    this.parseReminderIntentUseCase = new ParseReminderIntentUseCase(
      this.nlpService,
      this.savedLocationRepository,
      this.bluetoothDeviceRepository,
    );

    this.createReminderUseCase = new CreateReminderUseCase(
      this.reminderRepository,
      this.savedLocationRepository,
      this.bluetoothDeviceRepository,
      this.userSettingsRepository,
      this.geocodingService,
      this.geofencingService,
      this.bluetoothTriggerService,
    );

    this.updateReminderUseCase = new UpdateReminderUseCase(
      this.reminderRepository,
      this.savedLocationRepository,
      this.bluetoothDeviceRepository,
      this.userSettingsRepository,
      this.geocodingService,
      this.geofencingService,
      this.bluetoothTriggerService,
    );
  }

  async hydrate(): Promise<AppBootstrapState> {
    const [reminders, savedLocations, bluetoothDevices, userSettings] = await Promise.all([
      this.reminderRepository.list(),
      this.savedLocationRepository.list(),
      this.bluetoothDeviceRepository.list(),
      this.userSettingsRepository.get(),
    ]);

    if (userSettings) {
      this.applyServicesFromUserSettings(userSettings);
    }

    await ensureNotificationPermission().catch(() => undefined);
    await this.rearmGeofences(reminders);

    return {
      reminders,
      savedLocations,
      bluetoothDevices,
      userSettings,
    };
  }

  async updateUserSettings(settings: UserSettings): Promise<UserSettings> {
    const saved = await this.userSettingsRepository.save(settings);
    this.applyServicesFromUserSettings(saved);
    return saved;
  }

  private applyServicesFromUserSettings(settings: UserSettings): void {
    this.activeUserSettings = settings;
    this.activeNlpService = this.providerFactory.createNlpService({
      userSettings: settings,
      savedLocationRepository: this.savedLocationRepository,
      bluetoothDeviceRepository: this.bluetoothDeviceRepository,
    });
    this.activeSpeechToTextService = this.providerFactory.createSpeechToTextService(settings);
  }

  private async rearmGeofences(reminders: Reminder[]): Promise<void> {
    const activeSpatial = reminders.filter(
      (item) => item.status === "ACTIVE" && item.resolvedLocation && this.isSpatialTrigger(item.triggerType),
    );

    await Promise.all(
      activeSpatial.map((item) =>
        this.geofencingService.register({
          reminderId: item.id,
          triggerType: item.triggerType,
          location: {
            latitude: item.resolvedLocation!.latitude,
            longitude: item.resolvedLocation!.longitude,
          },
          radiusMeters: item.radiusMeters,
        }),
      ),
    );
  }

  private isSpatialTrigger(triggerType: TriggerType): boolean {
    return triggerType === TriggerType.ENTER || triggerType === TriggerType.EXIT || triggerType === TriggerType.NEARBY;
  }
}