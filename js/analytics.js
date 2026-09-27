const visitorKey='ailottolia_visitor_v1';
let visitorId;
try {
  visitorId=localStorage.getItem(visitorKey);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId||'')) {
    visitorId=crypto.randomUUID(); localStorage.setItem(visitorKey,visitorId);
  }
} catch {visitorId=crypto.randomUUID();}
export function track(type) {
  const body=JSON.stringify({visitorId,eventId:crypto.randomUUID(),type});
  // Keep failures isolated from number generation. Retry uses the same event ID.
  const send=()=>fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,signal:AbortSignal.timeout(10000)});
  send().then(r=>{if(!r.ok) throw new Error('tracking failed');}).catch(()=>{setTimeout(()=>send().catch(()=>{}),2000);});
}
