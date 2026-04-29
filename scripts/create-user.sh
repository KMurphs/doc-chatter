#!/bin/bash
set -euo pipefail

# Create a Cognito user for testing.
# Usage: ./scripts/create-user.sh [email] [password]
# Requires: python3, boto3, valid AWS credentials (akmdev)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../lambda/.env"

if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

POOL_ID="${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID not set}"
USERNAME="${1:-${COGNITO_USERNAME:?Provide email as argument or set COGNITO_USERNAME}}"
PASSWORD="${2:-${COGNITO_PASSWORD:?Provide password as argument or set COGNITO_PASSWORD}}"
REGION="${AWS_REGION:-us-east-1}"

python3 -c "
import boto3
client = boto3.client('cognito-idp', region_name='${REGION}')
client.admin_create_user(
    UserPoolId='${POOL_ID}',
    Username='${USERNAME}',
    TemporaryPassword='TempPass123!',
    MessageAction='SUPPRESS'
)
client.admin_set_user_password(
    UserPoolId='${POOL_ID}',
    Username='${USERNAME}',
    Password='${PASSWORD}',
    Permanent=True
)
print('User created: ${USERNAME}')
"
