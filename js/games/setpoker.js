import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, clamp, mountBetRange
} from '../core.js';
import { makeDeck, shuffle, cardEl, dealCard, moveCard, clearCards, flip } from '../cards.js';
import {
  arrangeBest, rowsValid, compareRows, eval3, eval5, cat5From3, cmpScore, cmpEval
} from '../eval.js';
import {
  cardOptions, parseCardId, setPending, drawWithCheat, mountCheatDock
} from '../cheat.js';

const root = () => document.getElementById('view-setpoker');
const CHIPS = [10000, 50000, 200000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;
const CAP = { front: 3, mid: 5, back: 5 };
const ROW_NAME = { front: '前墩', mid: '中墩', back: '後墩' };
const ORDER = ['front', 'mid', 'back'];

let bet = 50000;
let phase = 'bet';        // bet | arrange | result
let busy = false;
let roundBet = 0;
let playerCards = [];
let aiCards = [];
let placement = { front: [], mid: [], back: [] };
let faces = new Map();    // card.id -> element
let targetRow = 'front';
let els = {};

function syncControls() {
  if (!els.deal) return;
  const arranging = phase === 'arrange';
  els.deal.classList.toggle('hidden', arranging);
  els.auto.classList.toggle('hidden', !arranging);
  els.clearBoard.classList.toggle('hidden', !arranging);
  els.confirm.classList.toggle('hidden', !arranging);
  els.betChipsWrap.style.opacity = arranging ? '.45' : '';

  els.deal.disabled = busy || arranging || bet <= 0 || state.cash < bet || state.locked;
  els.deal.textContent = phase === 'result' ? '再來一局' : '發牌';
  els.auto.disabled = busy;
  els.clearBoard.disabled = busy;
  els.confirm.disabled = busy;

  els.chips.forEach(c => { c.disabled = busy || arranging; });
  els.clearBet.disabled = busy || arranging || bet <= 0;

  const placed = placement.front.length + placement.mid.length + placement.back.length;
  els.count.textContent = arranging ? `已排 ${placed} / 13` : '等待發牌';
  if (els.bet) els.bet.textContent = fmt(arranging ? roundBet : bet);
  if (els.range) {
    els.range.sync(arranging ? roundBet : bet);
    els.range.setDisabled(busy || arranging);
  }

  for (const key of ORDER) {
    const row = els.rows[key];
    row.classList.toggle('hot', arranging && targetRow === key);
  }
  if (arranging) updateRowLabels();
}

function setStatus(text, warn = false) {
  if (!els.status) return;
  els.status.textContent = text || '';
  els.status.className = 'status-line' + (warn ? ' warn' : '');
}

function updateRowLabels() {
  for (const key of ORDER) {
    const small = els.rows[key].querySelector('small');
    if (!small) continue;
    const cards = placement[key];
    if (cards.length < CAP[key]) {
      small.textContent = `還差 ${CAP[key] - cards.length} 張`;
      continue;
    }
    if (key === 'front') small.textContent = eval3(cards).name;
    else small.textContent = eval5(cards).name;
  }
}

function renderPlaceholders(key) {
  const box = els.rows[key].querySelector('.sp-slots');
  box.querySelectorAll('.slot-empty').forEach(s => s.remove());
  const need = CAP[key] - placement[key].length;
  for (let i = 0; i < need; i++) {
    const s = document.createElement('div');
    s.className = 'slot-empty';
    box.appendChild(s);
  }
}

function removePlaceholders(key) {
  const box = els.rows[key].querySelector('.sp-slots');
  box.querySelectorAll('.slot-empty').forEach(s => s.remove());
}

function nextTarget() {
  for (const key of ORDER) {
    if (placement[key].length < CAP[key]) { targetRow = key; return key; }
  }
  targetRow = null;
  return null;
}

function addBet(v) {
  if (busy || phase === 'arrange') return;
  if (bet + v > state.cash) { toast('現金不足。', 'warn'); return; }
  bet += v;
  phase = 'bet';
  sound.chip();
  syncControls();
}

function findPlacedRow(card) {
  for (const key of ORDER) {
    if (placement[key].some(c => c.id === card.id)) return key;
  }
  return null;
}

function onCardClick(el) {
  if (phase !== 'arrange' || busy) return;
  const id = Number(el.dataset.id);
  const card = playerCards.find(c => c.id === id);
  if (!card) return;

  const rowKey = findPlacedRow(card);
  if (rowKey) {
    placement[rowKey] = placement[rowKey].filter(c => c.id !== id);
    targetRow = rowKey;
    moveCard(el, els.tray, { silent: true });
    renderPlaceholders(rowKey);
    nextTarget();
  } else {
    let key = targetRow && placement[targetRow].length < CAP[targetRow] ? targetRow : nextTarget();
    if (!key) { toast('三墩都滿了，先拿回一張。', 'warn'); return; }
    placement[key].push(card);
    removePlaceholders(key);
    moveCard(el, els.rows[key].querySelector('.sp-slots'), { silent: true });
    renderPlaceholders(key);
    nextTarget();
  }
  sound.chip();
  syncControls();
}

function autoArrange() {
  if (phase !== 'arrange' || busy) return;
  const best = arrangeBest(playerCards, true);
  for (const key of ORDER) removePlaceholders(key);
  const layout = { front: best.front, mid: best.mid, back: best.back };
  for (const key of ORDER) {
    const box = els.rows[key].querySelector('.sp-slots');
    for (const card of layout[key]) {
      const el = faces.get(card.id);
      if (el) moveCard(el, box, { silent: true });
    }
    placement[key] = layout[key].slice();
  }
  targetRow = null;
  for (const key of ORDER) renderPlaceholders(key);
  updateRowLabels();
  sound.card();
  setStatus('已自動排列成最強的一手。要調整也可以。');
  syncControls();
}

function clearBoard() {
  if (phase !== 'arrange' || busy) return;
  for (const key of ORDER) {
    removePlaceholders(key);
    for (const card of placement[key]) {
      const el = faces.get(card.id);
      if (el) moveCard(el, els.tray, { silent: true });
    }
    placement[key] = [];
  }
  targetRow = 'front';
  for (const key of ORDER) renderPlaceholders(key);
  syncControls();
  setStatus('牌都回到手牌區。');
}

function validate() {
  const total = placement.front.length + placement.mid.length + placement.back.length;
  if (total !== 13) return '請把 13 張牌排完（前 3、中 5、後 5）。';
  if (!rowsValid(placement.front, placement.mid, placement.back)) {
    const f = cat5From3(eval3(placement.front));
    const m = eval5(placement.mid);
    const b = eval5(placement.back);
    if (cmpScore(f, m) > 0) return '前墩比中墩大，這樣不行。';
    if (cmpEval(m, b) > 0) return '中墩比後墩大，這樣不行。';
    return '牌型排列不合法。';
  }
  return null;
}

function renderAiBacks() {
  const box = els.ai;
  box.innerHTML = '';
  for (const [key, label] of [['back', '後墩'], ['mid', '中墩'], ['front', '前墩']]) {
    const head = document.createElement('div');
    head.className = 'sp-ai-label';
    head.innerHTML = `<span>${label}</span><span>蓋牌</span>`;
    const hand = document.createElement('div');
    hand.className = 'hand';
    hand.dataset.row = key;
    box.appendChild(head);
    box.appendChild(hand);
  }
}

function renderAiRows(layout) {
  const box = els.ai;
  box.innerHTML = '';
  const groups = [['back', '後墩'], ['mid', '中墩'], ['front', '前墩']];
  for (const [key, label] of groups) {
    const name = key === 'front' ? eval3(layout[key]).name : eval5(layout[key]).name;
    const head = document.createElement('div');
    head.className = 'sp-ai-label';
    head.innerHTML = `<span>${label}</span><span>${name}</span>`;
    const hand = document.createElement('div');
    hand.className = 'hand';
    for (const card of layout[key]) hand.appendChild(cardEl(card, false));
    box.appendChild(head);
    box.appendChild(hand);
  }
}

async function startDeal() {
  if (busy || state.locked) return;
  if (bet <= 0) { toast('先押注。', 'warn'); return; }
  if (state.cash < bet) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(bet)) { toast('現金不足。', 'warn'); return; }

  busy = true;
  phase = 'bet';
  roundBet = bet;
  placement = { front: [], mid: [], back: [] };
  targetRow = 'front';
  faces = new Map();
  playerCards = [];
  aiCards = [];
  els.score.classList.add('hidden');
  els.score.innerHTML = '';
  els.deal.classList.remove('hidden');
  syncControls();
  setStatus('洗牌、發牌……');
  els.msg.textContent = '三墩順序：前 3 ≤ 中 5 ≤ 後 5';

  await clearCards(els.tray, false);
  await clearCards(els.ai, false);
  renderAiBacks();
  for (const key of ORDER) {
    const box = els.rows[key].querySelector('.sp-slots');
    box.innerHTML = '';
  }

  const deck = shuffle(makeDeck(1));
  for (let i = 0; i < 13; i++) {
    const pc = drawWithCheat('setpoker', deck);
    playerCards.push(pc);
    const el = dealCard(els.tray, pc, { silent: true });
    faces.set(pc.id, el);
    el.dataset.click = '1';
    sound.card();
    await sleep(70);

    const ac = drawWithCheat('setpoker', deck);
    aiCards.push(ac);
    const aiKey = i < 5 ? 'back' : i < 10 ? 'mid' : 'front';
    const aiHand = els.ai.querySelector(`.hand[data-row="${aiKey}"]`);
    dealCard(aiHand, ac, { faceDown: true, silent: true });
    if (i % 2 === 1) sound.card();
    await sleep(55);
  }

  await sleep(240);
  for (const key of ORDER) renderPlaceholders(key);
  phase = 'arrange';
  busy = false;
  syncControls();
  setStatus('點擊手牌放入當前墩；點擊已放的牌可以拿回來。');
  els.msg.textContent = '前墩 ≤ 中墩 ≤ 後墩，排錯不能出牌';
}

