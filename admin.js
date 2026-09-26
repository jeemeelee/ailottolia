const $ = id => document.getElementById(id);
let generation = 0;
async function api(action, data) {
  const response = await fetch(`/api/admin?action=${action}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || '요청을 처리하지 못했습니다.'); error.status = response.status; throw error; }
  return result;
}
function showLogin(message = '') {
  generation++;
  $('dashboard').hidden = true;
  $('account').textContent = '';
  $('prompts').replaceChildren();
  $('promptStatus').textContent = '';
  $('login').hidden = false;
  $('retry').hidden = true;
  $('status').textContent = message;
}
function message(error) { return error.status ? error.message : '연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.'; }
async function loadPrompts() {
  const current = generation;
  $('reload').disabled = true;
  $('promptStatus').textContent = '프롬프트를 불러오고 있습니다.';
  $('prompts').replaceChildren();
  try {
    const result = await api('prompts');
    if (current !== generation) return;
    $('promptStatus').textContent = result.prompts.length ? '최근 저장된 프롬프트입니다. (최대 20개)' : '아직 저장된 프롬프트가 없습니다.';
    for (const item of result.prompts) {
      const article = document.createElement('article'); article.className = 'prompt';
      const label = document.createElement('p'); label.className = 'badge';
      label.textContent = `${item.is_active ? '활성' : '비활성'} · ${new Date(item.created_at).toLocaleString('ko-KR')}`;
      const text = document.createElement('pre'); text.textContent = item.prompt;
      article.append(label, text); $('prompts').append(article);
    }
  } catch (error) {
    if (current !== generation) return;
    if ([401, 403].includes(error.status)) showLogin(message(error));
    else $('promptStatus').textContent = message(error);
  } finally { $('reload').disabled = false; }
}
async function checkSession() {
  const current = ++generation;
  $('dashboard').hidden = true; $('login').hidden = true; $('retry').hidden = true;
  $('status').textContent = '로그인 상태를 확인하고 있습니다.';
  try {
    const user = await api('session');
    if (current !== generation) return;
    $('account').textContent = user.email;
    $('dashboard').hidden = false; $('status').textContent = '';
    await loadPrompts();
  } catch (error) {
    if (current !== generation) return;
    if ([401, 403].includes(error.status)) showLogin(error.status === 401 ? '' : message(error));
    else { $('status').textContent = message(error); $('retry').hidden = false; }
  }
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('loginButton').disabled = true; $('status').textContent = '로그인 중입니다.';
  const password = $('password').value;
  try { await api('login', { email: $('email').value.trim(), password }); $('password').value = ''; await checkSession(); }
  catch (error) { $('status').textContent = message(error); $('password').value = ''; $('password').focus(); }
  finally { $('loginButton').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  $('logout').disabled = true;
  generation++; $('prompts').replaceChildren();
  try { await api('logout', {}); showLogin('로그아웃되었습니다.'); }
  catch (error) { showLogin(message(error)); $('retry').hidden = false; }
  finally { $('logout').disabled = false; }
});
$('reload').addEventListener('click', loadPrompts);
$('retry').addEventListener('click', checkSession);
window.addEventListener('pageshow', event => { if (event.persisted) checkSession(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('dashboard').hidden) checkSession(); });
checkSession();
