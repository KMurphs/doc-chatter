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
 * Consumers never know which provider is active. The factory decides once based on settings.
 */

// Types
export type { SessionSummary, SessionDetail, CreateSessionRequest, UpdateSessionRequest, SessionService } from './sessions/types';
export type { InferenceService } from './inference/types';
export type { VoiceMode, VoiceService, UseVoiceOptions } from './voice/types';
export type { AppSettings } from './config/app-settings';

// Runtime
export { FactoryProvider, useSessions, useInference, useVoice } from './factory';
export { useAppSettings, AppSettingsProvider } from './config/app-settings';
