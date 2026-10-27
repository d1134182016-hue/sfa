import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, clamp, mountBetRange
} from '../core.js';
import { getChallenge, challengeActive, challengeResult, onChallengeAbort } from '../challenge.js';
import {
  tileOptions, setPending, drawWithCheat, mountCheatDock
} from '../cheat.js';

const root = () => document.getElementById('view-mahjong');
const CHIPS = [10000, 50000, 200000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;
const SUITS = ['萬', '筒', '條'];
const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONORS = ['東', '南', '西', '北', '中', '發', '白'];

let bet = 100000;
let phase = 'bet';       // bet | discard | claim | over
let busy = false;
let roundBet = 0;
let wall = [];
let hand = [];
let aiHand = [];
let melds = [];
let pDiscards = [];
let aDiscards = [];
let aiName = '芽亞里';
let challenge = null;

let selected = -1;
let drawnTile = -1;
let drawnIdx = -1;
let lastDiscard = -1;
let claimWinable = false;
let claimPongable = false;
let drag = null;
let els = {};
let handSeq = 0;

function tileName(t) {
  if (t < 27) return NUM_CN[t % 9] + SUITS[Math.floor(t / 9)];
  return HONORS[t - 27];
}

function tileKind(t) {
  if (t < 27) return ['wan', 'tong', 'tiao'][Math.floor(t / 9)];
  return 'honor';
}

const FACE_RED = '#b42a3a';
const FACE_BLUE = '#2f6f9f';
const FACE_GREEN = '#2f7a55';
const FACE_INK = '#22303f';
const FACE_GOLD = '#b58a3a';

const PIP_LAYOUT = {
  2: [[22, 17], [22, 43]],
  3: [[13, 15], [22, 30], [31, 45]],
  4: [[14, 17], [30, 17], [14, 43], [30, 43]],
  5: [[14, 16], [30, 16], [22, 30], [14, 44], [30, 44]],
  6: [[14, 14], [30, 14], [14, 30], [30, 30], [14, 46], [30, 46]],
  7: [[12, 12], [22, 12], [32, 12], [14, 30], [30, 30], [14, 46], [30, 46]],
  8: [[14, 11], [30, 11], [14, 23], [30, 23], [14, 37], [30, 37], [14, 49], [30, 49]],
  9: [[13, 13], [22, 13], [31, 13], [13, 30], [22, 30], [31, 30], [13, 47], [22, 47], [31, 47]]
};

const STICK_LAYOUT = {
  2: [[15, 30], [29, 30]],
  3: [[10, 30], [22, 30], [34, 30]],
  4: [[14, 21], [30, 21], [14, 41], [30, 41]],
  5: [[14, 18], [30, 18], [22, 30], [14, 44], [30, 44]],
  6: [[14, 14], [30, 14], [14, 30], [30, 30], [14, 46], [30, 46]],
  7: [[12, 12], [22, 12], [32, 12], [14, 30], [30, 30], [14, 46], [30, 46]],
  8: [[14, 11], [30, 11], [14, 23], [30, 23], [14, 37], [30, 37], [14, 49], [30, 49]],
  9: [[13, 13], [22, 13], [31, 13], [13, 30], [22, 30], [31, 30], [13, 47], [22, 47], [31, 47]]
};

function wanFace(n) {
  return `
    <rect x="4" y="4" width="36" height="52" rx="4" fill="none" stroke="${FACE_RED}" stroke-opacity=".28"/>
    <text x="22" y="33" text-anchor="middle" font-size="25" font-family="MingLiU,PMingLiU,serif" fill="${FACE_RED}">${NUM_CN[n - 1]}</text>
    <line x1="11" y1="38" x2="33" y2="38" stroke="${FACE_RED}" stroke-opacity=".35"/>
    <text x="22" y="52" text-anchor="middle" font-size="14" font-family="MingLiU,PMingLiU,serif" fill="${FACE_INK}">萬</text>`;
}

function dotFace(n) {
  if (n === 1) {
    return `<circle cx="22" cy="30" r="13" fill="${FACE_BLUE}"/>
      <circle cx="22" cy="30" r="9.5" fill="#fffdf6"/>
      <circle cx="22" cy="30" r="5.6" fill="${FACE_RED}"/>
      <circle cx="22" cy="30" r="2.4" fill="#fffdf6"/>`;
  }
  return (PIP_LAYOUT[n] || PIP_LAYOUT[2]).map(([x, y], i) => {
    const col = i % 3 === 0 ? FACE_RED : FACE_BLUE;
    return `<circle cx="${x}" cy="${y}" r="4.7" fill="${col}"/>
      <circle cx="${x - 1.4}" cy="${y - 1.4}" r="1.3" fill="#ffffff" opacity=".55"/>`;
  }).join('');
}

function birdFace() {
  return `
    <path d="M27 8c7 1 10 6 8 11-1 3-4 5-8 6l7 9-9-4-3 14-5-14-9 4 7-9c-6-2-8-7-5-12 3-4 10-5 17-5z" fill="${FACE_GREEN}"/>
    <circle cx="28" cy="17" r="1.7" fill="#fffdf6"/>
    <path d="M13 25l-7 3 7 2z" fill="${FACE_RED}"/>
    <path d="M25 32l-1 5 4-3z" fill="${FACE_GOLD}"/>`;
}

function bambooFace(n) {
  return (STICK_LAYOUT[n] || STICK_LAYOUT[2]).map(([x, y], i) => {
    const col = i % 2 ? FACE_BLUE : FACE_GREEN;
    return `<rect x="${x - 3}" y="${y - 8}" width="6" height="16" rx="3" fill="${col}"/>
      <line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}" stroke="#fffdf6" stroke-width="1.2" opacity=".5"/>`;
  }).join('');
}

function honorFace(t) {
  const name = HONORS[t - 27];
  if (name === '白') {
    return `<rect x="11" y="15" width="22" height="30" rx="3" fill="none" stroke="${FACE_BLUE}" stroke-width="2.6"/>
      <rect x="15" y="19" width="14" height="22" rx="2" fill="${FACE_BLUE}" opacity=".12"/>`;
  }
  const col = name === '中' ? FACE_RED : name === '發' ? FACE_GREEN : FACE_BLUE;
  return `<circle cx="22" cy="30" r="17" fill="${col}" opacity=".08"/>
    <text x="22" y="41" text-anchor="middle" font-size="27" font-family="MingLiU,PMingLiU,serif" fill="${col}">${name}</text>`;
}

function tileFace(t) {
  if (t < 9) return wanFace(t + 1);
  if (t < 18) return dotFace(t - 8);
  if (t < 27) return t === 18 ? birdFace() : bambooFace(t - 17);
  return honorFace(t);
}

function tileHTML(t, cls = '') {
  const kind = tileKind(t);
  return `<div class="mj-tile ${kind} ${cls}" data-t="${t}">
    <svg class="mj-art" viewBox="0 0 44 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${tileFace(t)}</svg>
  </div>`;
}

function buildWall() {
  const tiles = [];
  for (let t = 0; t < 34; t++) for (let i = 0; i < 4; i++) tiles.push(t);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function countsOf(tiles) {
  const c = new Array(34).fill(0);
  for (const t of tiles) c[t]++;
  return c;
}

function formSets(counts, start, need) {
  if (need === 0) return counts.every(c => c === 0);
  let i = start;
  while (i < 34 && counts[i] === 0) i++;
  if (i >= 34) return false;
  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (formSets(counts, i, need - 1)) { counts[i] += 3; return true; }
    counts[i] += 3;
  }
  if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--; counts[i + 1]--; counts[i + 2]--;
    if (formSets(counts, i, need - 1)) { counts[i]++; counts[i + 1]++; counts[i + 2]++; return true; }
    counts[i]++; counts[i + 1]++; counts[i + 2]++;
  }
  return false;
}

