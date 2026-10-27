export const CAT_NAMES = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '鐵支', '同花順'];
export const CAT3_NAMES = ['散牌', '對子', '順子', '同花', '同花順', '豹子'];

export function rankValue(c) { return c.r === 0 ? 14 : c.r + 1; }

function straightHigh(valsDesc) {
  if (valsDesc.length !== 5) return 0;
  if (valsDesc[0] === 14 && valsDesc[1] === 5 && valsDesc[2] === 4 && valsDesc[3] === 3 && valsDesc[4] === 2) return 5;
  for (let i = 0; i < 4; i++) if (valsDesc[i] - 1 !== valsDesc[i + 1]) return 0;
  return valsDesc[0];
}

export function eval5(cards) {
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(c => c.s);
  const flush = suits.every(s => s === suits[0]);
  const uniq = [...new Set(vals)];
  const sh = straightHigh(vals);
  const counts = new Map();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let cat, tie;
  if (flush && sh) { cat = 8; tie = [sh, 0, 0, 0, 0]; }
  else if (groups[0][1] === 4) { cat = 7; tie = [groups[0][0], groups[1][0], 0, 0, 0]; }
  else if (groups[0][1] === 3 && groups[1] && groups[1][1] === 2) { cat = 6; tie = [groups[0][0], groups[1][0], 0, 0, 0]; }
  else if (flush) { cat = 5; tie = vals.slice(); }
  else if (sh) { cat = 4; tie = [sh, 0, 0, 0, 0]; }
  else if (groups[0][1] === 3) {
    cat = 3;
    const kickers = groups.slice(1).map(g => g[0]).sort((a, b) => b - a);
    tie = [groups[0][0], ...kickers, 0, 0].slice(0, 5);
  }
  else if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) {
    cat = 2;
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    tie = [pairs[0], pairs[1], groups[2][0], 0, 0];
  }
  else if (groups[0][1] === 2) {
    cat = 1;
    const kickers = groups.slice(1).map(g => g[0]).sort((a, b) => b - a);
    tie = [groups[0][0], ...kickers, 0].slice(0, 5);
  }
  else { cat = 0; tie = vals.slice(); }
  return { cat, tie, name: CAT_NAMES[cat], cards: cards.slice() };
}

