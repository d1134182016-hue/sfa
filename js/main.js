import {
  state, save, load, hasSave, startNewGame, deleteSave,
  router, events, refreshHud, totalDebt, fmt,
  chapterName, openModal, confirmDialog, openJournal, toast, sound
} from './core.js';
import { checkStory } from './story.js';
import { renderLoans } from './loans.js';
import {
  enterCouncil, leaveCouncil, canLeaveCouncil, renderCouncilStrip
} from './games/council.js';
import {
  enterSchool, leaveSchool, canLeaveSchool
} from './school.js';
import {
  enterBlackjack, leaveBlackjack, canLeaveBlackjack
} from './games/blackjack.js';
import {
  enterSlots, leaveSlots, canLeaveSlots
} from './games/slots.js';
import {
  enterNiuniu, leaveNiuniu, canLeaveNiuniu
} from './games/niuniu.js';
import {
  enterSetPoker, leaveSetPoker, canLeaveSetPoker
} from './games/setpoker.js';
import {
  enterHoldem, leaveHoldem, canLeaveHoldem
} from './games/holdem.js';
import {
  enterThreeCard, leaveThreeCard, canLeaveThreeCard
} from './games/threecard.js';
import {
  enterSicBo, leaveSicBo, canLeaveSicBo
} from './games/sicbo.js';
import {
  enterScratch, leaveScratch, canLeaveScratch
} from './games/scratch.js';
import {
  enterPachinko, leavePachinko, canLeavePachinko
} from './games/pachinko.js';
import {
  enterMahjong, leaveMahjong, canLeaveMahjong
} from './games/mahjong.js';
import {
  enterVotingScissors, leaveVotingScissors, canLeaveVotingScissors
} from './games/voteRps.js';
import {
  enterPeople, leavePeople, canLeavePeople
} from './people.js';

const VIEWS = [
  'lobby', 'holdem', 'blackjack', 'niuniu', 'setpoker', 'threecard',
  'sicbo', 'slots', 'scratch', 'pachinko', 'mahjong', 'votingscissors',
  'council', 'school', 'loans', 'people'
];
const GAME_VIEWS = [
  'holdem', 'blackjack', 'niuniu', 'setpoker', 'threecard',
  'sicbo', 'slots', 'scratch', 'pachinko', 'mahjong', 'votingscissors'
];

const GAMES = [
  {
    view: 'holdem', icon: '♠', name: '德州撲克', hot: '主線',
    desc: '學生會幹部桌。盲注依買入放大，你要贏的不是牌，是他們的從容。',
    stake: '買入 25 萬起', right: '邊池完整'
  },
  {
    view: 'blackjack', icon: '♦', name: '21 點',
    desc: '六副牌靴，莊家 17 停。規則最簡單，也最容易把人變成家畜。',
    stake: '最低 10,000', right: 'BJ 3:2'
  },
  {
    view: 'niuniu', icon: '★', name: '妞妞',
    desc: '五張牌湊十。莊家贏同點，想贏就得更硬。',
    stake: '最低 10,000', right: '最高 5 倍'
  },
  {
    view: 'setpoker', icon: '♣', name: '十三支',
    desc: '前 3、中 5、後 5。排錯順序，牌再好都不算。',
    stake: '底注 10,000 起', right: '全壘打 +2'
  },
  {
    view: 'threecard', icon: '♤', name: '三張牌', hot: '新桌',
    desc: '三張決勝。莊家 Q 以上才成局，規則是學生會寫的。',
    stake: '底注 10,000 起', right: '對子注 40:1'
  },
  {
    view: 'votingscissors', icon: '拳', name: '投票猜拳', hot: '第一集',
    desc: '一對一，各抽三張手牌。平手就換下一張，先拿下一回合的人贏。',
    stake: '每注 10,000 起', right: '三張決勝'
  },
  {
    view: 'sicbo', icon: '⚂', name: '骰寶',
    desc: '三顆骰子，大、小、單、雙與點數和。豹子一開，全場安靜。',
    stake: '每注 10,000 起', right: '最高 60:1'
  },
  {
    view: 'slots', icon: '▦', name: '拉霸機',
    desc: '三輪五線，鑽石 750 倍。運氣也是實力的一種。',
    stake: '每線 1,000 起', right: '5 條連線'
  },
  {
    view: 'scratch', icon: '▤', name: '刮刮樂',
    desc: '九格銀箔，三格連線。刮開之前，人人平等。',
    stake: '面額 10,000 起', right: '最高 500 倍'
  },
  {
    view: 'pachinko', icon: '◉', name: '小鋼珠',
    desc: '釘子不會可憐你。力道、角度、倍率與格子數，都自己選。',
    stake: '每顆 10,000 起', right: '0.1×–512×'
  },
  {
    view: 'mahjong', icon: '中', name: '二人麻將', hot: '新桌',
    desc: '兩個人、一副牌。摸牌、碰牌、胡牌，慢，但每一張都算數。',
    stake: '底注 10,000 起', right: '自摸 2 倍'
  }
];

