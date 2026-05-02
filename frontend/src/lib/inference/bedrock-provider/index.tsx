import { SessionDetail } from '../../sessions/types';
import { InferenceService } from '../types';
import { getCredentials } from '../../sessions/remote-provider/auth';

async function hmac(key: ArrayBuffer | Uint8Array, data: Uint8Array): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, data);
}

async function hex(buf: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sign(creds: { accessKeyId: string; secretAccessKey: string; sessionToken: string }, region: string, method: string, url: string, body: string, now: Date): Promise<Record<string, string>> {
  const u = new URL(url);
  const date = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dateShort = date.slice(0, 8);
  const scope = `${dateShort}/${region}/bedrock/aws4_request`;
  const enc = new TextEncoder();
  const bodyHash = await hex(await crypto.subtle.digest('SHA-256', enc.encode(body)));

  // SigV4 canonical URI: each path segment must be URI-encoded
  const canonicalUri = u.pathname.split('/').map(s => encodeURIComponent(s)).join('/');

  const canonical = [
    method, canonicalUri, '',
    `host:${u.host}`, `x-amz-date:${date}`, `x-amz-security-token:${creds.sessionToken}`,
    '', 'host;x-amz-date;x-amz-security-token', bodyHash,
  ].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', date, scope, await hex(await crypto.subtle.digest('SHA-256', enc.encode(canonical)))].join('\n');

  const kDate = await hmac(enc.encode('AWS4' + creds.secretAccessKey), enc.encode(dateShort));
  const kRegion = await hmac(kDate, enc.encode(region));
  const kService = await hmac(kRegion, enc.encode('bedrock'));
  const kSigning = await hmac(kService, enc.encode('aws4_request'));
  const signature = await hex(await hmac(kSigning, enc.encode(stringToSign)));

  return {
    'Content-Type': 'application/json',
    'Host': u.host,
    'X-Amz-Date': date,
    'X-Amz-Security-Token': creds.sessionToken,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=host;x-amz-date;x-amz-security-token, Signature=${signature}`,
  };
}

export function createService(region: string, modelId: string): InferenceService {
  return {
    async chat(session: SessionDetail, question: string): Promise<string> {
      const creds = await getCredentials();
      if (!creds) throw new Error('Not authenticated — Bedrock requires Cognito credentials');

      const messages = [
        ...session.history.map(t => ({ role: t.role, content: [{ text: t.content }] })),
        { role: 'user', content: [{ text: question }] },
      ];
      const systemPrompt = session.system_prompt || `You are a research paper assistant.\n\nPaper:\n${session.paper_text}`;
      const body = JSON.stringify({ messages, system: [{ text: systemPrompt }], inferenceConfig: { maxTokens: 4096 } });
      const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
      const headers = await sign(creds, region, 'POST', endpoint, body, new Date());

      const res = await fetch(endpoint, { method: 'POST', headers, body });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Bedrock error ${res.status}: ${text}`);
      }
      const data = await res.json();
      return data.output?.message?.content?.[0]?.text ?? 'No response';
    },
  };
}

export function Settings({ config, onChange }: {
  config: { bedrockRegion: string; bedrockModelId: string };
  onChange: (updates: Partial<{ bedrockRegion: string; bedrockModelId: string }>) => void;
}) {
  const labelCls = 'text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary';
  const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50';

  return (
    <>
      <div>
        <label className={labelCls}>Region</label>
        <input className={inputCls} value={config.bedrockRegion}
          onChange={e => onChange({ bedrockRegion: e.target.value })}
          placeholder="us-east-1" />
      </div>
      <div>
        <label className={labelCls}>Model ID</label>
        <input className={inputCls} value={config.bedrockModelId}
          onChange={e => onChange({ bedrockModelId: e.target.value })}
          placeholder="us.anthropic.claude-sonnet-4-5-20250929-v1:0" />
      </div>
      <p className="text-[10px] text-light-muted dark:text-dark-muted">Uses Cognito credentials — sign in via Remote session storage</p>
    </>
  );
}
