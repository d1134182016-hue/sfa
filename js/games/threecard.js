import {
  state, fmt, spendCash, addCash, refreshHud, toast, advanceTime,
  recordRound, sleep, router, sound, openRules, clamp, mountBetRange
} from '../core.js';
import { makeDeck, shuffle, dealCard, flip, clearCards } from '../cards.js';
import { eval3 } from '../eval.js';
import {
  cardOptions, parseCardId, setPending, drawWithCheat, mountCheatDock
} from '../cheat.js';

const root = () => document.getElementById('view-threecard');
const CHIPS = [10000, 50000, 200000, 500000];
const PAIR_CHIPS = [10000, 50000, 200000];
const chipLabel = v => v >= 1000000 ? (v / 1000000) + 'M' : v >= 1000 ? (v / 1000) + 'K' : v;
const TCP_NAMES = ['高牌', '對子', '同花', '順子', '三條', '同花順'];
const PAIR_PAY = [0, 1, 4, 6, 30, 40];
const ANTE_BONUS = [0, 0, 0, 1, 4, 5];

let ante = 50000;
let pairBet = 0;
let phase = 'bet';
let busy = false;
let roundAnte = 0;
let roundPair = 0;
let player = [];
let dealer = [];
let playerEls = [];
let dealerEls = [];
let els = {};

function tcpEval(cards) {
  const ev = eval3(cards);
  const cat = [0, 1, 3, 2, 5, 4][ev.cat];
  return { cat, tie: ev.tie, name: TCP_NAMES[cat], base: ev };
}