const LOBBY_TEXT = [
  '百花王學園的規矩很簡單：有錢的人說話，沒錢的人變成家畜。你欠了一千萬，十四天內還不出來，名字就會從名冊上消失。',
  '一千萬，你已經還掉一半。學生會開始注意你，他們的笑容比利息更貴。',
  '理事會的門開了。低利融資不是善意，是把繩子換成更細的一條。',
  '最後一段路。牌桌上是你的籌碼，也是你留在這所學園的資格。',
  '債務清乾淨了。現在你有資格走進學生會，但會長會親自告訴你——位子不是還錢就能坐的。',
  '政變沒有退路。五席全倒，規矩就換你寫；倒下一次，名字就回到名冊上。'
];

const enter = {
  lobby: () => { updateLobbyText(); refreshHud(); renderCouncilStrip(); },
  loans: () => { renderLoans(); },
  council: () => { enterCouncil(); },
  school: () => { enterSchool(); },
  holdem: () => { enterHoldem(); },
  blackjack: () => { enterBlackjack(); },
  niuniu: () => { enterNiuniu(); },
  slots: () => { enterSlots(); },
  setpoker: () => { enterSetPoker(); },
  threecard: () => { enterThreeCard(); },
  sicbo: () => { enterSicBo(); },
  scratch: () => { enterScratch(); },
  pachinko: () => { enterPachinko(); },
  mahjong: () => { enterMahjong(); },
  votingscissors: () => { enterVotingScissors(); },
  people: () => { enterPeople(); }
};

const leave = {
  council: () => { leaveCouncil(); },
  school: () => { leaveSchool(); },
  holdem: () => { leaveHoldem(); },
  blackjack: () => { leaveBlackjack(); },
  niuniu: () => { leaveNiuniu(); },
  slots: () => { leaveSlots(); },
  setpoker: () => { leaveSetPoker(); },
  threecard: () => { leaveThreeCard(); },
  sicbo: () => { leaveSicBo(); },
  scratch: () => { leaveScratch(); },
  pachinko: () => { leavePachinko(); },
  mahjong: () => { leaveMahjong(); },
  votingscissors: () => { leaveVotingScissors(); },
  people: () => { leavePeople(); }
};

const guards = {
  council: canLeaveCouncil,
  school: canLeaveSchool,
  holdem: canLeaveHoldem,
  blackjack: canLeaveBlackjack,
  niuniu: canLeaveNiuniu,
  slots: canLeaveSlots,
  setpoker: canLeaveSetPoker,
  threecard: canLeaveThreeCard,
  sicbo: canLeaveSicBo,
  scratch: canLeaveScratch,
  pachinko: canLeavePachinko,
  mahjong: canLeaveMahjong,
  votingscissors: canLeaveVotingScissors,
  people: canLeavePeople
};

