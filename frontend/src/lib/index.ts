/**
 * lib/ — Public API barrel
 *
 * This is the ONLY entry point consumers (pages, components, App) should import from.
 * A lint rule (no-restricted-imports) enforces this boundary.
 *
 * Architecture: three provider axes, one factory.
 *
 *   sessions/   — Where session data lives. Providers: local (IndexedDB), remote (API Gateway + Cognito).
 *   inference/  — How chat gets answered. Providers: generic (Token+URL), bedrock (direct AWS Bedrock).
 *   voice/      — STT/TTS. Providers: browser (Web Speech API). Future: Whisper, etc.
 *
 *   factory/    — Reads AppSettings, instantiates the correct provider for each axis,
 *                 and exposes them via React context. Wires cross-cutting concerns
 *                 (e.g. persisting chat history after inference).
 *
 *   config/     — AppSettings (localStorage-backed, provider-agnostic preferences).
 *
 * Each provider exports { service, Settings }:
 *   - service:  the implementation (SessionService, InferenceService, or UseVoiceHook)
 *   - Settings: a React component for provider-specific configuration (or null if none needed)
 *
 * The factory exposes hooks that return { service, Settings } per axis:
 *   - useSessions()  → session CRUD + list state + Settings (e.g. remote login form)
 *   - useInference() → chat service + Settings (e.g. endpoint URL fields, Bedrock model picker)
 *   - useVoice()     → speech hook + Settings (null for browser provider)
 *
 * Consumers see UserSettings (display + voice only). Provider config (storageMode,
 * chatProvider, credentials) is internal to the factory.
 */

// Types — consumer-facing
export type { SessionSummary, SessionDetail, CreateSessionRequest, UpdateSessionRequest, SessionService } from './sessions/types';
export type { InferenceService } from './inference/types';
export type { VoiceMode, VoiceService, UseVoiceOptions } from './voice/types';
export type { UserSettings } from './config/app-settings';

// Runtime — consumer-facing
export { FactoryProvider, useSessions, useInference, useVoice, AXES } from './factory';
export type { AxisDescriptor, ProviderOption } from './factory';
export { useUserSettings, AppSettingsProvider } from './config/app-settings';

// Internal — only for settings panel and App.tsx (which hosts the panel)
export type { AppSettings, FactorySettings } from './config/app-settings';
export { listProfiles, getProfile, saveProfile, deleteProfile, exportProfile, importProfile } from './config/profiles';
export type { Profile } from './config/profiles';
export { useAppSettings } from './config/app-settings';
