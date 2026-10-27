import {
  state, fmt, money, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, rnd, rndInt, router, sound, openRules, save
} from '../core.js';
import {
  makeDeck, shuffle, dealCard, highlightCards
} from '../cards.js';
import { eval5, eval7, cmpEval, CAT_NAMES } from '../eval.js';
import { getChallenge, challengeActive, challengeResult, onChallengeAbort } from '../challenge.js';
import {
  cardOptions, parseCardId, setPending, drawWithCheat, mountCheatDock
} from '../cheat.js';

const root = () => document.getElementById('view-holdem');
const SEAT_NAMES = ['你', '蛇喰夢子', '早乙女芽亞里', '鈴井涼太'];
const SEAT_POS = ['bottom', 'left', 'top', 'right'];
const CHALLENGE_STACK = 200000;
const BUYINS = [250000, 1000000, 2500000, 5000000];
const BLINDS = {
  250000: [1000, 2000],
  1000000: [5000, 10000],
  2500000: [10000, 20000],
  5000000: [25000, 50000]
};

let SB = 1000;
let BB = 2000;
let AI_START = 250000;
let buyInTier = 250000;
let seats = [];
let dealer = 3;
let board = [];
let boardEls = [];
let deck = [];
let handNo = 0;
let inHand = false;
let busy = false;
let seated = false;
let street = 'idle';
let currentBet = 0;
let minRaise = BB;
let playerResolver = null;
let results = [];
let handStartStack = 0;
let els = {};
let challenge = null;
let renderedMode = '';
let renderedFoe = '';
let handSeq = 0;

function seatNames() { return challenge ? ['你', challenge.member] : SEAT_NAMES; }
function seatPositions() { return challenge ? ['bottom', 'top'] : SEAT_POS; }

function bestEval(cards) {
  if (cards.length >= 7) return eval7(cards);
  let best = null;
  let bestCards = null;
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const ev = eval5(five);
            if (!best || cmpEval(ev, best) > 0) { best = ev; bestCards = five; }
          }
  if (!best) return { cat: 0, tie: [], name: CAT_NAMES[0], cards: cards.slice() };
  best.cards = bestCards;
  return best;
}

function initSeats(playerStack = 0) {
  const names = seatNames();
  const aiStack = challenge ? CHALLENGE_STACK : AI_START;
  seats = names.map((name, idx) => ({
    idx,
    name,
    stack: idx === 0 ? playerStack : aiStack,
    cards: [],
    cardEls: [],
    folded: false,
    allin: false,
    inHand: false,
    bet: 0,
    committed: 0,
    note: '',
    won: 0
  }));
  dealer = names.length - 1;
}

function blindIdx(n, d) {
  if (n === 2) return { sb: d, bb: (d + 1) % 2 };
  return { sb: (d + 1) % n, bb: (d + 2) % n };
}

function firstToAct(kind) {
  const n = seats.length;
  const b = blindIdx(n, dealer);
  if (kind === 'preflop') return n === 2 ? b.sb : (dealer + 3) % n;
  return n === 2 ? b.bb : b.sb;
}

function applyTier(amount) {
  const tier = BLINDS[amount] ? amount : BUYINS[0];
  buyInTier = tier;
  SB = BLINDS[tier][0];
  BB = BLINDS[tier][1];
  AI_START = tier;
  const sub = document.getElementById('hm-sub');
  if (sub) sub.textContent = `盲注 ${money(SB)} / ${money(BB)} · 4 人桌 · 邊池`;
}

function liveSeats() { return seats.filter(s => s.inHand && !s.folded); }
function potNow() { return seats.reduce((n, s) => n + s.committed, 0); }
function callOf(s) { return Math.max(0, Math.min(s.stack, currentBet - s.bet)); }
function canRaise(s) { return s.stack > Math.max(0, currentBet - s.bet) && s.stack > 0; }

/* ---------------- 介面 ---------------- */

