import {
  state, fmt, addCash, refreshHud, toast, sleep, router,
  sound, openRules, save, logEvent, clamp, confirmDialog, checkEnding,
  totalDebt
} from '../core.js';
import {
  playFormulaWin, playJoinWin, playJoinLose,
  playCoupStart, playCoupWin, playCoupLose
} from '../story.js';
import { setChallenge } from '../challenge.js';

const root = () => document.getElementById('view-council');

const MIN_WAGER = 10000;
const MAX_SAFE_WAGER = 1e15;
const JOIN_LOSE_DEBT = 10000000;
const COUP_LOSE_DEBT = 5000000;

const MEMBERS = [
  {
    name: '夢見弓優芽美', title: '宣傳委員長 · 校園偶像', init: '夢', cls: 'm-yumemi', diff: 1,
    hand: 5, target: 3, bossTarget: 3, reveal: 2, insight: 1, blunder: 0.28, edge: 0, swap: false,
    quote: '「舞台上的笑容是免費的。門票，才是真正的賭注——你買了票，就得看完我贏。」',
    rule: '五張牌，先贏三局。開局看得見她兩張牌，洞察 1 次。'
  },
  {
    name: '西洞院百合子', title: '文化委員長', init: '西', cls: 'm-yuriko', diff: 2,
    hand: 5, target: 3, bossTarget: 3, reveal: 1, insight: 1, blunder: 0.12, edge: 0.2, swap: true,
    quote: '「生贄的價值，在於她相信自己還能贏。」',
    rule: '五張牌，先贏三局。只看見她一張牌；她會換掉最弱的一張，並開始讀你的牌。'
  },
  {
    name: '生志摩妄', title: '美化委員長', init: '生', cls: 'm-midari', diff: 3,
    hand: 5, target: 3, bossTarget: 3, reveal: 0, insight: 1, blunder: 0.06, edge: 0.35, swap: true,
    quote: '「贏或輸都無所謂。我想看的，是你把命押上去的表情。」',
    rule: '五張牌，先贏三局。看不到她的牌，只有 1 次洞察；她讀牌極準。'
  },
  {
    name: '豆生田楓', title: '學生會會計', init: '豆', cls: 'm-kaede', diff: 4,
    hand: 6, target: 4, bossTarget: 3, reveal: 1, insight: 0, blunder: 0.02, edge: 0.42, swap: true,
    quote: '「機率不會說謊。你輸，是因為你從一開始就算錯了。」',
    rule: '六張牌，你先贏四局，他只要三局。只看見他一張牌，沒有洞察。'
  },
  {
    name: '桃喰綺羅莉', title: '學生會長', init: '綺', cls: 'm-kirari', diff: 5,
    hand: 7, target: 4, bossTarget: 3, reveal: 0, insight: 0, blunder: 0, edge: 0.55, swap: true,
    quote: '「這個學園的規則是我寫的。你可以贏，但要先學會不要怕輸。」',
    rule: '七張牌，你先贏四局，她只要三局。看不見她的牌，沒有洞察。平手算她贏。'
  }
];

const PRESIDENT = MEMBERS.length - 1;

export const COUNCIL_SEATS = MEMBERS.map(m => ({
  name: m.name, title: m.title, init: m.init, cls: m.cls, diff: m.diff
}));

const TRIAL = {
  hand: 7,
  target: 3,
  bossTarget: 4,
  reveal: 1,
  insight: 2,
  blunder: 0.08,
  edge: 0.4,
  swap: true
};

const GAME_PICKS = [
  {
    id: 'blackjack', name: '21 點', view: 'blackjack', tag: '單局',
    desc: '補牌、停牌，點數大的人贏。平手算學生會贏。'
  },
  {
    id: 'mahjong', name: '二人麻將', view: 'mahjong', tag: '一局',
    desc: '一對一摸牌、碰牌、胡牌。流局算學生會贏。'
  },
  {
    id: 'holdem', name: '德州撲克', view: 'holdem', tag: '單挑',
    desc: '與成員單挑一手。蓋牌、輸牌或平手都算學生會贏。'
  },
  {
    id: 'votingscissors', name: '投票猜拳', view: 'votingscissors', tag: '一對一',
    desc: '各抽三張手牌，先拿下一個決勝回合的人贏。平手就換下一張。'
  },
  {
    id: 'fate', name: '命運牌局', view: null, tag: '原規則',
    desc: '雙方輪流比大小，先贏下指定局數。平手算學生會贏。'
  }
];
const GAME_BY_ID = Object.fromEntries(GAME_PICKS.map(g => [g.id, g]));

let duel = null;
let busy = false;
let cardId = 1;
let selected = null;
let draft = null;
let gamePick = 'blackjack';
let pendingGame = null;
let gameResult = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck(size) {
  const deck = [];
  for (let rank = 1; rank <= size; rank++) {
    for (let i = 0; i < 4; i++) deck.push({ id: cardId++, rank });
  }
  return shuffle(deck);
}

function sortHand(hand) { hand.sort((a, b) => b.rank - a.rank); }

function trialAvailable() {
  return !state.councilJoined && !state.isPresident && totalDebt() <= 0;
}

function combatStats(m, mode) {
  if (mode === 'trial') return { ...m, ...TRIAL };
  if (mode === 'coup') {
    const bonus = Math.min(3, state.coupCleared.length + (state.admin.prestige >= 60 ? 1 : 0));
    return { ...m, insight: m.insight + bonus };
  }
  return m;
}

function memberHead(m, status) {
  return `
    <div class="cc-head">
      <div class="cc-portrait ${m.cls}">${m.init}</div>
      <div class="cc-titles"><b>${m.name}</b><span>${m.title}</span></div>
      ${status ? `<div class="cc-status">${status}</div>` : ''}
    </div>`;
}

function memberFacts(m) {
  return `
    <div class="stake-facts">
      <span>手牌 <b>${m.hand} 張</b></span>
      <span>你需勝 <b>${m.target} 局</b></span>
      <span>她需勝 <b>${m.bossTarget} 局</b></span>
      <span>洞察 <b>${m.insight ? m.insight + ' 次' : '無'}</b></span>
      <span>看穿 <b>${m.reveal ? m.reveal + ' 張' : '無'}</b></span>
      <span>換牌 <b>${m.swap ? '會' : '不會'}</b></span>
    </div>`;
}

function gameInfo(id) {
  return GAME_BY_ID[id] || GAME_PICKS[0];
}

function gameFacts(m, id) {
  if (id === 'fate') return memberFacts(m);
  const rows = {
    blackjack: [['賭局', '單局決勝'], ['莊家', '17 停'], ['Blackjack', '3:2'], ['平手', '學生會勝']],
    mahjong: [['賭局', '一局決勝'], ['碰牌', '可'], ['自摸', '可'], ['流局', '學生會勝']],
    holdem: [['賭局', '單挑一手'], ['籌碼', '100 BB'], ['盲注', '1K / 2K'], ['平手', '學生會勝']],
    votingscissors: [['賭局', '先贏一回合'], ['手牌', '各 3 張'], ['平手', '換下一張'], ['全部平手', '重新抽牌']]
  };
  const list = rows[id] || rows.blackjack;
  return `
    <div class="stake-facts">
      ${list.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}
    </div>`;
}

function gameRule(id, m, isTrial) {
  if (id === 'blackjack') return '與成員單局決勝。你可以補牌或停牌，點數較大者贏；平手算學生會贏。';
  if (id === 'mahjong') return '與成員打一局二人麻將。先胡牌者贏；流局算學生會贏。';
  if (id === 'holdem') return '與成員單挑一手德州撲克。贏下底池者勝；蓋牌、輸牌或平手都算學生會贏。';
  if (id === 'votingscissors') return '雙方各抽三張手牌，同時打出一張。平手就換下一張；先拿下一回合的人贏。三張全平手則重新抽牌。';
  return isTrial ? '七張牌，你先贏三局；會長需要四局。開局看穿一張，洞察 2 次。平手算她贏。' : m.rule;
}

