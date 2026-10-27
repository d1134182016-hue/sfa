import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, mountBetRange
} from '../core.js';

const root = () => document.getElementById('view-scratch');
const COSTS = [10000, 50000, 200000, 1000000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;

const PRIZES = [
  { mult: 0, w: 7000, sym: '·', name: '沒中' },
  { mult: 0.5, w: 1200, sym: '🍒', name: '櫻桃' },
  { mult: 1, w: 1000, sym: '🍋', name: '檸檬' },
  { mult: 2, w: 400, sym: '🍇', name: '葡萄' },
  { mult: 5, w: 250, sym: '🔔', name: '鈴鐺' },
  { mult: 10, w: 100, sym: '⭐', name: '星星' },
  { mult: 25, w: 35, sym: '<span class="s7">7</span>', name: '幸運七' },
  { mult: 100, w: 13, sym: '💎', name: '鑽石' },
  { mult: 500, w: 2, sym: '<span class="s-snake">蛇</span>', name: '蛇喰' }
];
const TOTAL_W = PRIZES.reduce((n, p) => n + p.w, 0);
const FILL = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7', '蛇'];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

let cost = 50000;
let phase = 'bet';
let card = null;
let prize = null;
let revealed = 0;
let busy = false;
let els = {};

function pickPrize() {
  let r = Math.random() * TOTAL_W;
  for (const p of PRIZES) {
    r -= p.w;
    if (r < 0) return p;
  }
  return PRIZES[0];
}

function randomFill() {
  return FILL[Math.floor(Math.random() * FILL.length)];
}

function lineTriple(cells, line) {
  const [a, b, c] = line;
  return cells[a] === cells[b] && cells[b] === cells[c];
}

function makeCard() {
  const p = pickPrize();
  const cells = Array.from({ length: 9 }, () => randomFill());
  let winLine = -1;

  if (p.mult > 0) {
    winLine = Math.floor(Math.random() * LINES.length);
    const line = LINES[winLine];
    for (const i of line) cells[i] = p.sym;
  }

  for (let guard = 0; guard < 40; guard++) {
    let fixed = false;
    for (let li = 0; li < LINES.length; li++) {
      if (li === winLine) continue;
      if (!lineTriple(cells, LINES[li])) continue;
      const idx = LINES[li][0];
      let next = randomFill();
      let tries = 0;
      while (next === cells[idx] && tries++ < 12) next = randomFill();
      cells[idx] = next;
      fixed = true;
    }
    if (!fixed) break;
  }

  return { cells, prize: p, winLine };
}

function syncControls() {
  if (!els.buy) return;
  const canBuy = !busy && phase === 'bet' && state.cash >= cost && !state.locked;
  els.buy.disabled = !canBuy;
  els.buy.textContent = phase === 'bet' ? '買一張' : '先刮完';
  els.reveal.disabled = busy || phase !== 'card';
  els.chips.forEach(c => {
    c.disabled = busy || phase !== 'bet';
    c.classList.toggle('active', Number(c.dataset.cost) === cost);
  });
  if (els.range) {
    els.range.sync(cost);
    els.range.setDisabled(busy || phase !== 'bet');
  }
  if (els.cost) els.cost.textContent = fmt(cost);
  if (els.count) els.count.textContent = card ? `已刮 ${revealed} / 9` : '尚未購買';
  if (!busy && phase === 'bet' && state.cash < cost) setStatus('現金不足，換便宜一點的卡或去借貸中心。', true);
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

function buy() {
  if (busy || state.locked) return;
  if (phase === 'card') { toast('先把這張刮完。', 'warn'); return; }
  if (state.cash < cost) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(cost)) return;

  busy = true;
  phase = 'card';
  revealed = 0;
  els.badge.classList.remove('show');
  els.grid.classList.remove('locked');
  card = makeCard();
  prize = card.prize;
  const html = card.cells.map((sym, i) => `
    <div class="scratch-cell" data-i="${i}">
      <div class="sc-face">${sym}</div>
      <div class="sc-foil"></div>
    </div>`).join('');
  els.grid.innerHTML = html;
  els.grid.classList.add('armed');
  els.cells = Array.from(els.grid.querySelectorAll('.scratch-cell'));
  sound.dealAll(4);
  setStatus('按住左鍵在卡片上塗抹，把九格銀箔刮開。');
  els.msg.textContent = '刮開三格連線，獎金就是你的';
  busy = false;
  syncControls();
  refreshHud();
}

function scratchCell(el) {
  if (!el || el.classList.contains('scratched')) return;
  el.classList.add('scratched');
  revealed += 1;
  sound.noise(0.06, 0.05, 2600);
  if (els.count) els.count.textContent = `已刮 ${revealed} / 9`;
  if (revealed >= 9) resolve();
}

function revealAll() {
  if (busy || phase !== 'card') return;
  for (const el of els.cells) {
    if (!el.classList.contains('scratched')) {
      el.classList.add('scratched');
      revealed += 1;
    }
  }
  if (els.count) els.count.textContent = '已刮 9 / 9';
  sound.card();
  resolve();
}

async function resolve() {
  if (busy || phase !== 'card') return;
  busy = true;
  phase = 'result';
  syncControls();
  const p = prize;
  const payout = Math.round(cost * p.mult);
  const profit = payout - cost;
  if (payout > 0) addCash(payout, { silent: true });

  if (card.winLine >= 0) {
    for (const i of LINES[card.winLine]) els.cells[i].classList.add('win');
  }

  let resultText;
  if (profit > 0) {
    setBadge(`中 ${fmt(payout)}`, '');
    resultText = `${p.name}連線 · 賠 ${p.mult} 倍　+${fmt(profit)}`;
    setStatus(resultText, false);
    sound.win(p.mult >= 10);
    if (p.mult >= 100) sound.jackpot();
  } else if (payout > 0) {
    setBadge(`退回 ${fmt(payout)}`, 'push');
    resultText = `${p.name}連線 · 賠 ${p.mult} 倍　${fmt(profit)}`;
    setStatus(resultText, true);
    sound.push();
  } else {
    setBadge('沒中', 'lose');
    resultText = '九格都刮完了，這張沒有連線。';
    setStatus(resultText, true);
    sound.lose();
  }
  els.msg.textContent = p.mult > 0 ? `三格 ${p.name} 連成一線` : '下一張，也許就中了';

  recordRound(profit, profit);
  refreshHud();
  advanceTime(20);

  await sleep(1700);
  els.badge.classList.remove('show');
  busy = false;
  phase = 'bet';
  setStatus(resultText, profit <= 0);
  syncControls();
  setStatus(resultText, profit <= 0);
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>刮刮樂</h2>
      <span class="sub">百花王即時刮 · 三格連線即中獎 · 最高 500 倍</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="scratch-wrap">
      <div class="scratch-card-wrap">
        <div class="scratch-top">
          <div class="scratch-brand">百花王 · 即時刮</div>
          <div class="scratch-cost">面額 <b id="sc-cost">NT$ 0</b></div>
        </div>
        <div class="scratch-grid locked" id="sc-grid">
          ${Array.from({ length: 9 }, () => `
            <div class="scratch-cell">
              <div class="sc-face">?</div>
              <div class="sc-foil"></div>
            </div>`).join('')}
        </div>
        <div class="scratch-foot">
          <span id="sc-count">尚未購買</span>
          <span class="scratch-msg" id="sc-msg">三格連線即中獎</span>
        </div>
        <div class="table-badge" id="sc-badge"></div>
      </div>

      <div class="panel scratch-side">
        <h3>獎金表</h3>
        <div class="scratch-pay">
          ${PRIZES.slice().reverse().filter(p => p.mult > 0).map(p => `
            <div class="pay-row"><span class="ps">${p.sym}</span><span>${p.name}連線</span><b>×${p.mult}</b></div>`).join('')}
          <div class="pay-row lose"><span class="ps">—</span><span>沒有連線</span><b>0</b></div>
        </div>
        <div class="pay-lines">
          每張卡固定九格。橫線、直線、斜線，只要三格相同即中獎。<br>
          獎金 = 面額 × 倍率。面額越高，最高獎金越大。
        </div>
        <div class="pay-note">期望值低於一，這是學園的算法。<br>但 500 倍的蛇，總有人會刮到。</div>
      </div>
    </div>

    <div class="control-panel scratch-controls">
      <div class="control-group">
        <span class="control-label">面額</span>
        <div class="bet-range-host" id="sc-range"></div>
        <div class="chip-row">
          ${COSTS.map(v => `<button class="chip-btn chip-${v}" data-cost="${v}">${chipLabel(v)}<small>面額</small></button>`).join('')}
        </div>
      </div>
      <div class="control-group">
        <button class="btn gold" id="sc-buy">買一張</button>
        <button class="btn ghost" id="sc-reveal">一鍵刮開</button>
      </div>
      <div class="status-line" id="sc-status"></div>
    </div>
  `;

  els = {
    grid: el.querySelector('#sc-grid'),
    cost: el.querySelector('#sc-cost'),
    count: el.querySelector('#sc-count'),
    msg: el.querySelector('#sc-msg'),
    badge: el.querySelector('#sc-badge'),
    status: el.querySelector('#sc-status'),
    buy: el.querySelector('#sc-buy'),
    reveal: el.querySelector('#sc-reveal'),
    chips: Array.from(el.querySelectorAll('[data-cost]')),
    cells: []
  };

  els.range = mountBetRange(el.querySelector('#sc-range'), {
    label: '面額金額',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: cost,
    onChange: v => {
      if (busy || phase !== 'bet') return;
      cost = v;
      if (els.cost) els.cost.textContent = fmt(cost);
      els.chips.forEach(c => c.classList.toggle('active', Number(c.dataset.cost) === cost));
      els.buy.disabled = state.cash < cost || state.locked;
    }
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('scratch');
  els.chips.forEach(c => {
    c.onclick = () => {
      if (busy || phase !== 'bet') return;
      cost = Number(c.dataset.cost);
      sound.chip();
      syncControls();
    };
  });
  els.buy.onclick = () => { sound.click(); buy(); };
  els.reveal.onclick = () => { sound.click(); revealAll(); };

  let down = false;
  const hit = (e) => {
    if (!down || phase !== 'card') return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const cell = t && t.closest ? t.closest('.scratch-cell') : null;
    if (cell && els.grid.contains(cell)) scratchCell(cell);
  };
  els.grid.addEventListener('pointerdown', e => {
    if (phase !== 'card') return;
    down = true;
    els.grid.setPointerCapture && els.grid.setPointerCapture(e.pointerId);
    hit(e);
  });
  els.grid.addEventListener('pointermove', hit);
  window.addEventListener('pointerup', () => { down = false; });
  window.addEventListener('pointercancel', () => { down = false; });

  syncControls();
}

export function enterScratch() {
  render();
  syncControls();
}

export function leaveScratch() { }

export function canLeaveScratch() {
  if (busy || phase === 'card' || phase === 'result') {
    toast('先把這張卡刮完。', 'warn');
    return false;
  }
  return true;
}
