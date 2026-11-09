// Grok Bot desk app. Login (#t=APP_TOKEN, plan A) and data URL (#d=<Pantry basket URL>, plan B) arrive once via the
// fragment, go to localStorage, and are wiped from the address bar. Fragments never reach any server.
(function(){const h=new URLSearchParams(location.hash.slice(1));let hit=false;
 if(h.get('t')){localStorage.setItem('desk_t',h.get('t'));hit=true;}
 if(h.get('d')){localStorage.setItem('desk_d',h.get('d'));hit=true;}
 if(hit)history.replaceState(null,'',location.pathname+location.search);})();
const T=()=>localStorage.getItem('desk_t')||'',D=()=>localStorage.getItem('desk_d')||'';
const PLANB=()=>!!D()&&!T();
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt$=v=>v==null?'—':'$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtK=v=>v==null?'—':v>=1e6?'$'+(v/1e6).toFixed(2)+'M':v>=1e3?'$'+(v/1e3).toFixed(1)+'K':'$'+Number(v).toFixed(0);
const fmtP=v=>{if(v==null)return '—';const a=Math.abs(v);return '$'+(a>=1?v.toFixed(4):a>=0.001?v.toFixed(6):v.toPrecision(4));};
const hm=ts=>new Date(ts*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
let route={tab:'home'},CACHE={},LAST_OK=null,ERR=null,RETRY=5,PB=null,range='LIVE';

// plan B: one GET of the basket at most every 15s (Pantry rate-limits hard), shared by all screens
let PB_AT=0,PB_P=null;
function loadPB(){if(PB&&Date.now()-PB_AT<15000)return Promise.resolve();if(PB_P)return PB_P;
 PB_P=fetch(D(),{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('offline');PB=await r.json();PB_AT=Date.now();})
  .catch(e=>{PB_AT=Date.now()-10000;throw e;}).finally(()=>{PB_P=null;});return PB_P;}
// ---------- data: plan A = /api, plan B = one Pantry JSON with the same shapes ----------
async function api(path,body){
  if(PLANB()){
    if(body)throw new Error('readonly');
    await loadPB();
    const [p,q]=path.split('?');const parts=p.split('/');
    if(p==='state')return PB.state; if(p==='chart')return PB.chart[(new URLSearchParams(q).get('range'))||'LIVE'];
    if(p==='activity')return PB.activity; if(p==='account')return PB.account; if(p==='settings')return PB.settings;
    if(parts[0]==='coin')return PB.coins[parts[1]]||{mint:parts[1],candles:[],stats:{},coin_url:null,missing:true};
    if(parts[0]==='audit')return PB.audits[parts[1]]||{mint:parts[1],layers:null,empty:true};
    if(parts[0]==='agents')return PB.decisions[parts[1]];
    throw new Error('not in plan B');
  }
  const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Authorization':'Bearer '+T(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(r.status===401)throw new Error('auth');
  const j=await r.json();if(!r.ok&&!j.message&&!j.results)throw new Error('offline');return j;}
async function get(path){try{const v=await api(path);CACHE[path]=v;LAST_OK=Date.now();ERR=null;return v;}catch(e){ERR=e.message;if(CACHE[path])return CACHE[path];throw e;}}

// ---------- shared pieces ----------
function nav(){return `<div class="nav"><button class="av" onclick="go({tab:'account'})" aria-label="Account">${esc((CACHE.account?.fomo_handle||'G')[0].toUpperCase())}</button>
 <button class="brand" onclick="go({tab:'home'})">Grok Bot ›</button><span class="sp"></span>
 <button class="ib" onclick="go({tab:'search'})" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button>
 <button class="ib" onclick="bell()" aria-label="Pushes"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/></svg>${(CACHE.state?.unread||0)>0?'<i class="dot"></i>':''}</button></div>`;}
function showErr(){const e=$('#err');if(!ERR||ERR==='auth'&&!PLANB()){e.hidden=!(ERR==='auth');if(ERR==='auth')e.textContent='Open the app once from your link with #t= to log in.';return;}
 e.hidden=false;e.textContent=`Desk offline · retrying in ${RETRY}s · last update ${LAST_OK?new Date(LAST_OK).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'never'}`;}
function odo(val,id){const s=fmt$(val);return `<span class="odo big" id="${id}" data-v="${esc(s)}">${[...s].map(c=>/\d/.test(c)?`<span class="d"><i style="transform:translateY(-${+c}em)">${[...'0123456789'].join('<br>')}</i></span>`:`<span>${c}</span>`).join('')}</span>`;}
function rollOdo(id,val){const el=document.getElementById(id);if(!el)return;const s=fmt$(val);if(el.dataset.v===s)return;
 const old=el.dataset.v;el.dataset.v=s;if(RM||old.length!==s.length){el.outerHTML=odo(val,id);return;}
 const ds=[...el.querySelectorAll('.d i')];let k=0;[...s].filter(c=>/\d/.test(c)).forEach((c,i,arr)=>{});
 const digits=[...s].filter(c=>/\d/.test(c));for(let i=digits.length-1;i>=0;i--){const d=ds[i];if(!d)continue;const y=`translateY(-${+digits[i]}em)`;
  if(d.style.transform!==y){d.style.transitionDelay=(k++*30)+'ms';d.style.transform=y;}}}
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,2200);}
function sk(h,w='100%',m='12px 16px'){return `<div class="sk" style="height:${h}px;width:${w};margin:${m}"></div>`;}
function canvasFit(cv){const dpr=window.devicePixelRatio||1,r=cv.getBoundingClientRect();cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,r.width,r.height];}
function actRow(a){const col=a.title.startsWith('Bought')?'var(--b)':a.title.startsWith('Sold')?'var(--g)':a.title.startsWith('Stopped')?'var(--r)':'var(--s3)';
 const target=a.opens==='auditor'?`{screen:'auditor',mint:'${esc(a.mint)}'}`:`{screen:'coin',mint:'${esc(a.mint)}'}`;
 return `<a class="row" href="#" onclick="go(${target});return false"><span class="ic" style="background:${col}22;color:${col}">${esc(a.title[0])}</span>
 <span class="m"><div class="ti">${esc(a.title)}</div><div class="su">${esc(a.sub)}</div></span>
 <span class="rv ${a.amount?.startsWith('+')?'g':a.amount?.startsWith('-')?'r':'s2'}">${esc(a.amount)}${a.pct?`<small>${esc(a.pct)}</small>`:''}</span></a>`;}

