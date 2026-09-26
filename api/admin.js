import { ADMIN_ID, accessToken, cookie, sameOrigin, supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  const action = new URL(req.url, 'https://local.invalid').searchParams.get('action') || 'session';
  if (!['session', 'prompts', 'login', 'logout'].includes(action)) return send(404, { error: '찾을 수 없는 요청입니다.' });
  const method = ['login', 'logout'].includes(action) ? 'POST' : 'GET';
  if (req.method !== method) { res.setHeader('Allow', method); return send(405, { error: '허용되지 않는 요청입니다.' }); }
  if (method === 'POST' && !sameOrigin(req)) return send(403, { error: '허용되지 않는 출처입니다.' });
  try {
    if (action === 'logout') {
      // Always clear the local cookie, including when the upstream session expired.
      res.setHeader('Set-Cookie', cookie());
      const token = accessToken(req);
      if (token) {
        const result = await supabase('/auth/v1/logout?scope=local', { token, method: 'POST' });
        if (!result.ok && ![401, 403, 404].includes(result.status)) return send(503, { error: '이 브라우저에서는 로그아웃되었습니다. 인증 서버의 세션 종료는 확인하지 못했습니다.' });
      }
      return send(200, { ok: true });
    }
    if (action === 'login') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error: '잘못된 요청 형식입니다.' });
      let data;
      try { data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return send(400, { error: '잘못된 요청입니다.' }); }
      if (!data || typeof data.email !== 'string' || !data.email.trim() || data.email.length > 254 || typeof data.password !== 'string' || !data.password || data.password.length > 1024) return send(400, { error: '이메일과 비밀번호를 확인해 주세요.' });
      const result = await supabase('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: data.email.trim(), password: data.password } });
      if (result.status === 429) return send(429, { error: '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.' });
      if (!result.ok) return send(result.status >= 500 ? 503 : 401, { error: result.status >= 500 ? '인증 서버에 연결할 수 없습니다.' : '이메일 또는 비밀번호를 확인해 주세요.' });
      const session = await result.json();
      if (session.user?.id !== ADMIN_ID) return send(403, { error: '관리자 계정만 로그인할 수 있습니다.' });
      if (typeof session.access_token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session.access_token) || !Number.isFinite(session.expires_in) || session.expires_in <= 0) throw new Error('Invalid auth response');
      // Deliberately no persistent refresh token: sign in again after at most one hour.
      res.setHeader('Set-Cookie', cookie(session.access_token, Math.min(3600, Math.floor(session.expires_in))));
      return send(200, { ok: true });
    }
    const token = accessToken(req);
    if (!token) return send(401, { error: '관리자 로그인이 필요합니다.' });
    // Verify with Supabase on every request; never trust a client-provided user ID.
    const result = await supabase('/auth/v1/user', { token });
    if (!result.ok) {
      if ([401, 403].includes(result.status)) { res.setHeader('Set-Cookie', cookie()); return send(401, { error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }); }
      return send(503, { error: '인증 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.' });
    }
    const user = await result.json();
    if (user.id !== ADMIN_ID) { res.setHeader('Set-Cookie', cookie()); return send(403, { error: '관리자 권한이 없습니다.' }); }
    if (action === 'session') return send(200, { email: user.email });
    const prompts = await supabase('/rest/v1/weekly_prompts?select=id,created_at,prompt,is_active&order=created_at.desc,id.desc&limit=20', { token });
    if (!prompts.ok) return send(503, { error: '프롬프트를 불러오지 못했습니다. 다시 시도해 주세요.' });
    return send(200, { prompts: await prompts.json() });
  } catch {
    return send(503, { error: '연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
