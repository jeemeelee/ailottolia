import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export const COOKIE = '__Host-ailottolia-admin';
export const TTL = 8 * 60 * 60;
export const key = name => `ailottolia:${process.env.VERCEL_ENV || 'development'}:${name}`;
export function configured() {
  return (process.env.ADMIN_PASSWORD || '').length >= 16 &&
    (process.env.ADMIN_SESSION_SECRET || '').length >= 32 &&
    /^https:\/\/[^/]+$/.test(process.env.ADMIN_ORIGIN || '') &&
    /^https:\/\//.test(process.env.UPSTASH_REDIS_REST_URL || '') &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;
}
export function equal(a, b) {
  const hash = x => createHash('sha256').update(String(x)).digest();
  return timingSafeEqual(hash(a), hash(b));
}
export const digest = value => createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export function cookie(req) {
  const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
export function sessionCookie(value, age = TTL) {
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
}
export async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Storage command failed');
  return data.result;
}
export async function authenticated(req) {
  const value = cookie(req);
  if (!value) return false;
  return await redis(['GET', key(`session:${digest(value)}`)]) === digest(process.env.ADMIN_PASSWORD);
}
export function sameOrigin(req) {
  return req.headers.origin === process.env.ADMIN_ORIGIN;
}
export function ip(req) {
  // Vercel overwrites this header; never use a client-supplied body IP.
  return String(req.headers['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim();
}
export async function limited(name, limit, seconds) {
  const count = await redis(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key(name), seconds]);
  return Number(count) > limit;
}
export function headers(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}
export function json(res, status, value) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); }
export function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('Invalid body');
  const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 12000) throw new Error('Invalid body');
  return value;
}
export function day() { return new Date().toISOString().slice(0, 10); }
