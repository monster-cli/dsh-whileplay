# 玩一小局 · Whileplay

在 DeepSeek Harness 等待 AI 回复时，随手玩一小局。

Whileplay 是一个独立的 Web 客户端插件，内置飞机大战、坦克大战和贪吃蛇。支持可移动、可缩放的悬浮窗口，以及只保留游戏画面的极简模式。

## 功能

| 游戏 | 操作 | 玩法 |
| --- | --- | --- |
| 飞机大战 | 左右方向键或在画布上拖动 | 自动射击，击落敌机每架 +10 分，撞到敌机结束 |
| 坦克大战 | 方向键移动转向，空格射击 | 击碎砖墙、躲避敌方炮火，击毁敌坦克 +100 分，守卫基地 |
| 贪吃蛇 | 方向键转向 | 吃食物增长，避开边界和自己 |

- 游戏库支持搜索、分类和独立滚动。
- 窗口、按钮和游戏画布跟随 DSH 的浅色、深色主题。
- 收起窗口保留当前页面内的游戏进度，最高分保存在浏览器本地。
- 当前会话结束运行、需要审批或补充信息时，游戏自动暂停。
- 插件自身不调用模型、不注册 AI 工具、不向对话注入游戏内容；仅玩游戏不需要模型 API Key。

## 环境与兼容性

- Node.js：`^22.19.0 || >=24.0.0`，并提供 npm。
- 已安装可运行的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，使用带聊天界面的 `web` profile。
- 已验证的宿主版本：`0.2.1-alpha.4`，源码提交 `86a40220`。

DSH 插件接口尚在演进；其他版本需重新验证。本项目没有额外的 npm 构建依赖，浏览器中的 React 由宿主提供。

## 安装

目前以本地 `.tgz` 安装包分发。以下命令不依赖 npm registry 中已发布的同名包，也不要求将项目放在固定目录。

### 方式一：安装发布包

如果当前仓库的 Releases 中已经提供安装包，下载 `dsh-whileplay-0.1.0.tgz`，在文件所在目录执行：

```sh
dsh plugin --profile web add ./dsh-whileplay-0.1.0.tgz
```

尚未发布 Release 时，请使用下面的源码打包方式。安装命令会将插件添加到 Web profile 的依赖中。

### 方式二：从源码打包

克隆当前仓库，或下载源码压缩包并解压。进入项目根目录执行：

```sh
npm run build
npm test
npm pack
```

生成 `dsh-whileplay-0.1.0.tgz` 后执行：

```sh
dsh plugin --profile web add ./dsh-whileplay-0.1.0.tgz
```

如果未将 `dsh` 安装到 PATH，请使用 Harness 安装方式提供的等效 CLI 命令，例如在准备好的 Harness 源码目录运行 `pnpm dsh plugin --profile web add <安装包的绝对路径>`。

### 打开与卸载

安装后启动或重启 Web profile：

```sh
dsh web
```

打开控制台给出的页面，点击聊天输入框旁的 **「◈ 玩一小局」**，选择游戏并点击「开始游戏」。

卸载时执行：

```sh
dsh plugin --profile web remove dsh-whileplay
```

然后重启 Web profile。卸载不会自动清除浏览器中已保存的最高分。

## 浮动窗口与极简模式

- **移动**：拖动标题栏或点状手柄。
- **缩放**：拖动四边或四角；画面保持比例，不改变游戏速度或碰撞坐标。
- **极简模式**：点击标题栏的「极简模式」，隐藏游戏库、标题、分数、说明和工具栏，只显示画面。
- **恢复完整模式**：鼠标移入极简画面，点击浮现的 `↗` 按钮。触屏上始终显示必要控件。
- **暂停与继续**：移动、缩放、切出窗口或焦点离开游戏小窗时暂停，调整完成后手动继续。

切换显示模式不会重新开局；切换游戏会重新开局。窗口位置、尺寸和游戏进度在当前页面内保留，刷新后恢复默认，最高分仍然保留。极简模式同样支持会话暂停提醒。

坦克大战采用 13×13 方形地图。砖墙可以逐块击碎，钢墙不可破坏，双方子弹可以互相抵消。玩家有 3 条生命，受击重生后短暂无敌；生命耗尽或基地被任意一方的子弹击毁时，本局结束。

## 本地开发

### 构建与基础测试

在插件根目录运行：

```sh
npm run build
npm test
```

