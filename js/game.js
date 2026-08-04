// ============================================================
// HOUSEBREAKER — 게임 로직 (MVP: 루비 / 룰렛 / 구역 1개)
// ============================================================

// ---------- 유틸 ----------
const rnd = () => Math.random();
const ri = n => Math.floor(Math.random() * n);
const choice = a => a[ri(a.length)];
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const fmt = n => Math.round(n).toLocaleString('ko-KR');
const $app = () => document.getElementById('app');

// ---------- 전역 상태 ----------
let G = null;   // 런 상태
let B = null;   // 전투 상태

function newRun(){
  G = {
    screen: 'map',
    money: 100,
    maxFocus: 10,
    skills: [],   // 1회용 기술 카드 (중복 보유 가능, 사용 시 소모, 미사용분은 이월)
    trinkets: [],
    contracts: [],
    debt: 0,
    usedLoan: false,
    freeBuys: 0,
    magnetDiscount: 0,
    nextVaultMod: 1,
    nextVaultDmg: 0,
    lastCoinUsed: false,
    totalVaultDmg: 0,
    battlesWon: 0,
    turnCount: 0,
    layer: 0,
    map: genMap(),
    dealerQueue: shuffle(DEALERS.filter(d=>d.tier==='normal').map(d=>d.id)),
    usedEvents: [],
    shopItems: null,
    event: null,
    eventResult: null,
    rewardChoices: null,
    rewardTitle: '',
  };
  B = null;
}

const hasT = id => G.trinkets.includes(id);
const hasC = id => G.contracts.includes(id);
const hasS = id => G.skills.includes(id);
function consumeSkill(id){
  const i = G.skills.indexOf(id);
  if(i>=0) G.skills.splice(i,1);
}

function gainTrinket(id){
  if(G.trinkets.includes(id)) return false;
  G.trinkets.push(id);
  if(id==='extrapocket') G.maxFocus += 3;
  return true;
}
function loseTrinket(id){
  G.trinkets = G.trinkets.filter(t=>t!==id);
  if(id==='extrapocket') G.maxFocus = Math.max(5, G.maxFocus-3);
}
function gainContract(id){
  if(G.contracts.includes(id)) return false;
  G.contracts.push(id);
  if(id==='miser') G.freeBuys += 1;
  return true;
}

// ---------- 맵 생성 ----------
function pickNodes(pool, n){
  return shuffle(pool).slice(0, n);
}
function genMap(){
  return [
    ['battle'],
    pickNodes(['battle','event','lounge'], 2),
    pickNodes(['shop','highroller','event','loan'], 3),
    pickNodes(['battle','event','lounge','loan'], 2),
    ['elite'],
    pickNodes(['shop','lounge','event'], 2),
    ['boss'],
  ];
}

// ---------- 화면 렌더 디스패치 ----------
let lastScreen = null;
function render(){
  const screens = {
    title: renderTitle, map: renderMap, battle: renderBattle,
    reward: renderReward, shop: renderShop, event: renderEvent,
    lounge: renderLounge, loan: renderLoan,
    gameover: renderGameOver, victory: renderVictory,
  };
  const scr = G ? G.screen : 'title';
  $app().innerHTML = screens[scr]();
  // 같은 화면 안에서의 갱신은 페이드인 애니메이션 생략 (화면 껌뻑임 방지)
  if(scr === lastScreen){
    const el = $app().querySelector('.screen');
    if(el) el.classList.add('no-anim');
  }
  lastScreen = scr;
  bindEvents();
}

// 이벤트 위임: data-act(좌클릭) / data-ract(우클릭 또는 모바일 롱프레스) 속성 기반
let lastLongPress = 0;
function bindEvents(){
  $app().querySelectorAll('[data-act]').forEach(el=>{
    el.addEventListener('click', ()=>{
      if(Date.now() - lastLongPress < 600) return; // 롱프레스 직후 클릭 무시
      const act = el.dataset.act;
      const arg = el.dataset.arg;
      ACTIONS[act] && ACTIONS[act](arg);
    });
    if(el.dataset.ract){
      el.addEventListener('contextmenu', e=>{
        e.preventDefault();
        if(Date.now() - lastLongPress < 600) return; // 롱프레스와 중복 방지
        const ract = el.dataset.ract;
        ACTIONS[ract] && ACTIONS[ract](el.dataset.arg);
      });
      // 모바일: 길게 누르면 우클릭과 동일하게 동작
      let lpTimer = null;
      el.addEventListener('touchstart', ()=>{
        lpTimer = setTimeout(()=>{
          lpTimer = null;
          lastLongPress = Date.now();
          const ract = el.dataset.ract;
          ACTIONS[ract] && ACTIONS[ract](el.dataset.arg);
        }, 450);
      }, {passive:true});
      ['touchend','touchmove','touchcancel'].forEach(ev=>
        el.addEventListener(ev, ()=>{ if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } }, {passive:true}));
    }
  });
}

// ---------- 타이틀 ----------
function renderTitle(){
  return `
  <div class="screen title-screen">
    <div class="logo">HOUSE<span>BREAKER</span></div>
    <p class="tagline">확률을 통제해 카지노를 파산시키는 턴제 전략 로그라이크</p>
    <p class="promise">"운에 끌려가지 않는다. 위험을 계산하고, 확률을 조작하고, 판돈을 선택한다."</p>
    <div class="char-select">
      <div class="char-card active" data-act="startRun">
        <div class="char-icon">🎯</div>
        <div class="char-name">루비</div>
        <div class="char-base">룰렛 · 안정적 입문형</div>
        <div class="char-desc">여러 영역에 분산 베팅하고 공이 떨어질 범위를 좁힌다.<br>전용 자원: <b>포커스</b></div>
        <button class="btn gold">이 캐릭터로 시작</button>
      </div>
      <div class="char-card locked">
        <div class="char-icon">🃏</div>
        <div class="char-name">나인</div>
        <div class="char-base">바카라 · 계산적 고난도</div>
        <div class="char-desc">🔒 잠김 — 차기 버전</div>
      </div>
      <div class="char-card locked">
        <div class="char-icon">🎰</div>
        <div class="char-name">잭</div>
        <div class="char-base">슬롯 · 콤보 성장형</div>
        <div class="char-desc">🔒 잠김 — 차기 버전</div>
      </div>
    </div>
    <p class="footnote">파산 = 자금 0 · 승리 = 카지노 금고 파괴 · 실제 현금 결제 없음 · ${GAME_VERSION}</p>
  </div>`;
}

// ---------- 맵 ----------
function renderMap(){
  const rows = G.map.map((layer, li)=>{
    const cls = li < G.layer ? 'done' : li === G.layer ? 'current' : 'future';
    const nodes = layer.map((t, ni)=>{
      const nt = NODE_TYPES[t];
      const clickable = li === G.layer;
      return `<div class="map-node ${cls} ${clickable?'clickable':''}" ${clickable?`data-act="enterNode" data-arg="${ni}"`:''}>
        <div class="node-icon">${nt.icon}</div>
        <div class="node-name">${nt.name}</div>
        <div class="node-danger">위험도 ${nt.danger}</div>
        <div class="node-desc">${nt.desc}</div>
      </div>`;
    }).join('');
    return `<div class="map-layer">${nodes}</div>`;
  }).join('<div class="map-arrow">▼</div>');

  return `
  <div class="screen map-screen">
    ${runHeader()}
    <h2 class="zone-title">구역 1 — 루주의 룰렛 홀</h2>
    <p class="hint">다음 노드의 유형과 위험도를 보고 경로를 선택하세요.</p>
    <div class="map-flow">${rows}</div>
    ${buildPanel()}
  </div>`;
}

function runHeader(){
  return `<div class="run-header">
    <span class="stat money">💰 자금 <b>${fmt(G.money)}</b></span>
    <span class="stat">🧠 최대 포커스 <b>${G.maxFocus}</b></span>
    ${G.debt>0?`<span class="stat debt">🦈 부채 <b>${fmt(G.debt)}</b></span>`:''}
    <span class="stat">🏆 격파 <b>${G.battlesWon}</b></span>
  </div>`;
}

