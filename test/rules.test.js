import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRules, compilePrompt, createGenerator} from '../js/rules.js';
function matches(ns, r) {
  assert.equal(ns.length, 6); assert.equal(new Set(ns).size,6);
  assert.deepEqual(ns,[...ns].sort((a,b) => a-b));
  assert.ok(ns.every(n => n>=r.min && n<=r.max && !r.exclude.includes(n)));
  assert.ok(r.include.every(n => ns.includes(n)));
  if (r.odd!==null) assert.equal(ns.filter(n=>n%2).length,r.odd);
  if (!r.consecutive) assert.ok(ns.every((n,i)=>!i || n-ns[i-1]>1));
  for (const g of r.groups) assert.equal(ns.filter(n=>n>=g.min && n<=g.max).length,g.count);
}
test('all supported combinations hold for repeated five-game generations', () => {
  const prompts = [
    '무작위', '기본', '홀수 3개, 짝수 3개 / 7 포함 / 1, 2 제외 / 연속번호 제외',
    '홀짝 비율 2:4 / 포함 번호: 8, 12 / 제외 번호: 1, 2 / 번호 범위 5~40',
    '범위 1~30 / 구간 1~10에서 2개 / 11~20에서 2개 / 21~30에서 2개 / 연속번호 금지',
    '홀수 6개 / 범위 1~11', '짝수 6개 / 범위 2~12',
    '1, 3, 5, 7, 9, 11 포함 / 연속번호 제외',
    '1~10에서 0개 / 범위 1~20 / 홀수 3개',
    '범위 1~45 / 1~9에서 1개 / 10~18에서 1개 / 19~27에서 1개 / 28~36에서 1개 / 37~45에서 2개'
  ];
  for (const p of prompts) {
    const {rules,generator}=compilePrompt(p);
    for(let i=0;i<100;i++) for(let game=0;game<5;game++) matches(generator.pick(),rules);
  }
});
test('unsupported prose and conflicts cannot silently become random rules', () => {
  for (const p of ['', '행운이 많은 번호', '7 포함 / 당첨 확률 높게', '홀수 3개 짝수 2개',
    '홀수 7개', '46 포함', '0 제외', '1 포함 / 1 제외', '범위 10~1',
    '범위 2~30 / 1 포함', '1,2,3,4,5,6,7 포함', '1,2 포함 / 연속번호 제외',
    '범위 1~5', '범위 1~6 / 홀수 6개', '구간 1~10에서 4개 / 구간 11~20에서 4개',
    '1~10에서 1개 / 5~15에서 2개', '홀수 2개 / 홀수 4개', '연속번호 허용 / 연속번호 제외',
    '홀짝 3:3 / 홀수 2개', '1 포함 / 2.5 제외', '1 포함 / -3 제외',
    '범위 1~10 / 20~30에서 1개']) assert.throws(()=>compilePrompt(p),undefined,p);
});
test('exact counts agree with independent brute force on a small pool', () => {
  for (const prompt of ['범위 1~12','범위 1~12 / 연속번호 제외','범위 1~12 / 홀수 4개 / 3 포함','범위 1~12 / 1~5에서 2개 / 9 제외']) {
    const {rules,generator}=compilePrompt(prompt); let total=0;
    function visit(ns,start) {
      if(ns.length===6) { try {matches(ns,rules); total++;}catch{} return; }
      for(let n=start;n<=12;n++) visit([...ns,n],n+1);
    }
    visit([],1); assert.equal(generator.total,total,prompt);
  }
});
test('full pool has C(45,6) combinations and boundary randomness is valid', () => {
  const r=parseRules('무작위'); assert.equal(createGenerator(r).total,8145060);
  matches(createGenerator(r,()=>0).pick(),r);
  matches(createGenerator(r,()=>0.999999999).pick(),r);
});
test('a single feasible combination remains generatable', () => {
 const {generator}=compilePrompt('범위 1~11 / 연속번호 제외');
 assert.equal(generator.total,1); assert.deepEqual(generator.pick(),[1,3,5,7,9,11]);
});
