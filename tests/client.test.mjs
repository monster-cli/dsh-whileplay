import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const harnessRoot = process.env.DSH_SOURCE_ROOT
const anchor = harnessRoot ? resolve(harnessRoot, 'apps/web/package.json') : null
const clientSkip = !anchor ? 'Set DSH_SOURCE_ROOT to run the optional client integration test' : !existsSync(anchor) ? 'DSH_SOURCE_ROOT does not contain apps/web/package.json' : false
test('client pauses on completion and attention, preserves rounds and disposes its effects', { skip: clientSkip }, async () => {
  const require = createRequire(anchor)
  const { JSDOM } = require('jsdom')
  const React = require('react')
  const { createRoot } = require('react-dom/client')
  const { act } = React
  const dom = new JSDOM('<!doctype html><div id="root"></div><textarea></textarea>', { url: 'http://localhost', runScripts: 'outside-only', pretendToBeVisual: true })
  const win = dom.window
  win.localStorage.setItem('dsh-waiting-arcade.best.v1', JSON.stringify({ planeShooter: 20, snake: 30, tankClassic: 100 }))
  const frames = new Map()
  let sequence = 0, component, labels, definition
  win.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (target, name) => target[name] ?? (() => {}), set: (target, name, value) => { target[name] = value; return true } })
  const globals = { window: win, document: win.document, localStorage: win.localStorage, requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence }, cancelAnimationFrame: id => frames.delete(id), IS_REACT_ACT_ENVIRONMENT: true }
  win.requestAnimationFrame = globals.requestAnimationFrame
  win.cancelAnimationFrame = globals.cancelAnimationFrame
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  let snapshot = new Map([['session-a', { running: true }]])
  let projection
  const subscribers = new Set(), disposers = []
  const useSessionStatus = selector => selector(React.useSyncExternalStore(fn => { subscribers.add(fn); return () => subscribers.delete(fn) }, () => snapshot))
  const useProjection = key => { assert.equal(key, 'whileplayMission'); return React.useSyncExternalStore(fn => { subscribers.add(fn); return () => subscribers.delete(fn) }, () => projection) }
  const project = async value => act(async () => { projection = value; subscribers.forEach(fn => fn()) })
  const update = async value => act(async () => { snapshot = new Map([['session-a', value]]); subscribers.forEach(fn => fn()) })
  win.__ModuleLoader__ = { load: row => { definition = row.factory(name => { assert.equal(name, 'react'); return React }) } }
  win.eval(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))
  const ctx = {
    effect: fn => { disposers.push(fn()) },
    locale: { register: (name, dictionaries) => { labels = dictionaries.zh; return () => { labels = undefined } } },
    slots: {
      inject: (name, register) => { assert.equal(name, 'conversation.input.left'); disposers.push(register()) },
      register: (options, view) => { component = view; return () => { component = undefined } },
    },
  }
  const root = createRoot(win.document.getElementById('root'))
  const button = text => [...win.document.querySelectorAll('button')].find(el => el.textContent === text || el.getAttribute('aria-label') === text)
  const click = async el => { assert.ok(el, 'button exists'); await act(async () => el.click()) }
  try {
    definition.apply(ctx)
    assert.equal(win.document.querySelectorAll('style[data-plugin]').length, 1)
    await act(async () => root.render(React.createElement(component, { sessionId: 'session-a', useSessionStatus, useProjection, t: key => labels[key] })))
    assert.equal(JSON.parse(win.localStorage.getItem('dsh-whileplay.best.v1')).snake, 30)
    await click(win.document.querySelector('.arcade-launch'))
    await click(button('开始游戏'))
    assert.equal(frames.size, 1)
    assert.equal(win.document.activeElement.tagName, 'CANVAS')
    const originalCanvas = win.document.querySelector('canvas')
    const panel = win.document.querySelector('.arcade-panel')
    const fullWidth = panel.style.width, fullHeight = panel.style.height
    await click(button('极简模式'))
    assert.equal(panel.dataset.minimal, 'true')
    assert.equal(win.document.querySelector('canvas'), originalCanvas)
    assert.equal(frames.size, 1)
    const compactWidth = Number.parseFloat(panel.style.width)
    await act(async () => win.document.querySelector('.arcade-resize-se').dispatchEvent(new win.KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true })))
    assert.ok(Number.parseFloat(panel.style.width) > compactWidth)
    assert.equal(frames.size, 0)
    await click(button('完整模式'))
    assert.equal(panel.dataset.minimal, 'false')
    assert.equal(panel.style.width, fullWidth); assert.equal(panel.style.height, fullHeight)
    assert.equal(win.document.querySelector('canvas'), originalCanvas)
    await click(button('继续'))
    await update({ running: false })
    assert.equal(frames.size, 0)
    assert.match(win.document.querySelector('[role=status]').textContent, /AI 已结束运行/)
    await click(button('继续'))
    assert.equal(frames.size, 1)
    await update({ running: true, pendingInteraction: { key: 'approve' } })
    assert.equal(frames.size, 0)
    assert.equal(button('继续').disabled, true)
    await update({ running: true })
    await click(button('继续'))
    await act(async () => win.dispatchEvent(new win.Event('blur')))
    assert.equal(frames.size, 0)
    await project({ turn: 100, seq: 101, running: true, total: 1, completed: 0, failed: 0, calls: [{ id: 'tool-a', name: 'web_search', phase: 'running', seq: 101 }] })
    await project({ turn: 100, seq: 102, running: false, total: 1, completed: 1, failed: 0, calls: [{ id: 'tool-a', name: 'web_search', phase: 'done', seq: 102 }] })
    await update({ running: false })
    assert.match(win.document.querySelector('.arcade-escort-summary').textContent, /1 \/ 1 \/ 0 \/ 0/)
    await click(button('联动演练'))
    assert.match(win.document.querySelector('.arcade-escort-info').textContent, /模拟工具调用/)
    assert.equal(frames.size, 1)
    const originalRandom = win.Math.random
    win.Math.random = () => 0
    await act(async () => {
      win.document.querySelector('canvas').dispatchEvent(new win.KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))
      for (let n = 0; n < 620; n++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(n * 50)) }
    })
    win.Math.random = originalRandom
    assert.match(win.document.querySelector('.arcade-escort-summary').textContent, /5 \/ 5 \/ 1/)
    assert.equal(frames.size, 0)
    await click(button('联动演练'))
    await update({ running: true })
    await project({ turn: 103, seq: 104, running: true, total: 1, completed: 0, failed: 0, calls: [{ id: 'tool-b', name: 'read_file', phase: 'running', seq: 104 }] })
    assert.match(win.document.querySelector('.arcade-escort-info').textContent, /游戏不影响任务/)
    await update({ running: false })
    for (const [label, width] of [['坦克大战', '416'], ['贪吃蛇', '480']]) {
      await click(button(label)); await click(button('联动演练'))
      assert.equal(win.document.querySelector('canvas').getAttribute('width'), width)
      assert.match(win.document.querySelector('.arcade-escort-info').textContent, /模拟工具调用与 Step 补给/)
      await act(async () => {
        for (let n = 0; n < 22; n++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(n * 50)) }
      })
      assert.equal(frames.size, 1, `${label} rehearsal keeps its own game running`)
    }
    await click(win.document.querySelector('.arcade-actions button:last-child'))
    await click(button('贪吃蛇'))
    await click(button('开始游戏'))
    for (let n = 0; n < 8; n++) await act(async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(n * 50)) })
    assert.equal(frames.size, 1)
    await click(win.document.querySelector('[aria-label="收起"]'))
    assert.equal(frames.size, 0)
    await click(win.document.querySelector('.arcade-launch'))
    assert.equal(win.document.querySelector('.arcade-game-list [aria-pressed=true]').getAttribute('aria-label'), '贪吃蛇')
    assert.ok(button('继续'))
    const arrow = new win.KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true, cancelable: true })
    win.document.querySelector('textarea').dispatchEvent(arrow)
    assert.equal(arrow.defaultPrevented, false)
    await act(async () => root.unmount())
    disposers.reverse().forEach(dispose => dispose())
    assert.equal(frames.size, 0)
    assert.equal(subscribers.size, 0)
    assert.equal(win.document.querySelectorAll('style[data-plugin]').length, 0)
  } finally {
    dom.window.close()
    for (const [key, descriptor] of Object.entries(before)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