function buildPanel(){
  const counts = {};
  G.skills.forEach(id=>counts[id]=(counts[id]||0)+1);
  const sk = Object.entries(counts).map(([id,n])=>{ const s=SKILLS.find(x=>x.id===id); return `<span class="tag skill" title="${s.desc}">${s.name}${n>1?` ×${n}`:''}</span>`; }).join('') || '<span class="none">없음</span>';
  const tr = G.trinkets.map(id=>{ const t=TRINKETS.find(x=>x.id===id); return `<span class="tag trinket" title="${t.desc}">${t.name}</span>`; }).join('') || '<span class="none">없음</span>';
  const ct = G.contracts.map(id=>{ const c=CONTRACTS.find(x=>x.id===id); return `<span class="tag contract" title="${c.desc}">${c.name}</span>`; }).join('') || '<span class="none">없음</span>';
  return `<div class="build-panel">
    <div><b>기술 카드</b> ${sk}</div>
    <div><b>패시브</b> ${tr}</div>
    <div><b>계약</b> ${ct}</div>
  </div>`;
}

// ---------- 노드 진입 ----------
function enterNode(ni){
  const type = G.map[G.layer][Number(ni)];
  if(type==='battle'){ startBattle(nextNormalDealer()); }
  else if(type==='highroller'){ startBattle(nextNormalDealer(), {vaultMult:1.5, minBetMult:3, rewardMult:2, highroller:true}); }
  else if(type==='elite'){ startBattle('max'); }
  else if(type==='boss'){ startBattle('rouge'); }
  else if(type==='shop'){ openShop(); }
  else if(type==='loan'){ G.screen='loan'; render(); }
  else if(type==='lounge'){ G.screen='lounge'; render(); }
  else if(type==='event'){ openEvent(); }
}
function nextNormalDealer(){
  if(G.dealerQueue.length===0) G.dealerQueue = shuffle(DEALERS.filter(d=>d.tier==='normal').map(d=>d.id));
  return G.dealerQueue.shift();
}
function advanceLayer(){
  G.layer++;
  G.screen = 'map';
  render();
}

// ============================================================
// 전투
// ============================================================
function freshMods(){
  return {
    magnet:null, pruned:new Set(), colorLock:null, parityLock:null,
    doubled:false, blackcat:false, zerohour:false, safety:false,
    allin:false, neighbor:false, redsense:false, greenshield:false,
    jam:false, payoutBonus:0,
  };
}

function startBattle(dealerId, mods={}){
  const d = DEALERS.find(x=>x.id===dealerId);
  let vault = Math.round(d.vault * (mods.vaultMult||1) * G.nextVaultMod);
  G.nextVaultMod = 1;
  const preDmg = Math.round(vault * G.nextVaultDmg);
  G.nextVaultDmg = 0;

  B = {
    dealer: d,
    highroller: !!mods.highroller,
    maxVault: vault,
    vault: vault - preDmg,
    baseMinBet: Math.round(d.minBet * (mods.minBetMult||1)),
    rewardMult: mods.rewardMult||1,
    turn: 1,
    focus: Math.min(G.maxFocus, 6),
    bets: [],
    chip: 10,
    phase: 'bet',            // bet → post → (다음 턴)
    turnMods: freshMods(),
    nextPayoutBonus: 0,
    currentAction: DEALER_ACTIONS.none,
    nextAction: null,
    usedBreath: 0,
    freeRespinUsed: false,
    insuranceUsed: false,
    consecWins: 0, consecLosses: 0,
    removed: new Set(),
    doubleZero: false,
    phase2Announced: false,
    wonNumbers: [],
    history: [],
    result: null,
    spinning: false,
    pickingNumber: false,
    log: [],
    lastSettle: null,
  };
  if(preDmg>0) blog(`🗺️ 금고 설계도의 정보로 시작부터 금고에 ${fmt(preDmg)} 피해!`);
  B.nextAction = rollDealerAction();
  if(hasT('glasses')){
    applyColorReveal('딜러의 안경');
  }
  G.screen = 'battle';
  render();
}

function blog(msg){ B.log.unshift(msg); if(B.log.length>40) B.log.pop(); }

function rollDealerAction(){
  if(B.dealer.tier==='boss') return bossAction();
  const pool = B.dealer.actions;
  return DEALER_ACTIONS[choice(pool)];
}

// 보스: 마담 루주 전용 패턴
function bossAction(){
  const t = B.turn;
  // 당첨 숫자 제거 액션
  if(B.wonNumbers.length>0 && t%3===0){
    return { id:'removeWon', name:'숫자 제거', desc:'플레이어가 당첨됐던 숫자 하나를 룰렛에서 영구히 제거한다.' };
  }
  const cycle = ['blockRed','payoutDown','blockBlack','minBetUp','tax','nullify'];
  return DEALER_ACTIONS[cycle[t % cycle.length]] || DEALER_ACTIONS.none;
}

// 보스 압박: 직전 두 결과가 같은 색이면 이번 턴 손실 +30%
function bossPressure(){
  if(B.dealer.tier!=='boss') return false;
  const h = B.history;
  if(h.length<2) return false;
  const c1 = numColor(h[h.length-1]), c2 = numColor(h[h.length-2]);
  return c1===c2 && c1!=='green';
}

// ---------- 후보 집합 (정보 원칙: 표시 확률 = 실제 확률) ----------
function candidateSet(){
  let base = WHEEL_ORDER.slice();
  if(B.doubleZero) base.push(DOUBLE_ZERO);
  base = base.filter(n=>!B.removed.has(n));
  let set = base;
  const m = B.turnMods;
  const apply = f => { const next = set.filter(f); if(next.length>0) set = next; };
  if(m.magnet) apply(n=>m.magnet.has(n));
  if(m.pruned.size) apply(n=>!m.pruned.has(n));
  if(m.colorLock) apply(n=>numColor(n)===m.colorLock);
  if(m.parityLock) apply(n=> n>=1 && n<=36 && (n%2===1 ? 'odd':'even')===m.parityLock);
  return set;
}
function betProb(type, target){
  const c = candidateSet();
  const hits = c.filter(n=>betHits(type, target, n)).length;
  return { p: hits/c.length, hits, total: c.length };
}
function betHits(type, target, n){
  if(type==='straight' && B.turnMods.neighbor){
    const idx = WHEEL_ORDER.indexOf(target);
    if(idx>=0){
      const L = WHEEL_ORDER[(idx+WHEEL_ORDER.length-1)%WHEEL_ORDER.length];
      const R = WHEEL_ORDER[(idx+1)%WHEEL_ORDER.length];
      return n===target || n===L || n===R;
    }
  }
  return BET_TYPES[type].test(n, target);
}

// ---------- 딜러 행동 활성 여부 ----------
function actionActive(id){
  return B.currentAction.id===id && !B.turnMods.jam;
}
function effMinBet(){
  if(hasT('steelheart')) return 1;
  let m = B.baseMinBet;
  if(actionActive('minBetUp')) m *= 2;
  if(hasC('highroller')) m *= 2;
  return m;
}
function betBlocked(type){
  if(actionActive('blockRed') && type==='red') return '딜러가 빨강을 봉쇄했다';
  if(actionActive('blockBlack') && type==='black') return '딜러가 검정을 봉쇄했다';
  if(hasC('blackbalance') && type==='red') return '계약(검은 균형): 빨강 베팅 불가';
  if(hasC('gamblersoul') && ['red','black','odd','even','low','high'].includes(type)) return '계약(도박꾼의 혼): 1:1 베팅 불가';
  return null;
}
function totalStaked(){ return B.bets.reduce((s,b)=>s+b.amount,0); }

