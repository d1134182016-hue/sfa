import {
  state, save, refreshHud, logEvent, sleep, router, totalDebt, toast, sound,
  START_DEBT
} from './core.js';

const PEOPLE = {
  '桃喰綺羅莉': { cls: 'kirari', init: '綺' },
  '早乙女芽亞里': { cls: 'mary', init: '芽' },
  '蛇喰夢子': { cls: 'yumeko', init: '夢' },
  '鈴井涼太': { cls: 'ryota', init: '鈴' },
  '五十嵐清華': { cls: 'sayaka', init: '嵐' },
  '夢見弓優芽美': { cls: 'yumemi', init: '夢' },
  '西洞院百合子': { cls: 'yuriko', init: '西' },
  '生志摩妄': { cls: 'midari', init: '生' },
  '豆生田楓': { cls: 'kaede', init: '豆' },
  '黄泉月露娜': { cls: 'runa', init: '黄' },
  '陰喰三欲': { cls: 'mitsuyo', init: '陰' },
  '陽喰三理': { cls: 'miri', init: '陽' },
  '虫喰恵利音': { cls: 'erine', init: '虫' },
  '骨喰ミラス': { cls: 'mira', init: '骨' },
  '狛喰希': { cls: 'nozomi', init: '狛' },
  '下月売奥理': { cls: 'ouri', init: '下' },
  '尾喰茨': { cls: 'ibara', init: '茨' },
  '尾喰凛': { cls: 'rin', init: '凛' },
  '桃喰リリカ': { cls: 'ririka', init: '莉' },
  '你': { cls: 'you', init: '你' }
};

let busy = false;
let pending = false;
let skipScene = false;
let skipCurrent = null;

function setSpeaker(who) {
  const p = PEOPLE[who] || { cls: '', init: who.slice(0, 1) };
  const av = document.getElementById('story-avatar');
  av.textContent = p.init;
  av.className = 'story-avatar ' + p.cls;
  document.getElementById('story-name').textContent = who;
}

function waitLine(line) {
  return new Promise(resolve => {
    const layer = document.getElementById('story-layer');
    const textEl = document.getElementById('story-text');
    const actions = document.getElementById('story-actions');
    const hint = document.getElementById('story-hint');
    layer.classList.remove('hidden');
    setSpeaker(line.who);
    textEl.classList.remove('done');
    textEl.textContent = '';
    actions.innerHTML = '';
    hint.textContent = '點擊顯示全文';

    let shown = 0;
    let timer = null;
    let finished = false;
    let resolved = false;
    const full = line.text;

    const cleanup = () => {
      if (timer) clearInterval(timer);
      timer = null;
      layer.removeEventListener('click', onClick);
      if (skipCurrent === done) skipCurrent = null;
    };

    const done = (value) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(value);
    };
    skipCurrent = done;

    const renderChoices = () => {
      if (!line.choices || !line.choices.length) return;
      actions.innerHTML = '';
      for (const choice of line.choices) {
        const btn = document.createElement('button');
        btn.className = 'btn ghost';
        btn.textContent = choice.label;
        btn.onclick = (e) => {
          e.stopPropagation();
          sound.click();
          if (choice.effect) {
            try { choice.effect(); } catch (err) { console.error(err); }
          }
          done(choice.value ?? choice.label);
        };
        actions.appendChild(btn);
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      timer = null;
      textEl.textContent = full;
      textEl.classList.add('done');
      hint.textContent = line.choices && line.choices.length ? '選擇一個回應' : '點擊繼續 ▸';
      renderChoices();
    };

    const onClick = (e) => {
      if (e.target.closest('.story-actions')) return;
      if (!finished) { finish(); return; }
      if (line.choices && line.choices.length) return;
      done();
    };

    timer = setInterval(() => {
      shown += 1;
      textEl.textContent = full.slice(0, shown);
      if (shown >= full.length) finish();
    }, 24);

    layer.addEventListener('click', onClick);

    if (!full) finish();
  });
}

