import {
  state, fmt, clamp, save, refreshHud, toast, logEvent, events, router,
  openRules, openModal, confirmDialog, sound, totalDebt, esc
} from './core.js';
import { STUDENTS, studentById } from './cast.js';
import { launchCoup, COUNCIL_SEATS } from './games/council.js';
import { playNeutralAudit } from './story.js';
import { openPersonModal } from './people.js';

const root = () => document.getElementById('view-school');

const TABS = [
  { key: 'roster', label: '名冊', icon: '名' },
  { key: 'livestock', label: '家畜', icon: '畜' },
  { key: 'treasury', label: '校庫', icon: '庫' },
  { key: 'neutral', label: '中立委員會', icon: '審' },
  { key: 'coup', label: '政變', icon: '變' },
  { key: 'archive', label: '人物名鑑', icon: '鑑' }
];

let activeTab = 'roster';
let rosterFilter = 'all';
let archiveFilter = 'all';

function admin() { return state.admin; }
function isPresident() { return !!state.isPresident; }

function payReady(entry) {
  return !entry.lastPaidDay || state.day - entry.lastPaidDay >= 7;
}

function nextPayDay(entry) {
  return entry.lastPaidDay ? entry.lastPaidDay + 7 : state.day;
}

function monthlyIncome() {
  return admin().livestock.reduce((sum, e) => sum + Math.round(admin().tribute * e.mult), 0);
}

function eligibleIncome() {
  return admin().livestock.filter(payReady).reduce((sum, e) => sum + Math.round(admin().tribute * e.mult), 0);
}

function readyCount() {
  return admin().livestock.filter(payReady).length;
}

function oversightLabel(v) {
  if (admin().neutralDissolved) return '已解散';
  if (v >= 80) return '危險';
  if (v >= 50) return '注意';
  if (v >= 20) return '觀察';
  return '穩定';
}

function personCard(c, opts = {}) {
  const lv = admin().livestock.find(e => e.id === c.id);
  return `
    <button class="person-card ${opts.compact ? 'compact' : ''}" data-person="${c.id}">
      <div class="story-avatar mini ${c.cls}">${c.init}</div>
      <div class="pc-info">
        <b>${esc(c.name)}${lv ? '<em>家畜</em>' : ''}</b>
        <span>${esc(c.title)}</span>
      </div>
    </button>`;
}

function bindPersonCards(container) {
  container.querySelectorAll('[data-person]').forEach(btn => {
    btn.onclick = () => { sound.click(); openPersonModal(btn.dataset.person); };
  });
}

function afterAction() {
  save();
  refreshHud();
  renderSchoolBody();
}

function checkOversight() {
  if (admin().neutralDissolved) {
    admin().oversight = 0;
    return false;
  }
  if (admin().oversight < 100) return false;
  admin().oversight = 60;
  admin().treasury = Math.floor(admin().treasury / 2);
  admin().prestige = clamp(admin().prestige - 15, 0, 100);
  save();
  toast('絕對中立委員會緊急審查：校庫凍結一半', 'warn', 5200);
  setTimeout(() => { playNeutralAudit(); }, 320);
  return true;
}

/* ---------------- 頂部 ---------------- */

function syncSchoolTop() {
  const top = document.getElementById('school-top');
  const sub = document.getElementById('school-sub');
  if (!top) return;
  const a = admin();
  const rank = isPresident() ? '學生會長' : '學生會成員';
  const appointee = a.appointee ? ` · 幹部 ${a.appointee}` : '';
  if (sub) {
    sub.textContent = isPresident()
      ? '會長室 · 全校的規矩、名冊與帳都在你手上'
      : '成員席 · 名冊、家畜、校庫與中立委員會';
  }
  top.innerHTML = `
    <div class="school-rank">
      <div class="story-avatar you">你</div>
      <div class="sr-copy">
        <b>${rank}${esc(appointee)}</b>
        <span>第 ${state.day} 天 · 威望 ${Math.round(a.prestige)} · 審查 ${Math.round(a.oversight)}／100</span>
      </div>
      <div class="sr-tag ${isPresident() ? 'president' : ''}">${isPresident() ? '會長權限' : '成員權限'}</div>
    </div>
    <div class="school-kpis">
      <div><span>校庫</span><b>${fmt(a.treasury)}</b></div>
      <div><span>現金</span><b>${fmt(state.cash)}</b></div>
      <div><span>每月繳納金</span><b>${fmt(a.tribute)}</b></div>
      <div><span>家畜</span><b>${a.livestock.length} 人</b></div>
      <div><span>審查度</span><b class="${a.oversight >= 80 ? 'bad' : ''}">${a.neutralDissolved ? '解' : Math.round(a.oversight)}</b></div>
      <div><span>威望</span><b>${Math.round(a.prestige)}</b></div>
    </div>`;
}

/* ---------------- 分頁 ---------------- */

function tabBadge(key) {
  if (key === 'livestock') return String(admin().livestock.length);
  if (key === 'neutral') return admin().neutralDissolved ? '解' : String(Math.round(admin().oversight));
  if (key === 'coup') return `${state.coupCleared.length}／${COUNCIL_SEATS.length}`;
  if (key === 'archive') return String(STUDENTS.length);
  if (key === 'roster') return String(STUDENTS.length);
  return '';
}

