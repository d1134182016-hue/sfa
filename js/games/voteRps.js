import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, mountBetRange, save, esc
} from '../core.js';
import { STUDENTS } from '../cast.js';
import {
  getChallenge, challengeResult, challengeActive, onChallengeAbort
} from '../challenge.js';
import { mountCheatDock } from '../cheat.js';

const root = () => document.getElementById('view-votingscissors');

const HANDS = ['rock', 'paper', 'scissors'];
const HAND_NAMES = { rock: '石頭', paper: '布', scissors: '剪刀' };
const HAND_ICONS = { rock: '✊', paper: '✋', scissors: '✌' };
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const VOTES_PER_HAND = 10;

const STYLE_HINT = {
  cold: '冷靜，出手平均',
  hot: '偏愛石頭',
  grinder: '偏愛布',
  bluffer: '偏愛剪刀',
  lucky: '完全靠運氣',
  observe: '會讀你的習慣',
  greedy: '偏愛布',
  timid: '偏愛剪刀'
};

let ante = 10000;
let foe = null;
let yourHand = [];
let foeHand = [];
let yourUsed = [];
let foeUsed = [];
let round = 0;
let phase = 'idle';       // idle | playing | over
let busy = false;
let stageText = '';
let history = [];
let lastRound = null;
let cheatNext = null;
let challenge = null;
let settling = false;
let els = {};
let dock = null;

/* ---------------- 對手 ---------------- */

function rollFoe() {
  const pool = STUDENTS.filter(c => c.faction === '一般學生');
  const list = pool.length ? pool : STUDENTS;
  const c = list[Math.floor(Math.random() * list.length)];
  return { name: c.name, title: c.title, init: c.init, cls: c.cls, style: c.style };
}

function foeFromChallenge(ch) {
  const c = STUDENTS.find(s => s.name === ch.member);
  if (c) return { name: c.name, title: c.title, init: c.init, cls: c.cls, style: c.style };
  return { name: ch.member || '對手', title: ch.title || '賭徒', init: '賭', cls: '', style: '' };
}

function hintOf(f) {
  return STYLE_HINT[f.style] || '看不出明顯習慣';
}

/* ---------------- 發牌 ---------------- */

