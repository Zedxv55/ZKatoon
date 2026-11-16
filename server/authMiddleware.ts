import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { SUPER_ADMIN_ALLOWLIST } from '../src/types/platform.ts';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: VerifiedFirebaseUser | null;
    }
  }
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> = {};
let certsExpireAt = 0;

function readFirebaseProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
    return raw.projectId || '';
  } catch {
    return '';
  }
}

export function isSuperAdminClaim(email: string | undefined | null, emailVerified: boolean): boolean {
  if (!emailVerified || !email) return false;
  const normalized = email.trim().toLowerCase();
  return (SUPER_ADMIN_ALLOWLIST as readonly string[]).includes(normalized);
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpireAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(GOOGLE_CERTS_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Firebase public certificates (HTTP ${resp.status})`);
  }
  const cc = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await resp.json()) as Record<string, string>;
  certsExpireAt = now + Math.max(60, maxAgeSec) * 1000;
  return cachedCerts;
}

function base64UrlDecode(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as {
    iss?: string;
    aud?: string;
    auth_time?: number;
    user_id?: string;
    sub?: string;
    iat?: number;
    exp?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid Firebase token algorithm or key ID');
  }

  const projectId = readFirebaseProjectId();
  if (!projectId) {
    throw new Error('Firebase projectId is not configured on server');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Firebase ID token has expired');
  }
  if (!payload.iat || payload.iat > nowSec + 300) {
    throw new Error('Firebase ID token issued-at timestamp is invalid');
  }
  if (payload.aud !== projectId) {
    throw new Error('Firebase ID token audience mismatch');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase ID token issuer mismatch');
  }
  const uid = payload.sub || payload.user_id || '';
  if (!uid || uid.length > 128) {
    throw new Error('Firebase ID token subject missing');
  }

  const certs = await getGooglePublicCerts();
  let pem = certs[header.kid];
  if (!pem) {
    // Force refresh once in case of key rotation
    certsExpireAt = 0;
    const fresh = await getGooglePublicCerts();
    pem = fresh[header.kid];
  }
  if (!pem) {
    throw new Error('Signing certificate not found for Firebase ID token');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = base64UrlDecode(sigB64);
  if (!verifier.verify(pem, signature)) {
    throw new Error('Invalid Firebase ID token signature');
  }

  const email = (payload.email || '').trim().toLowerCase();
  const emailVerified = payload.email_verified === true;

  return {
    uid,
    email,
    emailVerified,
    name: payload.name || (email ? email.split('@')[0] : `user_${uid.slice(0, 6)}`),
    picture: payload.picture || null,
    isSuperAdmin: isSuperAdminClaim(email, emailVerified),
  };
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const qToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  return qToken || null;
}

export async function attachAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    req.authUser = null;
    next();
    return;
  }
  try {
    req.authUser = await verifyFirebaseIdToken(token);
  } catch {
    req.authUser = null;
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้' });
    return;
  }
  try {
    req.authUser = await verifyFirebaseIdToken(token);
    next();
  } catch (err) {
    res.status(401).json({
      error: `เซสชันยืนยันตัวตนไม่ถูกต้องหรือหมดอายุ: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

export function requireVerifiedUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
    return;
  }
  if (!req.authUser.emailVerified) {
    res.status(403).json({
      error: 'กรุณายืนยันอีเมล (Verify Email) ให้เสร็จก่อนใช้งานสร้างวิดีโอหรือเติมเครดิต',
      code: 'EMAIL_NOT_VERIFIED',
    });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ' });
    return;
  }
  if (!req.authUser.emailVerified || !req.authUser.isSuperAdmin) {
    res.status(403).json({
      error: 'ไม่มีสิทธิ์เข้าถึงระบบ Super Admin (ต้องเป็นอีเมลใน Allowlist และผ่านการยืนยันอีเมลแล้ว)',
    });
    return;
  }
  next();
}
