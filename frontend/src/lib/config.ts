// Cognito + Identity Pool config — values from SAM deploy output / .env
export const authConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_hQN3LkQVJ',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '1t8j9j23dhrfhteldgte5qk0b',
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID || 'us-east-1:98803e1e-c659-4ac8-baae-907aba0d9a21',
      loginWith: {
        email: true,
      },
    },
  },
};

export const apiConfig = {
  apiGatewayUrl: import.meta.env.VITE_API_GW_URL || 'https://7v0u1rllbe.execute-api.us-east-1.amazonaws.com/prod',
  functionUrl: import.meta.env.VITE_FUNCTION_URL || '',
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
};
