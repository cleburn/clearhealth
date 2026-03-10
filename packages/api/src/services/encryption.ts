/**
 * ClearHealth API — Patient Data Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive patient data (SSN, etc.).
 * Encryption key is loaded from the ENCRYPTION_KEY environment variable.
 *
 * @security
 * - Uses AES-256-GCM (authenticated encryption)
 * - Each encryption generates a unique IV (initialization vector)
 * - Encrypted values include IV + auth tag for decryption
 * - Key rotation handled by infrastructure/scripts/rotate-keys.sh
 * - Encryption key loaded from ENCRYPTION_KEY env var
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Returns the encryption key from environment, validated for correct length.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not configured');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return key;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (base64 encoded)
 * @throws If ENCRYPTION_KEY is not configured
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const ivB64 = iv.toString('base64');
  const authTagB64 = authTag.toString('base64');
  const ciphertextB64 = encrypted.toString('base64');

  return `${ivB64}:${authTagB64}:${ciphertextB64}`;
}

/**
 * Decrypts ciphertext encrypted with AES-256-GCM.
 *
 * @param ciphertext - The encrypted string (iv:authTag:ciphertext format)
 * @returns Decrypted plaintext
 * @throws If decryption fails (wrong key, tampered data, invalid format)
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Creates a one-way hash of an SSN for lookup purposes.
 * Allows searching for a patient by SSN without decrypting all records.
 *
 * @param ssn - The SSN to hash (format: XXX-XX-XXXX)
 * @returns SHA-256 hash of the normalized SSN
 */
export function hashSSN(ssn: string): string {
  const key = getEncryptionKey();
  const normalized = ssn.replace(/-/g, '');
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(normalized);
  return hmac.digest('hex');
}
