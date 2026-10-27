import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, clamp, mountBetRange
} from '../core.js';
import { makeDeck, shuffle, dealCard, flip, clearCards } from '../cards.js';
import { niuEval, compareNiu } from '../eval.js';
import {
  cardOptions, parseCardId, setPending, drawWithCheat, mountCheatDock
} from '../cheat.js';

const root = () => document.getElementById('view-niuniu');
const CHIPS = [10000, 50000, 200000, 500000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;

let bet = 50000;
let phase = 'bet';       // bet | dealt | reveal | done
let busy = false;
let roundBet = 0;
let player = [];
let dealer = [];
let playerEls = [];
let dealerEls = [];
let els = {};

function syncControls() {
  if (!els.deal) return;
  const canReveal = !busy && phase === 'dealt' && !state.locked;
  const canDeal = !busy && phase !== 'dealt' && phase !== 'reveal' &&
    bet > 0 && state.cash >= bet && !state.locked;
  els.deal.disabled = !(canReveal || canDeal);
  els.deal.textContent = phase === 'dealt' ? '開牌' : '發牌';
  els.chips.forEach(c => { c.disabled = busy || phase === 'dealt' || phase === 'reveal'; });
  els.clear.disabled = busy || phase === 'dealt' || phase === 'reveal' || bet <= 0;
  if (els.bet) els.bet.textContent = fmt(roundBet > 0 && phase !== 'bet' && phase !== 'done' ? roundBet : bet);
  if (els.range) {
    els.range.sync(bet);
    els.range.setDisabled(busy || phase === 'dealt' || phase === 'reveal');
  }
  if (!busy && phase === 'bet' && state.cash < 10000 && els.status) {
    els.status.textContent = '現金不足，去借一點再回來。';
    els.status.className = 'status-line warn';
  }
}

function setStatus(text, warn = false) {
  if (!els.status) return;
  els.status.textContent = text || '';
  els.status.className = 'status-line' + (warn ? ' warn' : '');
}

function setBadge(el, ev, dim = false) {
  if (!el) return;
  el.textContent = ev ? ev.name : '—';
  el.classList.toggle('dim', dim);
  el.classList.toggle('big', !!ev && ev.mult >= 3);
}

function setResult(text, kind = '') {
  if (!els.result) return;
  els.result.textContent = text;
  els.result.className = 'table-badge' + (kind ? ' ' + kind : '');
  els.result.classList.add('show');
}

function addBet(v) {
  if (busy || phase === 'dealt' || phase === 'reveal') return;
  if (bet + v > state.cash) { toast('現金不足。', 'warn'); return; }
  bet += v;
  phase = 'bet';
  sound.chip();
  syncControls();
}

async function startDeal() {
  if (busy || state.locked) return;
  if (bet <= 0) { toast('先押注。', 'warn'); return; }
  if (state.cash < bet) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(bet)) { toast('現金不足。', 'warn'); return; }

  busy = true;
  roundBet = bet;
  phase = 'dealt';
  player = [];
  dealer = [];
  playerEls = [];
  dealerEls = [];
  setBadge(els.playerBadge, null, true);
  setBadge(els.dealerBadge, null, true);
  if (els.result) els.result.classList.remove('show');
  syncControls();
  setStatus('發牌中……');
  els.msg.textContent = '莊家洗牌，閒家先坐穩';

  await clearCards(els.playerHand, false);
  await clearCards(els.dealerHand, false);
  await sleep(90);

  const deck = shuffle(makeDeck(1));
  for (let i = 0; i < 5; i++) {
    const pc = drawWithCheat('niuniu', deck);
    player.push(pc);
    playerEls.push(dealCard(els.playerHand, pc, { faceDown: true }));
    sound.card();
    await sleep(105);
    const dc = drawWithCheat('niuniu', deck);
    dealer.push(dc);
    dealerEls.push(dealCard(els.dealerHand, dc, { faceDown: true }));
    sound.card();
    await sleep(105);
  }

  setStatus('牌已發好。按「開牌」看你的牌。');
  els.msg.textContent = '五張牌，湊出三張十的倍數';
  busy = false;
  syncControls();
}

