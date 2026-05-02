import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { apiConfig } from './config';

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export async function signedFetch(
  path: string,
  options: {
    method?: string;
    body?: string;
    service?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
  },
  credentials: Credentials,
): Promise<Response> {
  const method = options.method || 'GET';
  const service = options.service || 'execute-api';
  const baseUrl = options.baseUrl || apiConfig.apiGatewayUrl;
  const url = new URL(`${baseUrl.replace(/\/$/, '')}${path}`);

  // Build the request for signing — must include host for SigV4
  const request = new HttpRequest({
    method,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: {
      host: url.hostname,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body || undefined,
  });

  const signer = new SignatureV4({
    credentials,
    region: apiConfig.region,
    service,
    sha256: Sha256,
  });

  const signed = await signer.sign(request);

  // Remove 'host' from headers before fetch — the browser sets it automatically
  // and will reject it if we try to set it manually
  const fetchHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(signed.headers)) {
    if (key.toLowerCase() !== 'host') {
      fetchHeaders[key] = value as string;
    }
  }

  return fetch(url.toString(), {
    method,
    headers: fetchHeaders,
    body: options.body || undefined,
  });
}
