# Whileplay · 玩一小局

[简体中文](README.md) | English

[![Release](https://img.shields.io/github/v/release/monster-cli/dsh-whileplay?color=4d6bfe)](https://github.com/monster-cli/dsh-whileplay/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Let AI work. Play a little.**

Whileplay brings Air Battle, Tank Battle, and Snake into a floating arcade beside your [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) conversation. Tool calls introduce enemies or bonus targets. Each completed task step sends a new power-up to collect.

Keep playing while AI works. When the conversation stops running or needs your input, the game pauses so you can return to it.

[Get started](#quick-start) · [Explore the games](#three-games-three-ways-to-play-along) · [Releases](https://github.com/monster-cli/dsh-whileplay/releases)

## Why try Whileplay?

- **Your task becomes part of the game.** Tool calls become aircraft bosses, armored tanks, or bonus fruit. Completed steps bring supplies, adding changes from your current conversation to each round.
- **Put the game where you want it.** Move and resize the floating window, or switch to minimal mode for a compact, game-only view.
- **Return when you are needed.** The game pauses when the conversation stops running, awaits approval, or asks for input. Resume the round when you are ready.
- **Try it right after installation.** Every game includes a task-escort demo that needs no model setup. Chinese and English interfaces, plus light and dark themes, fit your workspace.

## See it in action

Open Whileplay beside the chat composer and explore task-linked targets and power-ups across all three games.

![Whileplay: task-linked targets and power-ups in three classic games](docs/assets/whileplay-v0.2.0-demo.gif)

## Quick start

You need DeepSeek Harness with its Web profile, Node.js `^22.19.0 || >=24.0.0`, and npm. The current release has been verified with Harness `0.2.1-alpha.4`; other host versions have not been verified.

**1. Download the plugin.** Get [dsh-whileplay-0.2.0.tgz](https://github.com/monster-cli/dsh-whileplay/releases/download/v0.2.0/dsh-whileplay-0.2.0.tgz).

**2. Install and start.** Run these commands in the directory containing the package:

```sh
dsh plugin --profile web add ./dsh-whileplay-0.2.0.tgz
dsh web
```

Restart the Web profile after installation if Harness Web is already running.

<details>
<summary>No global dsh command? Use npx</summary>

```sh
npx @deepseek-ai/dsh plugin --profile web add ./dsh-whileplay-0.2.0.tgz
npx @deepseek-ai/dsh web
```

</details>

**3. Play a little.** Open the URL printed in your terminal, click **“◈ Play a little”** beside the chat composer, choose a game, and click **“Start game.”** When no task is running, click **“Try task escort”** to explore the targets and power-ups immediately.

## Three games, three ways to play along

| Game | Classic gameplay | Targets from tool calls | Supplies from completed steps |
| --- | --- | --- | --- |
| **Air Battle** | Move in all four directions and fire automatically | Bomber, transport, and armored aircraft bosses | Twin shot, shield, screen-clearing bomb |
| **Tank Battle** | Break through bricks, navigate steel walls, and defend your base | Armored enemy tanks that take three hits | Rapid fire, shield, battlefield bomb |
| **Snake** | Eat, grow, and avoid the walls and your own body | Timed bonus fruit labeled with tool names | Double score, shield, slow motion |

Once spawned, task targets follow the game's rules until defeated, collected, or gone. Game outcomes and task execution are independent. At most two tool targets appear at once; bursts of calls wait their turn.

### Controls

- **Air Battle:** use the arrow keys or drag on the canvas to move. Your aircraft fires automatically.
- **Tank Battle:** use the arrow keys to move and turn, and `Space` to fire. Bricks can be destroyed; steel blocks shots. Opposing bullets cancel each other out. You have three lives; losing them or losing the base ends the round.
- **Snake:** use the arrow keys to turn and collect food and bonus fruit.

Click the canvas to use keyboard controls. The window also provides direction and fire buttons. Press `Escape` to collapse it.

### Catch a power-up. Change the round.

Every completed AI step sends a supply worth an extra +20 points when collected. Aircraft supplies drift downward, tank supplies appear in reachable open lanes, and Snake supplies appear on free cells. Tank and Snake supplies, and bonus fruit, remain for 12 seconds.

| Power-up | Effect |
| --- | --- |
| **Twin shot / rapid fire / double score** | Boosts aircraft firepower, tank firing rate, or Snake scoring for 8 seconds. Collecting another refreshes the duration. |
| **Shield** | Absorbs one hit and does not stack. Snake tries to turn into an adjacent safe cell; the round still ends if no safe turn exists. |
| **Bomb** | In Air Battle, clears enemy shots, destroys ordinary aircraft, and deals 6 damage to bosses. In Tank Battle, clears enemy shots and tanks while preserving walls and the base. |
| **Slow motion** | Slows Snake for 8 seconds, giving you more time to turn. |

Destroying a tool aircraft awards +100 points; an armored tool tank, +200. Tool fruit awards +30 and grows the snake by one cell. Snake's double-score effect applies to ordinary food, tool fruit, and supply pickups. Supply lifetimes and active effects freeze while paused.

## A small window, an easy return to work

- **Move and resize:** drag the title bar or dotted handle to move the window; drag any edge or corner to resize it. Adjusting the window pauses the game. Click “Resume” when ready.
- **Minimal mode:** hide the library, heading, and toolbar, leaving just the game. Hover to reveal move, pause, and restore controls. These controls stay visible on touch devices.
- **Automatic pauses:** the game pauses when the conversation stops running, awaits approval or input, or its status becomes unavailable. Leaving the browser window or hiding the page also pauses it. Resume manually when you return.

Collapsing the window preserves progress on the current page. Switching games or conversations starts a new round. Refreshing resets the round and window layout; best scores are stored in your current browser. A task ending displays a round summary so you can return to the conversation and read the reply.

## FAQ

**Do I need a model or API key?**

The games and task-escort demo need neither, and make no additional model requests. For live task-linked play, configure and run an AI task as you normally would in DeepSeek Harness.

**Why is “Try task escort” disabled?**

The demo is unavailable while the current conversation is running a task or waiting for your input. When a real task starts, the game follows that conversation's progress.

**How do I upgrade or uninstall?**

To upgrade, download the new `.tgz`, run the installation command again, and restart the Web profile. To uninstall, run the command below, then restart the Web profile:

```sh
dsh plugin --profile web remove dsh-whileplay
```

If you run Harness through npm, use `npx @deepseek-ai/dsh plugin --profile web remove dsh-whileplay`. Uninstalling does not automatically clear best scores stored in your browser.

## Get involved

Report bugs or suggest games and new ways to play through [Issues](https://github.com/monster-cli/dsh-whileplay/issues). For source installation, development, and testing, see the [development guide (简体中文)](https://github.com/monster-cli/dsh-whileplay/blob/main/docs/DEVELOPMENT.md).

[MIT License](LICENSE)