function gamePickerHTML() {
  return `
    <div class="game-pick-label">選擇賭局</div>
    <div class="game-pick">
      ${GAME_PICKS.map(g => `
        <button type="button" class="gp-btn ${gamePick === g.id ? 'active' : ''}" data-game="${g.id}">
          <span class="gp-tag">${g.tag}</span>
          <b>${g.name}</b>
          <small>${g.desc}</small>
        </button>`).join('')}
    </div>`;
}

function bindGamePicker(scope, onChange) {
  scope.querySelectorAll('[data-game]').forEach(btn => {
    btn.onclick = () => {
      if (gamePick !== btn.dataset.game) {
        gamePick = btn.dataset.game;
        sound.click();
        if (onChange) onChange();
      } else {
        sound.click();
      }
    };
  });
}

function memberMeta(mode) {
  if (mode === 'trial') {
    return `
      <span>入會測驗 <b>無下注</b></span>
      <span>勝利 <b>加入學生會</b></span>
      <span>失敗 <b>淪為家畜</b></span>`;
  }
  if (mode === 'coup') {
    return `
      <span>政變 <b>無下注</b></span>
      <span>勝利 <b>拿下一席</b></span>
      <span>失敗 <b>撤銷資格</b></span>`;
  }
  return `
    <span>最低下注 <b>${fmt(MIN_WAGER)}</b></span>
    <span>勝利 <b>賭債歸零</b></span>
    <span>彩金 <b>下注 ×2</b></span>`;
}

function memberCard(m, i, opts = {}) {
  const { mode = 'formula', status = '', disabled = false, note = '' } = opts;
  return `
    <button class="council-card ${disabled ? 'locked' : ''}" data-challenge="${i}" ${disabled ? 'disabled' : ''}>
      ${memberHead(m, status)}
      <div class="cc-stars">${'◆'.repeat(m.diff)}${'◇'.repeat(5 - m.diff)} <small>難度 ${m.diff}/5</small></div>
      <p class="cc-quote">${m.quote}</p>
      <p class="cc-rule">${m.rule}</p>
      <div class="cc-meta">${memberMeta(mode)}</div>
      ${note ? `<div class="cc-lock-note">${note}</div>` : ''}
    </button>`;
}

function statusBanner() {
  if (state.isPresident) {
    return `
      <div class="council-callout president">
        <div class="cc-call-copy">
          <b>你是現任學生會長</b>
          <span>五席、名冊、校庫與校規都在你手上。學生會室已全面解鎖。</span>
        </div>
        <button class="btn gold" data-go-school>進入學生會室</button>
      </div>`;
  }
  if (state.coupActive) {
    return `
      <div class="council-callout coup">
        <div class="cc-call-copy">
          <b>政變進行中 · ${state.coupCleared.length}／${MEMBERS.length} 席</b>
          <span>四席可自由挑順序，會長必須最後。中途落敗，學生會資格會被撤銷。</span>
        </div>
        <button class="btn ghost" data-go-school>查看政變進度</button>
      </div>`;
  }
  if (state.councilJoined) {
    return `
      <div class="council-callout member">
        <div class="cc-call-copy">
          <b>你已是學生會的一員</b>
          <span>先去學生會室熟悉名冊與校庫。準備好了，就發動政變。</span>
        </div>
        <div class="cc-call-actions">
          <button class="btn gold" data-launch-coup>發動政變</button>
          <button class="btn ghost" data-go-school>管理學園</button>
        </div>
      </div>`;
  }
  if (trialAvailable()) {
    return `
      <div class="council-callout trial">
        <div class="cc-call-copy">
          <b>入會測驗已解鎖</b>
          <span>債務已清。擊敗會長，加入學生會；輸了，名字會寫回家畜名冊。</span>
        </div>
      </div>`;
  }
  return '';
}

