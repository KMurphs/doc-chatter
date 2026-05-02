import { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';
import { useAppSettings, AppSettings } from '../config/app-settings';
import { SessionService, SessionSummary } from '../sessions/types';
import { SessionDetail } from '../sessions/types';

import { service as localSessionService, Settings as LocalSessionSettings } from '../sessions/local-provider';
import * as remoteProvider from '../sessions/remote-provider';
import { createService as createGenericInference, Settings as GenericInferenceSettings } from '../inference/generic-provider';
import { createService as createBedrockInference, Settings as BedrockInferenceSettings } from '../inference/bedrock-provider';
import { InferenceService } from '../inference/types';
import { useSpeech as browserUseSpeech } from '../voice/browser-provider/speech';
import { VoiceService, UseVoiceOptions } from '../voice/types';
import { AuthProvider } from '../sessions/remote-provider/auth';

type UseVoiceHook = (options: UseVoiceOptions) => VoiceService;

// --- Types ---
interface ProviderAxis<S, C extends React.ComponentType | null = React.ComponentType | null> {
  service: S;
  Settings: C;
}

interface Providers {
  sessions: ProviderAxis<SessionService>;
  inference: ProviderAxis<InferenceService, React.ComponentType>;
  voice: ProviderAxis<UseVoiceHook>;
}

interface FactoryContext {
  providers: Providers;
  list: SessionSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  removeSession: (id: string) => void;
  addSession: (session: SessionSummary) => void;
}

const Ctx = createContext<FactoryContext | null>(null);

// --- Factory logic ---
function buildProviders(settings: AppSettings): Providers {
  // Sessions
  const isLocal = settings.storageMode === 'local';
  const sessionService = isLocal ? localSessionService : remoteProvider.service;
  const SessionSettings = isLocal ? LocalSessionSettings : remoteProvider.Settings;

  // Inference — wrap raw provider to also persist history
  const isBedrock = settings.chatProvider === 'bedrock';
  const rawInference = isBedrock
    ? createBedrockInference(settings.bedrockRegion || 'us-east-1', settings.bedrockModelId || 'anthropic.claude-sonnet-4-20250514-v1:0')
    : createGenericInference(settings.providerUrl, settings.providerToken);

  const inferenceService: InferenceService = {
    async chat(session: SessionDetail, question: string): Promise<string> {
      const answer = await rawInference.chat(session, question);
      await sessionService.appendHistory(session.session_id, 'user', question);
      await sessionService.appendHistory(session.session_id, 'assistant', answer);
      return answer;
    },
  };

  function InferenceSettings() {
    const { settings: s, update } = useAppSettings();
    if (isBedrock) {
      return <BedrockInferenceSettings
        config={{ bedrockRegion: s.bedrockRegion || 'us-east-1', bedrockModelId: s.bedrockModelId || 'anthropic.claude-sonnet-4-20250514-v1:0' }}
        onChange={u => update(u)} />;
    }
    return <GenericInferenceSettings
      config={{ providerUrl: s.providerUrl, providerToken: s.providerToken }}
      onChange={u => update(u)} />;
  }

  return {
    sessions: { service: sessionService, Settings: SessionSettings },
    inference: { service: inferenceService, Settings: InferenceSettings },
    voice: { service: browserUseSpeech, Settings: null },
  };
}

// --- Provider ---
export function FactoryProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const providers = useMemo(() => buildProviders(settings), [
    settings.storageMode, settings.chatProvider,
    settings.providerUrl, settings.providerToken,
    settings.bedrockRegion, settings.bedrockModelId,
  ]);

  const [list, setList] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await providers.sessions.service.list();
      setList(data);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [providers.sessions]);

  const removeSession = useCallback((id: string) => {
    setList(prev => prev.filter(s => s.session_id !== id));
  }, []);

  const addSession = useCallback((session: SessionSummary) => {
    setList(prev => [session, ...prev]);
  }, []);

  return (
    <AuthProvider>
      <Ctx.Provider value={{ providers, list, loading, refresh, removeSession, addSession }}>
        {children}
      </Ctx.Provider>
    </AuthProvider>
  );
}

// --- Hooks ---
export function useSessions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSessions requires FactoryProvider');
  return {
    ...ctx.providers.sessions,
    sessions: ctx.list, loading: ctx.loading, refresh: ctx.refresh,
    removeSession: ctx.removeSession, addSession: ctx.addSession,
  };
}

export function useInference() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInference requires FactoryProvider');
  return ctx.providers.inference;
}

export function useVoice() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVoice requires FactoryProvider');
  return ctx.providers.voice;
}
