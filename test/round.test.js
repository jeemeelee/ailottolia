import test from 'node:test';
import assert from 'node:assert/strict';
import {getRound, nextChange, startRoundDisplay} from '../js/round.js';
test('Korean Saturday boundary and subsequent weeks', () => {
  for (const [date, expected] of [
    ['2026-09-27T19:00:00+09:00',1244],
    ['2026-10-03T09:59:59.999+09:00',1244],
    ['2026-10-03T10:00:00+09:00',1245],
    ['2026-10-10T09:59:59.999+09:00',1245],
    ['2026-10-10T10:00:00+09:00',1246],
    ['2027-01-02T10:00:00+09:00',1258],
    ['2026-10-03T01:00:00Z',1245]
  ]) assert.equal(getRound(Date.parse(date)),expected,date);
  assert.equal(nextChange(Date.parse('2026-10-03T01:00:00Z')),Date.parse('2026-10-10T01:00:00Z'));
});
test('open page rolls over and catches up after sleep without reload', () => {
  let clock=Date.parse('2026-10-03T09:59:59.999+09:00'), callback, delay;
  const listeners=new Map();
  const events={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const element={textContent:''};
  const stop=startRoundDisplay(element,{now:()=>clock,schedule:(fn,ms)=>{callback=fn;delay=ms;return 1;},cancel:()=>{},page:events,view:events});
  assert.equal(element.textContent,'1244회차'); assert.equal(delay,1);
  clock++; callback(); assert.equal(element.textContent,'1245회차');
  clock=Date.parse('2026-10-17T10:00:00+09:00');
  listeners.get('visibilitychange')(); assert.equal(element.textContent,'1247회차');
  stop(); assert.equal(listeners.size,0);
});
