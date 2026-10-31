import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEscortAction, actionTaskEvents, restoreEscortAction } from '../src/escort-action.js'
import { escortLiveView, syncEscortLive, saveEscortAction } from '../src/escort-live.js'

const view = extra => escortLiveView({ sessionId: 'a', title: '真实会话', detail: { turn: 1, turnStartedAt: 100, request: '修复登录页面', cargo: [] }, status: { running: true }, ...extra })
const mission = extra => ({ turn: 1, seq: 2, steps: 0, running: true, calls: [], ...extra })

test('live task identity uses current request; missing data and old or external agents never become demo facts', () => {
  const v = view({ todos: [{ content: '排查请求', status: 'in_progress' }], catalog: [
    { id: 'old', createdAt: 99 }, { id: 'a', label: '调试', createdAt: 101 }, { id: 'b', createdAt: 102 }, { id: 'external', createdAt: 103, mode: 'external' },
  ], statuses: new Map([['a', { running: false }], ['b', { running: false }], ['external', { running: false }]]), summaries: {
    a: { projectionValues: { subagentTiming: { lastTurnCompleted: true } } }, external: { projectionValues: { subagentTiming: { lastTurnCompleted: true } } },
  } })
  assert.equal(v.title, '修复登录页面')
  assert.deepEqual(v.agents.map(a => a.status), ['completed', 'idle', 'idle'])
  assert.deepEqual(v.cargo, [])
  assert.equal(escortLiveView({}).available, false)
  assert.deepEqual(view({ detail: undefined, catalog: [{ id: 'unknown', createdAt: 123 }] }).agents, [])
})

test('real events affect a paused battle once; history, repeated snapshots, and tool completion never remove a plane', () => {
  const g = createEscortAction('live'), v = view()
  syncEscortLive(g, v, mission({ calls: [{ name: 'old', phase: 'done', seq: 2 }] }))
  assert.equal(g.drops.length, 0)
  syncEscortLive(g, v, mission({ seq: 3, calls: [{ name: 'read_file', phase: 'running', seq: 3 }] }))
  assert.equal(g.enemies.length, 1)
  const aircraft = g.enemies[0]
  const done = mission({ seq: 5, steps: 1, calls: [{ name: 'read_file', phase: 'done', seq: 4 }] })
  syncEscortLive(g, v, done)
  assert.equal(g.drops.length, 2)
  assert.equal(g.enemies[0], aircraft)
  syncEscortLive(g, v, done)
  assert.equal(g.drops.length, 2)
  assert.equal(g.phase, 'ready')
  g.phase = 'playing'
  syncEscortLive(g, { ...v, running: false }, { ...done, seq: 6, running: false })
  assert.equal(g.phase, 'paused')
  assert.ok(!g.log.some(row => /成功|已入港/.test(row.text)))
})

test('live mode has no scripted Todo, 31-second permission prompt, demo cargo, or 62-second completion', () => {
  const g = createEscortAction('live')
  g.phase = 'playing'
  for (const time of [16, 32, 50, 63, 120]) { g.time = time; actionTaskEvents(g) }
  assert.equal(g.phase, 'playing'); assert.equal(g.wings, 0)
  assert.deepEqual(g.todos, []); assert.deepEqual(g.cargo, []); assert.equal(g.drops.length, 0)
  syncEscortLive(g, view({ detail: { turn: 1, request: 'PRIVATE TASK', cargo: ['PRIVATE.md'] }, todos: [{ content: 'PRIVATE TODO', status: 'completed' }] }), mission())
  const raw = saveEscortAction(g)
  assert.ok(!raw.includes('PRIVATE'))
  const restored = restoreEscortAction(raw)
  assert.equal(restored.time, 120); assert.equal(restored.phase, 'paused'); assert.equal(restored.mode, 'live')
  assert.equal(restored.live, undefined)
})

test('burst events stay bounded and a new turn clears the previous task metadata without replaying rewards', () => {
  const g = createEscortAction('live')
  syncEscortLive(g, view(), mission())
  for (let seq = 3; seq < 100; seq++) syncEscortLive(g, view(), mission({ seq, steps: seq, calls: [{ name: 'read_file', phase: 'done', seq }] }))
  assert.ok(g.drops.length <= 6)
  g.phase = 'playing'
  syncEscortLive(g, view({ detail: { turn: 101, request: '新的任务', cargo: [] }, todos: [] }), mission({ turn: 101, seq: 102, calls: [{ name: 'prior', phase: 'done', seq: 102 }] }))
  assert.equal(g.phase, 'paused'); assert.deepEqual(g.cargo, []); assert.deepEqual(g.todos, [])
  assert.equal(g.live.title, '新的任务')
  assert.ok(!g.log.some(row => row.text.includes('read_file')))
})

test('opening during a tool and a fast completed tool both spawn once without regranting history on reload', () => {
  const g = createEscortAction('live'), v = view()
  const initial = mission({ calls: [{ id: 'active', name: 'read_file', phase: 'running', seq: 2 }] })
  syncEscortLive(g, v, initial, true)
  assert.equal(g.enemies.length, 1)
  const fast = mission({ seq: 4, calls: [...initial.calls, { id: 'fast', name: 'apply_patch', phase: 'done', seq: 4 }] })
  syncEscortLive(g, v, fast)
  assert.equal(g.enemies.length, 2); assert.equal(g.drops.length, 1)
  const restored = restoreEscortAction(saveEscortAction(g))
  syncEscortLive(restored, v, { ...fast, seq: 6, calls: [...fast.calls, { id: 'offline', name: 'web_search', phase: 'done', seq: 6 }] }, true)
  assert.equal(restored.enemies.length, 2); assert.equal(restored.drops.length, 1)
})

test('a resumed older Agent is included only with current-turn activity evidence, then can join the escort', () => {
  const catalog = [{ id: 'resumed', createdAt: 20 }]
  let v = view({ catalog, summaries: { resumed: { running: true, projectionValues: { subagentTiming: { active: { since: 110 } } } } } })
  assert.equal(v.agents[0].status, 'running')
  v = view({ catalog, observedAgents: v.agents.map(a => a.id), summaries: { resumed: { running: false, projectionValues: { subagentTiming: { lastTurnCompleted: true } } } } })
  assert.equal(v.agents[0].status, 'completed')
  assert.deepEqual(view({ catalog, summaries: { resumed: { running: false, projectionValues: { subagentTiming: { lastTurnCompleted: true } } } } }).agents, [])
})