function isSevenPairs(counts) {
  let pairs = 0;
  for (const c of counts) {
    if (c === 0) continue;
    if (c !== 2) return false;
    pairs++;
  }
  return pairs === 7;
}

function isWin(tiles, meldCount) {
  if (tiles.length !== 14 - meldCount * 3) return false;
  const counts = countsOf(tiles);
  if (meldCount === 0 && isSevenPairs(counts)) return true;
  for (let i = 0; i < 34; i++) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    const ok = formSets(counts, 0, 4 - meldCount);
    counts[i] += 2;
    if (ok) return true;
  }
  return false;
}

function aiChooseDiscard(tiles) {
  const counts = countsOf(tiles);
  let pick = tiles[0];
  let best = Infinity;
  const seen = new Set();
  for (const t of tiles) {
    if (seen.has(t)) continue;
    seen.add(t);
    let score = counts[t] * 12;
    if (t < 27) {
      const suit = Math.floor(t / 9);
      const rank = t % 9;
      for (const d of [-2, -1, 1, 2]) {
        const nr = rank + d;
        if (nr < 0 || nr > 8) continue;
        if (counts[suit * 9 + nr] > 0) score += Math.abs(d) === 1 ? 6 : 2;
      }
      if (rank === 0 || rank === 8) score -= 1;
    }
    if (score < best) { best = score; pick = t; }
  }
  return pick;
}

