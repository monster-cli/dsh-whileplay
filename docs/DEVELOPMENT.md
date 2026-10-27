# Whileplay 开发指南

## 环境

- Node.js `^22.19.0 || >=24.0.0` 和 npm。
- 调试宿主集成时，准备一份已安装依赖并完成构建的 DeepSeek Harness 源码。
- Windows 的本地预览脚本使用 PowerShell。

先运行 `npm ci` 安装宿主投影使用的 Zod 校验依赖。客户端交互测试复用 Harness 已安装的 React、ReactDOM 和 jsdom；真实页面测试复用其 Playwright。

## 构建与基础测试

在 Whileplay 项目根目录运行：

```sh
npm run build
npm test
```

构建生成 `client.js`。该文件是插件分发入口，需要与源码一起提交。

未设置 `DSH_SOURCE_ROOT` 时，客户端交互测试会明确显示为跳过；规则与窗口几何测试照常运行。此结果不代表客户端集成已通过。

## 客户端交互测试

设置 `DSH_SOURCE_ROOT`，指向已经安装依赖并构建完成的 Harness 源码目录。以下示例将两个仓库放在同一父目录下。

PowerShell：

```powershell
$env:DSH_SOURCE_ROOT = (Resolve-Path '../deepseek-harness').Path
npm run test:client
```

macOS / Linux shell：

```sh
export DSH_SOURCE_ROOT="$(cd ../deepseek-harness && pwd)"
npm run test:client
```

按实际源码位置调整路径。测试覆盖会话暂停、显示模式切换、存档兼容和卸载清理。设置好环境变量后，`npm test` 也会包含这一项集成测试。

## 从 Harness 源码启动预览

在 Whileplay 根目录运行：

```powershell
./scripts/start-local.ps1 -HarnessRoot '../deepseek-harness'
```

也可以先设置 `DSH_SOURCE_ROOT`，再直接运行 `./scripts/start-local.ps1`。脚本构建插件、生成本地 overlay，通过官方 `dsh web --patch` 入口启动，只在本次进程中加载插件，不修改 Harness 源码或安装到现有 profile。

脚本默认沿用 Harness 的数据目录。下面的命令使用独立数据目录和系统分配的端口：

```powershell
$env:DSH_HOME = Join-Path (Get-Location) '.runtime/local-home'
./scripts/start-local.ps1 -HarnessRoot '../deepseek-harness' -HarnessArgs '--no-open','--port','0'
```

## 真实页面测试

设置好 `DSH_SOURCE_ROOT`，并准备其 Playwright 依赖和可启动的浏览器，再运行：

```sh
npm run test:host
```

Windows 默认使用本机 Edge；其他平台默认使用 Playwright 的 Chromium。可用 `WHILEPLAY_BROWSER_CHANNEL` 指定已安装的浏览器，例如 PowerShell 中设置：

```powershell
$env:WHILEPLAY_BROWSER_CHANNEL = 'chrome'
```

测试通过 `dsh` profile 启动临时服务，不向模型发送请求。检查范围包括三个游戏、暂停恢复、搜索分类、主题切换、窗口与极简模式、列表滚动和窄屏布局。

每次运行使用独立的 `.runtime/host-smoke-*` 数据目录，截图写入 `artifacts/`。测试结束后关闭服务与浏览器，保留数据以便排查失败。列表压力测试追加的临时 DOM 行只用于检查布局，不代表新增可玩游戏。

## 源码结构

| 路径 | 用途 |
| --- | --- |
| `index.js`、`cordis.patch.yml` | 宿主入口与插件加载声明 |
| `src/ui.js`、`src/arcade.css` | 界面、主题、交互与会话联动 |
| `src/engine.js` | 游戏目录、飞机大战和贪吃蛇 |
| `src/tank.js` | 坦克地图、敌方行为、碰撞、精英坦克与可达补给位置 |
| `src/mission-game.js`、`src/ground-mission.js` | 三款游戏的任务适配、道具效果、演练与状态绘制 |
| `src/window.js` | 窗口边界、移动与缩放比例 |
| `scripts/build.mjs` | 生成客户端分发入口 `client.js` |
| `tests/` | 游戏规则、窗口和客户端交互测试 |