// ---------- charts ----------
function drawLine(cv,ch){const [x,W,H]=canvasFit(cv);x.clearRect(0,0,W,H);if(!ch)return;const pts=ch.points||[];
 const vals=pts.map(p=>p.v).concat([ch.start]);let lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<1e-9){lo-=1;hi+=1;}const pad=(hi-lo)*.15;lo-=pad;hi+=pad;
 const t0=pts.length?pts[0].t:0,t1=pts.length?pts[pts.length-1].t:1,top=54,bot=H-8;const X=t=>t1===t0?W/2:(t-t0)/(t1-t0)*(W-32)+16,Y=v=>bot-(v-lo)/(hi-lo)*(bot-top);
 x.setLineDash([4,6]);x.strokeStyle='rgba(235,235,245,.3)';x.lineWidth=1;x.beginPath();x.moveTo(0,Y(ch.start));x.lineTo(W,Y(ch.start));x.stroke();x.setLineDash([]);
 if(pts.length>1&&!ch.empty){const g=x.createLinearGradient(0,top,0,bot);g.addColorStop(0,'rgba(0,211,90,.35)');g.addColorStop(1,'rgba(0,211,90,0)');
  x.beginPath();pts.forEach((p,i)=>{const px=X(p.t),py=Y(p.v);if(!i)x.moveTo(px,py);else{x.lineTo(px,Y(pts[i-1].v));x.lineTo(px,py);}});
  const path=new Path2D();pts.forEach((p,i)=>{const px=X(p.t),py=Y(p.v);if(!i)path.moveTo(px,py);else{path.lineTo(px,Y(pts[i-1].v));path.lineTo(px,py);}});
  x.lineTo(X(pts[pts.length-1].t),bot);x.lineTo(X(pts[0].t),bot);x.closePath();x.fillStyle=g;x.fill();x.strokeStyle='#00d35a';x.lineWidth=2.5;x.stroke(path);
  const rows=[];x.font='600 12px -apple-system,system-ui';(ch.marks||[]).forEach(m=>{const w=x.measureText(m.text).width+12,px=Math.min(Math.max(X(m.t)-w/2,4),W-w-4);
   let row=0;while((rows[row]||[]).some(([a,b])=>px<b+4&&px+w>a-4))row++;(rows[row]=rows[row]||[]).push([px,px+w]);const py=4+row*24;
   const c=m.color==='blue'?'#0a84ff':m.color==='green'?'#00d35a':'#ff453a';x.fillStyle=c+'33';x.beginPath();x.roundRect(px,py,w,20,10);x.fill();x.fillStyle=c;x.fillText(m.text,px+6,py+14);});}}