function go(view) {
  if (!VIEWS.includes(view)) return;
  if (view === router.current) return;

  if (state.locked && view !== 'lobby') {
    showEnding({ kind: 'bad', reason: state.warnCount >= 3 ? 'collector' : 'debt' });
    return;
  }

  if (view === 'school' && !state.councilJoined && !state.isPresident) {
    toast('先加入學生會，才能進入學生會室。', 'warn');
    return;
  }

  const guard = guards[router.current];
  if (guard && !guard()) return;

  const lv = leave[router.current];
  if (lv) {
    try { lv(); } catch (e) { console.error(e); }
  }

  router.current = view;
  for (const el of document.querySelectorAll('.view')) {
    el.classList.toggle('active', el.id === 'view-' + view);
  }
  for (const el of document.querySelectorAll('.nav-item[data-view]')) {
    el.classList.toggle('active', el.dataset.view === view);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try { enter[view] && enter[view](); } catch (e) { console.error('[enter]', view, e); }
  refreshHud();
  setTimeout(() => checkStory(), 260);
}

router.go = go;

/* ---------------- 大廳 ---------------- */

function renderLobby() {
  const grid = document.getElementById('game-grid');
  if (!grid || grid.dataset.ready) return;
  grid.dataset.ready = '1';
  grid.innerHTML = GAMES.map(g => `
    <button class="game-card" data-view="${g.view}">
      ${g.hot ? `<span class="hot">${g.hot}</span>` : ''}
      <span class="game-icon">${g.icon}</span>
      <h3>${g.name}</h3>
      <p>${g.desc}</p>
      <div class="stakes"><span>${g.stake}</span><b>${g.right}</b></div>
    </button>`).join('');
  grid.querySelectorAll('[data-view]').forEach(btn => {
    btn.onclick = () => { sound.init(); sound.click(); go(btn.dataset.view); };
  });
  renderCouncilStrip();
}

function updateLobbyText() {
  const el = document.getElementById('lobby-story');
  if (el) el.textContent = LOBBY_TEXT[Math.min(state.chapter, LOBBY_TEXT.length - 1)] || LOBBY_TEXT[0];
  const chap = document.getElementById('lobby-chapter');
  if (chap) chap.textContent = chapterName();
}

/* ---------------- 開場 ---------------- */

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('hide');
  setTimeout(() => { splash.style.display = 'none'; }, 480);
}

function beginNewGame() {
  const doIt = () => {
    const splash = document.getElementById('splash');
    if (splash) splash.classList.add('hide');
    try {
      deleteSave();
      startNewGame();
      const url = new URL(location.href);
      url.searchParams.set('new', '1');
      location.replace(url.toString());
    } catch (e) {
      console.error(e);
      renderLobby();
      updateLobbyText();
      refreshHud();
      router.current = 'lobby';
      for (const el of document.querySelectorAll('.view')) el.classList.toggle('active', el.id === 'view-lobby');
      for (const el of document.querySelectorAll('.nav-item[data-view]')) el.classList.toggle('active', el.dataset.view === 'lobby');
      setTimeout(() => checkStory(), 300);
      toast('重新開始時發生問題，已直接載入新局。', 'warn', 5000);
    }
  };
  if (hasSave()) {
    confirmDialog('重新開始', '目前的進度、欠款與牌桌籌碼都會消失。確定要重新開始嗎？', '重新開始', true)
      .then(ok => { if (ok) doIt(); });
    return;
  }
  doIt();
}

function continueGame() {
  if (!load()) {
    beginNewGame();
    return;
  }
  sound.enabled = !!state.settings.sound;
  hideSplash();
  renderLobby();
  updateLobbyText();
  refreshHud();
  router.current = 'lobby';
  for (const el of document.querySelectorAll('.view')) {
    el.classList.toggle('active', el.id === 'view-lobby');
  }
  for (const el of document.querySelectorAll('.nav-item[data-view]')) {
    el.classList.toggle('active', el.dataset.view === 'lobby');
  }
  if (state.locked) {
    showEnding({ kind: 'bad', reason: state.warnCount >= 3 ? 'collector' : 'debt' });
    return;
  }
  setTimeout(() => checkStory(), 500);
}

