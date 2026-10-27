import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, save, clamp, mountBetRange
} from '../core.js';

const root = () => document.getElementById('view-pachinko');
const CHIPS = [10000, 50000, 200000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;
const SLOT_OPTIONS = [5, 7, 9, 11];
const MAX_OPTIONS = [4, 16, 64, 256, 512];
const MIN_OPTIONS = [0.1, 0.5, 1];
const BALL_OPTIONS = [1, 5, 10, 20];
const W = 360;
const H = 520;
const PAD = 6;

const PEGS = [];
for (let row = 0; row < 8; row++) {
  const y = 96 + row * 42;
  const offset = row % 2 === 0 ? 40 : 60;
  for (let i = 0; i < 8; i++) {
    const x = offset + i * 40;
    if (x > 330) continue;
    PEGS.push({ x, y });
  }
}
PEGS.push({ x: 180, y: 438 });

let chip = 50000;
let ballCount = 1;
let busy = false;
let aim = 50;
let lastSlot = -1;
let history = [];
let els = {};

function cfg() {
  const c = state.pachinko || {};
  return {
    slots: SLOT_OPTIONS.includes(c.slots) ? c.slots : 9,
    maxMult: MAX_OPTIONS.includes(c.maxMult) ? c.maxMult : 4,
    minMult: MIN_OPTIONS.includes(c.minMult) ? c.minMult : 0.1,
    balls: BALL_OPTIONS.includes(c.balls) ? c.balls : 1
  };
}

function roundMult(m) {
  if (m >= 10) return Math.round(m);
  if (m >= 1) return Math.round(m * 10) / 10;
  return Math.round(m * 100) / 100;
}

function buildMultipliers({ slots, maxMult, minMult }) {
  const c = (slots - 1) / 2;
  const out = [];
  for (let i = 0; i < slots; i++) {
    const d = Math.abs(i - c);
    const t = 1 - d / c;
    out.push(roundMult(minMult * Math.pow(maxMult / minMult, Math.pow(t, 1.35))));
  }
  out[c] = maxMult;
  out[0] = minMult;
  out[slots - 1] = minMult;
  return out;
}

function mults() { return buildMultipliers(cfg()); }

function averageMult() {
  const list = mults();
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function multLabel(m) {
  const s = m >= 10 ? String(Math.round(m)) : String(m);
  return '×' + s;
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

function syncSettings() {
  const c = cfg();
  els.slotBtns.forEach(b => {
    b.classList.toggle('active', Number(b.dataset.slots) === c.slots);
    b.disabled = busy;
  });
  els.maxBtns.forEach(b => {
    b.classList.toggle('active', Number(b.dataset.max) === c.maxMult);
    b.disabled = busy;
  });
  els.minBtns.forEach(b => {
    b.classList.toggle('active', Number(b.dataset.min) === c.minMult);
    b.disabled = busy;
  });
  els.ballBtns.forEach(b => {
    b.classList.toggle('active', Number(b.dataset.balls) === ballCount);
    b.disabled = busy;
  });
  if (els.cfgSlots) els.cfgSlots.textContent = c.slots + ' 格';
  if (els.cfgMax) els.cfgMax.textContent = multLabel(c.maxMult);
  if (els.cfgMin) els.cfgMin.textContent = multLabel(c.minMult);
  if (els.ballNote) els.ballNote.textContent = ballCount + ' 顆';
  if (els.rtp) {
    const avg = averageMult();
    els.rtp.textContent = avg.toFixed(2) + '×';
    els.rtp.className = avg > 1.05 ? 'hot' : '';
  }
  if (els.rtpNote) {
    const avg = averageMult();
    els.rtpNote.textContent = avg > 1.05
      ? '平均賠率超過 1，這個台面長期對玩家有利。波動極大，純娛樂。'
      : avg > 0.95
        ? '平均賠率接近公平桌，勝負全看鋼珠落點。'
        : '平均賠率低於 1，莊家站在你對面。';
  }
}

function syncControls() {
  if (!els.drop) return;
  const cost = chip * ballCount;
  els.drop.disabled = busy || state.cash < cost || state.locked;
  els.drop.textContent = ballCount > 1 ? `投珠 ×${ballCount}` : '投珠';
  els.chips.forEach(c => {
    c.disabled = busy;
    c.classList.toggle('active', Number(c.dataset.chip) === chip);
  });
  if (els.range) {
    els.range.sync(chip);
    els.range.setDisabled(busy);
  }
  if (els.aim) els.aim.disabled = busy;
  if (els.bet) els.bet.textContent = fmt(cost);
  syncSettings();
  if (!busy && state.cash < cost) setStatus(`籌碼不足（需要 ${fmt(cost)}），降低投注或去債務中心。`, true);
  else if (!busy) setStatus(
    ballCount > 1
      ? `一次投 ${ballCount} 顆，總投注 ${fmt(cost)}。`
      : '調整落點，投下鋼珠。倍率越高，格位越靠中央。'
  );
}

function slotOf(x) {
  const c = cfg();
  const inner = W - PAD * 2;
  return clamp(Math.floor((x - PAD) / (inner / c.slots)), 0, c.slots - 1);
}

function highlightSlot(idx) {
  els.slots.forEach((el, i) => el.classList.toggle('hit', i === idx));
}

function ballLeft() {
  return 40 + (aim / 100) * 280;
}

function resetBall() {
  if (!els.preview) return;
  els.preview.style.left = (ballLeft() / W) * 100 + '%';
  els.preview.style.top = (26 / H) * 100 + '%';
  els.preview.style.opacity = busy ? '0' : '.6';
}

function makeBall() {
  const ball = document.createElement('div');
  ball.className = 'pk-ball';
  ball.style.opacity = '1';
  ball.style.left = '50%';
  ball.style.top = (26 / H) * 100 + '%';
  els.board.appendChild(ball);
  return ball;
}

function runBall(ball, startX) {
  return new Promise(resolve => {
    let x = clamp(startX, 18, 342);
    let y = 26;
    let vx = (aim - 50) / 50 * 0.32 + (Math.random() - 0.5) * 0.4;
    let vy = 1.1;
    let frames = 0;
    let still = 0;

    ball.style.left = (x / W) * 100 + '%';
    ball.style.top = (y / H) * 100 + '%';

    const step = () => {
      frames++;
      vy = Math.min(6, vy + 0.32);
      vx *= 0.994;
      vx = Math.max(-2.8, Math.min(2.8, vx));
      const prevY = y;
      x += vx;
      y += vy;

      for (const p of PEGS) {
        const dx = x - p.x;
        const dy = y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 121) {
          const d = Math.sqrt(d2) || 1;
          x = p.x + (dx / d) * 11;
          y = p.y + (dy / d) * 11;
          if (dy < 0) {
            vy = -Math.abs(vy) * 0.35 - 0.08;
          } else {
            vy = Math.abs(vy) * 0.3 + 0.25;
          }
          vx += (dx >= 0 ? 1 : -1) * (0.35 + Math.random() * 0.85);
          vx = Math.max(-3, Math.min(3, vx));
          if (Math.random() < 0.16) sound.tone(620 + Math.random() * 420, 0.02, 'triangle', 0.01);
        }
      }

      if (x < 8) { x = 8; vx = Math.abs(vx) * 0.6; }
      if (x > 352) { x = 352; vx = -Math.abs(vx) * 0.6; }

      if (Math.abs(vy) < 0.45 && y > 80) still++; else still = 0;
      if (still > 30) { vx += (Math.random() - 0.5) * 1.6; vy = 0.9; still = 0; }
      if (y > 320 && vy < 1.6) vy = 1.6 + Math.random() * 0.4;

      ball.style.left = (x / W) * 100 + '%';
      ball.style.top = (y / H) * 100 + '%';

      if (y > 468 && y >= prevY) {
        ball.style.top = (488 / H) * 100 + '%';
        resolve(slotOf(x));
        return;
      }
      if (frames > 420) { resolve(slotOf(x)); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function drop() {
  if (busy || state.locked) return;
  const cost = chip * ballCount;
  if (state.cash < cost) { toast('籌碼不足。', 'warn'); return; }
  if (!spendCash(cost)) return;

  busy = true;
  highlightSlot(-1);
  els.badge.classList.remove('show');
  resetBall();
  syncControls();
  setStatus(ballCount > 1 ? `${ballCount} 顆鋼珠依序落下……` : '鋼珠落下了……');
  sound.tone(880, 0.05, 'triangle', 0.03, 400);

  const list = mults();
  const jobs = [];
  for (let i = 0; i < ballCount; i++) {
    if (i > 0) await sleep(150);
    const ball = makeBall();
    const jitter = ballCount > 1 ? (Math.random() - 0.5) * 30 : 0;
    jobs.push(runBall(ball, ballLeft() + jitter).then(idx => {
      setTimeout(() => { ball.style.opacity = '0'; }, 360);
      setTimeout(() => ball.remove(), 1100);
      return idx;
    }));
  }
  const idxs = await Promise.all(jobs);

  const totalPay = idxs.reduce((sum, i) => sum + Math.round(chip * list[i]), 0);
  const profit = totalPay - cost;
  if (totalPay > 0) addCash(totalPay, { silent: true });

  let best = 0;
  for (let i = 1; i < idxs.length; i++) if (list[idxs[i]] > list[idxs[best]]) best = i;
  const bestIdx = idxs[best];
  const bestMult = list[bestIdx];
  lastSlot = bestIdx;

  for (const idx of idxs) {
    history.unshift(list[idx]);
  }
  history = history.slice(0, 8);
  renderHistory();
  highlightSlot(bestIdx);

  if (bestMult >= 64) {
    setBadge(ballCount > 1 ? `${multLabel(bestMult)} 傳說 ×${ballCount}` : `${multLabel(bestMult)} 傳說`, '');
    sound.jackpot();
    sound.win(true);
  } else if (bestMult >= 4) {
    setBadge(ballCount > 1 ? `${multLabel(bestMult)} 大獎 ×${ballCount}` : `${multLabel(bestMult)} 大獎`, '');
    sound.jackpot();
    sound.win(true);
  } else if (bestMult > 0) {
    setBadge(ballCount > 1 ? `${ballCount} 顆 · 最高 ${multLabel(bestMult)}` : multLabel(bestMult), '');
    sound.win(bestMult >= 1);
  } else {
    setBadge('沒進獎格', 'lose');
    sound.lose();
  }

  const resultText = ballCount > 1
    ? `${ballCount} 顆 · 最高 ${multLabel(bestMult)} · 派彩 ${fmt(totalPay)}　${profit >= 0 ? '+' : ''}${fmt(profit)}`
    : `落點 ${bestIdx + 1} 號格 · 賠率 ${multLabel(bestMult)}　${profit >= 0 ? '+' : ''}${fmt(profit)}`;
  setStatus(resultText, profit < 0);
  recordRound(profit, profit);
  refreshHud();
  advanceTime(20);

  await sleep(1300);
  els.badge.classList.remove('show');
  highlightSlot(-1);
  busy = false;
  resetBall();
  syncControls();
  setStatus(resultText, profit < 0);
}

function renderHistory() {
  if (!els.history) return;
  els.history.innerHTML = history.length
    ? history.map(m => `<span class="${m >= 4 ? 'big' : m < 1 ? 'none' : ''}">${multLabel(m)}</span>`).join('')
    : '<span class="none">—</span>';
}

function renderSlots() {
  const list = mults();
  const max = Math.max(...list);
  els.slotsWrap.style.gridTemplateColumns = `repeat(${list.length}, 1fr)`;
  els.slotsWrap.innerHTML = list.map((m, i) => `
    <div class="pk-slot ${m === max ? 'jackpot' : m >= 1 ? 'win' : 'none'}" data-slot="${i}">
      <b>${multLabel(m)}</b>
    </div>`).join('');
  els.slots = Array.from(els.slotsWrap.querySelectorAll('[data-slot]'));
  els.slots.forEach((el, i) => {
    if (list.length >= 11) el.classList.add('dense');
    if (i === lastSlot) el.classList.add('hit');
  });
}

function applyConfig(patch) {
  if (busy) return;
  state.pachinko = { ...cfg(), ...patch };
  save();
  renderSlots();
  syncSettings();
  resetBall();
  lastSlot = -1;
  highlightSlot(-1);
  sound.chip();
  setStatus(`台面已調整：${cfg().slots} 格 · ${multLabel(cfg().minMult)}–${multLabel(cfg().maxMult)}`);
}

function setBallCount(n) {
  if (busy) return;
  ballCount = BALL_OPTIONS.includes(n) ? n : 1;
  state.pachinko = { ...cfg(), balls: ballCount };
  save();
  syncControls();
  setStatus(
    ballCount > 1
      ? `一次投 ${ballCount} 顆，總投注 ${fmt(chip * ballCount)}。`
      : '調整落點，投下鋼珠。倍率越高，格位越靠中央。'
  );
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 學園</button>
      <h2>小鋼珠</h2>
      <span class="sub">自訂格數與倍率 · 最低 0.1× · 最高 512×</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="pk-wrap">
      <div class="felt pk-felt">
        <div class="pk-board" id="pk-board">
          <div class="pk-topbar"></div>
          ${PEGS.map(p => `<i class="peg" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%"></i>`).join('')}
          <div class="pk-ball preview" id="pk-preview"></div>
          <div class="pk-slots" id="pk-slots"></div>
        </div>
        <div class="table-badge" id="pk-badge"></div>
      </div>

      <div class="panel pk-side">
        <h3>落點</h3>
        <input type="range" id="pk-aim" min="0" max="100" step="1" value="50">
        <div class="pk-aim-labels"><span>左</span><span>中</span><span>右</span></div>

        <h3>台面設定</h3>
        <div class="pk-cfg">
          <div class="pk-cfg-row">
            <span>格子數</span>
            <div class="pk-opts">
              ${SLOT_OPTIONS.map(v => `<button class="pk-opt" data-slots="${v}">${v}</button>`).join('')}
            </div>
          </div>
          <div class="pk-cfg-row">
            <span>最高倍率</span>
            <div class="pk-opts">
              ${MAX_OPTIONS.map(v => `<button class="pk-opt" data-max="${v}">×${v}</button>`).join('')}
            </div>
          </div>
          <div class="pk-cfg-row">
            <span>最低倍率</span>
            <div class="pk-opts">
              ${MIN_OPTIONS.map(v => `<button class="pk-opt" data-min="${v}">×${v}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="pk-stats">
          <div><span>目前台面</span><b id="pk-cfg-slots">9 格</b></div>
          <div><span>倍率範圍</span><b><i id="pk-cfg-min">×0.1</i> – <i id="pk-cfg-max">×4</i></b></div>
          <div><span>平均賠率</span><b id="pk-rtp">—</b></div>
          <div><span>鋼珠數</span><b id="pk-balls-note">1 顆</b></div>
          <div><span>投注</span><b id="pk-bet">NT$ 0</b></div>
          <div><span>最近結果</span><div class="pk-history" id="pk-history"></div></div>
        </div>
        <div class="pk-note" id="pk-rtp-note"></div>
      </div>
    </div>

    <div class="control-panel">
      <div class="control-group">
        <span class="control-label">投注</span>
        <div class="bet-range-host" id="pk-range"></div>
        <div class="chip-row">
          ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>籌碼</small></button>`).join('')}
        </div>
      </div>
      <div class="control-group">
        <span class="control-label">投珠數</span>
        <div class="pk-ball-opts">
          ${BALL_OPTIONS.map(v => `<button class="pk-opt" data-balls="${v}">${v} 顆</button>`).join('')}
        </div>
      </div>
      <div class="control-group">
        <button class="btn gold" id="pk-drop">投珠</button>
      </div>
      <div class="status-line" id="pk-status"></div>
    </div>
  `;

  els = {
    board: el.querySelector('#pk-board'),
    preview: el.querySelector('#pk-preview'),
    slotsWrap: el.querySelector('#pk-slots'),
    slots: [],
    aim: el.querySelector('#pk-aim'),
    bet: el.querySelector('#pk-bet'),
    ballNote: el.querySelector('#pk-balls-note'),
    history: el.querySelector('#pk-history'),
    badge: el.querySelector('#pk-badge'),
    status: el.querySelector('#pk-status'),
    drop: el.querySelector('#pk-drop'),
    chips: Array.from(el.querySelectorAll('[data-chip]')),
    slotBtns: Array.from(el.querySelectorAll('[data-slots]')),
    maxBtns: Array.from(el.querySelectorAll('[data-max]')),
    minBtns: Array.from(el.querySelectorAll('[data-min]')),
    ballBtns: Array.from(el.querySelectorAll('[data-balls]')),
    cfgSlots: el.querySelector('#pk-cfg-slots'),
    cfgMax: el.querySelector('#pk-cfg-max'),
    cfgMin: el.querySelector('#pk-cfg-min'),
    rtp: el.querySelector('#pk-rtp'),
    rtpNote: el.querySelector('#pk-rtp-note')
  };

  els.range = mountBetRange(el.querySelector('#pk-range'), {
    label: '每顆投注',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / Math.max(1, ballCount) / 10000) * 10000),
    value: chip,
    onChange: v => {
      if (busy) return;
      chip = v;
      const cost = chip * ballCount;
      if (els.bet) els.bet.textContent = fmt(cost);
      els.drop.disabled = state.cash < cost || state.locked;
      els.chips.forEach(c => c.classList.toggle('active', Number(c.dataset.chip) === chip));
    }
  });

  ballCount = cfg().balls;

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('pachinko');
  els.chips.forEach(c => {
    c.onclick = () => {
      if (busy) return;
      chip = Number(c.dataset.chip);
      sound.chip();
      syncControls();
    };
  });
  els.slotBtns.forEach(b => { b.onclick = () => applyConfig({ slots: Number(b.dataset.slots) }); });
  els.maxBtns.forEach(b => { b.onclick = () => applyConfig({ maxMult: Number(b.dataset.max) }); });
  els.minBtns.forEach(b => {
    b.onclick = () => {
      const minMult = Number(b.dataset.min);
      const maxMult = Math.max(cfg().maxMult, minMult);
      applyConfig({ minMult, maxMult });
    };
  });
  els.aim.oninput = () => {
    if (busy) return;
    aim = Number(els.aim.value);
    resetBall();
  };
  els.ballBtns.forEach(b => {
    b.onclick = () => {
      sound.click();
      setBallCount(Number(b.dataset.balls));
    };
  });
  els.drop.onclick = () => { sound.click(); drop(); };

  renderSlots();
  resetBall();
  renderHistory();
  syncControls();
}

export function enterPachinko() {
  render();
  ballCount = cfg().balls;
  renderSlots();
  resetBall();
  syncControls();
}

export function leavePachinko() { }

export function canLeavePachinko() {
  if (busy) { toast('等鋼珠落定。', 'warn'); return false; }
  return true;
}
