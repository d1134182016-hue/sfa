import {
  state, fmt, money, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, fmtShort, mountBetRange
} from '../core.js';
import {
  makeDeck, shuffle, dealCard, flip, clearCards, handValue, cardName
} from '../cards.js';
import { getChallenge, challengeActive, challengeResult, onChallengeAbort } from '../challenge.js';
import {
  cardOptions, parseCardId, setPending, drawWithCheat, mountCheatDock
} from '../cheat.js';

const root = () => document.getElementById('view-blackjack');
let shoe = [];
let bet = 50000;
let roundBet = 0;
let busy = false;
let player = [];
let dealer = [];
let holeEl = null;
let resolver = null;
let els = {};
let challenge = null;
let roundSeq = 0;

const CHIPS = [10000, 50000, 200000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;

function ensureShoe() {
  if (shoe.length < 60) {
    shoe = shuffle(makeDeck(6));
    toast('牌靴重新洗牌（6 副牌）');
  }
}

function totalText(hand) {
  const v = handValue(hand);
  if (v.bust) return '爆牌 ' + v.total;
  if (v.total === 21 && hand.length === 2) return '21';
  return String(v.total) + (v.soft ? ' (軟)' : '');
}

function updateTotals(reveal = false) {
  if (!els.playerTotal) return;
  const pv = handValue(player);
  els.playerTotal.textContent = totalText(player);
  els.playerTotal.className = 'bj-total' + (pv.bust ? ' bust' : pv.soft ? ' soft' : '');
  if (reveal) {
    const dv = handValue(dealer);
    els.dealerTotal.textContent = totalText(dealer);
    els.dealerTotal.className = 'bj-total' + (dv.bust ? ' bust' : dv.soft ? ' soft' : '');
    els.dealerLabel.textContent = dv.bust ? '爆牌' : dv.blackjack ? 'BLACKJACK' : '莊家';
  } else {
    els.dealerTotal.textContent = dealer.length ? String(handValue([dealer[0]]).total) : '—';
    els.dealerTotal.className = 'bj-total';
    els.dealerLabel.textContent = '莊家';
  }
}

function status(msg, warn = false) {
  if (!els.status) return;
  els.status.textContent = msg || '';
  els.status.className = 'status-line' + (warn ? ' warn' : '');
}

function syncControls() {
  if (!els.deal) return;
  const playerTurn = !!resolver;
  const inChallenge = !!challenge;
  els.deal.disabled = inChallenge || busy || bet <= 0 || state.cash < bet || state.locked;
  els.hit.disabled = !playerTurn;
  els.stand.disabled = !playerTurn;
  els.double.disabled = inChallenge || !playerTurn || player.length !== 2 || state.cash < roundBet;
  els.chips.forEach(chip => { chip.disabled = busy || inChallenge; });
  els.clearBet.disabled = busy || inChallenge || bet <= 0;
  if (els.bet) els.bet.textContent = fmt(busy ? roundBet : bet);
  if (els.range) {
    els.range.sync(busy ? roundBet : bet);
    els.range.setDisabled(busy || inChallenge);
  }
  if (!inChallenge && !busy && !playerTurn && state.cash < 10000) status('現金不足，去借一點或換個賭桌吧。', true);
}

function setBadge(text, kind = '') {
  if (!els.badge) return;
  els.badge.textContent = text;
  els.badge.className = 'table-badge' + (kind ? ' ' + kind : '');
  els.badge.classList.add('show');
}
function hideBadge() {
  if (els.badge) els.badge.classList.remove('show');
}

function syncChallengeUI(on, member = '') {
  const el = root();
  if (!el) return;
  const guest = !!(challenge && challenge.mode === 'guest');
  const h2 = el.querySelector('.game-head h2');
  const sub = el.querySelector('.game-head .sub');
  const group = el.querySelector('#bj-bet-group');
  const display = el.querySelector('#bj-bet-display');
  if (h2) h2.textContent = on ? '21 點 · 挑戰' : '21 點';
  if (sub) sub.textContent = on
    ? (guest ? `vs ${member} · 賭博邀請 · 平手退注` : `vs ${member} · 單局決勝 · 平手算學生會勝`)
    : '6 副牌 · 莊家 17 停 · Blackjack 3:2';
  if (group) group.classList.toggle('hidden', on);
  if (display) {
    if (on) {
      display.textContent = guest ? `賭博邀請 · 下注 ${fmt(challenge.wager)}` : '賭的是學生會的位子';
      els.bet = null;
    } else {
      display.innerHTML = `本局押注 <b id="bj-bet">${fmt(bet)}</b>`;
      els.bet = el.querySelector('#bj-bet');
    }
  }
  if (els.deal) els.deal.classList.toggle('hidden', on);
}

function resetTable() {
  roundSeq += 1;
  bet = Math.max(10000, Math.min(50000, Math.max(10000, state.cash)));
  roundBet = 0;
  busy = false;
  resolver = null;
  player = [];
  dealer = [];
  holeEl = null;
  if (els.playerHand) els.playerHand.innerHTML = '';
  if (els.dealerHand) els.dealerHand.innerHTML = '';
  if (els.playerTotal) els.playerTotal.textContent = '—';
  if (els.dealerTotal) els.dealerTotal.textContent = '—';
  if (els.dealerLabel) els.dealerLabel.textContent = '莊家';
  hideBadge();
  updateTotals(false);
  status('下注，然後發牌。');
  if (els.msg) els.msg.textContent = '下注，然後發牌。';
}

function setupChallenge(ch) {
  challenge = ch;
  onChallengeAbort(() => {
    roundSeq += 1;
    challenge = null;
    busy = false;
    resolver = null;
  });
  bet = 0;
  roundBet = 0;
  busy = false;
  resolver = null;
  player = [];
  dealer = [];
  holeEl = null;
  if (els.playerHand) els.playerHand.innerHTML = '';
  if (els.dealerHand) els.dealerHand.innerHTML = '';
  if (els.playerTotal) els.playerTotal.textContent = '—';
  if (els.dealerTotal) els.dealerTotal.textContent = '—';
  if (els.dealerLabel) els.dealerLabel.textContent = '莊家';
  hideBadge();
  syncChallengeUI(true, ch.member);
  if (els.msg) els.msg.textContent = ch.mode === 'guest' ? '賭博邀請 · 一局決勝 · 平手退注' : '單局決勝 · 平手算學生會勝';
  status('挑戰開始，發牌……');
  syncControls();
  const chRef = challenge;
  setTimeout(() => {
    if (challenge === chRef) startRound();
  }, 700);
}

function addBet(v) {
  if (busy) return;
  if (bet + v > state.cash) { toast('現金不足。', 'warn'); return; }
  bet += v;
  sound.chip();
  syncControls();
}

function askPlayer(msg) {
  return new Promise(res => {
    resolver = res;
    syncControls();
    status(msg);
  });
}

function act(type) {
  if (!resolver) return;
  const r = resolver;
  resolver = null;
  syncControls();
  r(type);
}

async function startRound() {
  if (busy || state.locked) return;
  if (!challenge) {
    if (bet <= 0) { toast('先押注。', 'warn'); return; }
    if (state.cash < bet) { toast('現金不足。', 'warn'); return; }
    if (!spendCash(bet)) { toast('現金不足。', 'warn'); return; }
  }

  const rid = ++roundSeq;
  busy = true;
  roundBet = challenge ? 0 : bet;
  player = [];
  dealer = [];
  holeEl = null;
  hideBadge();
  syncControls();
  await clearCards(els.playerHand, false);
  await clearCards(els.dealerHand, false);
  if (rid !== roundSeq) return;
  ensureShoe();
  sound.dealAll(3);
  status('發牌中……');
  els.msg.textContent = '莊家發牌';

  const c1 = drawWithCheat('blackjack', shoe); player.push(c1); dealCard(els.playerHand, c1); await sleep(130);
  const d1 = drawWithCheat('blackjack', shoe); dealer.push(d1); dealCard(els.dealerHand, d1); await sleep(130);
  const c2 = drawWithCheat('blackjack', shoe); player.push(c2); dealCard(els.playerHand, c2); await sleep(130);
  const d2 = drawWithCheat('blackjack', shoe); dealer.push(d2); holeEl = dealCard(els.dealerHand, d2, { faceDown: true });
  updateTotals(false);
  updateShoe();
  await sleep(340);
  if (rid !== roundSeq) return;

  const pv = handValue(player);
  const dv = handValue(dealer);

  if (pv.blackjack || dv.blackjack) {
    await sleep(260);
    status('翻開底牌……');
    await revealHole();
    updateTotals(true);
    if (pv.blackjack && dv.blackjack) await settle('push', '雙方都是 Blackjack');
    else if (pv.blackjack) await settle('bj', 'BLACKJACK！');
    else await settle('lose', '莊家 Blackjack');
    return;
  }

  while (true) {
    const action = await askPlayer('你的回合：補牌、停牌，或加倍。');
    if (rid !== roundSeq) return;
    if (action === 'hit') {
      const c = drawWithCheat('blackjack', shoe);
      player.push(c);
      dealCard(els.playerHand, c);
      sound.card();
      await sleep(300);
      if (rid !== roundSeq) return;
      updateTotals(false);
      updateShoe();
      if (handValue(player).bust) {
        await settle('lose', '爆牌');
        return;
      }
      if (handValue(player).total === 21) {
        status('21 點，自動停牌。');
        await sleep(300);
        break;
      }
    } else if (action === 'double') {
      if (player.length !== 2 || state.cash < roundBet) { toast('現在不能加倍。', 'warn'); continue; }
      spendCash(roundBet);
      roundBet *= 2;
      const c = drawWithCheat('blackjack', shoe);
      player.push(c);
      dealCard(els.playerHand, c);
      sound.chip();
      await sleep(360);
      if (rid !== roundSeq) return;
      updateTotals(false);
      updateShoe();
      els.bet.textContent = fmt(roundBet);
      break;
    } else {
      break;
    }
  }

  status('莊家翻牌……');
  await sleep(200);
  if (rid !== roundSeq) return;
  await revealHole();
  if (rid !== roundSeq) return;
  updateTotals(true);
  await sleep(300);
  if (rid !== roundSeq) return;

  while (handValue(dealer).total < 17) {
    const c = drawWithCheat('blackjack', shoe);
    dealer.push(c);
    dealCard(els.dealerHand, c);
    sound.card();
    await sleep(430);
    if (rid !== roundSeq) return;
    updateTotals(true);
    updateShoe();
  }

  const pv2 = handValue(player);
  const dv2 = handValue(dealer);
  if (dv2.bust) await settle(pv2.bust ? 'lose' : 'win', '莊家爆牌');
  else if (pv2.total > dv2.total) await settle('win', '你的點數較大');
  else if (pv2.total < dv2.total) await settle('lose', '莊家點數較大');
  else await settle('push', '平手');
}

async function revealHole() {
  if (holeEl) {
    flip(holeEl, false);
    holeEl = null;
    sound.flip();
    await sleep(420);
  }
}

async function settle(kind, text) {
  const rid = roundSeq;
  updateTotals(true);
  const profit = kind === 'bj' ? Math.round(roundBet * 1.5) : kind === 'win' ? roundBet : kind === 'push' ? 0 : -roundBet;
  let returned = 0;
  if (kind === 'lose') returned = 0;
  else if (kind === 'push') returned = roundBet;
  else if (kind === 'bj') returned = roundBet + profit;
  else returned = roundBet * 2;

  if (!challenge && returned > 0) addCash(returned, { silent: true });

  if (kind === 'bj') {
    setBadge('BLACKJACK', '');
    sound.jackpot();
    els.msg.textContent = 'Blackjack！賠 3:2';
  } else if (kind === 'win') {
    setBadge('贏了');
    sound.win(false);
    els.msg.textContent = text || '你贏了';
  } else if (kind === 'push') {
    setBadge('平手', 'push');
    sound.push();
    els.msg.textContent = text || '平手';
  } else {
    setBadge('輸了', 'lose');
    sound.lose();
    els.msg.textContent = text || '你輸了';
  }

  if (challenge) {
    const guest = challenge.mode === 'guest';
    const win = kind === 'win' || kind === 'bj';
    if (kind === 'push') {
      if (guest) {
        setBadge('平手 · 退注', 'push');
        els.msg.textContent = '平手，注碼退還。';
      } else {
        setBadge('平手 · 學生會勝', 'lose');
        els.msg.textContent = '平手視同學生會勝';
      }
    } else if (guest) {
      els.msg.textContent = win ? `${challenge.member} 輸了這一局` : `${challenge.member} 拿走了這一局`;
    }
    status(guest
      ? (kind === 'push' ? '平手退注' : win ? '賭局勝利' : '賭局失敗')
      : (win ? '挑戰勝利' : '挑戰失敗'), !win && kind !== 'push');
    updateShoe();
    await sleep(1500);
    if (rid !== roundSeq) return;
    busy = false;
    resolver = null;
    challenge = null;
    challengeResult(win ? 'win' : 'lose', { kind });
    return;
  }

  status(`${kind === 'lose' ? '-' : '+'}${fmt(Math.abs(profit))}`, kind === 'lose');

  recordRound(profit, profit);
  state.cash = Math.round(state.cash);
  refreshHud();
  advanceTime(45);
  updateShoe();
  await sleep(1500);
  if (rid !== roundSeq) return;
  busy = false;
  resolver = null;
  bet = Math.max(10000, Math.min(bet, state.cash));
  syncControls();
  if (state.cash >= 10000) status('下注，然後發牌。');
  els.msg.textContent = '下注，然後發牌。';
}

function updateShoe() {
  if (els.shoe) els.shoe.textContent = '牌靴 ' + shoe.length;
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>21 點</h2>
      <span class="sub">6 副牌 · 莊家 17 停 · Blackjack 3:2</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>
    <div class="table-wrap">
      <div class="felt bj-felt">
        <div class="deck-source"><span class="shoe-count" id="bj-shoe">牌靴</span></div>
        <div class="bet-display" id="bj-bet-display">本局押注 <b id="bj-bet">NT$ 0</b></div>
        <div class="bj-side dealer">
          <div class="hand-label">莊家 <span class="pill" id="bj-dealer-label">莊家</span><span class="bj-total" id="bj-dealer-total">—</span></div>
          <div class="hand" id="bj-dealer-hand"></div>
        </div>
        <div class="bj-center">
          <div class="bj-msg" id="bj-msg">下注，然後發牌。</div>
          <div class="bj-rule">補牌不嫌多，爆牌一次就夠</div>
        </div>
        <div class="bj-side player">
          <div class="hand" id="bj-player-hand"></div>
          <div class="hand-label">你 <span class="bj-total" id="bj-player-total">—</span></div>
        </div>
        <div class="table-badge" id="bj-badge"></div>
      </div>
      <div class="control-panel">
        <div class="control-group" id="bj-bet-group">
          <span class="control-label">下注</span>
          <div class="bet-range-host" id="bj-range"></div>
          <div class="chip-row">
            ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>籌碼</small></button>`).join('')}
          </div>
          <button class="btn small ghost" id="bj-clear">最小</button>
        </div>
        <div class="control-group">
          <button class="btn gold" id="bj-deal">發牌</button>
          <button class="btn" id="bj-hit">補牌</button>
          <button class="btn" id="bj-stand">停牌</button>
          <button class="btn" id="bj-double">加倍</button>
        </div>
        <div class="status-line" id="bj-status"></div>
      </div>
    </div>
  `;

  els = {
    deal: el.querySelector('#bj-deal'),
    hit: el.querySelector('#bj-hit'),
    stand: el.querySelector('#bj-stand'),
    double: el.querySelector('#bj-double'),
    clearBet: el.querySelector('#bj-clear'),
    bet: el.querySelector('#bj-bet'),
    playerHand: el.querySelector('#bj-player-hand'),
    dealerHand: el.querySelector('#bj-dealer-hand'),
    playerTotal: el.querySelector('#bj-player-total'),
    dealerTotal: el.querySelector('#bj-dealer-total'),
    dealerLabel: el.querySelector('#bj-dealer-label'),
    badge: el.querySelector('#bj-badge'),
    status: el.querySelector('#bj-status'),
    msg: el.querySelector('#bj-msg'),
    shoe: el.querySelector('#bj-shoe'),
    chips: Array.from(el.querySelectorAll('[data-chip]'))
  };

  els.range = mountBetRange(el.querySelector('#bj-range'), {
    label: '下注金額',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: bet,
    onChange: v => {
      if (busy) return;
      bet = v;
      if (els.bet) els.bet.textContent = fmt(bet);
      els.deal.disabled = !!challenge || bet <= 0 || state.cash < bet || state.locked;
      els.clearBet.disabled = bet <= 0;
    }
  });

  mountCheatDock(el, {
    game: 'blackjack',
    label: '21 點',
    stake: () => (challenge ? (challenge.wager || 0) : (roundBet || bet)),
    options: cardOptions(),
    onPick: opt => setPending('blackjack', 'card', parseCardId(opt.id))
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('blackjack');
  els.chips.forEach(chip => { chip.onclick = () => addBet(Number(chip.dataset.chip)); });
  els.clearBet.onclick = () => { if (busy) return; bet = 10000; sound.click(); syncControls(); };
  els.deal.onclick = () => { sound.click(); startRound(); };
  els.hit.onclick = () => act('hit');
  els.stand.onclick = () => act('stand');
  els.double.onclick = () => act('double');

  ensureShoe();
  updateShoe();
  syncControls();
}

export function enterBlackjack() {
  const ch = getChallenge();
  if (ch && ch.game === 'blackjack') {
    render();
    setupChallenge(ch);
    return;
  }
  const wasChallenge = !!challenge || !!(els.deal && els.deal.classList.contains('hidden'));
  challenge = null;
  render();
  if (wasChallenge) resetTable();
  syncChallengeUI(false);
  syncControls();
  updateShoe();
}

export function leaveBlackjack() { }

export function canLeaveBlackjack() {
  if (challengeActive()) { toast('挑戰進行中，請先完成或棄權。', 'warn'); return false; }
  if (busy) { toast('先打完這一局。', 'warn'); return false; }
  return true;
}
