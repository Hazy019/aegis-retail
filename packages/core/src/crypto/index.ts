import * as crypto from 'crypto';
import type { AuditLogEntry } from '../types/index.js';

/**
 * Deterministic JSON stringifier to ensure identical cryptographic hashes
 * across platforms regardless of object key insertion order.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (key) => JSON.stringify(key) + ':' + canonicalizeJson((obj as Record<string, unknown>)[key])
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Generate an asymmetric key pair for device onboarding.
 */
export function generateDeviceKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

/**
 * Sign a payload with the device's private key.
 */
export function signWithDeviceKey(privateKeyPem: string, data: string): string {
  const signature = crypto.sign(null, Buffer.from(data, 'utf8'), privateKeyPem);
  return signature.toString('base64');
}

/**
 * Verify a device signature using its registered public key.
 */
export function verifyDeviceSignature(publicKeyPem: string, data: string, signatureBase64: string): boolean {
  try {
    return crypto.verify(
      null,
      Buffer.from(data, 'utf8'),
      publicKeyPem,
      Buffer.from(signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * SHA-256 hash chaining for immutable, tamper-evident audit logs.
 * Hash_n = SHA256(previous_hash + timestamp + store_id + actor_id + action + canonical_payload)
 */
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function computeAuditHash(
  previousHash: string,
  createdAt: string,
  storeId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  payloadCanonical: string
): string {
  const data = `${previousHash}|${createdAt}|${storeId}|${actorId}|${action}|${entityType}|${entityId}|${payloadCanonical}`;
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Validates the cryptographic integrity of an audit trail.
 */
export function verifyAuditChain(entries: AuditLogEntry[]): {
  valid: boolean;
  brokenAtIndex?: number;
  expectedHash?: string;
  actualHash?: string;
} {
  let prevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.previous_hash !== prevHash) {
      return {
        valid: false,
        brokenAtIndex: i,
        expectedHash: prevHash,
        actualHash: entry.previous_hash
      };
    }

    const calculated = computeAuditHash(
      entry.previous_hash,
      entry.created_at,
      entry.store_id,
      entry.actor_id,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      entry.payload_canonical
    );

    if (calculated !== entry.hash) {
      return {
        valid: false,
        brokenAtIndex: i,
        expectedHash: calculated,
        actualHash: entry.hash
      };
    }

    prevHash = entry.hash;
  }

  return { valid: true };
}

/**
 * Column-level PII encryption (AES-256-GCM) with key rotation support.
 */
export function encryptPII(plainText: string, masterSecret: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(masterSecret).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptPII(cipherText: string, masterSecret: string): string {
  const [ivHex, authTagHex, encryptedData] = cipherText.split(':');
  if (!ivHex || !authTagHex || !encryptedData) {
    throw new Error('Invalid cipher format');
  }
  const key = crypto.createHash('sha256').update(masterSecret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Mask PII for cashier display and safe client logging (e.g. "+63 912 **** 567").
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return '****';
  const start = phone.slice(0, 4);
  const end = phone.slice(-3);
  return `${start} **** ${end}`;
}
