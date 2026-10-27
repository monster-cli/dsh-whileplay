import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, stepGame, drawGame } from '../src/engine.js'
import { syncEscort } from '../src/mission-game.js'
import { stepGroundMission } from '../src/ground-mission.js'
import { damageMissionTank, missionTankCells } from '../src/tank.js'
const snapshot = (extra = {}) => ({ turn: 0, seq: 1, running: true, total: 1, completed: 0, failed: 0, steps: 0, calls: [{ id: 'a', name: 'read_file', phase: 'running', seq: 1 }], ...extra })
const input = () => ({ keys: new Set(), direction: null })
const advance = (g, n, controls = input()) => { for (let i = 0; i < n; i++) stepGame(g, controls, .05, () => .1) }
const pickupTank = (g, type) => { g.escort.drops.push({ ...g.player, type, ttl: 12 }); stepGroundMission(g, 0) }
const prizeSnake = (g, type, extra = {}) => { g.escort.drops.push({ x: 182, y: 162, cellX: 9, cellY: 8, w: 16, h: 16, type, ttl: 12, ...extra }) }

test('mission tanks wait for a free entrance, survive results and require three hits', () => {
  const g = createGame('tank'); syncEscort(g, snapshot(), true)
  stepGroundMission(g, 0); assert.equal(g.escort.queue.length, 1, 'occupied entrances block arrivals')
  g.enemies = []; stepGroundMission(g, 0)
  const elite = g.enemies[0]; assert.equal(elite.hp, 3)
  syncEscort(g, snapshot({ seq: 2, completed: 1, calls: [{ id: 'a', name: 'read_file', phase: 'done', seq: 2 }] }))
  advance(g, 1); assert.ok(elite.y > 3); assert.equal(elite.destroyed, undefined)
  damageMissionTank(g, elite); damageMissionTank(g, elite)
  assert.equal(g.score, 0); assert.equal(elite.hp, 1)
  damageMissionTank(g, elite); damageMissionTank(g, elite)
  assert.equal(g.score, 200); assert.equal(g.escort.kills, 1)
})

test('tank Step supplies use reachable open lanes, never bricks, steel or the base', () => {
  const g = createGame('tank'); syncEscort(g, snapshot({ total: 0, calls: [] }), true)
  const cells = missionTankCells(g); assert.ok(cells.length > 0)
  syncEscort(g, snapshot({ seq: 2, total: 0, calls: [], steps: 1 }))
  stepGroundMission(g, 0, () => .1)
  const drop = g.escort.drops[0]; assert.equal(drop.type, 'rapid')
  assert.ok(cells.some(cell => cell.x === drop.x && cell.y === drop.y))
  const overlaps = rect => drop.x < rect.x + rect.w && drop.x + drop.w > rect.x && drop.y < rect.y + rect.h && drop.y + drop.h > rect.y
  assert.ok(!g.walls.some(overlaps)); assert.equal(overlaps(g.base), false)
  syncEscort(g, snapshot({ seq: 3, total: 0, calls: [], steps: 1 })); assert.equal(g.escort.pendingSupply, 0)
})

test('tank rapid fire refreshes, shield protects one hit and bomb preserves walls and base', () => {
  const g = createGame('tank'); pickupTank(g, 'rapid'); assert.equal(g.escort.dual, 8)
  advance(g, 1, { keys: new Set(['Space']) }); assert.equal(g.player.cooldown, .13)
  pickupTank(g, 'rapid'); assert.equal(g.escort.dual, 8)
  pickupTank(g, 'shield'); g.invulnerable = 0
  g.bullets = [{ x: g.player.x + 13, y: g.player.y + 13, w: 4, h: 4, dx: 0, dy: 0, team: 'enemy' }]
  advance(g, 1); assert.equal(g.lives, 3); assert.equal(g.escort.shield, 0)
  g.enemies = []; syncEscort(g, snapshot(), true); stepGroundMission(g, 0)
  const walls = JSON.stringify(g.walls), before = g.score
  pickupTank(g, 'bomb')
  assert.equal(g.enemies.length, 0); assert.equal(g.score, before + 220)
  assert.equal(JSON.stringify(g.walls), walls); assert.equal(g.base.destroyed, false)
})