async function confirmHand() {
  if (phase !== 'arrange' || busy) return;
  const err = validate();
  if (err) { toast(err, 'warn'); setStatus(err, true); return; }

  busy = true;
  phase = 'result';
  syncControls();
  setStatus('莊家排牌中……');

  const aiLayout = arrangeBest(aiCards, true);
  const ais = Array.from(els.ai.querySelectorAll('.card.face-down'));
  for (const el of ais) {
    el.classList.remove('face-down');
    sound.flip();
    await sleep(55);
  }
  await sleep(420);
  renderAiRows(aiLayout);

  const res = compareRows(
    { front: placement.front, mid: placement.mid, back: placement.back },
    aiLayout
  );

  const net = res.net;
  let profit;
  if (net > 0) {
    profit = roundBet * net;
    addCash(roundBet + profit, { silent: true });
    sound.win(net >= 4);
  } else if (net === 0) {
    addCash(roundBet, { silent: true });
    profit = 0;
    sound.push();
  } else {
    const extra = Math.min(roundBet * (-net - 1), Math.max(0, state.cash));
    if (extra > 0) spendCash(extra);
    profit = -(roundBet + extra);
    sound.lose();
  }

  const rowsHTML = res.rows.map(r => {
    const cls = r.cmp > 0 ? 'win' : r.cmp < 0 ? 'lose' : '';
    const sign = r.cmp > 0 ? '+1' : r.cmp < 0 ? '-1' : '0';
    return `<div class="sp-score-row ${cls}">
        <span>${r.name}</span>
        <span>${r.pName} <span style="color:#5f5b53">vs</span> ${r.aName}</span>
        <b>${sign}</b>
      </div>`;
  }).join('');

  const bonusBits = [];
  if (res.allWin) bonusBits.push('全壘打 +2');
  if (res.pBonus) bonusBits.push('牌型加成 +' + res.pBonus);
  if (res.aBonus) bonusBits.push('莊家加成 -' + res.aBonus);

  els.score.innerHTML = `
    <div class="sp-score">${rowsHTML}
      <div class="sp-total">
        <span>三墩結算${bonusBits.length ? ' · ' + bonusBits.join(' · ') : ''}</span>
        <b class="${net > 0 ? 'win' : net < 0 ? 'lose' : ''}">${net > 0 ? '+' : ''}${net} 倍 · ${profit >= 0 ? '+' : ''}${fmt(profit)}</b>
      </div>
    </div>`;
  els.score.classList.remove('hidden');

  recordRound(profit, profit);
  refreshHud();
  advanceTime(75);

  const label = net > 0 ? `贏了 ${net} 倍` : net < 0 ? `輸了 ${-net} 倍` : '平手';
  setStatus(`${label}　${profit >= 0 ? '+' : ''}${fmt(profit)}`, net < 0);
  els.msg.textContent = net > 0 ? '莊家把籌碼推過來。' : net < 0 ? '下一局，記得先顧前墩。' : '三墩打平，莊家不收。';
  toast(`${label} · ${profit >= 0 ? '+' : ''}${fmt(profit)}`, net > 0 ? 'good' : net < 0 ? 'warn' : 'info');

  await sleep(1400);
  phase = 'result';
  busy = false;
  bet = clamp(bet, 10000, Math.max(10000, state.cash));
  syncControls();
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>十三支</h2>
      <span class="sub">前 3 · 中 5 · 後 5 · 全壘打 +2</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="sp-wrap">
      <div class="felt sp-felt">
        <div class="deck-source"><span class="shoe-count">牌堆</span></div>
        <div class="sp-board">
          <div class="sp-ai" id="sp-ai"><div class="sp-ai-label"><span>莊家</span><span>等待發牌</span></div></div>
          <div class="sp-rows">
            ${ORDER.map(key => `
              <div class="sp-row" data-row="${key}">
                <div class="sp-row-label">${ROW_NAME[key]}<small>還差 ${CAP[key]} 張</small></div>
                <div class="sp-slots"></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="bet-display">本局底注 <b id="sp-bet">NT$ 0</b></div>
        <div class="nn-mult" id="sp-msg" style="text-align:center;margin-top:10px">前墩 ≤ 中墩 ≤ 後墩，排錯不能出牌</div>
      </div>

      <div class="panel sp-tray-wrap">
        <div class="sp-tray-head">
          <span>你的手牌 · 點擊放入當前墩</span>
          <span id="sp-count">等待發牌</span>
        </div>
        <div class="sp-tray" id="sp-tray"></div>
      </div>

      <div class="control-panel">
        <div class="control-group" id="sp-bet-wrap">
          <span class="control-label">底注</span>
          <div class="bet-range-host" id="sp-range"></div>
          <div class="chip-row">
            ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>籌碼</small></button>`).join('')}
          </div>
          <button class="btn small ghost" id="sp-clear-bet">最小</button>
        </div>
        <div class="control-group">
          <button class="btn gold" id="sp-deal">發牌</button>
          <button class="btn hidden" id="sp-auto">自動排列</button>
          <button class="btn ghost hidden" id="sp-clear-board">收回</button>
          <button class="btn gold hidden" id="sp-confirm">確認出牌</button>
        </div>
        <div class="status-line" id="sp-status"></div>
      </div>

      <div class="panel sp-score hidden" id="sp-score"></div>
    </div>
  `;

  els = {
    ai: el.querySelector('#sp-ai'),
    tray: el.querySelector('#sp-tray'),
    rows: {
      front: el.querySelector('[data-row="front"]'),
      mid: el.querySelector('[data-row="mid"]'),
      back: el.querySelector('[data-row="back"]')
    },
    score: el.querySelector('#sp-score'),
    bet: el.querySelector('#sp-bet'),
    msg: el.querySelector('#sp-msg'),
    status: el.querySelector('#sp-status'),
    count: el.querySelector('#sp-count'),
    deal: el.querySelector('#sp-deal'),
    auto: el.querySelector('#sp-auto'),
    clearBoard: el.querySelector('#sp-clear-board'),
    confirm: el.querySelector('#sp-confirm'),
    clearBet: el.querySelector('#sp-clear-bet'),
    betChipsWrap: el.querySelector('#sp-bet-wrap'),
    chips: Array.from(el.querySelectorAll('[data-chip]'))
  };

  els.range = mountBetRange(el.querySelector('#sp-range'), {
    label: '底注金額',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: bet,
    onChange: v => {
      if (busy || phase === 'arrange') return;
      bet = v;
      phase = 'bet';
      if (els.bet) els.bet.textContent = fmt(bet);
      els.deal.disabled = !(bet > 0 && state.cash >= bet) || state.locked;
      els.clearBet.disabled = bet <= 0;
    }
  });

  mountCheatDock(el, {
    game: 'setpoker',
    label: '十三支',
    stake: () => bet,
    options: cardOptions(),
    onPick: opt => setPending('setpoker', 'card', parseCardId(opt.id))
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('setpoker');
  els.deal.onclick = () => { sound.click(); startDeal(); };
  els.auto.onclick = () => autoArrange();
  els.clearBoard.onclick = () => clearBoard();
  els.confirm.onclick = () => confirmHand();
  els.chips.forEach(c => { c.onclick = () => addBet(Number(c.dataset.chip)); });
  els.clearBet.onclick = () => {
    if (busy || phase === 'arrange') return;
    bet = 10000;
    phase = 'bet';
    sound.click();
    syncControls();
  };

  for (const key of ORDER) {
    const row = els.rows[key];
    row.addEventListener('click', e => {
      if (e.target.closest('.card')) return;
      if (phase !== 'arrange' || busy) return;
      targetRow = key;
      sound.click();
      syncControls();
    });
  }
  el.addEventListener('click', e => {
    const card = e.target.closest('.sp-tray .card, .sp-slots .card');
    if (!card) return;
    onCardClick(card);
  });

  for (const key of ORDER) renderPlaceholders(key);
  syncControls();
}

export function enterSetPoker() {
  render();
  syncControls();
}

export function leaveSetPoker() { }

export function canLeaveSetPoker() {
  if (busy) { toast('這一局還沒結束。', 'warn'); return false; }
  if (phase === 'arrange') {
    toast('先把這手牌排完或收回重發。', 'warn');
    return false;
  }
  return true;
}
