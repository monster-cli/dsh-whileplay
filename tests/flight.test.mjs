import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, stepGame } from '../src/engine.js'
import { toolAircraft, syncEscort, stepEscort, demoFlightMission } from '../src/mission-game.js'
import { earnFlightSteps, chooseFlightUpgrade, damageFlight } from '../src/flight.js'
import { saveFlight, loadFlight } from '../src/flight-save.js'
const input = () => ({ keys: new Set() })
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data } }
const spawn = name => {
  const g = createGame('plane')
  syncEscort(g, { turn: 1, seq: 1, running: true, total: 1, completed: 0, failed: 0, steps: 0, calls: [{ id: name, name, seq: 1, phase: 'running' }] })
  stepEscort(g, 0); g.escort.bosses[0].y = 80
  return g
}

test('archetypes have actual fan fire, cargo release, directional armor and charged cannon', () => {
  const search = spawn('web_search'); search.escort.bosses[0].fire = .5
  stepEscort(search, .1); assert.equal(search.escort.shots.length, 0)
  stepEscort(search, .5); assert.equal(search.escort.shots.length, 3)
  assert.deepEqual(search.escort.shots.map(shot => shot.vx), [-55, 0, 55])
  const read = spawn('read_file'), transport = read.escort.bosses[0]
  transport.hp = 3; read.bullets.push({ x: transport.x + 28, y: 90, w: 4, h: 12 })
  stepEscort(read, 0); assert.equal(transport.cargo, true); assert.equal(read.escort.drops[0].type, 'dual')
  const edit = spawn('apply_patch'), armor = edit.escort.bosses[0], hp = armor.hp
  edit.bullets.push({ x: armor.x + 28, y: 90, w: 4, h: 12 }); stepEscort(edit, 0); assert.equal(armor.hp, hp)
  edit.bullets.push({ x: armor.x + 5, y: 90, w: 4, h: 12 }); stepEscort(edit, 0); assert.equal(armor.hp, hp - 1)
  armor.age = 1.5; edit.bullets.push({ x: armor.x + 28, y: 90, w: 4, h: 12 }); stepEscort(edit, 0); assert.equal(armor.hp, hp - 2)
  const command = spawn('shell_exec'), heavy = command.escort.bosses[0]
  heavy.fire = .7; stepEscort(command, .1); const lock = heavy.aimX
  command.player.x = 0; stepEscort(command, .7)
  assert.equal(command.escort.shots[0].x, lock); assert.equal(command.escort.shots[0].speed, 205)
})

test('a choice awards one upgrade; missed capsules stay claimable; growth is bounded for long tasks', () => {
  const g = createGame('plane'); earnFlightSteps(g, 1); stepEscort(g, 0)
  assert.deepEqual(g.flight.choice.options, ['fire', 'guard'])
  assert.equal(chooseFlightUpgrade(g, 'move'), false)
  assert.equal(chooseFlightUpgrade(g, 'fire'), true); assert.equal(g.flight.upgrades.fire, 1)
  assert.equal(chooseFlightUpgrade(g, 'guard'), false); assert.equal(g.escort.drops.length, 0)
  earnFlightSteps(g, 2); stepEscort(g, 0)
  for (const drop of g.escort.drops) drop.ttl = .01
  stepEscort(g, .05); assert.equal(g.flight.choice.banked, true)
  const choice = g.flight.choice.options[0]; assert.equal(chooseFlightUpgrade(g, choice), true)
  earnFlightSteps(g, 1000000)
  while (g.flight.pending || g.flight.choice) {
    stepEscort(g, 0); if (g.flight.choice) chooseFlightUpgrade(g, g.flight.choice.options[0])
  }
  assert.deepEqual(g.flight.upgrades, { fire: 3, guard: 3, move: 3 }); assert.equal(g.flight.earned, 9)
})

test('fire upgrades change bullets and piercing cannot repeatedly damage the same aircraft', () => {
  const g = spawn('apply_patch'), boss = g.escort.bosses[0]
  g.flight.upgrades.fire = 3; g.cooldown = 0; stepGame(g, input(), .01)
  assert.equal(g.bullets.length, 3); assert.ok(g.bullets.every(shot => shot.pierce))
  g.bullets = [{ x: boss.x + 28, y: boss.y + 10, w: 4, h: 12, pierce: true }]
  const hp = boss.hp; stepEscort(g, 0); stepEscort(g, 0); assert.equal(boss.hp, hp - 1)
})