function render() {
  const el = root();
  if (!el) return;
  const mode = challenge ? 'challenge' : 'cash';
  const foe = challenge ? challenge.member : '';
  if (el.dataset.ready && renderedMode === mode && renderedFoe === foe) return;
  el.dataset.ready = '1';
  renderedMode = mode;
  renderedFoe = foe;
  const names = seatNames();
  const positions = seatPositions();
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← ${challenge ? '學園' : '大廳'}</button>
      <h2>德州撲克</h2>
      <span class="sub" id="hm-sub">盲注 1,000 / 2,000 · ${challenge ? '單挑' : '4 人桌'} · 邊池</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
      <button class="btn ghost" id="hm-leave">離桌</button>
    </div>

    <div class="table-wrap">
      <div class="felt holdem-felt" id="hm-felt">
        <div class="hm-table-ring"></div>
        <div class="deck-source"><span class="shoe-count" id="hm-deck">牌堆</span></div>
        ${names.map((name, i) => `
          <div class="hm-seat ${positions[i]}" id="hm-seat-${i}">
            <div class="hm-cards" id="hm-cards-${i}"></div>
            <div class="hm-name">
              <b>${name}</b>
              <span class="stack" id="hm-stack-${i}">NT$ 0</span>
            </div>
            <div class="hm-status" id="hm-status-${i}"></div>
            <div class="hm-bet" id="hm-bet-${i}">NT$ 0</div>
            <div class="hm-dealer-chip hidden" id="hm-dealer-${i}">D</div>
          </div>`).join('')}

        <div class="hm-board">
          <div class="hand" id="hm-board"></div>
          <div class="hm-pot"><span>底池</span><b id="hm-pot">NT$ 0</b></div>
        </div>
        <div class="hm-stage" id="hm-stage">等待入座</div>
        <div class="hm-log" id="hm-log"></div>
        <div class="table-badge" id="hm-badge"></div>

        <div class="hm-buyin" id="hm-buyin">
          <div class="buyin-box" id="hm-buyin-box"></div>
        </div>
      </div>

      <div class="panel hm-actions">
        <div class="hm-bet-row">
          <span class="control-label">加注</span>
          <input type="number" id="hm-range" class="hm-input" inputmode="numeric" min="0" max="100" step="100" value="0" disabled>
          <div class="hm-amount" id="hm-amount">NT$ 0</div>
          <div class="hm-quick">
            <button class="btn ghost" data-quick="0.5" disabled>½ 池</button>
            <button class="btn ghost" data-quick="0.75" disabled>¾ 池</button>
            <button class="btn ghost" data-quick="1" disabled>底池</button>
            <button class="btn ghost" data-quick="allin" disabled>全押</button>
          </div>
        </div>
        <div class="hm-action-row">
          <button class="btn danger" id="hm-fold" disabled>蓋牌</button>
          <button class="btn" id="hm-call" disabled>過牌</button>
          <button class="btn gold" id="hm-raise" disabled>加注</button>
          <button class="btn ghost hidden" id="hm-next">開始下一手</button>
        </div>
        <div class="status-line" id="hm-status"></div>
      </div>
    </div>
  `;

  els = {
    felt: el.querySelector('#hm-felt'),
    board: el.querySelector('#hm-board'),
    pot: el.querySelector('#hm-pot'),
    stage: el.querySelector('#hm-stage'),
    log: el.querySelector('#hm-log'),
    badge: el.querySelector('#hm-badge'),
    deck: el.querySelector('#hm-deck'),
    buyin: el.querySelector('#hm-buyin'),
    buyinBox: el.querySelector('#hm-buyin-box'),
    range: el.querySelector('#hm-range'),
    amount: el.querySelector('#hm-amount'),
    fold: el.querySelector('#hm-fold'),
    call: el.querySelector('#hm-call'),
    raise: el.querySelector('#hm-raise'),
    next: el.querySelector('#hm-next'),
    status: el.querySelector('#hm-status'),
    quicks: Array.from(el.querySelectorAll('[data-quick]')),
    leave: el.querySelector('#hm-leave'),
    sub: el.querySelector('#hm-sub'),
    seatEls: names.map((_, i) => ({
      box: el.querySelector('#hm-seat-' + i),
      cards: el.querySelector('#hm-cards-' + i),
      stack: el.querySelector('#hm-stack-' + i),
      status: el.querySelector('#hm-status-' + i),
      bet: el.querySelector('#hm-bet-' + i),
      dealer: el.querySelector('#hm-dealer-' + i)
    }))
  };

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go(challenge ? (challenge.mode === 'guest' ? 'people' : 'council') : 'lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('holdem');
  el.querySelector('#hm-leave').onclick = () => {
    if (challenge) { toast('挑戰進行中，請先完成或棄權。', 'warn'); return; }
    cashOut(true);
    router.go('lobby');
  };

  els.fold.onclick = () => submitAction({ type: 'fold' });
  els.call.onclick = () => submitAction({ type: 'call' });
  els.raise.onclick = () => {
    const to = Number(els.range.value);
    submitAction({ type: 'raise', to });
  };
  els.next.onclick = () => { sound.click(); startHand(); };

  els.range.oninput = () => updateRangeDisplay();
  els.quicks.forEach(btn => {
    btn.onclick = () => {
      const s = seats[0];
      if (!s) return;
      let to;
      if (btn.dataset.quick === 'allin') to = s.bet + s.stack;
      else to = raiseTarget(s, Number(btn.dataset.quick));
      els.range.value = String(Math.min(s.bet + s.stack, Math.max(Number(els.range.min), to)));
      updateRangeDisplay();
      sound.click();
    };
  });

  mountCheatDock(el, {
    game: 'holdem',
    label: '德州撲克',
    stake: () => (challenge ? (challenge.wager || 0) : buyInTier),
    options: cardOptions(),
    onPick: opt => setPending('holdem', 'card', parseCardId(opt.id))
  });

  if (challenge) return;

  els.buyin.classList.remove('hidden');
  initSeats(0);
  renderSeats();
  updatePot();
  showBuyin();

  if (state.holdemStack > 0) {
    applyTier(state.holdemBuyin || BUYINS[0]);
    seated = true;
    initSeats(state.holdemStack);
    els.buyin.classList.add('hidden');
    renderSeats();
    setStatus('桌上的籌碼還在。按「開始下一手」繼續。');
    els.next.classList.remove('hidden');
    els.next.disabled = false;
  } else {
    applyTier(state.holdemBuyin || BUYINS[0]);
  }
}

function setupChallengeTable() {
  SB = 1000;
  BB = 2000;
  AI_START = CHALLENGE_STACK;
  buyInTier = CHALLENGE_STACK;
  minRaise = BB;
  seated = true;
  inHand = false;
  busy = false;
  street = 'idle';
  currentBet = 0;
  playerResolver = null;
  board = [];
  boardEls = [];
  deck = [];
  results = [];
  handNo = 0;
  initSeats(CHALLENGE_STACK);
  dealer = 0;
  els.buyin.classList.add('hidden');
  els.next.classList.add('hidden');
  els.badge.classList.remove('show');
  if (els.leave) els.leave.classList.add('hidden');
  if (els.sub) els.sub.textContent = challenge.mode === 'guest'
    ? `盲注 1,000 / 2,000 · 單挑 · 賭博邀請 ${challenge.member}`
    : `盲注 1,000 / 2,000 · 單挑 · 挑戰 ${challenge.member}`;
  if (els.board) els.board.innerHTML = '';
  if (els.log) els.log.innerHTML = '';
  for (const ui of els.seatEls) ui.cards.innerHTML = '';
  renderSeats();
  updatePot();
  stage('等待發牌');
  setStatus(challenge.mode === 'guest'
    ? `賭博邀請 ${challenge.member}：單挑一手，贏下底池就算你贏。`
    : `挑戰 ${challenge.member}：單挑一手，贏下底池才算勝利。`);
  onChallengeAbort(() => {
    handSeq += 1;
    challenge = null;
    inHand = false;
    busy = false;
    const r = playerResolver;
    playerResolver = null;
    resetControls();
    if (r) r();
  });
  setTimeout(() => {
    if (challenge && !inHand) startHand();
  }, 800);
}

function setStatus(text, warn = false) {
  if (!els.status) return;
  els.status.textContent = text || '';
  els.status.className = 'status-line' + (warn ? ' warn' : '');
}

function logMsg(text) {
  results.push(text);
  if (results.length > 6) results.shift();
  if (els.log) {
    const div = document.createElement('div');
    div.textContent = text;
    els.log.appendChild(div);
    while (els.log.children.length > 6) els.log.firstChild.remove();
  }
}

function renderSeats() {
  if (!els.seatEls) return;
  for (const s of seats) {
    const ui = els.seatEls[s.idx];
    if (!ui) continue;
    ui.stack.textContent = fmt(s.stack);
    ui.box.classList.toggle('folded', s.folded || (!s.inHand && inHand));
    ui.box.classList.toggle('acting', inHand && playerResolver != null && s.idx === 0);
    ui.status.textContent = s.note || '';
    ui.status.classList.toggle('fold', s.folded);
    ui.dealer.classList.toggle('hidden', !seated || dealer !== s.idx);
    if (s.bet > 0) {
      ui.bet.textContent = fmt(s.bet);
      ui.bet.classList.add('show');
    } else {
      ui.bet.classList.remove('show');
    }
  }
  renderBoardCount();
}

function renderBoardCount() {
  if (els.deck) els.deck.textContent = deck.length ? '牌堆 ' + deck.length : '牌堆';
}

function updatePot() {
  if (els.pot) els.pot.textContent = fmt(potNow());
}

function stage(text) {
  if (els.stage) els.stage.textContent = text;
}

function showBuyin(reason) {
  if (!els.buyin) return;
  els.next.classList.add('hidden');
  els.buyin.classList.remove('hidden');
  const can = BUYINS.filter(v => v <= state.cash);
  const preferred = can.length ? can[can.length - 1] : 0;
  els.buyinBox.innerHTML = `
    <h3>入座</h3>
    <p>${reason ? reason + '<br>' : ''}四人桌。買入越高，盲注越大；離桌時桌上的籌碼會換回現金。</p>
    <div class="buyin-row">
      ${BUYINS.map(v => {
        const b = BLINDS[v];
        return `<button class="btn buyin-btn ${v === preferred ? 'gold' : 'ghost'}" data-buyin="${v}" ${v > state.cash || state.locked ? 'disabled' : ''}>
          <b>${money(v)}</b><small>盲注 ${money(b[0])}／${money(b[1])}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="status-line" style="text-align:center">手上現金 ${fmt(state.cash)}${!can.length ? ' · 現金不足，先去借貸中心' : ''}</div>
  `;
  els.buyinBox.querySelectorAll('[data-buyin]').forEach(btn => {
    btn.onclick = () => buyIn(Number(btn.dataset.buyin));
  });
  setStatus('先買入籌碼才能入座。', !can.length);
}

function buyIn(amount) {
  if (challenge) { toast('挑戰中不需要買入。', 'warn'); return; }
  if (state.locked) { toast('這個夜晚已經結束了。', 'warn'); return; }
  if (amount > state.cash) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(amount)) { toast('現金不足。', 'warn'); return; }

  if (!seated || !seats.length) {
    applyTier(amount);
    seated = true;
    initSeats(0);
  }
  seats[0].stack += amount;
  state.holdemStack = seats[0].stack;
  state.holdemBuyin = buyInTier;
  save();
  refreshHud();
  els.buyin.classList.add('hidden');
  renderSeats();
  updatePot();
  logMsg(`買入 ${fmt(amount)}。`);
  sound.chip();
  setStatus('入座完成，準備發牌。');
  setTimeout(() => startHand(), 620);
}

function cashOut(silent = false) {
  if (challenge) return false;
  if (inHand || busy) { toast('先打完這一手。', 'warn'); return false; }
  const amount = seats.length ? seats[0].stack : 0;
  if (amount > 0) {
    addCash(amount, { silent: true });
    refreshHud();
  }
  seated = false;
  state.holdemStack = 0;
  save();
  initSeats(0);
  board = [];
  boardEls = [];
  deck = [];
  if (els.board) els.board.innerHTML = '';
  renderSeats();
  updatePot();
  showBuyin();
  if (!silent) toast(`帶走 ${fmt(amount)}。`, 'good');
  return true;
}

/* ---------------- 手牌流程 ---------------- */

function resetHandFields() {
  for (const s of seats) {
    s.cards = [];
    s.cardEls = [];
    s.folded = false;
    s.allin = false;
    s.inHand = true;
    s.bet = 0;
    s.committed = 0;
    s.note = '';
    s.won = 0;
  }
  board = [];
  boardEls = [];
  currentBet = 0;
  minRaise = BB;
  results = [];
  street = 'preflop';
}

async function startHand() {
  if (!seated || inHand || busy) return;
  if (state.locked) return;
  if (seats[0].stack < BB) {
    showBuyin('籌碼不足一個大盲。');
    return;
  }

  const n = seats.length;
  const rid = ++handSeq;
  handNo += 1;
  inHand = true;
  busy = true;
  dealer = (dealer + 1) % n;
  resetHandFields();
  handStartStack = seats[0].stack;

  els.buyin.classList.add('hidden');
  els.next.classList.add('hidden');
  els.badge.classList.remove('show');
  els.board.innerHTML = '';
  for (const ui of els.seatEls) ui.cards.innerHTML = '';
  for (const s of seats) s.cardEls = [];

  setStatus('發牌中……');
  stage('DEAL');
  logMsg(`第 ${handNo} 手開牌。`);
  renderSeats();
  updatePot();
  resetControls();

  const deckNow = shuffle(makeDeck(1));
  deck = deckNow;
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= n; k++) {
      const idx = (dealer + k) % n;
      const s = seats[idx];
      const card = idx === 0 ? drawWithCheat('holdem', deck) : deck.pop();
      s.cards.push(card);
      const el = dealCard(els.seatEls[idx].cards, card, { faceDown: idx !== 0, silent: true });
      s.cardEls.push(el);
      if (idx === 0) sound.card();
      else if (round === 1) sound.card();
      await sleep(85);
      if (rid !== handSeq) return;
    }
  }

  const blinds = blindIdx(n, dealer);
  postBlind(blinds.sb, SB, '小盲');
  postBlind(blinds.bb, BB, '大盲');
  minRaise = BB;
  currentBet = BB;
  updatePot();
  renderSeats();
  await sleep(280);
  if (rid !== handSeq || !inHand) return;

  stage('PREFLOP · 翻牌前');
  syncRoundStatus();
  const first = firstToAct('preflop');
  await bettingRound(first, true, rid);
  if (!inHand || rid !== handSeq) return;

  if (await afterRound()) return;
  await newStreet(3, rid);
  if (!inHand || rid !== handSeq) return;
  if (await afterRound()) return;
  await newStreet(1, rid);
  if (!inHand || rid !== handSeq) return;
  if (await afterRound()) return;
  await newStreet(1, rid);
  if (!inHand || rid !== handSeq) return;
  if (await afterRound()) return;
  await endHand(true);
}