// ---------- 베팅 ----------
function placeBet(type, target){
  if(B.phase!=='bet' || B.spinning) return;
  const blocked = betBlocked(type);
  if(blocked){ blog(`⛔ ${blocked}`); render(); return; }
  const amt = B.chip==='all' ? Math.max(0, G.money - totalStaked()) : B.chip;
  if(amt<=0){ blog('⛔ 남은 자금이 없다.'); render(); return; }
  if(totalStaked() + amt > G.money){ blog('⛔ 자금이 부족하다. 베팅 총액은 보유 자금을 넘을 수 없다.'); render(); return; }
  const key = type + (target!=null ? ':'+target : '');
  const existing = B.bets.find(b=>b.key===key);
  if(existing) existing.amount += amt;
  else B.bets.push({ key, type, target: target!=null?Number(target):null, amount: amt });
  render();
}
function removeBet(key){
  if(B.phase!=='bet' || B.spinning) return;
  B.bets = B.bets.filter(b=>b.key!==key);
  render();
}
// 우클릭: 해당 위치에서 칩 단위만큼 회수
function unbet(type, target){
  if(B.phase!=='bet' || B.spinning) return;
  const key = type + (target!=null ? ':'+target : '');
  const b = B.bets.find(x=>x.key===key);
  if(!b) return;
  b.amount -= (B.chip==='all' ? b.amount : B.chip);
  if(b.amount<=0) B.bets = B.bets.filter(x=>x!==b);
  render();
}
function clearBets(){
  if(B.phase!=='bet' || B.spinning) return;
  B.bets = [];
  render();
}

// ---------- 기술 사용 ----------
function skillCost(s){
  if(s.id==='magnet') return Math.max(0, s.cost - (hasT('leadball')?1:0) - G.magnetDiscount);
  return s.cost;
}
function canUseSkill(s){
  const m = B.turnMods;
  if(!hasS(s.id)) return false;
  if(B.spinning) return false;
  if(s.phase==='post') return B.phase==='post' && !usedFlag(s.id);
  if(B.phase!=='bet') return false;
  if(usedFlag(s.id)) return false;
  if(s.id==='breath' && B.usedBreath>=2) return false;
  if(s.id==='jam' && B.currentAction.id==='none') return false;
  if(s.id==='prune'){
    const avail = candidateSet().filter(n=>n!==0 && n!==DOUBLE_ZERO && !B.bets.some(b=>betHits(b.type,b.target,n)));
    if(avail.length===0) return false;
  }
  return B.focus >= skillCost(s);
}
function usedFlag(id){
  const m = B.turnMods;
  switch(id){
    case 'magnet': return !!m.magnet;
    case 'double': return m.doubled;
    case 'blackcat': return m.blackcat;
    case 'zerohour': return m.zerohour;
    case 'parity': return !!m.parityLock;
    case 'colorsight': return !!m.colorLock;
    case 'safety': return m.safety;
    case 'allin': return m.allin;
    case 'prune': return m.pruned.size>0;
    case 'jam': return m.jam;
    case 'neighbor': return m.neighbor;
    case 'redsense': return m.redsense;
    case 'greenshield': return m.greenshield;
    default: return false;
  }
}

function useSkill(id){
  const s = SKILLS.find(x=>x.id===id);
  if(!s || !canUseSkill(s)) return;
  const cost = skillCost(s);
  const m = B.turnMods;

  if(s.id==='magnet'){
    B.pickingNumber = true;
    blog('🧲 자석 준비 — 보드에서 중심 숫자를 클릭하세요.');
    render(); return;
  }
  if(s.id==='respin'){
    doRespin(cost); return;
  }
  B.focus -= cost;
  consumeSkill(s.id); // 1회용: 사용 즉시 카드 소모
  switch(s.id){
    case 'double': m.doubled = true; blog('✨ 더블 베팅: 이번 턴 가장 큰 베팅의 배당 2배.'); break;
    case 'blackcat': m.blackcat = true; blog('🐈‍⬛ 검은 고양이: 검정 적중 시 다음 턴 배당 +50%.'); break;
    case 'zerohour': m.zerohour = true; blog('🕛 제로 아워: 0 적중 시 금고 25% 추가 피해.'); break;
    case 'parity': {
      const c = candidateSet();
      const pick = choice(c.filter(n=>n>=1&&n<=36));
      m.parityLock = pick%2===1 ? 'odd' : 'even';
      blog(`🔮 홀짝 투시: 이번 결과는 <b>${m.parityLock==='odd'?'홀수':'짝수'}</b> (0 제외 확정).`);
      break;
    }
    case 'colorsight': applyColorReveal('색 투시'); break;
    case 'breath': B.usedBreath++; B.focus = Math.min(G.maxFocus, B.focus+4); blog('🌬️ 심호흡: 포커스 +4.'); break;
    case 'safety': m.safety = true; blog('🛡️ 안전망: 이번 턴 손실 50% 감소.'); break;
    case 'allin': m.allin = true; blog('🔥 올인 감각: 순수익 +50%, 손실 +25%.'); break;
    case 'prune': {
      const avail = shuffle(candidateSet().filter(n=>n!==0 && n!==DOUBLE_ZERO && !B.bets.some(b=>betHits(b.type,b.target,n))));
      const cut = avail.slice(0,5);
      cut.forEach(n=>m.pruned.add(n));
      blog(`✂️ 숫자 배제: ${cut.map(numLabel).join(', ')} 를 후보에서 제거.`);
      break;
    }
    case 'jam': m.jam = true; blog(`🔧 딜러 방해: '${B.currentAction.name}' 효과가 무효화됐다.`); break;
    case 'neighbor': m.neighbor = true; blog('🎯 이웃 베팅: 스트레이트가 휠 양옆에도 적중 (배당 11배).'); break;
    case 'redsense': m.redsense = true; blog('❤️ 붉은 예감: 빨강 적중 시 포커스 +4.'); break;
    case 'greenshield': m.greenshield = true; blog('🟢 그린 실드: 0/00이 나오면 자동 재스핀.'); break;
  }
  render();
}

function applyColorReveal(srcName){
  const m = B.turnMods;
  if(m.colorLock) return;
  const c = candidateSet();
  const pick = choice(c);
  const col = numColor(pick);
  m.colorLock = col;
  const kr = col==='red'?'빨강':col==='black'?'검정':'초록(0)';
  blog(`👓 ${srcName}: 이번 결과의 색은 <b class="c-${col}">${kr}</b>.`);
}

function pickMagnetNumber(n){
  n = Number(n);
  const s = SKILLS.find(x=>x.id==='magnet');
  const cost = skillCost(s);
  if(B.focus < cost){ B.pickingNumber=false; render(); return; }
  B.focus -= cost;
  consumeSkill('magnet');
  const idx = WHEEL_ORDER.indexOf(n);
  const set = new Set();
  for(let k=-4;k<=4;k++) set.add(WHEEL_ORDER[(idx+k+WHEEL_ORDER.length)%WHEEL_ORDER.length]);
  B.turnMods.magnet = set;
  B.pickingNumber = false;
  blog(`🧲 자석: 결과 후보를 <b>${numLabel(n)}</b> 주변 9칸으로 제한 — [${[...set].map(numLabel).join(', ')}]`);
  render();
}

// ---------- 스핀 ----------
// 휠에 표시할 숫자 목록 (물리적 순서, 제거된 숫자 제외)
function wheelNumbers(){
  let ns = WHEEL_ORDER.slice();
  if(B.doubleZero) ns.push(DOUBLE_ZERO);
  return ns.filter(n=>!B.removed.has(n));
}

const SPIN_MS = 2500;
const TILE_W = 62; // 스트립 타일 폭 (css .strip-tile와 일치해야 함)

// 결과가 중앙 포인터에 멈추는 가로 숫자 스트립 (휠을 펼친 형태)
function buildSpinStrip(result){
  const ns = wheelNumbers();
  const reps = 6;
  const seq = [];
  for(let i=0;i<reps;i++) seq.push(...ns);
  const target = (reps-1)*ns.length + ns.indexOf(result);
  return { seq, target };
}