function sortHand(arr) { arr.sort((a, b) => a - b); }

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

function syncName() {
  if (els.oppName) els.oppName.textContent = aiName;
  if (els.aiDiscards) els.aiDiscards.dataset.tag = `${aiName}棄牌`;
}

function syncChallengeUI(on, member = '') {
  const guest = !!(challenge && challenge.mode === 'guest');
  if (els.betGroup) els.betGroup.classList.toggle('hidden', on);
  if (els.sub) {
    els.sub.textContent = on
      ? (guest ? `vs ${member} · 賭博邀請 · 流局退注` : `挑戰 ${member} · 一局決勝 · 流局算學生會勝`)
      : '對手 早乙女芽亞里 · 碰牌 · 自摸 2 倍 · 七對 +1';
  }
  if (els.start) els.start.classList.toggle('hidden', on);
}

function syncButtons() {
  if (!els.start) return;
  const betting = phase === 'bet' && !challenge;
  els.start.classList.toggle('hidden', !betting);
  els.start.disabled = busy || state.locked || !!challenge;
  els.start.textContent = '開始牌局';
  els.discard.classList.toggle('hidden', phase !== 'discard');
  els.discard.disabled = busy || selected < 0;
  els.win.classList.toggle('hidden', !(claimWinable && (phase === 'claim' || phase === 'discard')));
  els.pong.classList.toggle('hidden', !(claimPongable && phase === 'claim'));
  els.skip.classList.toggle('hidden', phase !== 'claim');
  els.chips.forEach(c => {
    c.disabled = busy || phase !== 'bet' || !!challenge;
    c.classList.toggle('active', Number(c.dataset.chip) === bet);
  });
  if (els.bet) els.bet.textContent = fmt(phase === 'bet' ? bet : roundBet);
  if (els.range) {
    els.range.sync(phase === 'bet' ? bet : roundBet);
    els.range.setDisabled(busy || phase !== 'bet' || !!challenge);
  }
  if (els.hand) els.hand.classList.toggle('live', phase === 'discard' && !busy);
}

function renderHand() {
  if (!els.hand) return;
  els.hand.innerHTML = hand.map((t, i) => {
    let cls = '';
    if (phase === 'discard' && i === selected) cls += 'sel ';
    if (i === drawnIdx && drawnTile >= 0) cls += 'drawn';
    return tileHTML(t, cls.trim());
  }).join('');
}

function renderMelds() {
  if (!els.melds) return;
  els.melds.innerHTML = melds.map(m =>
    `<div class="mj-meld">${m.tiles.map(t => tileHTML(t)).join('')}<span>碰</span></div>`
  ).join('');
}

function renderDiscards() {
  if (els.meDiscards) els.meDiscards.innerHTML = pDiscards.map((t, i) =>
    tileHTML(t, i === pDiscards.length - 1 ? 'last' : '')
  ).join('');
  if (els.aiDiscards) els.aiDiscards.innerHTML = aDiscards.map((t, i) =>
    tileHTML(t, i === aDiscards.length - 1 ? 'last' : '')
  ).join('');
}