function drawCandles(cv,c){const [x,W,H]=canvasFit(cv);x.clearRect(0,0,W,H);const cs=c.candles||[];if(!cs.length){x.fillStyle='rgba(235,235,245,.6)';x.font='15px -apple-system,system-ui,sans-serif';x.fillText('No prices yet',16,H/2);return;}
 const vals=cs.flatMap(k=>[k.h,k.l]);if(c.exit?.line)vals.push(c.exit.line);let lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<=0){hi*=1.01;lo*=.99;}
 const vH=40,cH=H-vH-8,Y=v=>8+(1-(v-lo)/(hi-lo))*(cH-8),n=cs.length,bw=Math.max(2,Math.min(10,(W-32)/n*.7)),X=i=>16+(i+.5)*(W-32)/n,vmax=Math.max(1,...cs.map(k=>k.v));
 cs.forEach((k,i)=>{const up=k.c>=k.o,col=up?'#00d35a':'#ff453a';x.strokeStyle=col;x.fillStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(X(i),Y(k.h));x.lineTo(X(i),Y(k.l));x.stroke();
  const y1=Y(Math.max(k.o,k.c)),y2=Y(Math.min(k.o,k.c));x.fillRect(X(i)-bw/2,y1,bw,Math.max(1,y2-y1));x.globalAlpha=.45;const vh=k.v/vmax*vH;x.fillRect(X(i)-bw/2,H-vh,bw,vh);x.globalAlpha=1;});
 if(c.exit?.line){x.strokeStyle='#ff9f0a';x.setLineDash([8,6]);x.lineWidth=2;x.beginPath();x.moveTo(0,Y(c.exit.line));x.lineTo(W,Y(c.exit.line));x.stroke();x.setLineDash([]);
  x.fillStyle='#ff9f0a';x.font='600 12px -apple-system,system-ui,sans-serif';x.fillText('Risk trailing stop',16,Y(c.exit.line)-6);}}
function drawRing(cv,score){const [x,W,H]=canvasFit(cv);const r=Math.min(W,H)/2-8,cx=W/2,cy=H/2;x.lineWidth=10;x.strokeStyle='#2c2c2e';x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.stroke();
 if(score!=null){x.strokeStyle=score>=70?'#00d35a':'#ffd60a';x.lineCap='round';x.beginPath();x.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*score/100);x.stroke();}
 x.fillStyle='#fff';x.font='700 30px -apple-system,system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(score==null?'—':score,cx,cy);}

// ---------- agent cards ----------
function card(c){let body='';
 if(c.agent==='scanner')body=`<div class="hl" style="color:#64d2ff">${esc(c.headline)}</div><div class="st">${c.feed.length?`${c.waiting} in the waiting room`:'Listening for graduations'}</div>
  <div class="feed">${c.feed.map(f=>f.killed?`<div class="k"><span>${esc(f.name)}</span><b>${esc(f.text)}</b></div>`:`<div><span>${esc(f.name)}</span><span class="g">${esc(f.text)}</span></div>`).join('')}</div>`;
 if(c.agent==='auditor')body=`<div class="hl">${esc(c.headline)}</div><div class="strips">${c.strips.map(s=>`<i class="${!s?'':!s.checked?'':s.pass?'ok':'bad'}"></i>`).join('')}</div>
  <div class="st" style="margin-top:12px">${esc(c.status==='taking apart...'?'taking apart...':c.result||'No coin taken apart yet')}</div><div class="st">${c.rejected} rejected</div>`;
 if(c.agent==='analyst')body=`<div class="hl" style="color:#ffd60a">${esc(c.headline)}</div><canvas class="ring" data-score="${c.score??''}" style="width:120px;height:120px;margin:10px 0"></canvas>
  <div class="st">${c.last?`${esc(c.last.name)} · ${esc(c.last.verdict)}${c.last.reason?' · '+esc(c.last.reason):''}`:'Nothing scored yet'} · ${esc(c.mode)}</div>`;
 if(c.agent==='executor')body=`<div class="hl" style="color:#00d35a">${esc(c.headline)}</div><div class="st">${esc(c.sub)}</div>
  ${c.status==='executing'?`<div class="bar"><i style="width:${c.progress}%"></i></div><div class="st">Executing... ${c.progress}%</div>`:c.progress===100?'<div class="st g" style="margin-top:14px">✓ Filled</div>':''}`;
 if(c.agent==='risk')body=`<div class="hl" style="color:#ff6b9a">${esc(c.headline)}</div><div class="st">${esc(c.last||'No exits yet')}${c.open?` · ${c.open} open`:''}</div>
  <div>${c.pills.map(p=>`<span class="tp mono ${p.color}">${esc(p.text)}</span>`).join('')}</div>`;
 return `<div class="ac"><div class="t">${esc(c.title)}</div>${body}</div>`;}

