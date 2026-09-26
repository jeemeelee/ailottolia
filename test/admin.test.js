import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import admin from '../api/admin.js';
import events from '../api/events.js';
import { COOKIE, key } from '../lib/core.js';

const db = new Map();
let unavailable = false;
beforeEach(() => {
  db.clear(); unavailable = false;
  Object.assign(process.env, { ADMIN_PASSWORD: 'test-password-only-1234', ADMIN_SESSION_SECRET: 'test-secret-only-12345678901234567890', ADMIN_ORIGIN: 'https://example.test', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'test' });
  globalThis.fetch = async (_url, options) => {
    if (unavailable) throw new Error('offline');
    const [cmd, ...args] = JSON.parse(options.body);
    let result = null;
    if (cmd === 'SET') { db.set(args[0], args[1]); result = 'OK'; }
    if (cmd === 'GET') result = db.get(args[0]) ?? null;
    if (cmd === 'DEL') { result = Number(db.delete(args[0])); }
    if (cmd === 'HGETALL') result = ['visitors', '2', 'generations', '3', 'geo:KR/28', '2'];
    if (cmd === 'EVAL') {
      if (args[1] === 1) { result = (db.get(args[2]) || 0) + 1; db.set(args[2], result); }
      else { result = 1; db.set('last-event', args); }
    }
    return { ok: true, json: async () => ({ result }) };
  };
});
async function request(handler, action = '', { method = 'GET', data, cookie, origin = process.env.ADMIN_ORIGIN } = {}) {
  const req = { url: `/api/admin${action ? '?action=' + action : ''}`, method, body: data, headers: { origin, 'content-type': 'application/json', cookie, 'x-vercel-forwarded-for': '192.0.2.1', 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '28' } };
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.body = value; } };
  await handler(req, res); return res;
}
async function login() {
  const r = await request(admin, 'login', { method: 'POST', data: { password: process.env.ADMIN_PASSWORD } });
  assert.equal(r.statusCode, 200);
  return r.headers['Set-Cookie'].split(';')[0];
}
test('unauthenticated HTML contains only login and data APIs reject access', async () => {
  const r = await request(admin);
  assert.match(r.body, /관리자 로그인/); assert.doesNotMatch(r.body, /id="promptForm"/);
  assert.match(r.headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal((await request(admin, 'stats')).statusCode, 401);
  assert.equal((await request(admin, 'prompt', { method: 'POST', data: { text: 'bad' } })).statusCode, 401);
  assert.equal((await request(admin, 'stats', { cookie: `${COOKIE}=${'a'.repeat(64)}` })).statusCode, 401);
});
test('valid login, persistent prompt, stats, and revocable logout', async () => {
  const c = await login();
  assert.match((await request(admin, '', { cookie: c })).body, /관리자 대시보드/);
  const prompt = '<script>alert(1)</script> Test';
  assert.equal((await request(admin, 'prompt', { method: 'POST', cookie: c, data: { text: prompt } })).statusCode, 200);
  const stats = JSON.parse((await request(admin, 'stats', { cookie: c })).body);
  assert.equal(stats.prompt.text, prompt); assert.equal(stats.days.length, 7); assert.equal(stats.days[0].values.visitors, 2);
  const logout = await request(admin, 'logout', { method: 'POST', cookie: c, data: {} });
  assert.match(logout.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal((await request(admin, 'stats', { cookie: c })).statusCode, 401);
});
test('expired sessions and password rotation invalidate authentication', async () => {
  const c = await login(); db.clear();
  assert.equal((await request(admin, 'stats', { cookie: c })).statusCode, 401);
  const c2 = await login(); process.env.ADMIN_PASSWORD = 'a-different-password-5678';
  assert.equal((await request(admin, 'stats', { cookie: c2 })).statusCode, 401);
});
test('CSRF, methods, validation, rate limit and failure closed', async () => {
  assert.equal((await request(admin, 'login', { method: 'POST', origin: 'https://evil.test', data: {} })).statusCode, 403);
  assert.equal((await request(admin, 'stats', { method: 'DELETE' })).statusCode, 405);
  const c = await login();
  assert.equal((await request(admin, 'prompt', { method: 'POST', cookie: c, data: { text: ' ' } })).statusCode, 400);
  for (let i = 0; i < 4; i++) assert.equal((await request(admin, 'login', { method: 'POST', data: { password: 'wrong' } })).statusCode, 401);
  assert.equal((await request(admin, 'login', { method: 'POST', data: { password: process.env.ADMIN_PASSWORD } })).statusCode, 429);
  unavailable = true; assert.equal((await request(admin, 'stats', { cookie: c })).statusCode, 503);
  delete process.env.ADMIN_SESSION_SECRET; assert.equal((await request(admin)).statusCode, 503);
});
test('event validation and server-provided geography', async () => {
  assert.equal((await request(events)).statusCode, 405);
  assert.equal((await request(events, '', { method: 'POST', data: {} })).statusCode, 400);
  const data = { type: 'visit', visitorId: '12345678-1234-1234-1234-123456789012', eventId: '12345678-1234-1234-1234-123456789013', country: 'US' };
  assert.equal((await request(events, '', { method: 'POST', data })).statusCode, 200);
  assert.equal(db.get('last-event').at(-1), 'geo:KR/28');
  assert.equal((await request(events, '', { method: 'POST', data, origin: 'https://evil.test' })).statusCode, 403);
});