function buildVoteBox() {
  const pool = [];
  for (const h of HANDS) {
    for (let i = 0; i < VOTES_PER_HAND; i++) pool.push(h);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function dealHands() {
  const box = buildVoteBox();
  yourHand = box.slice(0, 3);
  foeHand = box.slice(3, 6);
  yourUsed = [false, false, false];
  foeUsed = [false, false, false];
  round = 0;
  lastRound = null;
}

/* ---------------- 介面 ---------------- */

function setStatus(text, warn = false) {
  if (!els.status) return;
  els.status.textContent = text || '';
  els.status.className = 'status-line' + (warn ? ' warn' : '');
}

function setStage(text) {
  stageText = text;
  if (els.stage) els.stage.textContent = text;
}

function setBadge(text, kind = '') {
  if (!els.badge) return;
  els.badge.textContent = text;
  els.badge.className = 'table-badge' + (kind ? ' ' + kind : '');
  els.badge.classList.add('show');
}

function clearBadge() {
  if (els.badge) els.badge.classList.remove('show');
}

function syncControls() {
  if (!els.start) return;
  const inChallenge = !!challenge;
  const playing = phase === 'playing';
  const affordable = inChallenge || state.cash >= ante;
  els.start.disabled = busy || state.locked || playing || !affordable;
  els.start.textContent = phase === 'over' ? '再來一局' : inChallenge ? '開始牌局' : '坐上賭桌';
  els.start.classList.toggle('hidden', inChallenge && (playing || settling));
  els.betGroup.classList.toggle('hidden', inChallenge || settling);
  if (els.range) {
    els.range.sync(ante);
    els.range.setDisabled(busy || playing);
  }
  if (els.ante) els.ante.textContent = fmt(inChallenge ? (challenge.wager || 0) : ante);
  if (els.round) els.round.textContent = playing ? `${Math.min(round + 1, 3)}／3` : '—';
  if (els.foeCards) {
    els.foeCards.querySelectorAll('[data-foe-card]').forEach(el => {
      el.disabled = true;
    });
  }
  if (els.myCards) {
    els.myCards.querySelectorAll('[data-card]').forEach(el => {
      el.disabled = busy || !playing;
    });
  }
  if (!playing && !busy) {
    if (!affordable) setStatus(`籌碼不足（需要 ${fmt(ante)}），降低注碼或去債務中心。`, true);
    else if (phase === 'idle') setStatus('決定注碼，然後坐上賭桌。');
    else if (phase === 'over') setStatus('這一局結束了。再來一局，或換個注碼。');
  }
  if (dock) dock.refresh();
}

function cardHTML(hand, used, opts = {}) {
  const { foeSide = false, index = 0, playable = false } = opts;
  if (!hand) {
    return `<div class="vr-card back" data-foe-card="${index}"><span>?</span></div>`;
  }
  const cls = ['vr-card', used ? 'used' : '', foeSide ? 'foe' : '', playable ? 'playable' : ''].filter(Boolean).join(' ');
  if (foeSide) {
    return `<div class="${cls}" data-foe-card="${index}"><b>${HAND_ICONS[hand]}</b><span>${HAND_NAMES[hand]}</span></div>`;
  }
  return `<button type="button" class="${cls}" data-card="${index}" ${playable ? '' : 'disabled'}>
      <b>${HAND_ICONS[hand]}</b><span>${HAND_NAMES[hand]}</span>
    </button>`;
}

function renderCards() {
  if (!els.myCards || !els.foeCards) return;
  const playing = phase === 'playing';
  els.foeCards.innerHTML = foeHand.map((h, i) => {
    const shown = foeUsed[i];
    return cardHTML(shown ? h : null, shown, { foeSide: true, index: i });
  }).join('');
  els.myCards.innerHTML = yourHand.map((h, i) => cardHTML(h, yourUsed[i], {
    index: i,
    playable: playing && !busy && !yourUsed[i]
  })).join('');
  els.myCards.querySelectorAll('[data-card]').forEach(el => {
    el.onclick = () => { sound.click(); playCard(Number(el.dataset.card)); };
  });
}

function renderHistory() {
  if (!els.history) return;
  els.history.innerHTML = history.length
    ? history.slice(0, 8).map(h => {
      const icon = h.result === 'win' ? '勝' : h.result === 'lose' ? '敗' : '平';
      return `<span class="${h.result}">${icon} · ${h.rounds} 回合</span>`;
    }).join('')
    : '<span class="none">—</span>';
}

function renderFoe() {
  if (!els.foeName) return;
  els.foeName.textContent = foe ? foe.name : '對手';
  els.foeTitle.textContent = foe ? foe.title : '';
  els.foeAvatar.textContent = foe ? foe.init : '敵';
  els.foeAvatar.className = 'story-avatar ' + (foe ? foe.cls : '');
  els.foeHint.textContent = foe ? hintOf(foe) : '';
}

/* ---------------- 流程 ---------------- */

function startGame() {
  if (busy || state.locked || phase === 'playing') return;
  const inChallenge = !!challenge;
  if (!inChallenge) {
    if (ante <= 0) { toast('先設定注碼。', 'warn'); return; }
    if (state.cash < ante) { toast('籌碼不足。', 'warn'); return; }
    if (!spendCash(ante)) { toast('籌碼不足。', 'warn'); return; }
  }
  dealHands();
  phase = 'playing';
  busy = false;
  settling = false;
  clearBadge();
  setStage('三張手牌發好了。選一張打出去。');
  setStatus(inChallenge ? `與 ${challenge.member} 的賭局開始。` : `注碼 ${fmt(ante)}，抽牌……`);
  renderCards();
  syncControls();
  refreshHud();
  save();
}

function playCard(i) {
  if (busy || phase !== 'playing') return;
  if (i < 0 || i >= yourHand.length || yourUsed[i]) return;
  busy = true;
  if (cheatNext) {
    yourHand[i] = cheatNext;
    cheatNext = null;
    sound.chip();
  }
  yourUsed[i] = true;
  renderCards();
  syncControls();
  const foeIdx = foeHand.findIndex((_, k) => !foeUsed[k]);
  resolveRound(yourHand[i], i, foeIdx);
}

async function resolveRound(myHand, myIdx, foeIdx) {
  setStage(`你打出 ${HAND_ICONS[myHand]} ${HAND_NAMES[myHand]}。對手正在蓋牌……`);
  setStatus('開牌……');
  await sleep(480);
  if (phase !== 'playing') return;
  foeUsed[foeIdx] = true;
  const theirHand = foeHand[foeIdx];
  renderCards();
  sound.flip();
  await sleep(520);

  round += 1;
  const same = myHand === theirHand;
  const youWin = !same && BEATS[myHand] === theirHand;
  lastRound = { round, myHand, theirHand, same, youWin };

  if (same) {
    setBadge('平手 · 兩張牌都收起', 'push');
    setStage(`兩邊都是 ${HAND_ICONS[myHand]} ${HAND_NAMES[myHand]}。這一回合不算，換下一張。`);
    setStatus('平手，繼續下一回合。');
    sound.push();
  } else if (youWin) {
    setBadge('這一局你贏了', '');
    setStage(`${HAND_ICONS[myHand]} 勝過 ${HAND_ICONS[theirHand]}。${foe ? foe.name : '對手'}的手停在半空。`);
    setStatus('決勝回合：你贏了。');
    sound.win(false);
  } else {
    setBadge('這一局你輸了', 'lose');
    setStage(`${HAND_ICONS[theirHand]} 勝過 ${HAND_ICONS[myHand]}。${foe ? foe.name : '對手'}把牌收了回去。`);
    setStatus('決勝回合：你輸了。', true);
    sound.lose();
  }
  if (els.round) els.round.textContent = `${Math.min(round, 3)}／3`;

  await sleep(1500);
  if (same) {
    if (round >= 3) {
      await handleAllDraw();
      return;
    }
    busy = false;
    setStage('手牌還沒用完。選下一張。');
    setStatus('繼續下一回合。');
    clearBadge();
    renderCards();
    syncControls();
    return;
  }
  settle(youWin);
}

async function handleAllDraw() {
  setBadge('三回合全平手 · 重新發牌', 'push');
  setStage('三張牌都是平手。注碼留在桌上，重新抽三張。');
  setStatus('全部平手，重新開局。');
  history.unshift({ result: 'draw', rounds: 3 });
  history = history.slice(0, 12);
  renderHistory();
  recordRound(0, 0);
  advanceTime(10);
  save();
  await sleep(1900);
  if (phase !== 'playing') return;
  dealHands();
  busy = false;
  clearBadge();
  setStage(challenge
    ? '重新抽牌。這次會分出勝負。'
    : `注碼 ${fmt(ante)} 還在桌上。重新抽牌。`);
  setStatus('重新開局。');
  renderCards();
  syncControls();
  refreshHud();
}

function settle(win) {
  phase = 'over';
  busy = false;
  const roundsPlayed = round;
  history.unshift({ result: win ? 'win' : 'lose', rounds: roundsPlayed });
  history = history.slice(0, 12);
  renderHistory();
  advanceTime(15);

  if (challenge) {
    challenge = null;
    settling = true;
    save();
    refreshHud();
    syncControls();
    setTimeout(() => {
      settling = false;
      challengeResult(win ? 'win' : 'lose', { game: 'votingscissors', rounds: roundsPlayed, kind: 'rps' });
    }, 900);
    return;
  }

  if (win) {
    addCash(ante * 2, { silent: true });
    recordRound(ante, ante);
    setStatus(`+${fmt(ante)} · 你贏了這一局。`);
  } else {
    recordRound(-ante, -ante);
    setStatus(`-${fmt(ante)} · 你輸了這一局。`, true);
  }
  refreshHud();
  save();
  syncControls();
}

/* ---------------- 畫面 ---------------- */

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>投票猜拳</h2>
      <span class="sub">每人三張手牌 · 一對一 · 平手就換下一張</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="table-wrap vr-wrap">
      <div class="felt vr-felt">
        <div class="vr-duel">
          <div class="vr-duel-side foe">
            <div class="vr-seat-head">
              <div class="story-avatar" id="vr-foe-avatar">敵</div>
              <div class="vr-seat-name">
                <b id="vr-foe-name">對手</b>
                <span id="vr-foe-title"></span>
              </div>
            </div>
            <div class="vr-cards" id="vr-foe-cards"></div>
            <div class="vr-hint" id="vr-foe-hint"></div>
          </div>

          <div class="vr-vs">VS</div>

          <div class="vr-duel-side me">
            <div class="vr-seat-head">
              <div class="story-avatar">你</div>
              <div class="vr-seat-name">
                <b>你</b>
                <span>三張手牌</span>
              </div>
            </div>
            <div class="vr-cards" id="vr-my-cards"></div>
            <div class="vr-hint" id="vr-my-hint">點一張牌打出去</div>
          </div>
        </div>

        <div class="vr-stage" id="vr-stage">決定注碼，然後坐上賭桌。</div>
        <div class="table-badge" id="vr-badge"></div>
      </div>

      <div class="panel vr-side">
        <div class="vr-side-head">
          <h3>這一局</h3>
          <span class="vr-round-tag">第 <b id="vr-round">—</b> 回合</span>
        </div>
        <div class="vr-stats">
          <div><span>注碼</span><b id="vr-ante">NT$ 0</b></div>
          <div><span>規則</span><b>先贏一回合</b></div>
        </div>
        <div class="vr-note">
          雙方各抽三張手牌，剪刀石頭布完全隨機、可以重複。<br>
          同時打出一張，平手就換下一張；<b>先拿下一個決勝回合的人贏</b>。<br>
          三張都平手：注碼留在桌上，重新抽牌。
        </div>
        <div class="vr-history-wrap">
          <span>最近結果</span>
          <div class="pk-history" id="vr-history"></div>
        </div>
      </div>
    </div>

    <div class="control-panel">
      <div class="control-group" id="vr-bet-group" style="flex:1 1 260px">
        <span class="control-label">注碼</span>
        <div class="bet-range-host" id="vr-range"></div>
      </div>
      <div class="control-group">
        <button class="btn gold" id="vr-start">坐上賭桌</button>
      </div>
      <div class="status-line" id="vr-status"></div>
    </div>
  `;

  els = {
    foeAvatar: el.querySelector('#vr-foe-avatar'),
    foeName: el.querySelector('#vr-foe-name'),
    foeTitle: el.querySelector('#vr-foe-title'),
    foeHint: el.querySelector('#vr-foe-hint'),
    foeCards: el.querySelector('#vr-foe-cards'),
    myCards: el.querySelector('#vr-my-cards'),
    stage: el.querySelector('#vr-stage'),
    badge: el.querySelector('#vr-badge'),
    round: el.querySelector('#vr-round'),
    ante: el.querySelector('#vr-ante'),
    history: el.querySelector('#vr-history'),
    status: el.querySelector('#vr-status'),
    start: el.querySelector('#vr-start'),
    betGroup: el.querySelector('#vr-bet-group')
  };

  els.range = mountBetRange(el.querySelector('#vr-range'), {
    label: '注碼',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: ante,
    onChange: v => {
      if (busy || phase === 'playing') return;
      ante = v;
      if (els.ante) els.ante.textContent = fmt(ante);
      syncControls();
    }
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('votingscissors');
  els.start.onclick = () => { sound.click(); startGame(); };

  dock = mountCheatDock(el, {
    game: 'votingscissors',
    label: '投票猜拳',
    stake: () => (challenge ? (challenge.wager || 0) : ante),
    options: [
      { id: 'rock', label: '✊ 石頭' },
      { id: 'paper', label: '✋ 布' },
      { id: 'scissors', label: '✌ 剪刀' }
    ],
    onPick: opt => {
      cheatNext = opt.id;
      setStage(`袖口裡的牌換過了。下一張打出去的手勢會是 ${opt.label}。`);
      setStatus(`老千：下一張手勢指定為 ${opt.label}。`);
    }
  });
}

function resetIdle() {
  phase = 'idle';
  busy = false;
  settling = false;
  yourHand = [];
  foeHand = [];
  yourUsed = [];
  foeUsed = [];
  round = 0;
  cheatNext = null;
  lastRound = null;
  phase = 'idle';
  clearBadge();
  renderCards();
  setStage('決定注碼，然後坐上賭桌。');
  syncControls();
}

function setupChallenge(ch) {
  challenge = ch;
  settling = false;
  onChallengeAbort(() => {
    challenge = null;
    busy = false;
    resetIdle();
  });
  foe = foeFromChallenge(ch);
  renderFoe();
  phase = 'idle';
  busy = false;
  yourHand = [];
  foeHand = [];
  yourUsed = [];
  foeUsed = [];
  round = 0;
  cheatNext = null;
  clearBadge();
  renderCards();
  setStatus('對手已經坐下。發牌……');
  setStage(`${ch.member} 把三張牌推到你面前。`);
  syncControls();
  const ref = challenge;
  setTimeout(() => {
    if (challenge === ref && phase === 'idle') startGame();
  }, 650);
}

export function enterVotingScissors() {
  render();
  const ch = getChallenge();
  if (ch && ch.game === 'votingscissors') {
    setupChallenge(ch);
    return;
  }
  const wasChallenge = !!challenge;
  challenge = null;
  if (wasChallenge) {
    resetIdle();
    foe = rollFoe();
  }
  if (!foe) foe = rollFoe();
  renderFoe();
  if (phase === 'idle' || phase === 'over') {
    renderCards();
    renderHistory();
    syncControls();
  } else {
    syncControls();
  }
}

export function leaveVotingScissors() { }

export function canLeaveVotingScissors() {
  if (challengeActive()) { toast('賭局進行中，請先完成或棄權。', 'warn'); return false; }
  if (busy || phase === 'playing') { toast('這一局還沒結束。', 'warn'); return false; }
  return true;
}
