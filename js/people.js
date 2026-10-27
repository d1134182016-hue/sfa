import {
  state, fmt, clamp, save, refreshHud, toast, logEvent, router,
  openModal, mountBetRange, sound, esc,
  spendCash, addCash, recordRound, advanceTime
} from './core.js';
import { STUDENTS, studentById } from './cast.js';
import { setChallenge, challengeActive } from './challenge.js';

const root = () => document.getElementById('view-people');

const GAME_LIST = ['blackjack', 'mahjong', 'holdem', 'votingscissors'];
const GAME_NAMES = {
  blackjack: '21 點', mahjong: '二人麻將', holdem: '德州撲克', votingscissors: '投票猜拳'
};
const GAME_ICONS = { blackjack: '♦', mahjong: '中', holdem: '♠', votingscissors: '拳' };
const FACTION_WAGER = { 學生會: 100000, 絕對中立委員會: 50000, 一般學生: 20000 };
const FACTION_BASE = { 學生會: 18, 絕對中立委員會: 14, 一般學生: 12 };

const CAST_GAME = {
  kirari: 'holdem', sayaka: 'blackjack', yumemi: 'holdem', yuriko: 'mahjong',
  midari: 'blackjack', kaede: 'blackjack', runa: 'mahjong', mitsuyo: 'holdem',
  miri: 'blackjack', erine: 'mahjong', yumeko: 'holdem', mary: 'votingscissors',
  ryota: 'blackjack', mira: 'mahjong', nozomi: 'blackjack', ouri: 'holdem',
  ibara: 'mahjong', rin: 'blackjack', ririka: 'mahjong', tsuzura: 'votingscissors'
};

const CAST_LINES = {
  kirari: [
    '先別急著下注。讓我看看你輸的時候，眼睛會往哪裡看。',
    '你覺得自己在贏，是因為我還沒開始算。'
  ],
  sayaka: [
    '契約我看過了。條款沒有問題，問題在你簽名的速度。',
    '會長的規矩很簡單：帳要對，牌要乾淨。'
  ],
  yumemi: [
    '燈光亮起來的時候，觀眾只會記得贏家。你要不要站到光裡？',
    '門票賣完了。現在只剩你的籌碼還在上頭。'
  ],
  yuriko: [
    '你現在的樣子，很像一個還沒發現自己是生贄的人。',
    '別擔心，我會讓你輸得很有儀式感。'
  ],
  midari: [
    '輸贏太無聊了。你告訴我，你願意押到哪裡為止？',
    '手別抖。抖了，我就知道你怕了。'
  ],
  kaede: [
    '你的勝率我算過了。坐下來之前，要先聽答案嗎？',
    '莊家的優勢不在牌，在你有沒有耐心。'
  ],
  runa: [
    '我只記錄，不評論。但今天的帳，你最好自己再看一遍。',
    '中立不是站在你這邊，是還沒有人給我理由。'
  ],
  mitsuyo: [
    '你剛剛的猶豫，比你的牌更值得記下來。',
    '看久一點。牌桌會自己說話。'
  ],
  miri: [
    '我可以幫你談，但談完之後的帳，還是要你自己付。',
    '別急著答應。最後一行通常最重要。'
  ],
  erine: [
    '一筆錯了，整本都不能信。你確定你的籌碼沒有少算？',
    '我只看數字。數字不會替你說謊。'
  ],
  yumeko: [
    '再押一點嘛。輸贏不重要，重要的是心跳。',
    '你剛剛遲疑了。那一瞬間，比贏牌還有趣。'
  ],
  mary: [
    '被寫進名冊不可怕。可怕的是你開始習慣那個名字。',
    '想翻身就別看別人的表情，看牌。'
  ],
  ryota: [
    '我查過了，這場的規矩沒有陷阱……應該吧。',
    '你還有籌碼嗎？借我一點，我下次一定還。'
  ],
  mira: [
    '名冊上的名字，比桌上的籌碼還便宜。',
    '我記得你上次輸在哪一手。'
  ],
  nozomi: [
    '這個月的月錢……我、我還沒湊齊。',
    '贏一點就收手，好不好？我真的怕。'
  ],
  ouri: [
    '要買情報嗎？這場誰會贏，我大概知道一點。',
    '錢會花完，情報不會。你選哪個？'
  ],
  ibara: [
    '要我低頭可以。先把利息算清楚。',
    '你贏不了的。不是牌的問題，是你太客氣。'
  ],
  rin: [
    '我只是想贏一次。一次就好。',
    '這次我押多一點……會不會太衝動？'
  ],
  ririka: [
    '姐姐的遊戲，我也想看結局。',
    '你覺得她會讓你贏嗎？我很好奇。'
  ],
  tsuzura: [
    '偶像研究會什麼都聽得到。要買消息嗎？',
    '今晚這桌會出事。你最好先想清楚。'
  ]
};

