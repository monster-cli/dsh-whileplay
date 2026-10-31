import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialMission, foldMission } from '../mission.js'
import { createGame, stepGame } from '../src/engine.js'
import { syncEscort, stepEscort, demoMission } from '../src/mission-game.js'
const start = () => foldMission(initialMission(), { type: 'turn/start', seq: 0, data: { turn: 1 } })
const endStep = (state, step, seq = step) => foldMission(state, { type: 'step/end', seq, data: { turn: 1, step } })
const controls = () => ({ keys: new Set() })
const pickup = (g, type) => { g.escort.drops.push({ ...g.player, w: 24, h: 24, type }); stepEscort(g, 0) }

test('step/end is counted once, ignores repeated/older closers and resets per turn', () => {
  let s = start(); s = endStep(s, 1)
  assert.equal(s.steps, 1); assert.equal(endStep(s, 1, 3), s); assert.equal(endStep(s, 0, 4), s)
  s = endStep(s, 2, 5); assert.equal(s.steps, 2)
  s = foldMission(s, { type: 'turn/start', seq: 6, data: { turn: 2 } })
  assert.equal(endStep(s, 1, 7).steps, 1)
})

test('history does not drop supplies; new steps survive skipped snapshots without duplicate rewards', () => {
  const g = createGame('plane'); let s = endStep(start(), 1)
  syncEscort(g, s, true); assert.equal(g.escort.pendingSupply, 0)
  s = endStep(endStep(s, 2), 3); syncEscort(g, s); syncEscort(g, s)
  assert.equal(g.escort.pendingSupply, 2)
  const supplies = () => g.escort.drops.filter(drop => drop.type !== 'upgrade')
  stepEscort(g, .05, () => .1); assert.equal(supplies().length, 1); assert.equal(g.escort.pendingSupply, 1)
  for (let n = 0; n < 20; n++) stepEscort(g, .05, () => .1)
  assert.equal(supplies().length, 1, 'supplies are spaced out')
  for (let n = 0; n < 20; n++) stepEscort(g, .05, () => .1)
  assert.equal(supplies().length, 2); assert.equal(g.escort.pendingSupply, 0)
  syncEscort(g, { ...s, seq: 10 }); assert.equal(g.escort.pendingSupply, 0)
})

test('random supply weights choose twin shot, shield and bomb; field crowding keeps pending rewards', () => {
  for (const [roll, type] of [[.1, 'dual'], [.7, 'shield'], [.99, 'bomb']]) {
    const g = createGame('plane'); g.escort.pendingSupply = 1
    stepEscort(g, .05, () => roll); assert.equal(g.escort.drops[0].type, type)
  }
  const g = createGame('plane'); g.escort.pendingSupply = 1
  g.escort.drops = Array.from({ length: 6 }, (_, i) => ({ x: i * 30, y: 50, w: 12, h: 12 }))
  stepEscort(g, .05); assert.equal(g.escort.pendingSupply, 1); assert.equal(g.escort.drops.length, 6)
})

test('twin shot fires two bullets, refreshes to eight seconds and expires with simulation time', () => {
  const g = createGame('plane'); pickup(g, 'dual')
  assert.equal(g.escort.dual, 8)
  stepGame(g, controls(), .05, () => 0)
  assert.equal(g.bullets.length, 2); assert.notEqual(g.bullets[0].x, g.bullets[1].x)
  stepEscort(g, 2); pickup(g, 'dual'); assert.equal(g.escort.dual, 8, 'refreshes instead of stacking')
  stepEscort(g, 8); g.bullets = []; g.cooldown = 0
  stepGame(g, controls(), .05, () => 0); assert.equal(g.bullets.length, 1)
})

test('shield does not stack and absorbs one hit; bombs clear shots and award each kill once', () => {
  const g = createGame('plane'); pickup(g, 'shield'); pickup(g, 'shield')
  assert.equal(g.escort.shield, 1)
  g.escort.shots.push({ ...g.player, vx: 0 }); stepEscort(g, 0)
  assert.equal(g.over, false); assert.equal(g.escort.shield, 0)
  g.escort.invincible = 0; g.escort.shots.push({ ...g.player, vx: 0 }); stepEscort(g, 0)
  assert.equal(g.over, true)
  const b = createGame('plane'); syncEscort(b, demoMission(0), true); stepEscort(b, 0)
  const boss = b.escort.bosses[0]; boss.hp = 6; boss.y = 80
  b.enemies.push({ ...b.player, speed: 0 }); b.escort.shots.push({ x: 0, y: 0, w: 6, h: 9, vx: 0 })
  pickup(b, 'bomb')
  assert.equal(b.escort.shots.length, 0); assert.equal(b.escort.bosses.length, 0)
  assert.equal(b.score, 130); assert.equal(b.escort.drops.length, 1)
  stepGame(b, controls(), .05, () => 0)
  assert.equal(b.score, 130); assert.equal(b.over, false, 'bombed enemies cannot collide or award points twice')
})

test('demo uses real step counter adapter and guarantees all three supply types', () => {
  const g = createGame('plane'); syncEscort(g, demoMission(0), true); g.escort.demo = true
  const types = []
  for (const time of [1, 4, 7]) {
    syncEscort(g, demoMission(time)); stepEscort(g, 2, () => .1)
    types.push(g.escort.drops.at(-1).type)
  }
  assert.deepEqual(types, ['dual', 'shield', 'bomb']); assert.equal(g.escort.stepsSeen, 3)
})
