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
│   ├── test-api.sh            ← API test suite (local + deployed modes)
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

### Unit tests

Tests use `aws-smithy-mocks` to mock S3 and Bedrock at the SDK level. No AWS credentials needed.

```bash
cd lambda
cargo test                    # run all tests
cargo test given_valid        # run tests matching a pattern
cargo llvm-cov --summary-only # coverage report (requires cargo-llvm-cov)
```

### API test suite

One script, two modes. Tests session CRUD, stream tokens, chat, auth, and error handling.

```bash
# Against cargo lambda watch (localhost:9000) — no IAM auth
./scripts/test-api.sh local

# Against deployed stack — full IAM auth with SigV4
./scripts/test-api.sh deployed
```

Local mode requires `cargo lambda watch` running in another terminal. Deployed mode requires valid AWS credentials (`akmdev`) and a deployed stack.

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

SESSION_ID=<session_id from response>

# Get a stream token (required for /chat)
STREAM_TOKEN=$(curl -s -X POST http://localhost:9000/sessions/$SESSION_ID/stream-token | jq -r '.token')

# Chat
curl -s -X POST http://localhost:9000/chat \
  -H "Content-Type: application/json" \
  -H "x-stream-token: $STREAM_TOKEN" \
  -d "{\"session_id\":\"$SESSION_ID\",\"question\":\"What did they find?\"}"
```

Local testing bypasses IAM auth (no SigV4 needed). The stream token is still required for `/chat`. The deployed API requires both IAM auth and stream token.

### Local testing with SAM

Two options:

**Single invocation** — test the packaged binary in a Docker container (catches build/packaging issues):

```bash
sam build
sam local invoke DocChatterFunction -e events/create-session.json
```

**Local API server** — runs API Gateway + Lambda locally, supports the full test suite:

```bash
sam build
sam local start-api --port 3001
./scripts/test-api.sh local  # in another terminal, with BASE_URL=http://localhost:3001
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

### Testing the browser login flow

Note: the API uses IAM auth (SigV4), not JWT headers directly. The JWT from this flow would be exchanged for temporary AWS credentials via the Cognito Identity Pool. This section is useful for understanding the Cognito login flow.

You can test Cognito's Hosted UI login without any frontend code. Open this URL in a browser:

```
https://doc-chatter-<ACCOUNT_ID>.auth.<REGION>.amazoncognito.com/login?client_id=<CLIENT_ID>&response_type=token&scope=openid+email&redirect_uri=http://localhost:5173/callback
```

Breaking down the URL:

| Part | Value | What it does |
|---|---|---|
| `https://doc-chatter-<ACCOUNT_ID>.auth.<REGION>.amazoncognito.com` | Cognito domain | The Hosted UI login page. Created by `UserPoolDomain` in the SAM template. |
| `/login` | | Cognito's login endpoint. Shows email + password form. |
| `client_id=<CLIENT_ID>` | From deploy output | Identifies which App Client is requesting auth. Cognito checks this exists in the User Pool. |
| `response_type=token` | | Tells Cognito to use the **implicit flow** — return tokens directly in the URL. The alternative is `code` (authorization code flow) which requires a backend exchange. |
| `scope=openid+email` | | What claims to include in the token. `openid` gives the standard identity (sub), `email` adds the user's email. Must match `AllowedOAuthScopes` in the template. |
| `redirect_uri=http://localhost:5173/callback` | | Where Cognito sends the user after login. Must **exactly match** one of the `CallbackURLs` in the template — Cognito rejects mismatches. |

After you log in, Cognito redirects to:

```
http://localhost:5173/callback#id_token=eyJ...&access_token=eyJ...&expires_in=3600&token_type=Bearer
```

Nothing is running on localhost:5173, so the page won't load — but the URL bar contains the tokens:

- **`id_token`** — proves who the user is. Contains identity claims (email, sub). This is what API Gateway validates — it checks "is this a real user from my User Pool?" This is the token we use.
- **`access_token`** — proves what the user can do. Contains scopes and groups. Used for permission checks (e.g., admin vs reader). We don't use this since there are no roles.
- **`expires_in`** — token lifetime in seconds (3600 = 1 hour).

Both tokens are JWTs (JSON Web Tokens) — not opaque. You can decode and inspect them:

```bash
# Decode the payload of any JWT
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

Or paste into [jwt.io](https://jwt.io). A JWT has three base64-encoded parts separated by dots: `header.payload.signature`. The header says which algorithm was used, the payload contains the claims (email, expiry, issuer), and the signature proves it wasn't tampered with.

Copy the `id_token` value from the URL and use it:

```bash
TOKEN="eyJ..."
source lambda/.env
curl -s $API_GW_URL/sessions -H "Authorization: Bearer $TOKEN" | jq .
```

This proves the full browser → Cognito → redirect → token flow works before building any frontend.

### Testing the deployed API

All endpoints require IAM auth (SigV4 signed requests). Use the test suite:

```bash
./scripts/test-api.sh deployed
```

Or test manually — see `scripts/test-api.sh` for the full flow. The deployed API uses SigV4 signing via Cognito Identity Pool credentials, not JWT headers.

## Reference

The Rust Lambda patterns are based on `KumoTrojanGenAIOrchestrationRust` at `/Volumes/workplace/ai-orchestration/src/KumoTrojanGenAIOrchestrationRust`. Key patterns borrowed:

- Lambda binary named `bootstrap` (AWS custom runtime convention)
- Release profile: `opt-level = "z"`, `lto = true`, `codegen-units = 1`, `strip = true`
- `aws-config` for automatic credential resolution (picks up `ada` credentials)
- `tokio` async runtime, `serde`/`serde_json` for serialization, `tracing` for logging
