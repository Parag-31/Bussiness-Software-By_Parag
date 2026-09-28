import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, generateTotpSecret, totpCode, verifyTotp, otpAuthUrl } from '../totp.js';
import crypto from 'node:crypto';

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = crypto.randomBytes(20);
    expect(Buffer.compare(base32Decode(base32Encode(bytes)), bytes)).toBe(0);
  });
});

describe('TOTP (RFC 4226 / RFC 6238)', () => {
  // Official RFC 4226 Appendix D test vectors: ASCII secret "12345678901234567890",
  // SHA-1, 6 digits, counters 0-9. totpCode() with a synthetic time lets us drive
  // the same counters (counter = floor(time / 1000 / 30)) as the RFC's HOTP table.
  const secretBase32 = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

  it('matches every official RFC 4226 test vector', () => {
    for (let counter = 0; counter < 10; counter++) {
      const forTime = counter * 30 * 1000; // lands exactly on step boundary `counter`
      expect(totpCode(secretBase32, forTime)).toBe(expected[counter]);
    }
  });

  it('generates a secret that verifies its own current code', () => {
    const secret = generateTotpSecret();
    const code = totpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const secret = generateTotpSecret();
    const real = totpCode(secret);
    const wrong = real === '000000' ? '111111' : '000000';
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('tolerates one adjacent 30s step (clock drift)', () => {
    const secret = generateTotpSecret();
    const oneStepAgo = totpCode(secret, Date.now() - 30 * 1000);
    expect(verifyTotp(secret, oneStepAgo, 1)).toBe(true);
  });
});

describe('otpAuthUrl', () => {
  it('embeds the secret and account name for authenticator apps to scan', () => {
    const url = otpAuthUrl('JBSWY3DPEHPK3PXP', 'admin', 'Vishwa Infra Business Suite');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(decodeURIComponent(url)).toContain('Vishwa Infra Business Suite:admin');
  });
});
