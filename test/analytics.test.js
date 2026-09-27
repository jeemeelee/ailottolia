import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/track.js';
const id='55aa55aa-1111-4111-8111-55aa55aa55aa';
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(body){this.body=body;return this;},end(){return this;}};}
test('tracking validates input, uses server country, and handles storage errors',async()=>{
 const original=globalThis.fetch; const calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true};};
 try {
  const req={method:'POST',headers:{origin:'https://ailottolia.vercel.app','user-agent':'Mozilla/5.0','x-vercel-ip-country':'KR'},body:{visitorId:id,eventId:id,type:'generate',country:'US'}};
  let res=response(); await handler(req,res);assert.equal(res.code,204);assert.equal(JSON.parse(calls[0].opts.body).p_country,'KR');
  for(const bad of [{...req,method:'GET'},{...req,headers:{origin:'https://other.example'}},{...req,body:{...req.body,type:'invalid'}},{...req,body:{...req.body,visitorId:'invalid'}}]) {const before=calls.length;res=response();await handler(bad,res);assert.ok(res.code>=400);assert.equal(calls.length,before);}
  res=response();await handler({...req,headers:{...req.headers,'x-vercel-ip-country':undefined}},res);assert.equal(JSON.parse(calls.at(-1).opts.body).p_country,'ZZ');
  const before=calls.length;res=response();await handler({...req,headers:{...req.headers,'user-agent':'Googlebot'}},res);assert.equal(calls.length,before);
  globalThis.fetch=async()=>({ok:false});res=response();await handler(req,res);assert.equal(res.code,503);
  globalThis.fetch=async()=>{throw new Error('private connection info');};res=response();await handler(req,res);assert.equal(res.code,503);assert.equal(res.body.error,'Statistics unavailable');
 } finally {globalThis.fetch=original;}
});