test('snake tool fruit occupies a free cell, ignores tool completion and expires without scoring', () => {
  const g = createGame('snake'); syncEscort(g, snapshot(), true); stepGroundMission(g, 0, () => .1)
  const fruit = g.escort.drops[0]; assert.equal(fruit.type, 'bounty')
  assert.ok(!g.body.some(part => part.x === fruit.cellX && part.y === fruit.cellY))
  assert.ok(g.food.x !== fruit.cellX || g.food.y !== fruit.cellY)
  syncEscort(g, snapshot({ seq: 2, completed: 1, calls: [{ id: 'a', name: 'read_file', phase: 'done', seq: 2 }] }))
  stepGroundMission(g, 1); assert.equal(g.escort.drops[0], fruit)
  stepGroundMission(g, 12); assert.equal(g.escort.drops.length, 0); assert.equal(g.score, 0)
  syncEscort(g, snapshot({ seq: 3, completed: 1, calls: [{ id: 'a', name: 'read_file', phase: 'done', seq: 2 }] }))
  stepGroundMission(g, 0); assert.equal(g.escort.drops.length, 0)
})

test('snake tool fruit grows the snake and is counted once; double score refreshes', () => {
  const g = createGame('snake'); g.food = { x: 20, y: 10 }
  const call = { name: 'test' }; prizeSnake(g, 'bounty', { call, turn: null })
  advance(g, 3); assert.equal(g.score, 30); assert.equal(g.body.length, 4); assert.equal(g.escort.kills, 1)
  assert.equal(call.defeated, true); assert.equal(g.escort.drops[0].hit, true)
  const d = createGame('snake'); d.food = { x: 20, y: 10 }; prizeSnake(d, 'double')
  advance(d, 3); assert.equal(d.score, 20); assert.equal(d.escort.multiplier, 8)
  d.food = { x: 10, y: 8 }; advance(d, 3); assert.equal(d.score, 40)
  prizeSnake(d, 'double'); const p = d.escort.drops.at(-1); p.cellX = 11
  advance(d, 3); assert.equal(d.escort.multiplier, 8)
})

test('snake slow mode reduces movement rate; shield turns away from a collision once', () => {
  const g = createGame('snake'); g.escort.slow = 8; g.food = { x: 20, y: 10 }
  advance(g, 4); assert.deepEqual(g.body[0], { x: 8, y: 8 })
  advance(g, 1); assert.deepEqual(g.body[0], { x: 9, y: 8 })
  const s = createGame('snake'); s.body = [{ x: 23, y: 8 }, { x: 22, y: 8 }, { x: 21, y: 8 }]; s.food = { x: 0, y: 0 }; s.escort.shield = 1
  advance(s, 3); assert.equal(s.over, false); assert.equal(s.escort.shield, 0)
  advance(s, 3); assert.deepEqual(s.body[0], { x: 23, y: 9 })
})

test('both ground games drain bounded Step queues, reset history on restart and render without mutation', () => {
  for (const kind of ['tank', 'snake']) {
    const g = createGame(kind); syncEscort(g, snapshot({ total: 0, calls: [], steps: 5 }), true)
    assert.equal(g.escort.pendingSupply, 0)
    syncEscort(g, snapshot({ seq: 2, total: 0, calls: [], steps: 7 }))
    stepGroundMission(g, .05, () => .1); assert.equal(g.escort.pendingSupply, 1)
    const before = JSON.stringify(g)
    const ctx = new Proxy({}, { get: (obj, key) => obj[key] ?? (() => {}), set: (obj, key, value) => (obj[key] = value, true) })
    drawGame(ctx, g); assert.equal(JSON.stringify(g), before)
  }
})

test('bonus fruit cannot prematurely end a nearly full snake board by blocking ordinary food', () => {
  const g = createGame('snake'); g.body = [{ x: 0, y: 1 }]
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
    if (y === 1 && x <= 3) continue
    g.body.push({ x, y })
  }
  g.food = { x: 1, y: 1 }
  g.escort.drops = [2, 3].map(x => ({ cellX: x, cellY: 1, x: x * 20 + 2, y: 22, w: 16, h: 16, type: 'shield', ttl: 12 }))
  advance(g, 3)
  assert.equal(g.over, false); assert.equal(g.body.length, 382)
  assert.ok(g.food); assert.ok(!g.escort.drops.some(drop => !drop.hit && drop.cellX === g.food.x && drop.cellY === g.food.y))
})
