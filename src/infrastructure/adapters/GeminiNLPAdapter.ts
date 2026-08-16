import { GoogleGenAI } from "@google/genai";
import { ParserInput } from "../../domain/interfaces/types";
import { BluetoothDevice } from "../../domain/models/BluetoothDevice";
import { ParserResult } from "../../domain/models/ParserResult";
import { SavedLocation } from "../../domain/models/SavedLocation";
import { TriggerType } from "../../domain/models/TriggerType";
import { INLPParsingService } from "../contracts/ServiceContracts";
import { InfrastructureEnvironment } from "../config/environment";
import { callGeminiWithRetry } from "./geminiRetry";

interface GeminiCandidateResponse {
  action?: string;
  locationTarget?: string | null;
  triggerType?: string | null;
  confidence?: number;
  matchedSavedLocationId?: string | null;
  matchedSavedLocationLabel?: string | null;
  matchedBluetoothDeviceId?: string | null;
  matchedBluetoothDeviceName?: string | null;
  requiresFallback?: boolean;
}

export class GeminiNLPAdapter implements INLPParsingService {
  constructor(private readonly environment: InfrastructureEnvironment) {}

  async parseReminder(input: ParserInput): Promise<ParserResult> {
    if (!this.environment.geminiApiKey) {
      throw new Error("Missing Gemini API key. Set EXPO_PUBLIC_GEMINI_API_KEY.");
    }

    const ai = new GoogleGenAI({ apiKey: this.environment.geminiApiKey });
    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: this.environment.geminiModel,
        contents: this.buildContents(input),
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    );

    const parsed = this.parseCandidateResponse(response.text ?? "{}");

    return this.toParserResult(parsed, input.context.savedLocations, input.context.bluetoothDevices);
  }

  private buildContents(input: ParserInput): string {
    const systemInstructions = [
      "You are a Hebrew reminder intent parser.",
      "Return JSON only, no markdown, no code fences.",
      "Preserve Hebrew text when it is the best action or location target.",
      "Match against the provided saved locations and Bluetooth devices before inventing new entities.",
      "Choose triggerType from ENTER, EXIT, NEARBY, BLUETOOTH_CONNECT, BLUETOOTH_DISCONNECT, or null.",
      "Set requiresFallback to true when confidence is low or the location cannot be resolved confidently.",
    ].join(" ");

    const contextSummary = {
      text: input.text,
      savedLocations: input.context.savedLocations.map((location) => ({
        id: location.id,
        label: location.label,
        address: location.address,
      })),
      bluetoothDevices: input.context.bluetoothDevices.map((device) => ({
        id: device.id,
        name: device.name,
        isVehicle: device.isVehicle,
      })),
    };

    const prompt = `Parse the following reminder intent into JSON with these fields: action, locationTarget, triggerType, confidence, matchedSavedLocationId, matchedBluetoothDeviceId, requiresFallback. Input: ${JSON.stringify(contextSummary)}`;

    return `${systemInstructions}\n\n${prompt}`;
  }

  private parseCandidateResponse(rawText: string): GeminiCandidateResponse {
    const trimmed = rawText.trim();
    const jsonText = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim() : trimmed;

    try {
      return JSON.parse(jsonText) as GeminiCandidateResponse;
    } catch {
      return {};
    }
  }

  private toParserResult(
    parsed: GeminiCandidateResponse,
    savedLocations: SavedLocation[],
    bluetoothDevices: BluetoothDevice[],
  ): ParserResult {
    const matchedSavedLocation = this.resolveSavedLocation(parsed, savedLocations);
    const matchedBluetoothDevice = this.resolveBluetoothDevice(parsed, bluetoothDevices);

    return {
      action: parsed.action ?? "",
      locationTarget: parsed.locationTarget ?? null,
      triggerType: this.parseTriggerType(parsed.triggerType),
      confidence: this.clampConfidence(parsed.confidence),
      matchedSavedLocation,
      matchedBluetoothDevice,
      requiresFallback: parsed.requiresFallback ?? false,
    };
  }

  private resolveSavedLocation(parsed: GeminiCandidateResponse, savedLocations: SavedLocation[]): SavedLocation | null {
    if (parsed.matchedSavedLocationId) {
      const byId = savedLocations.find((location) => location.id === parsed.matchedSavedLocationId);
      if (byId) {
        return byId;
      }
    }

    const label = parsed.matchedSavedLocationLabel?.trim().toLowerCase();
    if (!label) {
      return null;
    }

    return savedLocations.find((location) => location.label.toLowerCase() === label) ?? null;
  }

  private resolveBluetoothDevice(parsed: GeminiCandidateResponse, bluetoothDevices: BluetoothDevice[]): BluetoothDevice | null {
    if (parsed.matchedBluetoothDeviceId) {
      const byId = bluetoothDevices.find((device) => device.id === parsed.matchedBluetoothDeviceId);
      if (byId) {
        return byId;
      }
    }

    const name = parsed.matchedBluetoothDeviceName?.trim().toLowerCase();
    if (!name) {
      return null;
    }

    return bluetoothDevices.find((device) => device.name.toLowerCase() === name) ?? null;
  }

  private parseTriggerType(value?: string | null): TriggerType | null {
    switch (value) {
      case "ENTER":
        return TriggerType.ENTER;
      case "EXIT":
        return TriggerType.EXIT;
      case "NEARBY":
        return TriggerType.NEARBY;
      case "BLUETOOTH_CONNECT":
        return TriggerType.BLUETOOTH_CONNECT;
      case "BLUETOOTH_DISCONNECT":
        return TriggerType.BLUETOOTH_DISCONNECT;
      default:
        return null;
    }
  }

  private clampConfidence(value?: number): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }

    return Math.max(0, Math.min(1, value));
  }
}