function render() {
  if (!els.hand) return;
  renderHand();
  renderMelds();
  renderDiscards();
  if (els.aiHand) els.aiHand.innerHTML = Array.from({ length: aiHand.length }, () => '<i class="mj-back"></i>').join('');
  if (els.wall) els.wall.textContent = wall.length;
  syncButtons();
}

/* ---------------- 流程 ---------------- */

async function startHand() {
  if (busy || state.locked) return;
  if (!challenge) {
    if (bet <= 0) { toast('先押注。', 'warn'); return; }
    if (state.cash < bet) { toast('現金不足。', 'warn'); return; }
    if (!spendCash(bet)) return;
  }

  const rid = ++handSeq;
  busy = true;
  phase = 'over';
  roundBet = challenge ? 0 : bet;
  wall = buildWall();
  hand = [];
  aiHand = [];
  melds = [];
  pDiscards = [];
  aDiscards = [];
  selected = -1;
  drawnTile = -1;
  drawnIdx = -1;
  lastDiscard = -1;
  claimWinable = false;
  claimPongable = false;
  els.badge.classList.remove('show');

  for (let i = 0; i < 13; i++) {
    hand.push(wall.pop());
    aiHand.push(wall.pop());
  }
  sortHand(hand);
  sortHand(aiHand);
  render();
  setStatus('洗牌、發牌……');
  await sleep(600);
  if (rid !== handSeq) return;

  busy = false;
  await playerDraw(rid);
}

async function playerDraw(rid = handSeq) {
  if (rid !== handSeq) return;
  if (wall.length === 0) { drawGame(rid); return; }
  phase = 'over';
  busy = true;
  const t = drawWithCheat('mahjong', wall, 'tile');
  sortHand(hand);
  hand.push(t);
  drawnTile = t;
  drawnIdx = hand.length - 1;
  selected = -1;
  lastDiscard = -1;
  claimWinable = isWin(hand, melds.length);
  claimPongable = false;
  phase = 'discard';
  busy = false;
  render();
  sound.card();
  setStatus(claimWinable
    ? `摸到 ${tileName(t)}。這張可以胡！`
    : `摸到 ${tileName(t)}。拖曳手牌到棄牌區，或點選後按「打出」。`);
}

function selectTile(idx) {
  if (phase !== 'discard' || busy) return;
  selected = selected === idx ? -1 : idx;
  sound.click();
  renderHand();
  syncButtons();
}

function inRect(el, x, y) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function targetTileAt(x, y) {
  if (!els.hand) return null;
  for (const el of els.hand.children) {
    if (inRect(el, x, y)) return el;
  }
  return null;
}

function clearDropMarks() {
  if (els.hand) els.hand.querySelectorAll('.drop-before').forEach(t => t.classList.remove('drop-before'));
  if (els.meDiscards) els.meDiscards.classList.remove('drop-hover');
}

function reorderTile(from, to) {
  if (from === to || from < 0 || to < 0 || from >= hand.length || to >= hand.length) return;
  const [t] = hand.splice(from, 1);
  hand.splice(to, 0, t);
  if (drawnIdx === from) drawnIdx = to;
  else if (from < drawnIdx && to >= drawnIdx) drawnIdx--;
  else if (from > drawnIdx && to <= drawnIdx) drawnIdx++;
  selected = -1;
  render();
  sound.click();
  setStatus('手牌順序已調整。');
}

function onPointerMove(e) {
  if (!drag) return;
  if (drag.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    const rect = drag.tileEl.getBoundingClientRect();
    const ghost = drag.tileEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.classList.remove('sel', 'drawn');
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.offX = drag.startX - rect.left;
    drag.offY = drag.startY - rect.top;
    drag.tileEl.classList.add('dragging');
    els.hand.classList.add('drop-active');
    sound.click();
  }
  if (drag.ghost) {
    drag.ghost.style.left = (e.clientX - drag.offX) + 'px';
    drag.ghost.style.top = (e.clientY - drag.offY) + 'px';
  }
  clearDropMarks();
  if (inRect(els.meDiscards, e.clientX, e.clientY)) {
    els.meDiscards.classList.add('drop-hover');
  } else {
    const target = targetTileAt(e.clientX, e.clientY);
    if (target && target !== drag.tileEl) target.classList.add('drop-before');
  }
}

