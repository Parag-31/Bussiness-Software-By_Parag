// Minimal TOTP (RFC 6238) implementation for optional two-factor login,
// compatible with Google Authenticator, Microsoft Authenticator, Authy etc.
// No external dependency — this is ~50 lines of well-defined, standard
// crypto, verified against the official RFC 4226 Appendix D test vectors
// in server/src/__tests__/totp.test.ts.
import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  const remainder = bits.length % 5;
  if (remainder) output += BASE32_ALPHABET[parseInt(bits.slice(bits.length - remainder).padEnd(5, '0'), 2)];
  return output;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

/** A fresh random secret for a user enabling 2FA, base32-encoded (what authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(base32Secret: string, forTime: number = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(forTime / 1000 / step);
  return hotp(base32Decode(base32Secret), counter, digits);
}

/** Accepts the current 30s step or one step either side, to tolerate clock drift. */
export function verifyTotp(base32Secret: string, token: string, window = 1, step = 30, digits = 6): boolean {
  if (!/^\d{6,8}$/.test((token || '').trim())) return false;
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let e = -window; e <= window; e++) {
    if (hotp(base32Decode(base32Secret), counter + e, digits) === token.trim()) return true;
  }
  return false;
}

/** The otpauth:// URI encoded as a QR code so an authenticator app can scan it. */
export function otpAuthUrl(secret: string, accountName: string, issuer = 'Vishwa Infra Business Suite'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}
