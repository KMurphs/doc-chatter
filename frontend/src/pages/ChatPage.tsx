import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSessions, useInference, useVoice, useUserSettings, SessionDetail, VoiceMode } from '../lib';
import { useSidebar, useSettingsModal } from '../App';

// --- Panel background based on voice state ---
function panelBg(listening: boolean, speaking: boolean, sending: boolean) {
  if (listening) return 'bg-accent/10 dark:bg-accent/20 transition-colors duration-500';
  if (sending) return 'bg-amber-500/5 dark:bg-amber-500/10 transition-colors duration-500';
  if (speaking) return 'bg-teal-500/5 dark:bg-teal-500/10 transition-colors duration-500';
  return 'bg-light-surface dark:bg-dark-surface transition-colors duration-500';
}

// --- Mic button ---
function MicButton({ listening, speaking, sending, size, onClick }: {
  listening: boolean; speaking: boolean; sending: boolean; size: 'lg' | 'xl'; onClick: () => void;
}) {
  const dims = size === 'xl' ? 'w-40 h-40 text-6xl' : 'w-24 h-24 text-4xl';
  const ring = listening ? 'ring-4 ring-accent/40' : '';
  const bg = listening
    ? 'bg-accent text-white shadow-lg shadow-accent/30 animate-pulse'
    : speaking ? 'bg-accent/20 text-accent animate-[pulse_2s_ease-in-out_infinite]'
    : sending ? 'bg-amber-500/20 text-amber-500 animate-[pulse_3s_ease-in-out_infinite]'
    : 'bg-light-surface-alt dark:bg-dark-surface-alt text-light-muted dark:text-dark-muted hover:bg-accent/10 hover:text-accent';
  return (
    <button onClick={onClick} className={`${dims} ${bg} ${ring} rounded-full flex items-center justify-center transition-all`}>
      {listening ? '🎙️' : speaking ? '🔊' : sending ? '⏳' : '🎤'}
    </button>
  );
}

