#!/bin/bash
set -euo pipefail

# Get a Cognito JWT token for testing the deployed API.
# Usage: ./scripts/get-token.sh
# Requires: python3, boto3, valid AWS credentials (akmdev)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../lambda/.env"

if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_hQN3LkQVJ}"
CLIENT_ID="${COGNITO_CLIENT_ID:-1t8j9j23dhrfhteldgte5qk0b}"
USERNAME="${COGNITO_USERNAME:-test@docchatter.com}"
PASSWORD="${COGNITO_PASSWORD:-DocChatter2026!}"
REGION="${AWS_REGION:-us-east-1}"

TOKEN=$(python3 -c "
import boto3
client = boto3.client('cognito-idp', region_name='${REGION}')
resp = client.initiate_auth(
    ClientId='${CLIENT_ID}',
    AuthFlow='USER_PASSWORD_AUTH',
    AuthParameters={'USERNAME': '${USERNAME}', 'PASSWORD': '${PASSWORD}'}
)
print(resp['AuthenticationResult']['IdToken'])
")

echo "$TOKEN"