function postBlind(idx, amount, label) {
  const s = seats[idx];
  const pay = Math.min(s.stack, amount);
  s.stack -= pay;
  s.bet += pay;
  s.committed += pay;
  if (s.stack === 0) s.allin = true;
  s.note = `${label} ${money(pay)}`;
  logMsg(`${s.name} ${label} ${money(pay)}`);
}

function syncRoundStatus() {
  const s = seats[0];
  if (!s || !s.inHand) return;
  const call = callOf(s);
  setStatus(call > 0 ? `你的回合：需要跟注 ${fmt(call)}` : '你的回合：可以過牌或下注');
}

function sweepBets() {
  for (const s of seats) s.bet = 0;
  currentBet = 0;
  minRaise = BB;
  renderSeats();
}

async function newStreet(count, rid) {
  if (rid !== handSeq || !inHand) return;
  sweepBets();
  street = count === 3 ? 'flop' : street === 'flop' ? 'turn' : 'river';
  stage(count === 3 ? 'FLOP · 翻牌' : count === 1 && street === 'turn' ? 'TURN · 轉牌' : 'RIVER · 河牌');
  setStatus('發公牌……');
  await dealBoard(count, rid);
  if (rid !== handSeq || !inHand) return;
  const first = nextCanAct(firstToAct('postflop'));
  if (first == null) return;
  await bettingRound(first, false, rid);
}

