# 手机适配 & 日志系统 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 居中游戏按钮、新增按局分组的可滚动日志区、跨 session 历史记录（localStorage 最近 3 次）、游戏结束面板内嵌完整日志。

**Architecture:** 纯静态单页应用，3 个源文件（index.html / style.css / game.js）。在 `game.js` 的 `G` 状态对象中新增 `roundLogs` 数组，每局开始时写入新条目，`addLog()` 双写；`settle()` 后持久化到 localStorage；`UI.renderLog()` 完全重写；`showGameOver()` 内嵌本次完整日志。无构建步骤，直接打开 index.html 验证。

**Tech Stack:** 原生 HTML/CSS/JS，localStorage API；无测试框架，JS 纯逻辑用 node 临时脚本测试，UI 变化在浏览器手动验证。

---

## 重要背景（阅读代码前必看）

- **文件路径**: `/Users/zhaobingyang/Desktop/code/niuniu_claude/`
- **游戏阶段**: `G.phase` = `'ready' | 'dealing' | 'settled'`
- **当前日志**: `G.log`（数组，`addLog()` 用 `unshift` 前插，最多 20 条）
- **渲染入口**: `UI.renderLog()` 当前在 game.js:424，把 `G.log.slice(0,8)` 写进 `#game-log`
- **测试方法**: `node /tmp/test_script.js` 跑纯逻辑；UI 在浏览器 `open index.html` 后手动验证

---

### Task 1: CSS — 控制区按钮居中

**Files:**
- Modify: `style.css:289-312`（`#controls` 和 `.btn` 区块）

**Step 1: 阅读现有控制区样式**

阅读 `style.css` 第 289-320 行，确认当前 `#controls` 使用 `justify-content: space-between`。

**Step 2: 修改 `#controls` 为居中布局**

将 `style.css` 中的 `#controls` 改为：

```css
#controls {
  padding: 12px 20px 16px;
  display: flex; align-items: center; justify-content: center;
  flex-direction: column;
  gap: 10px;
}
#status-msg { font-size: 13px; color: var(--muted); text-align: center; }
#action-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
```

**Step 3: 浏览器验证**

`open /Users/zhaobingyang/Desktop/code/niuniu_claude/index.html`，开始游戏后检查"发牌"按钮是否居中显示。

**Step 4: Commit**

```bash
git add style.css
git commit -m "样式：控制区按钮居中布局"
```

---

### Task 2: CSS — 移除旧日志样式，新增日志面板样式

**Files:**
- Modify: `style.css`（`#game-log` 区块，约 314-321 行）

**Step 1: 阅读现有日志样式**

阅读 `style.css` 第 314-321 行，确认旧 `#game-log` 样式（`white-space: nowrap; overflow: hidden`）。

**Step 2: 替换旧样式，新增日志面板样式**

找到并删除旧 `#game-log` 规则块，替换为以下内容（插入到 `/* ===== 弹窗通用 =====` 注释之前）：

```css
/* ===== 日志面板 ===== */
#log-panel {
  border-top: 1px solid var(--border);
  padding: 0 0 24px;
}

.log-section-title {
  font-size: 11px; font-weight: 600; color: var(--muted);
  letter-spacing: 1px; text-transform: uppercase;
  padding: 10px 20px 6px;
  background: rgba(255,255,255,.02);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0;
}

.log-current-wrap, .log-history-wrap {
  padding: 8px 20px;
}

.log-round-block {
  margin-bottom: 12px;
  border-left: 2px solid rgba(255,255,255,.1);
  padding-left: 10px;
}

.log-round-header {
  font-size: 12px; font-weight: 700; color: var(--gold);
  margin-bottom: 4px; letter-spacing: .5px;
}

.log-entry {
  font-size: 12px; color: var(--muted);
  line-height: 1.8; display: block;
}

/* 历史 session */
.log-history-session {
  margin-bottom: 14px;
}
.log-history-session-header {
  font-size: 11px; color: #4a5568;
  border-left: 2px solid #2d3748;
  padding-left: 8px; margin-bottom: 6px;
}
.log-history-session .log-round-block {
  border-left-color: #2d3748;
  opacity: .7;
}

/* 游戏结束日志区 */
.go-log-title {
  font-size: 12px; color: var(--muted); font-weight: 600;
  letter-spacing: 1px; align-self: flex-start;
  margin-top: 4px;
}
#go-log {
  max-height: 36vh; overflow-y: auto;
  width: 100%;
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 14px;
  background: rgba(0,0,0,.2);
}
```

**Step 3: Commit**

```bash
git add style.css
git commit -m "样式：新增日志面板与游戏结束日志样式"
```

