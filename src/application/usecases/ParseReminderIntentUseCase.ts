import { BluetoothDeviceRepository } from "../../domain/interfaces/BluetoothDeviceRepository";
import { NaturalLanguageParserService } from "../../domain/interfaces/NaturalLanguageParserService";
import { SavedLocationRepository } from "../../domain/interfaces/SavedLocationRepository";
import { ParserResult } from "../../domain/models/ParserResult";
import { ParserInput } from "../../domain/interfaces/types";

export interface ParseReminderIntentUseCaseInput {
  text: string;
  language?: string;
}

export class ParseReminderIntentUseCase {
  constructor(
    private readonly parserService: NaturalLanguageParserService,
    private readonly savedLocationRepository: SavedLocationRepository,
    private readonly bluetoothDeviceRepository: BluetoothDeviceRepository,
  ) {}

  async execute(input: ParseReminderIntentUseCaseInput): Promise<ParserResult> {
    const [savedLocations, bluetoothDevices] = await Promise.all([
      this.savedLocationRepository.list(),
      this.bluetoothDeviceRepository.list(),
    ]);

    const parserInput: ParserInput = {
      text: input.text,
      context: {
        savedLocations,
        bluetoothDevices,
      },
    };

    return this.parserService.parseReminder(parserInput);
  }
}