async function dealBoard(count, rid) {
  for (let i = 0; i < count; i++) {
    if (rid !== handSeq) return;
    if (!deck.length) return;
    const card = drawWithCheat('holdem', deck);
    board.push(card);
    const el = dealCard(els.board, card, { silent: true });
    boardEls.push(el);
    sound.card();
    await sleep(190);
  }
  renderBoardCount();
  await sleep(260);
}

function nextCanAct(from) {
  const n = seats.length;
  for (let k = 0; k < n; k++) {
    const idx = (from + k) % n;
    const s = seats[idx];
    if (s.inHand && !s.folded && !s.allin) return idx;
  }
  return null;
}

function liveCount() {
  return seats.filter(s => s.inHand && !s.folded).length;
}

async function afterRound() {
  const live = liveSeats();
  if (live.length <= 1) {
    await endHand(false);
    return true;
  }
  const canAct = live.filter(s => !s.allin);
  if (canAct.length <= 1) {
    await runOutBoard();
    await endHand(true);
    return true;
  }
  return false;
}

async function runOutBoard() {
  if (board.length >= 5) return;
  setStatus('全押攤牌，發完剩下的公牌……');
  await sleep(500);
  while (board.length < 5) {
    await dealBoard(1);
    await sleep(260);
  }
}

