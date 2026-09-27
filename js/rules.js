export const RULE_HELP = '후보 번호: 3, 8, 12, 17, 22, 29, 34, 41 → 이 번호 안에서만 선택합니다. 예: 홀수 3개, 짝수 3개 / 7 포함 / 1, 2 제외 / 범위 1~40 / 구간 1~10에서 2개 / 연속번호 제외. 조건은 줄바꿈 또는 /로 구분하세요. 제한 없이 생성하려면 기본 또는 무작위를 입력하세요.';
const fail = message => { throw new Error(message); };
const number = value => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 45) fail('번호는 1~45의 정수여야 합니다.');
  return n;
};
const count = value => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) fail('개수는 0~6이어야 합니다.');
  return n;
};
export function parseRules(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) fail('프롬프트를 입력하세요.');
  if (prompt.length > 2000) fail('프롬프트는 2,000자 이내로 입력하세요.');
  const rules = { include: [], exclude: [], candidates: null, min: 1, max: 45, odd: null, consecutive: true, groups: [] };
  let rest = prompt.normalize('NFKC').trim();
  if (/^(기본|무작위)$/.test(rest)) return rules;
  // Exact legacy template already stored by this project; no numeric guessing.
  rest = rest.replace(/^1부터\s*45까지의\s*숫자\s*중\s*중복\s*없이\s*6개의\s*번호를\s*선택하여\s*5게임을\s*생성한다\.\s*/, '');
  rest = rest.replace(/모든\s*게임에\s*(\d+)번을\s*반드시\s*포함한다\./g, '$1 포함 /');
  const seen = new Set();
  function once(key) { if (seen.has(key)) fail('같은 종류의 조건을 여러 번 지정할 수 없습니다: ' + key); seen.add(key); }
  function consume(regex, apply) { rest = rest.replace(regex, (...args) => { apply(...args); return ' '; }); }
  consume(/후보\s*(?:번호)?\s*:\s*(\d+(?:\s*,\s*\d+)*)/g, (_, list) => {
    once('후보 번호');
    rules.candidates = [...new Set(list.split(/\s*,\s*/).map(number))].sort((a,b) => a-b);
    if (rules.candidates.length < 6) fail('후보 번호는 서로 다른 숫자 6개 이상 선택하세요.');
  });
  consume(/(?:구간\s*)?(\d+)\s*[~–-]\s*(\d+)\s*(?:구간\s*)?(?:에서|중|:)\s*(\d+)\s*개/g, (_, a, b, c) => {
    const group = { min: number(a), max: number(b), count: count(c) };
    if (group.min > group.max) fail('구간의 시작은 끝보다 작거나 같아야 합니다.');
    if (rules.groups.some(g => g.min <= group.max && group.min <= g.max)) fail('번호 구간은 서로 겹치지 않게 입력하세요.');
    rules.groups.push(group);
    if (rules.groups.length > 5) fail('구간은 최대 5개까지 지정할 수 있습니다.');
  });
  consume(/(?:번호\s*)?범위\s*:?\s*(\d+)\s*[~–-]\s*(\d+)/g, (_, a, b) => {
    once('범위'); rules.min = number(a); rules.max = number(b);
    if (rules.min > rules.max) fail('범위의 시작은 끝보다 작거나 같아야 합니다.');
  });
  consume(/홀짝\s*(?:비율)?\s*:?\s*(\d+)\s*:\s*(\d+)/g, (_, a, b) => {
    once('홀짝'); rules.odd = count(a); if (rules.odd + count(b) !== 6) fail('홀수와 짝수의 합은 6개여야 합니다.');
  });
  let odd = null, even = null;
  consume(/(홀수|짝수)\s*:?\s*(\d+)\s*개/g, (_, kind, n) => {
    once(kind); if (kind === '홀수') odd = count(n); else even = count(n);
  });
  if (odd !== null || even !== null) {
    if (seen.has('홀짝')) fail('홀짝 조건은 한 가지 형식으로 입력하세요.');
    if (odd !== null && even !== null && odd + even !== 6) fail('홀수와 짝수의 합은 6개여야 합니다.');
    rules.odd = odd ?? (6 - even);
  }
  consume(/연속\s*번호\s*(허용|불허|금지|제외|불가)/g, (_, mode) => { once('연속번호'); rules.consecutive = mode === '허용'; });
  const add = (mode, list) => { rules[mode === '포함' ? 'include' : 'exclude'].push(...list.split(/\s*,\s*/).map(number)); };
  consume(/(포함|제외)\s*(?:번호)?\s*:\s*(\d+(?:\s*,\s*\d+)*)/g, (_, mode, list) => add(mode, list));
  consume(/(\d+(?:\s*,\s*\d+)*)\s*(?:번(?:호)?)?\s*(포함|제외)/g, (_, list, mode) => add(mode, list));
  rest = rest.replace(/[\s/,;。]+/g, '');
  if (rest) fail('지원하지 않는 표현: ' + rest.slice(0, 100) + '. ' + RULE_HELP);
  rules.include = [...new Set(rules.include)].sort((a,b) => a-b);
  rules.exclude = [...new Set(rules.exclude)].sort((a,b) => a-b);
  if (rules.include.length > 6) fail('포함 번호는 최대 6개입니다.');
  if (rules.include.some(n => rules.exclude.includes(n) || (rules.candidates && !rules.candidates.includes(n)) || n < rules.min || n > rules.max)) fail('포함 번호가 후보 번호·제외 번호 또는 번호 범위와 충돌합니다.');
  return rules;
}

