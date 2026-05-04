import { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';
import { useAppSettings, AppSettings, FactorySettings } from '../config/app-settings';
import { SessionService, SessionSummary } from '../sessions/types';
import { SessionDetail } from '../sessions/types';
import { InferenceService } from '../inference/types';

import { service as localSessionService, Settings as LocalSessionSettings } from '../sessions/local-provider';
import * as remoteProvider from '../sessions/remote-provider';
import { createService as createGenericInference, Settings as GenericInferenceSettings } from '../inference/generic-provider';
import { createService as createBedrockInference, Settings as BedrockInferenceSettings } from '../inference/bedrock-provider';
import { useSpeech as browserUseSpeech } from '../voice/browser-provider/speech';
import { VoiceService, UseVoiceOptions } from '../voice/types';
import { AuthProvider } from '../sessions/remote-provider/auth';

type UseVoiceHook = (options: UseVoiceOptions) => VoiceService;

// --- Axis registry types ---
export interface ProviderOption {
  key: string;
  label: string;
  Settings: React.ComponentType<{ draft: FactorySettings; onChange: (u: Partial<FactorySettings>) => void }> | null;
}

export interface AxisDescriptor {
  label: string;
  settingsKey: keyof FactorySettings;
  options: ProviderOption[];
}

// --- Provider registries ---
const SESSION_PROVIDERS: ProviderOption[] = [
  { key: 'local', label: '💾 Local (IndexedDB)', Settings: LocalSessionSettings ? () => { const S = LocalSessionSettings; return S ? <S /> : null; } : null },
  { key: 'remote', label: '☁️ Remote (API Gateway)', Settings: () => { const S = remoteProvider.Settings; return <S />; } },
];

const INFERENCE_PROVIDERS: ProviderOption[] = [
  {
    key: 'generic', label: '🔗 OpenAI-compatible',
    Settings: ({ draft, onChange }) => <GenericInferenceSettings
      config={{ providerUrl: draft.providerUrl, providerToken: draft.providerToken, providerModelId: draft.providerModelId }}
      onChange={onChange} />,
  },
  {
    key: 'bedrock', label: '🪨 AWS Bedrock',
    Settings: ({ draft, onChange }) => <BedrockInferenceSettings
      config={{ bedrockRegion: draft.bedrockRegion || 'us-east-1', bedrockModelId: draft.bedrockModelId || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' }}
      onChange={onChange} />,
  },
];

const VOICE_PROVIDERS: ProviderOption[] = [
  { key: 'browser', label: '🎤 Browser (Web Speech API)', Settings: null },
];

export const AXES: AxisDescriptor[] = [
  { label: 'Session storage', settingsKey: 'storageMode', options: SESSION_PROVIDERS },
  { label: 'Inference provider', settingsKey: 'chatProvider', options: INFERENCE_PROVIDERS },
  { label: 'Voice provider', settingsKey: 'voiceProvider' as keyof AppSettings, options: VOICE_PROVIDERS },
];

// --- Provider axis types ---
interface ProviderAxis<S, C extends React.ComponentType<{ draft: FactorySettings; onChange: (u: Partial<FactorySettings>) => void }> | React.ComponentType | null = React.ComponentType | null> {
  service: S;
  Settings: C;
}

interface Providers {
  sessions: ProviderAxis<SessionService>;
  inference: ProviderAxis<InferenceService, React.ComponentType<{ draft: FactorySettings; onChange: (u: Partial<FactorySettings>) => void }>>;
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

import { getProfile } from '../config/profiles';

// --- Resolve provider config from profile or app defaults ---
function resolveConfig(session: SessionDetail, settings: AppSettings): FactorySettings {
  if (session.profileId) {
    const profile = getProfile(session.profileId);
    if (profile) return { ...settings, ...profile };
  }
  return settings;
}

function buildInference(config: FactorySettings): InferenceService {
  return config.chatProvider === 'bedrock'
    ? createBedrockInference(config.bedrockRegion || 'us-east-1', config.bedrockModelId || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0')
    : createGenericInference(config.providerUrl, config.providerToken, config.providerModelId);
}

function buildSessionService(config: FactorySettings) {
  return config.storageMode === 'local' ? localSessionService : remoteProvider.service;
}

const Ctx = createContext<FactoryContext | null>(null);

// --- Factory logic ---
function buildProviders(settings: AppSettings): Providers {
  const sessionService = buildSessionService(settings);
  const SessionSettings = SESSION_PROVIDERS.find(p => p.key === settings.storageMode)?.Settings ?? null;

  const inferenceService: InferenceService = {
    async chat(session: SessionDetail, question: string): Promise<string> {
      const config = resolveConfig(session, settings);
      const inference = buildInference(config);
      const storage = buildSessionService(config);
      const answer = await inference.chat(session, question);
      await storage.appendHistory(session.session_id, 'user', question);
      await storage.appendHistory(session.session_id, 'assistant', answer);
      return answer;
    },
  };

  const InferenceSettings = INFERENCE_PROVIDERS.find(p => p.key === settings.chatProvider)?.Settings ?? (() => null);

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
    setList([]);
    setLoading(true);
    try {
      const data = await providers.sessions.service.list();
      setList(data);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [providers]);

  // No auto-refresh effect — Sidebar and pages call refresh() explicitly

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
