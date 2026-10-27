import {
  state, fmt, money, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, rndInt, pick, countUp, coinBurst, mountBetRange
} from '../core.js';

const root = () => document.getElementById('view-slots');

const SYMBOLS = [
  { k: 'cherry', ch: '🍒', w: 30, pay: 6, name: '櫻桃' },
  { k: 'lemon', ch: '🍋', w: 24, pay: 12, name: '檸檬' },
  { k: 'grape', ch: '🍇', w: 18, pay: 25, name: '葡萄' },
  { k: 'bell', ch: '🔔', w: 12, pay: 50, name: '鈴鐺' },
  { k: 'star', ch: '⭐', w: 9, pay: 100, name: '星星' },
  { k: 'seven', ch: '<span class="seven">7</span>', w: 6, pay: 250, name: '幸運七' },
  { k: 'diamond', ch: '💎', w: 3, pay: 750, name: '鑽石' }
];
const WEIGHTED = [];
for (const s of SYMBOLS) for (let i = 0; i < s.w; i++) WEIGHTED.push(s);
const BY_KEY = Object.fromEntries(SYMBOLS.map(s => [s.k, s]));

const LINES = [
  { name: '橫線 · 上', rows: [0, 0, 0] },
  { name: '橫線 · 中', rows: [1, 1, 1] },
  { name: '橫線 · 下', rows: [2, 2, 2] },
  { name: '斜線 ↘', rows: [0, 1, 2] },
  { name: '斜線 ↗', rows: [2, 1, 0] }
];

const BET_STEPS = [1000, 5000, 20000, 100000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;
let betPerLine = 5000;
let spinning = false;
let els = {};
let lastWin = 0;

const pickSymbol = () => pick(WEIGHTED);
const symHTML = (s, cls = '') => `<div class="sym-cell ${cls}" data-sym="${s.k}">${s.ch}</div>`;

function totalBet() { return betPerLine * LINES.length; }

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>拉霸機</h2>
      <span class="sub">3 輪 × 5 線 · 每線獨立派彩</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>
    <div class="slots-wrap">
      <div class="slot-machine">
        <div class="slot-flash" id="slot-flash"></div>
        <div class="slot-top">
          <div class="slot-title">百花王 · 777</div>
          <div class="slot-lights"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="reels" id="slot-reels">
          <div class="reel" id="reel-0"></div>
          <div class="reel" id="reel-1"></div>
          <div class="reel" id="reel-2"></div>
          <div class="slot-frame-line"></div>
        </div>
        <div class="slot-bottom">
          <div class="slot-payout">本局贏得 <b id="slot-win">NT$ 0</b><div style="font-size:10px;color:#6f6b62;margin-top:3px" id="slot-msg">每線 ${money(betPerLine)} · 總投注 ${money(totalBet())}</div></div>
          <div class="control-group">
            <div class="bet-range-host" id="slot-range"></div>
            <div class="chip-row">
              ${BET_STEPS.map(v => `<button class="chip-btn chip-${v}" data-bet="${v}">${chipLabel(v)}<small>每線</small></button>`).join('')}
            </div>
            <button class="btn gold" id="slot-spin">拉霸</button>
          </div>
        </div>
      </div>
      <div class="panel paytable">
        <h3>賠付表（三輪相同）</h3>
        <div class="paytable-list">
          ${SYMBOLS.slice().reverse().map(s => `<div class="pay-row"><span class="ps">${s.ch}</span><span>${s.name}</span><b>×${s.pay}</b></div>`).join('')}
        </div>
        <div class="pay-lines">
          每線押注 × 賠率即為該線獎金。<br>
          前兩輪同為 🍒 或 🍋，第三輪不同 → 賠 1 倍。<br>
          5 條線獨立計算，可同時中獎。
        </div>
        <div class="pay-note">投注 ${money(totalBet())}，中獎直接匯入現金。<br>拉霸不抽手續費，但數學不會說謊。</div>
      </div>
    </div>
  `;

  els = {
    reels: [el.querySelector('#reel-0'), el.querySelector('#reel-1'), el.querySelector('#reel-2')],
    spin: el.querySelector('#slot-spin'),
    win: el.querySelector('#slot-win'),
    msg: el.querySelector('#slot-msg'),
    flash: el.querySelector('#slot-flash'),
    chips: Array.from(el.querySelectorAll('[data-bet]'))
  };

  els.range = mountBetRange(el.querySelector('#slot-range'), {
    label: '每線下注',
    min: 1000,
    step: 1000,
    max: () => Math.max(1000, Math.floor(state.cash / LINES.length / 1000) * 1000),
    value: betPerLine,
    onChange: v => {
      if (spinning) return;
      betPerLine = v;
      els.chips.forEach(c => c.classList.toggle('active', Number(c.dataset.bet) === betPerLine));
      if (els.msg) els.msg.textContent = `每線 ${money(betPerLine)} · 總投注 ${money(totalBet())}`;
      els.spin.disabled = state.cash < totalBet();
    }
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('slots');
  els.chips.forEach(chip => {
    chip.onclick = () => {
      if (spinning) return;
      betPerLine = Number(chip.dataset.bet);
      sound.chip();
      updateBetUI();
    };
  });
  els.spin.onclick = () => { sound.click(); spin(); };

  for (let i = 0; i < 3; i++) {
    const reel = els.reels[i];
    reel.innerHTML = `<div class="strip">${Array.from({ length: 3 }, () => symHTML(pickSymbol())).join('')}</div>`;
    reel.querySelector('.strip').style.transform = 'translateY(0)';
  }
  updateBetUI();
}

function updateBetUI() {
  if (!els.chips) return;
  els.chips.forEach(c => {
    c.classList.toggle('active', Number(c.dataset.bet) === betPerLine);
    c.disabled = spinning;
  });
  if (els.range) {
    els.range.sync(betPerLine);
    els.range.setDisabled(spinning);
  }
  if (els.msg && !spinning) els.msg.textContent = `每線 ${money(betPerLine)} · 總投注 ${money(totalBet())}`;
  els.spin.disabled = spinning || state.cash < totalBet();
  countUp(els.win, lastWin);
}

function buildStrip(reel, symbols) {
  reel.innerHTML = `<div class="strip">${symbols.map(s => symHTML(s)).join('')}</div>`;
  return reel.querySelector('.strip');
}

function spinReel(index, results, duration) {
  return new Promise(resolve => {
    const reel = els.reels[index];
    const h = reel.clientHeight / 3;
    const prefix = Array.from({ length: 18 }, () => pickSymbol());
    const strip = buildStrip(reel, [...prefix, ...results]);
    strip.style.transition = 'none';
    strip.style.transform = `translateY(${-rndInt(0, 5) * h}px)`;
    void strip.offsetWidth;
    reel.classList.add('spinning');
    strip.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.12,1)`;
    strip.style.transform = `translateY(${-18 * h}px)`;
    setTimeout(() => {
      reel.classList.remove('spinning');
      sound.reelStop();
      resolve(strip);
    }, duration + 40);
  });
}

