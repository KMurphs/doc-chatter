# doc-chatter

Voice-first research paper assistant. Ask questions about research papers using voice while driving or walking. The system reasons over the full paper text using Claude via AWS Bedrock and speaks the answer back.

Phase 1 is diagnostic — no retrieval pipeline, no chunking. Full papers go into the model context directly to understand where that approach works and where it breaks.

## Architecture

```
[Cognito User Pool] → [Identity Pool] → temp AWS credentials
        |
   ┌────┴────────────┐
   v                  v
[API Gateway]    [Lambda Function URL]
(sessions CRUD)  (streaming chat)
(IAM auth)       (IAM auth + stream token)
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
| Frontend | React + Vite + pdf.js (planned)                 |
| Backend  | Rust (cargo lambda) + AWS SDK for Rust           |
| Auth     | Cognito + Identity Pool + IAM (SigV4)           |
| Infra    | SAM                                             |
| LLM      | Bedrock (Claude 4 Opus/Sonnet, Claude 3 Haiku)  |
| Storage  | S3                                              |
| Region   | us-east-1                                       |

## Quick Start

```bash
# Prerequisites: Rust, cargo-lambda, SAM CLI, Docker
# See DEVELOPMENT.md for full setup

# Run tests
cd lambda && cargo test

# Local dev
cargo lambda watch                    # start local server
./scripts/test-api.sh local           # run test suite against localhost

# Deploy and test
akmdev                                # get AWS credentials
sam build && sam deploy                # deploy
./scripts/test-api.sh deployed        # run test suite against AWS
```

## Docs

- [Design](doc/detailed-design.md) — architecture, decisions, and milestone plan
- [Brief](doc/brief.md) — original problem statement and motivation
- [Development](DEVELOPMENT.md) — setup, build, test, deploy
