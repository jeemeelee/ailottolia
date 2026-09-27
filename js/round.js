// User-defined schedule: 1244 now, 1245 from October 3, 2026, 10:00 KST.
const FIRST_CHANGE = Date.parse('2026-10-03T10:00:00+09:00');
const WEEK = 7 * 24 * 60 * 60 * 1000;
export function getRound(now = Date.now()) {
  return now < FIRST_CHANGE ? 1244 : 1245 + Math.floor((now - FIRST_CHANGE) / WEEK);
}
export function nextChange(now = Date.now()) {
  return now < FIRST_CHANGE ? FIRST_CHANGE : FIRST_CHANGE + (Math.floor((now - FIRST_CHANGE) / WEEK) + 1) * WEEK;
}
export function startRoundDisplay(element, {
  now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  page = document, view = window
} = {}) {
  let timer;
  function refresh() {
    cancel(timer);
    const time = now();
    element.textContent = getRound(time) + '회차';
    // Recheck the clock at least every minute, and exactly at the rollover.
    timer = schedule(refresh, Math.max(1, Math.min(60000, nextChange(time) - time)));
  }
  page.addEventListener('visibilitychange', refresh);
  view.addEventListener('pageshow', refresh);
  view.addEventListener('focus', refresh);
  refresh();
  return () => {
    cancel(timer);
    page.removeEventListener('visibilitychange', refresh);
    view.removeEventListener('pageshow', refresh);
    view.removeEventListener('focus', refresh);
  };
}
if (typeof document !== 'undefined') {
  const element = document.getElementById('lottoRound');
  if (element) startRoundDisplay(element);
}
