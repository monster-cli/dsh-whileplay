import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialMission, foldMission } from '../mission.js'
import { createGame, stepGame, drawGame } from '../src/engine.js'
import { syncEscort, stepEscort, demoMission } from '../src/mission-game.js'
const event = (type, seq, data = {}) => ({ type, seq, data })
const call = (seq, id, name = 'web_search') => event('tool/call', seq, { callId: id, name, arguments: 'PRIVATE' })
const result = (seq, id, failed = false) => event('tool/result', seq, { message: { source: { callId: id }, isError: failed, content: 'PRIVATE' } })
const begin = () => foldMission(initialMission(), event('turn/start', 0, { turn: 1 }))

test('host projection folds calls/results once and never includes private tool content', () => {
  let state = foldMission(begin(), call(1, 'a'))
  assert.equal(foldMission(state, call(2, 'a')), state)
  state = foldMission(state, result(3, 'a', true))
  assert.equal(state.completed, 1); assert.equal(state.failed, 1)
  assert.equal(foldMission(state, result(4, 'a')), state)
  assert.ok(!JSON.stringify(state).includes('PRIVATE'))
  assert.equal(foldMission(state, event('assistant/message', 5)), state)
  state = foldMission(state, event('turn/end', 6))
  assert.equal(state.running, false)
  state = foldMission(state, event('turn/start', 7))
  assert.equal(state.total, 0); assert.deepEqual(state.calls, [])
})

test('host projection bounds long tool histories and prioritizes active calls', () => {
  let state = foldMission(begin(), call(1, 'active'))
  for (let i = 0; i < 500; i++) { state = foldMission(state, call(i * 2 + 2, String(i))); state = foldMission(state, result(i * 2 + 3, String(i))) }
  assert.equal(state.calls.length, 128); assert.equal(state.total, 501); assert.equal(state.completed, 500)
  assert.equal(state.calls[0].id, 'active')
})

test('baseline ignores completed history; active calls appear once, with two bosses and bounded queue', () => {
  const g = createGame('plane')
  let state = foldMission(begin(), call(1, 'old')); state = foldMission(state, result(2, 'old'))
  for (let i = 0; i < 20; i++) state = foldMission(state, call(i + 3, String(i)))
  syncEscort(g, state, true); syncEscort(g, state)
  assert.equal(g.escort.queue.length, 12)
  stepEscort(g, .05); assert.equal(g.escort.bosses.length, 2)
  assert.ok(g.escort.bosses.every(boss => boss.call.id !== 'old'))
  assert.equal(g.escort.total, 21)
})

test('defeated bosses retain real tool state; result and turn end settle without repeating rewards', () => {
  const g = createGame('plane'); let state = foldMission(begin(), call(1, 'a'))
  syncEscort(g, state, true); stepEscort(g, .05)
  const boss = g.escort.bosses[0]; boss.y = 60; boss.hp = 1
  g.bullets.push({ x: boss.x + 32, y: 70, w: 4, h: 12 })
  stepEscort(g, 0)
  assert.equal(g.score, 100); assert.equal(g.escort.kills, 1); assert.equal(g.escort.calls[0].phase, 'running')
  state = foldMission(state, result(2, 'a')); syncEscort(g, state)
  assert.equal(g.escort.calls[0].phase, 'done'); assert.equal(g.score, 100)
  state = foldMission(state, event('turn/end', 3)); syncEscort(g, state)
  assert.deepEqual(g.escort.summary, { total: 1, completed: 1, failed: 0, kills: 1, score: 100 })
  syncEscort(g, state); assert.equal(g.score, 100)
})

test('ended history does not fabricate a settlement and new turns clear the old battlefield', () => {
  const g = createGame('plane'); let state = foldMission(begin(), call(1, 'a'))
  state = foldMission(state, event('turn/end', 2)); syncEscort(g, state, true)
  assert.equal(g.escort.summary, null); assert.equal(g.escort.queue.length, 0)
  state = foldMission(state, event('turn/start', 3)); syncEscort(g, state)
  assert.equal(g.escort.calls.length, 0); assert.equal(g.escort.running, true)
})