async function spin() {
  if (spinning) return;
  const cost = totalBet();
  if (state.cash < cost) { toast('現金不足，降注或去借錢。', 'warn'); return; }
  if (!spendCash(cost)) return;
  spinning = true;
  lastWin = 0;
  els.win.textContent = 'NT$ 0';
  els.win.dataset.v = '0';
  els.flash.classList.remove('on');
  els.msg.textContent = '轉動中……';
  updateBetUI();

  const results = [
    [0, 1, 2].map(() => pickSymbol()),
    [0, 1, 2].map(() => pickSymbol()),
    [0, 1, 2].map(() => pickSymbol())
  ];

  const strips = await Promise.all([
    spinReel(0, results[0], 1750),
    spinReel(1, results[1], 2050),
    spinReel(2, results[2], 2350)
  ]);

  await sleep(160);
  const reels = results.map(r => r.map(s => s.k));
  const wins = evaluate(reels);
  lastWin = wins.total;

  if (lastWin > 0) {
    addCash(lastWin, { silent: true });
    recordRound(lastWin, lastWin - cost);
    els.win.dataset.v = '0';
    countUp(els.win, lastWin, 700);
    els.msg.textContent = lastWin >= cost * 10 ? '中大獎了！' : '中獎！';
    els.flash.classList.add('on');
    sound.win(lastWin >= cost * 10);
    highlightWins(strips, wins.cells);
    if (lastWin >= cost * 20) {
      sound.jackpot();
      burst();
    }
  } else {
    recordRound(0, -cost);
    els.msg.textContent = '沒中。再拉一次？';
    sound.lose();
  }

  refreshHud();
  advanceTime(30);
  spinning = false;
  updateBetUI();
}

function evaluate(reels) {
  let total = 0;
  const cells = new Set();
  for (let line = 0; line < LINES.length; line++) {
    const rows = LINES[line].rows;
    const syms = rows.map((row, col) => reels[col][row]);
    const a = BY_KEY[syms[0]], b = BY_KEY[syms[1]], c = BY_KEY[syms[2]];
    if (syms[0] === syms[1] && syms[1] === syms[2]) {
      total += a.pay * betPerLine;
      for (let col = 0; col < 3; col++) cells.add(col + ':' + rows[col]);
    } else if (syms[0] === syms[1] && (syms[0] === 'cherry' || syms[0] === 'lemon')) {
      total += betPerLine;
      cells.add('0:' + rows[0]);
      cells.add('1:' + rows[1]);
    }
  }
  return { total, cells };
}

function highlightWins(strips, cells) {
  strips.forEach((strip, col) => {
    const items = strip.querySelectorAll('.sym-cell');
    for (let row = 0; row < 3; row++) {
      if (cells.has(col + ':' + row)) {
        const el = items[18 + row];
        if (el) el.classList.add('win-cell');
      }
    }
  });
}

function burst() {
  const r = els.win.getBoundingClientRect();
  coinBurst(r.left + r.width / 2, r.top + r.height / 2, 26);
}

export function enterSlots() {
  render();
  updateBetUI();
}

export function leaveSlots() { }

export function canLeaveSlots() {
  if (spinning) { toast('等輪子停下來。', 'warn'); return false; }
  return true;
}
