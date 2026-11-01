import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_AGE_SEC = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 6;
const failedLogins = new Map();

function equalStrings(a, b) {
  const aa = createHash('sha256').update(String(a)).digest();
  const bb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(aa, bb);
}

function hmac(value) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');
}

export function newSessionCookie(req) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_AGE_SEC * 1000, nonce: randomBytes(12).toString('hex') })).toString('base64url');
  const token = `${payload}.${hmac(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `nep_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE_SEC}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `nep_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function isLoggedIn(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('nep_session='));
  const value = cookie?.slice('nep_session='.length);
  if (!value || value.length > 500) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !equalStrings(signature, hmac(payload))) return false;
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof obj.exp === 'number' && obj.exp > Date.now() && obj.exp <= Date.now() + SESSION_AGE_SEC * 1000;
  } catch { return false; }
}

export function verifyLogin(req, password) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = failedLogins.get(ip);
  if (recent && now < recent.until && recent.count >= MAX_LOGIN_ATTEMPTS) return { ok: false, limited: true };
  const ok = equalStrings(password, process.env.ADMIN_PASSWORD);
  if (ok) { failedLogins.delete(ip); return { ok: true, limited: false }; }
  const count = recent && now < recent.until ? recent.count + 1 : 1;
  failedLogins.set(ip, { count, until: now + LOGIN_WINDOW_MS });
  return { ok: false, limited: false };
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (curl, tests) don't always send an Origin.
  try {
    const expectedHost = req.headers.host;
    const value = new URL(origin);
    return (value.protocol === 'http:' || value.protocol === 'https:') && value.host === expectedHost;
  } catch { return false; }
}
