import crypto from 'crypto';
import { cookies } from 'next/headers';
import { db, users } from '@framevid/db';
import { eq } from 'drizzle-orm';
import type { User } from '@framevid/types';

const JWT_SECRET = process.env.JWT_SECRET || 'framevid-ultra-secure-development-secret-key-32-chars';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'framevid_session';

// 1. Password Hashing using Node.js Native PBKDF2 (Zero-dependency bcrypt alternative)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// 2. Token Generator & Validator (Zero-dependency JWT replacement using HMAC-SHA256)
export function signSession(payload: any, expiresInMs: number = 1000 * 60 * 60 * 24 * 7): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + expiresInMs })).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${body}`);
  const signature = hmac.digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

export function verifySession(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (!header || !body || !signature) return null;

  // Validate signature
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${body}`);
  const expectedSignature = hmac.digest('base64url');
  
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// 3. Server Actions & API helper to retrieve current authenticated user
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;

  const payload = verifySession(sessionCookie.value);
  if (!payload || !payload.id) return null;

  try {
    const matchedUsers = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
    const userRecord = matchedUsers[0];
    if (!userRecord) return null;

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name || undefined,
      avatarUrl: userRecord.avatarUrl || undefined,
      createdAt: userRecord.createdAt,
    };
  } catch (error) {
    console.error('Database error in getCurrentUser:', error);
    return null;
  }
}

// 4. Set Session Cookie helper
export function setSessionCookie(payload: any) {
  const token = signSession(payload);
  const cookieStore = cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// 5. Clear Session Cookie helper
export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
