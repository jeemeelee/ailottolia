// Public project configuration, not a service-role key. Database access uses RLS.
export const SUPABASE_URL = 'https://zhrpuxumusbfleuaugzh.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_CbbBb4fxUtRg3u1SR8vEnA_ku-gLdQ1';
// Matches the existing weekly_prompts administrator RLS policy.
export const ADMIN_ID = 'da35993a-59ea-4012-a620-6e1fba1b6cd9';
export const COOKIE = '__Host-ailottolia-admin';
export function cookie(value = '', maxAge = 0) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export function accessToken(req) {
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return token && token.length < 6000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : null;
}
export async function supabase(path, { token, method = 'GET', body } = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { apikey: PUBLISHABLE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store'
  });
}
export function sameOrigin(req) {
  const allowed = ['https://ailottolia.vercel.app'];
  if (process.env.VERCEL_URL) allowed.push(`https://${process.env.VERCEL_URL}`);
  return allowed.includes(req.headers.origin);
}