/* ---------------- 下注 ---------------- */

function roundComplete(acted) {
  const live = liveSeats();
  if (live.length <= 1) return true;
  const canAct = live.filter(s => !s.allin);
  if (!canAct.length) return true;
  return canAct.every(s => acted.has(s.idx) && s.bet === currentBet);
}

async function bettingRound(start, preflop, rid) {
  if (liveCount() <= 1) return;
  let acted = new Set();
  let i = start;
  let guard = 0;

  while (guard++ < 80) {
    if (!inHand || rid !== handSeq) return;
    const live = liveSeats();
    if (live.length <= 1) return;

    const s = seats[i];
    if (s.inHand && !s.folded && !s.allin) {
      const must = !acted.has(i) || s.bet < currentBet;
      if (must) {
        const before = currentBet;
        if (i === 0) await playerTurn(s);
        else await aiTurn(s, rid);
        if (rid !== handSeq || !inHand) return;
        acted.add(i);
        if (currentBet > before) {
          acted = new Set([i]);
          minRaise = Math.max(minRaise, currentBet - before);
        }
        updatePot();
        renderSeats();
      }
    }

    if (roundComplete(acted)) break;
    i = (i + 1) % seats.length;
  }
}

function aiTurn(s, rid) {
  return new Promise(async resolve => {
    s.note = '思考中…';
    renderSeats();
    await sleep(rndInt(480, 980));
    if (rid !== handSeq || !inHand) { resolve(); return; }

    const call = callOf(s);
    const pot = potNow();
    const maxTo = s.bet + s.stack;
    const canRaiseNow = maxTo > currentBet && s.stack > call;

    if (street === 'preflop') {
      const score = preflopScore(s.cards);
      const r = Math.random();
      const openRaise = () => {
        if (!canRaiseNow) return applyCall(s);
        const inc = Math.max(minRaise, Math.round(BB * (2 + rnd(0, 2)) / 100) * 100);
        applyRaise(s, Math.min(maxTo, currentBet + inc));
      };

      if (call === 0) {
        if (score >= 30 && r < 0.72) openRaise();
        else if (score >= 25 && r < 0.35) openRaise();
        else applyCheck(s);
      } else if (call <= BB) {
        if (score >= 12 || r < 0.2) {
          if (score >= 34 && canRaiseNow && r < 0.45) openRaise();
          else applyCall(s);
        } else applyFold(s);
      } else if (call <= BB * 3) {
        if (score >= 24) {
          if (canRaiseNow && score >= 38 && r < 0.4) openRaise();
          else applyCall(s);
        } else if (score >= 17 && r < 0.45) applyCall(s);
        else applyFold(s);
      } else {
        if (score >= 36 && r < 0.6) applyCall(s);
        else if (score >= 30 && r < 0.25) applyCall(s);
        else applyFold(s);
      }
    } else {
      const ev = bestEval([...s.cards, ...board]);
      const cat = ev.cat;
      const r = Math.random();
      const betOut = () => {
        if (!canRaiseNow) return applyCall(s);
        applyRaise(s, raiseTarget(s, cat >= 6 ? 0.85 : cat >= 4 ? 0.7 : 0.55));
      };

      if (call === 0) {
        if (cat >= 5 || (cat >= 3 && r < 0.78)) betOut();
        else if (cat === 2 && r < 0.55) betOut();
        else if (cat === 1 && r < 0.18) betOut();
        else if (r < 0.07) betOut();
        else applyCheck(s);
      } else {
        const odds = call / (pot + call);
        if (cat >= 7) {
          if (canRaiseNow && r < 0.82) betOut();
          else applyCall(s);
        } else if (cat >= 5) {
          if (canRaiseNow && r < 0.55) betOut();
          else if (odds < 0.55) applyCall(s);
          else applyFold(s);
        } else if (cat === 4) {
          if (odds < 0.45) {
            if (canRaiseNow && r < 0.2) betOut();
            else applyCall(s);
          } else applyFold(s);
        } else if (cat === 3) {
          if (odds < 0.38) applyCall(s);
          else if (r < 0.3 && canRaiseNow) betOut();
          else applyFold(s);
        } else if (cat === 2) {
          if (odds < 0.26) applyCall(s);
          else if (r < 0.12) applyCall(s);
          else applyFold(s);
        } else if (cat === 1) {
          if (call <= pot * 0.2 && r < 0.6) applyCall(s);
          else if (r < 0.1) applyCall(s);
          else applyFold(s);
        } else {
          if (call <= pot * 0.1 && r < 0.18) applyCall(s);
          else applyFold(s);
        }
      }
    }

    renderSeats();
    updatePot();
    resolve();
  });
}

