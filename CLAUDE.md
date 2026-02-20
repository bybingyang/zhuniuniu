# niuniu_claude

基于浏览器的牛牛纸牌游戏现场记分器。

## 运行方式

```
open index.html
```

或将 `index.html` 拖入任意现代浏览器。无需服务器——纯静态文件，无需构建步骤。

## 测试游戏逻辑

无正式测试框架。如需对纯 JS 函数进行单元测试，将相关函数复制到临时脚本中，用 node 运行：

```
node /tmp/test_script.js
```

## 架构

**3 个源文件**：`index.html`、`style.css`、`game.js`（427 行）

`game.js` 按命名空间组织：

- `LB` — 大厅模块：游戏开始前的玩家设置
- `G` — 全局游戏状态（玩家数组、局数、阶段、日志）
- `UI` — 所有 DOM 渲染（`render`、`buildRow`、`showBtns`、`showScoreEdit`、`showGameOver`、`renderLog`）
- 模块级牌型引擎函数：`evaluateHand()`、`compareHands()`、`compareNiuNiu()`
- `startRound()`、`settle()`、`nextRound()` 驱动游戏循环

**`G.phase`**（`'ready' | 'dealing' | 'settled'`）控制哪些 UI 按钮和状态可见。

## 游戏规则概要

- 结算始终为庄家 vs 每位闲家；闲家之间不互相结算
- 换庄仅在有人持有牛牛（10 级）时触发；平局时比最大单张（先比面值，再比花色）

## 关键常量

- 牌面值：`CARD_VALUES`，花色排名：`SUIT_RANK`
- 所有 10 种三张牌索引组合预先计算存于 `TRIOS`
- 手牌倍率：牛八×2、牛九×3、牛牛×4（其余×1）