const SCENES = {
  intro: {
    flag: 'introDone',
    chapter: 0,
    lines: [
      { who: '五十嵐清華', text: '歡迎來到百花王學園。我是學生會書記，五十嵐清華。這裡不看成績，只看你輸不輸得起。' },
      { who: '五十嵐清華', text: '一千萬。十四天。這是你的家畜契約，會長已經簽好了。還不出來，名字就從名冊上消失。' },
      { who: '你', text: '……我會還。' },
      { who: '五十嵐清華', text: '很好。桌上那三十萬，是學生會給你的起步金。別讓會長失望。' },
      { who: '早乙女芽亞里', text: '別傻了。她不是給你機會，是想看你怎麼輸。' },
      { who: '蛇喰夢子', text: '可是，賭博最迷人的地方，不就是輸贏揭曉前的那一秒嗎？' },
      { who: '鈴井涼太', text: '我查過了。只要還清一千萬，契約就會解除。還有……學生會的公式戰，贏了可以一筆勾銷。' },
      {
        who: '蛇喰夢子', text: '那就別當家畜。坐上牌桌，把他們一個一個拉下來。',
        choices: [
          { label: '「我會贏。」', effect: () => { state.credit = Math.min(100, state.credit + 1); } },
          { label: '「我只是想活下去。」', effect: () => { state.credit = Math.max(0, state.credit - 1); } }
        ]
      }
    ],
    onEnd: () => {
      state.chapter = Math.max(state.chapter, 0);
      logEvent('你在百花王學園坐下。家畜債務一千萬，退學期限十四天，日息兩分。');
    }
  },

  formula: {
    flag: 'formulaSeen',
    chapter: 1,
    lines: [
      { who: '五十嵐清華', text: '學生會為你開了一扇門。公式戰——五位成員，你挑一個。' },
      { who: '五十嵐清華', text: '沒有順序，也不用累積。贏下那一場，你的債務一筆勾銷。' },
      { who: '早乙女芽亞里', text: '而且下注沒有上限。他們就是想看你押上自己付不起的金額。' },
      { who: '蛇喰夢子', text: '賭注越大，心臟跳得越快。這才是賭博，不是嗎？' },
      { who: '鈴井涼太', text: '公式戰在「學生會」頁面。選誰、押多少，都是你自己決定。' }
    ],
    onEnd: () => {
      state.flags.formulaSeen = true;
      state.chapter = Math.max(state.chapter, 1);
      logEvent('學生會開放公式戰：五位成員任挑一位，贏了賭債歸零。');
      toast('支線解鎖：公式戰（學生會）', 'good');
    }
  },

  halfway: {
    flag: 'ch1',
    chapter: 1,
    lines: [
      { who: '早乙女芽亞里', text: '一千萬，你已經還掉一半了。學生會開始把你當成「有點意思」的家畜。' },
      { who: '你', text: '那不是好事吧。' },
      { who: '蛇喰夢子', text: '被他們注意到，才算真正坐上牌桌。' },
      {
        who: '早乙女芽亞里', text: '拿去。我這個月的零用錢，別讓夢子知道。',
        choices: [
          {
            label: '收下（+NT$50,000）',
            effect: () => { state.cash += 50000; state.stats.bestWin = Math.max(state.stats.bestWin, 50000); }
          },
          {
            label: '「妳留著吧。」',
            effect: () => { state.credit = Math.min(100, state.credit + 5); }
          }
        ]
      }
    ],
    onEnd: () => {
      state.chapter = Math.max(state.chapter, 1);
      state.flags.ch1 = true;
      logEvent('早乙女芽亞里提醒你：學生會的帳，沒有看起來那麼簡單。');
    }
  },

  bank: {
    flag: 'ch2',
    chapter: 2,
    lines: [
      { who: '早乙女芽亞里', text: '剩下不到兩百五十萬。我認識理事會的人，低利融資，利息只有學生會的三十分之一。' },
      { who: '五十嵐清華', text: '我是五十嵐清華，學生會書記。理事會可以給你八百萬額度，日息 0.6%。' },
      { who: '五十嵐清華', text: '但請記住：理事會只借給還得起的人。' },
      { who: '蛇喰夢子', text: '便宜的錢，通常附著更貴的條件。' }
    ],
    onEnd: () => {
      state.chapter = Math.max(state.chapter, 2);
      state.flags.ch1 = true;
      state.flags.ch2 = true;
      state.flags.bankUnlocked = true;
      state.credit = Math.max(state.credit, 55);
      logEvent('理事會融資解鎖：日息 0.6%，額度 NT$8,000,000。');
      toast('理事會融資已解鎖（債務中心）', 'good');
    }
  },

  tip: {
    flag: 'tipGiven',
    chapter: null,
    lines: [
      { who: '蛇喰夢子', text: '你看起來像連輸了三晚。' },
      { who: '你', text: '差不多。' },
      { who: '蛇喰夢子', text: '拿去，五萬。不是借，是投資。我想看你贏的樣子。' }
    ],
    onEnd: () => {
      state.flags.tipGiven = true;
      state.cash += 50000;
      logEvent('蛇喰夢子塞給你 NT$50,000，說是投資。');
      toast('蛇喰夢子給了你 NT$50,000', 'good');
    }
  },

  debtCleared: {
    flag: 'debtClearedSeen',
    chapter: 3,
    lines: [
      { who: '五十嵐清華', text: '債務清償確認。從今天起，你的名字從家畜名冊上移除。' },
      { who: '五十嵐清華', text: '還清一千萬，只是拿回普通學生的身分。想改變這所學園，得坐進學生會。' },
      { who: '早乙女芽亞里', text: '她的意思是——去打贏會長。贏了，你就是學生會的人；輸了，會比家畜更難看。' },
      { who: '五十嵐清華', text: '入會測驗在學生會頁面。會長會親自坐上牌桌。' },
      { who: '蛇喰夢子', text: '終於輪到會長了。我很期待。' },
      { who: '你', text: '那就讓她看看，家畜能走到哪裡。' }
    ],
    onEnd: () => {
      state.flags.paid = true;
      state.flags.debtClearedSeen = true;
      state.flags.joinPromptSeen = true;
      state.flags.ch1 = true;
      state.flags.ch2 = true;
      state.chapter = Math.max(state.chapter, 3);
      logEvent('債務清償。學生會入會測驗已解鎖：挑戰會長。');
      toast('入會測驗解鎖：挑戰學生會長', 'good', 5000);
    }
  },

  formulaWin: {
    flag: 'formulaCleared',
    chapter: 3,
    lines: (vars) => {
      const foe = vars.foe || '學生會';
      return [
        { who: '五十嵐清華', text: `${foe}輸了。公式戰的結果，我已經收到了。` },
        { who: '五十嵐清華', text: '根據約定，你的債務一筆勾銷。但這只是把名字從家畜名冊上拿掉，不代表你走進了學生會。' },
        { who: '五十嵐清華', text: '會長的意思是：你現在有資格申請入會測驗了。' },
        { who: '早乙女芽亞里', text: `你挑了${foe}……而且真的贏了。那就去打會長吧，輸了會比家畜更難看。` },
        { who: '蛇喰夢子', text: '終於輪到會長了。我很期待。' }
      ];
    },
    onEnd: () => {
      state.shark = 0;
      state.bank = 0;
      state.flags.formulaCleared = true;
      state.chapter = Math.max(state.chapter, 3);
      logEvent(`公式戰勝利：擊敗 ${state.formulaFoe || '學生會成員'}，賭債歸零。`);
    }
  },

  joinWin: {
    flag: 'joinWinSeen',
    chapter: 4,
    lines: [
      { who: '桃喰綺羅莉', text: '……我輸了。真有意思。從今天起，你是學生會的一員。' },
      { who: '五十嵐清華', text: '入會手續完成。學生會室的鑰匙、全校名冊、校庫權限，都已經交給你了。' },
      { who: '黄泉月露娜', text: '絕對中立委員會提醒你：學生會的錢，不是你的錢。至少帳面上不能是。' },
      { who: '早乙女芽亞里', text: '學生會不是終點。你現在坐的位子，隨時會有人想坐上去。' },
      { who: '蛇喰夢子', text: '恭喜。不過，會長的位子只有一個。' },
      { who: '你', text: '我知道。' }
    ],
    onEnd: () => {
      state.flags.joinWinSeen = true;
      state.chapter = Math.max(state.chapter, 4);
      logEvent('入會測驗通過。你成為學生會的一員，學生會室已解鎖。');
      toast('學生會室已解鎖：管理學園', 'good', 5200);
    }
  },

  joinLose: {
    flag: 'joinLoseSeen',
    chapter: 3,
    lines: [
      { who: '桃喰綺羅莉', text: '輸了。入會測驗沒有第二次機會——至少，不是現在。' },
      { who: '五十嵐清華', text: '你的名字已經重新寫回家畜名冊。債務恢復為一千萬，期限十四天。' },
      { who: '早乙女芽亞里', text: '我早就說過，會長不會手下留情。' },
      { who: '蛇喰夢子', text: '沒關係。家畜也能再爬上牌桌，不是嗎？' },
      { who: '你', text: '……我會再來。' }
    ],
    onEnd: () => {
      state.flags.joinLoseSeen = true;
      logEvent('入會測驗失敗。你重新成為家畜，債務回到 NT$10,000,000。', 'warn');
      toast('入會失敗：重新成為家畜', 'warn', 5200);
    }
  },

  schoolIntro: {
    flag: 'schoolIntroSeen',
    chapter: 4,
    lines: [
      { who: '五十嵐清華', text: '歡迎來到學生會室。從今天起，這裡也是你的桌子。' },
      { who: '五十嵐清華', text: '名冊、家畜、校庫、繳納金。你現在看到的每一個數字，都是一個人的日子。' },
      { who: '黄泉月露娜', text: '我是絕對中立委員會議長，黄泉月露娜。你們收多少錢我不管，帳要對得上。' },
      { who: '早乙女芽亞里', text: '還有，別忘了會長是怎麼坐上那個位子的。' },
      { who: '你', text: '我會記住。' }
    ],
    onEnd: () => {
      state.flags.schoolIntroSeen = true;
      state.chapter = Math.max(state.chapter, 4);
      logEvent('學生會室開放：名冊、家畜、校庫與絕對中立委員會。');
      toast('學生會室：先看名冊，再看校庫', 'good', 4600);
    }
  },

  coupStart: {
    flag: 'coupStartSeen',
    chapter: 5,
    lines: [
      { who: '桃喰綺羅莉', text: '政變？好啊。學生會的規矩允許，只要你能讓所有人閉嘴。' },
      { who: '五十嵐清華', text: '政變程序啟動。五位成員，一個都不能跳過。會長必須最後一位。' },
      { who: '黄泉月露娜', text: '中立委員會只負責記結果。贏的人寫規則，輸的人被寫進名冊。' },
      { who: '早乙女芽亞里', text: '你把整間學生會都變成了敵人。最好確定自己真的想坐那個位子。' },
      { who: '蛇喰夢子', text: '五場。一場都不能輸。這才是真正的賭博。' }
    ],
    onEnd: () => {
      state.flags.coupStartSeen = true;
      state.chapter = Math.max(state.chapter, 5);
      logEvent('政變發動：必須依序擊敗學生會五席，會長最後。', 'warn');
      toast('政變開始：五席全倒，你就是會長', 'warn', 5200);
    }
  },

  coupWin: {
    flag: 'coupWinSeen',
    chapter: 5,
    lines: [
      { who: '桃喰綺羅莉', text: '五席全倒。看來是我看錯了——你不是家畜，也不是追隨者。' },
      { who: '桃喰綺羅莉', text: '會長的位子，是你的了。' },
      { who: '五十嵐清華', text: '政變成立。學生會長，桃喰綺羅莉，卸任。新任會長——你。' },
      { who: '黄泉月露娜', text: '紀錄完成。從今天起，絕對中立委員會審查的是你的帳。' },
      { who: '早乙女芽亞里', text: '這下好了。全校的規矩，真的換你寫了。' },
      { who: '蛇喰夢子', text: '恭喜你，會長。下一次，我們賭什麼？' }
    ],
    onEnd: () => {
      state.flags.coupWinSeen = true;
      state.chapter = Math.max(state.chapter, 5);
      logEvent('政變成功。你成為百花王學園學生會長。');
      toast('你是新任學生會長', 'good', 6000);
    }
  },

  coupLose: {
    flag: 'coupLoseSeen',
    chapter: 5,
    lines: [
      { who: '桃喰綺羅莉', text: '政變失敗。勇氣值得稱讚，但只有勇氣不夠。' },
      { who: '五十嵐清華', text: '學生會資格撤銷。你的名字，重新寫回家畜名冊。' },
      { who: '黄泉月露娜', text: '帳我會照實記。下一次，別把整間學生會都當成敵人。' },
      { who: '早乙女芽亞里', text: '起來吧。家畜也還有牌可以打。' },
      { who: '你', text: '……還沒結束。' }
    ],
    onEnd: () => {
      state.flags.coupLoseSeen = true;
      logEvent('政變失敗。學生會資格撤銷，你重新成為家畜。', 'warn');
      toast('政變失敗：學生會資格撤銷', 'warn', 5600);
    }
  },

  neutralAudit: {
    flag: 'neutralAuditSeen',
    chapter: 4,
    lines: [
      { who: '黄泉月露娜', text: '帳對不上。學生會，你們把繳納金收到哪裡去了？' },
      { who: '五十嵐清華', text: '審查度達到上限。依校規，校庫凍結一半，直到帳目釐清。' },
      { who: '五十嵐清華', text: '真是掃興。不過規矩就是規矩。' },
      { who: '你', text: '……下次，我會把帳做得漂亮一點。' }
    ],
    onEnd: () => {
      state.flags.neutralAuditSeen = true;
      logEvent('絕對中立委員會緊急審查：校庫凍結一半。', 'warn');
      toast('絕對中立委員會緊急審查：校庫減半', 'warn', 5200);
    }
  }
};