// ---------- screens ----------
async function home(){const v=$('#view');if(!CACHE.state)v.innerHTML=nav()+sk(66,'60%','16px')+sk(220,'auto','12px 0')+sk(44)+sk(320,'auto','12px 16px');
 let st,ch,act;try{[st,ch,act]=await Promise.all([get('state'),get('chart?range='+range),get('activity')]);}catch(e){showErr();if(!CACHE.state){v.innerHTML=nav()+'<div class="emptyc">Desk offline · no data yet</div>';}return;}
 const first=!$('#bal');
 if(first||route.tab!=='home'||!$('#homeroot')){v.innerHTML=`<div id="homeroot">${nav()}<div class="bal">${odo(st.balance,'bal')}${st.mode==='PAPER'?'<span class="pill paper">PAPER</span>':''}</div>
  <div class="today"><span id="tp" class="${st.todayPct>=0?'g':'r'}">${st.todayPct>=0?'+':''}${st.todayPct.toFixed(2)}%</span> <span class="s2">today</span> <span class="pill mult" id="mult">${st.multiplier.toFixed(2)}×</span></div>
  <div class="chart"><canvas id="line"></canvas>${ch.empty?'<div class="empty">Waiting for the first trade</div>':''}</div>
  <div class="ranges">${['LIVE','1H','4H','1D','1W','ALL'].map(r=>`<button class="${r===range?'on':''}" onclick="range='${r}';home()">${r}</button>`).join('')}</div>
  <div class="h2">Agents · ${st.running} running</div><div class="car">${st.cards.map(card).join('')}</div>
  <div class="h2">Activity <button onclick="go({tab:'activity'})">See all</button></div>
  ${act.rows.length?`<div class="list">${act.rows.slice(0,5).map(actRow).join('')}</div>`:'<div class="emptyc">Nothing yet tonight</div>'}</div>`;}
 else{rollOdo('bal',st.balance);$('#tp').textContent=(st.todayPct>=0?'+':'')+st.todayPct.toFixed(2)+'%';$('#mult').textContent=st.multiplier.toFixed(2)+'×';
  const car=$('.car');const sl=car.scrollLeft;car.innerHTML=st.cards.map(card).join('');car.scrollLeft=sl;}
 drawLine($('#line'),ch);document.querySelectorAll('canvas.ring').forEach(c=>drawRing(c,c.dataset.score===''?null:+c.dataset.score));showErr();}