export function cmpEval(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < 5; i++) {
    const x = a.tie[i] || 0, y = b.tie[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const C5 = (() => {
  const out = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++)
    for (let d = c + 1; d < 7; d++) for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();

export function eval7(cards) {
  let best = null;
  let bestCards = null;
  for (const idx of C5) {
    const five = [cards[idx[0]], cards[idx[1]], cards[idx[2]], cards[idx[3]], cards[idx[4]]];
    const ev = eval5(five);
    if (!best || cmpEval(ev, best) > 0) { best = ev; bestCards = five; }
  }
  best.cards = bestCards;
  return best;
}

/* ---------- 三張牌（十三支前墩 / 炸金花） ---------- */
export function eval3(cards) {
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(c => c.s);
  const flush = suits[0] === suits[1] && suits[1] === suits[2];
  const uniq = [...new Set(vals)];
  let sh = 0;
  if (uniq.length === 3) {
    if (vals[0] === 14 && vals[1] === 3 && vals[2] === 2) sh = 3;
    else if (vals[0] - 1 === vals[1] && vals[1] - 1 === vals[2]) sh = vals[0];
  }
  let cat, tie;
  if (uniq.length === 1) { cat = 5; tie = [vals[0], 0, 0]; }
  else if (flush && sh) { cat = 4; tie = [sh, 0, 0]; }
  else if (flush) { cat = 3; tie = vals; }
  else if (sh) { cat = 2; tie = [sh, 0, 0]; }
  else if (uniq.length === 2) {
    cat = 1;
    const pair = vals[0] === vals[1] ? vals[0] : vals[1];
    const kicker = vals[0] === vals[1] ? vals[2] : vals[0];
    tie = [pair, kicker, 0];
  }
  else { cat = 0; tie = vals; }
  return { cat, tie, name: CAT3_NAMES[cat], cards: cards.slice() };
}

export function cmpEval3(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < 3; i++) {
    const x = a.tie[i] || 0, y = b.tie[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/* 把三張牌型映射到五張牌的類別，用來檢查 前墩 ≤ 中墩 */
export function cat5From3(ev3) {
  const map = [0, 1, 4, 5, 8, 3];
  return { cat: map[ev3.cat], tie: ev3.tie };
}

export function cmpScore(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const n = Math.max(a.tie.length, b.tie.length);
  for (let i = 0; i < n; i++) {
    const x = a.tie[i] || 0, y = b.tie[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function score5(ev) { return ev.cat * 100 + (ev.tie[0] || 0) * 3 + (ev.tie[1] || 0) * 0.4; }
function score3(ev) { return ev.cat * 100 + (ev.tie[0] || 0) * 3; }

function maskCards(cards, mask) {
  const out = [];
  for (let i = 0; i < cards.length; i++) if (mask & (1 << i)) out.push(cards[i]);
  return out;
}

/* 十三支：在 13 張牌所有合法排法中挑最強的一組 */
export function arrangeBest(cards, randomize = true) {
  const n = cards.length;
  const full = (1 << n) - 1;
  const ev5 = new Map();
  const ev3 = new Map();
  const masks5 = [];
  for (let m = 0; m < (1 << n); m++) {
    let bits = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) bits++;
    if (bits === 5) { masks5.push(m); ev5.set(m, eval5(maskCards(cards, m))); }
    else if (bits === 3) ev3.set(m, eval3(maskCards(cards, m)));
  }

  const top = [];
  const keep = 6;
  const pushTop = (score, entry) => {
    if (top.length < keep) { top.push({ score, entry }); top.sort((a, b) => b.score - a.score); return; }
    if (score <= top[top.length - 1].score) return;
    top[top.length - 1] = { score, entry };
    top.sort((a, b) => b.score - a.score);
  };

  for (const [fm, fev] of ev3) {
    const fScore = cat5From3(fev);
    for (const mm of masks5) {
      if (mm & fm) continue;
      const bm = full ^ fm ^ mm;
      if (!ev5.has(bm)) continue;
      const mev = ev5.get(mm);
      const bev = ev5.get(bm);
      if (cmpScore(fScore, mev) > 0) continue;
      if (cmpEval(mev, bev) > 0) continue;
      const score = score3(fev) * 0.9 + score5(mev) + score5(bev) * 1.08;
      pushTop(score, { fm, mm, bm });
    }
  }

  let chosen = top[0];
  if (!chosen) {
    // 理論上不會發生；保底用排序切牌
    const sorted = cards.slice().sort((a, b) => rankValue(b) - rankValue(a));
    return { front: sorted.slice(10, 13), mid: sorted.slice(5, 10), back: sorted.slice(0, 5) };
  }
  if (randomize && top.length > 1) {
    const pool = top.slice(0, Math.min(3, top.length));
    const r = Math.random();
    chosen = r < 0.6 ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
  }
  return {
    front: maskCards(cards, chosen.entry.fm),
    mid: maskCards(cards, chosen.entry.mm),
    back: maskCards(cards, chosen.entry.bm)
  };
}

export function rowsValid(front, mid, back) {
  if (front.length !== 3 || mid.length !== 5 || back.length !== 5) return false;
  const f = cat5From3(eval3(front));
  const m = eval5(mid);
  const b = eval5(back);
  return cmpScore(f, m) <= 0 && cmpEval(m, b) <= 0;
}

export function bonus5(ev) { return ev.cat === 8 ? 2 : ev.cat === 7 ? 1 : 0; }
export function bonus3(ev) { return ev.cat === 5 ? 1 : 0; }

export function compareRows(player, ai) {
  const pf = eval3(player.front), af = eval3(ai.front);
  const pm = eval5(player.mid), am = eval5(ai.mid);
  const pb = eval5(player.back), ab = eval5(ai.back);
  const rows = [
    { key: 'front', name: '前墩', p: pf, a: af, cmp: cmpEval3(pf, af), pName: pf.name, aName: af.name },
    { key: 'mid', name: '中墩', p: pm, a: am, cmp: cmpEval(pm, am), pName: pm.name, aName: am.name },
    { key: 'back', name: '後墩', p: pb, a: ab, cmp: cmpEval(pb, ab), pName: pb.name, aName: ab.name }
  ];
  let net = 0;
  for (const r of rows) net += Math.sign(r.cmp);
  const allWin = rows.every(r => r.cmp > 0);
  const allLose = rows.every(r => r.cmp < 0);
  if (allWin) net += 2;
  const pBonus = bonus3(pf) + bonus5(pm) + bonus5(pb);
  const aBonus = bonus3(af) + bonus5(am) + bonus5(ab);
  net += pBonus - aBonus;
  return { rows, net: Math.max(-3, Math.min(10, net)), allWin, allLose, pBonus, aBonus };
}

/* ---------- 妞妞 ---------- */
export function niuEval(cards) {
  const vals = cards.map(c => c.r === 0 ? 1 : Math.min(10, c.r + 1));
  const tens = cards.filter(c => c.r >= 9).length;
  const faces = cards.filter(c => c.r >= 10).length;
  let best = -1;
  let bestCombo = null;
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        if ((vals[i] + vals[j] + vals[k]) % 10 !== 0) continue;
        const rest = [0, 1, 2, 3, 4].filter(x => x !== i && x !== j && x !== k);
        const p = (vals[rest[0]] + vals[rest[1]]) % 10;
        const point = p === 0 ? 10 : p;
        if (point > best) { best = point; bestCombo = [i, j, k]; }
      }
    }
  }
  if (faces === 5) return { point: 10, mult: 5, name: '五公', combo: bestCombo, niu: true };
  if (tens >= 4) return { point: 10, mult: 4, name: '四花', combo: bestCombo, niu: true };
  if (best === 10) return { point: 10, mult: 3, name: '牛牛', combo: bestCombo, niu: true };
  if (best >= 7) return { point: best, mult: 2, name: '牛' + best, combo: bestCombo, niu: true };
  if (best >= 1) return { point: best, mult: 1, name: '牛' + best, combo: bestCombo, niu: true };
  return { point: 0, mult: 0, name: '無牛', combo: null, niu: false };
}

const SUIT_RANK = [4, 3, 2, 1]; // ♠ > ♥ > ♦ > ♣
export function niuHigh(cards) {
  const sorted = cards.slice().sort((a, b) => {
    const va = a.r === 0 ? 1 : a.r + 1;
    const vb = b.r === 0 ? 1 : b.r + 1;
    if (va !== vb) return vb - va;
    return SUIT_RANK[b.s] - SUIT_RANK[a.s];
  });
  return sorted[0];
}

/* 回傳 >0 表示 a 贏 */
export function compareNiu(aCards, bCards) {
  const a = niuEval(aCards);
  const b = niuEval(bCards);
  if (a.mult !== b.mult) return a.mult - b.mult;
  if (a.point !== b.point) return a.point - b.point;
  const ah = niuHigh(aCards);
  const bh = niuHigh(bCards);
  const av = ah.r === 0 ? 1 : ah.r + 1;
  const bv = bh.r === 0 ? 1 : bh.r + 1;
  if (av !== bv) return av - bv;
  return SUIT_RANK[ah.s] - SUIT_RANK[bh.s];
}
