# Whileplay 开发指南

## 环境

- Node.js `^22.19.0 || >=24.0.0` 和 npm。
- 调试宿主集成时，准备一份已安装依赖并完成构建的 DeepSeek Harness 源码。
- Windows 的本地预览脚本使用 PowerShell。

源码构建和游戏规则测试不需要额外的 npm 依赖。客户端交互测试复用 Harness 已安装的 React、ReactDOM 和 jsdom；真实页面测试复用其 Playwright。

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
| `src/tank.js` | 坦克地图、敌方行为、碰撞与渲染 |
| `src/window.js` | 窗口边界、移动与缩放比例 |
| `scripts/build.mjs` | 生成客户端分发入口 `client.js` |
| `tests/` | 游戏规则、窗口和客户端交互测试 |

会话联动使用 `conversation.input.left` 插槽提供的 `sessionId` 和 `useSessionStatus`。只有观察到运行到停止的变化才提示查看回复；状态不可用或有 `pendingInteraction` 时暂停，恢复后由用户手动继续。

## 打包与发布

```sh
npm run build
npm test
npm pack
```

涉及客户端或宿主集成的修改，还应设置 `DSH_SOURCE_ROOT` 并运行客户端和真实页面测试。安装包包含宿主入口、编译后的客户端、加载声明、README 和 LICENSE。

发布 Release 时，以对应提交为版本标签，将生成的 `.tgz` 包作为附件上传，并在发布说明中记录安装命令、已验证的宿主版本、验证所用源码提交号和安装包校验值。首页 README 仅保留版本兼容性说明。

`.runtime/`、`artifacts/`、`node_modules/`、本地安装包、环境配置和日志已被 `.gitignore` 排除。演示图应选用适合公开的截图，并放入专用文档资源目录。
