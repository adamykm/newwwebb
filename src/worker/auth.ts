import { SignJWT, jwtVerify } from 'jose';
import type { SessionPayload } from '../shared/types';

const COOKIE = 'nexus_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(env: { SESSION_SECRET: string }) {
  return new TextEncoder().encode(env.SESSION_SECRET || 'dev-secret-change-me');
}

export async function createSessionToken(payload: SessionPayload, env: { SESSION_SECRET: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret(env));
}

export async function verifySessionToken(token: string, env: { SESSION_SECRET: string }): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env));
    return { userId: payload.userId as string, role: payload.role as 'user' | 'admin' };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  const flags = [`Max-Age=${MAX_AGE}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) flags.push('Secure');
  return `${COOKIE}=${token}; ${flags.join('; ')}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getSession(request: Request, env: { SESSION_SECRET: string }): Promise<SessionPayload | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  return verifySessionToken(token, env);
}
