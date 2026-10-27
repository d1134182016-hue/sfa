import { fmt, confirmDialog } from './core.js';

let active = null;
let abortHandler = null;

const MODE_LABEL = { formula: '公式戰', trial: '入會測驗', coup: '政變', guest: '賭博邀請' };
const GAME_LABEL = {
  blackjack: '21 點', mahjong: '二人麻將', holdem: '德州撲克', votingscissors: '投票猜拳'
};

function bannerHTML(ctx) {
  const stake = ctx.mode === 'formula'
    ? `下注 ${fmt(ctx.wager)}${ctx.credit ? `（賒帳 ${fmt(ctx.credit)}）` : ''}`
    : ctx.mode === 'guest'
      ? `下注 ${fmt(ctx.wager)} · 贏了雙倍`
      : '無下注 · 賭的是位子';
  return `
    <span class="ch-badge">${MODE_LABEL[ctx.mode] || '挑戰'}</span>
    <b class="ch-member">${ctx.member}</b>
    <span class="ch-game">${GAME_LABEL[ctx.game] || ''}</span>
    <span class="ch-stake">${stake}</span>
    <button type="button" class="ch-quit">棄權</button>`;
}

function mountBanner() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('challenge-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'challenge-banner';
    el.className = 'challenge-banner';
    document.body.appendChild(el);
  }
  el.innerHTML = bannerHTML(active);
  const quit = el.querySelector('.ch-quit');
  if (quit) quit.onclick = () => surrenderChallenge();
  document.body.classList.add('challenge-on');
}

function unmountBanner() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('challenge-banner');
  if (el) el.remove();
  document.body.classList.remove('challenge-on');
}

export function setChallenge(ctx) {
  active = { ...ctx, done: false };
  abortHandler = null;
  mountBanner();
}

export function onChallengeAbort(fn) {
  abortHandler = fn;
}

export function getChallenge() {
  return active;
}

export function challengeActive() {
  return !!active && !active.done;
}

export function challengeResult(result, detail = {}) {
  if (!active || active.done) return;
  const ctx = active;
  ctx.done = true;
  active = null;
  abortHandler = null;
  unmountBanner();
  if (ctx.onResult) ctx.onResult(result, detail);
}

export function clearChallenge() {
  if (active) active.done = true;
  active = null;
  abortHandler = null;
  unmountBanner();
}

export function surrenderChallenge() {
  if (!active || active.done) return;
  const ctx = active;
  const text = ctx.mode === 'trial'
    ? '棄權視同入會測驗失敗：你將重新成為家畜，債務回到 NT$10,000,000。確定嗎？'
    : ctx.mode === 'coup'
      ? '棄權視同政變失敗：學生會資格會被撤銷，你將重新成為家畜。確定嗎？'
      : ctx.mode === 'guest'
        ? `棄權視同落敗：下注 ${fmt(ctx.wager)} 不會退還，對方的好感度也會下降。確定嗎？`
        : `棄權視同落敗：下注 ${fmt(ctx.wager)} 不會退還。確定嗎？`;
  confirmDialog('棄權', text, '棄權', true).then(ok => {
    if (!ok) return;
    const abort = abortHandler;
    abortHandler = null;
    if (abort) abort();
    challengeResult('lose', { surrender: true });
  });
}