function preflopScore(cards) {
  const a = cards[0], b = cards[1];
  const va = a.r === 0 ? 14 : a.r + 1;
  const vb = b.r === 0 ? 14 : b.r + 1;
  const hi = Math.max(va, vb);
  const lo = Math.min(va, vb);
  if (va === vb) return 40 + hi + (hi >= 10 ? 4 : 0);
  let s = hi * 1.15 + lo * 0.65;
  if (a.s === b.s) s += 6;
  const gap = hi - lo;
  if (gap === 1) s += 5;
  else if (gap === 2) s += 2.5;
  if (hi === 14) s += 3;
  if (lo >= 10) s += 3;
  return s;
}

function raiseTarget(s, fraction) {
  const pot = potNow();
  const maxTo = s.bet + s.stack;
  const minTo = Math.min(maxTo, currentBet + Math.max(minRaise, BB));
  const size = Math.round((pot * fraction) / 100) * 100;
  const target = currentBet === 0
    ? Math.max(BB, size)
    : currentBet + Math.max(minRaise, size);
  return Math.min(maxTo, Math.max(minTo, target));
}

function applyCheck(s) {
  s.note = '過牌';
  logMsg(`${s.name} 過牌`);
}

function applyCall(s) {
  const pay = callOf(s);
  if (pay <= 0) { applyCheck(s); return; }
  s.stack -= pay;
  s.bet += pay;
  s.committed += pay;
  if (s.stack === 0) s.allin = true;
  s.note = s.allin ? `全押 ${money(pay)}` : `跟注 ${money(pay)}`;
  logMsg(`${s.name} ${s.allin ? '全押' : '跟注'} ${money(pay)}`);
  sound.chip();
}

function applyRaise(s, to) {
  const maxTo = s.bet + s.stack;
  let target = Math.min(maxTo, Math.max(s.bet + 1, Math.round(to)));
  const pay = target - s.bet;
  s.stack -= pay;
  s.bet = target;
  s.committed += pay;
  if (s.stack === 0) s.allin = true;
  if (s.bet > currentBet) currentBet = s.bet;
  s.note = s.allin ? `全押 ${money(s.bet)}` : `加注 ${money(s.bet)}`;
  logMsg(`${s.name} ${s.allin ? '全押' : '加注到'} ${money(s.bet)}`);
  sound.chip();
}

function applyFold(s) {
  s.folded = true;
  s.note = '蓋牌';
  logMsg(`${s.name} 蓋牌`);
}

/* ---------------- 玩家操作 ---------------- */

function playerTurn(s) {
  return new Promise(resolve => {
    playerResolver = resolve;
    const call = callOf(s);
    const maxTo = s.bet + s.stack;
    const minTo = Math.min(maxTo, currentBet + Math.max(minRaise, BB));
    const can = canRaise(s);

    els.fold.disabled = false;
    els.call.disabled = false;
    els.call.textContent = call <= 0 ? '過牌' : call >= s.stack ? `全押 ${money(call)}` : `跟注 ${money(call)}`;
    els.raise.disabled = !can;
    els.range.disabled = !can;
    els.quicks.forEach(b => { b.disabled = !can; });

    if (can) {
      els.range.min = String(minTo);
      els.range.max = String(maxTo);
      els.range.step = maxTo - minTo > 1000 ? '100' : '50';
      const def = Math.min(maxTo, Math.max(minTo, raiseTarget(s, 0.7)));
      els.range.value = String(def);
      updateRangeDisplay();
    } else {
      els.amount.textContent = '—';
    }

    setStatus(call > 0 ? `你的回合：跟注 ${fmt(call)}，或加注。` : '你的回合：可以過牌，也可以下注。');
    s.note = '你的回合';
    renderSeats();
  });
}

function updateRangeDisplay() {
  const s = seats[0];
  if (!s || !els.range) return;
  const min = Number(els.range.min) || 0;
  const max = Number(els.range.max) || 0;
  const val = Math.max(min, Math.min(Number(els.range.value) || 0, max));
  els.amount.textContent = fmt(val);
  els.raise.textContent = `加注 ${money(val)}`;
}

