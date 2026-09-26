import test from 'node:test';
import assert from 'node:assert/strict';
import { analytics } from '../lib/vercel-analytics.js';
import admin from '../api/admin.js';

test('analytics requires admin authentication before accessing Vercel', async () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'test-password-123456', ADMIN_SESSION_SECRET: 'a'.repeat(32), ADMIN_ORIGIN: 'https://example.test', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'test' });
  globalThis.fetch = async () => { throw new Error('must not fetch'); };
  const res = { setHeader() {}, end(body) { this.body = body; } };
  await admin({ method: 'GET', url: '/api/admin?action=analytics', headers: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('analytics handles configuration, results, upstream errors without disclosing token', async () => {
  delete process.env.VERCEL_ANALYTICS_TOKEN;
  assert.equal((await analytics()).status, 'unconfigured');
  Object.assign(process.env, { VERCEL_ANALYTICS_TOKEN: 'private-test-token', VERCEL_ANALYTICS_PROJECT_ID: 'prj_test', VERCEL_ANALYTICS_TEAM_ID: 'team_test' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url.origin, 'https://api.vercel.com');
    assert.equal(url.searchParams.get('projectId'), 'prj_test');
    assert.equal(url.searchParams.get('by'), 'day');
    assert.equal(url.searchParams.get('teamId'), 'team_test');
    assert.equal(url.searchParams.get('filter'), "requestPath eq '/'");
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ data: [{ timestamp: '2026-09-26T00:00:00.000Z', visitors: 3, pageviews: 5 }] }) };
  };
  assert.deepEqual(await analytics(), { status: 'ready', days: [{ date: '2026-09-26', visitors: 3, pageviews: 5 }] });
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  assert.deepEqual(await analytics(), { status: 'unavailable', days: [] });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [{ visitors: 'secret' }] }) });
  assert.equal((await analytics()).status, 'unavailable');
});
