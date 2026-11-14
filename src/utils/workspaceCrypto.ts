import type { WorkspaceSecrets } from '../types/cartoon';

const PBKDF2_ITERATIONS = 100_000;
const KEY_CHECK_TOKEN = 'ZKATOON_WORKSPACE_OK_V1';

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function generateSaltB64(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

export async function deriveAesKeyFromPassphrase(
  passphrase: string,
  saltB64: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const salt = base64ToBytes(saltB64);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptTextAesGcm(
  plainText: string,
  key: CryptoKey
): Promise<{ cipherB64: string; ivB64: string }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded
  );
  return {
    cipherB64: bytesToBase64(new Uint8Array(cipherBuf)),
    ivB64: bytesToBase64(iv),
  };
}

export async function decryptTextAesGcm(
  cipherB64: string,
  ivB64: string,
  key: CryptoKey
): Promise<string> {
  const cipherBytes = base64ToBytes(cipherB64);
  const iv = base64ToBytes(ivB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipherBytes as BufferSource
  );
  return new TextDecoder().decode(plainBuf);
}

export async function createPassphraseVerifier(
  passphrase: string
): Promise<{ saltB64: string; keyCheckCipherB64: string; keyCheckIvB64: string; key: CryptoKey }> {
  const saltB64 = generateSaltB64();
  const key = await deriveAesKeyFromPassphrase(passphrase, saltB64);
  const check = await encryptTextAesGcm(KEY_CHECK_TOKEN, key);
  return {
    saltB64,
    keyCheckCipherB64: check.cipherB64,
    keyCheckIvB64: check.ivB64,
    key,
  };
}

export async function verifyAndUnlockPassphrase(
  passphrase: string,
  saltB64: string,
  keyCheckCipherB64: string,
  keyCheckIvB64: string
): Promise<CryptoKey | null> {
  try {
    const key = await deriveAesKeyFromPassphrase(passphrase, saltB64);
    const decoded = await decryptTextAesGcm(keyCheckCipherB64, keyCheckIvB64, key);
    return decoded === KEY_CHECK_TOKEN ? key : null;
  } catch {
    return null;
  }
}

export async function encryptWorkspaceSecrets(
  secrets: WorkspaceSecrets,
  key: CryptoKey
): Promise<{ cipherB64: string; ivB64: string }> {
  return encryptTextAesGcm(JSON.stringify(secrets), key);
}

export async function decryptWorkspaceSecrets(
  cipherB64: string,
  ivB64: string,
  key: CryptoKey
): Promise<WorkspaceSecrets> {
  const raw = await decryptTextAesGcm(cipherB64, ivB64, key);
  return JSON.parse(raw) as WorkspaceSecrets;
}