function startStripAnim(){
  const strip = document.getElementById('spin-strip');
  if(!strip || !B.spinStrip) return;
  const vp = strip.parentElement.clientWidth;
  const jitter = (rnd()-0.5) * TILE_W * 0.5; // 매번 정중앙에 서지 않게
  const offset = B.spinStrip.target*TILE_W + TILE_W/2 - vp/2 + jitter;
  setTimeout(()=>{ strip.style.transform = `translateX(${-offset}px)`; }, 60);
}

function trySpin(){
  if(B.phase!=='bet' || B.spinning) return;
  if(B.bets.length===0){ blog('⛔ 베팅을 먼저 하세요.'); render(); return; }
  const min = effMinBet();
  const under = B.bets.find(b=>b.amount < min);
  if(under){ blog(`⛔ 모든 베팅은 최소 ${fmt(min)}칩 이상이어야 한다.`); render(); return; }
  if(totalStaked() > G.money){ blog('⛔ 베팅 총액이 자금을 초과한다.'); render(); return; }

  const cands = candidateSet();
  let result = choice(cands);
  if(B.turnMods.greenshield && (result===0 || result===DOUBLE_ZERO)){
    blog(`🟢 그린 실드 발동! ${numLabel(result)} → 재스핀.`);
    result = choice(cands);
  }
  B.spinning = true;
  B.spinStrip = buildSpinStrip(result);
  render();
  startStripAnim();
  setTimeout(()=>{
    B.spinning = false;
    B.spinStrip = null;
    B.result = result;
    B.phase = 'post';
    blog(`🎱 공이 멈췄다: <b class="c-${numColor(result)}">${numLabel(result)}</b>`);
    render();
    scheduleAutoConfirm();
  }, SPIN_MS + 500);
}

// 리스핀 선택지가 없으면 결과를 잠시 보여준 뒤 자동 정산
function canRespinNow(){
  if(!hasS('respin')) return false;
  const freeAvail = hasT('brokendice') && !B.freeRespinUsed;
  return freeAvail || B.focus>=4;
}
function scheduleAutoConfirm(){
  if(canRespinNow()) return;
  const turn = B.turn;
  setTimeout(()=>{
    if(B && B.phase==='post' && B.turn===turn && !B.spinning) confirmResult();
  }, 1100);
}

function doRespin(cost){
  let free = false;
  if(hasT('brokendice') && !B.freeRespinUsed){ free = true; B.freeRespinUsed = true; }
  if(!free){
    if(B.focus < cost){ blog('⛔ 포커스 부족.'); render(); return; }
    B.focus -= cost;
  }
  consumeSkill('respin');
  const cands = candidateSet();
  B.result = choice(cands);
  blog(`🔄 리스핀${free?' (깨진 주사위: 무료)':''}! 새 결과: <b class="c-${numColor(B.result)}">${numLabel(B.result)}</b>`);
  render();
  scheduleAutoConfirm();
}

// ---------- 정산 ----------
function confirmResult(){
  if(B.phase!=='post') return;
  const r = B.result;
  const m = B.turnMods;
  const pressure = bossPressure();
  let logLines = [];

  // 사기꾼: 가장 큰 베팅 무효
  let bets = B.bets.slice();
  if(actionActive('nullify') && bets.length>0){
    const biggest = bets.reduce((a,b)=>b.amount>a.amount?b:a);
    bets = bets.filter(b=>b!==biggest);
    logLines.push(`🃏 딜러가 가장 큰 베팅(${betName(biggest)}, ${fmt(biggest.amount)}칩)을 무효로 만들었다. (환불)`);
  }

  // 더블 베팅 대상: 남은 것 중 가장 큰 베팅
  let doubledBet = null;
  if(m.doubled && bets.length>0) doubledBet = bets.reduce((a,b)=>b.amount>a.amount?b:a);

  let profit = 0, loss = 0;
  const results = [];
  for(const b of bets){
    const hit = betHits(b.type, b.target, r);
    if(hit){
      let pay = BET_TYPES[b.type].payout;
      if(b.type==='straight' && m.neighbor) pay = 11;
      if(b.type==='straight' && hasC('gamblersoul')) pay = 50;
      if(b.type.startsWith('dozen') && hasT('dozenmap')) pay = 2.5;
      if(b.type==='black' && hasC('blackbalance')) pay *= 2;
      if(b===doubledBet) pay *= 2;
      if(actionActive('payoutDown')) pay *= 0.75;
      if(hasC('highroller')) pay *= 1.5;
      if(B.nextPayoutBonus>0) pay *= (1+B.nextPayoutBonus);
      const p = b.amount * pay;
      profit += p;
      results.push(`✅ ${betName(b)} 적중 +${fmt(p)}`);
    } else {
      let l = b.amount;
      if((r===0||r===DOUBLE_ZERO) && b.type!=='straight' && hasT('greencharm')) l *= 0.5;
      loss += l;
      results.push(`❌ ${betName(b)} 실패 -${fmt(l)}`);
    }
  }

  // 총 수익/손실 보정
  const rc = numColor(r);
  if(profit>0){
    if(m.allin) profit *= 1.5;
    if(hasT('goldchip')) profit *= 1.10;
    if(rc==='red' && hasT('redglove')) profit *= 1.25;
    if(rc==='black' && hasT('blackglove')) profit *= 1.25;
    if(hasT('streakbadge') && B.consecWins>0) profit *= (1 + Math.min(0.5, B.consecWins*0.1));
  }
  if(loss>0){
    if(m.allin) loss *= 1.25;
    if(hasC('blood')) loss *= 1.5;
    if(pressure) loss *= 1.3;
    if(m.safety) loss *= 0.5;
  }
  profit = Math.round(profit); loss = Math.round(loss);
  let net = profit - loss;

  // 보험 증서
  if(net<0 && B.consecLosses>=2 && hasT('insurance') && !B.insuranceUsed){
    B.insuranceUsed = true;
    logLines.push('📜 보험 증서 발동! 이번 손실이 0이 되었다.');
    net = 0; loss = 0;
  }

  G.money += net;

  // 금고 피해
  let dmg = 0;
  if(net>0){
    dmg = net;
    if(hasC('blood')) dmg = Math.round(dmg*1.5);
    if(m.zerohour && r===0){ const bonus = Math.round(B.maxVault*0.25); dmg += bonus; logLines.push(`🕛 제로 아워! 금고 추가 피해 ${fmt(bonus)}.`); }
    if(r===7 && hasT('lucky7')){ dmg += 30; logLines.push('🍀 행운의 7! 금고 추가 피해 30.'); }
    B.vault -= dmg;
    G.totalVaultDmg += dmg;
  }

  // 연승/연패
  if(net>0){ B.consecWins++; B.consecLosses=0; }
  else if(net<0){ B.consecLosses++; B.consecWins=0; }

  // 자원 회복 트리거
  if(m.redsense && rc==='red'){ B.focus = Math.min(G.maxFocus, B.focus+4); logLines.push('❤️ 붉은 예감: 포커스 +4.'); }
  if(hasT('evenring') && r>=1 && r<=36 && r%2===0){ B.focus = Math.min(G.maxFocus, B.focus+2); logLines.push('💍 짝수 반지: 포커스 +2.'); }

  // 검은 고양이 (다음 턴 배당)
  const hadBonus = B.nextPayoutBonus>0;
  B.nextPayoutBonus = 0;
  if(m.blackcat && rc==='black'){ B.nextPayoutBonus = 0.5; logLines.push('🐈‍⬛ 검은 고양이 발동: 다음 턴 모든 배당 +50%!'); }

  // 하우스 룰: 보스 2페이즈 0/00 벌금
  if(B.doubleZero && (r===0||r===DOUBLE_ZERO)){
    G.money -= 15;
    logLines.push('💀 하우스 룰: 0/00 적중 — 카지노가 자금 15를 걷어간다.');
  }
  // 자릿세
  if(actionActive('tax')){ G.money -= 8; logLines.push('💸 자릿세: 자금 -8.'); }
  // 시간 압박 계약
  if(hasC('timelimit') && B.turn>=9){ G.money -= 10; logLines.push('⏳ 시간 압박: 자금 -10.'); }
  // 카운터 칩
  if(B.currentAction.id!=='none' && !m.jam && hasT('counterchip')){
    B.focus = Math.min(G.maxFocus, B.focus+2);
    logLines.push('🪙 카운터 칩: 포커스 +2.');
  }

  // 보스: 당첨 숫자 기록 / 제거 액션
  if(net>0 && r!==DOUBLE_ZERO) B.wonNumbers.push(r);
  if(B.currentAction.id==='removeWon' && !m.jam && B.wonNumbers.length>0){
    const target = B.wonNumbers[B.wonNumbers.length-1];
    if(!B.removed.has(target) && target!==0){
      B.removed.add(target);
      logLines.push(`🚫 마담 루주가 숫자 <b>${numLabel(target)}</b> 를 룰렛에서 제거했다!`);
    }
  }

  B.history.push(r);
  B.lastSettle = { r, profit, loss, net, dmg, lines: results.concat(logLines) };
  showSettlePopup(B.lastSettle);
  blog(`— ${B.turn}턴 정산: ${net>=0?'+':''}${fmt(net)}칩 ${dmg>0?`/ 금고 피해 ${fmt(dmg)}`:''}`);
  results.concat(logLines).forEach(l=>blog(l));
  G.turnCount++;

  // 종료 판정
  if(B.vault<=0){ winBattle(); return; }
  if(G.money<=0){
    if(hasT('lastcoin') && !G.lastCoinUsed){
      G.lastCoinUsed = true; loseTrinket('lastcoin'); G.money = 1;
      blog('🪙 마지막 동전! 자금 1로 기적적으로 생존했다.');
    } else { gameOver(); return; }
  }

  // 보스 페이즈 전환
  if(B.dealer.tier==='boss' && !B.phase2Announced && B.vault <= B.maxVault*0.5){
    B.phase2Announced = true;
    B.doubleZero = true;
    blog('🔥 <b>마담 루주 2페이즈!</b> 휠에 00이 추가되고, 0/00 적중 시 자금을 15 빼앗긴다.');
  }

  // 다음 턴
  B.turn++;
  B.focus = Math.min(G.maxFocus, B.focus + 3 + (hasT('oldwatch')?1:0));
  B.bets = [];
  B.turnMods = freshMods();
  B.result = null;
  B.phase = 'bet';
  B.currentAction = B.nextAction;
  B.nextAction = rollDealerAction();
  render();
  // 정산 팝업이 사라진 뒤 새 턴의 딜러 행동을 팝업으로 공지
  const announcedTurn = B.turn;
  setTimeout(()=>{
    if(B && G.screen==='battle' && B.turn===announcedTurn && !B.spinning) showActionPopup();
  }, 2700);
}