function bindSplash() {
  const cont = document.getElementById('btn-continue');
  const neu = document.getElementById('btn-new');
  if (!cont || !neu) return;
  if (hasSave()) cont.classList.remove('hidden');
  else neu.textContent = '開始遊戲';
  cont.onclick = () => { sound.init(); sound.click(); continueGame(); };
  neu.onclick = () => {
    sound.init();
    sound.click();
    beginNewGame();
  };
}

/* ---------------- 結局 ---------------- */

function showEnding(info) {
  const layer = document.getElementById('ending-layer');
  if (!layer) return;
  layer.classList.remove('hidden');
  const kicker = document.getElementById('ending-kicker');
  const title = document.getElementById('ending-title');
  const text = document.getElementById('ending-text');
  const stats = document.getElementById('ending-stats');
  const actions = document.getElementById('ending-actions');
  actions.innerHTML = '';

  const formula = info.reason === 'formula' || state.endingReason === 'formula';
  const foe = state.formulaFoe || '學生會';
  const statHTML = `
    <div class="ending-stat"><span>撐過天數</span><b>${state.day} 天</b></div>
    <div class="ending-stat"><span>總還款</span><b>${fmt(state.stats.repaid)}</b></div>
    <div class="ending-stat"><span>牌桌局數</span><b>${state.stats.rounds}</b></div>
    <div class="ending-stat"><span>單局最高</span><b>${fmt(state.stats.bestWin)}</b></div>
    <div class="ending-stat"><span>公式戰</span><b>${formula ? '擊敗 ' + foe : '未挑戰'}</b></div>`;
  stats.innerHTML = statHTML;

  if (info.kind === 'good') {
    kicker.textContent = formula ? 'GOOD ENDING · 公式戰勝利' : 'GOOD ENDING · 清償';
    title.textContent = formula ? '學生會，換你坐' : '債務歸零';
    text.textContent = formula
      ? `${foe}輸了。\n最後一張牌落下時，桃喰綺羅莉笑了。\n「你贏了。從今天起，你不是家畜。」\n\n債務歸零，學園的規矩仍然沒有改變——\n只是這次，寫規則的人有你。`
      : '一千萬，一分不少。\n桃喰綺羅莉收起契約，早乙女芽亞里把最後一副牌洗回牌靴。\n你走出百花王學園的時候，天剛好亮。\n\n這一次，你沒有回頭。';
    const again = document.createElement('button');
    again.className = 'btn gold';
    again.textContent = '再玩一次';
    again.onclick = () => { sound.click(); beginNewGame(); };
    const back = document.createElement('button');
    back.className = 'btn ghost';
    back.textContent = '到處走走';
    back.onclick = () => { sound.click(); layer.classList.add('hidden'); go('lobby'); };
    actions.appendChild(again);
    actions.appendChild(back);
    sound.win(true);
  } else {
    const collector = info.reason === 'collector';
    kicker.textContent = 'BAD ENDING · ' + (collector ? '家畜' : '退學');
    title.textContent = collector ? '家畜小屋' : '名冊上沒有你';
    text.textContent = collector
      ? '第三次催收，門外沒有敲門聲。\n學生會的人把你的名字從名冊上劃掉，換成家畜小屋的編號。\n百花王學園的燈還亮著，只是不再為你留位子。'
      : '欠款滾過了三千萬。\n你已經記不起自己原本只是想還一千萬。\n牌桌還在，但沒有人再看你的眼睛。';
    const again = document.createElement('button');
    again.className = 'btn gold';
    again.textContent = '重新開始';
    again.onclick = () => { sound.click(); beginNewGame(); };
    const journal = document.createElement('button');
    journal.className = 'btn ghost';
    journal.textContent = '查看記事';
    journal.onclick = () => { sound.click(); layer.classList.add('hidden'); openJournal(); };
    actions.appendChild(again);
    actions.appendChild(journal);
    sound.alarm();
  }
}

/* ---------------- 設定 ---------------- */