function renderTabs() {
  const tabs = document.getElementById('school-tabs');
  if (!tabs) return;
  tabs.innerHTML = TABS.map(t => `
    <button class="school-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
      <span>${t.icon}</span>${t.label}${tabBadge(t.key) ? `<em>${tabBadge(t.key)}</em>` : ''}
    </button>`).join('');
  tabs.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      activeTab = btn.dataset.tab;
      renderSchoolBody();
    };
  });
}

/* ---------------- 名冊 ---------------- */

function renderRosterTab(body) {
  const filters = [
    ['all', '全部'],
    ['學生會', '學生會'],
    ['絕對中立委員會', '中立委員會'],
    ['一般學生', '一般學生'],
    ['livestock', '家畜名冊']
  ];
  let list = STUDENTS;
  if (rosterFilter === 'livestock') {
    list = admin().livestock.map(e => studentById(e.id)).filter(Boolean);
  } else if (rosterFilter !== 'all') {
    list = STUDENTS.filter(c => c.faction === rosterFilter);
  }
  const groups = rosterFilter === 'all'
    ? [
        { name: '學生會', people: list.filter(c => c.faction === '學生會') },
        { name: '絕對中立委員會', people: list.filter(c => c.faction === '絕對中立委員會') },
        { name: '一般學生', people: list.filter(c => c.faction === '一般學生') }
      ]
    : [{ name: rosterFilter === 'livestock' ? '家畜名冊' : rosterFilter, people: list }];

  body.innerHTML = `
    <div class="school-filter">
      ${filters.map(([key, label]) => `<button class="${rosterFilter === key ? 'active' : ''}" data-filter="${key}">${label}</button>`).join('')}
      <span class="school-filter-note">共 ${STUDENTS.length} 人 · 家畜 ${admin().livestock.length} 人</span>
    </div>
    ${groups.map(g => !g.people.length ? '' : `
      <div class="school-section-head"><h3>${g.name}</h3><span>${g.people.length} 人</span></div>
      <div class="person-grid">
        ${g.people.map(c => personCard(c)).join('')}
      </div>`).join('')}
    <div class="school-tip">
      · 名冊是學生會最基本的權力。誰在名冊上、誰被劃掉，都是一句話的事。<br>
      · 家畜名冊可以到「家畜」分頁收取月錢、加重上納、赦免或拍賣。<br>
      · 點擊任何一位人物，可以看到完整資料、台詞與背景。
    </div>`;

  body.querySelectorAll('[data-filter]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      rosterFilter = btn.dataset.filter;
      renderSchoolBody();
    };
  });
  bindPersonCards(body);
}

/* ---------------- 家畜 ---------------- */

