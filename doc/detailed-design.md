# Voice-first Research Paper Assistant — Detailed Design (Phase 1)

## Overview

A hands-free, voice-driven system for reasoning over research papers. Designed for users on the move — driving, walking, doing something else — who want to engage with dense academic content conversationally rather than reading it.

Phase 1 is diagnostic. The goal is not to build a production system but to understand where full-context reasoning breaks down when entire papers are given to models directly. There is no retrieval pipeline, no vector database, no chunking. The system is intentionally thin so that the behaviour of the models is observable. That understanding is what will later justify whether to introduce RAG, routing complexity, or more sophisticated memory systems.

## Architecture

The system is built entirely on AWS. There are four services doing real work: S3 for storage and hosting, Lambda for compute, Bedrock for inference, and CloudFront for distribution and access control. API Gateway handles session management endpoints.

```
[PWA - React/Vite]  ←  S3 + CloudFront
        |
   ┌────┴────────────┐
   v                  v
[API Gateway]    [Lambda Function URL]
(sessions CRUD)  (streaming chat)
(API key auth)   (session token auth)
   └────┬────────────┘
        v
   [Rust Lambda]
   |         |
[Bedrock]  [S3 bucket]
            (sessions JSON)
```

The PWA is a React app built with Vite, hosted as static files on S3 behind CloudFront. It talks to two backend entry points that share a single Rust Lambda.

The first entry point is an API Gateway REST API that handles session management — creating, listing, loading, and deleting sessions. This is protected by API Gateway's built-in API key mechanism.

The second entry point is a Lambda Function URL that handles the chat interaction. This is the only endpoint that talks to Bedrock, and it streams the response back to the client as tokens are generated. This matters because Bedrock calls can take 5-15 seconds to complete, and waiting in silence that long is unacceptable for a voice-first experience. The Function URL supports response streaming natively, which API Gateway does not. Authentication here uses a per-session token rather than an API key (more on this below).

Both entry points invoke the same Lambda. The Lambda inspects the event source and routes internally.

## Session State

Session state lives in S3 as plain JSON files under a `sessions/` prefix. There is no database. For a single-user system with a handful of sessions, S3 is simpler than DynamoDB, easier to debug (you can just download the files), and one fewer service to provision.

Each session file contains everything the system needs to reconstruct a conversation:

