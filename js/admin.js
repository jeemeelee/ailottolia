import {db, loadActivePrompt} from './db.js';
import {compilePrompt, parseRules, RULE_HELP} from './rules.js';
const el = id => document.getElementById(id);
const save = el('saveBtn');
let admin = false;
el('ruleHelp').textContent = RULE_HELP;
function feedback(message, error = false) { el('success').textContent = message; el('success').style.color = error ? '#c62828' : '#16833b'; }
async function checkSession() {
  const {data, error} = await db.auth.getUser();
  admin = false;
  if (!error && data.user) {
    const result = await db.rpc('is_prompt_admin');
    if (result.error) el('error').textContent = '관리자 권한을 확인하지 못했습니다. 데이터베이스 설정을 확인하세요.';
    else if (result.data !== true) el('error').textContent = '이 계정에는 관리자 저장 권한이 없습니다.';
    else admin = true;
  }
  el('login').style.display = admin ? 'none' : 'block';
  el('dashboard').style.display = admin ? 'block' : 'none';
  el('logoutBtn').hidden = !admin;
  save.disabled = !admin;
  if (admin) {
    loadStats();
    try { const active = await loadActivePrompt(); el('prompt').value = active.prompt; syncCandidates(); preview(); }
    catch (error) { feedback(error.message, true); }
  }
}
function preview() {
  el('groupSummary').textContent = '';
  try {
    const {rules,generator} = compilePrompt(el('prompt').value);
    if (rules.namedGroups.length) {
      el('groupSummary').textContent = '해석한 그룹 조건\n' + rules.namedGroups.map(g => g.name + ' 그룹: [' + g.numbers.join(', ') + ']에서 ' + g.count + '개').join('\n') + '\n합계 6개 · 매 게임 중복 없음 · 5게임 생성\n겹치는 번호는 한 그룹에만 배정합니다.';
      feedback('조건 확인 완료. 위의 해석이 맞는지 확인한 뒤 저장하세요.');
    } else feedback('조건 확인 완료 · 가능한 조합 ' + generator.total.toLocaleString('ko-KR') + '개. 각 게임에 모두 적용됩니다.');
    return true;
  } catch (error) { feedback(error.message, true); return false; }
}
const candidateInputs = Array.from({length:45}, (_, i) => {
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:4px;background:#f5f8ff;border-radius:8px;cursor:pointer';
  const input = document.createElement('input'); input.type = 'checkbox'; input.value = String(i+1);
  input.setAttribute('aria-label', '후보 ' + (i+1) + '번'); input.style.cssText = 'width:auto;margin:0 0 4px;accent-color:#1668f2';
  input.addEventListener('change', candidateCount);
  label.append(input, document.createTextNode(String(i+1))); el('candidateNumbers').append(label); return input;
});
function candidateCount() {
  const n = candidateInputs.filter(input => input.checked).length;
  el('candidateCount').textContent = n + '개 선택 · 프롬프트에 반영한 뒤 저장하세요.';
}
function syncCandidates() {
  try { const r = parseRules(el('prompt').value); candidateInputs.forEach(input => { input.checked = r.candidates?.includes(Number(input.value)) ?? false; }); candidateCount(); } catch {}
}
el('clearCandidates').onclick = () => { candidateInputs.forEach(input => {input.checked=false;}); candidateCount(); };
el('applyCandidates').onclick = () => {
  const numbers = candidateInputs.filter(input => input.checked).map(input => Number(input.value));
  if (numbers.length && numbers.length < 6) { feedback('후보 번호는 서로 다른 숫자 6개 이상 선택하세요.', true); return; }
  let prompt = el('prompt').value.normalize('NFKC').trim();
  try { if (prompt) parseRules(prompt); } catch (error) { feedback(error.message, true); return; }
  prompt = prompt.replace(/후보\s*(?:번호)?\s*:\s*\d+(?:\s*,\s*\d+)*/g, '').replace(/^[\s/,;]+|[\s/,;]+$/g, '');
  if (/^(기본|무작위)$/.test(prompt)) prompt = '';
  el('prompt').value = [prompt, numbers.length ? '후보 번호: ' + numbers.join(', ') : ''].filter(Boolean).join(' / ') || '무작위';
  preview();
};
candidateCount();
el('prompt').addEventListener('input', () => { syncCandidates(); preview(); });
window.login = async () => {
  el('error').textContent = '';
  const {error} = await db.auth.signInWithPassword({email: el('email').value.trim(), password: el('password').value});
  el('password').value = '';
  if (error) { el('error').textContent = '로그인 실패: 이메일 또는 비밀번호를 확인하세요.'; return; }
  await checkSession();
};
window.logout = async () => {
  await db.auth.signOut(); admin = false;
  el('logoutBtn').hidden = true; el('dashboard').style.display = 'none'; el('login').style.display = 'block'; save.disabled = true;
};
window.resetPassword = async () => {
  const email = el('email').value.trim();
  if (!email) { el('error').textContent = '이메일을 입력해주세요.'; return; }
  const {error} = await db.auth.resetPasswordForEmail(email, {redirectTo: location.origin + '/admin'});
  el('error').textContent = error ? '재설정 메일 발송에 실패했습니다.' : '비밀번호 재설정 메일을 보냈습니다.';
};
window.savePrompt = async () => {
  if (!admin || save.disabled || !preview()) return;
  const prompt = el('prompt').value.trim();
  save.disabled = true; el('candidatePicker').disabled = true; el('prompt').disabled = true; feedback('저장 중…');
  try {
    // One database transaction switches the active record. A failed write leaves
    // the previous rule intact; concurrent saves are serialized by the RPC.
    const {error} = await db.rpc('save_weekly_prompt', {new_prompt: prompt}).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error('저장하지 못했습니다. 관리자 권한과 연결 상태를 확인한 뒤 다시 시도하세요.');
    const active = await loadActivePrompt();
    if (active.prompt !== prompt) throw new Error('다른 관리자가 규칙을 변경했습니다. 새로고침 후 최신 규칙을 확인하세요.');
    feedback('✓ 새 프롬프트가 저장되고 적용되었습니다.');
  } catch (error) { feedback(error.message, true); }
  finally { el('candidatePicker').disabled = false; save.disabled = !admin; el('prompt').disabled = false; }
};
db.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') { admin = false; el('logoutBtn').hidden = true; el('dashboard').style.display = 'none'; el('login').style.display = 'block'; save.disabled = true; }
  if (event === 'PASSWORD_RECOVERY') { el('recovery').hidden = false; }
});
el('updatePassword').onclick = async () => {
  const password = el('newPassword').value;
  if (password.length < 8) { el('recoveryStatus').textContent = '8자 이상의 비밀번호를 입력하세요.'; return; }
  const {error} = await db.auth.updateUser({password});
  el('recoveryStatus').textContent = error ? '변경하지 못했습니다. 새 재설정 링크로 다시 시도하세요.' : '비밀번호가 변경되었습니다.';
  if (!error) { el('newPassword').value = ''; await checkSession(); }
};
checkSession().catch(() => { el('error').textContent = '연결 상태를 확인하고 다시 시도하세요.'; });

