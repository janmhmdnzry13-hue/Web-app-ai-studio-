import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateProductionSecrets, getJwtSecret } from '../auth';
import { getEncryptionKey, db } from '../db';

describe('Production Secrets Persistence & Startup Validation Suite', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalJwt = process.env.JWT_SECRET;
  const originalEnc = process.env.ENCRYPTION_SECRET;

  const validProductionJwtSecret = 'origin_jwt_strong_entropy_production_secret_key_2026_x89a';
  const validProductionEncryptionSecret = 'origin_enc_strong_entropy_production_secret_key_2026_z74b';

  beforeEach(() => {
    // Default clean state
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalJwt !== undefined) {
      process.env.JWT_SECRET = originalJwt;
    } else {
      delete process.env.JWT_SECRET;
    }

    if (originalEnc !== undefined) {
      process.env.ENCRYPTION_SECRET = originalEnc;
    } else {
      delete process.env.ENCRYPTION_SECRET;
    }
  });

  // REQUIREMENT 1: In production, missing JWT_SECRET fails fast with a clear configuration error
  it('1. Production startup fails fast when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_SECRET = validProductionEncryptionSecret;

    // A. Undefined
    delete process.env.JWT_SECRET;
    expect(() => validateProductionSecrets()).toThrowError(
      /CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is required/
    );

    // B. Empty string
    process.env.JWT_SECRET = '';
    expect(() => validateProductionSecrets()).toThrowError(
      /CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is required/
    );

    // C. Whitespace string
    process.env.JWT_SECRET = '    ';
    expect(() => validateProductionSecrets()).toThrowError(
      /CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is required/
    );
  });

  // REQUIREMENT 2: In production, missing ENCRYPTION_SECRET fails fast with a clear configuration error
  it('2. Production startup fails fast when ENCRYPTION_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = validProductionJwtSecret;

    // A. Undefined
    delete process.env.ENCRYPTION_SECRET;
    expect(() => validateProductionSecrets()).toThrowError(
      /CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET environment variable is required/
    );

    // B. Empty string
    process.env.ENCRYPTION_SECRET = '';
    expect(() => validateProductionSecrets()).toThrowError(
      /CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET environment variable is required/
    );

    // C. Whitespace string
    process.env.ENCRYPTION_SECRET = '    ';
    expect(() => validateProductionSecrets()).toThrowError(
      /CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET environment variable is required/
    );
  });

  // REQUIREMENT 3: In production, reject known insecure/default secret values
  it('3. Production startup rejects known insecure/default secret values', () => {
    process.env.NODE_ENV = 'production';

    const insecureJwtValues = [
      'origin-jwt-production-secret-auth-token-2026',
      'origin-dev-test-jwt-secret-not-for-production-2026',
      'default_secret',
      'secret',
      'test-dev-secret',
      'jwt_secret',
      'jwt-secret',
      'changeme',
      'change-me',
      'placeholder',
      'short', // < 16 chars
    ];

    process.env.ENCRYPTION_SECRET = validProductionEncryptionSecret;
    for (const badJwt of insecureJwtValues) {
      process.env.JWT_SECRET = badJwt;
      expect(() => validateProductionSecrets()).toThrowError(
        /CRITICAL_SECURITY_ERROR: JWT_SECRET/
      );
    }

    const insecureEncryptionValues = [
      'origin-aes-256-gcm-master-key-prod-2026',
      'origin-dev-test-encryption-key-not-for-production-2026',
      'default_secret',
      'secret',
      'test-dev-secret',
      'encryption_secret',
      'encryption-secret',
      'changeme',
      'change-me',
      'placeholder',
      'short', // < 16 chars
    ];

    process.env.JWT_SECRET = validProductionJwtSecret;
    for (const badEnc of insecureEncryptionValues) {
      process.env.ENCRYPTION_SECRET = badEnc;
      expect(() => validateProductionSecrets()).toThrowError(
        /CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET/
      );
    }
  });

  // REQUIREMENT 4: Valid externally supplied secrets allow startup
  it('4. Production startup succeeds and validates when valid external secrets are supplied', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = validProductionJwtSecret;
    process.env.ENCRYPTION_SECRET = validProductionEncryptionSecret;

    const validated = validateProductionSecrets();
    expect(validated.jwtSecret).toBe(validProductionJwtSecret);
    expect(validated.encryptionKey).toBeInstanceOf(Buffer);
    expect(validated.encryptionKey.length).toBe(32);
  });

  // REQUIREMENT 5: Development/test mode does not require production secrets
  it('5. Development and test modes do not require production secrets and use stable fallbacks', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.ENCRYPTION_SECRET;

    // Should NOT throw in development mode
    const validated = validateProductionSecrets();
    expect(validated.jwtSecret).toBe('origin-dev-test-jwt-secret-not-for-production-2026');
    expect(validated.encryptionKey).toBeInstanceOf(Buffer);
    expect(validated.encryptionKey.length).toBe(32);
  });

  // REQUIREMENT 6: Secret persistence & stability across restarts / invocations
  it('6. Secrets remain stable across multiple invocations and are never randomly mutated', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = validProductionJwtSecret;
    process.env.ENCRYPTION_SECRET = validProductionEncryptionSecret;

    // Invocations simulating separate requests/restarts
    const run1 = validateProductionSecrets();
    const run2 = validateProductionSecrets();

    expect(run1.jwtSecret).toBe(run2.jwtSecret);
    expect(run1.encryptionKey.equals(run2.encryptionKey)).toBe(true);

    // Verify encryption-decryption round-trip stability
    const sampleData = 'Secret message that must remain decryptable across server restarts';
    const cipherText = db.encrypt(sampleData);
    const decrypted = db.decrypt(cipherText);
    expect(decrypted).toBe(sampleData);
  });
});