会话联动使用 `conversation.input.left` 插槽提供的 `sessionId`、`useSessionStatus` 和 `useProjection`。宿主入口在官方 `sessionProjections` 注册 `whileplayMission`，纯函数折叠 `turn/start`、`tool/call`、`tool/result`、`step/end`、`turn/end`；不修改任务、不调用工具。投影只包含工具名称、调用标识、状态与统计，不包含参数、输出或会话文本。投影最多保留 128 条调用，优先保留运行中的调用。

飞机大战将新工具调用映射成不同敌机，同时最多两架、等待队列最多 12 架；超过视觉容量的调用仍计入任务统计。击落敌机 +100，补给 +20 并获得一次护盾。击落后保留工具状态标记。工具调用只负责触发生成敌机；入场后按游戏节奏持续向下飞行、投弹，直到被击落或飞出画面。工具完成、失败仅更新状态，不改变敌机运动、射击或生命周期。只有击落才获得分数与补给，飞出画面不奖励。任务结束及下一轮开始不会清除已生成的敌机和子弹；暂停时战场冻结，继续后仍按原轨迹飞行。任务结束时暂停并显示本轮工具数、完成数、失败数、击落数与游戏分数；结束不等同于任务成功。历史已结束任务不会重放；打开窗口或重新开局时只接入仍在执行的调用。切换会话会清空战场，避免跨任务混用。

每个新的 `step/end` 触发一份补给；按轮内 Step 编号去重，初次打开或重新开局不补发历史奖励。密集结束的 Step 进入计数队列，补给间隔至少 1.8 秒，画面上已有 6 份补给时暂缓入场。双发占 65%，护盾占 25%，炸弹占 10%。双发持续 8 秒，重复拾取刷新时长；护盾抵挡一次且不叠加；炸弹清除敌方子弹、击毁普通敌机并对 Boss 造成 6 点伤害。道具需要接住，拾取 +20 分；未接住的道具飞出底部后消失。持续效果使用游戏时间，暂停期间不倒计时。

坦克与贪吃蛇复用同一个宿主投影、历史水位与 Step 去重适配器。坦克从空闲入口生成最多两辆三血精英坦克；Step 道具通过玩家位置的通道 flood-fill 选择可达空格，效果为连发、护盾和炸弹。贪吃蛇的工具目标是限时果实，Step 道具为双倍、护盾和减速，位置排除蛇身、普通食物及已有道具。地面道具与果实保留 12 秒，不依赖工具执行结果。近满盘时可以移除额外奖励来给普通食物腾出空格，避免提前结束游戏。

「联动演练」用同一适配器播放 29 秒的本地模拟事件，包含并行调用、失败、再次调用和 6 个 Step 结束；在第 1、4、7 秒依次触发每款游戏对应的三种道具，后续重复一轮。坦克需等待可达空格，玩家需要移动拾取或吃到道具来触发效果。界面和画布持续标注演练，不会发送模型请求；真实任务开始时退出演练并接入真实投影。有待处理交互或真实任务运行时不能启动演练。

验证真实宿主的 Session 事件、投影注册、变化通知和卸载（不调用模型）：

```powershell
$env:DSH_SOURCE_ROOT = 'D:/dsh/deepseek-harness' # 改为实际路径
Push-Location $env:DSH_SOURCE_ROOT
node --import tsx/esm C:/path/to/dsh-whileplay/scripts/projection-smoke.mjs
Pop-Location
```

状态不可用或有 `pendingInteraction` 时暂停，恢复后由用户手动继续。

## 打包与发布

```sh
npm run build
npm test
npm pack
```

涉及客户端或宿主集成的修改，还应设置 `DSH_SOURCE_ROOT` 并运行客户端和真实页面测试。安装包包含宿主入口、编译后的客户端、加载声明、README 和 LICENSE。

发布 Release 时，以对应提交为版本标签，将生成的 `.tgz` 包作为附件上传，并在发布说明中记录安装命令、已验证的宿主版本、验证所用源码提交号和安装包校验值。首页 README 仅保留版本兼容性说明。

`.runtime/`、`artifacts/`、`node_modules/`、本地安装包、环境配置和日志已被 `.gitignore` 排除。演示图应选用适合公开的截图，并放入专用文档资源目录。