function renderLivestockTab(body) {
  const a = admin();
  const rows = a.livestock.map(entry => {
    const c = studentById(entry.id) || { name: entry.id, title: '家畜', init: '畜', cls: '' };
    const amount = Math.round(a.tribute * entry.mult);
    const ready = payReady(entry);
    return `
      <div class="lv-row">
        <button class="lv-person" data-person="${entry.id}">
          <div class="story-avatar mini ${c.cls}">${c.init}</div>
          <div class="pc-info"><b>${esc(c.name)}</b><span>${esc(c.title)}</span></div>
        </button>
        <div class="lv-nums">
          <span>月錢 <b>${fmt(amount)}</b></span>
          <span>倍率 <b>×${entry.mult}</b></span>
          <span>狀態 <b class="${ready ? 'good' : 'dim'}">${ready ? '可收' : `第 ${nextPayDay(entry)} 天`}</b></span>
        </div>
        <div class="lv-actions">
          <button class="btn small ghost" data-collect="${entry.id}" ${ready ? '' : 'disabled'}>收月錢</button>
          <button class="btn small ghost" data-press="${entry.id}">加重</button>
          <button class="btn small ghost" data-release="${entry.id}">赦免</button>
          <button class="btn small danger" data-auction="${entry.id}">拍賣</button>
        </div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <div class="lv-summary">
      <div class="lv-kpi"><span>名冊人數</span><b>${a.livestock.length} 人</b></div>
      <div class="lv-kpi"><span>可收月錢</span><b>${readyCount()} 人 · ${fmt(eligibleIncome())}</b></div>
      <div class="lv-kpi"><span>預估月收入</span><b>${fmt(monthlyIncome())}</b></div>
      <div class="lv-kpi"><span>繳納金</span><b>${fmt(a.tribute)}</b></div>
    </div>
    <div class="lv-toolbar">
      <button class="btn gold" data-collect-all ${readyCount() ? '' : 'disabled'}>統一收租</button>
      <button class="btn ghost" data-enlist>招募家畜</button>
      <span class="school-filter-note">月錢會進校庫；加重上納會提高審查度。</span>
    </div>
    <div class="lv-list">
      ${rows || '<div class="journal-empty">名冊上是空的。你可以招募新的家畜，或去賭桌讓別人輸進來。</div>'}
    </div>
    <div class="school-tip">
      · 家畜每 7 天可收一次月錢，金額 = 繳納金 × 倍率。<br>
      · 「加重」每次 +0.5 倍，最高 3 倍；審查度 +3、威望 −1。<br>
      · 「赦免」把人移出名冊，威望 +2；「拍賣」一次換 6 個月月錢，審查度 +5。<br>
      · 招募一位一般學生進名冊：審查度 +8、威望 −3。名字一旦寫上去，就是一輩子的事。
    </div>`;

  bindPersonCards(body);
  body.querySelector('[data-collect-all]').onclick = () => {
    const list = a.livestock.filter(payReady);
    if (!list.length) { toast('今天沒有人可收月錢。', 'warn'); return; }
    let sum = 0;
    for (const e of list) {
      sum += Math.round(a.tribute * e.mult);
      e.lastPaidDay = state.day;
    }
    a.treasury += sum;
    sound.chip();
    logEvent(`統一收租：${list.length} 位家畜，校庫 +${fmt(sum)}。`);
    toast(`收到 ${fmt(sum)}，已進入校庫`, 'good', 4200);
    checkOversight();
    afterAction();
  };
  body.querySelector('[data-enlist]').onclick = openEnlistModal;
  body.querySelectorAll('[data-collect]').forEach(btn => {
    btn.onclick = () => {
      const e = a.livestock.find(x => x.id === btn.dataset.collect);
      if (!e || !payReady(e)) return;
      const c = studentById(e.id);
      const amount = Math.round(a.tribute * e.mult);
      a.treasury += amount;
      e.lastPaidDay = state.day;
      sound.chip();
      logEvent(`向 ${c ? c.name : e.id} 收取月錢 ${fmt(amount)}。`);
      toast(`${c ? c.name : e.id} 繳了 ${fmt(amount)}`, 'good', 3400);
      afterAction();
    };
  });
  body.querySelectorAll('[data-press]').forEach(btn => {
    btn.onclick = () => {
      const e = a.livestock.find(x => x.id === btn.dataset.press);
      if (!e) return;
      if (e.mult >= 3) { toast('已經到 3 倍上限了。', 'warn'); return; }
      const c = studentById(e.id);
      e.mult = Math.min(3, Math.round((e.mult + 0.5) * 10) / 10);
      a.oversight = clamp(a.oversight + 3, 0, 100);
      a.prestige = clamp(a.prestige - 1, 0, 100);
      sound.tone(240, 0.12, 'sawtooth', 0.03, 160);
      logEvent(`加重 ${c ? c.name : e.id} 的上納至 ×${e.mult}。`, 'warn');
      toast(`${c ? c.name : e.id} 的上納提高到 ×${e.mult}`, 'warn', 3400);
      checkOversight();
      afterAction();
    };
  });
  body.querySelectorAll('[data-release]').forEach(btn => {
    btn.onclick = () => {
      const e = a.livestock.find(x => x.id === btn.dataset.release);
      if (!e) return;
      const c = studentById(e.id);
      const name = c ? c.name : e.id;
      confirmDialog('赦免家畜', `確定把 ${name} 從家畜名冊上移除？之後就不能再收他的月錢。`, '赦免', false)
        .then(ok => {
          if (!ok) return;
          a.livestock = a.livestock.filter(x => x.id !== e.id);
          a.prestige = clamp(a.prestige + 2, 0, 100);
          logEvent(`你赦免了 ${name}，名字從家畜名冊上移除。`);
          toast(`${name} 被移出家畜名冊`, 'good', 3600);
          sound.win(false);
          afterAction();
        });
    };
  });
  body.querySelectorAll('[data-auction]').forEach(btn => {
    btn.onclick = () => {
      const e = a.livestock.find(x => x.id === btn.dataset.auction);
      if (!e) return;
      const c = studentById(e.id);
      const name = c ? c.name : e.id;
      const price = Math.round(a.tribute * e.mult * 6);
      confirmDialog('拍賣家畜', `把 ${name} 拍賣出去，一次換得 6 個月月錢 ${fmt(price)}。\n審查度 +5、威望 −2。`, '拍賣', true)
        .then(ok => {
          if (!ok) return;
          a.livestock = a.livestock.filter(x => x.id !== e.id);
          a.treasury += price;
          a.oversight = clamp(a.oversight + 5, 0, 100);
          a.prestige = clamp(a.prestige - 2, 0, 100);
          logEvent(`你拍賣了 ${name}，校庫 +${fmt(price)}。`, 'warn');
          toast(`${name} 被拍賣，校庫 +${fmt(price)}`, 'warn', 4000);
          sound.chip();
          checkOversight();
          afterAction();
        });
    };
  });
}

function openEnlistModal() {
  const pool = STUDENTS.filter(c => c.faction === '一般學生'
    && c.id !== 'yumeko' && c.id !== 'mary'
    && !admin().livestock.some(e => e.id === c.id));
  if (!pool.length) { toast('一般學生都已經在名冊上了。', 'warn'); return; }
  const shown = pool.slice(0, 24);
  const buttons = shown.map(c => ({
    label: `${c.name} · ${c.title}`,
    kind: 'ghost',
    onClick: () => enlistStudent(c.id)
  }));
  buttons.push({ label: '取消', kind: 'gold' });
  openModal({
    title: '招募家畜',
    wide: true,
    html: `<p style="color:#8f8a7e;line-height:1.8">把一位一般學生寫進家畜名冊。\n審查度 +8、威望 −3，從此他每個月都要向你繳錢。</p>
      <p style="color:#6f6a5f;font-size:12px">目前可招募 ${pool.length} 人，這裡先列出 ${shown.length} 位。其他學生可以在「人物互動」找到。</p>`,
    buttons
  });
}

function enlistStudent(id) {
  const c = studentById(id);
  if (!c) return;
  if (admin().livestock.some(e => e.id === id)) { toast('這個人已經在名冊上了。', 'warn'); return; }
  admin().livestock.push({ id, mult: 1, lastPaidDay: 0 });
  admin().oversight = clamp(admin().oversight + 8, 0, 100);
  admin().prestige = clamp(admin().prestige - 3, 0, 100);
  logEvent(`你把 ${c.name} 寫進家畜名冊。`, 'warn');
  toast(`${c.name} 被寫進家畜名冊`, 'warn', 4200);
  sound.tone(200, 0.16, 'sawtooth', 0.035, 120);
  checkOversight();
  afterAction();
}

/* ---------------- 校庫 ---------------- */

function renderTreasuryTab(body) {
  const a = admin();
  const cap = isPresident() ? a.treasury : Math.floor(a.treasury * 0.3);
  body.innerHTML = `
    <div class="treasury-grid">
      <div class="panel treasury-main">
        <div class="panel-head" style="padding:0 0 12px"><h3>校庫</h3><span>${isPresident() ? '會長可全額撥款' : '成員每次最多 30%'}</span></div>
        <div class="treasury-amount">${fmt(a.treasury)}</div>
        <div class="treasury-meta">可動用 ${fmt(cap)} · 預估月收入 ${fmt(monthlyIncome())}</div>
        <div class="treasury-actions">
          <button class="btn ghost" data-withdraw="100000">撥 10 萬</button>
          <button class="btn ghost" data-withdraw="500000">撥 50 萬</button>
          <button class="btn ghost" data-withdraw="1000000">撥 100 萬</button>
          <button class="btn gold" data-withdraw="all">全部撥款</button>
        </div>
        <p class="stake-fine">${isPresident() ? '會長全額撥款不受審查；但校庫見底時，中立委員會還是會問。' : '成員每次撥款會提高審查度 +8。挪用的錢，帳上都看得出來。'}</p>
      </div>
      <div class="panel treasury-main">
        <div class="panel-head" style="padding:0 0 12px"><h3>每月繳納金</h3><span>NT$10,000–5,000,000</span></div>
        <div class="tribute-input">
          <span>NT$</span>
          <input id="tribute-input" type="number" min="10000" max="5000000" step="10000" value="${a.tribute}">
        </div>
        <div class="tribute-quick">
          <button data-tribute="100000">10 萬</button>
          <button data-tribute="300000">30 萬</button>
          <button data-tribute="1000000">100 萬</button>
          <button data-tribute="5000000">500 萬</button>
          <button class="btn gold" data-apply-tribute>套用</button>
        </div>
        <p class="stake-fine">繳納金越高，月錢越多，但中立委員會的審查度也會跟著上升。目前壓力：${a.tribute >= 1000000 ? '每日 +3' : a.tribute >= 300000 ? '每日 +1' : '無'}。</p>
      </div>
    </div>

    <div class="school-section-head"><h3>校園活動</h3><span>每天一次</span></div>
    <div class="event-grid">
      <button class="event-card" data-event="levy" ${a.eventsDay === state.day ? 'disabled' : ''}>
        <b>特別徵收</b><span>立刻向所有家畜多收一份月錢（共 ${fmt(monthlyIncome())}），審查 +12、威望 −5。</span>
      </button>
      <button class="event-card" data-event="festival" ${a.eventsDay === state.day ? 'disabled' : ''}>
        <b>校園祭</b><span>花費校庫 ${fmt(300000)}，威望 +15、審查 −5。</span>
      </button>
      <button class="event-card" data-event="inspect" ${a.eventsDay === state.day ? 'disabled' : ''}>
        <b>巡視校園</b><span>在校園裡走一圈，隨機遇到一點好事或壞事。</span>
      </button>
      ${isPresident() ? `
        <button class="event-card president" data-event="hundred" ${a.eventsDay === state.day ? 'disabled' : ''}>
          <b>百喰祭</b><span>花費校庫 ${fmt(1000000)}，威望 +25、審查 −15。會長專屬。</span>
        </button>` : ''}
    </div>

    <div class="school-section-head"><h3>會長權限</h3><span>${isPresident() ? '已解鎖' : '成為會長後解鎖'}</span></div>
    <div class="president-grid">
      <button class="event-card" data-power="appoint" ${isPresident() ? '' : 'disabled'}>
        <b>任命幹部</b><span>花費校庫 ${fmt(200000)}，任命一位學生會成員為幹部。威望 +10、審查 +5。</span>
      </button>
      <button class="event-card" data-power="pardon" ${isPresident() ? '' : 'disabled'}>
        <b>全校特赦</b><span>清空家畜名冊。威望 +20、審查 −10。</span>
      </button>
      <button class="event-card" data-power="dissolve" ${isPresident() && !a.neutralDissolved ? '' : 'disabled'}>
        <b>解散中立委員會</b><span>審查度永久歸零，但威望 −30。一屆會長只能做一次。</span>
      </button>
    </div>
    <div class="school-tip">
      · 校庫的錢來自月錢、拍賣與特別徵收；撥款給自己會留下紀錄。<br>
      · 每月繳納金是校規，也是你能動的第一個數字。調高容易，收拾很難。<br>
      · ${a.appointee ? `目前幹部：${a.appointee}。` : '目前沒有任命幹部。'}
    </div>`;

  body.querySelectorAll('[data-withdraw]').forEach(btn => {
    btn.onclick = () => withdraw(btn.dataset.withdraw);
  });
  body.querySelectorAll('[data-tribute]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      const input = body.querySelector('#tribute-input');
      if (input) input.value = btn.dataset.tribute;
    };
  });
  const apply = body.querySelector('[data-apply-tribute]');
  if (apply) apply.onclick = () => {
    const input = body.querySelector('#tribute-input');
    applyTribute(input ? input.value : a.tribute);
  };
  body.querySelectorAll('[data-event]').forEach(btn => {
    btn.onclick = () => runEvent(btn.dataset.event);
  });
  body.querySelectorAll('[data-power]').forEach(btn => {
    btn.onclick = () => runPower(btn.dataset.power);
  });
}