function renderRoster() {
  const body = document.getElementById('council-body');
  if (!body) return;

  const joined = state.councilJoined || state.isPresident;
  const coup = state.coupActive;
  const trial = trialAvailable();

  let kicker = 'SIDE QUEST · 公式戰';
  let title = '學生會 · 任你挑';
  let copy = '五位學生會成員，沒有順序，也不用累積。挑一位坐下來，下注金額自己決定——<b>沒有上限</b>。贏了，賭債一筆勾銷；輸了，押上的就留在桌上。';
  if (state.isPresident) {
    kicker = 'STUDENT COUNCIL · 會長';
    title = '學生會 · 你的內閣';
    copy = '你已經坐上會長的位子。五位成員都在你的內閣裡，現在要做的不是挑戰，而是讓整座學園照你的規矩運轉。';
  } else if (coup) {
    kicker = 'COUP D\'ÉTAT · 政變';
    title = '學生會 · 五席車輪戰';
    copy = '政變已經發動。四席可以自由挑順序，會長必須最後。每拿下一席，下一場就多一次洞察；中途落敗，學生會資格會被撤銷。';
  } else if (joined) {
    kicker = 'STUDENT COUNCIL · 成員';
    title = '學生會 · 政變準備';
    copy = '你已經是學生會的一員。公式戰對你來說結束了——接下來能做的，是在學生會室裡改寫規矩，或直接掀桌。';
  } else if (trial) {
    kicker = 'JOIN TRIAL · 入會測驗';
    title = '學生會 · 會長親試';
    copy = '債務已清。普通學生的身分只是起點；想坐進學生會，就必須擊敗會長。贏了入會，輸了重新成為家畜。';
  }

  const cards = MEMBERS.map((m, i) => {
    let mode = 'formula';
    let status = '';
    let disabled = false;
    let note = '';

    if (state.isPresident) {
      status = '內閣';
      disabled = true;
      note = '你現在是會長';
    } else if (coup) {
      mode = 'coup';
      if (state.coupCleared.includes(i)) {
        status = '已擊敗';
        disabled = true;
        note = '這一席已經倒下';
      } else if (i === PRESIDENT && state.coupCleared.length < MEMBERS.length - 1) {
        status = '最後';
        disabled = true;
        note = '先擊敗其他四席';
      } else {
        status = '政變';
        note = i === PRESIDENT ? '最終戰' : `洞察 +${Math.min(3, state.coupCleared.length + (state.admin.prestige >= 60 ? 1 : 0))}`;
      }
    } else if (joined) {
      status = '成員';
      disabled = true;
      note = '前往學生會室發動政變';
    } else if (trial) {
      if (i === PRESIDENT) {
        mode = 'trial';
        status = '入會測驗';
        note = '贏了加入學生會';
      } else {
        status = '已結束';
        disabled = true;
        note = '債務已清，公式戰結束';
      }
    } else {
      status = '挑戰';
    }

    return memberCard(m, i, { mode, status, disabled, note });
  }).join('');

  let progress;
  if (state.isPresident) {
    progress = `
      <div class="cp-label">學生會長</div>
      <div class="cp-num"><b>你</b></div>
      <div class="cp-note">威望 ${Math.round(state.admin.prestige)} · 審查 ${Math.round(state.admin.oversight)}</div>
      <div class="cp-sub">校庫 ${fmt(state.admin.treasury)}<br>每月繳納金 ${fmt(state.admin.tribute)}</div>`;
  } else if (coup) {
    progress = `
      <div class="cp-label">政變進度</div>
      <div class="cp-num"><b>${state.coupCleared.length}／${MEMBERS.length}</b></div>
      <div class="cp-note">剩餘 ${MEMBERS.length - state.coupCleared.length} 席</div>
      <div class="cp-sub">威望 ${Math.round(state.admin.prestige)}<br>下一場洞察 +${Math.min(3, state.coupCleared.length + (state.admin.prestige >= 60 ? 1 : 0))}</div>`;
  } else if (joined) {
    progress = `
      <div class="cp-label">學生會</div>
      <div class="cp-num"><b>成員</b></div>
      <div class="cp-note">校庫 ${fmt(state.admin.treasury)}</div>
      <div class="cp-sub">威望 ${Math.round(state.admin.prestige)} · 審查 ${Math.round(state.admin.oversight)}<br>挑戰 ${state.councilAttempts} 次 · 落敗 ${state.councilLosses} 次</div>`;
  } else if (trial) {
    progress = `
      <div class="cp-label">入會測驗</div>
      <div class="cp-num"><b>會長</b></div>
      <div class="cp-note">無下注 · 無退路</div>
      <div class="cp-sub">現金 ${fmt(state.cash)}<br>勝利加入學生會 · 失敗淪為家畜</div>`;
  } else {
    progress = `
      <div class="cp-label">下注上限</div>
      <div class="cp-num"><b>無</b></div>
      <div class="cp-note">最低下注 ${fmt(MIN_WAGER)}</div>
      <div class="cp-sub">現金 ${fmt(state.cash)}<br>挑戰 ${state.councilAttempts} 次 · 落敗 ${state.councilLosses} 次</div>`;
  }

  let ruleTitle = '公式戰規則';
  let ruleItems = `
    <li>五位學生會成員任你挑，沒有順序，也不用先擊敗誰。</li>
    <li>下注金額自訂，<b>沒有上限</b>；現金不足的部分由學生會代墊，直接記進你的債務。</li>
    <li>贏了：賭債全部歸零，下注金額雙倍返還。</li>
    <li>輸了：下注金額全部沒收，不會再另外罰款。</li>
    <li>對局：雙方各發一組牌，輪流打出一張比大小；平手算學生會贏。</li>
    <li>成員會讀你的出牌，越難的成員讀得越準，還會換掉最弱的一張。</li>
    <li>「洞察」可以翻開對方一張暗牌；高階成員不給你洞察。</li>
    <li>清償債務後，公式戰結束，改由會長的入會測驗決定你能不能加入學生會。</li>`;
  if (state.isPresident) {
    ruleTitle = '會長權限';
    ruleItems = `
      <li>你現在可以修改每月繳納金、調動校庫、任命幹部與舉辦校園活動。</li>
      <li>絕對中立委員會仍會審查你的帳；審查度過高會凍結校庫。</li>
      <li>你也可以特赦全校家畜，或直接解散中立委員會。</li>
      <li>學生會室是管理學園的地方，五席與全校名冊都在那裡。</li>`;
  } else if (coup) {
    ruleTitle = '政變規則';
    ruleItems = `
      <li>四席可自由挑順序，<b>會長必須最後</b>。</li>
      <li>每擊敗一席，下一場額外 +1 洞察（最多 +3）；威望 60 以上再 +1。</li>
      <li>勝利不會拿到現金，但會累積政變氣勢。</li>
      <li>中途落敗：政變失敗，撤銷學生會資格，重新成為家畜，債務回到 NT$5,000,000。</li>
      <li>五席全倒：你成為學生會長，解鎖完整的管理權限。</li>`;
  } else if (joined) {
    ruleTitle = '學生會成員';
    ruleItems = `
      <li>你已經加入學生會，公式戰不再對你開放。</li>
      <li>前往學生會室查看全校名冊、家畜名單、校庫與絕對中立委員會。</li>
      <li>準備好之後，可以發動政變，挑戰五席成為會長。</li>
      <li>政變中途落敗會失去學生會資格，重新成為家畜。</li>`;
  } else if (trial) {
    ruleTitle = '入會測驗規則';
    ruleItems = `
      <li>只有會長親自坐上牌桌，沒有下注，也沒有第二次機會。</li>
      <li>你拿七張牌、先贏三局；會長拿七張牌、需要四局。</li>
      <li>開局看穿會長一張牌，保有 2 次洞察；她會讀牌、也會換牌。</li>
      <li>勝利：加入學生會，解鎖學生會室與管理權限。</li>
      <li>失敗：名字寫回家畜名冊，債務回到 NT$10,000,000，退學期限重新計算。</li>`;
  }

  body.innerHTML = `
    <div class="council-hero ${state.isPresident ? 'is-president' : coup ? 'is-coup' : joined ? 'is-member' : trial ? 'is-trial' : ''}">
      <div class="ch-copy">
        <div class="chapter-tag">${kicker}</div>
        <h1>${title}</h1>
        <p>${copy}</p>
      </div>
      <div class="council-progress">${progress}</div>
    </div>
    ${statusBanner()}
    <div class="council-grid">
      ${cards}
    </div>
    <div class="panel council-rule-panel">
      <h3>${ruleTitle}</h3>
      <ul>${ruleItems}</ul>
    </div>`;

  body.querySelectorAll('[data-challenge]').forEach(btn => {
    btn.onclick = () => { sound.click(); selectMember(Number(btn.dataset.challenge)); };
  });
  body.querySelectorAll('[data-go-school]').forEach(btn => {
    btn.onclick = () => { sound.click(); router.go('school'); };
  });
  body.querySelectorAll('[data-launch-coup]').forEach(btn => {
    btn.onclick = () => { sound.click(); launchCoup(); };
  });
  syncHead();
}

function selectMember(i) {
  if (busy || state.locked) return;
  if (!MEMBERS[i]) return;
  if (state.isPresident) { toast('你現在是會長，不需要再挑戰自己。', 'info'); return; }
  if (state.councilJoined && !state.coupActive) {
    toast('你已經是學生會的一員。要奪權，請發動政變。', 'info');
    return;
  }
  if (trialAvailable() && i !== PRESIDENT) {
    toast('債務已清，公式戰已經結束。現在只剩會長的入會測驗。', 'warn');
    return;
  }
  if (state.coupActive) {
    if (state.coupCleared.includes(i)) { toast('這一席已經倒下了。', 'info'); return; }
    if (i === PRESIDENT && state.coupCleared.length < MEMBERS.length - 1) {
      toast('會長必須最後挑戰。先解決其他四席。', 'warn');
      return;
    }
  }
  selected = i;
  draft = null;
  renderCouncilBody();
}

function previewHTML(w) {
  const cash = Math.round(state.cash);
  const paid = Math.min(cash, w);
  const credit = w - paid;
  return `
    <div class="sp-row"><span>勝利</span><b class="good">賭債歸零 · 拿回 ${fmt(w * 2)}</b></div>
    <div class="sp-row"><span>落敗</span><b class="bad">沒收 ${fmt(w)}</b></div>
    <div class="sp-row dim"><span>結算</span><b>現金 ${fmt(paid)}${credit ? ' ＋ 賒帳 ' + fmt(credit) : ''}</b></div>`;
}

