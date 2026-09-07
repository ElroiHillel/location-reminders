import { GoogleGenAI } from "@google/genai";
import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import type { AudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { AudioInput, TranscriptionResult } from "../../domain/interfaces/types";
import { ISpeechToTextService } from "../contracts/ServiceContracts";
import { InfrastructureEnvironment } from "../config/environment";
import { callGeminiWithRetry } from "./geminiRetry";

// RecordingPresets.HIGH_QUALITY produces an MPEG-4/AAC container (".m4a") on both platforms.
const RECORDING_MIME_TYPE = "audio/m4a";

export class NativeSpeechToTextAdapter implements ISpeechToTextService {
  private recorder: AudioRecorder | null = null;
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
    if (this.recorder) {
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission was denied.");
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();

    this.recorder = recorder;
    this.activeLanguage = language;
  }

  async stopRecording(): Promise<TranscriptionResult> {
    const recorder = this.recorder;
    if (!recorder) {
      throw new Error("No active recording session.");
    }

    this.recorder = null;

    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      throw new Error("Recording completed without a file URI.");
    }

    return this.transcribe({ uri, language: this.activeLanguage });
  }
}