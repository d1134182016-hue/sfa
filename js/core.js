import { checkStory } from './story.js';

export const SAVE_KEY = 'jinhe.casino.v1';

export const START_CASH = 300000;
export const START_DEBT = 10000000;
export const SHARK_DAILY = 0.02;
export const BANK_DAILY = 0.006;
export const SHARK_LIMIT = 12000000;
export const BANK_LIMIT = 8000000;
export const BAD_DEBT = 30000000;
export const INITIAL_DUE_DAY = 14;

export const DEFAULT_LIVESTOCK = [
  { id: 'ryota', mult: 1, lastPaidDay: 0 },
  { id: 'mira', mult: 1, lastPaidDay: 0 },
  { id: 'nozomi', mult: 1.2, lastPaidDay: 0 },
  { id: 'ouri', mult: 1, lastPaidDay: 0 },
  { id: 'ibara', mult: 1.5, lastPaidDay: 0 },
  { id: 'rin', mult: 1, lastPaidDay: 0 }
];

const DEFAULT_ADMIN = () => ({
  tribute: 100000,
  treasury: 0,
  oversight: 0,
  prestige: 12,
  eventsDay: 0,
  appointee: null,
  neutralDissolved: false,
  livestock: DEFAULT_LIVESTOCK.map(e => ({ ...e }))
});

const DEFAULT_STATE = () => ({
  version: 4,
  started: false,
  cash: START_CASH,
  shark: START_DEBT,
  bank: 0,
  credit: 50,
  day: 1,
  minutes: 20 * 60,
  dueDay: INITIAL_DUE_DAY,
  warnCount: 0,
  repaidToday: 0,
  chapter: 0,
  formulaFoe: null,
  councilAttempts: 0,
  councilLosses: 0,
  councilJoined: false,
  councilRank: '',
  isPresident: false,
  livestock: false,
  coupActive: false,
  coupCleared: [],
  coupMomentum: 0,
  admin: DEFAULT_ADMIN(),
  pachinko: { slots: 9, maxMult: 4, minMult: 0, balls: 1 },
  people: {},
  cheat: { day: 0, today: 0, total: 0, caught: 0 },
  flags: {
    introDone: false,
    ch1: false,
    ch2: false,
    paid: false,
    bankUnlocked: false,
    tipGiven: false,
    collectorSeen: false,
    formulaSeen: false,
    formulaCleared: false,
    debtClearedSeen: false,
    joinPromptSeen: false,
    joinWinSeen: false,
    joinLoseSeen: false,
    schoolIntroSeen: false,
    coupWinSeen: false,
    coupLoseSeen: false
  },
  stats: { rounds: 0, wins: 0, bestWin: 0, repaid: 0, borrowed: 0 },
  journal: [],
  settings: { sound: true },
  holdemStack: 0,
  holdemBuyin: 0,
  ending: null,
  endingReason: null,
  locked: false
});

export const state = DEFAULT_STATE();

export const router = { current: 'lobby', go: () => {} };

export const events = {
  map: {},
  on(name, fn) {
    (this.map[name] || (this.map[name] = [])).push(fn);
  },
  emit(name, data) {
    const list = this.map[name];
    if (!list) return;
    for (const fn of list) {
      try { fn(data); } catch (e) { console.error('[event]', name, e); }
    }
  }
};

/* ---------- 基本工具 ---------- */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function money(n) {
  return Math.round(n).toLocaleString('en-US');
}
export function fmt(n) {
  const v = Math.round(n);
  return (v < 0 ? '-NT$ ' : 'NT$ ') + Math.abs(v).toLocaleString('en-US');
}
export function fmtShort(n) {
  const v = Math.round(Math.abs(n));
  if (v >= 100000000) return (v / 100000000).toFixed(v % 100000000 === 0 ? 0 : 1) + ' 億';
  if (v >= 10000) return (v / 10000).toFixed(v % 10000 === 0 ? 0 : 1) + ' 萬';
  return v.toLocaleString('en-US');
}

