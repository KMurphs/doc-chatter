# doc-chatter

Voice-first research paper assistant. Ask questions about research papers using voice while driving or walking. The system reasons over the full paper text using Claude via AWS Bedrock and speaks the answer back.

Phase 1 is diagnostic — no retrieval pipeline, no chunking. Full papers go into the model context directly to understand where that approach works and where it breaks.

## Architecture

```
[PWA - React/Vite]  ←  S3 + CloudFront
        |
   ┌────┴────────────┐
   v                  v
[API Gateway]    [Lambda Function URL]
(sessions CRUD)  (streaming chat)
   └────┬────────────┘
        v
   [Rust Lambda]
   |         |
[Bedrock]  [S3 bucket]
            (sessions)
```

## Tech Stack

| Layer    | Choice                                         |
|----------|-------------------------------------------------|
| Frontend | React + Vite + pdf.js                           |
| Backend  | Rust (cargo lambda) + AWS SDK for Rust           |
| Infra    | SAM                                             |
| LLM      | Bedrock (Claude 4 Opus/Sonnet, Claude 3 Haiku)  |
| Storage  | S3                                              |
| Region   | us-east-1                                       |

## Docs

- [Design](doc/detailed-design.md) — full architecture, decisions, and milestone plan
- [Brief](doc/brief.md) — original problem statement and motivation
- [Development](DEVELOPMENT.md) — setup, build, test, deploy