function renderStake() {
  const body = document.getElementById('council-body');
  if (!body) return;
  const m = MEMBERS[selected];
  const cash = Math.round(state.cash);
  const initial = draft != null ? draft : Math.max(MIN_WAGER, Math.min(cash, 100000));
  body.innerHTML = `
    <button class="btn ghost stake-back" data-back-list>← 換一位成員</button>
    <div class="stake-wrap">
      <div class="council-card stake-member">
        ${memberHead(m)}
        <div class="cc-stars">${'◆'.repeat(m.diff)}${'◇'.repeat(5 - m.diff)} <small>難度 ${m.diff}/5</small></div>
        <p class="cc-quote">${m.quote}</p>
        <p class="cc-rule" id="cs-rule">${gameRule(gamePick, m, false)}</p>
        <div id="cs-facts">${gameFacts(m, gamePick)}</div>
        <div class="cc-meta">${memberMeta('formula')}</div>
      </div>
      <div class="panel stake-panel">
        <div class="chapter-tag">STAKE · 下注</div>
        <h2>你押多少？</h2>
        <p class="stake-sub">學生會不設上限。選一張桌子，押上你想拿回來的東西。</p>
        ${gamePickerHTML()}
        <label class="stake-label" for="cs-wager">下注金額</label>
        <div class="stake-input">
          <span>NT$</span>
          <input id="cs-wager" type="number" inputmode="numeric" min="${MIN_WAGER}" step="10000" value="${initial}">
        </div>
        <div class="stake-quick">
          <button data-q="10000">1 萬</button>
          <button data-q="100000">10 萬</button>
          <button data-q="1000000">100 萬</button>
          <button data-q="10000000">1000 萬</button>
          <button data-q="all">全押現金</button>
          <button data-q="double">加倍</button>
        </div>
        <div class="stake-preview" id="cs-preview"></div>
        <button class="btn gold stake-go" id="cs-start">坐上牌桌</button>
        <p class="stake-fine">現金不足的部分由學生會代墊，直接記進債務。輸了不會再額外罰款，但這筆下注不會回來。</p>
      </div>
    </div>`;

  const input = body.querySelector('#cs-wager');
  const preview = body.querySelector('#cs-preview');
  const startBtn = body.querySelector('#cs-start');
  const readWager = () => Math.floor(Number(input.value));
  const valid = (w) => Number.isFinite(w) && w >= MIN_WAGER && w <= MAX_SAFE_WAGER;
  const gi = gameInfo(gamePick);

  bindGamePicker(body, () => {
    const v = Number(input.value);
    if (Number.isFinite(v)) draft = v;
    renderStake();
  });

  const sync = () => {
    const w = readWager();
    if (valid(w)) {
      preview.innerHTML = previewHTML(w);
    } else if (Number.isFinite(w) && w > MAX_SAFE_WAGER) {
      preview.innerHTML = '<div class="sp-error">這個數字連學生會都不敢收。</div>';
    } else {
      preview.innerHTML = `<div class="sp-error">至少下注 ${fmt(MIN_WAGER)}。</div>`;
    }
    startBtn.disabled = !valid(w);
  };

  input.addEventListener('input', sync);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !startBtn.disabled) startBtn.click();
  });

  body.querySelectorAll('[data-q]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      const q = btn.dataset.q;
      if (q === 'all') input.value = Math.max(MIN_WAGER, Math.round(state.cash));
      else if (q === 'double') input.value = Math.max(MIN_WAGER, Math.floor((Number(input.value) || 0) * 2));
      else input.value = q;
      sync();
    };
  });

  startBtn.onclick = () => {
    const w = readWager();
    if (!valid(w)) { sync(); return; }
    sound.click();
    const credit = Math.max(0, w - Math.round(state.cash));
    confirmDialog(
      `公式戰 · ${m.name}`,
      `賭局：${gi.name}。\n下注 ${fmt(w)}。\n贏了：賭債歸零，下注雙倍返還。\n輸了：下注全部沒收。${credit ? `\n其中 ${fmt(credit)} 會向學生會賒帳。` : ''}\n\n${gameRule(gamePick, m, false)}\n一旦坐上牌桌，就不能中途離席。`,
      '坐上牌桌', true
    ).then(ok => {
      if (!ok || state.locked) return;
      if (gamePick === 'fate') beginDuel(selected, w, 'formula');
      else launchGameChallenge(selected, w, 'formula', gamePick);
    });
  };

  body.querySelector('[data-back-list]').onclick = () => {
    sound.click();
    selected = null;
    draft = null;
    renderCouncilBody();
  };

  sync();
  syncHead();
}

function renderChallenge() {
  const body = document.getElementById('council-body');
  if (!body || selected == null) return;
  const base = MEMBERS[selected];
  const mode = state.coupActive ? 'coup' : 'trial';
  const m = combatStats(base, mode);
  const isTrial = mode === 'trial';
  const isFinal = mode === 'coup' && selected === PRESIDENT;
  const gi = gameInfo(gamePick);
  const ruleText = gameRule(gamePick, base, isTrial);

  let terms = '';
  if (isTrial) {
    terms = `
      <div class="sp-row"><span>勝利</span><b class="good">加入學生會 · 解鎖學生會室</b></div>
      <div class="sp-row"><span>失敗</span><b class="bad">淪為家畜 · 債務 ${fmt(JOIN_LOSE_DEBT)}</b></div>
      <div class="sp-row dim"><span>下注</span><b>無 · 會長親自坐上牌桌</b></div>`;
  } else {
    terms = `
      <div class="sp-row"><span>勝利</span><b class="good">拿下這一席 · 下一場洞察 +${Math.min(3, state.coupCleared.length + 1 + (state.admin.prestige >= 60 ? 1 : 0))}</b></div>
      <div class="sp-row"><span>失敗</span><b class="bad">政變失敗 · 撤銷學生會資格</b></div>
      <div class="sp-row dim"><span>下注</span><b>無 · 賭的是位子</b></div>`;
  }

  body.innerHTML = `
    <button class="btn ghost stake-back" data-back-list>← 回到五席</button>
    <div class="stake-wrap">
      <div class="council-card stake-member">
        ${memberHead(base, isTrial ? '入會測驗' : isFinal ? '最終戰' : '政變')}
        <div class="cc-stars">${'◆'.repeat(base.diff)}${'◇'.repeat(5 - base.diff)} <small>難度 ${base.diff}/5</small></div>
        <p class="cc-quote">${base.quote}</p>
        <p class="cc-rule">${ruleText}</p>
        <div>${gameFacts(m, gamePick)}</div>
        <div class="cc-meta">${memberMeta(mode)}</div>
      </div>
      <div class="panel stake-panel">
        <div class="chapter-tag">${isTrial ? 'TRIAL · 入會測驗' : 'COUP · 政變'}</div>
        <h2>${isTrial ? '坐上會長的牌桌' : isFinal ? '最後一席' : `第 ${state.coupCleared.length + 1} 席`}</h2>
        <p class="stake-sub">${isTrial ? '沒有下注。你押上的是能不能走進學生會。' : isFinal ? '會長坐在最後。贏了，整座學園換你寫規矩。' : '每拿下一席，下一場就多一次洞察。'}</p>
        ${gamePickerHTML()}
        <div class="stake-preview">${terms}</div>
        <button class="btn gold stake-go" id="cs-start">${isTrial ? '開始入會測驗' : '開戰'}</button>
        <p class="stake-fine">${isTrial ? '入會測驗沒有第二次機會。失敗後債務會回到 NT$10,000,000，退學期限重新計算。' : '政變中途落敗會撤銷學生會資格、重新成為家畜，債務回到 NT$5,000,000。'}</p>
      </div>
    </div>`;

  bindGamePicker(body, () => renderChallenge());

  body.querySelector('[data-back-list]').onclick = () => {
    sound.click();
    selected = null;
    draft = null;
    renderCouncilBody();
  };

  body.querySelector('#cs-start').onclick = () => {
    sound.click();
    const title = isTrial ? `入會測驗 · ${base.name}` : `政變 · ${base.name}`;
    const text = isTrial
      ? `賭局：${gi.name}。\n你將挑戰會長 ${base.name}。\n勝利：加入學生會，解鎖學生會室。\n失敗：重新成為家畜，債務回到 ${fmt(JOIN_LOSE_DEBT)}。\n\n${ruleText}`
      : `賭局：${gi.name}。\n你將挑戰 ${base.name}。\n勝利：拿下這一席。\n失敗：政變失敗，撤銷學生會資格，重新成為家畜。\n\n${ruleText}`;
    confirmDialog(title, text, isTrial ? '開始測驗' : '開戰', true).then(ok => {
      if (!ok || state.locked) return;
      if (gamePick === 'fate') beginDuel(selected, 0, mode);
      else launchGameChallenge(selected, 0, mode, gamePick);
    });
  };

  syncHead();
}