function cmpTcp(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < 3; i++) {
    const x = a.tie[i] || 0, y = b.tie[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function dealerQualifies(ev) {
  return ev.cat > 0 || (ev.tie[0] || 0) >= 12;
}

function totalStake() { return ante + pairBet; }

function syncControls() {
  if (!els.deal) return;
  const playing = phase === 'play';
  const dealing = phase === 'deal';
  const result = phase === 'result';
  els.deal.classList.toggle('hidden', playing || dealing);
  els.fold.classList.toggle('hidden', !playing);
  els.play.classList.toggle('hidden', !playing);
  els.deal.textContent = result ? '再來一局' : '發牌';
  els.deal.disabled = busy || dealing || playing || totalStake() <= 0 ||
    state.cash < totalStake() || state.locked;
  els.fold.disabled = busy || !playing;
  els.play.disabled = busy || !playing || state.cash < roundAnte;
  els.play.textContent = `加注 ${fmt(roundAnte)}`;
  els.chips.forEach(c => { c.disabled = busy || playing || dealing; });
  els.pairChips.forEach(c => { c.disabled = busy || playing || dealing; });
  els.clear.disabled = busy || playing || dealing || ante <= 0;
  els.clearPair.disabled = busy || playing || dealing || pairBet <= 0;
  if (els.ante) els.ante.textContent = fmt(dealing || playing || result ? roundAnte : ante);
  if (els.pair) els.pair.textContent = fmt(dealing || playing || result ? roundPair : pairBet);
  els.pairChips.forEach(c => c.classList.toggle('active', Number(c.dataset.pair) === pairBet));
  if (els.range) {
    els.range.sync(dealing || playing || result ? roundAnte : ante);
    els.range.setDisabled(busy || playing || dealing);
  }
  if (!busy && phase === 'bet' && state.cash < Math.max(10000, totalStake())) {
    els.status.textContent = '現金不足，降低底注或去借貸中心。';
    els.status.className = 'status-line warn';
  }
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

function hideBadge() {
  if (els.badge) els.badge.classList.remove('show');
}

function addAnte(v) {
  if (busy || phase !== 'bet') return;
  if (ante + v + pairBet > state.cash) { toast('現金不足。', 'warn'); return; }
  ante += v;
  sound.chip();
  syncControls();
}

function setPair(v) {
  if (busy || phase !== 'bet') return;
  const next = pairBet === v ? 0 : v;
  if (ante + next > state.cash) { toast('現金不足。', 'warn'); return; }
  pairBet = next;
  sound.chip();
  syncControls();
}

async function deal() {
  if (busy || state.locked) return;
  if (phase === 'play' || phase === 'deal') return;
  if (totalStake() <= 0) { toast('先押底注。', 'warn'); return; }
  if (state.cash < totalStake()) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(totalStake())) return;

  busy = true;
  phase = 'deal';
  roundAnte = ante;
  roundPair = pairBet;
  player = [];
  dealer = [];
  playerEls = [];
  dealerEls = [];
  hideBadge();
  els.playerTotal.textContent = '—';
  els.dealerTotal.textContent = '—';
  els.msg.textContent = '莊家發牌';
  syncControls();
  await clearCards(els.playerHand, false);
  await clearCards(els.dealerHand, false);
  setStatus('發牌中……');

  const deck = shuffle(makeDeck(1));
  for (let i = 0; i < 3; i++) {
    const pc = drawWithCheat('threecard', deck);
    player.push(pc);
    playerEls.push(dealCard(els.playerHand, pc));
    sound.card();
    await sleep(140);
    const dc = drawWithCheat('threecard', deck);
    dealer.push(dc);
    dealerEls.push(dealCard(els.dealerHand, dc, { faceDown: true, silent: true }));
    await sleep(90);
  }

  await sleep(320);
  for (const el of playerEls) el.classList.remove('face-down');
  const pe = tcpEval(player);
  els.playerTotal.textContent = pe.name;
  els.playerTotal.className = 'bj-total';
  els.msg.textContent = pe.name === '高牌' ? '高牌不一定輸，莊家要 Q 以上才成局' : `你的牌型：${pe.name}`;
  setStatus(`底注 ${fmt(roundAnte)}${roundPair ? ' · 對子加注 ' + fmt(roundPair) : ''}，選擇加注或棄牌。`);
  busy = false;
  phase = 'play';
  syncControls();
}

function anteBonus(ev) {
  return (ANTE_BONUS[ev.cat] || 0) * roundAnte;
}

function pairProfit(ev) {
  const mult = PAIR_PAY[ev.cat] || 0;
  return mult > 0 ? roundPair * mult : 0;
}

async function resolve(fold) {
  if (busy || phase !== 'play') return;
  if (!fold) {
    if (state.cash < roundAnte) { toast('現金不足，只能棄牌。', 'warn'); return; }
    if (!spendCash(roundAnte)) { toast('現金不足。', 'warn'); return; }
  }

  busy = true;
  phase = 'result';
  syncControls();
  setStatus('莊家開牌……');
  for (const el of dealerEls) {
    flip(el, false);
    await sleep(140);
  }
  const pe = tcpEval(player);
  const de = tcpEval(dealer);
  els.dealerTotal.textContent = de.name;
  els.dealerTotal.className = 'bj-total' + (dealerQualifies(de) ? '' : ' soft');
  await sleep(360);

  const pp = pairProfit(pe);
  const bonus = anteBonus(pe);
  let returned = 0;
  let text = '';
  let kind = '';
  let detail = '';

  if (fold) {
    text = '棄牌';
    kind = 'lose';
    detail = '底注沒收';
    els.msg.textContent = de.name;
  } else if (!dealerQualifies(de)) {
    returned += roundAnte * 3;
    returned += bonus;
    text = '莊家未成局';
    detail = `底注賠 1 倍${bonus ? ' · 底注獎金 +' + fmt(bonus) : ''}`;
    els.msg.textContent = `莊家只有 ${de.name}，Q 以上才成局`;
  } else {
    const cmp = cmpTcp(pe, de);
    if (cmp > 0) {
      returned += roundAnte * 4;
      returned += bonus;
      text = `贏了 · ${pe.name}`;
      detail = `底注與加注各賠 1 倍${bonus ? ' · 底注獎金 +' + fmt(bonus) : ''}`;
    } else if (cmp === 0) {
      returned += roundAnte * 2;
      returned += bonus;
      text = '平手';
      kind = 'push';
      detail = `退回底注與加注${bonus ? ' · 底注獎金 +' + fmt(bonus) : ''}`;
    } else {
      returned += bonus;
      text = `輸了 · ${de.name}`;
      kind = 'lose';
      detail = bonus ? `底注獎金 +${fmt(bonus)}` : '莊家牌型較大';
    }
    els.msg.textContent = `${pe.name} vs ${de.name}`;
  }

  if (pp > 0) {
    returned += roundPair + pp;
    detail += ` · 對子加注 +${fmt(pp)}`;
  } else if (roundPair > 0) {
    detail += ' · 對子加注未中';
  }

  if (returned > 0) addCash(returned, { silent: true });
  const spent = roundAnte + roundPair + (fold ? 0 : roundAnte);
  const profit = returned - spent;

  setBadge(text, kind);
  const resultText = `${detail}　${profit >= 0 ? '+' : ''}${fmt(profit)}`;
  setStatus(resultText, profit < 0);
  if (profit > 0) sound.win(profit >= roundAnte * 4);
  else if (kind === 'push') sound.push();
  else sound.lose();

  recordRound(profit, profit);
  refreshHud();
  advanceTime(45);

  await sleep(1900);
  hideBadge();
  phase = 'bet';
  busy = false;
  ante = clamp(ante, 10000, Math.max(10000, state.cash));
  pairBet = Math.min(pairBet, Math.max(0, state.cash - ante));
  if (state.cash < 10000) setStatus('現金不足，去借貸中心或換張桌子。', true);
  else setStatus(resultText, profit < 0);
  els.msg.textContent = 'Q 以上才成局；三張牌的順子比同花大';
  syncControls();
  setStatus(state.cash < 10000 ? '現金不足，去借貸中心或換張桌子。' : resultText, profit < 0);
}

function render() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 大廳</button>
      <h2>三張牌</h2>
      <span class="sub">Three Card Poker · 莊家 Q 以上成局 · 對子加注</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="table-wrap">
      <div class="felt tcp-felt">
        <div class="deck-source"><span class="shoe-count">牌堆</span></div>
        <div class="bet-display">底注 <b id="tcp-ante">NT$ 0</b> · 對子注 <b id="tcp-pair">NT$ 0</b></div>

        <div class="tcp-side dealer">
          <div class="hand-label">莊家 <span class="bj-total" id="tcp-dealer-total">—</span></div>
          <div class="hand" id="tcp-dealer-hand"></div>
        </div>

        <div class="tcp-center">
          <div class="nn-vs">三 張 牌</div>
          <div class="tcp-msg" id="tcp-msg">Q 以上才成局；三張牌的順子比同花大</div>
        </div>

        <div class="tcp-side player">
          <div class="hand" id="tcp-player-hand"></div>
          <div class="hand-label">你 <span class="bj-total" id="tcp-player-total">—</span></div>
        </div>

        <div class="table-badge" id="tcp-badge"></div>
      </div>

      <div class="panel tcp-pay">
        <div class="tcp-pay-col">
          <h4>對子加注</h4>
          <div><span>對子</span><b>1 : 1</b></div>
          <div><span>同花</span><b>4 : 1</b></div>
          <div><span>順子</span><b>6 : 1</b></div>
          <div><span>三條</span><b>30 : 1</b></div>
          <div><span>同花順</span><b>40 : 1</b></div>
        </div>
        <div class="tcp-pay-col">
          <h4>底注獎金</h4>
          <div><span>順子</span><b>+1 倍</b></div>
          <div><span>三條</span><b>+4 倍</b></div>
          <div><span>同花順</span><b>+5 倍</b></div>
          <p>莊家未成局時，底注賠 1 倍、加注退回。</p>
        </div>
      </div>

      <div class="control-panel">
        <div class="control-group">
          <span class="control-label">底注</span>
          <div class="bet-range-host" id="tcp-range"></div>
          <div class="chip-row">
            ${CHIPS.map(v => `<button class="chip-btn chip-${v}" data-chip="${v}">${chipLabel(v)}<small>籌碼</small></button>`).join('')}
          </div>
          <button class="btn small ghost" id="tcp-clear">最小</button>
        </div>
        <div class="control-group">
          <span class="control-label">對子注</span>
          <div class="chip-row">
            ${PAIR_CHIPS.map(v => `<button class="chip-btn chip-${v}" data-pair="${v}">${chipLabel(v)}<small>對子</small></button>`).join('')}
          </div>
          <button class="btn small ghost" id="tcp-clear-pair">清除</button>
        </div>
        <div class="control-group tcp-actions">
          <button class="btn gold" id="tcp-deal">發牌</button>
          <button class="btn danger hidden" id="tcp-fold">棄牌</button>
          <button class="btn gold hidden" id="tcp-play">加注</button>
        </div>
        <div class="status-line" id="tcp-status"></div>
      </div>
    </div>
  `;

  els = {
    dealerHand: el.querySelector('#tcp-dealer-hand'),
    playerHand: el.querySelector('#tcp-player-hand'),
    dealerTotal: el.querySelector('#tcp-dealer-total'),
    playerTotal: el.querySelector('#tcp-player-total'),
    ante: el.querySelector('#tcp-ante'),
    pair: el.querySelector('#tcp-pair'),
    msg: el.querySelector('#tcp-msg'),
    badge: el.querySelector('#tcp-badge'),
    status: el.querySelector('#tcp-status'),
    deal: el.querySelector('#tcp-deal'),
    fold: el.querySelector('#tcp-fold'),
    play: el.querySelector('#tcp-play'),
    clear: el.querySelector('#tcp-clear'),
    clearPair: el.querySelector('#tcp-clear-pair'),
    chips: Array.from(el.querySelectorAll('[data-chip]')),
    pairChips: Array.from(el.querySelectorAll('[data-pair]'))
  };

  els.range = mountBetRange(el.querySelector('#tcp-range'), {
    label: '底注金額',
    min: 10000,
    step: 10000,
    max: () => Math.max(10000, Math.floor((state.cash - pairBet) / 10000) * 10000),
    value: ante,
    onChange: v => {
      if (busy || phase !== 'bet') return;
      ante = v;
      if (els.ante) els.ante.textContent = fmt(ante);
      els.deal.disabled = totalStake() <= 0 || state.cash < totalStake() || state.locked;
    }
  });

  mountCheatDock(el, {
    game: 'threecard',
    label: '三張牌',
    stake: () => (phase === 'bet' ? totalStake() : roundAnte + roundPair),
    options: cardOptions(),
    onPick: opt => setPending('threecard', 'card', parseCardId(opt.id))
  });

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('threecard');
  els.chips.forEach(c => { c.onclick = () => addAnte(Number(c.dataset.chip)); });
  els.pairChips.forEach(c => { c.onclick = () => setPair(Number(c.dataset.pair)); });
  els.clear.onclick = () => {
    if (busy || phase !== 'bet') return;
    ante = 10000;
    sound.click();
    syncControls();
  };
  els.clearPair.onclick = () => {
    if (busy || phase !== 'bet') return;
    pairBet = 0;
    sound.click();
    syncControls();
  };
  els.deal.onclick = () => { sound.click(); deal(); };
  els.fold.onclick = () => { sound.click(); resolve(true); };
  els.play.onclick = () => { sound.click(); resolve(false); };

  syncControls();
}

export function enterThreeCard() {
  render();
  syncControls();
}

export function leaveThreeCard() { }

export function canLeaveThreeCard() {
  if (busy || phase === 'deal' || phase === 'play' || phase === 'result') {
    toast('這一局還沒結束。', 'warn');
    return false;
  }
  return true;
}
