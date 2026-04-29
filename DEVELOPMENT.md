# Development Guide

## Prerequisites

**Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

**cargo-lambda** (local Lambda testing):
```bash
brew tap cargo-lambda/cargo-lambda
brew install cargo-lambda
```

**SAM CLI** (build, deploy, logs):
```bash
brew install aws-sam-cli
```

**Docker** — required for `sam local invoke`.

**AWS credentials:**
```bash
alias akmdev='ada credentials update --account=311371030234 --provider=isengard --role=Admin --once'
akmdev   # run before any AWS operation, refresh when expired
```

Without `--once`, ada blocks the terminal and waits for the next refresh cycle. The `--once` flag refreshes credentials and exits immediately.

## Project Structure

```
.
├── template.yaml              ← SAM template (Lambda, API Gateway, Cognito, S3)
├── samconfig.toml             ← SAM deploy settings (generated, gitignored)
├── scripts/
│   ├── get-token.sh           ← get a Cognito JWT for CLI testing
│   └── create-user.sh         ← create a Cognito user
├── events/                    ← test events for sam local invoke
├── lambda/
│   ├── .env                   ← local env vars (not deployed, gitignored)
│   ├── .env.template          ← template for .env
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs            ← Lambda entry point + HTTP routing
│       ├── config.rs          ← defaults (model, expertise, system prompt)
│       ├── service.rs         ← business logic (create/list/get/delete sessions, chat)
│       ├── tests.rs           ← integration tests with aws-smithy-mocks
│       ├── dao/
│       │   ├── mod.rs
│       │   └── session.rs     ← S3 session persistence
│       ├── inference/
│       │   ├── mod.rs
│       │   └── bedrock.rs     ← Bedrock Converse API
│       └── utils/
│           ├── mod.rs
│           └── http.rs        ← HTTP response helpers
└── doc/
    ├── brief.md               ← original problem statement
    └── detailed-design.md     ← architecture and design decisions
```

## Building

```bash
cd lambda
cargo check       # type-check only (fast)
cargo build       # debug build
cargo clippy      # lint
cargo fmt         # format
cargo test        # run integration tests (no AWS credentials needed)
```

## Testing

### Unit/integration tests

Tests use `aws-smithy-mocks` to mock S3 and Bedrock at the SDK level. No AWS credentials needed.

```bash
cd lambda
cargo test                    # run all tests
cargo test given_valid        # run tests matching a pattern
cargo llvm-cov --summary-only # coverage report (requires cargo-llvm-cov)
```

### Local testing with cargo-lambda

Runs a local HTTP server emulating the Lambda runtime. Auto-recompiles on file changes. Still calls real AWS services (S3, Bedrock) — needs valid credentials.

```bash
cd lambda
cargo lambda watch
```

In another terminal:
```bash
# Create a session
curl -s -X POST http://localhost:9000/sessions \
  -H "Content-Type: application/json" \
  -d '{"paper_text":"This study examines dropout...","title":"Test"}'

SESSION_ID=<SESSION_ID>

# Chat (use session_id from create response)
curl -s -X POST http://localhost:9000/chat \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"question\":\"What did they find?\"}"
```

Local testing bypasses Cognito auth. The deployed API requires a JWT.

### Local testing with SAM

Runs the Lambda in a Docker container matching the real Lambda runtime.

```bash
sam build
sam local invoke DocChatterFunction -e events/create-session.json
```

## SAM Commands

```bash
sam validate                                                   # check template for errors
sam build                                                      # build Lambda artifact
sam local invoke DocChatterFunction -e events/create-session.json  # invoke locally
sam sync --stack-name doc-chatter --watch                      # hot-reload to deployed stack
sam deploy --guided --resolve-s3                               # full deploy with prompts (first time)
sam deploy --no-confirm-changeset                              # deploy using saved config
sam logs --stack-name doc-chatter --region us-east-1           # recent logs
sam logs --stack-name doc-chatter --region us-east-1 --tail    # stream in real time
```

## Deploying

**First time:**
```bash
sam build
sam deploy --guided --resolve-s3
```

Use `doc-chatter` as the stack name, `us-east-1` as the region.

**Subsequent deploys:**
```bash
sam build && sam deploy --no-confirm-changeset
```

### After deploying

The deploy output shows:

- **ApiUrl** — API Gateway URL (all endpoints)
- **UserPoolId** — Cognito User Pool ID
- **UserPoolClientId** — Cognito App Client ID
- **CognitoDomain** — Cognito Hosted UI URL

Copy `lambda/.env.template` to `lambda/.env` and fill in the values from the deploy output. Both scripts (`get-token.sh`, `create-user.sh`) source this file automatically.

### Setting up a user

```bash
./scripts/create-user.sh                          # uses COGNITO_USERNAME/PASSWORD from .env
./scripts/create-user.sh other@email.com Pass123!  # or pass as arguments
```

### Getting a JWT token

```bash
TOKEN=$(./scripts/get-token.sh)
```

Sources `lambda/.env` for all Cognito config. Override with env vars if needed:
```bash
COGNITO_USERNAME=other@email.com TOKEN=$(./scripts/get-token.sh)
```

### Testing the deployed API

All endpoints require a valid Cognito JWT in the `Authorization` header.

```bash
TOKEN=$(./scripts/get-token.sh)
source lambda/.env

# Sample paper for testing
PAPER="This study examines the effect of dropout regularization on neural network training. We found that a dropout rate of 0.5 applied to fully connected layers reduced overfitting by 15% on CIFAR-10. The benefit diminished in deeper networks, suggesting overlap with batch normalization."

# Create a session
curl -s -X POST $API_GW_URL/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"paper_text\":\"$PAPER\",\"title\":\"Dropout Study\"}" | jq .

# List sessions
curl -s $API_GW_URL/sessions -H "Authorization: Bearer $TOKEN" | jq .

# Get a session
curl -s $API_GW_URL/sessions/$SESSION_ID -H "Authorization: Bearer $TOKEN" | jq .

# Delete a session
curl -s -X DELETE $API_GW_URL/sessions/$SESSION_ID -H "Authorization: Bearer $TOKEN"

# Chat (use session_id from create response)
curl -s -X POST $API_GW_URL/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"session_id\":\"$SESSION_ID\",\"question\":\"What did they find about dropout?\"}" | jq .

# Without auth (should return 401)
curl -s $API_GW_URL/sessions
```

## Reference

The Rust Lambda patterns are based on `KumoTrojanGenAIOrchestrationRust` at `/Volumes/workplace/ai-orchestration/src/KumoTrojanGenAIOrchestrationRust`. Key patterns borrowed:

- Lambda binary named `bootstrap` (AWS custom runtime convention)
- Release profile: `opt-level = "z"`, `lto = true`, `codegen-units = 1`, `strip = true`
- `aws-config` for automatic credential resolution (picks up `ada` credentials)
- `tokio` async runtime, `serde`/`serde_json` for serialization, `tracing` for logging