async function playScene(id, vars = {}) {
  const scene = SCENES[id];
  if (!scene || busy) return;
  busy = true;
  pending = false;
  skipScene = false;
  updateDot();
  sound.click();
  const skipBtn = document.getElementById('story-skip');
  if (skipBtn) {
    skipBtn.onclick = (e) => {
      e.stopPropagation();
      skipScene = true;
      if (skipCurrent) skipCurrent();
    };
  }
  try {
    const lines = typeof scene.lines === 'function' ? scene.lines(vars) : scene.lines;
    for (const line of lines) {
      await waitLine(line);
      if (skipScene) break;
    }
    if (scene.flag) state.flags[scene.flag] = true;
    if (scene.chapter != null) state.chapter = Math.max(state.chapter, scene.chapter);
    if (scene.onEnd) scene.onEnd();
    save();
    refreshHud();
  } catch (e) {
    console.error('story error', e);
  } finally {
    document.getElementById('story-layer').classList.add('hidden');
    busy = false;
    setTimeout(() => checkStory(), 320);
  }
}

export function playIntro() {
  return playScene('intro');
}

export function playFormulaWin(foe = '學生會') {
  return playScene('formulaWin', { foe });
}

export function playJoinWin() {
  return playScene('joinWin');
}

export function playJoinLose() {
  return playScene('joinLose');
}