// Count valid combinations, then sample by branch weight. No retry limit or
// silent fallback: even a single possible combination is found deterministically.
export function createGenerator(rules, random = Math.random) {
  const required = new Set(rules.include), excluded = new Set(rules.exclude);
  const pool = Array.from({length: rules.max - rules.min + 1}, (_, i) => rules.min + i).filter(n => !excluded.has(n) && (!rules.candidates || rules.candidates.includes(n)));
  const groups = rules.groups;
  const membership = pool.map(n => groups.findIndex(g => n >= g.min && n <= g.max));
  const suffixRequired = Array(pool.length + 1).fill(0);
  for (let i = pool.length - 1; i >= 0; i--) suffixRequired[i] = suffixRequired[i+1] + Number(required.has(pool[i]));
  const memo = new Map();
  const initial = [0, 0, 0, 0, groups.map(() => 0)];
  function branches([i, picked, odds, previous, counts]) {
    const n = pool[i], group = membership[i];
    const skip = required.has(n) ? null : [i+1, picked, odds, 0, counts];
    const nextCounts = counts.slice();
    if (group >= 0) nextCounts[group]++;
    const take = !rules.consecutive && previous && pool[i-1] + 1 === n ? null : [i+1, picked+1, odds+n%2, 1, nextCounts];
    return {skip, take};
  }
  function ways(state) {
    if (!state) return 0;
    const [i, picked, odds, previous, counts] = state;
    if (picked > 6 || picked + pool.length-i < 6 || suffixRequired[i] > 6-picked) return 0;
    if (rules.odd !== null && (odds > rules.odd || picked-odds > 6-rules.odd)) return 0;
    if (counts.some((c,j) => c > groups[j].count)) return 0;
    if (i === pool.length) return Number(picked === 6 && (rules.odd === null || odds === rules.odd) && counts.every((c,j) => c === groups[j].count));
    const key = [i,picked,rules.odd === null ? 0 : odds,rules.consecutive ? 0 : previous,...counts].join(',');
    if (memo.has(key)) return memo.get(key);
    const {skip,take} = branches(state);
    const total = ways(skip) + ways(take);
    memo.set(key,total); return total;
  }
  const total = ways(initial);
  if (!total) fail('이 조건을 모두 만족하는 6개 번호 조합이 없습니다. 포함·제외, 홀짝, 범위·구간, 연속번호 조건을 확인하세요.');
  return { total, pick() {
    let state = initial; const result = [];
    while (state[0] < pool.length) {
      const {skip,take} = branches(state), takeWays = ways(take), skipWays = ways(skip);
      if (takeWays && random() * (takeWays + skipWays) < takeWays) { result.push(pool[state[0]]); state = take; }
      else state = skip;
    }
    return result;
  }};
}
export function compilePrompt(prompt) { const rules = parseRules(prompt); return {rules, generator: createGenerator(rules)}; }