export function totalDebt() { return Math.max(0, Math.round(state.shark + state.bank)); }
export function sharkAvailable() { return Math.max(0, SHARK_LIMIT - Math.round(state.shark)); }
export function bankAvailable() { return Math.max(0, BANK_LIMIT - Math.round(state.bank)); }
export function bankReady() { return !!state.flags.bankUnlocked && state.credit >= 50; }
export function clockText() {
  const h = Math.floor(state.minutes / 60);
  const m = Math.floor(state.minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function interestPreview() {
  return {
    shark: Math.round(state.shark * SHARK_DAILY),
    bank: Math.round(state.bank * BANK_DAILY)
  };
}
export function chapterName() {
  return ['序章 · 家畜', '第一章 · 反咬', '第二章 · 公式戰', '第三章 · 命運', '第四章 · 學生會', '第五章 · 政變'][state.chapter] || '序章 · 家畜';
}

/* ---------- 存檔 ---------- */
let saveTimer = 0;
export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const el = document.getElementById('save-state');
    if (el) {
      el.textContent = '已自動存檔 · ' + clockText();
      el.style.color = 'rgba(232,194,106,.55)';
    }
  } catch (e) { console.warn('存檔失敗', e); }
}
export function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}
export function hasSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!data && data.version >= 2 && data.version <= 4;
  } catch (e) { return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return false;
    const ver = Number(data.version);
    if (ver < 2 || ver > 4) {
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
    resetState();
    Object.assign(state, data);
    state.version = 4;
    state.formulaFoe = typeof data.formulaFoe === 'string' ? data.formulaFoe : null;
    state.councilAttempts = Math.max(0, Number(data.councilAttempts) || 0);
    state.councilLosses = Math.max(0, Number(data.councilLosses) || 0);
    state.councilJoined = !!data.councilJoined;
    state.councilRank = typeof data.councilRank === 'string' ? data.councilRank : '';
    state.isPresident = !!data.isPresident;
    state.livestock = !!data.livestock;
    state.coupActive = !!data.coupActive;
    state.coupCleared = Array.isArray(data.coupCleared) ? data.coupCleared.filter(i => Number.isInteger(i) && i >= 0 && i < 5) : [];
    state.coupMomentum = Math.max(0, Number(data.coupMomentum) || 0);
    const defAdmin = DEFAULT_ADMIN();
    state.admin = Object.assign({}, defAdmin, data.admin || {});
    if (!Array.isArray(state.admin.livestock)) state.admin.livestock = defAdmin.livestock;
    state.admin.livestock = state.admin.livestock
      .filter(e => e && typeof e.id === 'string')
      .map(e => ({ id: e.id, mult: clamp(Number(e.mult) || 1, 0.5, 3), lastPaidDay: Math.max(0, Number(e.lastPaidDay) || 0) }));
    state.admin.tribute = clamp(Number(state.admin.tribute) || 100000, 10000, 5000000);
    state.pachinko = Object.assign({}, DEFAULT_STATE().pachinko, data.pachinko || {});
    state.people = (data.people && typeof data.people === 'object') ? data.people : {};
    state.cheat = Object.assign({ day: 0, today: 0, total: 0, caught: 0 }, data.cheat || {});
    state.flags = Object.assign({}, DEFAULT_STATE().flags, data.flags || {});
    state.stats = Object.assign({}, DEFAULT_STATE().stats, data.stats || {});
    state.settings = Object.assign({}, DEFAULT_STATE().settings, data.settings || {});
    state.journal = Array.isArray(data.journal) ? data.journal.slice(0, 160) : [];
    if (ver < 3) {
      // 改版後重看新劇情；金錢、債務與既有進度保留
      state.flags.introDone = false;
    }
    if (ver < 4 && state.ending === 'good') {
      // 舊版「清償即結局」的存檔，改成可以繼續挑戰會長
      state.ending = null;
      state.endingReason = null;
      state.flags.paid = true;
      state.flags.debtClearedSeen = true;
    }
    if (ver < 4) save();
    sound.enabled = !!state.settings.sound;
    return true;
  } catch (e) {
    console.warn('讀檔失敗', e);
    return false;
  }
}
export function resetState() {
  const fresh = DEFAULT_STATE();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
}
export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
}
export function startNewGame() {
  resetState();
  state.started = true;
  sound.enabled = true;
  save();
  refreshHud();
}

/* ---------- 金錢與欠款 ---------- */
export function addCash(n, opts = {}) {
  const change = Math.round(n);
  state.cash = Math.round(state.cash + change);
  if (!opts.silent) {
    if (change > 0) {
      state.stats.wins += 1;
      state.stats.bestWin = Math.max(state.stats.bestWin, change);
    }
    save();
    refreshHud();
  }
  return change;
}

export function spendCash(n) {
  const v = Math.round(n);
  if (v <= 0) return true;
  if (state.cash < v) return false;
  state.cash -= v;
  save();
  refreshHud();
  return true;
}

export function recordRound(win, gain) {
  state.stats.rounds += 1;
  if (win > 0) {
    state.stats.wins += 1;
    state.stats.bestWin = Math.max(state.stats.bestWin, Math.round(win));
  }
  saveSoon();
}

export function payDebt(amount, which = 'auto') {
  let left = Math.max(0, Math.round(amount));
  const debt = totalDebt();
  left = Math.min(left, Math.round(state.cash), debt);
  if (left <= 0) return 0;
  let paid = 0;
  const order = which === 'bank' ? ['bank', 'shark'] : ['shark', 'bank'];
  for (const key of order) {
    if (left <= 0) break;
    const take = Math.min(left, Math.round(state[key]));
    state[key] -= take;
    left -= take;
    paid += take;
  }
  state.cash -= paid;
  state.repaidToday += paid;
  state.stats.repaid += paid;
  state.credit = clamp(state.credit + Math.max(1, Math.floor(paid / 200000)), 0, 100);
  logEvent(`還款 ${fmt(paid)}。剩餘欠款 ${fmt(totalDebt())}。`);
  sound.chip();
  save();
  refreshHud();
  events.emit('money', { paid });
  events.emit('repaid', { paid });
  checkStory();
  return paid;
}

export function borrowMoney(source, amount) {
  const amt = Math.round(amount);
  if (amt <= 0) return { ok: false, msg: '金額錯誤。' };
  if (source === 'shark') {
    if (amt > sharkAvailable()) return { ok: false, msg: '學生會不願意再借這麼多。' };
    const fee = Math.round(amt * 0.03);
    state.shark += amt;
    state.cash += amt - fee;
    state.stats.borrowed += amt;
    state.credit = clamp(state.credit - 1, 0, 100);
    logEvent(`向學生會借款 ${fmt(amt)}（手續費 ${fmt(fee)}）。`, 'warn');
    sound.chip();
    save(); refreshHud();
    events.emit('money', { borrowed: amt });
    return { ok: true, msg: `借到 ${fmt(amt - fee)}，手續費 ${fmt(fee)}。` };
  }
  if (!bankReady()) return { ok: false, msg: '理事會尚未核准你的融資。' };
  if (amt > bankAvailable()) return { ok: false, msg: '超過理事會核貸額度。' };
  state.bank += amt;
  state.cash += amt;
  state.stats.borrowed += amt;
  logEvent(`向理事會融資 ${fmt(amt)}。`);
  sound.chip();
  save(); refreshHud();
  events.emit('money', { borrowed: amt });
  return { ok: true, msg: `銀行撥款 ${fmt(amt)}。` };
}