function duelCard(card, cls = '', index = null) {
  if (cls.includes('back')) return '<div class="duel-card back"><span></span></div>';
  const inner = `<span class="dc-corner">${card.rank}</span><b>${card.rank}</b><small>運命</small>`;
  if (index !== null) {
    return `<button class="duel-card ${cls}" data-card-index="${index}">${inner}</button>`;
  }
  return `<div class="duel-card ${cls}">${inner}</div>`;
}

function resultHTML(d = duel) {
  const m = d.member;
  const mode = d.mode;

  if (mode === 'formula') {
    if (d.result === 'win') {
      return `
        <div class="duel-result win final">
          <div class="dr-kicker">FORMULA WIN · 賭債歸零</div>
          <h3>${m.name} 敗北</h3>
          <p>你擊敗了${m.name}。下注 ${fmt(d.wager)} 雙倍返還，家畜債務一筆勾銷。</p>
          <button class="btn gold" data-final>接受學生會的承認</button>
        </div>`;
    }
    return `
      <div class="duel-result lose">
        <div class="dr-kicker">FORMULA LOSE</div>
        <h3>你輸了</h3>
        <p>下注 ${fmt(d.wager)} 留在桌上。${d.credit ? `其中 ${fmt(d.credit)} 記進了學生會債務。` : ''}</p>
        <div class="dr-actions">
          <button class="btn gold" data-retry ${state.locked ? 'disabled' : ''}>再挑戰</button>
          <button class="btn ghost" data-return>回到名單</button>
        </div>
      </div>`;
  }

  if (mode === 'trial') {
    if (d.result === 'win') {
      return `
        <div class="duel-result win final">
          <div class="dr-kicker">JOIN TRIAL · PASSED</div>
          <h3>${m.name} 承認了你</h3>
          <p>入會測驗通過。從今天起，你是學生會的一員；學生會室的門已經為你打開。</p>
          <button class="btn gold" data-final-trial>接受學生會徽章</button>
        </div>`;
    }
    return `
      <div class="duel-result lose final">
        <div class="dr-kicker">JOIN TRIAL · FAILED</div>
        <h3>你輸了</h3>
        <p>會長沒有手下留情。你的名字被寫回家畜名冊，債務回到 ${fmt(JOIN_LOSE_DEBT)}。</p>
        <button class="btn danger" data-final-trial>離開學生會室</button>
      </div>`;
  }

  if (d.result === 'win') {
    const final = state.isPresident;
    return `
      <div class="duel-result win ${final ? 'final' : ''}">
        <div class="dr-kicker">COUP · SEAT ${state.coupCleared.length}／${MEMBERS.length}</div>
        <h3>${m.name} 倒下</h3>
        <p>${final ? '五席全倒。學生會再也沒有人能阻止你坐上會長之位。' : `這一席是你的了。剩下 ${MEMBERS.length - state.coupCleared.length} 席，下一場洞察 +${Math.min(3, state.coupCleared.length + (state.admin.prestige >= 60 ? 1 : 0))}。`}</p>
        <button class="btn gold" data-final-coup>${final ? '接任會長' : '繼續政變'}</button>
      </div>`;
  }
  return `
    <div class="duel-result lose final">
      <div class="dr-kicker">COUP · FAILED</div>
      <h3>政變失敗</h3>
      <p>你被逐出學生會，名字重新寫回家畜名冊。債務回到 ${fmt(COUP_LOSE_DEBT)}。</p>
      <button class="btn danger" data-final-coup>離開學生會室</button>
    </div>`;
}

function renderDuel() {
  const body = document.getElementById('council-body');
  if (!body || !duel) return;
  const m = duel.member;
  const hidden = duel.bossHand.filter(c => !duel.revealed.has(c.id)).length;
  const canPlay = duel.phase === 'play' && !busy;

  const modeNote = duel.mode === 'trial'
    ? `入會測驗 · 你需 ${duel.target} 勝，會長需 ${duel.bossTarget} 勝`
    : duel.mode === 'coup'
      ? `政變 · 第 ${duel.stage === PRESIDENT ? '最終' : state.coupCleared.length + 1} 席 · 你需 ${duel.target} 勝`
      : m.rule;

  const stakeNote = duel.mode === 'formula'
    ? `下注 ${fmt(duel.wager)}${duel.credit ? `（賒帳 ${fmt(duel.credit)}）` : ''} · 勝利：賭債歸零`
    : duel.mode === 'trial'
      ? '入會測驗 · 無下注 · 勝利：加入學生會'
      : '政變 · 無下注 · 勝利：拿下一席';

  body.innerHTML = `
    <div class="duel-wrap mode-${duel.mode}">
      <div class="felt duel-felt">
        <div class="duel-top">
          <div class="duel-member">
            <div class="cc-portrait ${m.cls}">${m.init}</div>
            <div>
              <div class="duel-name">${m.name}</div>
              <div class="duel-role">${m.title}</div>
            </div>
          </div>
          <div class="duel-rule">${modeNote}</div>
          <div class="duel-score">
            <div><span>你</span><b>${duel.playerScore}</b><em>／${duel.target}</em></div>
            <div class="duel-vs">VS</div>
            <div><span>${m.name}</span><b>${duel.bossScore}</b><em>／${duel.bossTarget}</em></div>
          </div>
        </div>

        <div class="duel-boss">
          <div class="duel-hand boss">
            ${duel.bossHand.map(c => duel.revealed.has(c.id) ? duelCard(c, 'revealed') : duelCard(c, 'back')).join('')}
          </div>
          <div class="duel-hint">${duel.revealed.size ? `已看穿 ${duel.revealed.size} 張牌` : '她的牌全蓋著'}</div>
        </div>

        <div class="duel-center">
          ${duel.phase === 'over' ? '' : duel.last ? `
            <div class="duel-tableau">
              <div class="dt-side"><span>你</span>${duelCard(duel.last.player, duel.last.playerWon ? 'won' : 'lost')}</div>
              <div class="dt-mid"><b>${duel.last.playerWon ? '你贏了這一局' : '她贏了這一局'}</b><small>第 ${duel.last.round} 回合</small></div>
              <div class="dt-side"><span>${m.name}</span>${duelCard(duel.last.boss, duel.last.playerWon ? 'lost' : 'won')}</div>
            </div>` : `
            <div class="duel-turn">第 ${duel.turn} 回合</div>
            <div class="duel-prompt">${canPlay ? '選一張牌，押上這一局。' : '牌正在落下……'}</div>`}
        </div>

        <div class="duel-player">
          <div class="duel-hand player">
            ${duel.playerHand.map((c, i) => duelCard(c, 'playable' + (canPlay ? '' : ' locked'), i)).join('')}
          </div>
          <div class="duel-hint">平手算她贏。你手上還有 ${duel.playerHand.length} 張。</div>
        </div>

        ${duel.phase === 'over' ? resultHTML() : ''}
      </div>

      <div class="panel duel-side">
        <h3>對局紀錄</h3>
        <div class="duel-log">${duel.log.slice(-8).reverse().map(l => `<div>${l}</div>`).join('') || '<div class="dim">還沒有人出牌。</div>'}</div>
        <div class="duel-actions">
          <button class="btn ghost" data-insight ${(!canPlay || duel.insight <= 0 || hidden <= 0) ? 'disabled' : ''}>洞察 ×${duel.insight}</button>
          <button class="btn danger" data-surrender ${duel.phase === 'over' ? 'disabled' : ''}>棄權</button>
        </div>
        <div class="duel-note">${stakeNote}<br>${m.quote}</div>
      </div>
    </div>`;

  body.querySelectorAll('[data-card-index]').forEach(el => {
    el.onclick = () => { sound.click(); playCard(Number(el.dataset.cardIndex)); };
  });
  const ins = body.querySelector('[data-insight]');
  if (ins) ins.onclick = useInsight;
  const sur = body.querySelector('[data-surrender]');
  if (sur) sur.onclick = surrender;
  const ret = body.querySelector('[data-return]');
  if (ret) ret.onclick = () => {
    sound.click();
    duel = null;
    busy = false;
    selected = null;
    draft = null;
    save();
    refreshHud();
    renderCouncilBody();
  };
  const again = body.querySelector('[data-retry]');
  if (again) again.onclick = () => {
    sound.click();
    draft = duel.wager;
    selected = duel.stage;
    duel = null;
    busy = false;
    renderCouncilBody();
  };
  const fin = body.querySelector('[data-final]');
  if (fin) fin.onclick = () => { sound.click(); busy = false; finishFormula(); };
  const finTrial = body.querySelector('[data-final-trial]');
  if (finTrial) finTrial.onclick = () => {
    sound.click();
    const win = duel.result === 'win';
    busy = false;
    finishTrial(win);
  };
  const finCoup = body.querySelector('[data-final-coup]');
  if (finCoup) finCoup.onclick = () => {
    sound.click();
    const win = duel.result === 'win';
    busy = false;
    finishCoup(win);
  };
  syncHead();
}

