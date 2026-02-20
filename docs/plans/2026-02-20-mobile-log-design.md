# 手机适配 & 日志系统设计文档

**日期**: 2026-02-20
**范围**: `index.html`、`style.css`、`game.js`

---

## 背景

当前游戏界面未充分适配手机屏幕：按钮靠右对齐，日志区为单行截断显示。
本次迭代目标：居中按钮、日志按局分组可滚动、跨 session 历史记录持久化。

---

## 一、按钮居中布局

**改动位置**: `style.css` → `#controls`

- 当前：`justify-content: space-between`（状态文字左，按钮右）
- 改为：`flex-direction: column; align-items: center; gap: 10px`
  - 第一行：状态文字居中
  - 第二行：按钮组居中排列

---

## 二、日志区重构

**改动位置**: `index.html` 中 `#game-log` → 替换为 `#log-panel`；`style.css` 新增样式；`game.js` 中 `renderLog()` 重写。

### 结构
```html
<div id="log-panel">
  <div class="log-section-title">📋 本次游戏记录</div>
  <div id="log-current">
    <!-- 按局分组，每局一个 .log-round-block -->
    <div class="log-round-block">
      <div class="log-round-header">第 N 局 · 庄: XX</div>
      <div class="log-entry">...</div>
    </div>
  </div>
  <div class="log-section-title">📂 历史记录（最近 3 次）</div>
  <div id="log-history">
    <!-- 来自 localStorage，按 session 折叠展示 -->
  </div>
</div>
```

### 样式
- `#log-panel`: `max-height: 55vh; overflow-y: auto; padding: 12px 16px`
- `.log-round-block`: `margin-bottom: 12px; border-left: 2px solid var(--border); padding-left: 10px`
- `.log-round-header`: `font-size: 12px; color: var(--gold); margin-bottom: 4px`
- `.log-entry`: `font-size: 12px; color: var(--muted); line-height: 1.6`

---

## 三、数据结构

### `G.roundLogs`（新增）
```javascript
G.roundLogs = []
// 每个元素格式:
// { round: N, dealer: "玩家1", entries: ["玩家2【牛牛】胜 ×4 +400", ...] }
```

- `startRound()` 时 push 新对象：`{ round: G.round, dealer: G.players[G.dealerIdx].name, entries: [] }`
- `addLog(msg)` 同时往 `G.roundLogs[last].entries.push(msg)`（时序正向）

### localStorage
- Key: `"niuniu_history"`
- Value: `[{ date: "YYYY-MM-DD HH:MM", rounds: [...] }, ...]`，最多 3 条
- 写入时机：每次 `settle()` 完成 + `showGameOver()` 时

---

## 四、游戏结束面板

**改动位置**: `index.html` → `#game-over` / `.go-box`；`UI.showGameOver()` 增加日志渲染。

在排名列表和"再来一局"按钮之间，插入可滚动日志区：
```html
<div id="go-log" class="go-log-scroll">
  <!-- G.roundLogs 按局渲染，新局在上 -->
</div>
```

- 样式：`max-height: 40vh; overflow-y: auto; width: 100%`

---

## 五、文件改动汇总

| 文件 | 改动 |
|------|------|
| `style.css` | `#controls` 居中；`#game-log` → `#log-panel` 新样式；游戏结束日志样式 |
| `index.html` | `#controls` 布局；`#game-log` → `#log-panel`；`#game-over` 内部结构 |
| `game.js` | `G.roundLogs` 状态；`addLog()` 双写；`startRound()` 新建 roundLog；`settle()` 写 localStorage；`UI.renderLog()` 重写；`UI.showGameOver()` 加日志区 |