async function agents(){const v=$('#view');if(!CACHE['agents/scanner/decisions'])v.innerHTML=nav()+[1,2,3].map(()=>sk(180)).join('');
 const names=['scanner','auditor','analyst','executor','risk'];let ds;try{ds=await Promise.all(names.map(n=>get(`agents/${n}/decisions`)));}catch(e){showErr();return;}
 v.innerHTML=nav()+`<div class="h2">Agents</div>`+ds.map(d=>`<div class="card"><div class="row" style="padding:0;min-height:44px;border:0">
  <span class="ic" style="background:${d.running?'#00d35a':'#636366'};width:10px;height:10px;flex:0 0 10px"></span>
  <span class="m"><div class="ti" style="text-transform:capitalize">${esc(d.agent)}</div><div class="su">${d.running?'running':'paused'} · ${d.today} today</div></span>
  <button class="swrap" ${d.locked||PLANB()?'disabled':''} onclick="toggleAgent('${d.agent}',${d.running})" aria-label="pause or resume"><span class="sw ${d.running?'on':''} ${d.locked?'lock':''}"></span></button></div>
  ${d.locked?'<div class="su s2">Locked while a position is open</div>':''}
  <div style="margin-top:8px">${d.decisions.length?d.decisions.map(x=>`<div class="lr"><span class="s2">${hm(x.ts)}</span><a href="${esc(x.link)}" target="_blank" rel="noopener" style="flex:1">${esc(x.name||x.mint.slice(0,6))}</a><span>${esc(x.verdict)}</span></div>
   ${x.reason?`<div class="su s2" style="margin:-6px 0 6px">${esc(x.reason)}</div>`:''}`).join(''):`<div class="s2">${d.agent==='scanner'?'Listening for graduations':'No decisions yet'}</div>`}</div>
  <button class="back" onclick="go({tab:'account',focus:'${d.agent}'})">Settings ›</button></div>`).join('');showErr();}
async function toggleAgent(a,running){try{const r=await api(`agents/${a}/${running?'pause':'resume'}`,{});toast(r.message);}catch(e){toast(PLANB()?'Read-only here: use Telegram':'Desk offline');}agents();}
let ACT_ROWS=[],ACT_NEXT=null;
async function activity(more){const v=$('#view');if(!more&&!CACHE.activity)v.innerHTML=nav()+sk(64)+sk(64)+sk(64);
 let a;try{a=more&&!PLANB()?await api('activity?before='+ACT_NEXT):await get('activity');}catch(e){showErr();return;}
 ACT_ROWS=more?ACT_ROWS.concat(a.rows):a.rows;ACT_NEXT=a.next;
 v.innerHTML=nav()+`<div class="h2">Activity</div>`+(ACT_ROWS.length?`<div class="list">${ACT_ROWS.map(actRow).join('')}</div>${ACT_NEXT&&!PLANB()?'<button class="btn ghost" onclick="activity(true)">More</button>':''}`:'<div class="emptyc">Nothing yet tonight</div>');showErr();}
async function coin(mint){const v=$('#view');if(!CACHE['coin/'+mint])v.innerHTML=`<div class="nav"><button class="back" onclick="history.back()">‹ Back</button></div>`+sk(50,'70%','8px 16px')+sk(260,'auto','12px 0')+sk(140);
 let c;try{c=await get('coin/'+mint);}catch(e){showErr();return;}const p=c.position,open=p&&p.status==='open',st=CACHE.state;
 v.innerHTML=`<div class="nav"><button class="back" onclick="history.back()">‹ Back</button><span class="sp"></span>${(st?.mode||'PAPER')==='PAPER'?'<span class="pill paper">PAPER</span>':''}</div>
 <div class="sec"><div style="display:flex;align-items:center;gap:8px"><span class="big2" style="font-size:28px">${esc(c.name||mint.slice(0,6))}</span>${c.shield?`<span class="pill" style="background:#00d35a22;color:#00d35a">🛡 ${esc(c.shield)}</span>`:''}</div>
 <div class="s2">${esc(c.symbol||'')} · ${esc(c.chain||'Solana')} · ${c.ageMin==null?'age n/a':c.ageMin>=60?Math.floor(c.ageMin/60)+'h old':c.ageMin+'m old'}</div>
 <div class="big2" style="margin-top:8px">${fmtP(c.price)}</div>${p&&p.sinceEntryPct!=null?`<div class="${p.sinceEntryPct>=0?'g':'r'}">${p.sinceEntryPct>=0?'▲':'▼'} ${Math.abs(p.sinceEntryPct).toFixed(2)}% since entry</div>`:''}</div>
 <canvas id="cand" style="width:100%;height:260px;display:block;margin-top:8px"></canvas>
 <div class="stat"><div><small>Market cap</small>${fmtK(c.stats.marketCap)}</div><div><small>Liquidity</small>${fmtK(c.stats.liquidity)}</div><div><small>24h volume</small>${fmtK(c.stats.volume24h)}</div><div><small>Holders</small>${c.stats.holders??'n/a'}</div></div>
 ${p?`<div class="card"><h3>Your position · ${fmt$(p.sizeUsd)} in · Executor</h3><div class="s2">${esc(p.mode)} · ${esc(p.status)}${p.exitReason?' · '+esc(p.exitReason):''}${p.pnlUsd!=null?` · <span class="${p.pnlUsd>=0?'g':'r'}">${p.pnlUsd>=0?'+':'-'}$${Math.abs(p.pnlUsd).toFixed(2)}</span>`:''}</div></div>`:''}
 ${c.exit?`<div class="card"><h3>Exit</h3><div class="kv"><span class="s2">Stop line (-${p.stopPct}%)</span><span>${fmtP(c.exit.stopLine)}</span></div>
  <div class="kv"><span class="s2">Trail line</span><span>${c.exit.trailActive?fmtP(c.exit.trailLine):'not active yet'}</span></div><div class="kv"><span class="s2">Timeout in</span><span>${Math.floor(c.exit.timeoutLeftMin/60)}h ${c.exit.timeoutLeftMin%60}m</span></div></div>`:''}
 ${c.coin_url?`<a class="btn ${open?'red':''}" href="${esc(c.coin_url)}" target="_blank" rel="noopener">${open?'Sell on FOMO':'Buy on FOMO'}</a>`:''}
 <button class="btn ghost" onclick="go({screen:'auditor',mint:'${esc(mint)}'})">Auditor</button>`;
 drawCandles($('#cand'),c);showErr();}
