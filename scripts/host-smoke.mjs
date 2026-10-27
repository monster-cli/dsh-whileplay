// Optional real-host smoke: reuses a source checkout's installed Playwright.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..')
if (!process.env.DSH_SOURCE_ROOT) throw new Error('Set DSH_SOURCE_ROOT to a prepared DeepSeek Harness source checkout before running test:host.')
const harness = resolve(process.env.DSH_SOURCE_ROOT)
const require = createRequire(resolve(harness, 'apps/web/package.json'))
const { chromium } = require('playwright')
await mkdir(resolve(root, '.runtime'), { recursive: true })
const smokeHome = await mkdtemp(resolve(root, '.runtime/host-smoke-'))
const overlay = resolve(root, '.runtime/smoke.patch.yml')
await writeFile(overlay, `- insert:\n    - id: whileplay\n      name: '${pathToFileURL(resolve(root, 'index.js')).href}'\n`)
const child = spawn(process.execPath, ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web', '--patch', overlay, '--patch', 'apps/web/tests/pin-browse-picker.overlay.yml', '--no-open', '--port', '0'], {
  cwd: harness, env: { ...process.env, DSH_HOME: smokeHome }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})
let browser
try {
  const url = await new Promise((accept, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error('Harness startup timed out')), 120000)
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Harness exited: ${code}`)) })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      output += chunk
      const match = output.match(/dsh web: (http:\/\/\S+)/)
      if (match) { clearTimeout(timeout); accept(match[1]) }
    })
  })
  const channel = process.env.WHILEPLAY_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)
  browser = await chromium.launch({ channel, headless: true })
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await page.locator('.arcade-launch').waitFor()
  // Every run has a fresh home: wait for each onboarding transition explicitly.
  await page.getByRole('button', { name: '继续', exact: true }).click()
  const onboarding = page.getByRole('dialog', { name: '开始使用', exact: true })
  await onboarding.waitFor({ state: 'visible' })
  await onboarding.getByRole('button', { name: '关闭', exact: true }).click()
  await onboarding.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: '玩一小局' }).click()
  const panel = page.getByRole('region', { name: '玩一小局', exact: true })
  await panel.waitFor()
  const canvas = panel.locator('canvas')
  assert.equal(await canvas.getAttribute('width'), '320')
  assert.equal(await canvas.getAttribute('height'), '480')
  const initialBounds = await canvas.boundingBox()
  assert.ok(initialBounds.height > initialBounds.width)
  await panel.getByRole('button', { name: '开始游戏', exact: true }).click()
  assert.equal(await canvas.evaluate(el => el === document.activeElement), true)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(180)
  await page.keyboard.up('ArrowRight')
  await panel.getByRole('button', { name: '暂停', exact: true }).click()
  const pausedImage = await canvas.evaluate(el => el.toDataURL())
  await page.waitForTimeout(120)
  assert.equal(await canvas.evaluate(el => el.toDataURL()), pausedImage)
  const search = panel.getByRole('searchbox', { name: '搜索游戏' })
  await search.fill('贪吃')
  assert.equal(await panel.locator('.arcade-game-list button').count(), 1)
  await search.fill('no-such-game')
  assert.match(await panel.locator('.arcade-empty').textContent(), /没有找到/)
  await search.fill('')
  await panel.getByRole('button', { name: '飞行', exact: true }).click()
  assert.equal(await panel.locator('.arcade-game-list button').count(), 1)
  await panel.getByRole('button', { name: '全部', exact: true }).click()
  const fullBounds = await panel.boundingBox()
  await panel.getByRole('button', { name: '极简模式', exact: true }).click()
  assert.equal(await panel.locator('.arcade-library').isVisible(), false)
  assert.equal(await panel.locator('.arcade-scores').isVisible(), false)
  const compactBounds = await panel.boundingBox()
  assert.ok(compactBounds.width < fullBounds.width)
  assert.ok(Math.abs((compactBounds.width - 2) / (compactBounds.height - 2) - 2 / 3) < 0.01)
  await panel.getByRole('button', { name: '移动窗口', exact: true }).press('ArrowLeft')
  assert.ok((await panel.boundingBox()).x < compactBounds.x)
  await panel.getByRole('button', { name: '调整窗口大小：右下角', exact: true }).press('ArrowRight')
  assert.ok((await panel.boundingBox()).width > compactBounds.width)
  await panel.getByRole('button', { name: '完整模式', exact: true }).click()
  const restoredBounds = await panel.boundingBox()
  assert.equal(restoredBounds.width, fullBounds.width)
  assert.equal(restoredBounds.height, fullBounds.height)
  for (const game of ['贪吃蛇', '坦克大战']) {
    await panel.getByRole('button', { name: game, exact: true }).click()
    await panel.getByRole('button', { name: '开始游戏', exact: true }).click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    await panel.getByRole('button', { name: '暂停', exact: true }).click()
  }
  await panel.getByRole('button', { name: '收起', exact: true }).click()
  assert.equal(await panel.count(), 0)
  await page.getByRole('button', { name: '玩一小局' }).click()
  assert.equal(await panel.getByRole('button', { name: '坦克大战', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await canvas.getAttribute('width'), '416')
  assert.equal(await canvas.getAttribute('height'), '416')
  await mkdir(resolve(root, 'artifacts'), { recursive: true })
  for (const [label, slug] of [['坦克大战', 'tank'], ['贪吃蛇', 'snake']]) {
    await panel.getByRole('button', { name: label, exact: true }).click()
    await panel.getByRole('button', { name: '联动演练', exact: true }).click()
    await page.waitForTimeout(1200)
    assert.match(await panel.locator('.arcade-escort-info').textContent(), /模拟工具调用与 Step 补给/)
    await panel.getByRole('button', { name: '暂停', exact: true }).click()
    await page.screenshot({ path: resolve(root, `artifacts/whileplay-${slug}-mission.png`) })
  }
  await panel.getByRole('button', { name: '飞机大战', exact: true }).click()
  await page.screenshot({ path: resolve(root, 'artifacts/arcade.png') })
  const lightBackground = await panel.evaluate(el => getComputedStyle(el).backgroundColor)
  const lightCanvas = await canvas.evaluate(el => el.toDataURL())
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.waitForTimeout(100)
  assert.notEqual(await panel.evaluate(el => getComputedStyle(el).backgroundColor), lightBackground)
  assert.notEqual(await canvas.evaluate(el => el.toDataURL()), lightCanvas)
  await page.screenshot({ path: resolve(root, 'artifacts/arcade-dark.png') })
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
  // Stress the layout with extra DOM rows only; these are not playable games.
  const playBounds = await panel.locator('.arcade-play').boundingBox()
  const catalogStress = await panel.locator('.arcade-game-list').evaluate(el => {
    for (let i = 0; i < 30; i++) { const row = el.firstElementChild.cloneNode(true); row.dataset.stress = ''; el.append(row) }
    return { scroll: el.scrollHeight, client: el.clientHeight }
  })
  assert.ok(catalogStress.scroll > catalogStress.client)
  assert.deepEqual(await panel.locator('.arcade-play').boundingBox(), playBounds)
  await panel.locator('[data-stress]').evaluateAll(rows => rows.forEach(row => row.remove()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => {
    const bounds = document.querySelector('.arcade-panel').getBoundingClientRect()
    return bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight
  })
  const bounds = await panel.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391)
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844)
  await page.screenshot({ path: resolve(root, 'artifacts/arcade-mobile.png') })
  await panel.getByRole('button', { name: '游戏库' }).click()
  await panel.getByRole('button', { name: '贪吃蛇', exact: true }).click()
  assert.equal(await panel.locator('.arcade-library').isVisible(), false)
  assert.equal(await canvas.getAttribute('width'), '480')
  assert.deepEqual(errors, [])
  console.log('Real Harness smoke passed: three games, portrait plane, search/category filters, light/dark canvas, scroll stress, mobile library, pause/resume; no page errors.')
} finally {
  if (browser) await browser.close()
  child.kill()
}