export function playSchoolIntro() {
  return playScene('schoolIntro');
}

export function playCoupStart() {
  return playScene('coupStart');
}

export function playCoupWin() {
  return playScene('coupWin');
}

export function playCoupLose() {
  return playScene('coupLose');
}

export function playNeutralAudit() {
  return playScene('neutralAudit');
}

export function checkStory() {
  if (!state.started || state.locked || busy) {
    if (busy) pending = true;
    return;
  }
  if (!['lobby', 'loans', 'council', 'school'].includes(router.current)) {
    pending = true;
    updateDot();
    return;
  }
  if (!state.flags.introDone) {
    playScene('intro');
    return;
  }
  if (totalDebt() <= 0 && !state.flags.paid) {
    playScene('debtCleared');
    return;
  }
  if (state.councilJoined && router.current === 'school' && !state.flags.schoolIntroSeen) {
    playScene('schoolIntro');
    return;
  }
  if (totalDebt() > 0 && !state.flags.formulaSeen) {
    playScene('formula');
    return;
  }
  if (totalDebt() > 0 && totalDebt() <= 2500000 && !state.flags.ch2) {
    playScene('bank');
    return;
  }
  if (totalDebt() > 0 && totalDebt() <= 5000000 && !state.flags.ch1) {
    playScene('halfway');
    return;
  }
  if (state.day >= 4 && !state.flags.tipGiven && totalDebt() > 0) {
    playScene('tip');
    return;
  }
  pending = false;
  updateDot();
}

function updateDot() {
  const nav = document.getElementById('nav-story');
  if (nav) nav.classList.toggle('pulse', pending);
}

export function storyBusy() { return busy; }