function betName(b){
  return b.type==='straight' ? `스트레이트 ${numLabel(b.target)}` : BET_TYPES[b.type].name;
}

// ---------- 딜러 행동 팝업 ----------
function showActionPopup(){
  const a = B && B.currentAction;
  if(!a || a.id==='none') return;
  const old = document.getElementById('action-popup');
  if(old) old.remove();
  const div = document.createElement('div');
  div.id = 'action-popup';
  div.className = 'action-popup';
  div.innerHTML = `
    <div class="ap-title">🎩 딜러 행동 — ${a.name}</div>
    <div class="ap-desc">${a.desc}</div>`;
  document.body.appendChild(div);
  div.addEventListener('click', ()=>div.remove());
  setTimeout(()=>{ div.classList.add('out'); }, 2000);
  setTimeout(()=>{ div.remove(); }, 2500);
}

// ---------- 정산 팝업 ----------
function showSettlePopup(s){
  const old = document.getElementById('settle-popup');
  if(old) old.remove();
  const win = s.net>=0;
  const div = document.createElement('div');
  div.id = 'settle-popup';
  div.className = 'settle-popup ' + (win?'win':'lose');
  div.innerHTML = `
    <div class="sp-top">
      <span class="sp-ball c-${numColor(s.r)}">${numLabel(s.r)}</span>
      <span class="sp-net">${win?'+':''}${fmt(s.net)}칩</span>
    </div>
    ${s.dmg>0?`<div class="sp-dmg">🏦 금고 피해 ${fmt(s.dmg)}</div>`:''}
    <div class="sp-lines">${s.lines.map(l=>`<div>${l}</div>`).join('')}</div>`;
  document.body.appendChild(div);
  div.addEventListener('click', ()=>div.remove());
  setTimeout(()=>{ div.classList.add('out'); }, 2100);
  setTimeout(()=>{ div.remove(); }, 2600);
}

// ---------- 전투 종료 ----------
function winBattle(){
  G.battlesWon++;
  let reward = Math.round(B.dealer.reward * B.rewardMult);
  if(hasT('vaultkey')) reward += 25;
  if(hasC('timelimit') && B.turn<=8){ reward *= 2; }
  G.money += reward;
  let debtMsg = '';
  if(G.debt>0){
    const pay = Math.min(G.debt, 30, Math.max(0, G.money-1));
    G.debt -= pay; G.money -= pay;
    debtMsg = ` 대부업자가 ${fmt(pay)}칩을 걷어갔다.`;
  }
  const isBoss = B.dealer.tier==='boss';
  const title = `${B.dealer.name} 격파! 보상 +${fmt(reward)}칩.${debtMsg}`;
  if(isBoss){ G.screen='victory'; B=null; render(); return; }
  // 보상 카드 3장
  G.rewardTitle = title;
  G.rewardChoices = rollRewardChoices();
  G.screen = 'reward';
  B = null;
  render();
}

function rollRewardChoices(kindFilter){
  // 이벤트 전용: 기술 카드 3종 중 택1 (중복 보유 가능)
  if(kindFilter==='skill'){
    return shuffle(SKILLS.map(s=>({kind:'skill', id:s.id}))).slice(0,3);
  }
  // 전투 클리어 보상: 패시브(장신구)만
  const pool = TRINKETS.filter(t=>!G.trinkets.includes(t.id)).map(t=>({kind:'trinket', id:t.id}));
  const p = shuffle(pool).slice(0,3);
  while(p.length<3) p.push({kind:'money', amount:40+p.length*5}); // 풀 소진 대비
  return p;
}

function gameOver(){
  G.screen='gameover';
  B=null;
  render();
}

// ============================================================
// 전투 렌더링
// ============================================================
function renderBattle(){
  const d = B.dealer;
  const vaultPct = Math.max(0, B.vault/B.maxVault*100);
  const min = effMinBet();
  const pressure = bossPressure();
  const cands = candidateSet();

  // 하우스 룰 표시
  const rules = [];
  if(B.highroller) rules.push('하이롤러 테이블: 금고·보상·최소 베팅 증가');
  if(B.doubleZero) rules.push('00 추가됨 · 0/00 적중 시 자금 -15');
  if(pressure) rules.push('압박: 같은 색 연속 — 이번 턴 손실 +30%');
  if(B.nextPayoutBonus>0) rules.push('검은 고양이: 이번 턴 배당 +50%');
  if(B.removed.size>0) rules.push(`제거된 숫자: ${[...B.removed].map(numLabel).join(', ')}`);
  G.contracts.forEach(id=>{ const c=CONTRACTS.find(x=>x.id===id); rules.push(`계약 · ${c.name}: ${c.bad}`); });

  return `
  <div class="screen battle-screen ${B.pickingNumber?'picking':''}">
    <div class="battle-top">
      <div class="dealer-box">
        <div class="dealer-name">${d.tier==='boss'?'👑 ':''}${d.name} <span class="dealer-tier">${d.tier==='boss'?'구역 보스':d.tier==='elite'?'엘리트':'딜러'}</span></div>
        <div class="dealer-flavor">${d.flavor}</div>
        <div class="vault-bar"><div class="vault-fill" style="width:${vaultPct}%"></div>
          <span class="vault-text">🏦 금고 ${fmt(Math.max(0,B.vault))} / ${fmt(B.maxVault)}</span></div>
        <div class="dealer-actions">
          <div class="act now ${B.currentAction.id==='none'?'calm':''}">
            <div class="act-label">이번 턴 딜러 행동 · <b>${B.currentAction.name}</b>${B.turnMods.jam?' <span class="jammed">무효화됨</span>':''}</div>
            <div class="act-desc">${B.currentAction.desc}</div>
          </div>
          <div class="act next">
            <div class="act-label">다음 턴 예고 · <b>${B.nextAction.name}</b></div>
            <div class="act-desc">${B.nextAction.desc}</div>
          </div>
        </div>
        ${rules.length?`<div class="house-rules">${rules.map(r=>`<span>⚠ ${r}</span>`).join('')}</div>`:''}
      </div>
      <div class="player-box">
        <div class="pstat money">💰 자금 <b>${fmt(G.money)}</b></div>
        <div class="pstat">🧠 포커스 <b>${B.focus}</b>/${G.maxFocus}</div>
        <div class="pstat">🎲 ${B.turn}턴</div>
        <div class="pstat">최소 베팅 <b>${fmt(min)}</b></div>
        <div class="pstat small">후보 ${cands.length}칸</div>
      </div>
    </div>

    <div class="battle-mid">
      <div class="board-wrap">
        ${renderResultArea()}
        ${renderBoard(cands)}
        ${renderOutsideBets()}
        ${renderStakeBar(min)}
      </div>
      <div class="side-wrap">
        ${renderSkillBar()}
        <div class="log-panel">${B.log.slice(0,14).map(l=>`<div class="log-line">${l}</div>`).join('')}</div>
      </div>
    </div>
  </div>`;
}