const STYLE_LINES = {
  cold: ['我算過你現在的處境。你確定還要繼續？', '衝動是成本。你剛剛已經付了一次。'],
  hot: ['小注沒意思。整疊推出來，我們再看牌。', '輸光也沒關係，至少這一局夠響。'],
  grinder: ['一次贏一點就好。桌子會記得誰留到最後。', '我不急。急的人通常先走。'],
  bluffer: ['你看不出來的。牌面看不出來，我臉上也不會。', '加注吧。你確定我手上是爛牌？'],
  lucky: ['今天的月色不錯。運氣站在我這邊。', '你信不信，我剛剛就覺得會是這張。'],
  observe: ['你摸了三次耳垂。那副牌，應該不怎麼樣。', '先別急。你的呼吸已經告訴我答案了。'],
  greedy: ['賠率越高越好。風險是輸的人才會算的東西。', '再開一格。就差一點了。'],
  timid: ['贏一點就夠了……真的，這次收手就好。', '我、我只是想確認一下，現在走還來得及嗎？']
};

const FACTION_LINES = {
  學生會: ['學生會的桌子，規矩比牌重要。', '你可以贏，但要先學會不要怕輸。'],
  絕對中立委員會: ['我只要求帳目對得上。', '先看清楚規則，再坐下。'],
  一般學生: ['這個月的月錢，就靠這一局了。', '贏一次就好。真的，一次就好。']
};

const GIFTS = [
  { amount: 10000, gain: 1, label: '1 萬' },
  { amount: 50000, gain: 2, label: '5 萬' },
  { amount: 200000, gain: 5, label: '20 萬' }
];

const TIERS = [
  { min: 85, label: '宿命的對手', cls: 't6' },
  { min: 70, label: '賭桌上的熟人', cls: 't5' },
  { min: 55, label: '常客', cls: 't4' },
  { min: 40, label: '牌友', cls: 't3' },
  { min: 25, label: '點頭之交', cls: 't2' },
  { min: 10, label: '打過照面', cls: 't1' },
  { min: 0, label: '陌生', cls: 't0' }
];

let filter = 'all';
let search = '';

function initialAffinity(id) {
  const c = studentById(id);
  if (!c) return 10;
  if (typeof c.baseAffinity === 'number') return c.baseAffinity;
  return FACTION_BASE[c.faction] ?? 12;
}

export function personState(id) {
  if (!state.people || typeof state.people !== 'object') state.people = {};
  let p = state.people[id];
  if (!p || typeof p !== 'object') {
    p = state.people[id] = {
      affinity: initialAffinity(id), wins: 0, losses: 0,
      chats: 0, gifts: 0, invites: 0, chatDay: 0, giftDay: 0
    };
  }
  if (typeof p.affinity !== 'number') p.affinity = initialAffinity(id);
  p.wins = Number(p.wins) || 0;
  p.losses = Number(p.losses) || 0;
  p.chats = Number(p.chats) || 0;
  p.gifts = Number(p.gifts) || 0;
  p.invites = Number(p.invites) || 0;
  p.chatDay = Number(p.chatDay) || 0;
  p.giftDay = Number(p.giftDay) || 0;
  p.affinity = clamp(Math.round(p.affinity), 0, 100);
  return p;
}

export function affinityOf(id) {
  const p = state.people && state.people[id];
  return p && typeof p.affinity === 'number' ? clamp(Math.round(p.affinity), 0, 100) : initialAffinity(id);
}

export function affinityTier(aff) {
  return TIERS.find(t => aff >= t.min) || TIERS[TIERS.length - 1];
}

export function affinityLabel(aff) {
  return affinityTier(aff).label;
}

function preferredGame(c) {
  return c.game || CAST_GAME[c.id] || 'blackjack';
}

function wagerCap(c) {
  return 100000 + affinityOf(c.id) * 10000;
}

const round10k = v => Math.floor(v / 10000) * 10000;

function maxWagerOf(c) {
  return Math.max(0, Math.min(round10k(state.cash), round10k(wagerCap(c))));
}

