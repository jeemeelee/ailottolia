import { configured, sameOrigin, ip, limited, digest, redis, key, headers, json, body, day } from '../lib/core.js';

// Atomic deduplication and counters; visitor IDs and raw IPs are never retained.
export const RECORD = `
if redis.call('SET',KEYS[2],'1','NX','EX',172800)==false then return 0 end
if ARGV[1]=='visit' then
 redis.call('HINCRBY',KEYS[1],'pageviews',1)
 if redis.call('SET',KEYS[3],'1','NX','EX',172800) then
  redis.call('HINCRBY',KEYS[1],'visitors',1)
  redis.call('HINCRBY',KEYS[1],ARGV[2],1)
 end
else redis.call('HINCRBY',KEYS[1],'generations',1) end
redis.call('EXPIRE',KEYS[1],7776000)
return 1`;
export default async function handler(req, res) {
  headers(res);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  if (!configured()) return json(res, 503, { error: 'Not configured' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Forbidden' });
  let data;
  try { data = body(req); } catch { return json(res, 400, { error: 'Invalid body' }); }
  const uuid = /^[a-f0-9-]{36}$/i;
  if (!['visit', 'generation'].includes(data.type) || !uuid.test(data.visitorId || '') || !uuid.test(data.eventId || '')) return json(res, 400, { error: 'Invalid event' });
  try {
    if (await limited(`events:${day()}:${digest(ip(req))}`, 120, 60)) return json(res, 429, { error: 'Too many events' });
    const country = /^[A-Z]{2}$/.test(req.headers['x-vercel-ip-country'] || '') ? req.headers['x-vercel-ip-country'] : 'Unknown';
    const region = /^[a-zA-Z0-9-]{1,16}$/.test(req.headers['x-vercel-ip-country-region'] || '') ? req.headers['x-vercel-ip-country-region'] : 'Unknown';
    await redis(['EVAL', RECORD, 3, key(`stats:${day()}`), key(`event:${day()}:${digest(data.eventId)}`), key(`visitor:${day()}:${digest(day() + data.visitorId)}`), data.type, `geo:${country}/${region}`]);
    return json(res, 200, { ok: true });
  } catch { return json(res, 503, { error: 'Storage unavailable' }); }
}
