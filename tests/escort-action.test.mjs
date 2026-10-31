import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEscortAction, stepEscortAction, actionSupport, actionTaskEvents, drawEscortAction, restoreEscortAction } from '../src/escort-action.js'
import { escortRouteLandmarks, escortRouteStage } from '../src/escort-terrain.js'
const controls = () => ({ keys: new Set() })
test('escort has continuous movement, diagonal normalization, automatic shooting and pointer control', () => {
  const g = createEscortAction(), c = controls(); g.phase = 'playing'; c.keys.add('KeyD'); c.keys.add('KeyW')
  stepEscortAction(g, c, .05, () => .5)
  assert.ok(Math.abs(Math.hypot(g.player.x - 240, g.player.y - 625) - 11.75) < .001)
  assert.ok(g.bullets.length); assert.equal(g.convoy.x, 240); assert.ok(g.convoy.y < 560)
  c.pointer = true; c.x = -20; c.y = 800; stepEscortAction(g, c, .05); assert.equal(g.player.x, 18); assert.equal(g.player.y, 640)
})
test('real-time task events add pickups, wingmen and pause for interaction once', () => {
  const g = createEscortAction(); g.phase = 'playing'; g.time = 14.99
  stepEscortAction(g, controls(), .05); assert.equal(g.wings, 1); assert.equal(g.agents[0], '已归航')
  const count = g.drops.length; actionTaskEvents(g); assert.equal(g.drops.length, count)
  g.time = 30.99; stepEscortAction(g, controls(), .05); assert.equal(g.phase, 'attention')
  const frozen = JSON.stringify(g); stepEscortAction(g, controls(), .05); assert.equal(JSON.stringify(g), frozen)
})
test('pickups and manual Q/E support change the actual battlefield', () => {
  const g = createEscortAction(); g.phase = 'playing'; g.convoy.hp = 50
  g.drops.push({ ...g.player, type: 'boost', ttl: 5 }); stepEscortAction(g, controls(), .01)
  assert.equal(g.boost, 10); g.cooldown = 0; g.bullets = []; stepEscortAction(g, controls(), .01); assert.equal(g.bullets.length, 3)
  assert.equal(actionSupport(g, 'repair'), true); assert.equal(g.convoy.hp, 78); assert.equal(g.repair, 0); assert.equal(actionSupport(g, 'repair'), false)
  g.enemies.push({ x: 100, y: 100, hp: 2 }); g.shots.push({ x: 300, y: 300 })
  assert.equal(actionSupport(g, 'strike'), true); assert.equal(g.enemies.length, 0); assert.equal(g.shots.length, 0); assert.equal(g.kills, 1)
  g.phase = 'paused'; assert.equal(actionSupport(g, 'repair'), false)
})
test('a full simulated escort can reach delivery using movement and support, not card choices', () => {
  const g = createEscortAction(), c = controls(); g.phase = 'playing'
  for (let n = 0; n < 1300 && !['complete', 'over'].includes(g.phase); n++) {
    if (g.phase === 'attention') { g.decision = 'reject'; g.phase = 'playing' }
    const drop = g.drops.find(d => d.type === 'salvage')
    c.pointer = true; c.x = drop ? drop.x : g.convoy.x + Math.sin(g.time * 1.8) * 100; c.y = drop ? drop.y + 10 : g.convoy.y + 65 + Math.cos(g.time * 1.4) * 40
    if (g.shots.some(b => Math.hypot(b.x - g.player.x, b.y - g.player.y) < 60)) actionSupport(g, 'dash')
    if (g.convoy.hp < 75) actionSupport(g, 'repair')
    if (g.enemies.length >= 6) actionSupport(g, 'strike')
    stepEscortAction(g, c, .05, () => .5)
  }
  assert.equal(g.phase, 'complete'); assert.equal(g.wings, 2); assert.equal(g.cargo.length, 2)
  assert.ok(g.todos.every(state => state === '已完成')); assert.ok(g.kills > 0); assert.equal(g.level, 3); assert.equal(g.bossKills, 2)
})
test('damage can lose the escort; saves restore paused and drawing stays read-only', () => {
  const g = createEscortAction(); g.phase = 'playing'; g.player.grace = 0; g.player.hp = 1
  g.shots.push({ ...g.player, vx: 0, vy: 0, ttl: 1 }); stepEscortAction(g, controls(), .01); assert.equal(g.phase, 'over')
  const saved = createEscortAction(); saved.phase = 'playing'; assert.equal(restoreEscortAction(JSON.stringify(saved)).phase, 'paused')
  assert.equal(restoreEscortAction('{bad'), null); assert.equal(restoreEscortAction('null'), null)
  const before = JSON.stringify(saved), ctx = new Proxy({}, { get: (o, key) => o[key] ?? (key === 'createLinearGradient' ? (() => ({ addColorStop() {} })) : (() => {})), set: (o, key, value) => (o[key] = value, true) })
  drawEscortAction(ctx, saved, { background: '#fff', grid: '#eee', accent: '#00f', ink: '#000', obstacle: '#aaa', food: '#f80', enemy: '#f00' })
  assert.equal(JSON.stringify(saved), before)
})

