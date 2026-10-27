import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, mountBetRange
} from '../core.js';

const root = () => document.getElementById('view-sicbo');
const CHIPS = [10000, 50000, 200000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieFace(n) {
  const on = new Set(PIPS[n] || []);
  return Array.from({ length: 9 }, (_, i) => `<span class="pip${on.has(i) ? ' on' : ''}"></span>`).join('');
}
function setDie(el, n) {
  el.innerHTML = dieFace(n);
  el.classList.toggle('red', n === 1 || n === 4);
}

const TOTALS = [
  { n: 4, odds: 60 }, { n: 5, odds: 30 }, { n: 6, odds: 17 }, { n: 7, odds: 12 },
  { n: 8, odds: 8 }, { n: 9, odds: 6 }, { n: 10, odds: 6 }, { n: 11, odds: 6 },
  { n: 12, odds: 6 }, { n: 13, odds: 8 }, { n: 14, odds: 12 }, { n: 15, odds: 17 },
  { n: 16, odds: 30 }, { n: 17, odds: 60 }
];

const CELLS = [
  { id: 'small', name: '小', sub: '4 - 10', odds: 1 },
  { id: 'big', name: '大', sub: '11 - 17', odds: 1 },
  { id: 'odd', name: '單', sub: '點數和為奇', odds: 1 },
  { id: 'even', name: '雙', sub: '點數和為偶', odds: 1 },
  { id: 'triple', name: '豹子', sub: '三顆同點', odds: 30 },
  ...TOTALS.map(t => ({ id: 't' + t.n, name: String(t.n), sub: '點數和', odds: t.odds }))
];
const BY_ID = Object.fromEntries(CELLS.map(c => [c.id, c]));

let chip = 50000;
let bets = {};
let lastBets = null;
let rolling = false;
let dice = [1, 1, 1];
let els = {};

function totalStake() {
  return Object.values(bets).reduce((n, v) => n + v, 0);
}

function syncControls() {
  if (!els.roll) return;
  const stake = totalStake();
  els.roll.disabled = rolling || stake <= 0 || state.cash < stake || state.locked;
  els.clear.disabled = rolling || stake <= 0;
  els.repeat.disabled = rolling || !lastBets || state.cash < (lastBets ? Object.values(lastBets).reduce((n, v) => n + v, 0) : 0);
  els.chips.forEach(c => {
    c.classList.toggle('active', Number(c.dataset.chip) === chip);
    c.disabled = rolling;
  });
  if (els.range) {
    els.range.sync(chip);
    els.range.setDisabled(rolling);
  }
  if (els.stake) els.stake.textContent = fmt(stake);
  if (!rolling && stake > state.cash) setStatus('押注超過手上的現金。', true);
  else if (!rolling && stake > 0) setStatus(`本局押注 ${fmt(stake)}，按「擲骰」開獎。`);
  else if (!rolling) setStatus('選籌碼，點選押注格；可同時押多格。');
  els.cells.forEach(btn => {
    const id = btn.dataset.cell;
    const amt = bets[id] || 0;
    btn.classList.toggle('on', amt > 0);
    btn.disabled = rolling;
    const tag = btn.querySelector('.sb-amt');
    if (tag) tag.textContent = amt > 0 ? fmt(amt) : '';
  });
}

function setStatus(text, warn = false) {
  if (!els.status) return;
  els.status.textContent = text || '';
  els.status.className = 'status-line' + (warn ? ' warn' : '');
}

function setBadge(text, kind = '') {
  if (!els.badge) return;
  els.badge.textContent = text;
  els.badge.className = 'table-badge' + (kind ? ' ' + kind : '');
  els.badge.classList.add('show');
}

function addBet(id) {
  if (rolling) return;
  if (totalStake() + chip > state.cash) { toast('現金不足。', 'warn'); return; }
  bets[id] = (bets[id] || 0) + chip;
  sound.chip();
  syncControls();
}

function clearBets() {
  if (rolling) return;
  bets = {};
  sound.click();
  syncControls();
}

function repeatBets() {
  if (rolling || !lastBets) return;
  const sum = Object.values(lastBets).reduce((n, v) => n + v, 0);
  if (sum > state.cash) { toast('現金不足，無法重押。', 'warn'); return; }
  bets = { ...lastBets };
  sound.chip();
  syncControls();
}

function payoutFor(id, d, total, triple) {
  switch (id) {
    case 'big': return !triple && total >= 11 && total <= 17 ? 1 : 0;
    case 'small': return !triple && total >= 4 && total <= 10 ? 1 : 0;
    case 'odd': return !triple && total % 2 === 1 ? 1 : 0;
    case 'even': return !triple && total % 2 === 0 ? 1 : 0;
    case 'triple': return triple ? 30 : 0;
    default: {
      if (id[0] !== 't') return 0;
      return Number(id.slice(1)) === total ? (BY_ID[id]?.odds || 0) : 0;
    }
  }
}

async function roll() {
  if (rolling || state.locked) return;
  const stake = totalStake();
  if (stake <= 0) { toast('先押注。', 'warn'); return; }
  if (state.cash < stake) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(stake)) return;

  rolling = true;
  lastBets = { ...bets };
  els.badge.classList.remove('show');
  syncControls();
  setStatus('骰子在盅裡翻滾……');
  els.sum.textContent = '—';
  els.diceWrap.classList.add('rolling');

  const final = [1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6));
  const t0 = Date.now();
  while (Date.now() - t0 < 1050) {
    const f = [1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6));
    els.dice.forEach((el, i) => setDie(el, f[i]));
    sound.tone(180 + Math.random() * 120, 0.03, 'square', 0.015);
    await sleep(75);
  }
  els.diceWrap.classList.remove('rolling');

  dice = final;
  for (let i = 0; i < 3; i++) {
    setDie(els.dice[i], dice[i]);
    els.dice[i].classList.add('land');
    sound.reelStop();
    await sleep(150);
    els.dice[i].classList.remove('land');
  }

  const total = dice[0] + dice[1] + dice[2];
  const triple = dice[0] === dice[1] && dice[1] === dice[2];
  els.sum.textContent = `合計 ${total}`;
  els.sum.classList.toggle('triple', triple);

  let returned = 0;
  for (const [id, amt] of Object.entries(bets)) {
    const odds = payoutFor(id, dice, total, triple);
    if (odds > 0) returned += amt * (1 + odds);
  }
  const profit = returned - stake;
  if (returned > 0) addCash(returned, { silent: true });

  const text = triple ? `豹子 ${dice[0]}！` : total >= 11 ? `大 · ${total}` : `小 · ${total}`;
  if (profit > 0) {
    setBadge(text, '');
    sound.win(profit >= stake * 5);
    if (profit >= stake * 20) sound.jackpot();
  } else if (profit === 0) {
    setBadge('退回本金', 'push');
    sound.push();
  } else {
    setBadge(text, 'lose');
    sound.lose();
  }

  const resultText = `開 ${dice.join(' · ')}${triple ? '（豹子）' : ''} · 合計 ${total}　${profit >= 0 ? '+' : ''}${fmt(profit)}`;
  setStatus(resultText, profit < 0);
  recordRound(profit, profit);
  refreshHud();
  advanceTime(45);

  await sleep(1500);
  els.badge.classList.remove('show');
  bets = {};
  rolling = false;
  syncControls();
  setStatus(resultText, profit < 0);
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>骰寶</h2>
      <span class="sub">三顆骰子 · 大／小／單／雙 · 豹子 30 倍</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="table-wrap sb-wrap">
      <div class="felt sb-felt">
        <div class="sb-stage">
          <div class="dice-wrap" id="sb-dice-wrap">
            <div class="die red" id="sb-die-0">${dieFace(1)}</div>
            <div class="die" id="sb-die-1">${dieFace(2)}</div>
            <div class="die" id="sb-die-2">${dieFace(3)}</div>
          </div>
          <div class="sb-sum" id="sb-sum">—</div>
          <div class="sb-note">買定離手。盅一開，數學就開始說話。</div>
        </div>
        <div class="table-badge" id="sb-badge"></div>
      </div>

      <div class="panel sb-board">
        <div class="sb-board-head">
          <span>押注格 · 點擊加注</span>
          <span>目前押注 <b id="sb-stake">NT$ 0</b></span>
        </div>
        <div class="sb-grid">
          ${CELLS.map(c => `
            <button class="sb-cell" data-cell="${c.id}">
              <b>${c.name}</b>
              <small>${c.sub}</small>
              <em>${c.odds} : 1</em>
              <i class="sb-amt"></i>
            </button>`).join('')}
        </div>
      </div>

      <div class="control-panel">
        <div class="control-group">
          <span class="control-label">籌碼</span>
          <div class="bet-range-host" id="sb-range"></div>
          <div class="chip-row">
            ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>籌碼</small></button>`).join('')}
          </div>
          <button class="btn small ghost" id="sb-clear">清除</button>
          <button class="btn small ghost" id="sb-repeat">重押</button>
        </div>
        <div class="control-group">
          <button class="btn gold" id="sb-roll">擲骰</button>
        </div>
        <div class="status-line" id="sb-status"></div>
      </div>
    </div>
  `;

  els = {
    diceWrap: el.querySelector('#sb-dice-wrap'),
    dice: [0, 1, 2].map(i => el.querySelector('#sb-die-' + i)),
    sum: el.querySelector('#sb-sum'),
    badge: el.querySelector('#sb-badge'),
    stake: el.querySelector('#sb-stake'),
    status: el.querySelector('#sb-status'),
    roll: el.querySelector('#sb-roll'),
    clear: el.querySelector('#sb-clear'),
    repeat: el.querySelector('#sb-repeat'),
    chips: Array.from(el.querySelectorAll('[data-chip]')),
    cells: Array.from(el.querySelectorAll('[data-cell]'))
  };

  els.range = mountBetRange(el.querySelector('#sb-range'), {
    label: '每次加注',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: chip,
    onChange: v => {
      if (rolling) return;
      chip = v;
    }
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('sicbo');
  els.chips.forEach(c => {
    c.onclick = () => {
      if (rolling) return;
      chip = Number(c.dataset.chip);
      sound.chip();
      syncControls();
    };
  });
  els.cells.forEach(btn => { btn.onclick = () => addBet(btn.dataset.cell); });
  els.clear.onclick = clearBets;
  els.repeat.onclick = repeatBets;
  els.roll.onclick = () => { sound.click(); roll(); };

  syncControls();
}

export function enterSicBo() {
  render();
  syncControls();
}

export function leaveSicBo() { }

export function canLeaveSicBo() {
  if (rolling) { toast('等骰子停下來。', 'warn'); return false; }
  return true;
}