function openMenu() {
  sound.init();
  sound.click();
  openModal({
    title: '設定與說明',
    html: `
      <p style="color:#8f8a7e">狂賭之淵 · 家畜之夜　v2.1</p>
      <p style="margin-top:10px">百花王學園主題的單機娛樂作品。所有賭局、金錢與債務都是虛擬的。</p>
      <p style="margin-top:10px">進度會自動存在瀏覽器裡。關閉頁面前不必手動存檔。</p>
      <p style="margin-top:10px;color:#e6a3ab">公式戰：五位學生會成員任挑一位，下注沒有上限；贏了賭債歸零。</p>
      <p style="margin-top:8px;color:#e6a3ab">清償後挑戰會長加入學生會，解鎖學生會室。政變五席全倒，你就是會長。</p>
    `,
    buttons: [
      {
        label: sound.enabled ? '音效：開' : '音效：關',
        kind: 'ghost',
        keepOpen: true,
        onClick: () => { sound.setEnabled(!sound.enabled); openMenu(); }
      },
      {
        label: '重新開始', kind: 'ghost',
        onClick: () => { setTimeout(() => beginNewGame(), 60); }
      },
      {
        label: '清除存檔', kind: 'danger',
        onClick: () => {
          setTimeout(() => {
            confirmDialog('清除存檔', '本機的遊戲進度會被刪除，無法復原。', '刪除', true)
              .then(ok => {
                if (!ok) return;
                deleteSave();
                location.reload();
              });
          }, 60);
        }
      },
      { label: '關閉', kind: 'gold' }
    ]
  });
}

/* ---------------- 啟動 ---------------- */

function bindGlobal() {
  for (const el of document.querySelectorAll('.nav-item[data-view]')) {
    el.addEventListener('click', () => { sound.init(); sound.click(); go(el.dataset.view); });
  }
  const storyBtn = document.getElementById('nav-story');
  if (storyBtn) storyBtn.addEventListener('click', () => { sound.click(); openJournal(); });
  const lobbyStory = document.getElementById('lobby-story-btn');
  if (lobbyStory) lobbyStory.addEventListener('click', () => { sound.click(); openJournal(); });
  const pay = document.getElementById('lobby-pay');
  if (pay) pay.addEventListener('click', () => { sound.click(); go('loans'); });
  const councilMore = document.getElementById('council-more');
  if (councilMore) councilMore.addEventListener('click', () => {
    sound.init();
    sound.click();
    go(state.councilJoined || state.isPresident ? 'school' : 'council');
  });
  const loan = document.getElementById('btn-loan');
  if (loan) loan.addEventListener('click', () => { sound.init(); sound.click(); go('loans'); });
  const brand = document.getElementById('brand-home');
  if (brand) brand.addEventListener('click', () => { sound.click(); go('lobby'); });
  const soundBtn = document.getElementById('btn-sound');
  if (soundBtn) soundBtn.addEventListener('click', () => {
    sound.init();
    sound.setEnabled(!sound.enabled);
    toast(sound.enabled ? '音效已開啟' : '音效已關閉', 'info', 1600);
  });
  const menu = document.getElementById('btn-menu');
  if (menu) menu.addEventListener('click', openMenu);

  const unlock = () => sound.init();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  window.addEventListener('beforeunload', () => { try { save(); } catch (e) { } });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { try { save(); } catch (e) { } }
  });

  events.on('ending', showEnding);
}

function boot() {
  renderLobby();
  updateLobbyText();
  bindGlobal();
  refreshHud();
  bindSplash();

  const params = new URLSearchParams(location.search);
  const freshStart = params.get('new') === '1';
  if (freshStart) {
    params.delete('new');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }
  let autostart = false;
  try {
    autostart = sessionStorage.getItem('jinhe.autostart') === '1';
    if (autostart) sessionStorage.removeItem('jinhe.autostart');
  } catch (e) { }
  if (freshStart || autostart) {
    if (load()) {
      sound.enabled = !!state.settings.sound;
      hideSplash();
      updateLobbyText();
      refreshHud();
      setTimeout(() => checkStory(), 650);
    }
  }

  window.__JINHE__ = { state, router, save, refreshHud, renderLoans, renderCouncilStrip };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
