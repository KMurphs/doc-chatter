import { useState, useRef, useCallback, useEffect } from 'react';
import { AppSettings } from '../../config/app-settings';

interface SpeechRecognitionResult { readonly 0: { readonly transcript: string }; }
interface SpeechRecognitionEvent { readonly results: ArrayLike<SpeechRecognitionResult>; }
interface SpeechRecognitionInstance {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void; abort(): void;
}
const SpeechRecognition: (new () => SpeechRecognitionInstance) | undefined =
  (window as unknown as Record<string, unknown>).SpeechRecognition as typeof undefined ||
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof undefined;

export type VoiceMode = 'tap' | 'always';

export function useSpeech({ onTranscript, onFinalResult, voiceMode, settings }: {
  onTranscript: (text: string) => void;
  onFinalResult: (text: string) => void;
  voiceMode: VoiceMode;
  settings: AppSettings;
}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(() => !!SpeechRecognition && !!window.speechSynthesis);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const modeRef = useRef(voiceMode);
  const settingsRef = useRef(settings);
  const onTranscriptRef = useRef(onTranscript);
  const onFinalResultRef = useRef(onFinalResult);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef('');

  useEffect(() => { modeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onFinalResultRef.current = onFinalResult; }, [onFinalResult]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  }, []);

  const finalize = useCallback((text: string) => {
    accumulatedRef.current = '';
    clearSilenceTimer();
    if (text.trim()) onFinalResultRef.current(text.trim());
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recogRef.current) {
      recogRef.current.onresult = null;
      recogRef.current.onend = null;
      recogRef.current.onerror = null;
      recogRef.current.abort();
      recogRef.current = null;
    }
    if (accumulatedRef.current.trim()) finalize(accumulatedRef.current);
    setListening(false);
  }, [clearSilenceTimer, finalize]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    stopListening();
    accumulatedRef.current = '';
    const recog = new SpeechRecognition();
    recog.lang = 'en-US';
    recog.interimResults = true;
    recog.continuous = true;
    recog.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      // Check for trigger word at the end
      const trigger = settingsRef.current.triggerWord;
      if (trigger && transcript.toLowerCase().trimEnd().endsWith(trigger)) {
        const clean = transcript.slice(0, transcript.toLowerCase().lastIndexOf(trigger)).trim();
        recogRef.current?.abort();
        recogRef.current = null;
        setListening(false);
        accumulatedRef.current = '';
        clearSilenceTimer();
        if (clean) onFinalResultRef.current(clean);
        return;
      }

      accumulatedRef.current = transcript;
      onTranscriptRef.current(transcript);

      // Silence timeout for auto-send (Auto mode only)
      clearSilenceTimer();
      if (modeRef.current === 'always') {
        const timeout = settingsRef.current.silenceTimeout * 1000;
        silenceTimer.current = setTimeout(() => {
          if (accumulatedRef.current.trim()) {
            const text = accumulatedRef.current.trim();
            recogRef.current?.abort();
            recogRef.current = null;
            setListening(false);
            finalize(text);
          }
        }, timeout);
      }
    };
    recog.onend = () => {
      recogRef.current = null;
      clearSilenceTimer();
      if (accumulatedRef.current.trim()) finalize(accumulatedRef.current);
      setListening(false);
    };
    recog.onerror = () => {
      recogRef.current = null;
      accumulatedRef.current = '';
      clearSilenceTimer();
      setListening(false);
    };
    recogRef.current = recog;
    setListening(true);
    try { recog.start(); } catch { setListening(false); }
  }, [stopListening, clearSilenceTimer, finalize]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    stopSpeaking();
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = settingsRef.current.ttsSpeed;
      utt.onend = () => {
        setSpeaking(false);
        if (modeRef.current === 'always') setTimeout(() => startListening(), 300);
      };
      utt.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utt);
    }, 200);
  }, [stopSpeaking, startListening]);

  useEffect(() => () => { stopListening(); stopSpeaking(); }, [stopListening, stopSpeaking]);

  return { listening, speaking, supported, startListening, stopListening, speak, stopSpeaking };
}