---

### Task 3: HTML — 更新控制区结构

**Files:**
- Modify: `index.html:89-96`（`#controls` 块）

**Step 1: 阅读现有 HTML**

阅读 `index.html` 第 89-96 行，确认 `#controls` 结构。

**Step 2: 无需修改 HTML 控制区**

`#controls` 内部元素结构（`#status-msg` + `#action-btns`）不变，样式已由 Task 1 的 CSS 搞定。跳过此 step。

---

### Task 4: HTML — 替换日志区 & 更新游戏结束面板

**Files:**
- Modify: `index.html:98`（`#game-log` → `#log-panel`）
- Modify: `index.html:117-123`（`#game-over` 内部）

**Step 1: 替换 `#game-log`**

找到 `index.html` 中的：
```html
  <div id="game-log"></div>
```
替换为：
```html
  <div id="log-panel">
    <div class="log-section-title">📋 本次游戏记录</div>
    <div class="log-current-wrap" id="log-current"></div>
    <div class="log-section-title">📂 历史记录（最近 3 次）</div>
    <div class="log-history-wrap" id="log-history"></div>
  </div>
```

**Step 2: 更新游戏结束面板**

找到 `index.html` 中的游戏结束区块：
```html
<div id="game-over" class="hidden">
  <div class="go-box">
    <h2 id="go-title">游戏结束</h2>
    <div id="go-ranks"></div>
    <button class="btn-start" onclick="location.reload()">再来一局</button>
  </div>
</div>
```
替换为：
```html
<div id="game-over" class="hidden">
  <div class="picker-backdrop" onclick=""></div>
  <div class="picker-box go-box">
    <div class="picker-header">
      <h2 id="go-title" style="font-size:18px;color:var(--gold)">游戏结束</h2>
    </div>
    <div style="padding:16px 20px;overflow-y:auto;max-height:75vh;display:flex;flex-direction:column;gap:14px;">
      <div id="go-ranks"></div>
      <div class="go-log-title">📋 完整记录</div>
      <div id="go-log"></div>
    </div>
    <div class="picker-footer">
      <button class="btn-start" style="padding:10px 24px;font-size:14px" onclick="location.reload()">再来一局</button>
    </div>
  </div>
</div>
```

**Step 3: Commit**

```bash
git add index.html
git commit -m "HTML：替换日志区结构，更新游戏结束面板"
```

---

### Task 5: JS — 扩展 G 状态，修改 addLog()，修改 startRound()

**Files:**
- Modify: `game.js:99-107`（`G` 对象）
- Modify: `game.js:437`（`addLog()` 函数）
- Modify: `game.js:175-205`（`startRound()` 函数）

**Step 1: 在 `G` 对象中新增 `roundLogs`**

找到 `game.js` 中的 `G` 对象（约第 99-107 行）：
```javascript
const G = {
  players:       [],
  baseBet:       100,
  dealerIdx:     0,
  prevDealerIdx: null,
  phase:         'ready',
  round:         0,
  log:           [],
};
```
替换为：
```javascript
const G = {
  players:       [],
  baseBet:       100,
  dealerIdx:     0,
  prevDealerIdx: null,
  phase:         'ready',
  round:         0,
  log:           [],
  roundLogs:     [],   // 当前 session 按局日志: [{round,dealer,entries[]}]
};
```

**Step 2: 修改 `addLog()` 双写**

找到 `game.js` 中的 `addLog`（约第 437 行）：
```javascript
function addLog(msg) { G.log.unshift(msg); if (G.log.length > 20) G.log.pop(); }
```
替换为：
```javascript
function addLog(msg) {
  G.log.unshift(msg);
  if (G.log.length > 100) G.log.pop();
  // 双写到当前局日志（时间顺序）
  if (G.roundLogs.length > 0) {
    G.roundLogs[G.roundLogs.length - 1].entries.push(msg);
  }
}
```

**Step 3: 在 `startRound()` 开头新建当轮日志对象**

找到 `startRound()` 函数（约第 175 行），在 `G.round++` 之后、`addLog(...)` 之前插入：

找到这段：
```javascript
  G.round++;
  G.phase = 'dealing';
  el('round-info').textContent = `第 ${G.round} 局`;
  el('phase-label').textContent = '发牌中…';
  UI.showBtns('dealing');
  setStatus('发牌中，请稍候…');

  // 重置
  G.prevDealerIdx = null;
```

在 `G.round++` 后立即插入（整段替换成）：
```javascript
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
```

**Step 4: 用 node 测试核心逻辑**

