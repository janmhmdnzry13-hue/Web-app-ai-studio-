import { describe, it, expect, afterEach } from 'vitest';
import { getJwtSecret } from '../auth';

describe('Production JWT_SECRET Configuration Mandatory Enforcement Suite', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalJwt = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalJwt !== undefined) {
      process.env.JWT_SECRET = originalJwt;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  // TEST 1: Production with JWT_SECRET → configuration succeeds
  it('1. Production with JWT_SECRET → configuration succeeds', () => {
    process.env.NODE_ENV = 'production';
    const strongProdSecret = 'production_super_secret_high_entropy_key_998877665544332211';
    process.env.JWT_SECRET = strongProdSecret;

    const resolvedSecret = getJwtSecret();
    expect(resolvedSecret).toBe(strongProdSecret);
    expect(typeof resolvedSecret).toBe('string');
    expect(resolvedSecret.length).toBeGreaterThanOrEqual(32);
  });

  // TEST 2: Production without JWT_SECRET → application fails with a clear configuration error
  it('2. Production without JWT_SECRET → application fails with a clear configuration error', () => {
    process.env.NODE_ENV = 'production';

    // A. Undefined JWT_SECRET
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrowError(/CRITICAL_SECURITY_ERROR: JWT_SECRET/);

    // B. Empty string JWT_SECRET
    process.env.JWT_SECRET = '';
    expect(() => getJwtSecret()).toThrowError(/CRITICAL_SECURITY_ERROR: JWT_SECRET/);

    // C. Whitespace-only JWT_SECRET
    process.env.JWT_SECRET = '   ';
    expect(() => getJwtSecret()).toThrowError(/CRITICAL_SECURITY_ERROR: JWT_SECRET/);
  });

  // TEST 3: No hardcoded production JWT secret remains
  it('3. No hardcoded production JWT secret remains and placeholder/dev values are rejected in production', () => {
    process.env.NODE_ENV = 'production';

    // Known placeholder or development secrets must be rejected in production
    const forbiddenSecrets = [
      'origin-jwt-production-secret-auth-token-2026',
      'origin-dev-test-jwt-secret-not-for-production-2026',
      'default_secret',
      'secret',
      'test-dev-secret',
    ];

    for (const secret of forbiddenSecrets) {
      process.env.JWT_SECRET = secret;
      expect(() => getJwtSecret()).toThrowError(/CRITICAL_SECURITY_ERROR: JWT_SECRET/);
    }
  });

  // TEST 4: Development/test mode does not require production secrets
  it('4. Development/test mode does not require production secrets and uses stable fallback', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;

    const secret1 = getJwtSecret();
    const secret2 = getJwtSecret();
    expect(secret1).toBe('origin-dev-test-jwt-secret-not-for-production-2026');
    expect(secret2).toBe(secret1); // Stable, never randomly generated across restarts
  });
});
