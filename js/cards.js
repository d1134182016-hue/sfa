import { sound, sleep, rnd, rndInt } from './core.js';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = [
  { k: 's', sym: '♠', red: false },
  { k: 'h', sym: '♥', red: true },
  { k: 'd', sym: '♦', red: true },
  { k: 'c', sym: '♣', red: false }
];

let uid = 1;

export function makeDeck(count = 1) {
  const deck = [];
  for (let n = 0; n < count; n++) {
    for (let s = 0; s < 4; s++) {
      for (let r = 0; r < 13; r++) {
        deck.push({ r, s, id: uid++ });
      }
    }
  }
  return deck;
}

export function shuffle(cards) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rankLabel(c) { return RANKS[c.r]; }
export function suitOf(c) { return SUITS[c.s]; }
export function cardName(c) { return RANKS[c.r] + SUITS[c.s].sym; }
export function isRed(c) { return SUITS[c.s].red; }

export function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  el.className = 'card' + (faceDown ? ' face-down' : '') + (card.r === 9 ? ' ten' : '');
  el.dataset.rank = card.r;
  el.dataset.suit = card.s;
  el.dataset.id = card.id;
  const red = isRed(card);
  const sym = SUITS[card.s].sym;
  const label = RANKS[card.r];
  el.innerHTML =
    `<div class="card-inner">
      <div class="card-face front${red ? ' red' : ''}">
        <span class="c-tl">${label}<i>${sym}</i></span>
        <span class="c-pip">${sym}</span>
        <span class="c-br">${label}<i>${sym}</i></span>
      </div>
      <div class="card-face back"></div>
    </div>`;
  return el;
}

export function deckOrigin() {
  return document.querySelector('.view.active .deck-source') || document.querySelector('.deck-source');
}

function animateFromDeck(el, opts = {}) {
  const deck = deckOrigin();
  if (!deck) return;
  const finalRect = el.getBoundingClientRect();
  const dr = deck.getBoundingClientRect();
  const dx = dr.left + dr.width / 2 - (finalRect.left + finalRect.width / 2);
  const dy = dr.top + dr.height / 2 - (finalRect.top + finalRect.height / 2);
  const rot = opts.rot ?? rnd(-13, 13);
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.8)`;
  el.style.opacity = '0.15';
  void el.offsetWidth;
  requestAnimationFrame(() => {
    el.style.transition = 'transform .46s cubic-bezier(.16,1,.3,1), opacity .2s ease';
    el.style.transform = 'translate(0,0) rotate(0deg) scale(1)';
    el.style.opacity = '1';
  });
  const done = () => {
    el.style.transition = '';
    el.style.transform = '';
    el.style.opacity = '';
    el.removeEventListener('transitionend', done);
  };
  el.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 700);
}

export function dealCard(target, card, opts = {}) {
  const el = cardEl(card, !!opts.faceDown);
  target.appendChild(el);
  animateFromDeck(el, opts);
  if (opts.silent !== true) sound.card();
  return el;
}

export async function dealCards(target, cards, opts = {}) {
  const els = [];
  const stagger = opts.stagger ?? 110;
  for (let i = 0; i < cards.length; i++) {
    els.push(dealCard(target, cards[i], opts));
    if (i < cards.length - 1) await sleep(stagger);
  }
  return els;
}

export function flip(el, faceDown = false) {
  if (!el) return;
  if (faceDown) el.classList.add('face-down');
  else el.classList.remove('face-down');
  sound.flip();
}

export async function flipDelay(el, ms = 260, faceDown = false) {
  await sleep(ms);
  flip(el, faceDown);
}

export async function clearCards(container, animate = true) {
  if (!container) return;
  const cards = Array.from(container.querySelectorAll('.card'));
  if (!cards.length) return;
  if (!animate) { container.innerHTML = ''; return; }
  cards.forEach(c => c.classList.add('vanish'));
  await sleep(270);
  cards.forEach(c => c.remove());
}

export function clearNow(container) {
  if (container) container.innerHTML = '';
}

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 0) { aces++; total += 11; }
    else total += Math.min(10, c.r + 1);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return {
    total,
    soft: aces > 0 && total <= 21,
    bust: total > 21,
    blackjack: cards.length === 2 && total === 21
  };
}

export function moveCard(el, target, opts = {}) {
  if (!el || !target) return;
  const before = el.getBoundingClientRect();
  el.classList.remove('selected');
  target.appendChild(el);
  if (opts.flipDown) el.classList.add('face-down');
  if (opts.flipUp) el.classList.remove('face-down');
  const after = el.getBoundingClientRect();
  const dx = before.left - after.left;
  const dy = before.top - after.top;
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px)`;
  void el.offsetWidth;
  requestAnimationFrame(() => {
    el.style.transition = 'transform .32s cubic-bezier(.2,.9,.25,1)';
    el.style.transform = '';
    if (!opts.silent) sound.card();
  });
  setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 380);
}

export function moneyStack(el, from, to) {
  if (!el) return;
  el.style.transform = `translateY(${from}px)`;
  requestAnimationFrame(() => {
    el.style.transition = 'transform .3s ease';
    el.style.transform = `translateY(${to}px)`;
  });
}

export function highlightCards(cards, winCards) {
  const ids = new Set((winCards || []).map(c => c.id));
  for (const el of cards) {
    if (ids.has(Number(el.dataset.id))) el.classList.add('win');
    else el.classList.add('dim');
  }
}

export function unhighlight(cards) {
  for (const el of cards) el.classList.remove('win', 'dim');
}

export { rndInt };
