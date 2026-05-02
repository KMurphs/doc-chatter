import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export type VoiceMode = 'tap' | 'always';

export function useSpeech({ onResult, voiceMode }: { onResult: (text: string) => void; voiceMode: VoiceMode }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(() => !!SpeechRecognition && !!window.speechSynthesis);
  const recogRef = useRef<any>(null);
  const modeRef = useRef(voiceMode);

  useEffect(() => { modeRef.current = voiceMode; }, [voiceMode]);

  const stopListening = useCallback(() => {
    recogRef.current?.abort();
    recogRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    stopListening();
    const recog = new SpeechRecognition();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.continuous = false;
    recog.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript;
      if (text) onResult(text);
    };
    recog.onend = () => { recogRef.current = null; setListening(false); };
    recog.onerror = () => { recogRef.current = null; setListening(false); };
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }, [onResult, stopListening]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    stopSpeaking();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.1;
    utt.onend = () => {
      setSpeaking(false);
      if (modeRef.current === 'always') startListening();
    };
    utt.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  }, [stopSpeaking, startListening]);

  useEffect(() => () => { stopListening(); stopSpeaking(); }, [stopListening, stopSpeaking]);

  return { listening, speaking, supported, startListening, stopListening, speak, stopSpeaking };
}