function launchGameChallenge(index, wager, mode, gameId) {
  if (busy || state.locked) return;
  const base = MEMBERS[index];
  const gi = gameInfo(gameId);
  if (!base || !gi.view) { beginDuel(index, wager, mode); return; }

  let credit = 0;
  if (mode === 'formula') {
    const cash = Math.round(state.cash);
    const paid = Math.min(cash, wager);
    credit = wager - paid;
    state.cash -= paid;
    state.shark += credit;
  }
  state.councilAttempts += 1;
  state.formulaFoe = base.name;
  pendingGame = { index, mode, wager, credit, game: gameId };
  selected = index;
  draft = null;
  setChallenge({
    game: gameId,
    member: base.name,
    title: base.title,
    mode,
    wager,
    credit,
    onResult: (result) => resolveGameChallenge(result)
  });
  save();
  refreshHud();
  renderCouncilStrip();
  router.go(gi.view);
}

function resolveGameChallenge(result) {
  const p = pendingGame;
  if (!p) return;
  pendingGame = null;
  const base = MEMBERS[p.index];
  if (!base) return;
  const gi = gameInfo(p.game);
  gameResult = {
    mode: p.mode,
    member: combatStats(base, p.mode),
    baseMember: base,
    wager: p.wager,
    credit: p.credit,
    stage: p.index,
    game: p.game,
    result,
    log: [`${gi.name}：${result === 'win' ? '你贏了' : '學生會贏了'}。`],
    phase: 'over'
  };

  const prev = duel;
  duel = gameResult;
  if (p.mode === 'formula') settleFormula(result === 'win');
  else if (p.mode === 'trial') settleTrial(result === 'win');
  else settleCoup(result === 'win');
  duel = prev;

  busy = false;
  save();
  refreshHud();
  renderCouncilStrip();
  if (router.current !== 'council') router.go('council');
  else renderCouncilBody();
}

function renderGameResult() {
  const body = document.getElementById('council-body');
  if (!body || !gameResult) return;
  const g = gameResult;
  const base = g.baseMember;
  const gi = gameInfo(g.game);
  const modeLabel = g.mode === 'formula' ? '公式戰' : g.mode === 'trial' ? '入會測驗' : '政變';
  const note = g.mode === 'formula'
    ? `下注 ${fmt(g.wager)}${g.credit ? `（賒帳 ${fmt(g.credit)}）` : ''}`
    : '無下注 · 賭的是位子';

  body.innerHTML = `
    <div class="duel-wrap mode-${g.mode}">
      <div class="felt duel-felt">
        <div class="duel-top">
          <div class="duel-member">
            <div class="cc-portrait ${base.cls}">${base.init}</div>
            <div>
              <div class="duel-name">${base.name}</div>
              <div class="duel-role">${base.title}</div>
            </div>
          </div>
          <div class="duel-rule">${modeLabel} · ${gi.name}</div>
          <div class="duel-score">
            <div><span>賭局</span><b>${gi.tag}</b></div>
          </div>
        </div>
        ${resultHTML(g)}
      </div>
      <div class="panel duel-side">
        <h3>挑戰紀錄</h3>
        <div class="duel-log">${g.log.slice().reverse().map(l => `<div>${l}</div>`).join('')}</div>
        <div class="duel-note">${note}<br>${gi.name} · ${modeLabel}</div>
      </div>
    </div>`;

  const ret = body.querySelector('[data-return]');
  if (ret) ret.onclick = () => {
    sound.click();
    gameResult = null;
    busy = false;
    selected = null;
    draft = null;
    save();
    refreshHud();
    renderCouncilBody();
  };
  const again = body.querySelector('[data-retry]');
  if (again) again.onclick = () => {
    sound.click();
    draft = g.wager;
    selected = g.stage;
    gameResult = null;
    busy = false;
    renderCouncilBody();
  };
  const fin = body.querySelector('[data-final]');
  if (fin) fin.onclick = () => {
    sound.click();
    gameResult = null;
    busy = false;
    finishFormula();
  };
  const finTrial = body.querySelector('[data-final-trial]');
  if (finTrial) finTrial.onclick = () => {
    sound.click();
    const win = g.result === 'win';
    gameResult = null;
    busy = false;
    finishTrial(win);
  };
  const finCoup = body.querySelector('[data-final-coup]');
  if (finCoup) finCoup.onclick = () => {
    sound.click();
    const win = g.result === 'win';
    gameResult = null;
    busy = false;
    finishCoup(win);
  };
  syncHead();
}

function renderCouncilBody() {
  if (gameResult) renderGameResult();
  else if (duel) renderDuel();
  else if (selected != null && MEMBERS[selected]) {
    if (state.coupActive) renderChallenge();
    else if (trialAvailable() && selected === PRESIDENT) renderChallenge();
    else renderStake();
  } else renderRoster();
}

function syncHead() {
  const el = document.getElementById('council-sub');
  if (!el) return;
  el.textContent = state.isPresident
    ? '你是會長 · 五席聽命'
    : state.coupActive
      ? '政變中 · 五席全倒才能改寫規矩'
      : state.councilJoined
        ? '學生會成員 · 準備政變或管理學園'
        : trialAvailable()
          ? '入會測驗 · 擊敗會長，加入學生會'
          : '任挑一位成員，贏了賭債一筆勾銷';
}

function beginDuel(index, wager, mode = 'formula') {
  if (busy || state.locked) return;
  const base = MEMBERS[index];
  if (!base) return;
  const m = combatStats(base, mode);

  let credit = 0;
  if (mode === 'formula') {
    const cash = Math.round(state.cash);
    const paid = Math.min(cash, wager);
    credit = wager - paid;
    state.cash -= paid;
    state.shark += credit;
  }
  state.councilAttempts += 1;
  state.formulaFoe = base.name;

  const deck = makeDeck(m.hand);
  const playerHand = deck.splice(0, m.hand);
  const bossHand = deck.splice(0, m.hand);
  const reserve = deck;
  sortHand(playerHand);
  sortHand(bossHand);

  const log = [`${base.name} 坐上了牌桌。`];
  if (mode === 'formula') {
    log.push(`你押上 ${fmt(wager)}${credit ? `（其中 ${fmt(credit)} 由學生會代墊）` : ''}。`);
  } else if (mode === 'trial') {
    log.push('入會測驗開始。沒有下注，只有學生會的位子。');
  } else {
    log.push(`政變第 ${state.coupCleared.length + 1} 席。你帶著 ${m.insight} 次洞察坐上牌桌。`);
  }

  if (m.swap && reserve.length) {
    let low = 0;
    for (let i = 1; i < bossHand.length; i++) if (bossHand[i].rank < bossHand[low].rank) low = i;
    bossHand.splice(low, 1);
    bossHand.push(reserve.splice(Math.floor(Math.random() * reserve.length), 1)[0]);
    sortHand(bossHand);
    log.push(`${base.name} 換掉了一張牌。`);
  }

  const revealed = new Set();
  if (m.reveal > 0) {
    const picks = shuffle(bossHand.map((_, i) => i)).slice(0, m.reveal);
    for (const i of picks) revealed.add(bossHand[i].id);
  }

  duel = {
    stage: index,
    mode,
    member: m,
    baseMember: base,
    wager,
    credit,
    playerHand,
    bossHand,
    reserve,
    revealed,
    playerScore: 0,
    bossScore: 0,
    target: m.target,
    bossTarget: m.bossTarget,
    insight: m.insight,
    turn: 1,
    phase: 'play',
    result: null,
    last: null,
    log
  };
  selected = index;
  draft = null;
  busy = false;
  save();
  refreshHud();
  renderDuel();
  renderCouncilStrip();
  sound.card();
}