构建会生成 `client.js`。该文件是插件分发入口，需要与源码一起提交。规则测试和窗口几何测试仅依赖 Node.js。

客户端交互测试需要 Harness 源码及其已安装依赖。未设置 `DSH_SOURCE_ROOT` 时，这一项测试会明确显示为跳过，不代表已验证客户端集成。

### 客户端交互测试

将 `DSH_SOURCE_ROOT` 指向已经安装依赖并构建完成的 Harness 源码目录。

PowerShell：

```powershell
$env:DSH_SOURCE_ROOT = (Resolve-Path '../deepseek-harness').Path
npm run test:client
npm test
```

macOS / Linux shell：

```sh
export DSH_SOURCE_ROOT="$(cd ../deepseek-harness && pwd)"
npm run test:client
npm test
```

这里的 `../deepseek-harness` 仅是示例相对路径，请替换成实际目录。客户端测试使用该源码安装的 React、ReactDOM 和 jsdom，验证会话暂停、模式切换、存档兼容以及卸载清理。

### 从 Harness 源码启动预览

PowerShell 用户可以运行：

```powershell
./scripts/start-local.ps1 -HarnessRoot '../deepseek-harness'
```

也可以先设置 `DSH_SOURCE_ROOT`，再直接运行 `./scripts/start-local.ps1`。脚本构建插件，生成本地 overlay，并通过官方 `dsh web --patch` 入口启动，只在本次进程中加载插件，不修改 Harness 源码或安装到现有 profile。

脚本默认沿用 Harness 的数据目录。需要隔离预览数据时，在同一个 PowerShell 进程设置：

```powershell
$env:DSH_HOME = Join-Path (Get-Location) '.runtime/local-home'
./scripts/start-local.ps1 -HarnessRoot '../deepseek-harness' -HarnessArgs '--no-open','--port','0'
```

### 真实页面测试（可选）

设置好 `DSH_SOURCE_ROOT`，并确保其安装了 Playwright 以及可启动的浏览器，然后运行：

```sh
npm run test:host
```

Windows 默认使用本机 Edge；其他平台默认使用 Playwright 的 Chromium。可通过 `WHILEPLAY_BROWSER_CHANNEL` 选择已安装的浏览器，例如 PowerShell 中设置 `$env:WHILEPLAY_BROWSER_CHANNEL = 'chrome'`。

此测试通过 `dsh` profile 启动临时服务，检查三个游戏、暂停恢复、搜索分类、主题切换、窗口与极简模式、列表滚动和窄屏布局，不向模型发送请求。列表压力测试追加的临时 DOM 行不代表新增可玩游戏。每次运行使用独立的 `.runtime/host-smoke-*` 数据目录，截图写入 `artifacts/`，结束后关闭测试服务与浏览器，保留数据以便排查失败。

## 源码结构

| 路径 | 用途 |
| --- | --- |
| `index.js`、`cordis.patch.yml` | 宿主入口与插件加载声明 |
| `src/ui.js`、`src/arcade.css` | 界面、主题、交互与会话联动 |
| `src/engine.js` | 游戏目录、飞机大战和贪吃蛇 |
| `src/tank.js` | 坦克地图、敌方行为、碰撞与渲染 |
| `src/window.js` | 窗口边界、移动与缩放比例 |
| `scripts/build.mjs` | 生成客户端分发入口 `client.js` |
| `tests/` | 游戏规则、窗口和客户端交互测试 |

会话联动使用 `conversation.input.left` 插槽提供的 `sessionId` 和 `useSessionStatus`。只有观察到运行到停止的变化才提示查看回复；运行停止不代表任务成功。状态不可用或有 `pendingInteraction` 时暂停，恢复后由用户手动继续。游戏键盘操作只在画布聚焦时处理，Escape 收起窗口。

## 发布前检查

```sh
npm run build
npm test
npm pack
```

涉及客户端或宿主集成的修改，还应设置 `DSH_SOURCE_ROOT` 并运行客户端与真实页面测试。安装包包含宿主入口、编译后的客户端、加载声明、README 和 LICENSE，可作为 GitHub Release 附件提供给用户。

`.runtime/`、`artifacts/`、`node_modules/`、本地安装包、环境配置和日志已被 `.gitignore` 排除。不要提交运行数据或凭据；如果需要项目演示图，先选择适合公开的截图，再放到专用的文档资源目录。

## License

[MIT](LICENSE)，Copyright © 2026 Whileplay contributors。