test('formation waves and flagship attacks have distinct telegraphed patterns', () => {
  const g = createEscortAction(); g.phase = 'playing'; g.spawn = 0
  stepEscortAction(g, controls(), .01, () => .5)
  assert.equal(g.enemies.length, 2); assert.equal(g.wave, 1)
  g.time = 18; g.enemies = []; stepEscortAction(g, controls(), .01, () => .5)
  const boss = g.enemies.find(e => e.boss); assert.equal(boss.hp, 48)
  boss.y = 180; boss.fire = .6; stepEscortAction(g, controls(), .01)
  const locked = { ...boss.aim }; assert.equal(locked.x, g.player.x)
  g.player.x += 80; boss.fire = .001; g.shots = []; stepEscortAction(g, controls(), .01)
  assert.equal(g.shots.length, 5); assert.equal(boss.aim, null)
  assert.ok(new Set(g.shots.map(b => b.vx)).size === 5)
  const again = g.enemies.filter(e => e.boss).length; actionTaskEvents(g); stepEscortAction(g, controls(), .01)
  assert.equal(g.enemies.filter(e => e.boss).length, again)
})
test('dash has invulnerability, speed boost and a cooldown; airstrike damages but cannot erase a fresh flagship', () => {
  const g = createEscortAction(); g.phase = 'playing'; g.player.grace = 0
  assert.equal(actionSupport(g, 'dash'), true); assert.equal(actionSupport(g, 'dash'), false)
  const x = g.player.x; stepEscortAction(g, { keys: new Set(['KeyD']) }, .05)
  assert.ok(g.player.x - x > 35); assert.ok(g.player.grace > 0)
  g.enemies = [{ x: 400, y: 80, hp: 48, maxHP: 48, boss: true }]; g.shots = [{ x: 1, y: 1 }]
  actionSupport(g, 'strike'); assert.equal(g.enemies[0].hp, 24); assert.equal(g.shots.length, 0)
  g.phase = 'paused'; assert.equal(actionSupport(g, 'dash'), false)
})
test('kills build a capped combo multiplier; energy pickups permanently upgrade firepower', () => {
  const g = createEscortAction(); g.phase = 'playing'; g.combo = 4; g.comboTTL = 2
  g.enemies = [{ x: 400, y: 50, hp: 1, fire: 3, speed: 0 }]
  g.bullets = [{ x: 400, y: 50, vx: 0, vy: 0, ttl: 1 }]
  stepEscortAction(g, controls(), .01); assert.equal(g.combo, 5); assert.equal(g.score, 60)
  assert.ok(g.particles.length > 0); assert.equal(g.drops[0].type, 'salvage')
  g.salvage = 4; g.drops = [{ x: g.player.x, y: g.player.y, ttl: 5, type: 'salvage' }]
  stepEscortAction(g, controls(), .01); assert.equal(g.level, 2); assert.equal(g.salvage, 5)
  g.bullets = []; g.cooldown = 0; stepEscortAction(g, controls(), .01); assert.equal(g.bullets.length, 2)
  g.comboTTL = .001; stepEscortAction(g, controls(), .01); assert.equal(g.combo, 0); assert.equal(g.bestCombo, 5)
})
test('old saves migrate combat fields and malformed new fields are rejected', () => {
  const old = createEscortAction(); old.version = 2; old.phase = 'playing'; old.player.x = 400; old.player.y = 330; delete old.level; delete old.dashCooldown
  const migrated = restoreEscortAction(JSON.stringify(old)); assert.equal(migrated.level, 1); assert.equal(migrated.version, 3); assert.equal(migrated.player.x, 240); assert.equal(migrated.player.y, 495)
  old.level = 99; assert.equal(restoreEscortAction(JSON.stringify(old)), null)
  old.level = 1; old.enemies.push({ x: 1, y: 2, hp: 1, fire: 1, speed: 1, aim: { x: 'bad', y: 2 } })
  assert.equal(restoreEscortAction(JSON.stringify(old)), null)
})

test('physical landmarks remain continuous across Todo changes and survive pause and restore without extra state', () => {
  const g = createEscortAction()
  for (const [time, stage] of [[15, 1], [36, 2], [49, 3], [62, 3]]) {
    g.time = time - .01
    const before = escortRouteLandmarks(g)
    g.time = time; actionTaskEvents(g)
    const after = escortRouteLandmarks(g)
    assert.equal(escortRouteStage(g), stage)
    for (let i = 0; i < after.length; i++) assert.ok(Math.abs(after[i].y - before[i].y - .24) < .0001)
    const checkpoint = JSON.stringify(g)
    assert.deepEqual(escortRouteLandmarks(restoreEscortAction(checkpoint)), after)
    const ctx = new Proxy({}, { get: (o, key) => o[key] ?? (key === 'createLinearGradient' ? (() => ({ addColorStop() {} })) : (() => {})), set: (o, key, value) => (o[key] = value, true) })
    drawEscortAction(ctx, g, {})
    assert.equal(JSON.stringify(g), checkpoint)
  }
})