test('survival regenerates and rescues once; mobility increases speed and grazing gives bounded charge', () => {
  const g = createGame('plane'); g.flight.upgrades.guard = 3
  stepEscort(g, 18); assert.equal(g.escort.shield, 1)
  damageFlight(g); assert.equal(g.escort.shield, 0); assert.equal(g.over, false)
  g.escort.invincible = 0; damageFlight(g); assert.equal(g.flight.rescued, true); assert.equal(g.over, false)
  g.escort.invincible = 0; damageFlight(g); assert.equal(g.over, true)
  const agile = createGame('plane'); agile.flight.upgrades.move = 3
  const controls = input(); controls.keys.add('ArrowRight'); stepGame(agile, controls, .05)
  assert.ok(agile.player.x > 159)
  agile.escort.shots.push({ x: agile.player.x - 10, y: agile.player.y, w: 4, h: 8, vx: 0 })
  stepEscort(agile, 0); stepEscort(agile, 0); assert.equal(agile.flight.grazes, 1); assert.equal(agile.score, 5)
})

test('dense tools form bounded pairs, overflow becomes limited supplies and waves have breathing room', () => {
  const g = createGame('plane')
  const calls = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: 'web_search', seq: 1, phase: 'running' }))
  syncEscort(g, { turn: 1, seq: 1, running: true, total: 40, completed: 0, failed: 0, steps: 0, calls })
  assert.equal(g.escort.queue.length, 12); assert.equal(g.flight.salvage, 3)
  stepEscort(g, .05); assert.equal(g.escort.bosses.length, 2); assert.equal(g.flight.wave, 1)
  g.escort.bosses.forEach(boss => { boss.y = 600 }); stepEscort(g, .05)
  stepEscort(g, .05); assert.equal(g.escort.bosses.length, 0)
  stepEscort(g, 1.3); assert.equal(g.escort.bosses.length, 2); assert.equal(g.flight.wave, 2)
})

test('checkpoints preserve the field, bindings, growth and demo time; isolate sessions and reject bad state', () => {
  const store = storage(), g = spawn('web_search')
  g.time = 5; g.score = 120; g.flight.upgrades.fire = 2; g.escort.demo = true
  earnFlightSteps(g, 1); stepEscort(g, 0)
  assert.equal(saveFlight(store, 'a', g), true)
  const restored = loadFlight(store, 'a')
  assert.equal(restored.score, 120); assert.equal(restored.time, 5); assert.equal(restored.flight.ready, 1.5)
  assert.equal(restored.escort.bosses[0].call, restored.escort.calls[0]); assert.equal(restored.flight.upgrades.fire, 2)
  assert.equal(loadFlight(store, 'b'), null)
  const y = restored.escort.bosses[0].y; stepGame(restored, input(), .05)
  assert.equal(restored.time, 5); assert.equal(restored.escort.bosses[0].y, y)
  for (let n = 0; n < 12; n++) saveFlight(store, `session-${n}`, g)
  assert.equal(JSON.parse([...store.data.values()][0]).rows.length, 8)
  const key = [...store.data.keys()][0]
  const book = JSON.parse(store.getItem(key)); book.rows[0].game.escort.bosses = [{}]; store.setItem(key, JSON.stringify(book))
  assert.equal(loadFlight(store, book.rows[0].sessionId), null)
  store.setItem(key, '{broken'); assert.equal(loadFlight(store, 'a'), null)
})

test('plane rehearsal covers four archetypes, burst formation, supplies and several choices through the real adapter', () => {
  const g = createGame('plane')
  for (const time of [0, 1, 4, 7, 12, 17, 21, 27, 33, 42]) {
    syncEscort(g, demoFlightMission(time), time === 0)
    if (time < 42) { stepEscort(g, 0); if (g.flight.choice) chooseFlightUpgrade(g, g.flight.choice.options[0]) }
  }
  assert.deepEqual(new Set(g.escort.calls.map(call => toolAircraft(call.name).type)), new Set(['search', 'read', 'edit', 'command']))
  assert.equal(g.escort.summary.total, 21); assert.equal(g.escort.summary.failed, 1)
  assert.ok(g.flight.earned >= 3); assert.ok(g.flight.overflow > 0)
})