```json
{
  "session_id": "uuid",
  "title": "Auto-generated from first ~50 chars of paper or user-provided",
  "paper_text": "Full paper text",
  "history": [
    { "role": "user", "content": "why did they use dropout?" },
    { "role": "assistant", "content": "The authors used dropout because..." }
  ],
  "model": "opus | sonnet | haiku",
  "system_prompt": "Editable per session",
  "subject_expertise": "low | medium | high",
  "research_expertise": "low | medium | high",
  "token": "UUID for streaming auth",
  "token_expiry": "ISO 8601 timestamp",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

Sessions persist until the user deletes them. The UI shows a list of previous sessions that the user can tap to continue.

## Paper Ingestion

Papers enter the system client-side. There is no server-side PDF processing.

The user can either paste raw text into a text area or upload a PDF file. If they upload a PDF, the browser extracts the text using pdf.js — no round-trip to the server. The extracted text is sent to the Lambda once when creating the session. Every subsequent request only sends the session ID and the new question; the Lambda pulls the paper and conversation history from S3.

## Model Selection

Bedrock provides three Claude models, exposed in the UI as a toggle:

| Label    | Model          | Use case                                          |
|----------|----------------|---------------------------------------------------|
| Deep     | Claude 4 Opus  | Complex reasoning, cross-paper questions          |
| Balanced | Claude 4 Sonnet| General questions, good tradeoff of quality/speed |
| Fast     | Claude 3 Haiku | Simple lookups, quick factual answers             |

The user selects a model per session. The choice is stored in the session JSON and can be changed at any time.

## System Prompt

The system prompt adapts based on two dimensions the user sets when creating a session: subject expertise (how much domain knowledge to assume) and research expertise (how much to explain about methodology, statistics, and research design).

A user with low subject expertise and low research expertise gets a prompt that defines terms, explains methodology, and walks through why results matter. A user with high expertise on both axes gets a peer-level prompt that skips standard explanations and focuses on concise, direct reasoning.

The general persona is an assistant helping someone who is driving or walking to ingest and reason through a research paper. Responses are optimized for listening: short sentences, clear transitions, no bullet-point lists, no walls of text.

The system prompt is editable per session. The user can open it, read it, and modify it at any time during a conversation.

## Voice Interaction

Speech-to-text uses the browser-native Web Speech API. This works well on the target platforms (Android Chrome, Mac Chrome) and avoids adding AWS Transcribe as a dependency. The system listens continuously with silence detection — when the user stops talking for roughly two seconds, the recording ends and the question is sent. The user can also tap the mic button to force-stop recording as a fallback.

Text-to-speech uses the browser-native `speechSynthesis` API. The voice quality is not great, but Phase 1 is about reasoning quality, not audio polish. AWS Polly with neural voices is a planned upgrade for later.

The conversation loop is fully automatic. After the system finishes speaking a response, it waits 1-2 seconds and then starts listening again. The user speaks, the system processes, responds, and listens again. No tapping required between turns. The user can tap the mic button at any time to interrupt or cancel.

## User Interface

The PWA has two views.

The primary view is for hands-free use. It shows a large mic button and a visual status indicator — whether the system is listening, thinking, or speaking. Minimal text, maybe the first line of the current response. This is what you glance at while driving.

The secondary view is a standard multi-turn chat bubble interface. Your questions on one side, the system's responses on the other, scrollable history. This is for when you're on your laptop or stopped somewhere and want to read rather than listen.

The two views are swipeable or tab-toggled.

The session management screen shows a list of previous sessions (title, model, last updated) and a button to start a new one. Creating a new session presents a form with a text area (or PDF upload), model selector, expertise dropdowns, and an optional system prompt editor.

## Authentication and Security

The REST endpoints (session CRUD) are protected by API Gateway API keys. The key is sent in the `x-api-key` header with every request.

The streaming chat endpoint uses a per-session token. When a session is created through API Gateway, the Lambda generates a short-lived token (UUID with a 24-hour expiry) and stores it in the session JSON. The PWA includes this token in the `Authorization` header when calling the streaming endpoint. The Lambda validates the token on every request — if it's missing, expired, or doesn't match the session, the request gets a 401. This means an attacker who discovers the Function URL still can't use it without first authenticating through API Gateway to obtain a valid token.

Additional protections:

- **CloudFront Origin Access Control**: the Function URL only accepts requests originating from CloudFront, not directly from the internet
- **Lambda concurrency limit**: reserved concurrency of 2-3 prevents parallel abuse
- **Bedrock model invocation throttle**: max requests per minute configured in the Bedrock console
- **CloudWatch budget alarm**: triggers at $20 to catch runaway costs

## API Design

### REST (via API Gateway)

`POST /sessions` creates a new session. The body contains the paper text, optional title, model preference, expertise levels, and system prompt. The response includes the session ID and a streaming token.

`GET /sessions` returns a lightweight list of all sessions — just IDs, titles, models, and timestamps. No paper text or history.

`GET /sessions/{id}` returns the full session JSON.

`DELETE /sessions/{id}` deletes the session and returns 204.

### Streaming (via Lambda Function URL)

`POST /chat` is the only streaming endpoint. The body contains the session ID and the new question. The `Authorization` header carries the session token.

The Lambda reads the session from S3, constructs the full prompt (system prompt + paper text + conversation history + new question), calls Bedrock with streaming enabled, and pipes tokens back to the client as chunked HTTP. After the response completes, the Lambda appends the new turn to the conversation history and writes the updated session back to S3.

## Infrastructure as Code

Everything is defined in a SAM template:

- S3 bucket for PWA hosting
- S3 bucket for session storage
- CloudFront distribution with OAC for both the hosting bucket and the Function URL
- API Gateway REST API with API key and usage plan
- Lambda function (Rust, built with cargo lambda) with Function URL config
- IAM roles granting Lambda access to S3 and Bedrock
- CloudWatch budget alarm

Deployment is `sam build && sam deploy`.

## Tech Stack

| Layer      | Choice                                    |
|------------|-------------------------------------------|
| Frontend   | React + Vite + pdf.js                     |
| Backend    | Rust, cargo lambda, AWS SDK for Rust      |
| Infra      | SAM (template.yaml)                       |
| LLM        | Bedrock (Claude 4 Opus/Sonnet, Claude 3 Haiku) |
| Storage    | S3 (sessions + hosting)                   |
| CDN/Auth   | CloudFront + API Gateway API keys         |
| Region     | us-east-1 (prefer eu if models available) |

## Implementation Plan

### Milestone 1 — Talking to Bedrock

The goal is to prove the core loop works: send a paper and a question to Bedrock, get a streamed answer back. No UI, no auth, no sessions. Just a Rust Lambda that takes a hardcoded paper, appends a question, calls Bedrock with streaming, and returns the response.

Done when: you can invoke the Lambda (via CLI or curl) with a question about a paper and get a streamed, coherent answer.

What you build:
- SAM template with the Lambda and Function URL
- Rust Lambda that calls Bedrock's `InvokeModelWithResponseStream`
- IAM role with Bedrock permissions
- Deploy to us-east-1

### Milestone 2 — Session persistence

Add S3-backed sessions so the Lambda can remember papers and conversation history across requests.

Done when: you can create a session with a paper, ask multiple questions in sequence, and the Lambda maintains context across turns. Verifiable via curl or a simple test script.

What you build:
- S3 bucket for sessions (add to SAM template)
- Lambda endpoints: create session, load session, append turn, list sessions
- API Gateway REST API with API key auth for session CRUD
- Session token generation for the streaming endpoint

### Milestone 3 — Cognito auth

Replace the API key and custom session token with proper authentication. Cognito handles identity, JWT validation, and token expiry. This needs to happen before the frontend so the UI is built with auth from the start.

Done when: all endpoints require a valid Cognito JWT. You can log in via the Hosted UI, get a token, and use it to create sessions and chat. Unauthenticated requests are rejected.

What you build:
- Cognito User Pool + App Client (add to SAM template)
- Cognito authorizer on API Gateway (replaces API key)
- JWT validation in Lambda for Function URL requests
- Remove API key, usage plan, and custom session token
- Create your user account

### Milestone 4 — Minimal web UI

Get something on screen. A React PWA that lets you log in via Cognito, create sessions, and have text conversations with the paper. No voice yet — text in, text out. Responsive: sidebar + main panel on desktop, full-screen navigation on mobile.

Done when: you can open the app in a browser and on your phone, log in, paste a paper, and have a multi-turn text conversation.

Tech: React + Vite + TypeScript, Tailwind CSS, Shadcn/ui components.

Screens (see doc/mockup.html):
- Session list (home) — sidebar on desktop, full screen on mobile
- New session — paste text or upload PDF, model selector, expertise dropdowns
- Chat — bubble UI with text input
- Config — model, expertise, system prompt editor
- Stats — token counts, cost, dates, comprehension score

Build steps:

**Step 1 — Scaffold + routing**
- Vite + React + TypeScript project in `frontend/`
- Tailwind + Shadcn/ui setup
- React Router: `/`, `/sessions/new`, `/sessions/:id`
- Responsive shell: sidebar + main panel layout
- Hardcoded mock data, no API calls

**Step 2 — Auth**
- AWS Amplify Auth library (auth module only)
- Login: Cognito → Identity Pool → temp AWS credentials
- SigV4 signing utility for API calls
- Protected routes — redirect to login if unauthenticated
- Silent token refresh (Amplify handles this automatically)
- Logout button

**Step 3 — Session CRUD**
- API client with SigV4 signing
- Session list, create, detail, delete — wired to real API
- PDF upload with client-side text extraction (pdf.js)
- Loading states on all API calls (spinners, skeleton cards)
- Error handling: toast notifications on failure, inline errors on forms

**Step 4 — Chat**
- Chat view with bubbles
- Text input → POST /chat via API Gateway
- Stream token fetch from /sessions/:id/stream-token
- Multi-turn conversation with history
- "Thinking..." indicator while waiting for response

**Step 5 — Config + Stats**
- Config panel: model toggle, expertise, system prompt editor
- Backend: add PATCH /sessions/:id endpoint for updating config
- Stats panel: tokens, cost, dates
- Comprehension score deferred to Milestone 6 (needs prompt engineering + backend)

**Step 6 — Deploy**
- S3 bucket + CloudFront in SAM template
- Build + sync to S3
- Add CloudFront URL to Cognito callback URLs

**Step 7 — PWA**
- Service worker, web app manifest
- Add to home screen on Android

### Milestone 5 — Voice

Layer voice on top of the working text chat. Add speech-to-text input, text-to-speech output, and the auto-listen loop.

Done when: you can open the app on your phone, tap the mic, ask a question about a paper, and hear the answer spoken back. The system automatically listens for the next question after finishing.

What you build:
- Web Speech API integration (STT with silence detection)
- Browser speechSynthesis integration (TTS)
- Auto-listen loop with 1-2 second delay after response
- Primary view (big mic button + status indicator)
- Push-to-talk fallback

### Milestone 6 — Polish

Make it safe to leave running. Add remaining security layers, the expertise-adaptive system prompt, PDF upload, and the editable prompt UI.

Done when: the app is fully functional with all Phase 1 features and you're comfortable leaving it deployed.

What you build:
- CloudFront OAC on the Function URL
- Lambda concurrency limit
- Bedrock throttle configuration
- CloudWatch budget alarm
- PDF upload with client-side pdf.js extraction
- Expertise dropdowns (subject + research) with prompt template
- Editable system prompt per session
- Session delete functionality

## Future (Post Phase 1)

- AWS Polly for TTS, replacing browser-native speech synthesis
- Local Ollama inference via Cloudflare Tunnel when a personal machine is available
- RAG or retrieval pipeline if full-context reasoning hits limits
- Conversation memory or summarization if the context window fills up
- Multi-paper sessions with explicit source labeling
- Wake word activation
- Configurable system prompt template library
