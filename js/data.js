// ============================================================
// HOUSEBREAKER — 데이터 정의 (기획서 v0.1 MVP 기준)
// 캐릭터: 루비(룰렛) / 기술 15 / 장신구 20 / 계약 6
// 딜러 5 + 엘리트 1 + 보스 1 / 이벤트 10
// ============================================================

// 유럽식 룰렛 휠 순서 (물리적 배치)
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_SET = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const DOUBLE_ZERO = 37; // '00' 표기용 내부 값

function numColor(n){
  if(n===0||n===DOUBLE_ZERO) return 'green';
  return RED_SET.has(n) ? 'red' : 'black';
}
function numLabel(n){ return n===DOUBLE_ZERO ? '00' : String(n); }

// ---------------- 베팅 종류 ----------------
// payout = 순수익 배수 (1:1 → 1, 2:1 → 2, 35:1 → 35)
const BET_TYPES = {
  red:    { name:'빨강',   payout:1,  test:n=>numColor(n)==='red' },
  black:  { name:'검정',   payout:1,  test:n=>numColor(n)==='black' },
  odd:    { name:'홀수',   payout:1,  test:n=>n>=1&&n<=36&&n%2===1 },
  even:   { name:'짝수',   payout:1,  test:n=>n>=1&&n<=36&&n%2===0 },
  low:    { name:'로우(1-18)',  payout:1, test:n=>n>=1&&n<=18 },
  high:   { name:'하이(19-36)', payout:1, test:n=>n>=19&&n<=36 },
  dozen1: { name:'1st 더즌(1-12)',  payout:2, test:n=>n>=1&&n<=12 },
  dozen2: { name:'2nd 더즌(13-24)', payout:2, test:n=>n>=13&&n<=24 },
  dozen3: { name:'3rd 더즌(25-36)', payout:2, test:n=>n>=25&&n<=36 },
  straight:{ name:'스트레이트', payout:35, test:(n,t)=>n===t },
};

// ---------------- 기술 15종 (루비 / 포커스) ----------------
// phase: 'bet'(베팅 단계 사용) | 'post'(결과 공개 후 사용)
const SKILLS = [
  { id:'magnet', name:'자석', cost:3, phase:'bet', pick:'number',
    desc:'숫자 하나를 선택. 이번 스핀 결과 후보를 휠에서 그 숫자 주변 9칸으로 제한한다.' },
  { id:'double', name:'더블 베팅', cost:2, phase:'bet',
    desc:'이번 턴 가장 큰 베팅 하나의 배당이 2배가 된다.' },
  { id:'blackcat', name:'검은 고양이', cost:1, phase:'bet',
    desc:'이번 턴 검정 적중 시, 다음 턴 모든 배당 +50%.' },
  { id:'zerohour', name:'제로 아워', cost:2, phase:'bet',
    desc:'이번 턴 0 적중 시, 카지노 금고에 최대 금고의 25% 추가 피해.' },
  { id:'respin', name:'리스핀', cost:4, phase:'post',
    desc:'공개된 결과를 버리고 한 번 다시 돌린다.' },
  { id:'parity', name:'홀짝 투시', cost:2, phase:'bet',
    desc:'스핀 전에 이번 결과의 홀/짝을 미리 확인한다.' },
  { id:'colorsight', name:'색 투시', cost:2, phase:'bet',
    desc:'스핀 전에 이번 결과의 색을 미리 확인한다.' },
  { id:'breath', name:'심호흡', cost:0, phase:'bet', perBattle:2,
    desc:'포커스를 4 회복한다. 전투당 2회 사용 가능.' },
  { id:'safety', name:'안전망', cost:2, phase:'bet',
    desc:'이번 턴 손실이 50% 감소한다.' },
  { id:'allin', name:'올인 감각', cost:3, phase:'bet',
    desc:'이번 턴 순수익 +50%, 대신 손실 +25%.' },
  { id:'prune', name:'숫자 배제', cost:2, phase:'bet',
    desc:'내 베팅이 걸리지 않은 숫자 5개를 이번 스핀 후보에서 제거한다.' },
  { id:'jam', name:'딜러 방해', cost:3, phase:'bet',
    desc:'이번 턴 딜러의 방해 효과를 무효화한다.' },
  { id:'neighbor', name:'이웃 베팅', cost:1, phase:'bet',
    desc:'이번 턴 스트레이트 베팅이 휠의 양옆 숫자에도 적중한다(배당은 11배로).' },
  { id:'redsense', name:'붉은 예감', cost:1, phase:'bet',
    desc:'이번 턴 빨강 적중 시 포커스를 4 회복한다.' },
  { id:'greenshield', name:'그린 실드', cost:2, phase:'bet',
    desc:'이번 턴 0(또는 00)이 나오면 자동으로 1회 다시 돌린다.' },
];