/* ---------- 時間與利息 ---------- */
export function advanceTime(minutes) {
  state.minutes += Math.max(0, Math.round(minutes));
  let days = 0;
  while (state.minutes >= 1440) {
    state.minutes -= 1440;
    state.day += 1;
    days += 1;
    onNewDay();
  }
  if (days === 0) { saveSoon(); refreshHud(); }
}

function onNewDay() {
  const interestShark = Math.round(state.shark * SHARK_DAILY);
  const interestBank = Math.round(state.bank * BANK_DAILY);
  state.shark += interestShark;
  state.bank += interestBank;

  const paidYesterday = state.repaidToday > 0;
  state.credit = clamp(state.credit + (paidYesterday ? 2 : -2), 0, 100);
  state.repaidToday = 0;

  let msg = '';
  if (interestShark + interestBank > 0) {
    msg = `第 ${state.day} 天利息 +${fmt(interestShark + interestBank)}`;
  }

  let collect = null;
  if (state.shark > 0 && state.day >= state.dueDay) {
    if (paidYesterday) {
      state.dueDay = state.day + 5;
      logEvent(`你有按時還款，學生會把期限延到第 ${state.dueDay} 天。`);
    } else {
      const penalty = Math.round(state.shark * 0.04);
      state.shark += penalty;
      state.dueDay = state.day + 5;
      state.warnCount += 1;
      collect = { penalty, warn: state.warnCount };
      logEvent(`學生會催收：違約金 ${fmt(penalty)}，期限延到第 ${state.dueDay} 天。`, 'warn');
      toast(`學生會派人來催收：違約金 ${fmt(penalty)}（第 ${state.warnCount} 次）`, 'warn');
      events.emit('collector', collect);
    }
  }
  if (interestShark + interestBank > 0) {
    logEvent(msg);
    toast(msg, 'info');
  }

  if (state.councilJoined && !state.admin.neutralDissolved) {
    const pressure = state.admin.tribute >= 1000000 ? 3 : state.admin.tribute >= 300000 ? 1 : 0;
    if (pressure > 0) {
      const before = state.admin.oversight;
      state.admin.oversight = clamp(state.admin.oversight + pressure, 0, 100);
      if (state.admin.oversight > before) {
        logEvent(`每月繳納金過高，絕對中立委員會審查 +${state.admin.oversight - before}。`, 'warn');
        if (before < 80 && state.admin.oversight >= 80) {
          toast('絕對中立委員會開始注意學生會的帳。', 'warn', 4200);
        }
      }
    }
  }

  save();
  refreshHud();
  events.emit('day', { day: state.day, collect });
  checkEnding();
  checkStory();
}

/* ---------- 結局 ---------- */
export function checkEnding() {
  if (state.ending === 'bad' || state.locked) return;
  if (totalDebt() >= BAD_DEBT) triggerBadEnding('debt');
  else if (state.warnCount >= 3) triggerBadEnding('collector');
}

export function triggerBadEnding(reason) {
  if (state.ending === 'bad') return;
  state.ending = 'bad';
  state.locked = true;
  save();
  events.emit('ending', { kind: 'bad', reason });
}

export function triggerGoodEnding(reason = 'repay') {
  if (state.ending === 'good') return;
  state.ending = 'good';
  state.endingReason = reason;
  state.chapter = 3;
  state.flags.paid = true;
  save();
  refreshHud();
  events.emit('ending', { kind: 'good', reason });
}