let statsLoading = false;
async function loadStats() {
  if(!admin || statsLoading) return;
  statsLoading=true; el('refreshStats').disabled=true;
  el('statsStatus').textContent='통계 불러오는 중…';
  try {
    const {data,error}=await db.rpc('get_site_statistics').abortSignal(AbortSignal.timeout(12000));
    if(error || !data) throw new Error('통계를 불러오지 못했습니다. 잠시 후 새로고침해주세요.');
    if(!admin) return;
    [['statToday','today'],['statWeek','week'],['statTotal','total'],['statGenerations','generations']].forEach(([id,key])=>{el(id).textContent=Number(data[key]).toLocaleString('ko-KR');});
    const countries=data.countries || {};
    const other=Object.entries(countries).filter(([code])=>!['KR','US','JP','ZZ'].includes(code)).reduce((sum,[,n])=>sum+Number(n),0);
    el('countryStats').replaceChildren();
    for(const [label,n] of [['대한민국',countries.KR||0],['미국',countries.US||0],['일본',countries.JP||0],['기타',other],['미확인',countries.ZZ||0]]) {
      const row=document.createElement('p'); row.textContent=label+'　'+Number(n).toLocaleString('ko-KR'); el('countryStats').append(row);
    }
    const date=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
    el('statsStatus').textContent=(data.started_at?'집계 시작: '+date(data.started_at):'아직 기록된 방문이 없습니다.')+' · 갱신: '+date(data.updated_at);
  } catch(error) {
    if(admin) { ['statToday','statWeek','statTotal','statGenerations'].forEach(id=>{el(id).textContent='—';}); el('countryStats').textContent='통계 연결 오류'; el('statsStatus').textContent=error.message; }
  } finally {statsLoading=false;el('refreshStats').disabled=false;}
}
el('refreshStats').onclick=loadStats;
const refreshVisibleStats = () => { if (document.visibilityState === 'visible') void loadStats(); };
window.addEventListener('focus', refreshVisibleStats);
window.addEventListener('online', refreshVisibleStats);
document.addEventListener('visibilitychange', refreshVisibleStats);
window.addEventListener('storage', event => {
  if (event.key === 'ailottolia_stats_updated_v1') refreshVisibleStats();
});
setInterval(refreshVisibleStats, 10000);
