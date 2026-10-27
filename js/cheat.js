import {
  state, fmt, clamp, save, refreshHud, toast, openModal, sound, logEvent, money
} from './core.js';
import { RANKS, SUITS } from './cards.js';

const BASE_RISK = 0.15;
const RISK_STEP = 0.07;
const RISK_CAP = 0.55;

const TILE_NAMES = [
  '1萬', '2萬', '3萬', '4萬', '5萬', '6萬', '7萬', '8萬', '9萬',
  '1筒', '2筒', '3筒', '4筒', '5筒', '6筒', '7筒', '8筒', '9筒',
  '1索', '2索', '3索', '4索', '5索', '6索', '7索', '8索', '9索',
  '東', '南', '西', '北', '中', '發', '白'
];

/* ---------------- 狀態 ---------------- */

export function cheatState() {
  if (!state.cheat || typeof state.cheat !== 'object') {
    state.cheat = { day: 0, today: 0, total: 0, caught: 0 };
  }
  const c = state.cheat;
  c.total = Number(c.total) || 0;
  c.caught = Number(c.caught) || 0;
  c.today = Number(c.today) || 0;
  if (c.day !== state.day) { c.day = state.day; c.today = 0; }
  return c;
}

export function cheatRisk() {
  return Math.min(RISK_CAP, BASE_RISK + cheatState().today * RISK_STEP);
}

function fineFor(stake) {
  return Math.max(25000, Math.round(Math.max(0, stake) * 2 / 1000) * 1000);
}

/* ---------------- 選項 ---------------- */

export function cardOptions() {
  const out = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      out.push({ id: `${s}-${r}`, label: `${SUITS[s].sym}${RANKS[r]}`, red: SUITS[s].red });
    }
  }
  return out;
}

export function parseCardId(id) {
  const [s, r] = String(id).split('-').map(Number);
  return { r, s };
}

export function tileOptions() {
  return TILE_NAMES.map((label, id) => ({ id, label }));
}

/* ---------------- 指定牌 ---------------- */

const pending = {};
let cheatUid = 800000;

export function setPending(game, kind, value) {
  pending[game] = { kind, value };
}

export function clearPending(game) {
  delete pending[game];
}

export function hasPending(game) {
  return !!pending[game];
}

export function drawWithCheat(game, deck, kind = 'card') {
  const p = pending[game];
  if (!p || p.kind !== kind) return deck.pop();
  delete pending[game];
  if (kind === 'tile') return Number(p.value);
  const { r, s } = p.value;
  return { r, s, id: ++cheatUid };
}

/* ---------------- 懲罰 ---------------- */

function applyRaid() {
  const a = state.admin || (state.admin = {});
  if (a.neutralDissolved) { a.oversight = 0; return 0; }
  if ((a.oversight || 0) < 100) return 0;
  a.oversight = 55;
  a.prestige = clamp((a.prestige || 0) - 10, 0, 100);
  const lost = Math.floor(Math.max(0, state.cash) * 0.3);
  state.cash -= lost;
  if (state.councilJoined) {
    state.councilJoined = false;
    state.councilRank = '';
  }
  return lost;
}

export function cheatCaught(stake, gameLabel = '賭桌') {
  const c = cheatState();
  c.caught += 1;
  c.today += 1;
  const fine = fineFor(stake);
  const cash = Math.max(0, Math.round(state.cash));
  const paid = Math.min(cash, fine);
  state.cash = cash - paid;
  const debt = fine - paid;
  if (debt > 0) state.shark = Math.round(state.shark) + debt;

  const a = state.admin || (state.admin = {});
  a.oversight = clamp((a.oversight || 0) + 24, 0, 100);
  a.prestige = clamp((a.prestige || 0) - 4, 0, 100);
  const lost = applyRaid();

  logEvent(`老千在${gameLabel}被中立委員會抓到。罰金 ${fmt(fine)}${debt > 0 ? `（其中 ${fmt(debt)} 轉為欠款）` : ''}。`, 'warn');
  save();
  refreshHud();

  openModal({
    title: '被中立委員會抓到了',
    wide: true,
    html: `
      <div class="cheat-caught">
        <p>「你的手，比牌還快。」</p>
        <p>在${gameLabel}上動手腳的瞬間，中立委員會的監察已經站在你身後。</p>
        <ul>
          <li>罰金 <b>${fmt(fine)}</b>${debt > 0 ? `（現金不足，${fmt(debt)} 記入欠款）` : ''}</li>
          <li>審查度 <b>+24</b> · 威望 <b>−4</b></li>
          ${lost > 0 ? `<li>臨時審查：沒收現金 <b>${fmt(lost)}</b>、威望 −10${state.councilJoined ? '' : '、學生會資格已撤銷'}</li>` : ''}
        </ul>
        <p class="cheat-warn">再被抓住幾次，名冊上的名字就會換成你的。</p>
      </div>`,
    buttons: [{ label: '認了', kind: 'danger' }]
  });

  return { fine, paid, debt, lost };
}