// ---------------- 장신구 20종 ----------------
const TRINKETS = [
  { id:'brokendice', name:'깨진 주사위', desc:'전투당 첫 리스핀이 무료다.' },
  { id:'redglove', name:'붉은 장갑', desc:'빨강 적중 시 순수익 +25%.' },
  { id:'blackglove', name:'검은 장갑', desc:'검정 적중 시 순수익 +25%.' },
  { id:'glasses', name:'딜러의 안경', desc:'매 전투 첫 턴에 결과의 색을 미리 보여준다.' },
  { id:'lastcoin', name:'마지막 동전', desc:'파산 피해를 처음 받을 때 자금 1로 생존한다. (1회용)' },
  { id:'vipcard', name:'VIP 카드', desc:'상점 가격이 20% 감소한다.' },
  { id:'greencharm', name:'초록 부적', desc:'0이 나왔을 때 외부 베팅 손실이 절반이 된다.' },
  { id:'oldwatch', name:'오래된 시계', desc:'매 턴 포커스 회복 +1.' },
  { id:'leadball', name:'납 공', desc:'자석의 포커스 비용 -1.' },
  { id:'goldchip', name:'도금 칩', desc:'승리 정산 시 순수익 +10%.' },
  { id:'insurance', name:'보험 증서', desc:'2연패 후의 패배 1회는 손실이 0이 된다. (전투당 1회)' },
  { id:'lucky7', name:'행운의 7', desc:'7 적중 시 금고에 추가 피해 30.' },
  { id:'evenring', name:'짝수 반지', desc:'짝수 적중 시 포커스 +2.' },
  { id:'loanpaper', name:'대출 감면서', desc:'대부업자 이자가 절반이 된다.' },
  { id:'counterchip', name:'카운터 칩', desc:'딜러의 방해 효과가 발동할 때마다 포커스 +2.' },
  { id:'dozenmap', name:'더즌 지도', desc:'더즌 베팅의 배당이 2배 → 2.5배가 된다.' },
  { id:'steelheart', name:'강철 심장', desc:'테이블의 최소 베팅 규칙을 무시한다.' },
  { id:'vaultkey', name:'금고 열쇠', desc:'전투 승리 보상 +25칩.' },
  { id:'extrapocket', name:'여분 주머니', desc:'최대 포커스 +3.' },
  { id:'streakbadge', name:'연승 배지', desc:'연속 승리 턴마다 순수익 +10% (최대 +50%).' },
];

// ---------------- 계약 6종 ----------------
const CONTRACTS = [
  { id:'highroller', name:'하이롤러 계약', good:'모든 배당 +50%', bad:'모든 테이블 최소 베팅 2배',
    desc:'모든 배당 +50%. 대신 최소 베팅이 2배가 된다.' },
  { id:'blood', name:'피의 계약', good:'금고 피해 +50%', bad:'패배 손실 +50%',
    desc:'금고에 주는 피해 +50%. 대신 패배 시 손실도 +50%.' },
  { id:'blackbalance', name:'검은 균형', good:'검정 배당 +100%', bad:'빨강 베팅 불가',
    desc:'검정 배당이 2배가 된다. 대신 빨강에 베팅할 수 없다.' },
  { id:'miser', name:'수전노 계약', good:'상점 1회 무료', bad:'라운지 이용 불가',
    desc:'상점에서 1개를 무료로 얻는다. 대신 라운지를 이용할 수 없다.' },
  { id:'gamblersoul', name:'도박꾼의 혼', good:'스트레이트 배당 50배', bad:'1:1 베팅(빨강/검정/홀짝/하이로우) 불가',
    desc:'스트레이트 배당이 50배가 된다. 대신 1:1 베팅이 모두 봉쇄된다.' },
  { id:'timelimit', name:'시간 압박', good:'8턴 내 승리 시 보상 2배', bad:'9턴부터 매 턴 자금 -10',
    desc:'8턴 안에 승리하면 전투 보상 2배. 9턴부터는 매 턴 자금 10을 잃는다.' },
];