function withdraw(requested) {
  const a = admin();
  const cap = isPresident() ? a.treasury : Math.floor(a.treasury * 0.3);
  const amount = Math.min(cap, requested === 'all' ? cap : Math.round(Number(requested)));
  if (!Number.isFinite(amount) || amount <= 0) {
    toast(isPresident() ? '校庫沒有錢了。' : '成員每次最多只能動用校庫的 30%，目前沒有可撥款項。', 'warn');
    return;
  }
  a.treasury -= amount;
  state.cash += amount;
  if (!isPresident()) a.oversight = clamp(a.oversight + 8, 0, 100);
  logEvent(`從校庫撥款 ${fmt(amount)} 給自己${isPresident() ? '' : '（成員挪用，審查 +8）'}。`, isPresident() ? 'info' : 'warn');
  toast(`校庫撥款 ${fmt(amount)} 到手上`, 'good', 3600);
  sound.chip();
  checkOversight();
  afterAction();
}

function applyTribute(raw) {
  const a = admin();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) { toast('繳納金格式錯誤。', 'warn'); return; }
  const value = clamp(Math.round(parsed / 10000) * 10000, 10000, 5000000);
  const old = a.tribute;
  if (value === old) { toast('繳納金沒有變動。', 'info'); return; }
  a.tribute = value;
  if (value > old) {
    const add = value >= 1000000 ? 8 : value >= 300000 ? 4 : 2;
    a.oversight = clamp(a.oversight + add, 0, 100);
    logEvent(`每月繳納金調高至 ${fmt(value)}，中立委員會審查 +${add}。`, 'warn');
    toast(`繳納金調高到 ${fmt(value)}，審查 +${add}`, 'warn', 4200);
    sound.tone(320, 0.12, 'square', 0.025, 480);
  } else {
    logEvent(`每月繳納金調降至 ${fmt(value)}。`);
    toast(`繳納金調降到 ${fmt(value)}`, 'info', 3200);
    sound.chip();
  }
  checkOversight();
  afterAction();
}