function pickLine(c) {
  const pool = CAST_LINES[c.id] || STYLE_LINES[c.style] || FACTION_LINES[c.faction] || FACTION_LINES['一般學生'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function livestockInfo(id) {
  const lv = state.admin && Array.isArray(state.admin.livestock)
    ? state.admin.livestock.find(e => e.id === id)
    : null;
  if (!lv) return '';
  return `
    <div class="pm-livestock">
      <b>家畜名冊</b>
      <span>上納 ${fmt(Math.round(state.admin.tribute * lv.mult))} · 倍率 ×${lv.mult}</span>
    </div>`;
}

function affBarHTML(aff) {
  const tier = affinityTier(aff);
  return `
    <div class="pp-aff"><i class="${tier.cls}" style="width:${aff}%"></i></div>
    <div class="pp-meta"><span class="pp-tier ${tier.cls}">${tier.label}</span><span>好感 ${aff}／100</span></div>`;
}

/* ---------------- 人物檔案 ---------------- */

export function openPersonModal(id, opts = {}) {
  const c = studentById(id);
  if (!c) return;
  const ps = personState(id);
  const aff = ps.affinity;
  const game = preferredGame(c);
  const maxW = maxWagerOf(c);
  const note = opts.note
    ? `<div class="pm-note">${opts.note}</div>`
    : '';
  const chatReady = ps.chatDay !== state.day;
  const giftReady = ps.giftDay !== state.day;

  openModal({
    title: c.name,
    wide: true,
    html: `
      <div class="person-modal">
        <div class="story-avatar ${c.cls}">${c.init}</div>
        <div class="pm-main">
          <div class="pm-title">${esc(c.title.includes(c.faction) ? c.title : `${c.title} · ${c.faction}`)}</div>
          <div class="pm-meta">${esc(c.grade)} · 血型 ${esc(c.blood)} · 生日 ${esc(c.birthday)}</div>
          <p class="pm-quote">${c.quote}</p>
          <p class="pm-bio">${c.bio}</p>
          <div class="pm-tags">${c.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          ${livestockInfo(id)}
          ${note}

          <div class="pm-affinity">
            <div class="pm-aff-head"><span>好感度</span><b class="${affinityTier(aff).cls}">${affinityLabel(aff)} ${aff}</b></div>
            ${affBarHTML(aff)}
            <div class="pm-record">
              <span>賭局 <b>${ps.wins} 勝 ${ps.losses} 敗</b></span>
              <span>閒聊 <b>${ps.chats} 次</b></span>
              <span>送禮 <b>${ps.gifts} 次</b></span>
              <span>受邀 <b>${ps.invites} 次</b></span>
            </div>
          </div>

          <div class="pm-invite-note">
            偏好賭局：<b>${GAME_ICONS[game]} ${GAME_NAMES[game]}</b>
            · 下注上限 <b>${maxW >= 10000 ? fmt(maxW) : '籌碼不足'}</b>
            <small>（好感度越高，願意跟你賭的注碼越大。贏了拿回 2 倍，平手退注。）</small>
          </div>
        </div>
      </div>`,
    buttons: [
      {
        label: chatReady ? '閒聊' : '今天聊過了',
        kind: 'ghost',
        keepOpen: true,
        onClick: () => doChat(c)
      },
      {
        label: giftReady ? '送籌碼' : '今天送過了',
        kind: 'ghost',
        keepOpen: true,
        onClick: () => openGift(c)
      },
      {
        label: '賭博邀請',
        kind: 'gold',
        keepOpen: true,
        onClick: () => openInvite(c.id)
      },
      { label: '關閉', kind: 'ghost' }
    ]
  });
}

function doChat(c) {
  const ps = personState(c.id);
  if (ps.chatDay === state.day) {
    toast('今天已經聊過了，明天再來。', 'info');
    return;
  }
  if (state.locked) return;
  ps.chatDay = state.day;
  ps.chats += 1;
  ps.affinity = clamp(ps.affinity + 1, 0, 100);
  const line = pickLine(c);
  sound.click();
  logEvent(`你和 ${c.name} 聊了一會。好感度 +1。`);
  save();
  openPersonModal(c.id, {
    note: `<b>${esc(c.name)}</b>：${esc(line)}<em>好感度 +1</em>`
  });
}

function openGift(c) {
  const ps = personState(c.id);
  if (ps.giftDay === state.day) {
    toast('今天已經送過籌碼了，明天再來。', 'info');
    return;
  }
  if (state.locked) return;
  const buttons = GIFTS.map(g => ({
    label: `${g.label}籌碼 · 好感 +${g.gain}`,
    kind: 'ghost',
    keepOpen: true,
    onClick: () => doGift(c, g)
  }));
  buttons.push({ label: '取消', kind: 'gold' });
  openModal({
    title: `送籌碼給 ${c.name}`,
    html: `<p class="pm-gift-note">送出去的籌碼不會退還。對方收下之後，好感度會上升，之後願意跟你賭的金額也會提高。<br>目前現金：<b>${fmt(state.cash)}</b>　今天${ps.giftDay === state.day ? '已送過' : '還沒送'}。</p>`,
    buttons
  });
}

function doGift(c, gift) {
  const ps = personState(c.id);
  if (ps.giftDay === state.day) { toast('今天已經送過籌碼了。', 'info'); return; }
  if (state.cash < gift.amount) { toast('現金不足。', 'warn'); return; }
  if (!spendCash(gift.amount)) return;
  ps.giftDay = state.day;
  ps.gifts += 1;
  ps.affinity = clamp(ps.affinity + gift.gain, 0, 100);
  sound.chip();
  logEvent(`你送了 ${fmt(gift.amount)} 籌碼給 ${c.name}。好感度 +${gift.gain}。`);
  refreshHud();
  save();
  openPersonModal(c.id, {
    note: `你把 ${fmt(gift.amount)} 籌碼推給 <b>${esc(c.name)}</b>。<em>好感度 +${gift.gain}</em>`
  });
}

/* ---------------- 賭博邀請 ---------------- */

function openInvite(id) {
  const c = studentById(id);
  if (!c) return;
  if (state.locked) return;
  if (challengeActive()) { toast('先完成目前的賭局。', 'warn'); return; }
  const ps = personState(id);
  const maxW = maxWagerOf(c);
  if (maxW < 10000) {
    toast('手上的籌碼不夠開一局賭博邀請。', 'warn', 3600);
    return;
  }
  let game = preferredGame(c);
  const start = Math.min(maxW, Math.max(10000, round10k(100000)));

  openModal({
    title: `賭博邀請 · ${c.name}`,
    wide: true,
    html: `
      <div class="pi-head">
        <div class="story-avatar ${c.cls}">${c.init}</div>
        <div>
          <div class="pm-title">${esc(c.title)} · 好感 ${affinityOf(id)}</div>
          <p class="pm-quote">「${esc(pickLine(c))}」</p>
        </div>
      </div>
      <div class="pi-games">
        ${GAME_LIST.map(g => `<button type="button" class="pi-game ${g === game ? 'active' : ''}" data-pi-game="${g}"><b>${GAME_ICONS[g]}</b>${GAME_NAMES[g]}</button>`).join('')}
      </div>
      <div class="pi-wager">
        <div class="bet-range-host" id="pi-range"></div>
        <div class="pi-note">
          這一局下注 <b id="pi-ante">${fmt(start)}</b>。贏了拿回 <b>${fmt(start * 2)}</b>；平手退注。
          <small>下注上限 ${fmt(maxW)}（依好感度 ${affinityOf(id)} 計算，且不超過現金 ${fmt(state.cash)}）。</small>
        </div>
      </div>`,
    buttons: [
      { label: '取消', kind: 'ghost' },
      {
        label: '坐上牌桌',
        kind: 'gold',
        onClick: () => { startInvite(id, game, range.value); }
      }
    ]
  });

  const overlay = document.getElementById('overlay-root');
  const range = mountBetRange(overlay.querySelector('#pi-range'), {
    label: '下注金額', min: 10000, step: 10000,
    max: () => maxW,
    value: start,
    onChange: v => {
      const ante = overlay.querySelector('#pi-ante');
      if (ante) ante.textContent = fmt(v);
    }
  });
  overlay.querySelectorAll('[data-pi-game]').forEach(btn => {
    btn.onclick = () => {
      sound.click();
      game = btn.dataset.piGame;
      overlay.querySelectorAll('[data-pi-game]').forEach(b => b.classList.toggle('active', b === btn));
    };
  });
}

function startInvite(id, game, wager) {
  const c = studentById(id);
  if (!c || !GAME_NAMES[game]) return;
  if (state.locked) return;
  if (challengeActive()) { toast('先完成目前的賭局。', 'warn'); return; }
  const maxW = maxWagerOf(c);
  if (wager < 10000 || wager > maxW) {
    toast('下注金額超出上限。', 'warn');
    return;
  }
  if (!spendCash(wager)) { toast('籌碼不足。', 'warn'); return; }
  const ps = personState(id);
  ps.invites += 1;
  save();
  setChallenge({
    mode: 'guest',
    game,
    member: c.name,
    title: c.title,
    wager,
    personId: id,
    backView: 'people',
    onResult: (result, detail) => resolveGuest(id, result, detail, wager, game)
  });
  logEvent(`你向 ${c.name} 提出 ${GAME_NAMES[game]} 的賭博邀請，下注 ${fmt(wager)}。`);
  toast(`坐上牌桌：${GAME_NAMES[game]} · ${c.name}`, 'info', 3200);
  router.go(game);
}

export function resolveGuest(personId, result, detail = {}, stake, game) {
  const c = studentById(personId);
  const ps = personState(personId);
  const name = c ? c.name : personId;
  const surrendered = !!detail.surrender;
  const tie = !surrendered && !!(detail.tie || detail.draw || detail.kind === 'push');
  let outcome = 'lose';
  let text = '';
  let note = '';

  if (result === 'win') {
    outcome = 'win';
    addCash(Math.round(stake * 2), { silent: true });
    ps.affinity = clamp(ps.affinity + 3, 0, 100);
    ps.wins += 1;
    recordRound(stake, stake);
    text = `你贏了這一局。${name} 把 ${fmt(stake)} 推過來，眼神卻沒有離開牌面。`;
    note = '好感度 +3 · 賭局勝場 +1';
    sound.win(false);
  } else if (tie) {
    outcome = 'push';
    addCash(stake, { silent: true });
    ps.affinity = clamp(ps.affinity + 1, 0, 100);
    recordRound(0, 0);
    text = `平手。注碼退回，${name} 看起來有點不甘心。`;
    note = '注碼退回 · 好感度 +1';
    sound.push();
  } else if (surrendered) {
    ps.affinity = clamp(ps.affinity - 3, 0, 100);
    ps.losses += 1;
    recordRound(0, 0);
    text = `你棄權了。${name} 收起桌上的籌碼，沒有多說什麼。`;
    note = '好感度 −3 · 賭局敗場 +1';
    sound.lose();
  } else {
    ps.affinity = clamp(ps.affinity + 1, 0, 100);
    ps.losses += 1;
    recordRound(-stake, -stake);
    text = `你輸了。${name} 把 ${fmt(stake)} 收進籌碼堆：「下次再來。」`;
    note = '好感度 +1 · 賭局敗場 +1';
    sound.lose();
  }

  advanceTime(40);
  refreshHud();
  save();
  logEvent(`賭博邀請（${GAME_NAMES[game] || ''} · ${name}）：${outcome === 'win' ? '你贏了' : outcome === 'push' ? '平手退注' : '你輸了'}，下注 ${fmt(stake)}。`, outcome === 'lose' ? 'warn' : 'info');

  setTimeout(() => {
    openModal({
      title: outcome === 'win' ? '賭局勝利' : outcome === 'push' ? '賭局平手' : '賭局落敗',
      html: `<p class="pi-result ${outcome}">${esc(text)}</p><p class="pi-result-note">${esc(note)}</p>`,
      buttons: [
        {
          label: '再邀一局',
          kind: 'ghost',
          onClick: () => { setTimeout(() => openInvite(personId), 90); }
        },
        { label: '回到人物', kind: 'gold' }
      ],
      onClose: () => {
        if (router.current !== 'people') router.go('people');
      }
    });
  }, 340);
}

/* ---------------- 人物互動頁 ---------------- */

function cardHTML(c) {
  const ps = personState(c.id);
  const aff = ps.affinity;
  const tier = affinityTier(aff);
  const game = preferredGame(c);
  const lv = state.admin && Array.isArray(state.admin.livestock)
    ? state.admin.livestock.some(e => e.id === c.id)
    : false;
  return `
    <button class="person-card pp-card" data-person="${c.id}" data-name="${esc(c.name)}">
      <div class="story-avatar mini ${c.cls}">${c.init}</div>
      <div class="pc-info">
        <b>${esc(c.name)}${lv ? '<em>家畜</em>' : ''}</b>
        <span>${esc(c.title)}</span>
      </div>
      <div class="pp-aff"><i class="${tier.cls}" style="width:${aff}%"></i></div>
      <div class="pp-meta"><span class="pp-tier ${tier.cls}">${tier.label}</span><span>${aff}／100</span></div>
      <div class="pp-foot">
        <span>${GAME_ICONS[game]} ${GAME_NAMES[game]}</span>
        <span>${ps.wins} 勝 ${ps.losses} 敗</span>
      </div>
    </button>`;
}

function filteredList() {
  let list = STUDENTS;
  if (filter !== 'all') list = list.filter(c => c.faction === filter);
  if (search) list = list.filter(c => c.name.includes(search) || c.title.includes(search));
  return list;
}

function renderPeople() {
  const el = root();
  if (!el) return;
  if (!el.dataset.ready) {
    el.dataset.ready = '1';
    el.innerHTML = `
      <div class="game-head">
        <button class="btn ghost" data-back>← 學園</button>
        <h2>人物互動</h2>
        <span class="sub">好感度、閒聊、送籌碼與賭博邀請 · 共 ${STUDENTS.length} 人</span>
        <div class="spacer"></div>
        <button class="btn ghost" data-rules>規則</button>
      </div>

      <div class="pp-toolbar">
        <div class="school-filter pp-filters">
          <button class="active" data-pp-filter="all">全部</button>
          <button data-pp-filter="學生會">學生會</button>
          <button data-pp-filter="絕對中立委員會">中立委員會</button>
          <button data-pp-filter="一般學生">一般學生</button>
        </div>
        <input id="pp-search" class="pp-search" type="search" placeholder="搜尋名字或社團……" autocomplete="off">
        <span class="school-filter-note" id="pp-count"></span>
      </div>

      <div class="pp-grid" id="pp-grid"></div>

      <div class="school-tip">
        · 點任何一位學生，可以看檔案、閒聊、送籌碼，或直接邀他坐上賭桌。<br>
        · 閒聊與送籌碼每天各一次；好感度越高，對方願意接受的下注上限越高。<br>
        · 賭博邀請的賭局依人物偏好而定，贏了拿回 2 倍，平手退注。好感度不會因為輸贏下降，只有棄權會。
      </div>`;

    el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
    el.querySelector('[data-rules]').onclick = () => openPeopleRules();
    el.querySelectorAll('[data-pp-filter]').forEach(btn => {
      btn.onclick = () => {
        sound.click();
        filter = btn.dataset.ppFilter;
        el.querySelectorAll('[data-pp-filter]').forEach(b => b.classList.toggle('active', b === btn));
        renderGrid();
      };
    });
    el.querySelector('#pp-search').oninput = e => {
      search = e.target.value.trim();
      renderGrid();
    };
  }
  renderGrid();
}

function renderGrid() {
  const el = root();
  if (!el) return;
  const grid = el.querySelector('#pp-grid');
  const count = el.querySelector('#pp-count');
  if (!grid) return;
  const list = filteredList();
  if (count) count.textContent = `${list.length} 人`;
  grid.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : '<div class="journal-empty">沒有符合條件的人物。</div>';
  grid.querySelectorAll('[data-person]').forEach(btn => {
    btn.onclick = () => { sound.click(); openPersonModal(btn.dataset.person); };
  });
}

function openPeopleRules() {
  openModal({
    title: '人物互動',
    wide: true,
    html: `<h3>好感度</h3><ul>
      <li>每位學生都有自己的好感度（0–100）。點人物進入檔案即可互動。</li>
      <li>閒聊：每天一次，好感 +1，並會聽到對方對賭局的一句話。</li>
      <li>送籌碼：每天一次，1 萬／5 萬／20 萬籌碼可換 +1／+2／+5 好感。</li>
      <li>賭博邀請：依對方偏好選擇 21 點、二人麻將或德州撲克。下注上限 = 100,000 + 好感 × 10,000，且不超過現金。</li>
      <li>贏了拿回 2 倍注碼、好感 +3；平手退注、好感 +1；輸了沒收注碼、好感 +1；棄權好感 −3。</li>
      <li>好感度只是對方願不願意繼續跟你賭，不是戀愛數值。</li>
    </ul>`,
    buttons: [{ label: '知道了', kind: 'gold' }]
  });
}

/* ---------------- 生命週期 ---------------- */

export function enterPeople() {
  renderPeople();
}

export function leavePeople() { }

export function canLeavePeople() { return true; }