// 보드 하단: 현재 베팅 현황 (한눈에)
function renderStakeBar(min){
  const canEdit = B.phase==='bet' && !B.spinning;
  if(B.bets.length===0){
    return `<div class="stake-bar empty">
      <span class="stake-total">아직 베팅 없음</span>
      <span class="stake-hint">숫자나 베팅 칸 클릭 = 칩 추가 · 우클릭/길게 = 회수 · 여러 곳 동시 베팅 가능</span>
    </div>`;
  }
  const pills = B.bets.map(b=>{
    const {p} = betProb(b.type, b.target);
    const warn = b.amount < min;
    return `<span class="stake-pill ${warn?'warn':''}" ${canEdit?`data-act="removeBet" data-arg="${b.key}"`:''} title="적중 확률 ${Math.round(p*100)}%${warn?' · 최소 베팅 미달':''}">
      ${betName(b)} <b>${fmt(b.amount)}</b>${warn?' ⚠':''}${canEdit?' <span class="pill-x">✕</span>':''}
    </span>`;
  }).join('');
  return `<div class="stake-bar">
    <span class="stake-total">🪙 총 베팅 <b>${fmt(totalStaked())}</b>칩 <span class="stake-sub">/ 자금 ${fmt(G.money)}</span></span>
    <span class="stake-pills">${pills}</span>
    ${canEdit?`<button class="btn-clear" data-act="clearBets">모두 취소</button>`:''}
  </div>`;
}

function renderResultArea(){
  if(B.spinning && B.spinStrip){
    const cands = new Set(candidateSet());
    const tiles = B.spinStrip.seq.map(n=>
      `<div class="strip-tile c-${numColor(n)} ${cands.has(n)?'':'dim'}">${numLabel(n)}</div>`).join('');
    return `<div class="result-area spinning">
      <div class="strip-box">
        <div class="strip-pointer">▼</div>
        <div class="strip-viewport"><div id="spin-strip" class="spin-strip">${tiles}</div></div>
      </div>
    </div>`;
  }
  if(B.phase==='post'){
    const r = B.result;
    const respinSkill = hasS('respin');
    const freeAvail = hasT('brokendice') && !B.freeRespinUsed;
    const canRespin = respinSkill && (freeAvail || B.focus>=4);
    const auto = !canRespin;
    return `<div class="result-area">
      <div class="spin-num c-${numColor(r)}">${numLabel(r)}</div>
      <div class="result-hint">${numColor(r)==='red'?'빨강':numColor(r)==='black'?'검정':'초록'} · ${r>=1&&r<=36?(r%2?'홀수':'짝수'):'-'}</div>
      <div class="post-actions">
        ${auto
          ? `<span class="auto-settle">⏳ 자동 정산 중…</span>`
          : `${respinSkill?`<button class="btn ${canRespin?'':'disabled'}" data-act="respin">🔄 리스핀 ${freeAvail?'(무료)':'(4 포커스)'}</button>`:''}
             <button class="btn gold" data-act="confirm">결과 확정</button>`}
      </div>
    </div>`;
  }
  const m = B.turnMods;
  const info = [];
  if(m.colorLock) info.push(`색: ${m.colorLock==='red'?'빨강':m.colorLock==='black'?'검정':'초록'}`);
  if(m.parityLock) info.push(`홀짝: ${m.parityLock==='odd'?'홀수':'짝수'}`);
  if(m.magnet) info.push('자석 적용됨');
  if(m.pruned.size) info.push(`배제 ${m.pruned.size}개`);
  return `<div class="result-area idle">
    <div class="spin-num idle">🎡</div>
    <div class="result-hint">${B.pickingNumber ? '🧲 자석의 중심 숫자를 보드에서 클릭!' : info.length?('감지: '+info.join(' · ')):'베팅 후 스핀'}</div>
    <div class="post-actions"><button class="btn gold big ${B.bets.length? '':'disabled'}" data-act="spin">🎡 스핀!</button></div>
  </div>`;
}

function renderBoard(cands){
  const candSet = new Set(cands);
  const cell = n => {
    const bet = B.bets.find(b=>b.type==='straight'&&b.target===n);
    const removed = B.removed.has(n);
    const dim = !candSet.has(n) && !removed;
    const magnetOn = B.turnMods.magnet && B.turnMods.magnet.has(n);
    return `<div class="num-cell c-${numColor(n)} ${removed?'removed':''} ${dim?'dim':''} ${magnetOn?'magnet':''} ${bet?'has-bet':''}"
      data-act="${B.pickingNumber?'pickMagnet':'betNum'}" ${B.pickingNumber?'':'data-ract="unbetNum"'} data-arg="${n}">
      ${numLabel(n)}${bet?`<span class="chip-mark">${fmt(bet.amount)}</span>`:''}
    </div>`;
  };
  // 실제 룰렛 테이블처럼 가로 배치: 12열 × 3행 (위 행이 3,6,…,36)
  let rows = '';
  for(let r=0;r<3;r++){
    const cells = [];
    for(let c=1;c<=12;c++) cells.push(cell(3*c - r));
    rows += `<div class="board-row">${cells.join('')}</div>`;
  }
  return `<div class="board">
    <div class="board-zero">${cell(0)}${B.doubleZero?cell(DOUBLE_ZERO):''}</div>
    <div class="board-grid">${rows}</div>
  </div>`;
}

function renderOutsideBets(){
  const btn = t => {
    const bt = BET_TYPES[t];
    const {p} = betProb(t, null);
    const blocked = betBlocked(t);
    const bet = B.bets.find(b=>b.type===t);
    let pay = bt.payout;
    if(t.startsWith('dozen') && hasT('dozenmap')) pay = 2.5;
    return `<div class="out-bet ${t==='red'?'ob-red':t==='black'?'ob-black':''} ${blocked?'blocked':''} ${bet?'has-bet':''}"
      data-act="betOut" data-ract="unbetOut" data-arg="${t}" title="${blocked||''}">
      <div class="ob-name">${bt.name}</div>
      <div class="ob-info">${Math.round(p*100)}% · ${pay}:1</div>
      ${bet?`<span class="chip-mark">${fmt(bet.amount)}</span>`:''}
    </div>`;
  };
  const chips = [5,10,25,50,100,'all'].map(v=>
    `<button class="chip-btn ${v==='all'?'allin':''} ${B.chip===v?'sel':''}" data-act="setChip" data-arg="${v}">${v==='all'?'올인':v}</button>`).join('');
  return `<div class="dozen-row">${['dozen1','dozen2','dozen3'].map(btn).join('')}</div>
    <div class="outside-bets">${['red','black','odd','even','low','high'].map(btn).join('')}</div>
    <div class="chip-row"><span class="chip-label">칩 단위</span>${chips}</div>`;
}