function runEvent(key) {
  const a = admin();
  if (a.eventsDay === state.day) { toast('今天已經辦過活動了。', 'warn'); return; }
  if (key === 'levy') {
    const amount = monthlyIncome();
    if (amount <= 0) { toast('名冊上沒有人，徵收不到錢。', 'warn'); return; }
    a.treasury += amount;
    a.oversight = clamp(a.oversight + 12, 0, 100);
    a.prestige = clamp(a.prestige - 5, 0, 100);
    a.eventsDay = state.day;
    logEvent(`特別徵收：向家畜多收 ${fmt(amount)}，審查 +12。`, 'warn');
    toast(`特別徵收 ${fmt(amount)}，審查 +12`, 'warn', 4200);
    sound.chip();
  } else if (key === 'festival') {
    if (a.treasury < 300000) { toast('校庫不足 30 萬，辦不了校園祭。', 'warn'); return; }
    a.treasury -= 300000;
    a.prestige = clamp(a.prestige + 15, 0, 100);
    a.oversight = clamp(a.oversight - 5, 0, 100);
    a.eventsDay = state.day;
    logEvent('舉辦校園祭：威望 +15，審查 −5。');
    toast('校園祭開幕，全校都在談論學生會', 'good', 4200);
    sound.win(false);
  } else if (key === 'inspect') {
    a.eventsDay = state.day;
    const roll = Math.random();
    if (roll < 0.4) {
      const gain = 100000 + Math.floor(Math.random() * 4) * 100000;
      state.cash += gain;
      a.prestige = clamp(a.prestige + 2, 0, 100);
      logEvent(`巡視校園：在舊教室撿到 ${fmt(gain)}，威望 +2。`, 'warn');
      toast(`撿到 ${fmt(gain)}，威望 +2`, 'good', 4200);
      sound.chip();
    } else if (roll < 0.65) {
      a.oversight = clamp(a.oversight + 4, 0, 100);
      a.prestige = clamp(a.prestige - 1, 0, 100);
      logEvent('巡視校園：學生當面抱怨繳納金太高，審查 +4。', 'warn');
      toast('有學生當面抱怨繳納金，審查 +4', 'warn', 4200);
      sound.alarm();
    } else if (roll < 0.85) {
      const gain = Math.round(a.tribute * 0.5);
      a.treasury += gain;
      a.prestige = clamp(a.prestige + 1, 0, 100);
      logEvent(`巡視校園：家畜主動補繳 ${fmt(gain)}。`);
      toast(`家畜補繳 ${fmt(gain)}`, 'good', 3600);
      sound.chip();
    } else {
      a.prestige = clamp(a.prestige + 1, 0, 100);
      logEvent('巡視校園：什麼都沒發生，但你的威望 +1。');
      toast('校園很安靜。威望 +1', 'info', 3200);
    }
  } else if (key === 'hundred') {
    if (!isPresident()) { toast('只有會長能舉辦百喰祭。', 'warn'); return; }
    if (a.treasury < 1000000) { toast('校庫不足 100 萬。', 'warn'); return; }
    a.treasury -= 1000000;
    a.prestige = clamp(a.prestige + 25, 0, 100);
    a.oversight = clamp(a.oversight - 15, 0, 100);
    a.eventsDay = state.day;
    logEvent('舉辦百喰祭：全校停課一天，威望 +25，審查 −15。');
    toast('百喰祭開幕。這一刻，全校都記得你是會長', 'good', 5600);
    sound.jackpot();
  }
  checkOversight();
  afterAction();
}

