import { UserSettings } from '../config/app-settings';

export type VoiceMode = 'tap' | 'always';

export interface VoiceService {
  listening: boolean;
  speaking: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

export interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  onFinalResult: (text: string) => void;
  voiceMode: VoiceMode;
  settings: UserSettings;
}
