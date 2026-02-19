const encoder = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(process.env.DASHBOARD_AUTH_TOKEN!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signCookie(tenantId: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(tenantId));
  return `${tenantId}.${toHex(sig)}`;
}

export async function verifyCookie(value: string): Promise<string | null> {
  const dot = value.lastIndexOf('.');
  if (dot === -1) return null;
  const tenantId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const key = await getKey();
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(tenantId));
  if (sig !== toHex(expected)) return null;
  return tenantId;
}
