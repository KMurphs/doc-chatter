#!/bin/bash
set -euo pipefail

# Test suite for doc-chatter API.
# Usage:
#   ./scripts/test-api.sh local      # against cargo lambda watch (localhost:9000)
#   ./scripts/test-api.sh deployed   # against deployed stack (IAM auth + SigV4)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../lambda/.env"

if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

MODE="${1:?Usage: $0 local|deployed}"
LOCAL_URL="${BASE_URL:-http://localhost:9000}"
PASS=0
FAIL=0
PAPER="Dropout at 0.5 reduced overfitting by 15% on CIFAR-10."

check() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then
        echo "  ✅ $label"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $label (expected $expected, got $actual)"
        FAIL=$((FAIL + 1))
    fi
}

check_contains() {
    local label="$1" expected="$2" body="$3"
    if echo "$body" | grep -q "$expected"; then
        echo "  ✅ $label"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $label (expected '$expected' in body)"
        FAIL=$((FAIL + 1))
    fi
}

# --- Local mode: plain curl ---

local_req() {
    local method="$1" path="$2" body="${3:-}"
    shift 3 || shift $#
    local args=(-s -w "\n%{http_code}" -X "$method" "$LOCAL_URL$path")
    args+=(-H "Content-Type: application/json")
    for h in "$@"; do
        [[ -n "$h" ]] && args+=(-H "$h")
    done
    [[ -n "$body" ]] && args+=(-d "$body")
    curl "${args[@]}"
}

# --- Deployed mode: SigV4 via Python ---

init_deployed() {
    API_GW_URL="${API_GW_URL:?API_GW_URL not set}"
    FUNC_URL="${FUNCTION_URL:?FUNCTION_URL not set}"
    IDENTITY_POOL_ID="${IDENTITY_POOL_ID:?IDENTITY_POOL_ID not set}"
    COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID not set}"

    echo "Getting JWT and AWS credentials..."
    JWT=$("$SCRIPT_DIR/get-token.sh")

    # Get temp AWS credentials and export for Python
    CREDS_JSON=$(python3 -c "
import boto3, json
ci = boto3.client('cognito-identity', region_name='us-east-1')
provider = 'cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}'
identity = ci.get_id(IdentityPoolId='${IDENTITY_POOL_ID}', Logins={provider: '${JWT}'})
creds = ci.get_credentials_for_identity(IdentityId=identity['IdentityId'], Logins={provider: '${JWT}'})
c = creds['Credentials']
print(json.dumps({'ak': c['AccessKeyId'], 'sk': c['SecretKey'], 'st': c['SessionToken']}))
")
    export CREDS_JSON
}

deployed_req() {
    local method="$1" path="$2" body="${3:-}" service="${4:-execute-api}"
    shift 4 || shift $#
    local extra_headers=""
    for h in "$@"; do
        [[ -n "$h" ]] && extra_headers="$extra_headers'$(echo "$h" | cut -d: -f1)': '$(echo "$h" | cut -d: -f2- | sed 's/^ //')', "
    done

    local base_url
    if [[ "$service" == "lambda" ]]; then
        base_url="$FUNC_URL"
    else
        base_url="$API_GW_URL"
    fi

    python3 -c "
import json, urllib.request, os
from botocore.auth import SigV4Auth
from botocore.credentials import Credentials
from botocore.awsrequest import AWSRequest

creds = json.loads(os.environ['CREDS_JSON'])
credentials = Credentials(creds['ak'], creds['sk'], creds['st'])

url = '${base_url}${path}'
body = '''${body}''' if '''${body}''' else None
headers = {'Content-Type': 'application/json', ${extra_headers}}
aws_req = AWSRequest(method='${method}', url=url, data=body, headers=headers)
SigV4Auth(credentials, '${service}', 'us-east-1').add_auth(aws_req)
req = urllib.request.Request(url, data=body.encode() if body else None,
                              headers=dict(aws_req.headers), method='${method}')
try:
    resp = urllib.request.urlopen(req)
    print(resp.read().decode())
    print(resp.status)
except urllib.error.HTTPError as e:
    print(e.read().decode())
    print(e.code)
"
}

unsigned_req() {
    local method="$1" path="$2" body="${3:-}" service="${4:-execute-api}"
    local base_url
    if [[ "$service" == "lambda" ]]; then
        base_url="$FUNC_URL"
    else
        base_url="$API_GW_URL"
    fi
    local args=(-s -w "\n%{http_code}" -X "$method" "$base_url$path" -H "Content-Type: application/json")
    [[ -n "$body" ]] && args+=(-d "$body")
    curl "${args[@]}"
}

# --- Unified request function ---

api_req() {
    if [[ "$MODE" == "local" ]]; then
        local_req "$@"
    else
        deployed_req "$@"
    fi
}

# --- Init ---

if [[ "$MODE" == "deployed" ]]; then
    init_deployed
elif [[ "$MODE" != "local" ]]; then
    echo "Usage: $0 local|deployed"
    exit 1
fi

# === Session CRUD ===
echo ""
echo "=== Session CRUD ==="

echo "POST /sessions"
RESP=$(api_req POST /sessions "{\"paper_text\":\"$PAPER\",\"title\":\"Test $MODE\"}")
BODY=$(echo "$RESP" | head -1)
STATUS=$(echo "$RESP" | tail -1)
check "create session returns 201" "201" "$STATUS"
SID=$(echo "$BODY" | jq -r '.session_id // empty')
check_contains "response has session_id" "session_id" "$BODY"

echo "GET /sessions"
RESP=$(api_req GET /sessions)
STATUS=$(echo "$RESP" | tail -1)
check "list sessions returns 200" "200" "$STATUS"