创建 `/tmp/test_roundlogs.js`：
```javascript
// 模拟 addLog 双写逻辑
const G = { log: [], roundLogs: [] };

function addLog(msg) {
  G.log.unshift(msg);
  if (G.log.length > 100) G.log.pop();
  if (G.roundLogs.length > 0) {
    G.roundLogs[G.roundLogs.length - 1].entries.push(msg);
  }
}

// 模拟第 1 局
G.roundLogs.push({ round: 1, dealer: '玩家1', entries: [] });
addLog('第 1 局 · 庄: 玩家1');
addLog('玩家2【牛牛】胜 ×4 +400');

// 模拟第 2 局
G.roundLogs.push({ round: 2, dealer: '玩家2', entries: [] });
addLog('第 2 局 · 庄: 玩家2');
addLog('玩家1【牛三】负 ×1 -100');

console.assert(G.roundLogs.length === 2, '应有 2 局');
console.assert(G.roundLogs[0].entries.length === 2, '第 1 局应有 2 条');
console.assert(G.roundLogs[1].entries.length === 2, '第 2 局应有 2 条');
console.assert(G.roundLogs[0].entries[0] === '第 1 局 · 庄: 玩家1', '顺序正确');
console.assert(G.log[0] === '第 2 局 · 庄: 玩家2', 'G.log 最新在前');
console.log('✅ 所有测试通过');
```

运行：`node /tmp/test_roundlogs.js`
预期输出：`✅ 所有测试通过`

**Step 5: Commit**

```bash
git add game.js
git commit -m "逻辑：扩展G状态，addLog双写roundLogs，startRound新建轮日志"
```

---

### Task 6: JS — 新增 localStorage 持久化

**Files:**
- Modify: `game.js`（在工具函数区域，约第 432-441 行附近新增函数）
- Modify: `game.js:207-288`（`settle()` 函数末尾）

**Step 1: 新增 `saveSessionHistory()` 和 `loadSessionHistory()` 函数**

在 `game.js` 的工具函数区域（`function el(id)` 附近，约第 433 行之前），新增：

```javascript
const HISTORY_KEY = 'niuniu_history';
const HISTORY_MAX = 3;

function saveSessionHistory() {
  try {
    const item = {
      date: new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
      rounds: G.roundLogs.slice()  // 浅拷贝当前 session 所有轮
    };
    let history = loadSessionHistory();
    // 避免同一 session 重复追加：如果最后一次 date 相同则替换
    if (history.length > 0 && history[0].date === item.date) {
      history[0] = item;
    } else {
      history.unshift(item);
    }
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch(e) { /* localStorage 不可用时静默失败 */ }
}

function loadSessionHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch(e) { return []; }
}
```

**Step 2: 在 `settle()` 末尾调用 `saveSessionHistory()`**

找到 `settle()` 函数末尾（在 `UI.renderLog()` 调用之后）：
```javascript
  UI.render();
  UI.showBtns('settled');
  UI.renderLog();
}
```
替换为：
```javascript
  UI.render();
  UI.showBtns('settled');
  UI.renderLog();
  saveSessionHistory();
}
```

**Step 3: 用 node 测试 localStorage 逻辑（模拟）**

创建 `/tmp/test_history.js`：
```javascript
// 模拟 localStorage
const store = {};
const localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v; }
};

const HISTORY_KEY = 'niuniu_history';
const HISTORY_MAX = 3;

function loadSessionHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e) { return []; }
}

function saveSessionHistory(roundLogs, dateStr) {
  const item = { date: dateStr, rounds: roundLogs.slice() };
  let history = loadSessionHistory();
  if (history.length > 0 && history[0].date === item.date) {
    history[0] = item;
  } else {
    history.unshift(item);
  }
  if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// 模拟 4 次保存（超出 HISTORY_MAX=3）
saveSessionHistory([{round:1}], '02/17 10:00');
saveSessionHistory([{round:1},{round:2}], '02/18 14:00');
saveSessionHistory([{round:1}], '02/19 09:00');
saveSessionHistory([{round:1},{round:2},{round:3}], '02/20 11:00');

const h = loadSessionHistory();
console.assert(h.length === 3, `应保留最近 3 次，实际 ${h.length}`);
console.assert(h[0].date === '02/20 11:00', '最新在前');
console.assert(h[2].date === '02/18 14:00', '最旧是第 2 次');
console.log('✅ 历史记录持久化测试通过');
```

运行：`node /tmp/test_history.js`
预期输出：`✅ 历史记录持久化测试通过`

**Step 4: Commit**

```bash
git add game.js
git commit -m "逻辑：新增localStorage历史记录保存，settle后自动持久化"
```

---

