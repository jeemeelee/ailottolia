const visitorKey = 'ailottolia_visitor_v1';
const pendingKey = 'ailottolia_pending_events_v1';
export const statsUpdatedKey = 'ailottolia_stats_updated_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const koreaDay = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
let visitorId;
try { visitorId = localStorage.getItem(visitorKey); } catch {}
if (!UUID.test(visitorId || '')) {
  visitorId = uuid();
  try { localStorage.setItem(visitorKey, visitorId); } catch {}
}
let pending = [];
try {
  const stored = JSON.parse(sessionStorage.getItem(pendingKey) || '[]');
  if (Array.isArray(stored)) pending = stored.filter(event => event.day === koreaDay() && UUID.test(event.visitorId) && UUID.test(event.eventId) && ['visit', 'generate'].includes(event.type));
} catch {}
let sending = false;
let timer;
let retryDelay = 2000;
let visitedDay;
function persist() {
  try { sessionStorage.setItem(pendingKey, JSON.stringify(pending)); } catch {}
}
function notifyUpdated() {
  try { localStorage.setItem(statsUpdatedKey, uuid()); } catch {}
}
async function flush() {
  if (sending) return;
  clearTimeout(timer);
  sending = true;
  try {
    while (pending.length) {
      const event = pending[0];
      // The database dates events on receipt. Never move an old event into a new day.
      if (event.day !== koreaDay()) { pending.shift(); persist(); continue; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let response;
      try {
        response = await fetch('/api/track', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(event), keepalive: true, signal: controller.signal
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error('Tracking unavailable');
      pending.shift(); persist(); retryDelay = 2000; notifyUpdated();
    }
  } catch {
    // Retain the same event ID after an ambiguous response: database retries are idempotent.
    timer = setTimeout(flush, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  } finally { sending = false; }
}
export function track(type) {
  // Statistics must never break the successful number-generation UI.
  try {
    if (!['visit', 'generate'].includes(type)) return;
    if (type === 'visit' && visitedDay === koreaDay()) { void flush(); return; }
    const event = {visitorId, eventId: uuid(), type, day: koreaDay()};
    pending.push(event);
    if (type === 'visit') visitedDay = event.day;
    persist(); void flush();
  } catch {}
}
window.addEventListener('online', () => { void flush(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') track('visit');
});
// An open page still counts when it is used on a new Korean calendar day.
setInterval(() => {
  if (document.visibilityState === 'visible') track('visit');
}, 60000);
