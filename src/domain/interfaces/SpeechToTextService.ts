import { AudioInput, TranscriptionResult } from "./types";

export interface SpeechToTextService {
  transcribe(input: AudioInput): Promise<TranscriptionResult>;
  startRecording(language?: string): Promise<void>;
  stopRecording(): Promise<TranscriptionResult>;
}