// ---------------- 딜러 행동 ----------------
// 딜러 행동은 한 턴 전에 예고된다 (기획서: 정보 원칙)
const DEALER_ACTIONS = {
  none:      { id:'none', name:'대기', desc:'딜러가 조용히 카드를 정리한다. 방해 없음.' },
  blockRed:  { id:'blockRed', name:'빨강 봉쇄', desc:'이번 턴 빨강 베팅이 봉쇄된다.' },
  blockBlack:{ id:'blockBlack', name:'검정 봉쇄', desc:'이번 턴 검정 베팅이 봉쇄된다.' },
  payoutDown:{ id:'payoutDown', name:'배당 인하', desc:'이번 턴 모든 배당 -25%.' },
  minBetUp:  { id:'minBetUp', name:'판돈 인상', desc:'이번 턴 최소 베팅이 2배가 된다.' },
  tax:       { id:'tax', name:'자릿세', desc:'이번 턴 정산 후 자금 8을 걷어간다.' },
  nullify:   { id:'nullify', name:'베팅 무효', desc:'이번 턴 가장 큰 베팅 하나가 무효(환불)된다.' },
};

// ---------------- 딜러 7종 (일반 5 + 엘리트 1 + 보스 1) ----------------
const DEALERS = [
  { id:'tommy', name:'신입 딜러 토미', tier:'normal', vault:60, minBet:5, reward:30,
    flavor:'긴장한 신입. 실수도 잦고 방해도 서툴다.',
    actions:['tax','tax','minBetUp'] },
  { id:'vera', name:'냉정한 베라', tier:'normal', vault:80, minBet:5, reward:35,
    flavor:'색 베팅을 노려보다 봉쇄해버리는 냉혈한.',
    actions:['blockRed','blockBlack','tax'] },
  { id:'otto', name:'수학자 오토', tier:'normal', vault:80, minBet:8, reward:35,
    flavor:'하우스 엣지를 사랑하는 계산가. 배당을 깎는다.',
    actions:['payoutDown','payoutDown','tax'] },
  { id:'finn', name:'사기꾼 핀', tier:'normal', vault:90, minBet:8, reward:40,
    flavor:'제일 큰 베팅을 슬쩍 무효로 만드는 손버릇.',
    actions:['nullify','tax','minBetUp'] },
  { id:'greta', name:'철벽 그레타', tier:'normal', vault:100, minBet:10, reward:45,
    flavor:'판돈을 끌어올려 소액 플레이를 말려 죽인다.',
    actions:['minBetUp','minBetUp','tax'] },
  { id:'max', name:'골든 롤러 막스', tier:'elite', vault:200, minBet:15, reward:90,
    flavor:'엘리트 딜러. 매 턴 무언가를 걸고 넘어진다.',
    actions:['blockRed','payoutDown','minBetUp','nullify','blockBlack','tax'] },
  { id:'rouge', name:'마담 루주', tier:'boss', vault:400, minBet:15, reward:200,
    flavor:'룰렛 구역의 지배자. 안전한 베팅을 봉쇄하고 위험한 숫자 베팅을 유도한다.',
    actions:[] }, // 보스는 전용 페이즈 로직 사용
];