async function reveal() {
  if (busy || phase !== 'dealt') return;
  busy = true;
  phase = 'reveal';
  syncControls();
  setStatus('開你的牌……');
  els.msg.textContent = '找出三張加起來是十的倍數';

  for (let i = 0; i < playerEls.length; i++) {
    flip(playerEls[i], false);
    await sleep(150);
  }
  const pe = niuEval(player);
  setBadge(els.playerBadge, pe, false);
  sound.flip();
  await sleep(620);

  setStatus('莊家開牌……');
  els.msg.textContent = pe.name === '無牛' ? '莊家只要有點，你就危險了' : '看看莊家有沒有你硬';
  for (let i = 0; i < dealerEls.length; i++) {
    flip(dealerEls[i], false);
    await sleep(150);
  }
  const de = niuEval(dealer);
  setBadge(els.dealerBadge, de, false);
  sound.flip();
  await sleep(700);

  const cmp = compareNiu(player, dealer);
  const won = cmp > 0;

  let profit, mult, text, kind;
  if (won) {
    mult = Math.max(1, pe.mult);
    profit = roundBet * mult;
    addCash(roundBet + profit, { silent: true });
    text = `你贏了 · ${pe.name}`;
    kind = '';
    sound.win(mult >= 3);
  } else {
    mult = Math.max(1, de.mult);
    const extra = Math.min(roundBet * (mult - 1), Math.max(0, state.cash));
    if (extra > 0) spendCash(extra);
    profit = -(roundBet + extra);
    text = cmp === 0 ? `莊家贏同點 · ${de.name}` : `莊家贏了 · ${de.name}`;
    kind = 'lose';
    sound.lose();
  }

  setResult(text, kind);
  setStatus(`${profit >= 0 ? '+' : ''}${fmt(profit)}${mult > 1 ? '（' + mult + ' 倍）' : ''}`, profit < 0);
  els.msg.textContent = won ? '莊家收牌，籌碼推過來。' : '下一把，別把倍數忘了。';

  recordRound(profit, profit);
  refreshHud();
  advanceTime(45);

  await sleep(1700);
  if (els.result) els.result.classList.remove('show');
  phase = 'done';
  busy = false;
  bet = clamp(bet, 10000, Math.max(10000, state.cash));
  syncControls();
  setStatus('下注，然後發牌。');
  els.msg.textContent = '莊家贏同點，想贏就得更硬';
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>妞妞</h2>
      <span class="sub">5 張牌 · 莊家贏同點 · 最高 5 倍</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>
    <div class="table-wrap">
      <div class="felt nn-felt">
        <div class="deck-source"><span class="shoe-count">牌堆</span></div>
        <div class="bet-display">本局押注 <b id="nn-bet">NT$ 0</b></div>

        <div class="nn-side">
          <div class="hand-label">莊家 <span class="pill">莊</span></div>
          <div class="hand" id="nn-dealer-hand"></div>
          <div class="nn-badge dim" id="nn-dealer-badge">—</div>
        </div>

        <div class="nn-middle">
          <div class="nn-vs">莊 家 對 閒 家</div>
          <div class="nn-mult" id="nn-msg">莊家贏同點，想贏就得更硬</div>
        </div>

        <div class="nn-side">
          <div class="hand" id="nn-player-hand"></div>
          <div class="hand-label">你 <span class="pill">閒</span></div>
          <div class="nn-badge dim" id="nn-player-badge">—</div>
        </div>

        <div class="table-badge" id="nn-result"></div>
      </div>

      <div class="control-panel">
        <div class="control-group">
          <span class="control-label">下注</span>
          <div class="bet-range-host" id="nn-range"></div>
          <div class="chip-row">
            ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>籌碼</small></button>`).join('')}
          </div>
          <button class="btn small ghost" id="nn-clear">最小</button>
        </div>
        <div class="control-group">
          <button class="btn gold" id="nn-deal">發牌</button>
        </div>
        <div class="status-line" id="nn-status"></div>
      </div>
    </div>
  `;

  els = {
    dealerHand: el.querySelector('#nn-dealer-hand'),
    playerHand: el.querySelector('#nn-player-hand'),
    dealerBadge: el.querySelector('#nn-dealer-badge'),
    playerBadge: el.querySelector('#nn-player-badge'),
    result: el.querySelector('#nn-result'),
    bet: el.querySelector('#nn-bet'),
    msg: el.querySelector('#nn-msg'),
    status: el.querySelector('#nn-status'),
    deal: el.querySelector('#nn-deal'),
    clear: el.querySelector('#nn-clear'),
    chips: Array.from(el.querySelectorAll('[data-chip]'))
  };

  els.range = mountBetRange(el.querySelector('#nn-range'), {
    label: '下注金額',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor(state.cash / 10000) * 10000),
    value: bet,
    onChange: v => {
      if (busy || phase === 'dealt' || phase === 'reveal') return;
      bet = v;
      phase = 'bet';
      if (els.bet) els.bet.textContent = fmt(bet);
      els.deal.disabled = !(bet > 0 && state.cash >= bet) || state.locked;
      els.clear.disabled = bet <= 0;
    }
  });

  mountCheatDock(el, {
    game: 'niuniu',
    label: '妞妞',
    stake: () => (roundBet || bet),
    options: cardOptions(),
    onPick: opt => setPending('niuniu', 'card', parseCardId(opt.id))
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('niuniu');
  els.chips.forEach(c => { c.onclick = () => addBet(Number(c.dataset.chip)); });
  els.clear.onclick = () => {
    if (busy || phase === 'dealt' || phase === 'reveal') return;
    bet = 10000;
    phase = 'bet';
    sound.click();
    syncControls();
  };
  els.deal.onclick = () => {
    sound.click();
    if (phase === 'dealt') reveal();
    else startDeal();
  };

  syncControls();
}

export function enterNiuniu() {
  render();
  syncControls();
}

export function leaveNiuniu() { }

export function canLeaveNiuniu() {
  if (busy || phase === 'dealt' || phase === 'reveal') {
    toast('這一手還沒結束。', 'warn');
    return false;
  }
  return true;
}
