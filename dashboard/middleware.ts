import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie } from './src/app/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get('dash_auth')?.value;
  if (!cookie) return NextResponse.redirect(new URL('/login', req.url));

  const tenantId = await verifyCookie(cookie);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenantId || !UUID_RE.test(tenantId)) return NextResponse.redirect(new URL('/login', req.url));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-id', tenantId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