function runPower(key) {
  const a = admin();
  if (!isPresident()) { toast('這是會長權限。', 'warn'); return; }
  if (key === 'appoint') {
    if (a.treasury < 200000) { toast('校庫不足 20 萬，付不出幹部薪酬。', 'warn'); return; }
    const members = STUDENTS.filter(c => c.faction === '學生會');
    const buttons = members.map(c => ({
      label: `${c.name} · ${c.title}`,
      kind: 'ghost',
      onClick: () => appoint(c.name)
    }));
    buttons.push({ label: '取消', kind: 'gold' });
    openModal({
      title: '任命幹部',
      wide: true,
      html: `<p style="color:#8f8a7e;line-height:1.8">花費校庫 ${fmt(200000)}，任命一位學生會成員為幹部。\n威望 +10、審查 +5。目前幹部：${a.appointee || '無'}。</p>`,
      buttons
    });
    return;
  }
  if (key === 'pardon') {
    if (!a.livestock.length) { toast('名冊上已經沒有家畜了。', 'warn'); return; }
    confirmDialog('全校特赦', `把名冊上 ${a.livestock.length} 位家畜全部移除。\n威望 +20、審查 −10。`, '特赦', false)
      .then(ok => {
        if (!ok) return;
        const n = a.livestock.length;
        a.livestock = [];
        a.prestige = clamp(a.prestige + 20, 0, 100);
        a.oversight = clamp(a.oversight - 10, 0, 100);
        logEvent(`全校特赦：${n} 位家畜被移出名冊。`, 'warn');
        toast(`全校特赦：${n} 個名字從名冊上消失`, 'good', 4600);
        sound.win(false);
        afterAction();
      });
    return;
  }
  if (key === 'dissolve') {
    if (a.neutralDissolved) { toast('委員會已經解散了。', 'info'); return; }
    confirmDialog(
      '解散絕對中立委員會',
      '委員會將被永久解散，審查度歸零，之後不再有人查帳。\n但這會讓全校看見你撕掉最後一層遮羞布：威望 −30。\n\n確定嗎？',
      '解散', true
    ).then(ok => {
      if (!ok) return;
      a.neutralDissolved = true;
      a.oversight = 0;
      a.prestige = clamp(a.prestige - 30, 0, 100);
      logEvent('你解散了絕對中立委員會。從今天起，沒有人再查學生會的帳。', 'warn');
      toast('絕對中立委員會已解散', 'warn', 5200);
      sound.alarm();
      afterAction();
    });
  }
}

function appoint(name) {
  const a = admin();
  if (a.treasury < 200000) { toast('校庫不足 20 萬。', 'warn'); return; }
  a.treasury -= 200000;
  a.appointee = name;
  a.prestige = clamp(a.prestige + 10, 0, 100);
  a.oversight = clamp(a.oversight + 5, 0, 100);
  logEvent(`任命 ${name} 為學生會幹部。`);
  toast(`${name} 已被任命為幹部`, 'good', 3600);
  sound.chip();
  checkOversight();
  afterAction();
}

/* ---------------- 中立委員會 ---------------- */