function chooseBossCard(playerCard) {
  if (!duel) return 0;
  const m = duel.member;
  const hand = duel.bossHand;
  if (Math.random() < m.blunder) return Math.floor(Math.random() * hand.length);
  if (m.edge > 0 && Math.random() < m.edge) {
    let idx = -1;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].rank > playerCard.rank && (idx < 0 || hand[i].rank < hand[idx].rank)) idx = i;
    }
    if (idx >= 0) return idx;
    idx = 0;
    for (let i = 1; i < hand.length; i++) if (hand[i].rank < hand[idx].rank) idx = i;
    return idx;
  }
  let best = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < hand.length; i++) {
    const b = hand[i];
    let wins = 0;
    for (const p of duel.playerHand) if (b.rank >= p.rank) wins++;
    const val = (wins / Math.max(1, duel.playerHand.length)) * 100 - b.rank * 0.01;
    if (val > bestVal) { bestVal = val; best = i; }
  }
  return best;
}

function playCard(index) {
  if (!duel || duel.phase !== 'play' || busy) return;
  const p = duel.playerHand[index];
  if (!p) return;
  busy = true;
  duel.phase = 'reveal';

  const bIdx = chooseBossCard(p);
  const b = duel.bossHand[bIdx];
  duel.playerHand.splice(index, 1);
  duel.bossHand.splice(bIdx, 1);

  const playerWon = p.rank > b.rank;
  if (playerWon) { duel.playerScore++; sound.chip(); }
  else { duel.bossScore++; sound.flip(); }

  duel.last = { player: p, boss: b, playerWon, round: duel.turn };
  duel.log.push(`第 ${duel.turn} 回合：你 ${p.rank} · ${duel.member.name} ${b.rank} → ${playerWon ? '你贏' : '她贏'}`);
  duel.turn += 1;
  renderDuel();

  setTimeout(() => {
    if (!duel) return;
    if (duel.playerScore >= duel.target) { settleDuel(true); return; }
    if (duel.bossScore >= duel.bossTarget) { settleDuel(false); return; }
    duel.phase = 'play';
    duel.last = null;
    busy = false;
    renderDuel();
  }, 1150);
}

function useInsight() {
  if (!duel || duel.phase !== 'play' || busy || duel.insight <= 0) return;
  const hidden = duel.bossHand.filter(c => !duel.revealed.has(c.id));
  if (!hidden.length) return;
  const pick = hidden[Math.floor(Math.random() * hidden.length)];
  duel.revealed.add(pick.id);
  duel.insight -= 1;
  duel.log.push(`你翻開了 ${duel.member.name} 的一張牌：${pick.rank}。`);
  sound.tone(920, 0.1, 'triangle', 0.035);
  renderDuel();
}

function surrender() {
  if (!duel || duel.phase === 'over' || busy) return;
  const text = duel.mode === 'formula'
    ? `棄權視同落敗：下注 ${fmt(duel.wager)} 不會退還。確定嗎？`
    : duel.mode === 'trial'
      ? '棄權視同入會測驗失敗：你將重新成為家畜，債務回到 NT$10,000,000。確定嗎？'
      : '棄權視同政變失敗：學生會資格會被撤銷，你將重新成為家畜。確定嗎？';
  confirmDialog('棄權', text, '棄權', true)
    .then(ok => { if (ok) settleDuel(false); });
}

function settleDuel(win) {
  if (!duel || duel.phase === 'over') return;
  duel.phase = 'over';
  duel.result = win ? 'win' : 'lose';
  busy = true;

  if (duel.mode === 'formula') settleFormula(win);
  else if (duel.mode === 'trial') settleTrial(win);
  else settleCoup(win);

  save();
  refreshHud();
  renderCouncilStrip();
  renderDuel();
}

function settleFormula(win) {
  const m = duel.member;
  if (win) {
    state.shark = 0;
    state.bank = 0;
    addCash(duel.wager * 2);
    duel.log.push(`公式戰勝利。賭債歸零，拿回 ${fmt(duel.wager * 2)}。`);
    logEvent(`公式戰：擊敗 ${m.name}。賭債歸零，下注雙倍返還。`);
    toast(`擊敗 ${m.name}！賭債歸零，${fmt(duel.wager * 2)} 回到手上`, 'good', 5200);
    sound.win(true);
  } else {
    state.councilLosses += 1;
    state.credit = clamp(state.credit - 5, 0, 100);
    duel.log.push(`公式戰敗北。下注 ${fmt(duel.wager)} 沒收。`);
    logEvent(`公式戰：敗給 ${m.name}。下注 ${fmt(duel.wager)} 沒收。`, 'warn');
    toast(`敗給 ${m.name}，${fmt(duel.wager)} 留在桌上`, 'warn', 4200);
    sound.lose();
    checkEnding();
  }
}

function settleTrial(win) {
  const m = duel.member;
  if (win) {
    state.councilJoined = true;
    state.councilRank = 'member';
    state.isPresident = false;
    state.livestock = false;
    state.admin.prestige = clamp(state.admin.prestige + 10, 0, 100);
    state.admin.treasury += 1000000;
    duel.log.push('入會測驗通過。你成為學生會的一員。');
    logEvent(`入會測驗通過：擊敗 ${m.name}。學生會室已解鎖。`);
    toast('入會測驗通過！學生會室已解鎖', 'good', 5200);
    sound.win(true);
  } else {
    state.shark = JOIN_LOSE_DEBT;
    state.bank = 0;
    state.dueDay = state.day + 14;
    state.warnCount = 0;
    state.repaidToday = 0;
    state.livestock = true;
    state.councilJoined = false;
    state.councilRank = '';
    state.isPresident = false;
    state.credit = clamp(state.credit - 15, 0, 100);
    state.admin.prestige = clamp(state.admin.prestige - 10, 0, 100);
    state.councilLosses += 1;
    duel.log.push('入會測驗失敗。名字被寫回家畜名冊。');
    logEvent(`入會測驗失敗：敗給 ${m.name}。重新成為家畜，債務 ${fmt(JOIN_LOSE_DEBT)}。`, 'warn');
    toast('入會失敗：你重新成為家畜', 'warn', 5200);
    sound.lose();
    checkEnding();
  }
}

