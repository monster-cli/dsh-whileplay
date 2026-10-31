import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEscortAction, actionTaskEvents, restoreEscortAction, drawEscortAction } from '../src/escort-action.js'
import { escortTaskView } from '../src/escort-task.js'
import { escortRouteLandmarks, escortRouteStage } from '../src/escort-terrain.js'

test('tools retain their identity on supplies and rejected simulated commands use the alternative label', () => {
  const g = createEscortAction(); g.time = 1
  assert.equal(escortTaskView(g).call.name, 'web_search')
  g.time = 2; actionTaskEvents(g)
  assert.equal(escortTaskView(g).call, null)
  assert.equal(g.drops[0].source, 'web_search')
  assert.equal(g.drops[0].born, 2)
  assert.equal(restoreEscortAction(JSON.stringify(g)).drops[0].source, 'web_search')
  g.time = 41; g.decision = 'reject'
  assert.equal(escortTaskView(g).call.name, '替代检查')
  g.drops[0].source = {}; assert.equal(restoreEscortAction(JSON.stringify(g)), null)
})

test('task results visibly load the freighter before the final delivery, without duplicate cargo', () => {
  const g = createEscortAction(); g.time = 36; actionTaskEvents(g)
  assert.deepEqual(g.cargo, ['pomodoro.html'])
  assert.ok(escortTaskView(g).agents.every(agent => agent.joined))
  actionTaskEvents(g); assert.deepEqual(g.cargo, ['pomodoro.html'])
  const oldCheckpoint = { ...g, cargo: [] }
  assert.deepEqual(restoreEscortAction(JSON.stringify(oldCheckpoint)).cargo, ['pomodoro.html'])
  g.time = 49; actionTaskEvents(g)
  assert.deepEqual(g.cargo, ['pomodoro.html', '使用说明.md'])
  assert.equal(escortTaskView(g).todo, '交付网页和说明')
  g.time = 62; actionTaskEvents(g)
  assert.equal(g.phase, 'complete'); assert.equal(g.cargo.length, 2)
})

test('the actual battlefield renders Todo, tool, Agent and delivery identities rather than relying on a sidebar', () => {
  const text = [], ctx = new Proxy({}, { get: (o, key) => o[key] ?? (key === 'createLinearGradient' ? (() => ({ addColorStop() {} })) : key === 'fillText' ? (s => text.push(s)) : (() => {})), set: (o, key, value) => (o[key] = value, true) })
  const g = createEscortAction(); g.phase = 'playing'; g.time = 6; actionTaskEvents(g)
  drawEscortAction(ctx, g, {})
  assert.ok(text.some(t => t.includes('设计交互')))
  assert.ok(text.includes('web_search')); assert.ok(text.includes('read_file'))
  assert.ok(text.includes('交付物运输船'))
  text.length = 0; g.time = 36; actionTaskEvents(g); g.phase = 'playing'
  const before = JSON.stringify(g); drawEscortAction(ctx, g, {})
  assert.equal(JSON.stringify(g), before)
  assert.ok(text.includes('界面 Agent')); assert.ok(text.includes('逻辑 Agent'))
  assert.ok(text.some(t => t.includes('pomodoro.html')))
})

test('live battlefield identities come only from the current session and do not use rehearsal placeholders', () => {
  const g = createEscortAction(); g.mode = 'live'; g.phase = 'playing'; g.time = 36
  g.live = {
    title: '整理客户访谈', running: true,
    todos: [{ content: '读取访谈记录', status: 'completed' }, { content: '归纳用户需求', status: 'in_progress' }, { content: '输出评审摘要', status: 'pending' }],
    agents: [{ id: 'research', name: '访谈研究员', status: 'completed' }, { id: 'review', name: '评审助手', status: 'running' }],
    cargo: ['访谈摘要.md', '需求清单.csv', '回访提纲.txt'],
    call: { name: 'read_file', text: '工具正在执行' },
  }
  g.wings = 1; g.cargo = [...g.live.cargo]; g.todos = ['已完成', '进行中', '待处理']
  const view = escortTaskView(g)
  assert.equal(view.title, '整理客户访谈'); assert.equal(view.todo, '归纳用户需求')
  assert.equal(view.total, 3); assert.equal(view.completed, 1)
  assert.deepEqual(view.agents.map(agent => agent.name), ['访谈研究员'])
  assert.deepEqual(view.cargo, g.live.cargo)
  const text = [], ctx = new Proxy({}, { get: (o, key) => o[key] ?? (key === 'createLinearGradient' ? (() => ({ addColorStop() {} })) : key === 'fillText' ? (s => text.push(s)) : (() => {})), set: (o, key, value) => (o[key] = value, true) })
  const before = JSON.stringify(g); drawEscortAction(ctx, g, {})
  assert.equal(JSON.stringify(g), before)
  assert.ok(text.some(t => t.includes('整理客户访谈')))
  assert.ok(text.some(t => t.includes('归纳用户需求')))
  assert.ok(text.includes('访谈研究员')); assert.ok(text.some(t => t.includes('访谈摘要.md')))
  assert.ok(text.includes('1/3 Todo 完成')); assert.ok(text.includes('3 件已装船 · 护送入港'))
  assert.ok(!text.join(' ').includes('番茄钟'))
  assert.ok(!text.join(' ').includes('pomodoro'))
  assert.ok(!text.join(' ').includes('网页与使用说明'))
})

test('missing live task metadata stays empty instead of fabricating Todo, Agent or cargo identities', () => {
  const g = createEscortAction(); g.mode = 'live'; g.time = 41; g.live = { todos: [], agents: [], cargo: [], running: true }
  const view = escortTaskView(g)
  assert.equal(view.title, '当前会话'); assert.equal(view.total, 0)
  assert.equal(view.call, null); assert.deepEqual(view.agents, []); assert.deepEqual(view.cargo, [])
  assert.deepEqual(escortRouteLandmarks(g), [])
  assert.equal(escortRouteStage(g), 0)
})

test('live landmarks follow real Todo state, remain anchored as time passes, and show the correct ordinal on long routes', () => {
  const g = createEscortAction(); g.mode = 'live'
  g.live = { todos: Array.from({ length: 12 }, (_, i) => ({ content: `真实任务 ${i + 1}`, status: i < 7 ? 'completed' : i === 7 ? 'in_progress' : 'pending' })) }
  const nodes = escortRouteLandmarks(g)
  assert.equal(escortRouteStage(g), 7); assert.equal(nodes.length, 4)
  assert.equal(nodes.find(node => node.active).task, '真实任务 8')
  assert.equal(nodes.find(node => node.active).index, 7)
  g.time = 240; assert.deepEqual(escortRouteLandmarks(g), nodes)
  g.live.todos[7].status = 'completed'; g.live.todos[8].status = 'in_progress'
  const next = escortRouteLandmarks(g)
  assert.equal(next.find(node => node.active).task, '真实任务 9')
  assert.equal(next.find(node => node.active).y, nodes.find(node => node.active).y)
  assert.ok(next.every(node => node.task.startsWith('真实任务')))
})