// ---------------- 이벤트 10종 ----------------
// effect 는 game.js 에서 id 로 처리
const EVENTS = [
  { id:'drunk', title:'취한 하이롤러',
    text:'만취한 하이롤러가 칩을 흘리며 비틀거린다.',
    choices:[
      { text:'부축해준다 (+30칩)', effect:'money:30' },
      { text:'지갑을 노린다 (50% +80칩 / 50% -40칩)', effect:'gamble:80:-40:0.5' },
    ]},
  { id:'shadydealer', title:'수상한 딜러의 제안',
    text:'"집중력을 끌어올리는 약이 있어. 값은... 칩 30이면 돼."',
    choices:[
      { text:'구매한다 (-30칩, 최대 포커스 +2)', effect:'buyFocus:30:2', cond:'money>=30' },
      { text:'거절한다', effect:'none' },
    ]},
  { id:'oldslot', title:'버려진 슬롯머신',
    text:'창고 구석의 낡은 슬롯머신. 아직 전원이 들어온다.',
    choices:[
      { text:'돌려본다 (25% 확률 +100칩, 실패 시 -20칩)', effect:'gamble:100:-20:0.25', cond:'money>=20' },
      { text:'지나친다', effect:'none' },
    ]},
  { id:'guard', title:'경비원의 검문',
    text:'"여기서 뭘 하는 거지? 소지품 좀 봅시다."',
    choices:[
      { text:'뇌물을 준다 (-25칩)', effect:'money:-25', cond:'money>=25' },
      { text:'몸수색을 받는다 (장신구 1개 압수, 없으면 -40칩)', effect:'confiscate' },
    ]},
  { id:'cleaner', title:'카지노 청소부',
    text:'"손님들이 흘리고 간 물건이 많아요. 하나 가져가실래요?"',
    choices:[
      { text:'장신구를 받는다', effect:'freeTrinket' },
      { text:'사양한다 (+15칩을 쥐여준다)', effect:'money:15' },
    ]},
  { id:'vipdrop', title:'떨어진 VIP 카드',
    text:'바닥에 반짝이는 VIP 카드가 떨어져 있다. 주변에 경비가 있다.',
    choices:[
      { text:'줍는다 (VIP 카드 획득, 30% 확률 -30칩)', effect:'vipPickup' },
      { text:'놔둔다', effect:'none' },
    ]},
  { id:'mechanic', title:'룰렛 수리공',
    text:'"휠의 자기장을 손봐줄까? 아니면... 금고 배선 정보를 줄 수도 있고."',
    choices:[
      { text:'휠을 손본다 (자석 비용 -1)', effect:'magnetDiscount' },
      { text:'금고 정보를 받는다 (다음 전투 금고 -20%)', effect:'vaultInfo' },
    ]},
  { id:'oldfriend', title:'옛 동료',
    text:'"너 아직도 그 버릇 못 고쳤구나. 내가 기술 하나 가르쳐줄까?"',
    choices:[
      { text:'기술을 배운다 (기술 획득)', effect:'freeSkill' },
      { text:'대신 돈을 빌린다 (+40칩)', effect:'money:40' },
    ]},
  { id:'cursedchip', title:'저주받은 칩',
    text:'검붉게 빛나는 칩 무더기. 손을 대면 되돌릴 수 없을 것 같다.',
    choices:[
      { text:'가져간다 (+100칩, 피의 계약 체결)', effect:'cursedChips' },
      { text:'거절한다', effect:'none' },
    ]},
  { id:'blueprint', title:'금고 설계도',
    text:'환풍구에서 떨어진 서류 뭉치. 금고 설계도다.',
    choices:[
      { text:'외운다 (다음 전투 시작 시 금고 15% 피해)', effect:'blueprint' },
      { text:'장물아비에게 판다 (+35칩)', effect:'money:35' },
    ]},
];

// ---------------- 맵 노드 타입 ----------------
const NODE_TYPES = {
  battle:   { icon:'🎰', name:'일반 테이블', desc:'기본 전투. 자금과 보상을 얻는다.', danger:'●○○' },
  highroller:{ icon:'💎', name:'하이롤러 테이블', desc:'최소 베팅과 금고가 크다. 보상 2배.', danger:'●●●' },
  shop:     { icon:'🕶️', name:'암시장', desc:'기술·장신구·계약을 구매한다.', danger:'○○○' },
  loan:     { icon:'🦈', name:'대부업자', desc:'즉시 자금을 얻고 이자를 갚는다.', danger:'●●○' },
  lounge:   { icon:'🛋️', name:'라운지', desc:'자금을 회복하거나 정비한다.', danger:'○○○' },
  event:    { icon:'❓', name:'이벤트', desc:'무슨 일이 일어날지 모른다.', danger:'●●○' },
  elite:    { icon:'👑', name:'엘리트 딜러', desc:'강력한 딜러. 보상이 크다.', danger:'●●●' },
  boss:     { icon:'🏦', name:'금고', desc:'구역 보스 마담 루주와 대결한다.', danger:'●●●' },
};
