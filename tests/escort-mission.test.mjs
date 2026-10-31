import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialEscortMission, foldEscortMission } from '../escort-mission.js'
import { apply } from '../index.js'

const event = (type, seq, data = {}) => ({ type, seq, data })
const message = (seq, text, kind = 'user') => event('user/message', seq, { source: { kind }, content: [{ type: 'text', text }] })

test('expedition task brief uses only bounded human text and ignores tool or injected content', () => {
  let state = foldEscortMission(initialEscortMission(), event('turn/start', 0, { turn: 1 }))
  state = foldEscortMission(state, message(1, '  帮我\n整理   周报  '))
  assert.equal(state.request, '帮我 整理 周报')
  assert.equal(foldEscortMission(state, message(2, 'PRIVATE', 'injected')), state)
  assert.equal(foldEscortMission(state, message(3, 'PRIVATE', 'goal')), state)
  assert.equal(foldEscortMission(state, event('tool/call', 4, { arguments: 'PRIVATE' })), state)
  assert.equal(foldEscortMission(state, event('tool/result', 5, { message: { content: 'PRIVATE' } })), state)
  state = foldEscortMission(state, event('user/message', 6, { source: { kind: 'user' }, content: [{ type: 'image', url: 'PRIVATE' }, { type: 'text', text: 'a'.repeat(200) }] }))
  assert.equal(state.request, 'a'.repeat(120))
  assert.ok(!JSON.stringify(state).includes('PRIVATE'))
})

test('declared deliveries retain only basenames, deduplicate and bound cargo', () => {
  let state = foldEscortMission(initialEscortMission(), event('deliverables/presented', 0, { files: [
    { path: 'C:\\PRIVATE\\报告.md', description: 'PRIVATE' }, { path: '/PRIVATE/报告.md' }, { path: '/PRIVATE/chart.png' }, { path: '/invalid/' }, { path: 42 }, null,
  ] }))
  assert.deepEqual(state.cargo, ['报告.md', 'chart.png'])
  state = foldEscortMission(state, event('deliverables/presented', 1, { files: Array.from({ length: 50 }, (_, n) => ({ path: '/PRIVATE/' + n + '-'.repeat(100) })) }))
  assert.equal(state.cargo.length, 24)
  assert.ok(state.cargo.every(name => name.length <= 80))
  assert.ok(!JSON.stringify(state).includes('PRIVATE'))
})

test('turn boundaries preserve latest request, reset deliveries and distinguish all stop reasons', () => {
  let state = foldEscortMission(initialEscortMission(), message(0, '当前任务'))
  state = foldEscortMission(state, { ...event('turn/start', 1, { turn: 1 }), time: 1793318400000 })
  assert.equal(state.request, '当前任务'); assert.equal(state.turn, 1)
  assert.equal(state.turnStartedAt, 1793318400000)
  state = foldEscortMission(state, event('deliverables/presented', 2, { files: [{ path: 'report.md' }] }))
  for (const kind of ['completed', 'aborted', 'blocked', 'error', 'max-tokens', 'interrupted']) {
    const ended = foldEscortMission(state, event('turn/end', 3, { reason: { kind, error: { message: 'PRIVATE' } } }))
    assert.equal(ended.running, false); assert.equal(ended.endReason, kind)
    assert.deepEqual(ended.cargo, ['report.md']); assert.ok(!JSON.stringify(ended).includes('PRIVATE'))
  }
  assert.equal(foldEscortMission(state, event('turn/end', 3)).endReason, null)
  state = foldEscortMission(state, event('turn/start', 4, { turn: 2 }))
  assert.equal(state.running, true); assert.equal(state.endReason, null)
  assert.equal(state.turnStartedAt, null)
  assert.equal(state.request, '当前任务'); assert.deepEqual(state.cargo, [])
  state = foldEscortMission(state, message(5, '下一项工作'))
  assert.equal(state.request, '下一项工作')
})

test('replay is deterministic and ignores duplicate, stale and malformed facts', () => {
  const events = [event('turn/start', 0), message(1, '当前任务'), event('deliverables/presented', 2, { files: [{ path: 'one.md' }] }), event('turn/end', 3, { reason: { kind: 'completed' } })]
  const state = events.reduce(foldEscortMission, initialEscortMission())
  assert.deepEqual(events.reduce(foldEscortMission, initialEscortMission()), state)
  for (const item of events) assert.equal(foldEscortMission(state, item), state)
  for (const item of [undefined, {}, event('user/message', 4, { source: { kind: 'user' }, content: [null] }), event('deliverables/presented', 5, { files: null }), event('user/message', 6, { source: { kind: 'user' }, content: null })]) assert.equal(foldEscortMission(state, item), state)
})

test('plugin registers an independently validated expedition projection beside classic tool activity', () => {
  const definitions = new Map()
  const ctx = { inject(_names, callback) { callback(ctx) }, sessionProjections: { register(definition) { definitions.set(definition.key, definition) } } }
  apply(ctx)
  assert.equal(definitions.get('whileplayMission').stateVersion, 2)
  const expedition = definitions.get('whileplayExpedition')
  assert.equal(expedition.stateVersion, 1)
  let state = expedition.init()
  for (const entry of [event('turn/start', 0), message(1, '真实任务'), event('deliverables/presented', 2, { files: [{ path: '/tmp/result.md' }] }), event('turn/end', 3, { reason: { kind: 'completed' } })]) {
    state = expedition.apply(state, entry)
    assert.deepEqual(expedition.stateSchema.parse(state), state)
    assert.deepEqual(expedition.wire.viewSchema.parse(expedition.wire.view(state)), state)
  }
  assert.equal(state.request, '真实任务'); assert.deepEqual(state.cargo, ['result.md'])
})