function renderSkillBar(){
  const counts = {};
  G.skills.forEach(id=>counts[id]=(counts[id]||0)+1);
  const btns = Object.keys(counts).map(id=>{
    const s = SKILLS.find(x=>x.id===id);
    const cost = skillCost(s);
    const ok = canUseSkill(s);
    const used = usedFlag(s.id) || (s.id==='breath'&&B.usedBreath>=2);
    return `<button class="skill-btn ${ok?'':'disabled'} ${used?'used':''}" data-act="useSkill" data-arg="${s.id}">
      <span class="sk-top">${s.name}${counts[id]>1?` <span class="sk-count">×${counts[id]}</span>`:''} <span class="cost">${cost}F</span>${used?' <span class="sk-used">사용됨</span>':''}</span>
      <span class="sk-desc">${s.desc}</span>
    </button>`;
  }).join('') || `<div class="sk-empty">기술 카드 없음<br><span class="small">암시장에서 사거나 이벤트로 얻는다. 1회용이며, 안 쓴 카드는 다음 전투로 이월.</span></div>`;
  const tr = G.trinkets.map(id=>{ const t=TRINKETS.find(x=>x.id===id); return `<span class="tag trinket" title="${t.desc}">${t.name}</span>`; }).join('');
  return `<div class="skill-bar"><div class="skill-head">기술 카드 (1회용 · 포커스 소비)</div>${btns}
    ${tr?`<div class="trinket-row">${tr}</div>`:''}</div>`;
}

// ============================================================
// 보상 / 상점 / 이벤트 / 라운지 / 대부업자
// ============================================================
function renderReward(){
  const cards = G.rewardChoices.map((c,i)=>{
    if(c.kind==='money'){
      return `<div class="pick-card" data-act="pickReward" data-arg="${i}">
        <div class="pick-kind">💰 칩</div>
        <div class="pick-name">칩 주머니</div>
        <div class="pick-desc">칩 ${fmt(c.amount)}개를 받는다.</div>
      </div>`;
    }
    const item = c.kind==='skill' ? SKILLS.find(s=>s.id===c.id) : TRINKETS.find(t=>t.id===c.id);
    return `<div class="pick-card" data-act="pickReward" data-arg="${i}">
      <div class="pick-kind">${c.kind==='skill'?'🎴 기술 카드 (1회용)':'💍 패시브 · 장신구'}</div>
      <div class="pick-name">${item.name}${c.kind==='skill'?` <span class="cost">${item.cost}F</span>`:''}</div>
      <div class="pick-desc">${item.desc}</div>
    </div>`;
  }).join('');
  return `<div class="screen reward-screen">
    ${runHeader()}
    <h2>🏆 승리!</h2>
    <p class="reward-title">${G.rewardTitle}</p>
    <p class="hint">보상을 하나 선택하세요.</p>
    <div class="pick-row">${cards}</div>
    <button class="btn ghost" data-act="skipReward">받지 않는다</button>
  </div>`;
}

function openShop(){
  const items = [];
  // 기술 카드는 1회용이라 보유 여부와 무관하게 판매 (중복 구매 가능)
  const skills = shuffle(SKILLS.slice()).slice(0,3);
  const trinkets = shuffle(TRINKETS.filter(t=>!G.trinkets.includes(t.id))).slice(0,2);
  const contracts = shuffle(CONTRACTS.filter(c=>!G.contracts.includes(c.id))).slice(0,1);
  skills.forEach(s=>items.push({kind:'skill', id:s.id, price:20+ri(4)*5}));
  trinkets.forEach(t=>items.push({kind:'trinket', id:t.id, price:55+ri(4)*5}));
  contracts.forEach(c=>items.push({kind:'contract', id:c.id, price:25}));
  G.shopItems = items;
  G.screen = 'shop';
  render();
}
function shopPrice(item){
  let p = item.price;
  if(hasT('vipcard')) p = Math.round(p*0.8);
  return p;
}
function renderShop(){
  const cards = G.shopItems.map((it,i)=>{
    if(it.sold) return `<div class="pick-card sold"><div class="pick-name">판매 완료</div></div>`;
    const item = it.kind==='skill' ? SKILLS.find(s=>s.id===it.id)
               : it.kind==='trinket' ? TRINKETS.find(t=>t.id===it.id)
               : CONTRACTS.find(c=>c.id===it.id);
    const price = shopPrice(it);
    const free = G.freeBuys>0;
    const afford = free || G.money > price;
    const kindLabel = it.kind==='skill'?'🎴 기술 카드 (1회용)':it.kind==='trinket'?'💍 패시브 · 장신구':'📜 계약';
    return `<div class="pick-card ${afford?'':'cant'}" data-act="buyItem" data-arg="${i}">
      <div class="pick-kind">${kindLabel}</div>
      <div class="pick-name">${item.name}</div>
      <div class="pick-desc">${item.desc}</div>
      <div class="pick-price">${free?'무료 (수전노 계약)':fmt(price)+'칩'}</div>
    </div>`;
  }).join('');
  return `<div class="screen shop-screen">
    ${runHeader()}
    <h2>🕶️ 암시장</h2>
    <p class="hint">자금은 생명이다. 소비가 곧 위험 선택이다.</p>
    <div class="pick-row">${cards}</div>
    <button class="btn gold" data-act="leaveNode">떠난다</button>
  </div>`;
}

function openEvent(){
  const avail = EVENTS.filter(e=>!G.usedEvents.includes(e.id));
  const ev = choice(avail.length?avail:EVENTS);
  G.usedEvents.push(ev.id);
  G.event = ev;
  G.eventResult = null;
  G.screen = 'event';
  render();
}
function evCondOk(cond){
  if(!cond) return true;
  const m = cond.match(/money>=(\d+)/);
  if(m) return G.money >= Number(m[1]);
  return true;
}
function renderEvent(){
  const ev = G.event;
  if(G.eventResult){
    return `<div class="screen event-screen">
      ${runHeader()}
      <h2>❓ ${ev.title}</h2>
      <p class="event-text">${G.eventResult}</p>
      <button class="btn gold" data-act="leaveNode">계속</button>
    </div>`;
  }
  const btns = ev.choices.map((c,i)=>{
    const ok = evCondOk(c.cond);
    return `<button class="btn choice ${ok?'':'disabled'}" data-act="eventChoice" data-arg="${i}">${c.text}</button>`;
  }).join('');
  return `<div class="screen event-screen">
    ${runHeader()}
    <h2>❓ ${ev.title}</h2>
    <p class="event-text">${ev.text}</p>
    <div class="choice-col">${btns}</div>
  </div>`;
}

