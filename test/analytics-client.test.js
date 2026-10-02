import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source = readFileSync(new URL('../js/analytics.js', import.meta.url), 'utf8').replace(/export /g, '');
function storage(values = new Map()) {
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}
function client({session = storage(), local = storage(), fail = false, legacy = false} = {}) {
  const requests = [], timers = new Map(), windowEvents = {}, documentEvents = {};
  let now = Date.parse('2026-10-02T14:59:00Z'), nextTimer = 0;
  const context = vm.createContext({
    crypto: legacy ? {getRandomValues: bytes => webcrypto.getRandomValues(bytes)} : webcrypto,
    Uint8Array, AbortController,
    Date: class extends Date { static now() { return now; } },
    sessionStorage: session, localStorage: local,
    window: {addEventListener: (name, fn) => windowEvents[name] = fn},
    document: {visibilityState: 'visible', addEventListener: (name, fn) => documentEvents[name] = fn},
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, {fn, delay}); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => {},
    fetch: async (_, options) => {requests.push(JSON.parse(options.body)); return {ok: !fail};}
  });
  vm.runInContext(source, context);
  return {context, requests, timers, windowEvents, documentEvents,
    track: type => context.track(type), online: () => { fail = false; windowEvents.online(); },
    tomorrow: () => {now += 120000;}, session};
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('failed generation survives reload and retries with the same event ID', async () => {
  const session = storage();
  const first = client({session, fail: true});
  first.track('generate'); await settle();
  assert.equal(first.requests.length, 1);
  assert.equal(JSON.parse(session.getItem('ailottolia_pending_events_v1')).length, 1);
  const second = client({session});
  second.track('visit'); await settle();
  assert.equal(second.requests[0].eventId, first.requests[0].eventId);
  assert.equal(second.requests[0].type, 'generate');
  assert.equal(second.requests[1].type, 'visit');
  assert.equal(session.getItem('ailottolia_pending_events_v1'), '[]');
});
test('offline reconnect retries; failures do not double enqueue visits', async () => {
  const app = client({fail: true});
  app.track('visit'); await settle();
  app.track('visit'); await settle();
  app.track('generate'); await settle();
  app.online(); await settle();
  assert.equal(new Set(app.requests.filter(r => r.type === 'visit').map(r => r.eventId)).size, 1);
  assert.equal(app.requests.filter(r => r.type === 'generate').length, 1);
  assert.equal(app.session.getItem('ailottolia_pending_events_v1'), '[]');
});
test('legacy UUID API and blocked browser storage do not interrupt tracking', async () => {
  const blocked = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}};
  const app = client({legacy: true, local: blocked, session: blocked});
  assert.doesNotThrow(() => app.track('generate'));
  await settle();
  assert.match(app.requests[0].visitorId, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
});
test('resuming an open page on a new Korea-local date records a new visit', async () => {
  const app = client();
  app.track('visit'); await settle();
  app.tomorrow(); app.documentEvents.visibilitychange(); await settle();
  assert.equal(app.requests.length, 2);
  assert.notEqual(app.requests[0].day, app.requests[1].day);
  assert.equal(app.requests[0].visitorId, app.requests[1].visitorId);
});
test('expired pending events cannot inflate the next day statistics', async () => {
  const app = client({fail: true});
  app.track('generate'); await settle();
  app.tomorrow(); app.online(); await settle();
  assert.equal(app.requests.length, 1);
  assert.equal(app.session.getItem('ailottolia_pending_events_v1'), '[]');
});