echo "GET /sessions/$SID"
RESP=$(api_req GET "/sessions/$SID")
BODY=$(echo "$RESP" | head -1)
STATUS=$(echo "$RESP" | tail -1)
check "get session returns 200" "200" "$STATUS"
check_contains "session has paper_text" "paper_text" "$BODY"

if [[ "$MODE" == "deployed" ]]; then
    echo "POST /sessions (no auth)"
    RESP=$(unsigned_req POST /sessions '{"paper_text":"test"}')
    STATUS=$(echo "$RESP" | tail -1)
    check "no auth returns 403" "403" "$STATUS"
fi

# === Stream Token ===
echo ""
echo "=== Stream Token ==="

echo "POST /sessions/$SID/stream-token"
RESP=$(api_req POST "/sessions/$SID/stream-token")
BODY=$(echo "$RESP" | head -1)
STATUS=$(echo "$RESP" | tail -1)
check "get stream token returns 200" "200" "$STATUS"
STREAM_TOKEN=$(echo "$BODY" | jq -r '.token // empty')
check_contains "response has token" "token" "$BODY"
check_contains "response has expires_at" "expires_at" "$BODY"

# === Chat ===
echo ""
echo "=== Chat ==="

if [[ "$MODE" == "local" ]]; then
    echo "POST /chat (with stream token)"
    RESP=$(local_req POST /chat "{\"session_id\":\"$SID\",\"question\":\"What was the dropout rate?\"}" "x-stream-token: $STREAM_TOKEN")
    BODY=$(echo "$RESP" | head -1)
    STATUS=$(echo "$RESP" | tail -1)
    check "chat with stream token returns 200" "200" "$STATUS"
    check_contains "response has answer" "answer" "$BODY"

    echo "POST /chat (no stream token)"
    RESP=$(local_req POST /chat "{\"session_id\":\"$SID\",\"question\":\"test\"}")
    STATUS=$(echo "$RESP" | tail -1)
    check "no stream token returns 401" "401" "$STATUS"

    echo "POST /chat (wrong session_id)"
    RESP=$(local_req POST /chat "{\"session_id\":\"wrong\",\"question\":\"test\"}" "x-stream-token: $STREAM_TOKEN")
    STATUS=$(echo "$RESP" | tail -1)
    check "wrong session_id returns 401" "401" "$STATUS"

    echo "POST /chat (invalid stream token)"
    RESP=$(local_req POST /chat "{\"session_id\":\"$SID\",\"question\":\"test\"}" "x-stream-token: garbage")
    STATUS=$(echo "$RESP" | tail -1)
    check "invalid stream token returns 401" "401" "$STATUS"
else
    echo "POST /chat via Function URL (SigV4 + stream token)"
    RESP=$(deployed_req POST /chat "{\"session_id\":\"$SID\",\"question\":\"What was the dropout rate?\"}" lambda "x-stream-token: $STREAM_TOKEN")
    BODY=$(echo "$RESP" | head -1)
    STATUS=$(echo "$RESP" | tail -1)
    check "chat with stream token returns 200" "200" "$STATUS"
    check_contains "response has answer" "answer" "$BODY"

    echo "POST /chat via Function URL (SigV4, no stream token)"
    RESP=$(deployed_req POST /chat "{\"session_id\":\"$SID\",\"question\":\"test\"}" lambda)
    STATUS=$(echo "$RESP" | tail -1)
    check "no stream token returns 401" "401" "$STATUS"

    echo "POST /chat via Function URL (unsigned)"
    RESP=$(unsigned_req POST /chat "{\"session_id\":\"$SID\",\"question\":\"test\"}" lambda)
    STATUS=$(echo "$RESP" | tail -1)
    check "unsigned request returns 403" "403" "$STATUS"

    echo "POST /chat via Function URL (SigV4 + stream token, wrong session_id)"
    RESP=$(deployed_req POST /chat "{\"session_id\":\"wrong\",\"question\":\"test\"}" lambda "x-stream-token: $STREAM_TOKEN")
    STATUS=$(echo "$RESP" | tail -1)
    check "wrong session_id returns 401" "401" "$STATUS"
fi

# === Verify history ===
echo ""
echo "=== Verify history ==="

echo "GET /sessions/$SID (check history)"
RESP=$(api_req GET "/sessions/$SID")
BODY=$(echo "$RESP" | head -1)
check_contains "history has user turn" "What was the dropout rate" "$BODY"

# === Cleanup ===
echo ""
echo "=== Cleanup ==="

echo "DELETE /sessions/$SID"
RESP=$(api_req DELETE "/sessions/$SID")
STATUS=$(echo "$RESP" | tail -1)
check "delete session returns 204" "204" "$STATUS"

echo "GET /sessions/$SID (after delete)"
RESP=$(api_req GET "/sessions/$SID")
STATUS=$(echo "$RESP" | tail -1)
check "get deleted session returns 404" "404" "$STATUS"

# === Invalid requests ===
echo ""
echo "=== Invalid requests ==="

echo "POST /sessions (invalid json)"
RESP=$(api_req POST /sessions "not json")
STATUS=$(echo "$RESP" | tail -1)
check "invalid json returns 400" "400" "$STATUS"

echo "GET /unknown"
RESP=$(api_req GET /unknown)
STATUS=$(echo "$RESP" | tail -1)
check "unknown route returns 404" "404" "$STATUS"

# === Summary ===
echo ""
echo "========================================"
echo "[$MODE] Results: $PASS passed, $FAIL failed"
echo "========================================"

[[ $FAIL -eq 0 ]] || exit 1