function settleCoup(win) {
  const m = duel.member;
  if (win) {
    if (!state.coupCleared.includes(duel.stage)) state.coupCleared.push(duel.stage);
    state.coupMomentum = state.coupCleared.length;
    const final = state.coupCleared.length >= MEMBERS.length;
    if (final) {
      state.isPresident = true;
      state.councilRank = 'president';
      state.councilJoined = true;
      state.livestock = false;
      state.coupActive = false;
      state.admin.prestige = clamp(state.admin.prestige + 40, 0, 100);
      state.admin.oversight = clamp(state.admin.oversight - 20, 0, 100);
      state.admin.treasury += 5000000;
      duel.log.push('五席全倒。你成為學生會長。');
      logEvent('政變成功：五席全倒，你成為學生會長。');
      toast('政變成功！你是新任學生會長', 'good', 6200);
      sound.win(true);
    } else {
      duel.log.push(`政變：${m.name} 倒下，剩餘 ${MEMBERS.length - state.coupCleared.length} 席。`);
      logEvent(`政變：擊敗 ${m.name}，剩餘 ${MEMBERS.length - state.coupCleared.length} 席。`);
      toast(`擊敗 ${m.name}！剩餘 ${MEMBERS.length - state.coupCleared.length} 席`, 'good', 4200);
      sound.win(true);
    }
  } else {
    state.coupActive = false;
    state.coupCleared = [];
    state.coupMomentum = 0;
    state.councilJoined = false;
    state.councilRank = '';
    state.isPresident = false;
    state.livestock = true;
    state.shark = Math.max(state.shark, COUP_LOSE_DEBT);
    state.dueDay = state.day + 14;
    state.warnCount = 0;
    state.repaidToday = 0;
    state.credit = clamp(state.credit - 10, 0, 100);
    state.admin.prestige = clamp(state.admin.prestige - 20, 0, 100);
    state.admin.oversight = clamp(state.admin.oversight + 15, 0, 100);
    state.councilLosses += 1;
    duel.log.push('政變失敗。學生會資格被撤銷。');
    logEvent(`政變失敗：敗給 ${m.name}。學生會資格撤銷，重新成為家畜。`, 'warn');
    toast('政變失敗：學生會資格撤銷', 'warn', 5600);
    sound.lose();
    checkEnding();
  }
}

async function finishFormula() {
  if (busy) return;
  busy = true;
  const foe = state.formulaFoe || '學生會';
  duel = null;
  gameResult = null;
  pendingGame = null;
  selected = null;
  draft = null;
  save();
  refreshHud();
  renderCouncilStrip();
  renderCouncilBody();
  await sleep(260);
  await playFormulaWin(foe);
  busy = false;
  renderCouncilStrip();
  renderCouncilBody();
  refreshHud();
}

async function finishTrial(win) {
  duel = null;
  gameResult = null;
  pendingGame = null;
  selected = null;
  draft = null;
  busy = true;
  save();
  refreshHud();
  renderCouncilStrip();
  renderCouncilBody();
  await sleep(260);
  if (win) {
    await playJoinWin();
    busy = false;
    renderCouncilStrip();
    renderCouncilBody();
    refreshHud();
    router.go('school');
    toast('學生會室已解鎖', 'good', 4200);
  } else {
    await playJoinLose();
    busy = false;
    renderCouncilStrip();
    renderCouncilBody();
    refreshHud();
  }
}

async function finishCoup(win) {
  const final = state.isPresident;
  duel = null;
  gameResult = null;
  pendingGame = null;
  selected = null;
  draft = null;
  busy = true;
  save();
  refreshHud();
  renderCouncilStrip();
  renderCouncilBody();
  await sleep(260);

  if (win && final) {
    await playCoupWin();
    busy = false;
    renderCouncilStrip();
    renderCouncilBody();
    refreshHud();
    router.go('school');
    toast('你現在是學生會長', 'good', 5200);
    return;
  }
  if (win) {
    busy = false;
    renderCouncilStrip();
    renderCouncilBody();
    refreshHud();
    toast(`政變進度 ${state.coupCleared.length}／${MEMBERS.length}`, 'good', 3600);
    return;
  }
  await playCoupLose();
  busy = false;
  renderCouncilStrip();
  renderCouncilBody();
  refreshHud();
}

export async function launchCoup() {
  if (state.isPresident) { toast('你已經是會長了。', 'info'); return; }
  if (!state.councilJoined) { toast('先加入學生會，才有資格發動政變。', 'warn'); return; }
  if (state.coupActive) { toast('政變已經開始了。', 'warn'); return; }
  if (totalDebt() > 0) { toast('先把債務清乾淨，政變才有號召力。', 'warn'); return; }
  const ok = await confirmDialog(
    '發動政變',
    '一旦發動政變，就必須擊敗學生會五席（會長最後）。\n中途落敗會失去學生會資格，重新成為家畜，債務回到 NT$5,000,000。\n\n確定要掀桌嗎？',
    '發動政變', true
  );
  if (!ok) return;
  state.coupActive = true;
  state.coupCleared = [];
  state.coupMomentum = 0;
  selected = null;
  duel = null;
  busy = false;
  save();
  logEvent('你發動政變：學生會五席，會長最後。', 'warn');
  renderCouncilStrip();
  renderCouncilBody();
  refreshHud();
  await playCoupStart();
  renderCouncilStrip();
  renderCouncilBody();
  refreshHud();
  if (router.current !== 'council') router.go('council');
}

export function renderCouncilStrip() {
  const strip = document.getElementById('council-strip');
  if (!strip) return;
  strip.innerHTML = MEMBERS.map((m, i) => {
    let status = '挑戰';
    let cls = '';
    if (state.isPresident) { status = '會長'; cls = 'done'; }
    else if (state.coupActive) {
      if (state.coupCleared.includes(i)) { status = '已倒'; cls = 'done'; }
      else if (i === PRESIDENT && state.coupCleared.length < MEMBERS.length - 1) { status = '最後'; cls = 'locked'; }
      else { status = '政變'; cls = 'coup'; }
    } else if (state.councilJoined) { status = '內閣'; cls = 'done'; }
    else if (trialAvailable()) {
      status = i === PRESIDENT ? '測驗' : '結束';
      cls = i === PRESIDENT ? 'trial' : 'locked';
    }
    return `
      <button class="council-mini ${cls}" data-council-go="${i}">
        <span class="cm-portrait ${m.cls}">${m.init}</span>
        <span class="cm-info"><b>${m.name}</b><small>${m.title}</small><em>${'◆'.repeat(m.diff)}</em></span>
        <span class="cm-status">${status}</span>
      </button>`;
  }).join('');
  strip.querySelectorAll('[data-council-go]').forEach(btn => {
    btn.onclick = () => {
      sound.init();
      sound.click();
      const i = Number(btn.dataset.councilGo);
      if (state.isPresident) { toast('你現在是會長。', 'info'); return; }
      if (state.councilJoined && !state.coupActive) {
        if (router.current !== 'council') router.go('council');
        toast('前往學生會室，或直接在學生會頁面發動政變。', 'info', 3600);
        return;
      }
      if (trialAvailable() && i !== PRESIDENT) {
        toast('債務已清，只剩會長的入會測驗。', 'warn');
        return;
      }
      if (state.coupActive) {
        if (state.coupCleared.includes(i)) { toast('這一席已經倒下了。', 'info'); return; }
        if (i === PRESIDENT && state.coupCleared.length < MEMBERS.length - 1) {
          toast('會長必須最後挑戰。', 'warn');
          return;
        }
      }
      selectMember(i);
      router.go('council');
    };
  });
}

function renderShell() {
  const el = root();
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost" data-back>← 學園</button>
      <h2>學生會</h2>
      <span class="sub" id="council-sub">任挑一位成員，贏了賭債一筆勾銷</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>
    <div id="council-body"></div>`;
  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('council');
}

export function enterCouncil() {
  renderShell();
  if (duel && duel.phase === 'over') duel = null;
  if (!duel) busy = false;
  if (state.councilJoined && !state.coupActive) {
    selected = null;
    draft = null;
  }
  renderCouncilBody();
  renderCouncilStrip();
  syncHead();
}

export function leaveCouncil() {
  if (duel && duel.phase === 'over') duel = null;
  gameResult = null;
  if (!duel) {
    busy = false;
    selected = null;
    draft = null;
  }
}

export function canLeaveCouncil() {
  if (duel && duel.phase !== 'over') {
    toast('對局進行中，不能中途離席。', 'warn');
    return false;
  }
  return true;
}
