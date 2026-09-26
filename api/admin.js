import { configured, equal, digest, token, cookie, sessionCookie, authenticated, sameOrigin, ip, limited, redis, key, TTL, headers, json, body, day } from '../lib/core.js';
import { page } from '../lib/admin-page.js';

export default async function handler(req, res) {
  headers(res);
  if (!configured()) return json(res, 503, { error: '관리자 설정이 완료되지 않았습니다.' });
  const action = new URL(req.url, 'https://local.invalid').searchParams.get('action') || 'page';
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: '허용되지 않는 요청입니다.' }); }
  try {
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: '허용되지 않는 출처입니다.' });
      let data;
      try { data = body(req); } catch { return json(res, 400, { error: '잘못된 요청입니다.' }); }
      if (action === 'login') {
        if (await limited(`login:${digest(ip(req))}`, 5, 900)) return json(res, 429, { error: '로그인 시도가 많습니다. 15분 후 다시 시도하세요.' });
        if (typeof data.password !== 'string' || !equal(data.password, process.env.ADMIN_PASSWORD)) return json(res, 401, { error: '인증에 실패했습니다.' });
        const value = token();
        await redis(['SET', key(`session:${digest(value)}`), digest(process.env.ADMIN_PASSWORD), 'EX', TTL]);
        res.setHeader('Set-Cookie', sessionCookie(value));
        return json(res, 200, { ok: true });
      }
      if (!await authenticated(req)) return json(res, 401, { error: '관리자 로그인이 필요합니다.' });
      if (action === 'logout') {
        await redis(['DEL', key(`session:${digest(cookie(req))}`)]);
        res.setHeader('Set-Cookie', sessionCookie('', 0));
        return json(res, 200, { ok: true });
      }
      if (action === 'prompt') {
        if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000) return json(res, 400, { error: '프롬프트는 1~4,000자로 입력하세요.' });
        const prompt = { text: data.text.trim(), updatedAt: new Date().toISOString() };
        await redis(['SET', key('weekly-prompt'), JSON.stringify(prompt)]);
        return json(res, 200, { ok: true, prompt });
      }
      return json(res, 404, { error: '찾을 수 없습니다.' });
    }
    const authorized = await authenticated(req);
    if (action === 'page') {
      const nonce = token();
      res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(page(authorized, nonce));
    }
    if (!authorized) return json(res, 401, { error: '관리자 로그인이 필요합니다.' });
    if (action === 'stats') {
      const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
      const days = await Promise.all(dates.map(async date => {
        const fields = await redis(['HGETALL', key(`stats:${date}`)]);
        const values = {};
        for (let i = 0; i < (fields || []).length; i += 2) values[fields[i]] = Number(fields[i + 1]);
        return { date, values };
      }));
      const prompt = await redis(['GET', key('weekly-prompt')]);
      return json(res, 200, { today: day(), days, prompt: prompt ? JSON.parse(prompt) : null });
    }
    return json(res, 404, { error: '찾을 수 없습니다.' });
  } catch {
    return json(res, 503, { error: '저장소에 연결할 수 없습니다. 잠시 후 다시 시도하세요.' });
  }
}
