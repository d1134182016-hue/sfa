import {
  state, fmt, money, totalDebt, sharkAvailable, bankAvailable, bankReady,
  borrowMoney, payDebt, interestPreview, refreshHud, toast, router,
  BANK_LIMIT, SHARK_DAILY, BANK_DAILY, BAD_DEBT, clockText, sound, openRules
} from './core.js';

const pct = v => (v * 100).toFixed(1).replace(/\.0$/, '') + '%';

const root = () => document.getElementById('view-loans');

export function renderLoans() {
  const el = root();
  if (!el) return;
  const debt = totalDebt();
  const interest = interestPreview();
  const nextHours = Math.max(0, Math.ceil((1440 - state.minutes) / 60));
  const credit = Math.round(state.credit);
  const creditLabel = credit >= 80 ? '學生會認可的賭徒' : credit >= 60 ? '有名字的學生' : credit >= 50 ? '勉強及格' : credit >= 30 ? '家畜候補' : '家畜小屋住民';
  const bankLocked = !state.flags.bankUnlocked;
  const canBank = bankReady();

  el.innerHTML = `
    <div class="game-head">
      <button class="btn ghost back" data-back>← 學園</button>
      <h2>債務中心</h2>
      <span class="sub">先看清楚利息，再決定要不要把脖子伸進去</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-rules>規則</button>
    </div>

    <div class="loans-head">
      <p>你目前的總欠款是 <b style="color:#f0a6ae">${fmt(debt)}</b>。每天午夜自動計息，下一次計息還有約 ${nextHours} 小時（第 ${state.day} 天 ${clockText()}）。</p>
    </div>

    <div class="loan-grid">
      <div class="loan-card shark">
        <h3>學生會高利貸 <span class="tag">日息 ${pct(SHARK_DAILY)}</span></h3>
        <div class="loan-quote">「借可以，規矩先講清楚。手續費 3%，晚一天，就多一點。」—— 桃喰綺羅莉</div>
        <div class="loan-stats">
          <div class="loan-stat"><span>目前欠款</span><b class="red">${fmt(state.shark)}</b></div>
          <div class="loan-stat"><span>可再借</span><b>${fmt(sharkAvailable())}</b></div>
          <div class="loan-stat"><span>每日利息</span><b class="red">+${fmt(interest.shark)}</b></div>
          <div class="loan-stat"><span>退學期限</span><b>第 ${state.dueDay} 天</b></div>
        </div>
        <div class="loan-actions">
          ${[200000, 500000, 1000000, 2000000].map(v => `<button class="btn ghost" data-borrow="shark" data-amt="${v}" ${v > sharkAvailable() || state.locked ? 'disabled' : ''}>借 ${money(v)}</button>`).join('')}
        </div>
      </div>

      <div class="loan-card bank ${bankLocked || !canBank ? 'locked' : ''}">
        <h3>理事會融資 <span class="tag">日息 ${pct(BANK_DAILY)}</span></h3>
        <div class="loan-quote">${bankLocked ? '「等你把學生會那邊處理到一個程度，再來談。」—— 五十嵐清華' : canBank ? '「按日計息，隨借隨還。別讓我後悔核這筆。」—— 五十嵐清華' : '階級不足 50，理事會暫時不承作。'}</div>
        <div class="loan-stats">
          <div class="loan-stat"><span>目前欠款</span><b class="red">${fmt(state.bank)}</b></div>
          <div class="loan-stat"><span>可再借</span><b>${bankLocked ? '—' : fmt(bankAvailable())}</b></div>
          <div class="loan-stat"><span>每日利息</span><b class="${interest.bank > 0 ? 'red' : ''}">+${fmt(interest.bank)}</b></div>
          <div class="loan-stat"><span>額度上限</span><b>${fmt(BANK_LIMIT)}</b></div>
        </div>
        <div class="loan-actions">
          ${[500000, 1000000, 2000000, 5000000].map(v => `<button class="btn ghost" data-borrow="bank" data-amt="${v}" ${(!canBank || v > bankAvailable() || state.locked) ? 'disabled' : ''}>借 ${money(v)}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="loan-repay">
      <div>
        <div class="sub">償還欠款（優先還學生會）</div>
        <div class="big">${fmt(debt)}</div>
      </div>
      <div class="sub">手上的籌碼 <b style="color:var(--gold-2)">${fmt(state.cash)}</b></div>
      <div class="spacer"></div>
      <div class="btns">
        ${[50000, 200000, 500000].map(v => `<button class="btn gold" data-repay="${v}" ${debt <= 0 || state.cash < 1 || state.locked ? 'disabled' : ''}>還 ${money(v)}</button>`).join('')}
        <button class="btn danger" data-repay="all" ${debt <= 0 || state.cash < 1 || state.locked ? 'disabled' : ''}>全部還清</button>
      </div>
    </div>

    <div class="panel" style="margin-top:14px;padding:18px 20px">
      <div class="panel-head" style="padding:0 0 10px"><h3>學園階級</h3><span>${creditLabel}</span></div>
      <div class="credit-wrap">
        <b style="font-size:20px;color:var(--green);min-width:34px">${credit}</b>
        <div class="bar"><i style="width:${credit}%"></i></div>
        <span style="font-size:10.5px;color:#6f6b62">每還 NT$200,000 +1 · 每天還款 +2／未還 −2</span>
      </div>
    </div>

    <div class="loan-tip">
      · 學生會的違約金是欠款的 4%，每次催收延長 5 天；三次之後，家畜小屋就會有你一個位子。<br>
      · 每天只要有還款，退學期限就會自動往後延五天。<br>
      · 欠款超過 ${fmt(BAD_DEBT)} 也會直接退學。<br>
      · 借款手續費會先從撥款中扣除；理事會融資沒有手續費。<br>
      · 每天午夜自動計息（學生會 ${pct(SHARK_DAILY)}／理事會 ${pct(BANK_DAILY)}），利息直接滾進欠款。<br>
      · 想一次清空債務，就去公式戰擊敗一位學生會成員。<br>
      · 債務清償後，挑戰會長才能加入學生會；加入後可管理學園，甚至發動政變成為會長。
    </div>
  `;

  el.querySelector('[data-back]').onclick = () => { sound.click(); router.go('lobby'); };
  el.querySelector('[data-rules]').onclick = () => openRules('loans');
  el.querySelectorAll('[data-borrow]').forEach(btn => {
    btn.onclick = () => {
      const source = btn.dataset.borrow;
      const amt = Number(btn.dataset.amt);
      const res = borrowMoney(source, amt);
      toast(res.msg, res.ok ? 'good' : 'warn');
      if (res.ok) { sound.chip(); renderLoans(); refreshHud(); }
    };
  });
  el.querySelectorAll('[data-repay]').forEach(btn => {
    btn.onclick = () => {
      const raw = btn.dataset.repay;
      const amt = raw === 'all' ? Math.min(state.cash, debt) : Math.min(Number(raw), state.cash, debt);
      if (amt <= 0) { toast('現金不足或已無欠款。', 'warn'); return; }
      const paid = payDebt(amt);
      if (paid > 0) {
        toast(`已還款 ${fmt(paid)}，剩餘 ${fmt(totalDebt())}`, 'good');
        renderLoans();
      }
    };
  });
}
