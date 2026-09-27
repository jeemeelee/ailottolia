(() => {
  // Best effort only: storage/network failures never interrupt number generation.
  let visitorId;
  try {
    visitorId = localStorage.getItem('ailottolia-visitor');
    if (!/^[a-f0-9-]{36}$/i.test(visitorId || '')) {
      visitorId = crypto.randomUUID();
      localStorage.setItem('ailottolia-visitor', visitorId);
    }
  } catch { try { visitorId = crypto.randomUUID(); } catch { return; } }
  function record(type) {
    try {
      fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, visitorId, eventId: crypto.randomUUID() }),
        keepalive: true, credentials: 'omit' }).catch(() => {});
    } catch {}
  }
  record('visit');
  document.getElementById('generateBtn')?.addEventListener('click', () => record('generation'));
})();