function renderNeutralTab(body) {
  const a = admin();
  const dissolved = a.neutralDissolved;
  const members = STUDENTS.filter(c => c.faction === '絕對中立委員會');
  const pressure = a.tribute >= 1000000 ? 3 : a.tribute >= 300000 ? 1 : 0;
  body.innerHTML = `
    <div class="neutral-hero ${dissolved ? 'dissolved' : ''}">
      <div class="nh-copy">
        <div class="chapter-tag">ABSOLUTE NEUTRAL COMMITTEE</div>
        <h2>${dissolved ? '委員會已解散' : '絕對中立委員會'}</h2>
        <p>${dissolved
          ? '你把最後一層遮羞布也撕掉了。從今天起，學生會的帳沒有人查，但也沒有人替你背書。'
          : '他們不管學生會怎麼收錢，只要求帳目對得上。審查度累積到 100，校庫就會被凍結一半。'}</p>
      </div>
      <div class="neutral-gauge">
        <div class="ng-label">審查度</div>
        <div class="ng-value ${a.oversight >= 80 ? 'bad' : ''}">${dissolved ? '—' : Math.round(a.oversight)}<small>／100</small></div>
        <div class="school-meter ${a.oversight >= 80 ? 'bad' : ''}"><i style="width:${dissolved ? 0 : a.oversight}%"></i></div>
        <div class="ng-note">${dissolved ? '已解散' : `${oversightLabel(a.oversight)} · 每日壓力 ${pressure ? '+' + pressure : '無'}`}</div>
      </div>
    </div>

    <div class="neutral-actions">
      <button class="event-card" data-neutral="negotiate" ${dissolved ? 'disabled' : ''}>
        <b>私下協商</b><span>花費現金 ${fmt(500000)}，審查 −15、威望 +2。</span>
      </button>
      <button class="event-card" data-neutral="donate" ${dissolved ? 'disabled' : ''}>
        <b>捐贈校庫</b><span>從校庫撥 ${fmt(500000)} 給委員會，審查 −20。</span>
      </button>
      <button class="event-card" data-neutral="audit" ${dissolved ? 'disabled' : ''}>
        <b>主動受審</b><span>審查 −35、威望 −5，校庫再撥出 10% 作為審查成本。</span>
      </button>
      ${isPresident() ? `
        <button class="event-card president" data-neutral="dissolve" ${dissolved ? 'disabled' : ''}>
          <b>解散委員會</b><span>審查永久歸零，威望 −30。</span>
        </button>` : ''}
    </div>

    <div class="school-section-head"><h3>委員會成員</h3><span>${members.length} 人</span></div>
    <div class="person-grid">
      ${members.map(c => personCard(c)).join('')}
    </div>
    <div class="school-tip">
      · 繳納金 30 萬以上：每日審查 +1；100 萬以上：每日審查 +3。<br>
      · 審查度到 100：校庫減半、威望 −15，審查度降回 60。<br>
      · 委員會不是敵人，是帳本。你可以賄賂它、餵飽它，或直接讓它消失。
    </div>`;

  bindPersonCards(body);
  body.querySelectorAll('[data-neutral]').forEach(btn => {
    btn.onclick = () => runNeutral(btn.dataset.neutral);
  });
}

function runNeutral(key) {
  const a = admin();
  if (a.neutralDissolved) { toast('委員會已經解散了。', 'info'); return; }
  if (key === 'dissolve') { runPower('dissolve'); return; }
  if (key === 'negotiate') {
    if (state.cash < 500000) { toast('現金不足 50 萬。', 'warn'); return; }
    state.cash -= 500000;
    a.oversight = clamp(a.oversight - 15, 0, 100);
    a.prestige = clamp(a.prestige + 2, 0, 100);
    logEvent('你與絕對中立委員會私下協商，審查 −15。', 'warn');
    toast('協商完成，審查 −15', 'good', 3600);
    sound.chip();
  } else if (key === 'donate') {
    if (a.treasury < 500000) { toast('校庫不足 50 萬。', 'warn'); return; }
    a.treasury -= 500000;
    a.oversight = clamp(a.oversight - 20, 0, 100);
    logEvent('你從校庫捐贈 50 萬給中立委員會，審查 −20。');
    toast('捐贈完成，審查 −20', 'good', 3600);
    sound.chip();
  } else if (key === 'audit') {
    const cost = Math.floor(a.treasury * 0.1);
    a.treasury -= cost;
    a.oversight = clamp(a.oversight - 35, 0, 100);
    a.prestige = clamp(a.prestige - 5, 0, 100);
    logEvent(`主動受審：審查 −35，校庫支出 ${fmt(cost)}。`, 'warn');
    toast(`主動受審完成，審查 −35`, 'good', 4200);
    sound.tone(520, 0.14, 'triangle', 0.03);
  }
  checkOversight();
  afterAction();
}

/* ---------------- 政變 ---------------- */

