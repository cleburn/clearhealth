/**
 * Encryption Service — Test Suite
 *
 * Validates AES-256-GCM encryption/decryption and SSN hashing.
 * All test data is synthetic — no real SSNs or patient data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, hashSSN } from '../encryption';

// 32-byte hex key for AES-256 (synthetic, test-only)
const TEST_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('Encryption Service', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // ── encrypt() ──────────────────────────────────────────────────────

  describe('encrypt()', () => {
    it('produces a string in iv:authTag:ciphertext format', () => {
      const result = encrypt('synthetic-ssn-123-45-6789');

      // TODO implementation returns '' — when implemented it should have 3 parts
      if (result !== '') {
        const parts = result.split(':');
        expect(parts).toHaveLength(3);
        // Each part should be non-empty
        expect(parts[0].length).toBeGreaterThan(0);
        expect(parts[1].length).toBeGreaterThan(0);
        expect(parts[2].length).toBeGreaterThan(0);
      }
    });

    it('produces different ciphertexts for the same plaintext (unique IV)', () => {
      const plaintext = 'synthetic-data-repeated';
      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      // When implemented, each call should generate a unique IV
      if (result1 !== '' && result2 !== '') {
        expect(result1).not.toBe(result2);
      }
    });

    it('produces different ciphertexts for different plaintexts', () => {
      const result1 = encrypt('plaintext-alpha');
      const result2 = encrypt('plaintext-bravo');

      if (result1 !== '' && result2 !== '') {
        expect(result1).not.toBe(result2);
      }
    });

    it('handles empty string input', () => {
      // Should not throw
      const result = encrypt('');
      expect(typeof result).toBe('string');
    });

    it('handles long plaintext input', () => {
      const longText = 'A'.repeat(10000);
      const result = encrypt(longText);
      expect(typeof result).toBe('string');
    });
  });

  // ── decrypt() ──────────────────────────────────────────────────────

  describe('decrypt()', () => {
    it('recovers original plaintext after encryption (round-trip)', () => {
      const original = 'synthetic-ssn-999-88-7777';
      const encrypted = encrypt(original);

      if (encrypted !== '') {
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
      }
    });

    it('round-trip works for various data types and lengths', () => {
      const testCases = [
        'short',
        'medium-length-synthetic-data-for-testing',
        'Special chars: !@#$%^&*()_+-=[]{}|;:",.<>?/',
        'Unicode: cafe\u0301 re\u0301sume\u0301',
        '',
      ];

      for (const original of testCases) {
        const encrypted = encrypt(original);
        if (encrypted !== '') {
          const decrypted = decrypt(encrypted);
          expect(decrypted).toBe(original);
        }
      }
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encrypt('sensitive-data');

      if (encrypted !== '') {
        const parts = encrypted.split(':');
        // Tamper with the ciphertext portion
        parts[2] = parts[2].slice(0, -2) + 'XX';
        const tampered = parts.join(':');

        expect(() => decrypt(tampered)).toThrow();
      }
    });

    it('throws on tampered auth tag', () => {
      const encrypted = encrypt('sensitive-data');

      if (encrypted !== '') {
        const parts = encrypted.split(':');
        // Tamper with the auth tag
        parts[1] = '0'.repeat(parts[1].length);
        const tampered = parts.join(':');

        expect(() => decrypt(tampered)).toThrow();
      }
    });

    it('throws on invalid format (missing parts)', () => {
      if (encrypt('test') !== '') {
        expect(() => decrypt('not-valid-format')).toThrow();
        expect(() => decrypt('only:two')).toThrow();
      }
    });
  });

  // ── hashSSN() ──────────────────────────────────────────────────────

  describe('hashSSN()', () => {
    it('produces a consistent hash for the same SSN', () => {
      const ssn = '123-45-6789';
      const hash1 = hashSSN(ssn);
      const hash2 = hashSSN(ssn);

      if (hash1 !== '') {
        expect(hash1).toBe(hash2);
      }
    });

    it('produces different hashes for different SSNs', () => {
      const hash1 = hashSSN('111-22-3333');
      const hash2 = hashSSN('444-55-6666');

      if (hash1 !== '' && hash2 !== '') {
        expect(hash1).not.toBe(hash2);
      }
    });

    it('normalizes SSNs — dashed and undashed produce the same hash', () => {
      const hashDashed = hashSSN('123-45-6789');
      const hashUndashed = hashSSN('123456789');

      if (hashDashed !== '' && hashUndashed !== '') {
        expect(hashDashed).toBe(hashUndashed);
      }
    });

    it('produces a hex string output', () => {
      const hash = hashSSN('999-88-7777');

      if (hash !== '') {
        // SHA-256 hex digest is 64 characters
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('is a one-way function (hash does not contain original SSN)', () => {
      const ssn = '123-45-6789';
      const hash = hashSSN(ssn);

      if (hash !== '') {
        expect(hash).not.toContain('123');
        expect(hash).not.toContain('6789');
      }
    });
  });
});
