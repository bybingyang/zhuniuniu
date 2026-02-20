'use strict';

// ============================================================
//  常量
// ============================================================
const SUITS  = ['♠','♥','♦','♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS   = new Set(['♥','♦']);
const HAND_NAMES  = ['无牛','牛一','牛二','牛三','牛四','牛五','牛六','牛七','牛八','牛九','牛牛'];
let   MULTIPLIERS = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4];

// C(5,3) = 10 种三张组合
const TRIOS = [];
for (let a = 0; a < 3; a++)
  for (let b = a+1; b < 4; b++)
    for (let c = b+1; c < 5; c++)
      TRIOS.push([a, b, c]);

// 牌面值顺序：K=13 > Q=12 > J=11 > 10 > ... > A=1（区别于游戏点数 p，J/Q/K 点数均为 10）
const VALUE_RANK = { 'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13 };
// 花色顺序 ♠>♥>♦>♣
const SUIT_RANK  = { '♠':4, '♥':3, '♦':2, '♣':1 };

// 单张牌综合大小（面值优先，花色次之）
function cardOrder(c) { return VALUE_RANK[c.v] * 10 + SUIT_RANK[c.s]; }

// ============================================================
//  大厅
// ============================================================
const LB = {
  rows: [
    { name: '玩家1', score: 1000 },
    { name: '玩家2', score: 1000 },
    { name: '玩家3', score: 1000 },
    { name: '玩家4', score: 1000 },
  ],
  baseBet: 100,
};

function lb_renderRows() {
  el('player-list').innerHTML = LB.rows.map((r, i) => `
    <div class="lb-row">
      <span class="lb-num-cell">${i + 1}</span>
      <input value="${esc(r.name)}"
             oninput="LB.rows[${i}].name = this.value"
             placeholder="姓名">
      <input type="number" class="lb-score-input" value="${r.score}"
             oninput="LB.rows[${i}].score = Math.max(0, +this.value || 0)"
             placeholder="积分">
      <button class="lb-remove" onclick="lb_removeRow(${i})"
              ${LB.rows.length <= 2 ? 'disabled' : ''}>✕</button>
    </div>
  `).join('');
}

function lb_addRow() {
  if (LB.rows.length >= 10) return;
  LB.rows.push({ name: `玩家${LB.rows.length + 1}`, score: 1000 });
  lb_renderRows();
}

function lb_removeRow(i) {
  if (LB.rows.length <= 2) return;
  LB.rows.splice(i, 1);
  lb_renderRows();
}

function lb_start() {
  LB.baseBet = Math.max(1, +el('lb-bet').value || 100);

  // 读取可配置倍率
  const mult8   = Math.max(1, +el('lb-mult-niu8').value   || 2);
  const mult9   = Math.max(1, +el('lb-mult-niu9').value   || 3);
  const multNiu = Math.max(1, +el('lb-mult-niuniu').value || 4);
  MULTIPLIERS   = [1, 1, 1, 1, 1, 1, 1, 1, mult8, mult9, multNiu];

  const valid = LB.rows.filter(r => r.name.trim());
  if (valid.length < 2) { alert('至少需要 2 位有姓名的玩家'); return; }

  G.players   = valid.map((r, i) => mkPlayer(i, r.name.trim(), r.score || 0));
  G.baseBet   = LB.baseBet;
  G.dealerIdx = 0;
  G.round     = 0;
  G.log       = [];
  G.players[0].isDealer = true;

  el('lobby').classList.add('hidden');
  el('game-wrapper').classList.remove('hidden');

  UI.render();
  UI.showBtns('ready');
  setStatus('点击「发牌」开始本局');
  el('dealer-info').textContent = `庄: ${G.players[G.dealerIdx].name}`;
}

// ============================================================
//  游戏状态
// ============================================================
const G = {
  players:       [],
  baseBet:       100,
  dealerIdx:     0,
  prevDealerIdx: null,   // 本局庄家 idx（结算后保留，用于双标签展示）
  phase:         'ready',   // 就绪 | 发牌中 | 已结算
  round:         0,
  log:           [],
  roundLogs:     [],   // 当前 session 按局日志: [{round,dealer,entries[]}]
};

function mkPlayer(id, name, chips) {
  return { id, name, chips, isDealer: false,
           hand: [], result: null, chipChange: 0, roundResult: '', usedMult: 1 };
}

// ============================================================
//  牌型引擎
// ============================================================
function cardPts(v) { return v === 'A' ? 1 : 'JQK'.includes(v) ? 10 : +v; }

function createDeck() {
  const d = [];
  for (const s of SUITS) for (const v of VALUES) d.push({ s, v, p: cardPts(v) });
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function evaluateHand(cards) {
  let bestRank = -1, bestTri = null, bestDuo = null;
  for (const tri of TRIOS) {
    const triSum = tri.reduce((s, i) => s + cards[i].p, 0);
    if (triSum % 10 !== 0) continue;
    const duo    = [0,1,2,3,4].filter(i => !tri.includes(i));
    const duoSum = duo.reduce((s, i) => s + cards[i].p, 0);
    const rank   = duoSum % 10 === 0 ? 10 : duoSum % 10;
    if (rank > bestRank) { bestRank = rank; bestTri = tri; bestDuo = duo; }
  }
  // 最大单张：面值优先（K>Q>J>10>...>A），花色次之（♠>♥>♦>♣）
  const topCard = cards.reduce((m, c) => cardOrder(c) > cardOrder(m) ? c : m);
  if (bestRank < 0)
    return { rank: 0, type: '无牛', mult: 1, tri: null, duo: null, topCard };
  return { rank: bestRank, type: HAND_NAMES[bestRank], mult: MULTIPLIERS[bestRank],
           tri: bestTri, duo: bestDuo, topCard };
}

// 比较两个牌型大小（返回正数 = hA 更大，0 = 相等，负数 = hB 更大）
// 规则：牌级不同 → 比牌级；同牌级 → 比最高单张面值；同面值 → 比花色（♠>♥>♦>♣）
function compareHands(hA, hB) {
  if (hA.rank !== hB.rank) return hA.rank - hB.rank;
  // 同牌级：比最高牌面值（K=13 > Q=12 > J=11 > 10 > ... > A=1）
  const dv = VALUE_RANK[hA.topCard.v] - VALUE_RANK[hB.topCard.v];
  if (dv !== 0) return dv;
  // 同面值：比花色（♠>♥>♦>♣）
  return SUIT_RANK[hA.topCard.s] - SUIT_RANK[hB.topCard.s];
}

// 专门比较两个牛牛玩家谁更大（用于换庄）
// 复用 evaluateHand() 已算好的 result.topCard（面值→花色），大者为新庄
function compareNiuNiu(pA, pB) {
  const topA = pA.result.topCard;
  const topB = pB.result.topCard;
  const dv = VALUE_RANK[topA.v] - VALUE_RANK[topB.v];
  if (dv !== 0) return dv;
  return SUIT_RANK[topA.s] - SUIT_RANK[topB.s];
}

// ============================================================
//  牌局逻辑
// ============================================================
function startRound() {
  if (G.phase === 'dealing') return;   // 防止发牌动画期间重复触发
  G.round++;
  // 新建当轮日志对象
  G.roundLogs.push({ round: G.round, dealer: G.players[G.dealerIdx].name, entries: [] });

  G.phase = 'dealing';
  el('round-info').textContent = `第 ${G.round} 局`;
  el('phase-label').textContent = '发牌中…';
  UI.showBtns('dealing');
  setStatus('发牌中，请稍候…');

  // 重置
  G.prevDealerIdx = null;
  for (const p of G.players) {
    p.hand = []; p.result = null; p.chipChange = 0; p.roundResult = '';
  }

  addLog(`第 ${G.round} 局 · 庄: ${G.players[G.dealerIdx].name} · 底注: ${G.baseBet}`);
  UI.renderLog();

  // 洗牌 → 逐人单独发 5 张（每人间隔 420ms）
  const deck = shuffle(createDeck());
  G.players.forEach((p, idx) => {
    setTimeout(() => {
      for (let i = 0; i < 5; i++) p.hand.push(deck.pop());
      UI.render();                          // 实时显示当前已发玩家的牌

      if (idx === G.players.length - 1) {  // 最后一人发完后结算
        setTimeout(settle, 500);
      }
    }, idx * 420);
  });
}

function settle() {
  if (G.phase !== 'dealing') return;   // 防止竞态条件下双重结算
  // 1. 评估所有手牌
  for (const p of G.players) p.result = evaluateHand(p.hand);

  // 2. 结算：每位闲家 对 庄家
  //    - 闲家赢 → 庄家按闲家牌型倍率付分
  //    - 庄家赢 → 闲家按庄家牌型倍率付分
  //    - 闲家之间不比大小、不结算
  const dealer = G.players[G.dealerIdx];
  for (const p of G.players) { p.chipChange = 0; p.usedMult = 1; }
  let dealerMaxMult = 1;

  for (const p of G.players) {
    if (p.id === dealer.id) continue;

    const cmp = compareHands(p.result, dealer.result);

    // 赔率取胜者的牌型倍率：
    //   闲家赢 → 用闲家的倍率；庄家赢 → 用庄家的倍率；平局 → 1（实际上同一副牌中极少平局）
    const mult   = cmp > 0 ? p.result.mult
                 : cmp < 0 ? dealer.result.mult
                 : 1;
    const amount = G.baseBet * mult;
    p.usedMult = mult;
    if (mult > dealerMaxMult) dealerMaxMult = mult;

    if (cmp > 0) {
      p.chips      += amount;  p.chipChange      += amount;
      dealer.chips -= amount;  dealer.chipChange -= amount;
      p.roundResult = 'win';
      const multStr = mult > 1 ? ` ×${mult}` : '';
      addLog(`${p.name}【${p.result.type}】胜 庄【${dealer.result.type}】${multStr} +${amount}`);
    } else if (cmp < 0) {
      p.chips      -= amount;  p.chipChange      -= amount;
      dealer.chips += amount;  dealer.chipChange += amount;
      p.roundResult = 'lose';
      const multStr = mult > 1 ? ` ×${mult}` : '';
      addLog(`${p.name}【${p.result.type}】负 庄【${dealer.result.type}】${multStr} -${amount}`);
    } else {
      p.roundResult = 'tie';
      addLog(`${p.name}【${p.result.type}】与庄平局，不计赔率`);
    }
  }
  dealer.roundResult = dealer.chipChange > 0 ? 'win'
                     : dealer.chipChange < 0 ? 'lose' : 'tie';
  dealer.usedMult = dealerMaxMult;   // 显示本局涉及的最大赔率徽章

  // 3. 换庄规则：只有出现牛牛才换庄
  //    - 有牛牛：所有牛牛玩家中，按最大单张比大小，最大者成为新庄家
  //    - 无牛牛：庄家不变
  G.prevDealerIdx = G.dealerIdx;   // 记录本局庄家，供双标签展示
  const niuNiuPlayers = G.players.filter(p => p.result.rank === 10);

  if (niuNiuPlayers.length > 0) {
    // 多个牛牛时，取最大单张者（同面值再比花色：♠>♥>♦>♣）
    let newDealer = niuNiuPlayers[0];
    for (const p of niuNiuPlayers) {
      if (compareNiuNiu(p, newDealer) > 0) newDealer = p;
    }
    const oldName = G.players[G.dealerIdx].name;
    G.players[G.dealerIdx].isDealer = false;
    G.dealerIdx = newDealer.id;
    newDealer.isDealer = true;
    if (newDealer.name === oldName) {
      addLog(`🎖️ ${newDealer.name}【牛牛】继续坐庄`);
    } else {
      addLog(`🎖️ ${newDealer.name}【牛牛】成为新庄家`);
    }
  } else {
    // 无牛牛，庄家不变
    addLog(`庄家 ${G.players[G.dealerIdx].name} 继续坐庄（本局无牛牛）`);
  }

  const nextDealer = G.players[G.dealerIdx];
  G.phase = 'settled';
  el('phase-label').textContent = '结算完成';
  el('dealer-info').textContent = `下局庄: ${nextDealer.name}`;
  UI.render();
  UI.showBtns('settled');
  UI.renderLog();
}

function nextRound() {
  startRound();
}

// ============================================================
//  界面渲染
// ============================================================
const UI = {

  render() {
    const tbody = el('score-body');
    if (!tbody) return;
    tbody.innerHTML = G.players.map(p => UI.buildRow(p)).join('');
  },

  buildRow(p) {
    const rowCls = p.roundResult ? `row-${p.roundResult}` : '';

    // 玩家名：结算阶段显示双标签（本局庄/下局庄），其余阶段显示普通庄标签
    let badge = '';
    if (G.phase === 'settled') {
      const isPrev = p.id === G.prevDealerIdx;
      const isNext = p.id === G.dealerIdx;
      if (isPrev && isNext) {
        badge = '<span class="dealer-tag">连庄</span>';
      } else if (isPrev) {
        badge = '<span class="dealer-tag dealer-tag-prev">本局庄</span>';
      } else if (isNext) {
        badge = '<span class="dealer-tag dealer-tag-next">下局庄</span>';
      }
    } else {
      badge = p.isDealer ? '<span class="dealer-tag">庄</span>' : '';
    }
    const nameTd = `<td class="col-name"><div class="player-name-cell">${badge}${esc(p.name)}</div></td>`;

    // 手牌
    let cardsHtml = '';
    if (p.hand.length === 0) {
      // 未发牌：5 个空槽
      cardsHtml = Array(5).fill('<div class="card-slot-empty"></div>').join('');
    } else {
      cardsHtml = p.hand.map((c, si) => {
        const isRed = RED_SUITS.has(c.s);
        let extra   = '';
        if (G.phase === 'settled' && p.result && p.result.tri) {
          extra = p.result.tri.includes(si) ? ' card-tri' : ' card-duo';
        }
        return `<div class="card ${isRed ? 'red' : 'black'}${extra}">
          <div class="card-top">${c.v}</div>
          <div class="card-suit">${c.s}</div>
          <div class="card-bot">${c.v}</div>
        </div>`;
      }).join('');
    }
    const cardsTd = `<td class="col-cards"><div class="hand-cards">${cardsHtml}</div></td>`;

    // 牌型 + 倍率
    let htHtml = '';
    if (G.phase === 'settled' && p.result) {
      const multBadge = p.usedMult > 1
        ? `<span class="mult-badge mult-${p.usedMult}">×${p.usedMult}</span>` : '';
      htHtml = `<span class="ht ht-${p.result.rank}">${p.result.type}</span>${multBadge}`;
    }

    // 本局变动
    let deltaHtml = '';
    if (G.phase === 'settled') {
      if      (p.chipChange > 0) deltaHtml = `<span class="pos">+${p.chipChange}</span>`;
      else if (p.chipChange < 0) deltaHtml = `<span class="neg">${p.chipChange}</span>`;
      else                       deltaHtml = `<span class="neutral">0</span>`;
    }

    return `<tr class="${rowCls}">
      ${nameTd}${cardsTd}
      <td class="col-type">${htHtml}</td>
      <td class="col-delta">${deltaHtml}</td>
      <td class="col-chips">${p.chips}</td>
    </tr>`;
  },

  showBtns(phase) {
    ['btn-deal','btn-next','btn-scores'].forEach(id => hide(id));
    if (phase === 'ready') {
      show('btn-deal');
      el('btn-deal').textContent = '发  牌';
    }
    if (phase === 'settled') {
      show('btn-next');
      el('btn-next').textContent = '再发一局 ▶';
      show('btn-scores');
      const dealer = G.players[G.dealerIdx];
      setStatus(`下局庄家：${dealer.name}【${dealer.result ? dealer.result.type : ''}】`);
    }
    if (phase === 'dealing') {
      setStatus('发牌中，请稍候…');
    }
  },

  showScoreEdit() {
    el('score-edit-list').innerHTML = G.players.map((p, i) => `
      <div class="score-edit-row">
        <label>${esc(p.name)}</label>
        <input type="number" id="se-${i}" value="${p.chips}">
      </div>
    `).join('');
    el('score-editor').classList.remove('hidden');
  },

  closeScoreEdit() { el('score-editor').classList.add('hidden'); },

  saveScoreEdit() {
    G.players.forEach((p, i) => {
      const v = +el(`se-${i}`).value;
      if (!isNaN(v)) p.chips = v;
    });
    UI.closeScoreEdit();
    UI.render();
    addLog('✎ 积分已手动调整');
    UI.renderLog();
  },

  showGameOver() {
    const sorted = [...G.players].sort((a, b) => b.chips - a.chips);
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    el('go-title').textContent = `游戏结束！${sorted[0].name} 获胜 🎉`;
    el('go-ranks').innerHTML = sorted.map((p, i) =>
      `<div class="go-rank-row">
        <span class="rank-pos">${medals[i] || ''} ${esc(p.name)}</span>
        <span class="rank-chips">💰 ${p.chips}</span>
      </div>`
    ).join('');
    el('game-over').classList.remove('hidden');
  },

  renderLog() {
    el('game-log').innerHTML = G.log.slice(0, 8)
      .map(m => `<span>${esc(m)}</span>`).join('');
  },
};

// ============================================================
//  工具
// ============================================================
function el(id)      { return document.getElementById(id); }
function show(id)    { const e = el(id); if (e) e.style.display = 'inline-flex'; }
function hide(id)    { const e = el(id); if (e) e.style.display = 'none'; }
function setStatus(t){ const e = el('status-msg'); if (e) e.textContent = t; }
function addLog(msg) {
  G.log.unshift(msg);
  if (G.log.length > 100) G.log.pop();
  // 双写到当前局日志（时间顺序）
  if (G.roundLogs.length > 0) {
    G.roundLogs[G.roundLogs.length - 1].entries.push(msg);
  }
}
function esc(s)      {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
//  启动
// ============================================================
window.addEventListener('DOMContentLoaded', lb_renderRows);
