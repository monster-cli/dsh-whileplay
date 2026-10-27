import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, stepGame, sessionPause, GAME_CATALOG } from '../src/engine.js'
const input = () => ({ keys: new Set(), direction: null, pointer: false })
const advance = (g, controls, ticks = 4) => { for (let n = 0; n < ticks; n++) stepGame(g, controls, 0.05, () => 0.5) }

test('snake eats, grows, rejects reverse input and stops at a wall', () => {
  const g = createGame('snake', () => 0.5), controls = input()
  g.food = { x: 9, y: 8 }; controls.direction = 'ArrowLeft'
  advance(g, controls, 3)
  assert.equal(g.score, 10); assert.equal(g.body.length, 4)
  assert.deepEqual(g.body[0], { x: 9, y: 8 })
  assert.ok(!g.body.some(p => p.x === g.food.x && p.y === g.food.y))
  advance(g, controls, 100)
  assert.equal(g.over, true)
})

test('snake may move into its vacating tail cell', () => {
  const g = createGame('snake'), controls = input()
  g.body = [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }]
  g.direction = { x: 0, y: -1 }; g.food = { x: 20, y: 10 }; controls.direction = 'ArrowLeft'
  advance(g, controls, 3)
  assert.equal(g.over, false); assert.deepEqual(g.body[0], { x: 2, y: 3 })
})

test('air battle uses a portrait field, moves horizontally and fires without a fire key', () => {
  const g = createGame('plane'), controls = input()
  assert.ok(g.height > g.width)
  controls.keys.add('ArrowRight'); advance(g, controls)
  assert.ok(g.player.x > 148); assert.equal(g.player.y, 398)
  assert.equal(g.bullets.length, 2)
  assert.ok(g.bullets[0].y < g.bullets[1].y)
  assert.equal(g.score, 0)
})

test('air battle follows pointer steering, stays in bounds and ends on an enemy collision', () => {
  const g = createGame('plane')
  const controls = input(); controls.pointer = true; controls.targetX = -500; controls.targetY = -500
  stepGame(g, controls, 0.01); assert.equal(g.player.x, 0); assert.equal(g.player.y, 0)
  controls.targetX = 500; controls.targetY = 800
  stepGame(g, controls, 0.01); assert.equal(g.player.x, g.width - g.player.w); assert.equal(g.player.y, g.height - g.player.h)
  controls.pointer = false
  g.enemies = [{ x: g.player.x, y: g.player.y + 15, w: 28, h: 30, speed: 100 }]
  stepGame(g, controls, 0.01)
  assert.equal(g.over, true)
  const time = g.time; advance(g, input()); assert.equal(g.time, time)
})

test('air battle moves vertically, keeps diagonal speed consistent and fires from its new position', () => {
  const g = createGame('plane'), controls = input()
  controls.keys.add('ArrowUp')
  stepGame(g, controls, 0.05)
  assert.equal(g.player.y, 387)
  assert.ok(g.bullets[0].y < g.player.y)
  controls.keys.clear(); controls.keys.add('ArrowDown')
  stepGame(g, controls, 0.05); assert.equal(g.player.y, 398)
  controls.keys.add('ArrowRight')
  const before = { ...g.player }
  stepGame(g, controls, 0.05)
  assert.ok(Math.abs(Math.hypot(g.player.x - before.x, g.player.y - before.y) - 11) < 0.00001)
  controls.keys.clear(); controls.keys.add('ArrowUp'); g.player.y = 1
  stepGame(g, controls, 0.05); assert.equal(g.player.y, 0)
  controls.keys.clear(); controls.keys.add('ArrowDown'); g.player.y = g.height - g.player.h - 1
  stepGame(g, controls, 0.05); assert.equal(g.player.y, g.height - g.player.h)
  controls.keys.add('ArrowUp')
  stepGame(g, controls, 0.05); assert.equal(g.player.y, g.height - g.player.h)
})

test('a bullet destroys one enemy and awards ten points only once', () => {
  const g = createGame('plane')
  g.cooldown = 1; g.spawn = 1
  g.bullets = [{ x: 104, y: 110, w: 4, h: 12 }]
  g.enemies = [{ x: 100, y: 100, w: 28, h: 30, speed: 0 }, { x: 100, y: 100, w: 28, h: 30, speed: 0 }]
  stepGame(g, input(), 0.01)
  assert.equal(g.score, 10); assert.equal(g.enemies.length, 1); assert.equal(g.bullets.length, 0)
  assert.equal(g.bursts.length, 1)
  stepGame(g, input(), 0.01); assert.equal(g.score, 10)
})

test('enemy waves descend and offscreen enemies and bullets are removed without scoring', () => {
  const g = createGame('plane'); g.spawn = 0
  stepGame(g, input(), 0.05, () => 0.5)
  assert.equal(g.enemies.length, 1)
  const y = g.enemies[0].y
  stepGame(g, input(), 0.05); assert.ok(g.enemies[0].y > y)
  g.enemies[0].y = 520
  g.bullets = [{ x: 0, y: -20, w: 4, h: 12 }]
  g.cooldown = 1
  stepGame(g, input(), 0.05)
  assert.equal(g.enemies.length, 0); assert.equal(g.bullets.length, 0)
  assert.equal(g.score, 0); assert.equal(g.over, false)
  g.bursts = [{ x: 100, y: 100, life: 0.01 }]
  stepGame(g, input(), 0.05); assert.equal(g.bursts.length, 0)
})

test('catalog supplies independent game geometry and categories', () => {
  assert.equal(new Set(GAME_CATALOG.map(item => item.id)).size, GAME_CATALOG.length)
  for (const item of GAME_CATALOG) {
    const game = createGame(item.id)
    assert.equal(game.width, item.width); assert.equal(game.height, item.height)
    assert.ok(item.category)
  }
})

test('large frame gaps are bounded to prevent simulation jumps', () => {
  const g = createGame('plane'), controls = input(); controls.keys.add('ArrowRight')
  stepGame(g, controls, 200)
  assert.equal(g.player.x, 159)
})

test('completion requires an observed running to idle transition', () => {
  assert.equal(sessionPause(undefined, { running: false }), null)
  assert.equal(sessionPause(true, { running: false }), 'ready')
  assert.equal(sessionPause(true, undefined), 'unavailable')
  assert.equal(sessionPause(true, { running: true, pendingInteraction: { key: 'approval' } }), 'attention')
  assert.equal(sessionPause(false, { running: true }), null)
})