### Task 7: JS — 重写 `UI.renderLog()`

**Files:**
- Modify: `game.js:424-427`（`renderLog()` 函数）

**Step 1: 阅读现有 renderLog**

阅读 `game.js` 第 424-427 行，确认当前写法（写入 `#game-log`）。

**Step 2: 完整替换 `renderLog()`**

找到：
```javascript
  renderLog() {
    el('game-log').innerHTML = G.log.slice(0, 8)
      .map(m => `<span>${esc(m)}</span>`).join('');
  },
```

替换为：
```javascript
  renderLog() {
    // --- 本次游戏记录（当前 session，按局逆序展示）---
    const rounds = G.roundLogs.slice().reverse();  // 新局在上
    el('log-current').innerHTML = rounds.length === 0
      ? '<p style="font-size:12px;color:#3d4f6a;padding:8px 0">暂无记录</p>'
      : rounds.map(r => `
          <div class="log-round-block">
            <div class="log-round-header">第 ${r.round} 局 · 庄: ${esc(r.dealer)}</div>
            ${r.entries.map(e => `<span class="log-entry">${esc(e)}</span>`).join('')}
          </div>`).join('');

    // --- 历史记录（localStorage 最近 3 次 session）---
    const history = loadSessionHistory();
    el('log-history').innerHTML = history.length === 0
      ? '<p style="font-size:12px;color:#3d4f6a;padding:8px 0">暂无历史</p>'
      : history.map(session => `
          <div class="log-history-session">
            <div class="log-history-session-header">${esc(session.date)}</div>
            ${(session.rounds || []).slice().reverse().map(r => `
              <div class="log-round-block">
                <div class="log-round-header">第 ${r.round} 局 · 庄: ${esc(r.dealer)}</div>
                ${(r.entries || []).map(e => `<span class="log-entry">${esc(e)}</span>`).join('')}
              </div>`).join('')}
          </div>`).join('');
  },
```

**Step 3: 浏览器验证**

`open /Users/zhaobingyang/Desktop/code/niuniu_claude/index.html`，开始游戏，打 2-3 局后：
- 检查页面底部是否出现按局分组的日志
- 向下滚动能看到日志区
- 历史记录区显示"暂无历史"（首次）

**Step 4: Commit**

```bash
git add game.js
git commit -m "逻辑：重写renderLog，按局分组显示，含历史session"
```

---

### Task 8: JS — 更新 `UI.showGameOver()`

**Files:**
- Modify: `game.js:411-422`（`showGameOver()` 函数）

**Step 1: 阅读现有 showGameOver**

阅读 `game.js` 第 411-422 行。

**Step 2: 在 `showGameOver()` 末尾追加日志渲染**

找到：
```javascript
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
```

替换为：
```javascript
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

    // 渲染本次完整日志（按局逆序）
    const rounds = G.roundLogs.slice().reverse();
    el('go-log').innerHTML = rounds.length === 0
      ? '<p style="font-size:12px;color:#3d4f6a">暂无记录</p>'
      : rounds.map(r => `
          <div class="log-round-block" style="margin-bottom:10px">
            <div class="log-round-header">第 ${r.round} 局 · 庄: ${esc(r.dealer)}</div>
            ${r.entries.map(e => `<span class="log-entry">${esc(e)}</span>`).join('')}
          </div>`).join('');

    saveSessionHistory();   // 确保最终状态已保存
    el('game-over').classList.remove('hidden');
  },
```

**Step 3: 浏览器全流程验证**

1. `open index.html`，设置 3 名玩家，开始游戏
2. 打 3 局
3. 点击"结束游戏"，检查弹窗内是否显示完整日志，可滚动
4. 再来一局，打 2 局后再结束，检查"历史记录"区是否显示上次游戏

**Step 4: Commit**

```bash
git add game.js
git commit -m "逻辑：showGameOver内嵌完整日志，保存sessionHistory"
```

---

### Task 9: 最终验收 & 收尾

**Step 1: 全面手机适配检查**

在浏览器开发工具中切换到 iPhone 尺寸（375px 宽），检查：
- [ ] 按钮居中显示，不偏右
- [ ] 日志区在页面最底部，可向上滚动到达
- [ ] 本次游戏日志按局分组，新局在上
- [ ] 历史记录显示上次游戏内容
- [ ] 游戏结束弹窗内日志可滚动

**Step 2: 清理临时测试文件**

```bash
rm -f /tmp/test_roundlogs.js /tmp/test_history.js
```

**Step 3: 最终 commit**

```bash
git add -A
git status   # 确认无多余文件
git commit -m "完成手机适配与日志系统迭代"
```
