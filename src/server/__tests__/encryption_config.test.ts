import { describe, it, expect, afterEach } from 'vitest';
import { getEncryptionKey, db } from '../db';

describe('Production ENCRYPTION_SECRET Configuration Mandatory Enforcement Suite', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalEnc = process.env.ENCRYPTION_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalEnc !== undefined) {
      process.env.ENCRYPTION_SECRET = originalEnc;
    } else {
      delete process.env.ENCRYPTION_SECRET;
    }
  });

  // TEST 1: Production with ENCRYPTION_SECRET → configuration succeeds
  it('1. Production with ENCRYPTION_SECRET → configuration succeeds', () => {
    process.env.NODE_ENV = 'production';
    const strongProdSecret = 'production_super_secret_high_entropy_aes_key_9988776655';
    process.env.ENCRYPTION_SECRET = strongProdSecret;

    const key = getEncryptionKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32); // AES-256 requires 32 bytes
  });

  // TEST 2: Production without ENCRYPTION_SECRET → application fails with a clear configuration error
  it('2. Production without ENCRYPTION_SECRET → application fails with a clear configuration error', () => {
    process.env.NODE_ENV = 'production';

    // A. Undefined ENCRYPTION_SECRET
    delete process.env.ENCRYPTION_SECRET;
    expect(() => getEncryptionKey()).toThrowError(/CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/);

    // B. Empty string ENCRYPTION_SECRET
    process.env.ENCRYPTION_SECRET = '';
    expect(() => getEncryptionKey()).toThrowError(/CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/);

    // C. Whitespace-only ENCRYPTION_SECRET
    process.env.ENCRYPTION_SECRET = '   ';
    expect(() => getEncryptionKey()).toThrowError(/CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/);
  });

  // TEST 3: No hardcoded production encryption secret remains
  it('3. No hardcoded production encryption secret remains and placeholder/dev values are rejected in production', () => {
    process.env.NODE_ENV = 'production';

    const forbiddenSecrets = [
      'origin-aes-256-gcm-master-key-prod-2026',
      'origin-dev-test-encryption-key-not-for-production-2026',
      'default_secret',
      'secret',
      'test-dev-secret',
    ];

    for (const secret of forbiddenSecrets) {
      process.env.ENCRYPTION_SECRET = secret;
      expect(() => getEncryptionKey()).toThrowError(/CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/);
    }
  });

  // TEST 4: Existing encryption/decryption functionality still works when ENCRYPTION_SECRET is correctly configured
  it('4. Existing encryption/decryption functionality still works when ENCRYPTION_SECRET is correctly configured', () => {
    process.env.NODE_ENV = 'production';
    const strongProdSecret = 'production_valid_crypto_master_secret_key_1122334455';
    process.env.ENCRYPTION_SECRET = strongProdSecret;

    const originalText = 'Highly confidential reflection notes & private journal content for 2026';

    const encrypted = db.encrypt(originalText);
    expect(encrypted).not.toBe(originalText);
    expect(encrypted.startsWith('enc_v1:')).toBe(true);

    const decrypted = db.decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });
});