/* ---------- HUD ---------- */
const anim = new WeakMap();
export function countUp(el, to, ms = 520, formatter = fmt) {
  if (!el) return;
  const from = Number(el.dataset.v ?? to);
  if (!isFinite(from)) { el.textContent = formatter(to); el.dataset.v = to; return; }
  if (from === to) { el.textContent = formatter(to); return; }
  el.dataset.v = to;
  const start = performance.now();
  const prev = anim.get(el);
  if (prev) cancelAnimationFrame(prev);
  const tick = (now) => {
    const t = clamp((now - start) / ms, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (to - from) * eased;
    el.textContent = formatter(v);
    if (t < 1) anim.set(el, requestAnimationFrame(tick));
    else { el.textContent = formatter(to); anim.delete(el); }
  };
  anim.set(el, requestAnimationFrame(tick));
}

export function refreshHud() {
  countUp(document.getElementById('hud-cash'), state.cash);
  countUp(document.getElementById('hud-debt'), totalDebt());
  const t = document.getElementById('hud-time');
  if (t) t.textContent = `第 ${state.day} 天 ${clockText()}`;
  const c = document.getElementById('hud-credit');
  if (c) c.textContent = Math.round(state.credit);
  const cf = document.getElementById('hud-credit-fill');
  if (cf) cf.style.width = clamp(state.credit, 0, 100) + '%';

  const ip = interestPreview();
  const daily = ip.shark + ip.bank;
  const intEl = document.getElementById('hud-interest');
  if (intEl) intEl.textContent = '+ ' + fmt(daily);
  const pct = clamp((1 - totalDebt() / START_DEBT) * 100, 0, 100);
  const df = document.getElementById('hud-debt-fill');
  if (df) df.style.width = pct + '%';
  const dueEl = document.getElementById('hud-due');
  if (dueEl) {
    const days = state.dueDay - state.day;
    dueEl.textContent = totalDebt() <= 0 ? '已清償' : days <= 2 ? `退學倒數 ${Math.max(0, days)} 天` : '期限第 ' + state.dueDay + ' 天';
    dueEl.classList.toggle('warn', totalDebt() > 0 && days <= 2);
  }

  const soundBtn = document.getElementById('btn-sound');
  if (soundBtn) {
    soundBtn.textContent = sound.enabled ? '♪' : '×';
    soundBtn.style.opacity = sound.enabled ? '1' : '.5';
  }

  const lbDebt = document.getElementById('lobby-debt');
  if (lbDebt) lbDebt.textContent = totalDebt() <= 0 ? '已清償' : '欠款 ' + fmt(totalDebt());
  const due = document.getElementById('lobby-due');
  if (due) {
    due.textContent = totalDebt() <= 0
      ? (state.isPresident ? '現任學生會長' : state.councilJoined ? '學生會成員 · 政變待發動' : '下一步：挑戰會長')
      : `退學期限：第 ${state.dueDay} 天`;
  }
  const fill = document.getElementById('debt-fill');
  if (fill) fill.style.width = clamp(totalDebt() / START_DEBT * 100, 0, 100) + '%';
  const chap = document.getElementById('lobby-chapter');
  if (chap) chap.textContent = chapterName();
  const wins = document.getElementById('hero-wins');
  if (wins) wins.textContent = state.stats.wins;
  countUp(document.getElementById('hero-best'), state.stats.bestWin);
  const goal = document.getElementById('hero-goal');
  if (goal) {
    goal.textContent = state.isPresident ? '管理學園，改寫規矩'
      : state.councilJoined ? '發動政變，坐上會長之位'
      : totalDebt() <= 0 ? '挑戰會長，加入學生會'
      : state.livestock ? '從家畜名冊爬回來'
      : totalDebt() <= 2500000 ? '把最後的尾巴收乾淨'
      : totalDebt() <= 5000000 ? '先砍掉一半'
      : '先從家畜名單爬出來';
  }
  const prog = document.getElementById('hero-progress');
  if (prog) prog.textContent = Math.round(pct) + '%';
  const hd = document.getElementById('hero-daily');
  if (hd) hd.textContent = '+' + fmt(daily);

  const rank = document.getElementById('hud-rank');
  if (rank) {
    const text = state.isPresident ? '學生會會長' : state.councilJoined ? '學生會' : state.livestock ? '家畜' : '學生';
    rank.textContent = text;
    rank.classList.remove('hidden');
    rank.classList.toggle('president', state.isPresident);
  }
  const navSchool = document.querySelector('.nav-item[data-view="school"]');
  if (navSchool) {
    navSchool.classList.toggle('locked', !state.councilJoined && !state.isPresident);
    const tag = navSchool.querySelector('em');
    if (tag) tag.textContent = state.isPresident ? '會長' : state.councilJoined ? '管理' : '未解鎖';
  }
  const more = document.getElementById('council-more');
  if (more) more.textContent = (state.councilJoined || state.isPresident) ? '學生會室' : '進入學生會';
  const note = document.getElementById('council-head-note');
  if (note) {
    note.textContent = state.isPresident
      ? '你是現任會長。學生會五席、全校名冊與校庫都在你手上。'
      : state.councilJoined
        ? '你已是學生會成員。前往學生會室管理學園，或發動政變奪下會長之位。'
        : totalDebt() <= 0
          ? '債務已清。挑戰會長，加入學生會。'
          : '五位成員任你挑一位，下注沒有上限。贏了，家畜債務一筆勾銷。';
  }

  renderJournal();
  updateLobbyTip();
}

let tipIndex = 0;
const TIPS = [
  '「輸錢不可怕。可怕的是，你開始覺得輸赢都無所謂。」—— 蛇喰夢子',
  '「學生會的利息不是算法，是規矩。規矩是他們寫的。」—— 早乙女芽亞里',
  '「21 點的莊家會停在 17 點。你只要比它更靠近 21，不用更勇敢。」',
  '「拉霸的賠率寫在旁邊。看清楚了再拉，沒人會替你心疼。」',
  '「妞妞的莊家贏同點。想贏，就得比學生會更硬。」',
  '「十三支排錯順序，牌再好都不算。前墩不能比後墩大。」',
  '「德州撲克不是比誰的牌大，是比誰先讓對方相信你更大。」',
  '「理事會的利息低，但他們會查你到底還不還得起。」',
  '「骰寶的豹子很香，但你要先活過每一次大小。」',
  '「小鋼珠的釘子不會可憐你，力道和角度才是真的。」',
  '「刮刮樂是把希望印在紙上，再叫你拿硬幣刮掉。」',
  '「三張牌，莊家沒 Q 就不算成局——這是規則，不是善意。」',
  '「二人麻將沒有隊友，只有你先胡還是她先胡。」',
  '「公式戰贏了只是把債還完。想坐進學生會，得先過會長那一關。」—— 五十嵐清華',
  '「每月繳納金是規矩，也是你能動的第一個數字。調太高，絕對中立委員會就會來。」—— 早乙女芽亞里',
  '「政變沒有順序，只有結果。五席全倒，規矩就換你寫。」—— 桃喰綺羅莉',
  '「中立不是善意，是還沒有人給他們足夠的理由。」—— 黄泉月露娜',
  '「小鋼珠一次投多顆，心臟也要多幾顆。」',
  '「家畜的名冊很長。你可以讓人少一個名字，也可以讓它更長。」'
];
function updateLobbyTip() {
  const el = document.getElementById('lobby-tip');
  if (el) el.textContent = TIPS[(state.day + tipIndex) % TIPS.length];
}
export function nextTip() { tipIndex++; updateLobbyTip(); }

export function renderJournal() {
  const list = document.getElementById('lobby-journal');
  const count = document.getElementById('journal-count');
  if (!list) return;
  if (count) count.textContent = state.journal.length + ' 則';
  if (!state.journal.length) {
    list.innerHTML = '<div class="journal-empty">學園記事本還是空的。去賭桌坐坐吧。</div>';
    return;
  }
  list.innerHTML = state.journal.slice(0, 24).map(j =>
    `<div class="journal-item ${j.type === 'warn' ? 'warn' : ''}"><span class="jd">D${j.day} ${j.time}</span><span>${esc(j.text)}</span></div>`
  ).join('');
}

export function logEvent(text, type = 'info') {
  state.journal.unshift({ day: state.day, time: clockText(), text, type });
  if (state.journal.length > 160) state.journal.length = 160;
  const list = document.getElementById('lobby-journal');
  if (list) renderJournal();
  saveSoon();
}

/* ---------- Toast / Modal ---------- */
export function toast(message, type = 'info', ms = 3600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

let closeActiveModal = null;

export function openModal(opts = {}) {
  if (closeActiveModal) {
    const prev = closeActiveModal;
    closeActiveModal = null;
    prev();
  }
  const root = document.getElementById('overlay-root');
  root.classList.add('on');
  root.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}">
      <h2>${esc(opts.title || '')}</h2>
      <div class="modal-body">${opts.html || ''}</div>
      <div class="modal-actions"></div>
    </div>`;
  root.appendChild(backdrop);
  const actions = backdrop.querySelector('.modal-actions');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (closeActiveModal === close) closeActiveModal = null;
    root.classList.remove('on');
    root.innerHTML = '';
    if (opts.onClose) opts.onClose();
  };
  closeActiveModal = close;
  const buttons = opts.buttons || [{ label: '關閉' }];
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.kind || 'ghost');
    btn.textContent = b.label;
    btn.onclick = () => {
      sound.click();
      if (b.onClick) b.onClick();
      if (!b.keepOpen) close();
    };
    actions.appendChild(btn);
  });
  if (opts.dismissible !== false) {
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  }
  setTimeout(() => {
    const first = actions.querySelector('.btn');
    if (first) first.focus();
  }, 30);
  return close;
}

export function confirmDialog(title, text, okLabel = '確定', danger = false) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => {
      if (done) return;
      done = true;
      resolve(v);
    };
    openModal({
      title,
      html: `<p>${esc(text)}</p>`,
      dismissible: true,
      onClose: () => finish(false),
      buttons: [
        { label: '取消', kind: 'ghost', onClick: () => finish(false) },
        { label: okLabel, kind: danger ? 'danger' : 'gold', onClick: () => finish(true) }
      ]
    });
  });
}

/* ---------- 下注拉條 ---------- */
export function mountBetRange(host, opts = {}) {
  if (!host) return { sync: () => {}, setDisabled: () => {}, get value() { return 0; } };
  const {
    label = '下注金額',
    min = 0,
    step = 1000,
    max = () => 0,
    value = 0,
    onChange = () => {}
  } = opts;

  host.classList.add('bet-range-host');
  host.innerHTML = `
    <div class="br-top">
      <span class="br-label">${esc(label)}</span>
      <span class="br-val" data-val>${fmt(min)}</span>
    </div>
    <div class="br-input-row">
      <button type="button" class="br-step" data-step="-1" aria-label="減少">−</button>
      <input class="bet-input" type="number" inputmode="numeric" min="${min}" step="${step}" value="${min}">
      <button type="button" class="br-step" data-step="1" aria-label="增加">＋</button>
    </div>
    <div class="br-ticks">
      <button type="button" class="br-tick" data-mult="0">最小</button>
      <button type="button" class="br-tick" data-mult="0.25">¼</button>
      <button type="button" class="br-tick" data-mult="0.5">½</button>
      <button type="button" class="br-tick" data-mult="1">全押</button>
    </div>`;

  const input = host.querySelector('.bet-input');
  const valEl = host.querySelector('[data-val]');
  let current = min;
  let maxV = min;

  const roundToStep = (n) => {
    const v = Math.round(n / step) * step;
    return Math.max(min, Math.min(v, maxV));
  };
  const render = () => {
    valEl.textContent = fmt(current);
    input.value = String(current);
  };
  const emit = () => { onChange(current); render(); };

  input.oninput = () => {
    const raw = Number(input.value);
    if (!Number.isFinite(raw)) return;
    current = roundToStep(raw);
    valEl.textContent = fmt(current);
    onChange(current);
  };
  input.onchange = () => {
    current = roundToStep(Number(input.value) || min);
    render();
    onChange(current);
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { input.blur(); }
  };
  host.querySelectorAll('[data-step]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      current = roundToStep(current + Number(btn.dataset.step) * step);
      emit();
    };
  });
  host.querySelectorAll('[data-mult]').forEach(btn => {
    btn.onclick = () => {
      const m = Number(btn.dataset.mult);
      sound.click();
      current = m === 0 ? min : roundToStep(min + (maxV - min) * m);
      emit();
    };
  });

  function sync(v) {
    maxV = Math.max(min, Math.round(max() / step) * step);
    input.max = String(Math.max(min + step, maxV));
    if (v === undefined || v === null) current = clamp(current, min, maxV);
    else current = roundToStep(v);
    render();
  }
  function setDisabled(on) {
    input.disabled = !!on;
    host.querySelectorAll('button').forEach(b => { b.disabled = !!on; });
    host.classList.toggle('disabled', !!on);
  }

  sync(value);
  return { sync, setDisabled, get value() { return current; } };
}

/* ---------- 特效 ---------- */
export function floatText(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = 'float-text ' + cls;
  el.textContent = text;
  el.style.left = (x ?? window.innerWidth / 2) + 'px';
  el.style.top = (y ?? window.innerHeight / 2) + 'px';
  el.style.transform = 'translate(-50%, -50%)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function coinBurst(x, y, count = 14) {
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'coin';
    c.style.left = (x ?? window.innerWidth / 2) + 'px';
    c.style.top = (y ?? window.innerHeight / 2) + 'px';
    c.style.setProperty('--dx', (rnd(-120, 120)).toFixed(0) + 'px');
    c.style.setProperty('--dy', (rnd(-110, 90)).toFixed(0) + 'px');
    c.style.animationDelay = rnd(0, 0.12).toFixed(2) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1200);
  }
}

export function burstFrom(el, count = 16) {
  const r = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  coinBurst(r.left + r.width / 2, r.top + r.height / 2, count);
}

/* ---------- 音效 ---------- */
class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
  }
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.28;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { }
  }
  setEnabled(on) {
    this.enabled = !!on;
    state.settings.sound = this.enabled;
    save();
    refreshHud();
  }
  tone(freq, dur = 0.08, type = 'sine', gain = 0.05, slideTo = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { }
  }
  noise(dur = 0.08, gain = 0.05, cutoff = 1800, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    try {
      const rate = this.ctx.sampleRate;
      const len = Math.max(1, Math.floor(rate * dur));
      const buf = this.ctx.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = cutoff;
      f.Q.value = 0.9;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(this.master);
      src.start(this.ctx.currentTime + delay);
    } catch (e) { }
  }
  click() { this.tone(640, 0.03, 'square', 0.02); }
  card() { this.noise(0.075, 0.055, 2400); this.tone(320, 0.04, 'sine', 0.012, 220); }
  flip() { this.noise(0.05, 0.04, 1200); }
  chip() { this.tone(1180, 0.035, 'triangle', 0.035); this.tone(860, 0.05, 'triangle', 0.028, null, 0.045); }
  dealAll(n = 3) { for (let i = 0; i < n; i++) this.card(); }
  win(big = false) {
    const notes = big ? [523, 659, 784, 1046, 1318] : [523, 659, 784];
    notes.forEach((f, i) => this.tone(f, 0.16, 'triangle', big ? 0.06 : 0.042, null, i * 0.075));
    if (big) [1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.035, null, 0.4 + i * 0.1));
  }
  lose() { this.tone(200, 0.22, 'sawtooth', 0.035, 90); this.noise(0.16, 0.03, 500, 0.02); }
  push() { this.tone(420, 0.08, 'sine', 0.03); this.tone(420, 0.08, 'sine', 0.025, null, 0.11); }
  jackpot() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.2, 'square', 0.035, null, i * 0.08));
    this.noise(0.4, 0.05, 3000, 0.1);
  }
  reelStop() { this.tone(160, 0.05, 'square', 0.03); this.noise(0.04, 0.03, 900); }
  alarm() { this.tone(880, 0.18, 'square', 0.035, 620); this.tone(880, 0.18, 'square', 0.035, 620, 0.22); }
}
export const sound = new Sound();

/* ---------- 其他 ---------- */
const CHEAT_GAMES = [
  'blackjack', 'niuniu', 'setpoker', 'threecard', 'holdem', 'mahjong', 'votingscissors'
];
const CHEAT_RULES = `<h3>老千 · 指定下一張</h3><ul>
  <li>卡牌桌右下角有「老千」按鈕：指定下一張牌、下一張摸到的牌，或下一張打出的手勢。</li>
  <li>基礎被逮風險 <b>15%</b>；當天每多用一次 <b>+7%</b>，最高 55%。</li>
  <li>成功：中立委員會審查度 <b>+5</b>。</li>
  <li>失敗：罰金 <b>max(25,000, 注碼 × 2)</b>，審查度 <b>+24</b>、威望 <b>−4</b>；現金不足的罰金會記進欠款。</li>
  <li>若審查度因此衝到 100，立刻觸發緊急審查：沒收 30% 現金、威望 −10，學生會資格撤銷。</li>
  <li>風險在每天午夜結算後重置。</li>
</ul>`;

export function openRules(kind) {
  const rules = {
    blackjack: `<h3>21 點</h3><ul>
      <li>目標：手牌點數比莊家更接近 21，且不超過。</li>
      <li>J、Q、K 算 10 點；A 可算 1 或 11 點。</li>
      <li>莊家 17 點（含軟 17）停牌。</li>
      <li>前兩張牌可「加倍」：多押一倍，只補一張牌。</li>
      <li>天生 21 點（Blackjack）賠 3:2。</li>
      <li>牌靴 6 副牌，剩不到 20% 時重新洗牌。</li>
    </ul>`,
    niuniu: `<h3>妞妞</h3><ul>
      <li>每人 5 張牌，找出 3 張點數和為 10 的倍數。</li>
      <li>剩下 2 張的和取個位數，就是「牛幾」；個位為 0 是「牛牛」。</li>
      <li>J、Q、K 算 10 點，A 算 1 點。</li>
      <li>找不到組合即「無牛」，直接輸。</li>
      <li>賠率：牛 1–6 賠 1 倍、牛 7–9 賠 2 倍、牛牛賠 3 倍。</li>
      <li>四花賠 4 倍（四張 10 點牌），五公賠 5 倍（五張 JQK）。</li>
      <li>同點數比最大單牌，再比花色；完全相同莊家贏。</li>
    </ul>`,
    slots: `<h3>拉霸機</h3><ul>
      <li>3 輪 × 3 列，共 5 條連線（三橫線＋兩對角）。</li>
      <li>每線押注相同；總投注 = 每線押注 × 5。</li>
      <li>連線三個相同符號即中獎，賠率依符號而定。</li>
      <li>前兩輪都是櫻桃或檸檬，也有小獎。</li>
      <li>每線獨立計算，可同時多線中獎。</li>
    </ul>`,
    setpoker: `<h3>十三支（Set Poker）</h3><ul>
      <li>每人 13 張牌，分成前墩 3 張、中墩 5 張、後墩 5 張。</li>
      <li>牌型必須「前墩 ≤ 中墩 ≤ 後墩」，否則不能確認。</li>
      <li>三張牌型大小：豹子 &gt; 同花順 &gt; 同花 &gt; 順子 &gt; 對子 &gt; 散牌。</li>
      <li>逐墩比大小，贏一墩 +1、輸一墩 −1、平手 0。</li>
      <li>三墩全勝「全壘打」額外 +2。</li>
      <li>後墩／中墩鐵支 +1、同花順 +2；前墩豹子 +1。</li>
      <li>結算倍率上限：贏最多 9 倍、輸最多 3 倍。</li>
    </ul>`,
    holdem: `<h3>德州撲克</h3><ul>
      <li>4 人桌，買入 25 萬／100 萬／250 萬／500 萬，盲注依買入放大（最低 1,000／2,000）。</li>
      <li>每人 2 張底牌，桌面依序發出翻牌 3 張、轉牌、河牌。</li>
      <li>每輪可蓋牌、跟注、加注或全押。</li>
      <li>攤牌時取 2 張底牌＋5 張公牌中最好的 5 張組合。</li>
      <li>牌型：同花順 &gt; 鐵支 &gt; 葫蘆 &gt; 同花 &gt; 順子 &gt; 三條 &gt; 兩對 &gt; 一對 &gt; 高牌。</li>
      <li>離桌時桌上的籌碼會換回現金。</li>
    </ul>`,
    threecard: `<h3>三張牌（Three Card Poker）</h3><ul>
      <li>玩家與莊家各發 3 張牌，先押底注；可再加對子注。</li>
      <li>看牌後可「棄牌」（輸底注）或「加注」一倍繼續。</li>
      <li>莊家 Q 以上才成局；未成局時底注賠 1 倍、加注退回。</li>
      <li>成局比牌型：同花順 &gt; 三條 &gt; 順子 &gt; 同花 &gt; 對子 &gt; 高牌。</li>
      <li>底注獎金：順子 +1、三條 +4、同花順 +5（不論輸贏）。</li>
      <li>對子注獨立派彩：對子 1:1、同花 4:1、順子 6:1、三條 30:1、同花順 40:1。</li>
    </ul>`,
    sicbo: `<h3>骰寶（Sic Bo）</h3><ul>
      <li>三顆骰子，可同時押多格，各格獨立派彩。</li>
      <li><b>大</b>：11–17；<b>小</b>：4–10。開豹子時大小單雙全輸。</li>
      <li><b>單／雙</b>：點數和為奇／偶，1:1。</li>
      <li><b>豹子</b>：三顆同點，30:1。</li>
      <li>點數和：4／17 賠 60、5／16 賠 30、6／15 賠 17、7／14 賠 12、8／13 賠 8、9–12 賠 6。</li>
      <li>賠率已含本金以外的方式計算：押 10,000 賠 1 倍即拿回 20,000。</li>
    </ul>`,
    scratch: `<h3>刮刮樂</h3><ul>
      <li>每張卡九格，橫線、直線、斜線三格相同即中獎。</li>
      <li>獎金 = 面額 × 倍率。</li>
      <li>倍率：櫻桃 0.5、檸檬 1、葡萄 2、鈴鐺 5、星星 10、幸運七 25、鑽石 100、蛇喰 500。</li>
      <li>沒有連線就沒有獎金；0.5 倍只退回一半面額。</li>
      <li>面額越高，最高獎金越大，但沒中的次數也一樣多。</li>
    </ul>`,
    pachinko: `<h3>小鋼珠</h3><ul>
      <li>調整上方落點，投下鋼珠；釘子會改變鋼珠方向。</li>
      <li>台面可自訂 <b>5／7／9／11 格</b>，倍率由外往中央遞增。</li>
      <li>最低倍率 <b>0.1×／0.5×／1×</b>；最高倍率 <b>4×／16×／64×／256×／512×</b>。</li>
      <li>可一次投 <b>1／5／10／20 顆</b>；每顆獨立計算落點與賠率，總投注 = 單顆投注 × 顆數。</li>
      <li>鋼珠落下速度較慢，可以看清釘子與落點；多顆會依序落下。</li>
      <li>獎金 = 單顆投注 × 落點倍率，四捨五入到元，最後合計派彩。</li>
      <li>中央格倍率最高，也最容易被釘子推開。</li>
      <li>倍率越高、格子越少，長期期望值越偏玩家；本作為單機娛樂。</li>
    </ul>`,
    mahjong: `<h3>二人麻將</h3><ul>
      <li>兩人各 13 張牌，輪流摸一張、打一張。</li>
      <li>胡牌：4 組順子／刻子 + 1 對將，或七對。</li>
      <li>對手打出的牌若可胡，按下「胡」即可；手上兩張相同可「碰」，碰後需打一張。</li>
      <li>自摸賠 2 倍、胡對手賠 1 倍；七對再 +1 倍。</li>
      <li>牌山摸完流局，退回底注。</li>
      <li>本桌無吃、無槓、無花牌。</li>
    </ul>`,
    votingscissors: `<h3>投票猜拳</h3><ul>
      <li>一對一。雙方各從投票箱抽三張手牌，剪刀石頭布完全隨機、可以重複。</li>
      <li>每一回合雙方同時打出一張，一般的石頭布剪刀決勝。</li>
      <li>平手：兩張牌都收起，換下一張再來。</li>
      <li>先拿下一個決勝回合的人贏；三張全平手，注碼留在桌上，重新抽三張。</li>
      <li>對手的出手習慣會寫在座位上，但那只是傾向，不保證這一局會照著做。</li>
      <li>賭的不是運氣，是你敢不敢在看見對手的習慣之後，押上下一張。</li>
    </ul>`,
    council: `<h3>公式戰 · 挑戰學生會</h3><ul>
      <li>五位學生會成員任你挑，沒有順序，也不用先擊敗誰。</li>
      <li>下注金額自訂，<b>沒有上限</b>；現金不足的部分由學生會代墊，記進你的債務。</li>
      <li>贏了：賭債全部歸零，下注金額雙倍返還。</li>
      <li>輸了：下注金額全部沒收，不會另外罰款。</li>
      <li><b>清償債務後</b>：可挑戰會長進行入會測驗。贏了加入學生會，解鎖學生會室；輸了重新成為家畜，債務回到 NT$10,000,000。</li>
      <li>加入學生會後，可管理名冊、家畜、校規與校庫；發動政變要擊敗五席（會長最後）。</li>
      <li>每場賭局：雙方各發一組牌，輪流打出一張比大小，大者贏下該回合。</li>
      <li>先贏到指定勝局數的人獲勝；<b>平手算學生會贏</b>。越難的成員，你需要的勝局越多。</li>
      <li>「洞察」可以翻開對方一張暗牌；高階成員不給你洞察。</li>
    </ul>`,
    school: `<h3>學生會室 · 管理學園</h3><ul>
      <li><b>名冊</b>：查看全校人員、學生會、絕對中立委員會與家畜，點擊可看詳細資料。</li>
      <li><b>家畜</b>：每月（7 天）可收一次月錢；可加重上納、赦免或拍賣。收入進校庫。</li>
      <li><b>校規</b>：調整每月繳納金（NT$10,000–5,000,000）。調高會增加收入，也會提高絕對中立委員會的審查度。</li>
      <li><b>校庫</b>：可撥款給自己。會員挪用會提高審查度；會長全額撥款不受審查。</li>
      <li><b>中立委員會</b>：審查度達 100 會觸發緊急審查。可協商、捐贈或主動受審來降溫。</li>
      <li><b>政變</b>：加入學生會且債務為 0 後可發動。五席可自由挑順序，會長必須最後；中途落敗會失去學生會資格並重新成為家畜。</li>
      <li><b>會長權限</b>：任命幹部、全校特赦、解散中立委員會、舉辦百喰祭。</li>
    </ul>`,
    loans: `<h3>學園債務規則</h3><ul>
      <li><b>學生會高利貸</b>：日息 2%，借款收 3% 手續費，額度上限 NT$12,000,000。</li>
      <li><b>理事會融資</b>：日息 0.6%，需解鎖且階級 ≥ 50，額度上限 NT$8,000,000。</li>
      <li>每天午夜自動計息，欠款會直接增加。</li>
      <li>還款當天階級 +2；整天沒還款階級 −2；每還 NT$200,000 再 +1。</li>
      <li>期限到未清償，學生會收 4% 違約金並延 5 天；三次就準備進家畜小屋。</li>
      <li>欠款超過 NT$30,000,000 也會直接退學。</li>
      <li><b>公式戰</b>：任挑一位學生會成員，贏了賭債一筆勾銷。</li>
      <li><b>清償後</b>：挑戰會長加入學生會；加入後可管理學園，甚至發動政變成為會長。</li>
    </ul>`
  };
  const body = rules[kind] || '<p>選擇一張賭桌開始。</p>';
  openModal({
    title: '玩法說明',
    wide: true,
    html: body + (CHEAT_GAMES.includes(kind) ? CHEAT_RULES : ''),
    buttons: [{ label: '知道了', kind: 'gold' }]
  });
}

export function openJournal() {
  const rows = state.journal.length
    ? state.journal.map(j => `<div class="journal-item ${j.type === 'warn' ? 'warn' : ''}"><span class="jd">D${j.day} ${j.time}</span><span>${esc(j.text)}</span></div>`).join('')
    : '<p>還沒有紀錄。</p>';
  openModal({
    title: '學園記事',
    wide: true,
    html: `<p style="margin-bottom:14px;color:#8f8a7e">第 ${state.day} 天 · ${clockText()} · ${chapterName()}</p><div class="journal-list" style="padding:0;max-height:none">${rows}</div>`,
    buttons: [{ label: '關閉', kind: 'gold' }]
  });
}
