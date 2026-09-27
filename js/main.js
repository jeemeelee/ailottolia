import {loadActivePrompt} from './db.js';
import {compilePrompt} from './rules.js';
const btn = document.getElementById('generateBtn');
const games = document.getElementById('games');
const ph = document.getElementById('placeholder');
const status = document.getElementById('ruleStatus');
function cls(n) { return n <= 10 ? 'yellow' : n <= 20 ? 'blue' : n <= 30 ? 'red' : n <= 40 ? 'gray' : 'green'; }
btn.onclick = async () => {
  btn.disabled = true;
  btn.textContent = '규칙 확인 중…';
  games.hidden = true;
  ph.style.display = '';
  ph.textContent = '최신 규칙으로 번호를 생성하고 있습니다.';
  status.textContent = '';
  try {
    const active = await loadActivePrompt();
    let generator;
    try { ({generator} = compilePrompt(active.prompt)); }
    catch { throw new Error('관리자 규칙을 확인해야 합니다. 잠시 후 다시 이용해주세요.'); }
    const results = Array.from({length: 5}, () => generator.pick());
    games.innerHTML = results.map((numbers, i) => `<div class="game"><div class="game-label">GAME ${i+1}</div><div class="balls">${numbers.map(n => `<span class="ball ${cls(n)}">${n}</span>`).join('')}</div></div>`).join('');
    status.textContent = '적용 규칙: ' + active.prompt;
    games.hidden = false;
    ph.style.display = 'none';
  } catch (error) {
    games.replaceChildren();
    ph.textContent = error.message;
  } finally { btn.disabled = false; btn.textContent = '다시 생성하기'; }
};
