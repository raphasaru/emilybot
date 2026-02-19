import { createHmac } from 'crypto';

const SECRET = () => process.env.DASHBOARD_AUTH_TOKEN!;

export function signCookie(tenantId: string): string {
  const sig = createHmac('sha256', SECRET()).update(tenantId).digest('hex');
  return `${tenantId}.${sig}`;
}

export function verifyCookie(value: string): string | null {
  const dot = value.lastIndexOf('.');
  if (dot === -1) return null;
  const tenantId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', SECRET()).update(tenantId).digest('hex');
  if (sig !== expected) return null;
  return tenantId;
}