test('boss bullets, shield pickups and read-only rendering work in the full plane engine', () => {
  const g = createGame('plane'); syncEscort(g, demoMission(0), true)
  stepEscort(g, .05)
  const boss = g.escort.bosses[0]; boss.y = 80; boss.fire = 0
  stepEscort(g, .05); assert.equal(g.escort.shots.length, 3)
  g.escort.drops.push({ ...g.player, w: 12, h: 12 }); stepEscort(g, 0)
  assert.equal(g.escort.shield, 1); assert.equal(g.score, 20)
  g.escort.shots.push({ ...g.player, vx: 0 }); stepEscort(g, 0)
  assert.equal(g.over, false); assert.equal(g.escort.shield, 0)
  const before = JSON.stringify(g)
  const ctx = new Proxy({}, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => (o[k] = v, true) })
  drawGame(ctx, g); assert.equal(JSON.stringify(g), before)
  stepGame(g, { keys: new Set() }, .05)
})

test('offline rehearsal covers parallel tools, an error, a retry and settlement', () => {
  const g = createGame('plane')
  for (let t = 0; t <= 30; t++) syncEscort(g, demoMission(t), t === 0)
  assert.equal(g.escort.summary.total, 5); assert.equal(g.escort.summary.completed, 5); assert.equal(g.escort.summary.failed, 1)
})

test('tool results never alter a spawned aircraft flight, fire or lifetime', () => {
  const games = ['running', 'done', 'error'].map(phase => {
    const g = createGame('plane'); let state = foldMission(begin(), call(1, 'a'))
    syncEscort(g, state, true); stepEscort(g, .05)
    if (phase !== 'running') { state = foldMission(state, result(2, 'a', phase === 'error')); syncEscort(g, state) }
    return g
  })
  for (let n = 0; n < 90; n++) for (const g of games) stepEscort(g, .05)
  for (const g of games) {
    assert.equal(g.escort.bosses.length, 1)
    assert.ok(g.escort.bosses[0].y > 300, 'flies down beyond the old hover position')
    assert.ok(g.escort.shots.length > 0, 'keeps firing regardless of tool state')
    assert.equal(g.escort.drops.length, 0)
  }
  assert.deepEqual(games.map(g => g.escort.bosses[0].y), Array(3).fill(games[0].escort.bosses[0].y))
  for (let n = 0; n < 60; n++) for (const g of games) stepEscort(g, .05)
  for (const g of games) {
    assert.equal(g.escort.bosses.length, 0, 'leaves through the bottom even if tool is still running')
    assert.equal(g.escort.drops.length, 0); assert.equal(g.score, 0)
  }
})

test('queued completed tools follow the same flight and only a kill awards loot', () => {
  for (const failed of [false, true]) {
    const g = createGame('plane'); let state = begin(); syncEscort(g, state, true)
    state = foldMission(state, call(1, 'queued')); state = foldMission(state, result(2, 'queued', failed)); syncEscort(g, state)
    for (let n = 0; n < 40; n++) stepEscort(g, .05)
    const boss = g.escort.bosses[0]
    assert.ok(boss.y > 100); assert.equal(boss.call.phase, failed ? 'error' : 'done')
    boss.hp = 1; g.bullets.push({ x: boss.x + 32, y: boss.y + 10, w: 4, h: 12 })
    stepEscort(g, 0)
    assert.equal(g.escort.bosses.length, 0); assert.equal(g.score, 100); assert.equal(g.escort.drops.length, 1)
    syncEscort(g, { ...state, seq: 3 }); stepEscort(g, 0)
    assert.equal(g.score, 100); assert.equal(g.escort.drops.length, 1)
  }
})

test('turn completion and the next turn preserve already spawned aircraft and shots', () => {
  const g = createGame('plane'); let state = foldMission(begin(), call(1, 'a'))
  syncEscort(g, state, true)
  for (let n = 0; n < 45; n++) stepEscort(g, .05)
  const boss = g.escort.bosses[0], before = boss.y, shots = g.escort.shots
  state = foldMission(state, event('turn/end', 2)); syncEscort(g, state)
  assert.equal(g.escort.bosses[0], boss); assert.equal(boss.y, before); assert.equal(g.escort.shots, shots)
  state = foldMission(state, event('turn/start', 3)); syncEscort(g, state)
  assert.equal(g.escort.bosses[0], boss)
  stepEscort(g, .05); assert.ok(boss.y > before)
  boss.hp = 1; g.bullets.push({ x: boss.x + 32, y: boss.y + 10, w: 4, h: 12 }); stepEscort(g, 0)
  assert.equal(g.score, 100); assert.equal(g.escort.kills, 0, 'old aircraft do not count toward the new task')
})