async function auditor(mint){const v=$('#view');if(!CACHE['audit/'+mint])v.innerHTML=`<div class="nav"><button class="back" onclick="history.back()">‹ Back</button></div>`+sk(260,'220px','16px auto')+sk(330);
 let a;try{a=await get('audit/'+mint);}catch(e){showErr();return;}
 const head=`<div class="nav"><button class="back" onclick="history.back()">‹ Back</button><span class="sp"></span><span class="brand">${esc(a.name||mint.slice(0,6))}</span></div>`;
 const tog=`<div class="card"><div class="kv" style="border:0;align-items:center"><span>Take apart before buying</span><button class="swrap" onclick="auditToggle(${a.enabled})"><span class="sw ${a.enabled?'on':''}"></span></button></div></div>`;
 if(!a.layers){v.innerHTML=head+`<div class="emptyc" style="margin-top:20px">No coin taken apart yet</div>`+tog+(a.coin_url?`<a class="btn" href="${esc(a.coin_url)}" target="_blank" rel="noopener">Open on FOMO</a>`:'');showErr();return;}
 const L=a.layers;v.innerHTML=head+`<div class="discs" id="discs">${L.map((l,i)=>`<div class="disc" id="dk${i}" style="top:${i*28}px;z-index:${10-i}"></div>`).join('')}<div class="beam" id="beam" style="top:-10px" hidden></div></div>
 <div class="sec" style="text-align:center">${a.passed===true?`<div class="big2 g" style="font-size:24px">Cleared · 8/8 parts</div><div class="s2">Sent to Executor${a.sentUsd?' · '+fmt$(a.sentUsd):''}</div>`:a.passed===false?`<div class="big2 r" style="font-size:24px">Rejected · ${esc(a.reason)}</div><div class="s2">Grok Bot won't buy ${esc(a.name||'this coin')}</div>`:'<div class="s2">taking apart...</div>'}</div>
 <div class="card">${L.map((l,i)=>`<div class="lr" id="lr${i}"><span>${l.n} ${esc(l.name)}</span><span class="${l.value==='not checked'?'s3':''}" data-c="${l.value==='not checked'?'':l.pass?'g':'r'}">${esc(l.value)}</span></div>`).join('')}</div>${tog}
 <a class="btn" href="${esc(a.coin_url)}" target="_blank" rel="noopener">Open on FOMO</a>`;
 const play=async()=>{const beam=$('#beam');for(let i=0;i<L.length;i++){const l=L[i],d=$('#dk'+i),row=$('#lr'+i+' span:last-child');
   if(l.value==='not checked'){d.classList.add('nc');d.textContent='';continue;}
   if(!RM){beam.hidden=false;beam.style.top=(i*28+20)+'px';await new Promise(r=>setTimeout(r,350));}
   d.classList.add(l.pass?'ok':'bad');d.textContent=l.pass?'✓':'✕';row.className=row.dataset.c;if(!RM)await new Promise(r=>setTimeout(r,150));}
  beam.hidden=true;};
 document.querySelectorAll('#lr0 span:last-child,.lr span:last-child').forEach(s=>{if(!RM&&s.dataset.c)s.className='s3';});play();showErr();}
let auditAsk=0;async function auditToggle(on){if(PLANB())return toast('Read-only here: use Telegram');
 if(on){if(auditAsk===0){auditAsk=1;return toast('Turn off taking apart? Tap again to confirm');}if(!confirm('Really buy without the Auditor? Coins skip all 8 layers.')){auditAsk=0;return;}}
 auditAsk=0;const r=await api('settings',{key:'auditor.enabled',value:!on});toast(r.results[0].message);go(route);}
async function account(){const v=$('#view');if(!CACHE.account)v.innerHTML=nav()+sk(120)+sk(60)+sk(400);
 let ac,st;try{[ac,st]=await Promise.all([get('account'),get('settings')]);}catch(e){showErr();return;}
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 v.innerHTML=nav()+`<div class="h2">Account</div><div class="card"><div class="seg"><button class="${ac.mode==='PAPER'?'on':''}" onclick="setMode('PAPER')">PAPER</button><button class="${ac.mode==='LIVE'?'on':''}" onclick="setMode('LIVE')">LIVE</button></div>
 <div class="kv" style="margin-top:8px"><span class="s2">Stack</span><span>${fmt$(ac.stack)}</span></div>
 ${ac.mode==='LIVE'?`<div class="set"><div class="nm"><span>LIVE stack</span></div><div class="ctl"><input class="inp" inputmode="decimal" value="${ac.liveStack}" onchange="setS('desk.live_stack',this.value)"></div></div>`:''}</div>
 <div class="list"><a class="row" href="${esc(ac.profile_url)}" target="_blank" rel="noopener"><span class="m"><div class="ti">Your FOMO profile</div><div class="su">@${esc(ac.fomo_handle)}</div></span><span class="s3">›</span></a>
 <button class="row" style="width:100%;text-align:left" onclick="invite('${esc(ac.SIGNUP_URL)}')"><span class="m"><div class="ti">Invite a friend</div><div class="su">10% off fees for life</div></span><span class="s3">›</span></button>
 <div class="row"><span class="m"><div class="ti">Telegram</div><div class="su">${ac.telegram?'connected':'not connected'}</div></span>${ac.telegram&&!PLANB()?'<button class="back" onclick="testPush()">Send test push</button>':''}</div>
 <div class="row"><span class="m"><div class="ti">Notifications</div><div class="su">${ac.webpush?(standalone?'':'Add to Home Screen first'):'Plan B: no web push here, Telegram only'}</div></span>${ac.webpush&&standalone?'<button class="back" onclick="enablePush()">Enable notifications</button>':''}</div></div>
 ${Object.entries(st).map(([g,keys])=>`<div class="card" id="sec-${g}"><h3 style="text-transform:capitalize">${g}</h3>${Object.entries(keys).filter(([k])=>k!=='fomo_handle').map(([k,s])=>setCtl(g,k,s)).join('')}</div>`).join('')}
 <div class="card"><h3>Command</h3><input class="inp" id="cm" placeholder="status · why X · set stop to -8%" ${PLANB()?'disabled':''}><pre id="cr" class="s2" style="white-space:pre-wrap"></pre><button class="btn" style="margin:8px 0 0;width:100%" onclick="cmd()" ${PLANB()?'disabled':''}>Send</button></div>`;
 if(route.focus)setTimeout(()=>document.getElementById('sec-'+route.focus)?.scrollIntoView(),50);showErr();}
function setCtl(g,k,s){const id=`${g}.${k}`,dis=PLANB()?'disabled':'';
 if(s.choices)return `<div class="set"><div class="nm"><span>${k}</span></div><div class="ctl"><select ${dis} onchange="setS('${id}',this.value)">${s.choices.map(c=>`<option ${String(c)===String(s.value)?'selected':''}>${c}</option>`).join('')}</select></div></div>`;
 if(s.min===undefined)return `<div class="set"><div class="nm"><span>${k}</span></div><div class="ctl"><input class="inp" ${dis} value="${esc(s.value)}" onchange="setS('${id}',this.value)"></div></div>`;
 const step=(s.max-s.min)<=1?0.01:(s.max-s.min)<=100?0.5:Math.pow(10,Math.max(0,Math.floor(Math.log10(s.max-s.min))-2));
 return `<div class="set"><div class="nm"><span>${k}</span><span class="s3 mono">${s.min}–${s.max}</span></div><div class="ctl"><input type="range" ${dis} min="${s.min}" max="${s.max}" step="${step}" value="${s.value}" oninput="this.nextElementSibling.value=this.value" onchange="setS('${id}',this.value)"><input class="n" ${dis} inputmode="decimal" value="${s.value}" onchange="setS('${id}',this.value)"></div></div>`;}
async function setS(k,v){try{const r=await api('settings',{key:k,value:v});toast(r.results[0].message);}catch(e){toast(PLANB()?'Read-only here: use Telegram':'Desk offline');}delete CACHE.settings;account();}
async function setMode(m){if(PLANB())return toast('Read-only here: use Telegram');let body={mode:m};if(m==='LIVE'){const t=prompt('Type LIVE to switch to LIVE');if(t!=='LIVE')return toast('Not switched');body.confirm='LIVE';}
 try{const r=await api('mode',body);toast(r.message);}catch(e){toast('Desk offline');}delete CACHE.account;account();}
async function invite(u){try{if(navigator.share){await navigator.share({title:'FOMO',url:u});return;}}catch(e){if(e.name==='AbortError')return;}
 try{await navigator.clipboard.writeText(u);}catch(e){}toast('Link copied');}
async function testPush(){try{const r=await api('test_push',{});toast(r.ok?'Test push sent':'Push failed');}catch(e){toast('Desk offline');}}
async function cmd(){const r=await api('cmd',{text:$('#cm').value});$('#cr').textContent=r.reply;}
async function enablePush(){try{const reg=await navigator.serviceWorker.register('sw.js');if(await Notification.requestPermission()!=='granted')return toast('Notifications not allowed');
 const k=CACHE.account.vapidPublic,raw=Uint8Array.from(atob(k.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-k.length%4)%4)),c=>c.charCodeAt(0));
 const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:raw});await api('push',sub.toJSON());toast('Notifications on');}catch(e){toast('Push not available');}}
async function search(){const v=$('#view');v.innerHTML=nav()+`<div class="search"><input id="q" placeholder="Name, symbol or mint" autofocus></div><div id="res" style="margin-top:12px"></div>`;
 $('#q').oninput=async e=>{const q=e.target.value.trim().toLowerCase();if(!q)return $('#res').innerHTML='';let a=CACHE.activity;try{a=await get('activity');}catch(_){}
  const seen={};const hits=(a?.rows||[]).filter(r=>r.mint&&!seen[r.mint]&&(seen[r.mint]=1)&&(r.title.toLowerCase().includes(q)||r.mint.toLowerCase().startsWith(q)));
  $('#res').innerHTML=hits.length?`<div class="list">${hits.map(actRow).join('')}</div>`:'<div class="emptyc">No coin on the desk matches. Send the mint in Telegram: buy MINT</div>';};}
function bell(){if(!PLANB())api('cmd',{text:'status'}).catch(()=>{});go({tab:'activity'});}

// ---------- router + refresh ----------
function go(r){route=r;history.pushState(r,'','#');render();}
window.onpopstate=e=>{route=e.state||{tab:'home'};render();};
function render(){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===(route.tab||'')));
 if(route.screen==='coin')return coin(route.mint);if(route.screen==='auditor')return auditor(route.mint);
 return ({home,agents,activity:()=>activity(false),account,search}[route.tab]||home)();}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>go({tab:b.dataset.tab}));
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
(function(){const q=new URLSearchParams(location.search);if(q.get('screen'))route={screen:q.get('screen'),mint:q.get('mint')};else if(q.get('tab'))route={tab:q.get('tab')};})();
history.replaceState(route,'','');render();
setInterval(()=>{if(ERR&&ERR!=='auth'){RETRY--;if(RETRY<=0){RETRY=5;render();}else showErr();}},1000);
setInterval(()=>{if(!ERR&&(route.tab==='home'))home();},PLANB()?15000:5000);
if(!PLANB()&&T()&&window.EventSource){try{const es=new EventSource('/api/stream?t='+encodeURIComponent(T()));['fill','exit','balance','verdict','scan'].forEach(k=>es.addEventListener(k,()=>{if(route.tab==='home')home();}));}catch(e){}}
