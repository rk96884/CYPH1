import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';

// One administrator credential for the isolated development service only.
// Hash format: scrypt:<32 hex salt characters>:<128 hex digest characters>.
export function loadDevelopmentAuth(env) {
  if (env.GROWTH_DATA_ENV !== 'development') throw Error('Development-only mode required');
  const email = env.GROWTH_DEV_ADMIN_EMAIL?.trim().toLowerCase();
  if (email !== 'rishikhosla@hotmail.com') throw Error('Authorised development administrator required');
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(env.GROWTH_DEV_PASSWORD_HASH || '');
  if (!match) throw Error('Valid development password hash required');
  return { email, salt: Buffer.from(match[1], 'hex'), digest: Buffer.from(match[2], 'hex') };
}

export function createDevelopmentAuthenticator(config, now = Date.now) {
  const expectedEmail = createHash('sha256').update(config.email).digest();
  let windowStart = now(), attempts = 0;
  return function authenticate(header) {
    if (now() - windowStart >= 60_000) { windowStart = now(); attempts = 0; }
    // Global per-process bound avoids trusting caller-supplied forwarding headers.
    if (++attempts > 20) return false;
    if (typeof header !== 'string' || header.length > 1024) return false;
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
    if (!match) return false;
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.toString('base64') !== match[1]) return false;
    const decoded = bytes.toString('utf8');
    if (!Buffer.from(decoded).equals(bytes)) return false;
    const separator = decoded.indexOf(':');
    if (separator < 1) return false;
    const email = decoded.slice(0, separator).toLowerCase();
    const password = decoded.slice(separator + 1);
    // Require a generated 256-bit password; reject before expensive hashing.
    if (!/^[a-f0-9]{64}$/.test(password)) return false;
    const emailDigest = createHash('sha256').update(email).digest();
    const passwordDigest = scryptSync(password, config.salt, 64);
    return timingSafeEqual(emailDigest, expectedEmail) && timingSafeEqual(passwordDigest, config.digest);
  };
}