/* ---------------- 面板 ---------------- */

export function openCheatPanel({ game, stake = 0, options, onPick, label = '賭桌', onChange }) {
  const risk = Math.round(cheatRisk() * 100);
  const c = cheatState();
  const a = state.admin || {};
  const stakeV = typeof stake === 'function' ? stake() : stake;

  const close = openModal({
    title: '老千 · 指定下一張',
    wide: true,
    html: `
      <div class="cheat-head">
        <span>被逮風險 <b>${risk}%</b></span>
        <span>今日已用 <b>${c.today}</b> 次</span>
        <span>審查度 <b>${Math.round(a.oversight || 0)}</b>／100</span>
        <span>威望 <b>${Math.round(a.prestige || 0)}</b></span>
      </div>
      <p class="cheat-note">
        指定下一張牌塞進牌山。成功就是它；失敗會驚動中立委員會，罰金
        <b>${money(fineFor(stakeV))}</b>、審查度 +24、威望 −4。
        每多用一次，今天的風險就更高。
      </p>
      <div class="cheat-grid ${options.length > 40 ? 'many' : ''}">
        ${options.map(o => `<button type="button" class="cheat-pick${o.red ? ' red' : ''}" data-cheat="${o.id}">${o.label}</button>`).join('')}
      </div>`,
    buttons: [{ label: '算了', kind: 'ghost' }]
  });

  const overlay = document.getElementById('overlay-root');
  overlay.querySelectorAll('[data-cheat]').forEach(btn => {
    btn.onclick = () => {
      const opt = options.find(o => String(o.id) === btn.dataset.cheat);
      if (!opt) return;
      if (Math.random() < cheatRisk()) {
        close();
        sound.lose();
        cheatCaught(stakeV, label);
        if (onChange) onChange();
        return;
      }
      c.today += 1;
      c.total += 1;
      c.day = state.day;
      const a2 = state.admin || (state.admin = {});
      a2.oversight = clamp((a2.oversight || 0) + 5, 0, 100);
      save();
      refreshHud();
      close();
      sound.chip();
      toast(`牌山動過手腳：下一張會是 ${opt.label}。`, 'info', 3000);
      logEvent(`你在${label}動了手腳，指定下一張牌。`, 'warn');
      if (onChange) onChange();
      if (onPick) onPick(opt);
    };
  });
  return close;
}

/* ---------------- 牌桌按鈕 ---------------- */

export function mountCheatDock(viewEl, cfg) {
  if (!viewEl) return;
  const old = viewEl.querySelector('.cheat-dock');
  if (old) old.remove();
  const dock = document.createElement('div');
  dock.className = 'cheat-dock';
  dock.innerHTML = `<button type="button" class="cheat-btn"><span>老千</span><em data-risk>${Math.round(cheatRisk() * 100)}%</em></button>`;
  viewEl.appendChild(dock);
  const refreshRisk = () => {
    const em = dock.querySelector('[data-risk]');
    if (em) em.textContent = Math.round(cheatRisk() * 100) + '%';
  };
  const btn = dock.querySelector('.cheat-btn');
  btn.onclick = () => {
    sound.click();
    openCheatPanel({ ...cfg, onChange: refreshRisk });
    refreshRisk();
  };
  return { refresh: refreshRisk };
}