// --- Voice mode toggle ---
function VoiceModeToggle({ mode, onChange }: { mode: VoiceMode; onChange: (m: VoiceMode) => void }) {
  const isAuto = mode === 'always';
  return (
    <button onClick={() => onChange(isAuto ? 'tap' : 'always')}
      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
        isAuto ? 'border-accent text-accent bg-accent/10 font-medium' : 'border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:text-accent'
      }`}>
      {isAuto ? '🔊 Auto mode' : '🎤 Tap mode'}
    </button>
  );
}

// --- Status label ---
function StatusLabel({ listening, speaking, sending, voiceMode }: { listening: boolean; speaking: boolean; sending: boolean; voiceMode: VoiceMode }) {
  if (listening) return <span className="text-accent">Listening...</span>;
  if (sending) return <span className="text-amber-500">Thinking...</span>;
  if (speaking) return <span className="text-accent">Speaking...</span>;
  if (voiceMode === 'always') return <span className="text-light-muted dark:text-dark-muted">Ready — speak when ready</span>;
  return <span className="text-light-muted dark:text-dark-muted">Tap to speak</span>;
}

// --- Mic panel (shared between desktop left panel and eyes-off) ---
function MicPanel({ listening, speaking, sending, size, onMicTap, onStopSpeaking, voiceMode, onVoiceModeChange, onSettings }: {
  listening: boolean; speaking: boolean; sending: boolean; size: 'lg' | 'xl';
  onMicTap: () => void; onStopSpeaking: () => void;
  voiceMode: VoiceMode; onVoiceModeChange: (m: VoiceMode) => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <MicButton listening={listening} speaking={speaking} sending={sending} size={size} onClick={onMicTap} />
      <div className="text-xs"><StatusLabel listening={listening} speaking={speaking} sending={sending} voiceMode={voiceMode} /></div>
      <div className="flex items-center gap-2">
        <VoiceModeToggle mode={voiceMode} onChange={onVoiceModeChange} />
        <button onClick={onSettings} className="text-[10px] px-2 py-1 rounded-lg border border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:text-accent transition-colors">⚙️</button>
      </div>
      {speaking && (
        <button onClick={onStopSpeaking} className="text-xs text-light-muted dark:text-dark-muted hover:text-accent">Stop</button>
      )}
    </div>
  );
}

import Markdown from 'react-markdown';

// --- Chat transcript ---
function ChatTranscript({ history, sending, speaking, supported, speak, messagesEnd, renderMarkdown }: {
  history: { role: string; content: string }[];
  sending: boolean; speaking: boolean; supported: boolean;
  speak: (t: string) => void; messagesEnd: React.RefObject<HTMLDivElement>;
  renderMarkdown: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-4 py-6 flex flex-col gap-6">
        {history.length === 0 && (
          <div className="text-center text-sm text-light-muted dark:text-dark-muted py-12">Ask your first question about this paper</div>
        )}
        {history.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`text-sm leading-relaxed ${!renderMarkdown ? 'whitespace-pre-wrap' : ''} ${
              turn.role === 'user'
                ? 'bg-accent/10 dark:bg-accent/15 text-light-text-primary dark:text-dark-text-primary rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]'
                : 'text-light-text-primary dark:text-dark-text-primary max-w-full'
            }`}>
              {turn.role === 'assistant' && renderMarkdown
                ? <div className="prose prose-sm dark:prose-invert max-w-none"><Markdown>{turn.content}</Markdown></div>
                : turn.content}
              {turn.role === 'assistant' && supported && (
                <button onClick={() => speak(turn.content)} className="ml-2 text-light-muted dark:text-dark-muted hover:text-accent text-xs align-middle">🔊</button>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="flex justify-start"><div className="text-sm text-light-muted dark:text-dark-muted italic">Thinking...</div></div>}
        {speaking && <div className="flex justify-start"><div className="text-sm text-accent italic">Speaking...</div></div>}
        <div ref={messagesEnd} />
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="px-4 py-2 flex items-start gap-2 shrink-0 max-w-full overflow-hidden">
      <span className="text-sm text-red-500 break-all line-clamp-2 min-w-0">{error}</span>
      <button onClick={() => { navigator.clipboard.writeText(error); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="text-xs text-red-400 hover:text-red-300 shrink-0 mt-0.5">{copied ? '✓' : '📋'}</button>
    </div>
  );
}

// --- Main ChatPage ---
export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { openSidebar } = useSidebar();
  const { openSettings } = useSettingsModal();
  const sessionService = useSessions().service;
  const { service: useSpeech } = useVoice();
  const { service: { chat } } = useInference();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('tap');
  const [view, setView] = useState<'chat' | 'eyes-off'>('chat');
  const messagesEnd = useRef<HTMLDivElement>(null);
  const lastInputWasVoice = useRef(false);
  const { settings } = useUserSettings();

  const handleTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);

  const sendTextRef = useRef<(q: string) => void>(() => {});

  const handleFinalResult = useCallback((text: string) => {
    lastInputWasVoice.current = true;
    setInput('');
    sendTextRef.current(text);
  }, []);

  const { listening, speaking, supported, startListening, stopListening, speak, stopSpeaking } = useSpeech({
    onTranscript: handleTranscript,
    onFinalResult: handleFinalResult,
    voiceMode,
    settings,
  });

  useEffect(() => { if (id) loadSession(); }, [id]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.history, view]);

  async function loadSession() {
    setLoading(true);
    try {
      if (!id) return;
      setSession(await sessionService.get(id));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }

  async function sendText(question: string) {
    if (!question.trim() || !id || sending || !session) return;
    const wasVoice = lastInputWasVoice.current;
    lastInputWasVoice.current = false;
    setInput('');
    setSending(true);
    setError('');
    setSession(prev => prev ? { ...prev, history: [...prev.history, { role: 'user', content: question }] } : prev);
    try {
      const answer = await chat(session, question);
      setSession(prev => prev ? { ...prev, history: [...prev.history, { role: 'assistant', content: answer }] } : prev);
      if (wasVoice) speak(answer);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chat failed');
      setSession(prev => prev ? { ...prev, history: prev.history.slice(0, -1) } : prev);
    } finally { setSending(false); }
  }
  sendTextRef.current = sendText;

  function handleSend() { lastInputWasVoice.current = false; sendText(input); }

  function handleMicTap() {
    if (listening) { stopListening(); return; }
    if (speaking) { stopSpeaking(); return; }
    startListening();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-light-muted dark:text-dark-muted">Loading...</span></div>;
  if (!session) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-red-500">Session not found</span></div>;

  const header = (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-light-border dark:border-dark-border shrink-0">
      <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent md:hidden transition-colors" onClick={openSidebar}>☰</span>
      <h1 className="text-sm font-medium flex-1 truncate">{session.title}</h1>
    </div>
  );

  // --- Eyes-off view ---
  if (view === 'eyes-off') {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className={`flex-1 flex flex-col items-center justify-center px-4 ${panelBg(listening, speaking, sending)}`}>
          <MicPanel listening={listening} speaking={speaking} sending={sending} size="xl"
            onMicTap={handleMicTap} onStopSpeaking={stopSpeaking}
            voiceMode={voiceMode} onVoiceModeChange={setVoiceMode} onSettings={() => openSettings()} />
        </div>
        {error && <ErrorBanner error={error} />}
        <div className="pb-4 px-4 flex justify-center shrink-0">
          <button onClick={() => setView('chat')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:text-accent hover:border-accent transition-colors">
            💬
          </button>
        </div>
      </div>
    );
  }

  // --- Desktop split + mobile chat ---
  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 flex min-h-0">
        {/* Left: chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatTranscript history={session.history} sending={sending} speaking={speaking} supported={supported} speak={speak} messagesEnd={messagesEnd} renderMarkdown={settings.renderMarkdown} />
          {error && <ErrorBanner error={error} />}
          <div className="pb-4 px-4 shrink-0">
            <div className="max-w-[720px] mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-2xl px-4 py-2 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Ask about the paper..." disabled={sending}
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-light-muted dark:placeholder:text-dark-muted py-1.5 disabled:opacity-50" />
                <button onClick={handleSend} disabled={!input.trim() || sending}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${input.trim() && !sending ? 'bg-accent text-white' : 'bg-light-border dark:bg-dark-border text-light-muted dark:text-dark-muted'}`}>↑</button>
              </div>
              {supported && (
                <button onClick={() => setView(v => v === 'chat' ? 'eyes-off' : 'chat')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors shrink-0 ${
                    view === 'chat' ? 'border-accent text-accent bg-accent/10' : 'border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:text-accent hover:border-accent'
                  }`}>
                  💬
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Right: mic panel (desktop only) */}
        <div className={`hidden lg:flex w-80 shrink-0 flex-col items-center justify-center border-l border-light-border dark:border-dark-border ${panelBg(listening, speaking, sending)}`}>
          <MicPanel listening={listening} speaking={speaking} sending={sending} size="lg"
            onMicTap={handleMicTap} onStopSpeaking={stopSpeaking}
            voiceMode={voiceMode} onVoiceModeChange={setVoiceMode} onSettings={() => openSettings()} />
        </div>
      </div>
    </div>
  );
}