function submitAction(action) {
  if (!playerResolver) return;
  const s = seats[0];
  if (action.type === 'raise') {
    const maxTo = s.bet + s.stack;
    const minTo = currentBet + Math.max(minRaise, BB);
    const to = Math.round(action.to);
    if (!(to > currentBet) || to > maxTo) { toast('加注金額不合法。', 'warn'); return; }
    if (to < minTo && to < maxTo) { toast(`最少要加注到 ${fmt(minTo)}。`, 'warn'); return; }
    applyRaise(s, to);
  } else if (action.type === 'call') {
    applyCall(s);
  } else if (action.type === 'fold') {
    applyFold(s);
  } else {
    return;
  }
  const r = playerResolver;
  playerResolver = null;
  resetControls();
  renderSeats();
  updatePot();
  sound.click();
  r();
}

function resetControls() {
  if (!els.fold) return;
  els.fold.disabled = true;
  els.call.disabled = true;
  els.raise.disabled = true;
  els.range.disabled = true;
  els.quicks.forEach(b => { b.disabled = true; });
  els.call.textContent = '過牌';
  els.raise.textContent = '加注';
}

/* ---------------- 結算 ---------------- */

function buildPots() {
  const levels = [...new Set(seats.filter(s => s.committed > 0).map(s => s.committed))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const lv of levels) {
    const contributors = seats.filter(s => s.committed >= lv);
    const amount = (lv - prev) * contributors.length;
    const eligible = contributors.filter(s => s.inHand && !s.folded);
    if (amount > 0) pots.push({ amount, eligible });
    prev = lv;
  }
  return pots;
}

function payoutPots() {
  const pots = buildPots();
  const winners = [];
  for (const pot of pots) {
    if (!pot.eligible.length) continue;
    let best = null;
    let win = [];
    for (const s of pot.eligible) {
      const ev = eval7([...s.cards, ...board]);
      if (!best) { best = ev; win = [s]; continue; }
      const c = cmpEval(ev, best);
      if (c > 0) { best = ev; win = [s]; }
      else if (c === 0) win.push(s);
    }
    if (!win.length) continue;
    const n = seats.length;
    win.sort((a, b) => ((a.idx - dealer - 1 + n) % n) - ((b.idx - dealer - 1 + n) % n));
    const share = Math.floor(pot.amount / win.length);
    let rem = pot.amount - share * win.length;
    for (const w of win) {
      let amt = share;
      if (rem > 0) { amt += 1; rem -= 1; }
      w.stack += amt;
      w.won += amt;
      if (!winners.includes(w.name)) winners.push(w.name);
    }
    pot.best = best;
    pot.winners = win;
  }
  return { pots, winners };
}

async function revealAiCards(live) {
  for (const s of live) {
    if (s.idx === 0) continue;
    for (const el of s.cardEls) el.classList.remove('face-down');
    sound.flip();
    await sleep(140);
  }
  await sleep(320);
}