function onPointerUp(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  if (d.ghost) d.ghost.remove();
  if (d.tileEl) d.tileEl.classList.remove('dragging');
  if (els.hand) els.hand.classList.remove('drop-active');
  const onDiscard = inRect(els.meDiscards, e.clientX, e.clientY);
  const target = d.moved ? targetTileAt(e.clientX, e.clientY) : null;
  clearDropMarks();

  if (!d.moved) {
    if (phase === 'discard' && !busy) selectTile(d.idx);
    return;
  }
  if (onDiscard) { discardIndex(d.idx); return; }
  if (target && target !== d.tileEl) {
    const to = Array.from(els.hand.children).indexOf(target);
    reorderTile(d.idx, to);
  }
}

function onPointerDown(e) {
  if (phase !== 'discard' || busy) return;
  if (e.button !== undefined && e.button !== 0) return;
  if (!e.isPrimary) return;
  const tileEl = e.target.closest('.mj-tile');
  if (!tileEl || !els.hand || !els.hand.contains(tileEl)) return;
  const idx = Array.from(els.hand.children).indexOf(tileEl);
  if (idx < 0) return;
  drag = {
    idx, tileEl,
    startX: e.clientX, startY: e.clientY,
    moved: false, ghost: null,
    pointerId: e.pointerId
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  e.preventDefault();
}

async function discardIndex(idx) {
  if (phase !== 'discard' || busy) return;
  if (idx < 0 || idx >= hand.length) return;
  const rid = handSeq;
  const t = hand[idx];
  hand.splice(idx, 1);
  pDiscards.push(t);
  selected = -1;
  drawnTile = -1;
  drawnIdx = -1;
  lastDiscard = -1;
  claimWinable = false;
  syncButtons();
  render();
  sound.card();
  setStatus(`你打出 ${tileName(t)}。`);

  if (isWin([...aiHand, t], 0)) {
    await sleep(520);
    if (rid !== handSeq) return;
    aiWins(false, rid);
    return;
  }
  await aiTurn(rid);
}

async function discardSelected() {
  if (phase !== 'discard' || busy || selected < 0) return;
  await discardIndex(selected);
}

async function aiTurn(rid = handSeq) {
  if (rid !== handSeq) return;
  if (phase === 'bet') return;
  busy = true;
  phase = 'over';
  syncButtons();
  setStatus(`${aiName}摸牌……`);
  await sleep(520);
  if (rid !== handSeq) return;

  if (wall.length === 0) { drawGame(rid); return; }
  const t = wall.pop();
  aiHand.push(t);
  sortHand(aiHand);
  render();
  await sleep(300);
  if (rid !== handSeq) return;

  if (isWin(aiHand, 0)) { aiWins(true, rid); return; }

  const d = aiChooseDiscard(aiHand);
  aiHand.splice(aiHand.indexOf(d), 1);
  aDiscards.push(d);
  lastDiscard = d;
  render();
  sound.card();
  setStatus(`${aiName}打出 ${tileName(d)}……`);
  await sleep(420);
  if (rid !== handSeq) return;

  claimWinable = isWin([...hand, d], melds.length);
  claimPongable = countsOf(hand)[d] >= 2;
  busy = false;

  if (claimWinable || claimPongable) {
    phase = 'claim';
    render();
    setStatus(`${aiName}打出 ${tileName(d)}。${claimWinable ? '可以胡！' : '你手上有兩張，可以碰。'}`);
    if (claimWinable) sound.tone(920, 0.12, 'triangle', 0.04);
    return;
  }
  await playerDraw(rid);
}

async function claim(kind) {
  if (kind === 'win' && phase === 'discard' && claimWinable) {
    claimWinable = false;
    claimPongable = false;
    await settlePlayerWin(true, handSeq);
    return;
  }
  if (phase !== 'claim' || busy) return;
  const rid = handSeq;
  const t = lastDiscard;
  if (t < 0) return;

  if (kind === 'win') {
    if (!claimWinable) return;
    hand.push(t);
    sortHand(hand);
    drawnTile = -1;
    drawnIdx = -1;
    if (aDiscards[aDiscards.length - 1] === t) aDiscards.pop();
    claimWinable = false;
    claimPongable = false;
    render();
    await settlePlayerWin(false, rid);
    return;
  }

  if (kind === 'pong') {
    if (!claimPongable) return;
    const removed = [];
    for (let i = hand.length - 1; i >= 0 && removed.length < 2; i--) {
      if (hand[i] === t) { removed.push(hand.splice(i, 1)[0]); }
    }
    melds.push({ tiles: [t, t, t] });
    if (aDiscards[aDiscards.length - 1] === t) aDiscards.pop();
    claimWinable = false;
    claimPongable = false;
    selected = -1;
    drawnTile = -1;
    drawnIdx = -1;
    phase = 'discard';
    lastDiscard = -1;
    render();
    sound.chip();
    setStatus(`碰 ${tileName(t)}！請打出一張牌。`);
    return;
  }

  claimWinable = false;
  claimPongable = false;
  lastDiscard = -1;
  await playerDraw(rid);
}

async function settlePlayerWin(selfDraw, rid = handSeq) {
  if (rid !== handSeq) return;
  phase = 'over';
  busy = true;
  syncButtons();
  const seven = melds.length === 0 && isSevenPairs(countsOf(hand));
  const mult = (selfDraw ? 2 : 1) + (seven ? 1 : 0);
  const payout = roundBet * mult;
  if (!challenge) addCash(roundBet + payout, { silent: true });
  setBadge(selfDraw ? '自摸' : '胡了', '');
  const guest = !!(challenge && challenge.mode === 'guest');
  setStatus(challenge
    ? `${selfDraw ? '自摸' : '胡'}${seven ? ' · 七對' : ''}　${guest ? '賭局勝利' : '挑戰勝利'}`
    : `${selfDraw ? '自摸' : '胡'}${seven ? ' · 七對' : ''}，${mult} 倍　+${fmt(payout)}`);
  els.stage.textContent = selfDraw ? 'SELF DRAW' : 'WIN';
  sound.win(mult >= 2);
  if (seven) sound.jackpot();
  render();

  if (!challenge) {
    recordRound(payout, payout);
    refreshHud();
    advanceTime(90);
  }

  await sleep(challenge ? 1700 : 2200);
  if (rid !== handSeq) return;
  if (challenge) { finishMahjongChallenge(true); return; }
  endHand();
}

async function aiWins(selfDraw, rid = handSeq) {
  if (rid !== handSeq) return;
  phase = 'over';
  busy = true;
  syncButtons();
  const mult = selfDraw ? 2 : 1;
  const loss = roundBet * mult;
  if (!challenge) {
    const extra = Math.min(loss - roundBet, Math.max(0, state.cash));
    if (extra > 0) spendCash(extra);
  }
  const profit = -loss;
  setBadge(`${aiName} ${selfDraw ? '自摸' : '胡了'}`, 'lose');
  const guest = !!(challenge && challenge.mode === 'guest');
  setStatus(challenge
    ? `${aiName}${selfDraw ? '自摸' : '胡牌'}　${guest ? '賭局失敗' : '挑戰失敗'}`
    : `${aiName}${selfDraw ? '自摸' : '胡牌'}，${mult} 倍　${fmt(profit)}`, true);
  els.stage.textContent = 'LOSE';
  sound.lose();
  render();

  if (!challenge) {
    recordRound(profit, profit);
    refreshHud();
    advanceTime(90);
  }

  await sleep(challenge ? 1700 : 2200);
  if (rid !== handSeq) return;
  if (challenge) { finishMahjongChallenge(false); return; }
  endHand();
}

async function drawGame(rid = handSeq) {
  if (rid !== handSeq) return;
  phase = 'over';
  busy = true;
  syncButtons();
  const guest = !!(challenge && challenge.mode === 'guest');
  if (!challenge) addCash(roundBet, { silent: true });
  setBadge(challenge ? (guest ? '流局 · 退注' : '流局 · 學生會勝') : '流局', challenge ? (guest ? 'push' : 'lose') : 'push');
  setStatus(challenge
    ? (guest ? '牌山摸完了。流局，注碼退還。' : '牌山摸完了。流局視同學生會勝。')
    : '牌山摸完了，退回本局注碼。');
  els.stage.textContent = 'DRAW';
  if (challenge) { if (guest) sound.push(); else sound.lose(); } else sound.push();
  render();

  if (!challenge) {
    recordRound(0, 0);
    refreshHud();
    advanceTime(90);
  }

  await sleep(challenge ? 1500 : 1800);
  if (rid !== handSeq) return;
  if (challenge) { finishMahjongChallenge(false, guest ? { draw: true } : {}); return; }
  endHand();
}

function finishMahjongChallenge(win, detail = {}) {
  handSeq += 1;
  phase = 'bet';
  busy = false;
  challenge = null;
  challengeResult(win ? 'win' : 'lose', detail);
}

function setupChallenge(ch) {
  handSeq += 1;
  const rid = handSeq;
  challenge = ch;
  onChallengeAbort(() => {
    handSeq += 1;
    challenge = null;
    busy = false;
    phase = 'bet';
  });
  aiName = ch.member;
  bet = 0;
  roundBet = 0;
  phase = 'bet';
  busy = false;
  hand = [];
  aiHand = [];
  melds = [];
  pDiscards = [];
  aDiscards = [];
  wall = [];
  selected = -1;
  drawnTile = -1;
  drawnIdx = -1;
  lastDiscard = -1;
  claimWinable = false;
  claimPongable = false;
  if (els.badge) els.badge.classList.remove('show');
  syncChallengeUI(true, ch.member);
  syncName();
  render();
  setStatus('挑戰開始，洗牌……');
  syncButtons();
  setTimeout(() => {
    if (challenge && rid === handSeq) startHand();
  }, 650);
}

function endHand() {
  els.badge.classList.remove('show');
  phase = 'bet';
  busy = false;
  selected = -1;
  drawnTile = -1;
  drawnIdx = -1;
  claimWinable = false;
  claimPongable = false;
  els.stage.textContent = '你的回合';
  bet = clamp(bet, 10000, Math.max(10000, state.cash));
  render();
  setStatus('押注，然後開始牌局。');
}

/* ---------------- 介面 ---------------- */

function renderView() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 學園</button>
      <h2>二人麻將</h2>
      <span class="sub" id="mj-sub">對手 早乙女芽亞里 · 碰牌 · 自摸 2 倍 · 七對 +1</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="table-wrap">
      <div class="felt mj-felt">
        <div class="mj-top">
          <div class="mj-opp">
            <span class="mj-name" id="mj-name">早乙女芽亞里</span>
            <div class="mj-ai-hand" id="mj-ai-hand"></div>
          </div>
          <div class="mj-wall">牌山 <b id="mj-wall">0</b></div>
        </div>

        <div class="mj-center">
          <div class="mj-discards" id="mj-ai-discards" data-tag="芽亞里棄牌"></div>
          <div class="mj-stage" id="mj-stage">你的回合</div>
          <div class="mj-discards" id="mj-me-discards" data-tag="你的棄牌"></div>
        </div>

        <div class="mj-melds" id="mj-melds"></div>
        <div class="mj-drag-hint">拖曳手牌到棄牌區即可打出 · 拖到別張牌上可調整順序</div>
        <div class="mj-hand" id="mj-hand"></div>

        <div class="table-badge" id="mj-badge"></div>
      </div>

      <div class="control-panel">
        <div class="control-group" id="mj-bet-group">
          <span class="control-label">底注</span>
          <div class="bet-range-host" id="mj-range"></div>
          <div class="chip-row">
            ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>底注</small></button>`).join('')}
          </div>
          <span class="mj-bet">本局 <b id="mj-bet">NT$ 0</b></span>
        </div>
        <div class="control-group">
          <button class="btn gold" id="mj-start">開始牌局</button>
          <button class="btn hidden" id="mj-discard">打出</button>
          <button class="btn gold hidden" id="mj-win">胡</button>
          <button class="btn hidden" id="mj-pong">碰</button>
          <button class="btn ghost hidden" id="mj-skip">跳過</button>
        </div>
        <div class="status-line" id="mj-status"></div>
      </div>
    </div>
  `;

  els = {
    aiHand: el.querySelector('#mj-ai-hand'),
    wall: el.querySelector('#mj-wall'),
    stage: el.querySelector('#mj-stage'),
    aiDiscards: el.querySelector('#mj-ai-discards'),
    meDiscards: el.querySelector('#mj-me-discards'),
    melds: el.querySelector('#mj-melds'),
    hand: el.querySelector('#mj-hand'),
    badge: el.querySelector('#mj-badge'),
    bet: el.querySelector('#mj-bet'),
    sub: el.querySelector('#mj-sub'),
    oppName: el.querySelector('#mj-name'),
    betGroup: el.querySelector('#mj-bet-group'),
    status: el.querySelector('#mj-status'),
    start: el.querySelector('#mj-start'),
    discard: el.querySelector('#mj-discard'),
    win: el.querySelector('#mj-win'),
    pong: el.querySelector('#mj-pong'),
    skip: el.querySelector('#mj-skip'),
    chips: Array.from(el.querySelectorAll('[data-chip]'))
  };

  els.range = mountBetRange(el.querySelector('#mj-range'), {
    label: '底注金額',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: bet,
    onChange: v => {
      if (busy || phase !== 'bet' || challenge) return;
      bet = v;
      render();
    }
  });

  mountCheatDock(el, {
    game: 'mahjong',
    label: '二人麻將',
    stake: () => (challenge ? (challenge.wager || 0) : (roundBet || bet)),
    options: tileOptions(),
    onPick: opt => setPending('mahjong', 'tile', opt.id)
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('mahjong');
  els.start.onclick = () => { sound.click(); startHand(); };
  els.discard.onclick = () => { sound.click(); discardSelected(); };
  els.win.onclick = () => { sound.click(); claim('win'); };
  els.pong.onclick = () => { sound.click(); claim('pong'); };
  els.skip.onclick = () => { sound.click(); claim('skip'); };
  els.chips.forEach(c => {
    c.onclick = () => {
      if (busy || phase !== 'bet') return;
      bet = Number(c.dataset.chip);
      sound.chip();
      render();
    };
  });
  els.hand.addEventListener('pointerdown', onPointerDown);

  render();
  setStatus('押注，然後開始牌局。');
}

export function enterMahjong() {
  renderView();
  const ch = getChallenge();
  if (ch && ch.game === 'mahjong') {
    setupChallenge(ch);
    return;
  }
  const wasChallenge = !!challenge || !!(els.betGroup && els.betGroup.classList.contains('hidden'));
  handSeq += 1;
  challenge = null;
  aiName = '芽亞里';
  syncChallengeUI(false);
  syncName();
  if (wasChallenge) {
    bet = 100000;
    roundBet = 0;
    phase = 'bet';
    busy = false;
    hand = [];
    aiHand = [];
    melds = [];
    pDiscards = [];
    aDiscards = [];
    wall = [];
    selected = -1;
    drawnTile = -1;
    drawnIdx = -1;
    lastDiscard = -1;
    claimWinable = false;
    claimPongable = false;
    if (els.badge) els.badge.classList.remove('show');
  }
  render();
  syncButtons();
  if (wasChallenge) setStatus('押注，然後開始牌局。');
}

export function leaveMahjong() { }

export function canLeaveMahjong() {
  if (challengeActive()) {
    toast('挑戰進行中，請先完成或棄權。', 'warn');
    return false;
  }
  if (busy || phase !== 'bet') {
    toast('先把這一局打完。', 'warn');
    return false;
  }
  return true;
}