function resolveEvent(i){
  const c = G.event.choices[Number(i)];
  if(!evCondOk(c.cond)) return;
  const eff = c.effect;
  let msg = '';
  const [kind, ...args] = eff.split(':');
  switch(kind){
    case 'none': msg = '아무 일도 일어나지 않았다.'; break;
    case 'money': {
      const v = Number(args[0]); G.money += v;
      msg = v>=0 ? `칩 ${fmt(v)}개를 얻었다.` : `칩 ${fmt(-v)}개를 잃었다.`;
      break;
    }
    case 'gamble': {
      const win = Number(args[0]), lose = Number(args[1]), p = Number(args[2]);
      if(rnd()<p){ G.money += win; msg = `성공! 칩 ${fmt(win)}개를 얻었다.`; }
      else { G.money += lose; msg = `실패… 칩 ${fmt(-lose)}개를 잃었다.`; }
      break;
    }
    case 'buyFocus': {
      G.money -= Number(args[0]); G.maxFocus += Number(args[1]);
      msg = `최대 포커스가 ${args[1]} 증가했다. (현재 ${G.maxFocus})`;
      break;
    }
    case 'confiscate': {
      if(G.trinkets.length>0){
        const t = choice(G.trinkets); loseTrinket(t);
        msg = `경비원이 장신구 '${TRINKETS.find(x=>x.id===t).name}'을(를) 압수했다.`;
      } else { G.money -= 40; msg = '가진 게 없다고 하자 벌금 40칩을 물렸다.'; }
      break;
    }
    case 'freeTrinket': {
      const pool = TRINKETS.filter(t=>!G.trinkets.includes(t.id));
      if(pool.length){ const t = choice(pool); gainTrinket(t.id); msg = `장신구 '${t.name}' 획득! — ${t.desc}`; }
      else { G.money += 30; msg = '더 가질 게 없어 칩 30개를 받았다.'; }
      break;
    }
    case 'vipPickup': {
      if(gainTrinket('vipcard')) msg = "장신구 'VIP 카드' 획득!";
      else { G.money += 30; msg = '이미 VIP다. 카드를 팔아 30칩을 챙겼다.'; }
      if(rnd()<0.3){ G.money -= 30; msg += ' …그러나 경비에게 들켜 벌금 30칩!'; }
      break;
    }
    case 'magnetDiscount': G.magnetDiscount++; msg = '휠이 손질됐다. 자석의 포커스 비용 -1.'; break;
    case 'vaultInfo': G.nextVaultMod = 0.8; msg = '다음 전투의 금고가 20% 작아진다.'; break;
    case 'freeSkill': {
      G.rewardTitle = '옛 동료의 가르침 — 기술을 하나 배운다.';
      G.rewardChoices = rollRewardChoices('skill');
      G.screen = 'reward'; render(); return;
    }
    case 'cursedChips': {
      G.money += 100; gainContract('blood');
      msg = '칩 100개를 얻었다. …그리고 피의 계약이 몸에 새겨졌다. (금고 피해 +50% / 손실 +50%)';
      break;
    }
    case 'blueprint': G.nextVaultDmg = 0.15; msg = '설계도를 외웠다. 다음 전투 시작 시 금고에 15% 피해.'; break;
  }
  if(G.money<=0){
    if(hasT('lastcoin') && !G.lastCoinUsed){ G.lastCoinUsed=true; loseTrinket('lastcoin'); G.money=1; msg += ' — 마지막 동전으로 겨우 생존했다!'; }
    else { gameOver(); return; }
  }
  G.eventResult = msg;
  render();
}

function renderLounge(){
  const blocked = hasC('miser');
  return `<div class="screen lounge-screen">
    ${runHeader()}
    <h2>🛋️ 라운지</h2>
    ${blocked
      ? `<p class="event-text">수전노 계약 때문에 라운지 출입이 거부됐다. 문전박대다.</p>
         <button class="btn gold" data-act="leaveNode">떠난다</button>`
      : `<p class="event-text">조용한 음악과 부드러운 소파. 잠시 숨을 고른다.</p>
         <div class="choice-col">
           <button class="btn choice" data-act="loungeMoney">💰 공짜 칩을 챙긴다 (+40칩)</button>
           <button class="btn choice" data-act="loungeFocus">🧠 명상한다 (최대 포커스 +1)</button>
         </div>`}
  </div>`;
}

function renderLoan(){
  const interest = hasT('loanpaper') ? 20 : 40;
  const debt = 80 + interest;
  return `<div class="screen loan-screen">
    ${runHeader()}
    <h2>🦈 대부업자</h2>
    ${G.usedLoan
      ? `<p class="event-text">"한 번 빌려줬으면 됐지. 이자나 갚아."</p>
         <button class="btn gold" data-act="leaveNode">떠난다</button>`
      : `<p class="event-text">"지금 당장 80칩. 대신 총 ${debt}칩을 갚아야 해. 전투에서 이길 때마다 30칩씩 걷어가겠어."</p>
         <div class="choice-col">
           <button class="btn choice" data-act="takeLoan">💵 빌린다 (+80칩, 부채 ${debt})</button>
           <button class="btn choice" data-act="leaveNode">거절한다</button>
         </div>`}
  </div>`;
}

// ---------- 종료 화면 ----------
function calcFame(win){
  return Math.round(G.totalVaultDmg/5) + G.battlesWon*10 + (win?100:0);
}
function renderGameOver(){
  return `<div class="screen end-screen">
    <h1 class="lose-title">파산</h1>
    <p class="event-text">자금이 바닥났다. 카지노의 불빛이 등 뒤에서 꺼진다.</p>
    ${endStats(false)}
    <p class="hint">패배 원인을 운이 아니라 선택으로 설명할 수 있는가? 다음 런에서 바꿔보자.</p>
    <button class="btn gold big" data-act="restart">다시 도전</button>
  </div>`;
}
function renderVictory(){
  return `<div class="screen end-screen">
    <h1 class="win-title">카지노 파산!</h1>
    <p class="event-text">마담 루주의 금고가 텅 비었다. 구역 1의 지배자는 무너졌다.</p>
    ${endStats(true)}
    <p class="hint">명성으로 새 캐릭터와 콘텐츠가 해금될 예정이다. (차기 버전)</p>
    <button class="btn gold big" data-act="restart">새 런 시작</button>
  </div>`;
}
function endStats(win){
  return `<div class="end-stats">
    <div>⭐ 명성 <b>${fmt(calcFame(win))}</b></div>
    <div>💥 총 금고 피해 <b>${fmt(G.totalVaultDmg)}</b></div>
    <div>🏆 격파한 딜러 <b>${G.battlesWon}</b></div>
    <div>🎲 총 턴 수 <b>${G.turnCount}</b></div>
    <div>💰 최종 자금 <b>${fmt(Math.max(0,G.money))}</b></div>
  </div>`;
}

// ============================================================
// 액션 테이블
// ============================================================
const ACTIONS = {
  startRun(){ newRun(); render(); },
  restart(){ newRun(); G.screen='title'; render(); },
  enterNode(ni){ enterNode(ni); },
  leaveNode(){ advanceLayer(); },

  // 전투
  betNum(n){ placeBet('straight', Number(n)); },
  betOut(t){ placeBet(t, null); },
  setChip(v){ B.chip = v==='all' ? 'all' : Number(v); render(); },
  removeBet(key){ removeBet(key); },
  unbetNum(n){ unbet('straight', Number(n)); },
  unbetOut(t){ unbet(t, null); },
  clearBets(){ clearBets(); },
  useSkill(id){ useSkill(id); },
  pickMagnet(n){ pickMagnetNumber(n); },
  spin(){ trySpin(); },
  respin(){ useSkill('respin'); },
  confirm(){ confirmResult(); },

  // 보상
  pickReward(i){
    const c = G.rewardChoices[Number(i)];
    if(c.kind==='skill') G.skills.push(c.id);
    else if(c.kind==='trinket') gainTrinket(c.id);
    else if(c.kind==='money') G.money += c.amount;
    advanceLayer();
  },
  skipReward(){ advanceLayer(); },

  // 상점
  buyItem(i){
    const it = G.shopItems[Number(i)];
    if(!it || it.sold) return;
    const price = shopPrice(it);
    const free = G.freeBuys>0;
    if(!free && G.money <= price) return;
    if(free) G.freeBuys--;
    else G.money -= price;
    if(it.kind==='skill') G.skills.push(it.id);
    else if(it.kind==='trinket') gainTrinket(it.id);
    else gainContract(it.id);
    it.sold = true;
    render();
  },

  // 이벤트
  eventChoice(i){ resolveEvent(i); },

  // 라운지 / 대출
  loungeMoney(){ G.money += 40; advanceLayer(); },
  loungeFocus(){ G.maxFocus += 1; advanceLayer(); },
  takeLoan(){
    const interest = hasT('loanpaper') ? 20 : 40;
    G.money += 80; G.debt = 80 + interest; G.usedLoan = true;
    advanceLayer();
  },
};

// ---------- 부팅 ----------
document.getElementById('version-badge').textContent = `HOUSEBREAKER ${GAME_VERSION} (${GAME_BUILD_DATE})`;
G = null;
newRun();
G.screen = 'title';
render();