async function endHand(showdown) {
  if (!inHand) return;
  const rid = handSeq;
  const inChallenge = !!challenge;
  street = showdown ? 'showdown' : 'idle';
  busy = true;
  resetControls();
  setStatus(showdown ? '攤牌……' : '結算……');
  stage(showdown ? 'SHOWDOWN' : 'HAND OVER');

  const live = liveSeats();
  let winnerText = '';
  let playerProfit = 0;

  if (!showdown || live.length <= 1) {
    const w = live[0];
    if (w) {
      const pot = potNow();
      w.stack += pot;
      w.won += pot;
      winnerText = `${w.name} 拿下 ${fmt(pot)}`;
      logMsg(winnerText);
    }
  } else {
    if (live.some(s => s.idx > 0)) await revealAiCards(live);
    if (rid !== handSeq) return;
    const { pots } = payoutPots();
    if (pots.length) {
      const main = pots[0];
      if (main.best && main.winners && main.winners.length) {
        const mainWinner = main.winners[0];
        const allEls = [...boardEls];
        for (const s of seats) for (const el of s.cardEls) allEls.push(el);
        highlightCards(allEls, main.best.cards);
      }
      winnerText = pots.map(p => `${(p.winners || []).map(w => w.name).join('、')} 贏 ${fmt((p.winners || []).length ? p.amount / p.winners.length : 0)}`).join(' · ');
      if (!winnerText) winnerText = '底池已派發';
    }
    logMsg(`攤牌：${live.map(s => {
      const ev = bestEval([...s.cards, ...board]);
      return `${s.name} ${CAT_NAMES[ev.cat]}`;
    }).join(' · ')}`);
  }

  playerProfit = seats[0].won - seats[0].committed;
  const won = seats[0].won;
  const lost = seats[0].committed;

  if (showdown && live.includes(seats[0]) && live.length > 1) {
    const ev = bestEval([...seats[0].cards, ...board]);
    setStatus(`你的牌型：${CAT_NAMES[ev.cat]}　${playerProfit >= 0 ? '+' : ''}${fmt(playerProfit)}`, playerProfit < 0);
  } else if (seats[0].folded) {
    setStatus(`你蓋牌了，這一手損失 ${fmt(lost)}。`, true);
  } else {
    setStatus(`${winnerText}　${playerProfit >= 0 ? '+' : ''}${fmt(playerProfit)}`, playerProfit < 0);
  }

  const badgeText = won > 0 ? '贏 ' + fmt(won) : seats[0].folded ? '蓋牌' : '輸了';
  els.badge.textContent = badgeText;
  els.badge.className = 'table-badge' + (won > 0 ? '' : ' lose');
  els.badge.classList.add('show');

  if (won > 0) sound.win(won >= handStartStack * 0.5);
  else if (lost > 0) sound.lose();

  if (inChallenge) {
    let tie = false;
    if (showdown && live.length === 2 && live.includes(seats[0])) {
      const foe = live.find(s => s.idx !== 0);
      if (foe) tie = cmpEval(bestEval([...seats[0].cards, ...board]), bestEval([...foe.cards, ...board])) === 0;
    }
    const win = won > 0 && !tie && !seats[0].folded;
    const guest = challenge.mode === 'guest';
    if (guest && tie) {
      els.badge.textContent = '平手 · 退注';
      els.badge.className = 'table-badge push';
      setStatus('平手，注碼退還。', false);
    } else {
      els.badge.textContent = guest ? (win ? '賭局勝利' : '賭局失敗') : (win ? '挑戰勝利' : '挑戰失敗');
      els.badge.className = 'table-badge' + (win ? '' : ' lose');
      setStatus(guest
        ? (win ? '賭局勝利，你贏下這一手。' : '賭局失敗。')
        : (win ? '挑戰勝利，你贏下這一手。' : tie ? '平手視同學生會勝。' : '挑戰失敗。'), !win);
    }
    els.badge.classList.add('show');
    await sleep(1800);
    if (rid !== handSeq) return;
    els.badge.classList.remove('show');
    inHand = false;
    busy = false;
    deck = [];
    for (const s of seats) {
      s.inHand = false;
      s.folded = false;
      s.allin = false;
      s.note = '';
      s.bet = 0;
      s.committed = 0;
    }
    currentBet = 0;
    renderSeats();
    updatePot();
    const ch = challenge;
    challenge = null;
    if (ch) challengeResult(win ? 'win' : 'lose', { game: 'holdem', tie });
    return;
  }

  recordRound(playerProfit > 0 ? playerProfit : 0, playerProfit);
  advanceTime(90);
  state.holdemStack = seats[0].stack;
  save();
  renderSeats();
  updatePot();

  handStartStack = seats[0].stack;
  await sleep(2100);
  if (rid !== handSeq) return;
  els.badge.classList.remove('show');

  // AI 補碼
  for (let i = 1; i < seats.length; i++) {
    if (seats[i].stack < BB) {
      seats[i].stack = AI_START;
      logMsg(`${seats[i].name} 補碼 ${money(AI_START)}`);
    }
  }

  inHand = false;
  busy = false;
  deck = [];
  for (const s of seats) {
    s.inHand = false;
    s.folded = false;
    s.allin = false;
    s.note = '';
    s.bet = 0;
    s.committed = 0;
  }
  currentBet = 0;
  state.holdemStack = seats[0].stack;
  save();
  renderSeats();
  stage('等待下一手');
  els.next.classList.remove('hidden');
  els.next.disabled = false;

  if (seats[0].stack < BB) {
    setStatus('籌碼見底了。補碼或離桌。', true);
    setTimeout(() => showBuyin('籌碼不足一個大盲。'), 500);
  } else {
    setStatus(`這一手結束。桌上籌碼 ${fmt(seats[0].stack)}。`);
  }
}

/* ---------------- 對外 ---------------- */

export function enterHoldem() {
  const ch = getChallenge();
  if (ch && ch.game === 'holdem') {
    challenge = ch;
    render();
    setupChallengeTable();
    return;
  }
  if (challenge || renderedMode === 'challenge') {
    challenge = null;
    inHand = false;
    busy = false;
    playerResolver = null;
    street = 'idle';
    board = [];
    boardEls = [];
    deck = [];
    results = [];
    currentBet = 0;
    seated = false;
  }
  render();
  if (seated) {
    renderSeats();
    updatePot();
    if (!inHand) {
      if (seats[0].stack >= BB) {
        els.next.classList.remove('hidden');
        els.next.disabled = false;
      } else {
        showBuyin('籌碼不足一個大盲。');
      }
    }
  }
}

export function leaveHoldem() {
  if (inHand || busy) return;
  if (renderedMode === 'challenge') return;
  if (seated && seats.length) {
    state.holdemStack = seats[0].stack;
    save();
    if (state.holdemStack > 0) {
      toast(`桌上還有 ${fmt(state.holdemStack)}，回來可以繼續。`, 'info');
    }
  }
}

export function canLeaveHoldem() {
  if (challengeActive()) { toast('挑戰進行中，請先完成或棄權。', 'warn'); return false; }
  if (inHand || busy) { toast('先打完這一手再走。', 'warn'); return false; }
  return true;
}