function renderCoupTab(body) {
  const a = admin();
  const seats = COUNCIL_SEATS.map((m, i) => {
    const cleared = state.coupCleared.includes(i);
    const locked = i === COUNCIL_SEATS.length - 1 && state.coupCleared.length < COUNCIL_SEATS.length - 1;
    return `
      <div class="coup-seat ${cleared ? 'cleared' : ''} ${locked ? 'locked' : ''}">
        <div class="story-avatar mini ${m.cls}">${m.init}</div>
        <div class="cs-info"><b>${esc(m.name)}</b><span>${esc(m.title)}</span></div>
        <div class="cs-status">${state.isPresident ? '內閣' : cleared ? '已擊敗' : locked ? '最後' : '待挑戰'}</div>
      </div>`;
  }).join('');

  if (state.isPresident) {
    body.innerHTML = `
      <div class="coup-hero won">
        <div class="chapter-tag">COUP · SUCCESS</div>
        <h2>你已經是學生會長</h2>
        <p>五席全倒，規矩換你寫。現在你可以修改繳納金、調動校庫、任命幹部、特赦全校，甚至解散中立委員會。</p>
      </div>
      <div class="school-section-head"><h3>你的內閣</h3><span>五席</span></div>
      <div class="coup-seats">${seats}</div>
      <div class="school-tip">· 會長權限集中在「校庫」分頁。改寫規矩之前，先看看校庫還剩多少錢。</div>`;
    return;
  }

  const canLaunch = state.councilJoined && totalDebt() <= 0 && !state.coupActive;
  body.innerHTML = `
    <div class="coup-hero ${state.coupActive ? 'active' : ''}">
      <div class="chapter-tag">COUP D'ÉTAT</div>
      <h2>${state.coupActive ? '政變進行中' : '推翻會長'}</h2>
      <p>${state.coupActive
        ? `已經擊敗 ${state.coupCleared.length} 席。四席可自由挑順序，會長必須最後；每拿下一席，下一場就多一次洞察。`
        : '政變沒有順序，只有結果。五席全倒，你就是學生會長。中途落敗，學生會資格會被撤銷，重新成為家畜。'}</p>
      <div class="coup-meta">
        <span>進度 <b>${state.coupCleared.length}／${COUNCIL_SEATS.length}</b></span>
        <span>債務 <b>${fmt(totalDebt())}</b></span>
        <span>威望 <b>${Math.round(a.prestige)}</b></span>
        <span>下一場洞察 <b>${Math.min(3, state.coupCleared.length + (a.prestige >= 60 ? 1 : 0)) || '無'}</b></span>
      </div>
      <div class="coup-hero-actions">
        ${state.coupActive
          ? '<button class="btn gold" data-go-council>前往挑戰</button>'
          : `<button class="btn danger" data-launch-coup ${canLaunch ? '' : 'disabled'}>發動政變</button>`}
        ${!state.councilJoined ? '<span class="coup-warn">先加入學生會</span>' : totalDebt() > 0 ? '<span class="coup-warn">先清償債務</span>' : ''}
      </div>
    </div>
    <div class="school-section-head"><h3>學生會五席</h3><span>會長最後</span></div>
    <div class="coup-seats">${seats}</div>
    <div class="school-tip">
      · 每擊敗一席，下一場額外 +1 洞察（最多 +3）；威望 60 以上再 +1。<br>
      · 政變中途落敗：撤銷學生會資格、重新成為家畜，債務回到 NT$5,000,000。<br>
      · 五席全倒：你成為會長，解鎖完整的校庫與校規權限。
    </div>`;

  const go = body.querySelector('[data-go-council]');
  if (go) go.onclick = () => { sound.click(); router.go('council'); };
  const launch = body.querySelector('[data-launch-coup]');
  if (launch) launch.onclick = () => { sound.click(); launchCoup(); };
}

/* ---------------- 人物名鑑 ---------------- */

function renderArchiveTab(body) {
  const factions = ['all', '學生會', '絕對中立委員會', '一般學生'];
  const list = archiveFilter === 'all' ? STUDENTS : STUDENTS.filter(c => c.faction === archiveFilter);
  body.innerHTML = `
    <div class="school-filter">
      ${factions.map(f => `<button class="${archiveFilter === f ? 'active' : ''}" data-archive-filter="${f}">${f === 'all' ? '全部' : f}</button>`).join('')}
      <span class="school-filter-note">${list.length} 位人物</span>
    </div>
    <div class="archive-grid">
      ${list.map(c => `
        <button class="archive-card" data-person="${c.id}">
          <div class="arc-head">
            <div class="story-avatar mini ${c.cls}">${c.init}</div>
            <div class="arc-titles"><b>${esc(c.name)}</b><span>${esc(c.title)}</span></div>
            <em>${esc(c.faction)}</em>
          </div>
          <p class="arc-quote">${c.quote}</p>
          <p class="arc-bio">${c.bio}</p>
          <div class="arc-tags">${c.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
        </button>`).join('')}
    </div>
    <div class="school-tip">· 人物名鑑收錄學生會、絕對中立委員會與一般學生的資料。點擊卡片可看完整檔案。</div>`;
  body.querySelectorAll('[data-archive-filter]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      archiveFilter = btn.dataset.archiveFilter;
      renderSchoolBody();
    };
  });
  bindPersonCards(body);
}

/* ---------------- 主體 ---------------- */

function renderSchoolBody() {
  const body = document.getElementById('school-body');
  if (!body) return;
  if (!TABS.some(t => t.key === activeTab)) activeTab = 'roster';
  renderTabs();
  syncSchoolTop();
  if (activeTab === 'roster') renderRosterTab(body);
  else if (activeTab === 'livestock') renderLivestockTab(body);
  else if (activeTab === 'treasury') renderTreasuryTab(body);
  else if (activeTab === 'neutral') renderNeutralTab(body);
  else if (activeTab === 'coup') renderCoupTab(body);
  else if (activeTab === 'archive') renderArchiveTab(body);
}

function renderSchool() {
  const el = root();
  if (!el) return;
  if (!el.dataset.ready) {
    el.dataset.ready = '1';
    el.innerHTML = `
      <div class="game-head">
        <button class="btn ghost" data-back>← 學園</button>
        <h2>學生會室</h2>
        <span class="sub" id="school-sub">名冊、家畜、校庫與中立委員會</span>
        <div class="spacer"></div>
        <button class="btn ghost" data-rules>規則</button>
      </div>
      <div id="school-top"></div>
      <div class="school-tabs" id="school-tabs"></div>
      <div id="school-body"></div>`;
    el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
    el.querySelector('[data-rules]').onclick = () => openRules('school');
  }
  renderSchoolBody();
}

/* ---------------- 生命週期 ---------------- */

export function enterSchool() {
  if (!state.councilJoined && !state.isPresident) {
    toast('學生會室只對學生會成員開放。', 'warn');
    router.go('lobby');
    return;
  }
  renderSchool();
}

export function leaveSchool() { }

export function canLeaveSchool() { return true; }

events.on('day', () => {
  if (!state.councilJoined || state.admin.neutralDissolved) return;
  if (checkOversight()) {
    save();
    refreshHud();
    if (router.current === 'school') renderSchoolBody();
  }
});
