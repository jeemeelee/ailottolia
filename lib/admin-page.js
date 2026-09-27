const style = `
*{box-sizing:border-box}body{margin:0;background:#f5f8ff;color:#14213d;font:16px/1.6 system-ui,sans-serif}main{max-width:960px;margin:48px auto;padding:0 24px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}h1{font-size:28px}h2{font-size:19px;margin-top:0}.brand{color:#1668f2;font-weight:800;letter-spacing:2px}.muted{color:#61718c;font-size:14px}section{background:white;border:1px solid #e4ebf7;border-radius:18px;padding:24px;margin:24px 0}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.cards section{margin:0}.number{display:block;font-size:32px;font-weight:750}button{background:#1668f2;color:white;border:0;border-radius:9px;padding:12px 20px;font:inherit;cursor:pointer}button:disabled{opacity:.5}input,textarea{display:block;width:100%;padding:12px;border:1px solid #9aa6ba;border-radius:8px;font:inherit;margin:8px 0 16px}textarea{min-height:180px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e4ebf7;padding:10px 4px}.scroll{overflow:auto}#message{min-height:26px;color:#a22}#login{max-width:440px;margin:64px auto}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #80adff;outline-offset:3px}@media(max-width:620px){.cards{grid-template-columns:1fr}header{align-items:flex-start}main{margin:24px auto;padding:0 16px}}
`;
const common = `
const message=document.getElementById('message');
async function api(action,data){
 const r=await fetch('/api/admin?action='+action,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});
 const value=await r.json();
 if(!r.ok){if(r.status===401&&action!=='login')location.replace('/admin');throw new Error(value.error||'요청 실패');}return value;
}
`;
const dashboard = `
<header><div><div class="brand">AILOTTOLIA</div><h1>관리자 대시보드</h1></div><button id="logout">로그아웃</button></header>
<p class="muted">최근 7일 · UTC 기준 · 통계 수집은 배포 및 저장소 연결 후 시작됩니다.</p>
<div class="cards"><section>오늘 방문자 수<strong id="visitors" class="number">—</strong></section><section>오늘 페이지 조회<strong id="pageviews" class="number">—</strong></section><section>오늘 번호 생성<strong id="generations" class="number">—</strong></section></div>
<p id="message" role="status" aria-live="polite"></p><button id="refresh">통계 새로고침</button>
<section><h2>일별 통계</h2><div class="scroll"><table><thead><tr><th>날짜 (UTC)</th><th>방문자</th><th>페이지 조회</th><th>번호 생성</th></tr></thead><tbody id="daily"></tbody></table></div></section>
<section><h2>접속 국가 / 지역 · 최근 7일</h2><p class="muted">국가·지역 코드 기준이며 일별 방문자 수의 합계입니다. 같은 사람이 여러 날 방문하면 중복 집계됩니다.</p><table><thead><tr><th>국가 / 지역</th><th>방문자 합계</th></tr></thead><tbody id="geo"></tbody></table></section>
<section><h2>Vercel Analytics · 최근 7일</h2><p id="analyticsStatus" class="muted" role="status">통계를 불러오는 중입니다.</p><div class="scroll"><table><thead><tr><th>날짜 (UTC)</th><th>방문자</th><th>페이지 조회</th></tr></thead><tbody id="analyticsDays"></tbody></table></div><p class="muted">공개 첫 페이지 기준입니다. 위 자체 집계와 측정 방식이 달라 숫자가 다를 수 있습니다.</p></section>
<section><h2>이번 주 프롬프트 / 설정</h2><p class="muted">향후 AI 연동용 관리 설정입니다. 현재 무작위 번호 생성에는 적용되지 않습니다. 저장 즉시 관리 설정이 갱신되며 자동 주간 예약 기능은 없습니다.</p><form id="promptForm"><label for="prompt">프롬프트 내용 (최대 4,000자)</label><textarea id="prompt" maxlength="4000" required></textarea><p id="updated" class="muted"></p><button id="save" disabled>프롬프트 저장</button></form></section>
<p class="muted">방문자는 브라우저별 일일 고유 식별자 기준입니다. 저장소 차단·기기 변경·봇·광고 차단으로 실제 인원과 다를 수 있습니다. 번호 생성 1회는 버튼 클릭 1회(5게임)입니다. 국가·지역은 IP 기반 추정이며 원본 IP는 저장하지 않습니다.</p>
`;
const dashboardScript = `
function row(target,values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}target.append(tr);}
let promptLoaded=false;
async function load(){
 message.textContent='';document.getElementById('refresh').disabled=true;
 try{const data=await api('stats');const today=data.days.find(d=>d.date===data.today)?.values||{};
 for(const name of ['visitors','pageviews','generations'])document.getElementById(name).textContent=(today[name]||0).toLocaleString();
 const daily=document.getElementById('daily'),geo=document.getElementById('geo');daily.replaceChildren();geo.replaceChildren();const places={};
 for(const d of data.days){row(daily,[d.date,d.values.visitors||0,d.values.pageviews||0,d.values.generations||0]);for(const [k,v]of Object.entries(d.values))if(k.startsWith('geo:'))places[k.slice(4)]=(places[k.slice(4)]||0)+v;}
 for(const [place,n]of Object.entries(places).sort((a,b)=>b[1]-a[1]))row(geo,[place,n]);if(!Object.keys(places).length)row(geo,['아직 수집된 데이터가 없습니다.','—']);
 if(!promptLoaded){document.getElementById('prompt').value=data.prompt?.text||'';document.getElementById('updated').textContent=data.prompt?'최근 저장: '+data.prompt.updatedAt:'저장된 프롬프트가 없습니다.';promptLoaded=true;document.getElementById('save').disabled=false;}
 }catch(e){message.textContent=e.message;}finally{document.getElementById('refresh').disabled=false;}
}
async function loadAnalytics(){const status=document.getElementById('analyticsStatus');status.textContent='통계를 불러오는 중입니다.';try{const data=await api('analytics');const target=document.getElementById('analyticsDays');target.replaceChildren();status.textContent=data.status==='ready'?(data.days.length?'Vercel에서 조회한 방문 통계입니다.':'아직 수집된 데이터가 없습니다.'):data.status==='unconfigured'?'Vercel Analytics 연결 전입니다. 배포 안내에 따라 연결하면 표시됩니다.':'통계를 불러올 수 없습니다. 잠시 후 새로고침하세요.';for(const d of data.days)row(target,[d.date,d.visitors,d.pageviews]);}catch(e){status.textContent=e.message;}}
document.getElementById('refresh').onclick=()=>{load();loadAnalytics();};
document.getElementById('logout').onclick=async()=>{try{await api('logout',{});location.replace('/admin');}catch(e){message.textContent=e.message;}};
document.getElementById('promptForm').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('save');button.disabled=true;try{const data=await api('prompt',{text:document.getElementById('prompt').value});document.getElementById('updated').textContent='최근 저장: '+data.prompt.updatedAt;message.textContent='프롬프트를 저장했습니다.';}catch(e){message.textContent=e.message;}finally{button.disabled=false;}};
load();loadAnalytics();
`;
export function page(authorized, nonce) {
  const login = `<section id="login"><div class="brand">AILOTTOLIA</div><h1>관리자 로그인</h1><form id="loginForm"><label for="password">관리자 비밀번호</label><input id="password" type="password" autocomplete="current-password" required maxlength="1024"><button id="submit">로그인</button></form><p id="message" role="status" aria-live="polite"></p></section>`;
  const loginScript = `document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('submit');button.disabled=true;message.textContent='';try{await api('login',{password:document.getElementById('password').value});location.replace('/admin');}catch(e){message.textContent=e.message;}finally{button.disabled=false;}};`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AILOTTOLIA 관리자</title><style nonce="${nonce}">${style}</style></head><body><main>${authorized ? dashboard : login}</main><script nonce="${nonce}">${common}${authorized ? dashboardScript : loginScript}</script></body></html>`;
}
