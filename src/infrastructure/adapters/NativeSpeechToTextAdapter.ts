import { GoogleGenAI } from "@google/genai";
import { Audio } from "expo-av";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { AudioInput, TranscriptionResult } from "../../domain/interfaces/types";
import { ISpeechToTextService } from "../contracts/ServiceContracts";
import { InfrastructureEnvironment } from "../config/environment";
import { callGeminiWithRetry } from "./geminiRetry";

// Both recording presets actually used below (LOW_QUALITY on iOS, HIGH_QUALITY on Android)
// produce an MPEG-4/AAC container, i.e. ".m4a", regardless of platform.
const RECORDING_MIME_TYPE = "audio/m4a";

export class NativeSpeechToTextAdapter implements ISpeechToTextService {
  private recording: Audio.Recording | null = null;
  private activeLanguage: string | undefined;

  constructor(private readonly environment: InfrastructureEnvironment) {}

  async transcribe(input: AudioInput): Promise<TranscriptionResult> {
    if (!this.environment.geminiApiKey) {
      console.warn("Missing Gemini API key for transcription. Returning an empty transcript so the UI can continue.");
      return {
        text: "",
        confidence: 0,
        provider: "native-fallback",
      };
    }

    try {
      // Read the audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(input.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const ai = new GoogleGenAI({ apiKey: this.environment.geminiApiKey });
      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: this.environment.geminiModel,
          contents: [
            {
              role: "user",
              parts: [
                { text: "Transcribe the following Hebrew audio to text. Return ONLY the transcribed text, nothing else." },
                { inlineData: { mimeType: RECORDING_MIME_TYPE, data: base64Audio } },
              ],
            },
          ],
          config: {
            temperature: 0,
          },
        }),
      );

      const transcribedText = response.text?.trim() ?? "";

      return {
        text: transcribedText,
        confidence: 1,
        provider: "gemini-speech",
      };
    } catch (error) {
      console.error("Transcription adapter error:", error);
      return {
        text: "",
        confidence: 0,
        provider: "native-fallback",
      };
    }
  }

  async startRecording(language = "he"): Promise<void> {
    if (this.recording) {
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission was denied.");
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Use a preset that is compatible with Gemini and mobile
    const { recording } = await Audio.Recording.createAsync(
      Platform.OS === "ios" 
        ? Audio.RecordingOptionsPresets.LOW_QUALITY 
        : Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    this.recording = recording;
    this.activeLanguage = language;
  }

  async stopRecording(): Promise<TranscriptionResult> {
    const recording = this.recording;
    if (!recording) {
      throw new Error("No active recording session.");
    }

    this.recording = null;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) {
      throw new Error("Recording completed without a file URI.");
    }

    return this.transcribe({ uri, language: this.activeLanguage });
  }
}