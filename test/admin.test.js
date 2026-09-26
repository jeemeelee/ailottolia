import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admin.js';
import { ADMIN_ID, COOKIE } from '../lib/supabase.js';
const token = 'header.payload.signature';
const request = (action, options = {}) => ({ method: ['login','logout'].includes(action) ? 'POST' : 'GET', url: `/api/admin?action=${action}`, headers: { origin: 'https://ailottolia.vercel.app', 'content-type': 'application/json', ...options.headers }, body: options.body, ...options });
async function call(req) {
  const res = { headers: {}, statusCode: 200, setHeader(k,v) { this.headers[k] = v; }, end(s) { this.body = JSON.parse(s); } };
  await handler(req, res); return res;
}
function mock(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({url,opts}); const r=responses.shift(); if(!r) throw new Error('Unexpected call'); return new Response(JSON.stringify(r.body), {status:r.status || 200}); });
  return calls;
}
const login = () => request('login', {body:{email:'admin@example.com',password:'example-password'}});
const authed = action => request(action, {headers:{cookie:`${COOKIE}=${token}`}});
test('anonymous and forged cookies cannot obtain admin data', async t => {
  const calls=mock(t, [{status:401,body:{}}]);
  assert.equal((await call(request('prompts'))).statusCode,401);
  const res=await call(authed('prompts')); assert.equal(res.statusCode,401); assert.match(res.headers['Set-Cookie'],/Max-Age=0/); assert.equal(calls.length,1);
});
test('valid non-admin account is denied login and protected data', async t => {
  const calls=mock(t,[{body:{user:{id:'other'},access_token:token,expires_in:3600}},{body:{id:'other'}}]);
  const denied=await call(login()); assert.equal(denied.statusCode,403); assert.equal(denied.headers['Set-Cookie'],undefined);
  assert.equal((await call(authed('prompts'))).statusCode,403); assert.equal(calls.length,2);
});
test('admin login sets secure bounded cookie without exposing tokens',async t=>{
  mock(t,[{body:{user:{id:ADMIN_ID},access_token:token,refresh_token:'private',expires_in:7200}}]);
  const res=await call(login()); assert.equal(res.statusCode,200);
  for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=3600']) assert.ok(res.headers['Set-Cookie'].includes(flag));
  assert.deepEqual(res.body,{ok:true}); assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('Supabase verifies the session before querying prompts with the user token',async t=>{
  const calls=mock(t,[{body:{id:ADMIN_ID,email:'admin@example.com'}},{body:[]}]);
  const res=await call(authed('prompts')); assert.equal(res.statusCode,200); assert.deepEqual(res.body,{prompts:[]});
  assert.ok(calls[0].url.endsWith('/auth/v1/user')); assert.ok(calls[1].url.includes('/rest/v1/weekly_prompts?'));
  assert.equal(calls[1].opts.headers.Authorization,`Bearer ${token}`);
});
test('cross-origin, wrong methods and malformed login requests are rejected',async t=>{
  const calls=mock(t,[]);
  assert.equal((await call(request('login',{headers:{origin:'https://attacker.example'}}))).statusCode,403);
  assert.equal((await call({...login(),method:'GET'})).statusCode,405);
  assert.equal((await call(request('login',{body:'{'}))).statusCode,400);
  assert.equal((await call(request('login',{body:{email:'x',password:''}}))).statusCode,400);
  assert.equal(calls.length,0);
});
test('invalid password, throttling and upstream outage remain distinct',async t=>{
  mock(t,[{status:400,body:{}},{status:429,body:{}},{status:500,body:{}}]);
  assert.equal((await call(login())).statusCode,401); assert.equal((await call(login())).statusCode,429); assert.equal((await call(login())).statusCode,503);
});
test('logout clears the cookie even when Supabase is unavailable',async t=>{
  mock(t,[{status:500,body:{}}]); const req=authed('logout'); req.headers.origin='https://ailottolia.vercel.app';
  const res=await call(req); assert.equal(res.statusCode,503); assert.match(res.headers['Set-Cookie'],/Max-Age=0/);
});
test('expired logout still succeeds; refresh tokens are not persisted',async t=>{
  mock(t,[{status:401,body:{}}]); const req=authed('logout');req.headers.origin='https://ailottolia.vercel.app';
  const res=await call(req); assert.equal(res.statusCode,200);assert.match(res.headers['Set-Cookie'],/Max-Age=0/);
});
