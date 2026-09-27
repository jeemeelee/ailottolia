const URL = 'https://zhrpuxumusbfleuaugzh.supabase.co';
const KEY = 'sb_publishable_CbbBb4fxUtRg3u1SR8vEnA_ku-gLdQ1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') {res.setHeader('Allow','POST'); return res.status(405).json({error:'Method not allowed'});}
  if(req.headers.origin !== 'https://ailottolia.vercel.app') return res.status(403).json({error:'Origin not allowed'});
  if(/bot|crawler|spider|headless/i.test(req.headers['user-agent'] || '')) return res.status(204).end();
  let body;
  try {body=typeof req.body==='string'?JSON.parse(req.body):req.body;} catch {return res.status(400).json({error:'Invalid JSON'});}
  if(!body || !UUID.test(body.visitorId) || !UUID.test(body.eventId) || !['visit','generate'].includes(body.type)) return res.status(400).json({error:'Invalid event'});
  const rawCountry=req.headers['x-vercel-ip-country'];
  const country=typeof rawCountry==='string' && /^[A-Z]{2}$/.test(rawCountry)?rawCountry:'ZZ';
  try {
    const result=await fetch(URL+'/rest/v1/rpc/record_site_event',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_visitor:body.visitorId,p_event:body.eventId,p_kind:body.type,p_country:country}),signal:AbortSignal.timeout(8000)});
    if(!result.ok) return res.status(503).json({error:'Statistics unavailable'});
    return res.status(204).end();
  } catch {return res.status(503).json({error:'Statistics unavailable'});}
}
