// Run with the prepared Harness's tsx loader; no model or network requests.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import * as plugin from '../index.js'
if (!process.env.DSH_SOURCE_ROOT) throw new Error('Set DSH_SOURCE_ROOT')
const anchor = resolve(process.env.DSH_SOURCE_ROOT, 'packages/session/session-projection/package.json')
const require = createRequire(anchor)
const load = name => import(pathToFileURL(require.resolve(name)).href)
const { Context } = await load('@deepseek-ai/cordis')
const { default: SessionStore } = await load('@deepseek-ai/dsh-session')
const { default: ProjectionRegistry } = await import(pathToFileURL(resolve(process.env.DSH_SOURCE_ROOT, 'packages/session/session-projection/src/index.ts')).href)
const ctx = new Context()
try {
  await ctx.plugin(SessionStore)
  await ctx.plugin(ProjectionRegistry)
  const fiber = ctx.plugin(plugin)
  await fiber
  const session = ctx.sessions.create()
  const changes = []
  ctx.sessionProjections.onChanged((_session, key, value) => { if (key === 'whileplayMission') changes.push(value) })
  session.append('turn/start', { turn: 1 })
  session.append('tool/call', { turn: 1, step: 1, callId: 'test-call', name: 'web_search', arguments: '{}' })
  let view = ctx.sessionProjections.snapshot(session).values.whileplayMission
  assert.equal(view.total, 1); assert.equal(view.calls[0].phase, 'running')
  session.append('tool/result', { message: { source: { kind: 'tool', callId: 'test-call' }, content: [], isError: false } }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  view = ctx.sessionProjections.snapshot(session).values.whileplayMission
  assert.equal(view.running, false); assert.equal(view.completed, 1)
  assert.equal(view.steps, 1); assert.equal(view.lastStep, 1)
  assert.ok(changes.length >= 3, 'registry emits tool activity changes')
  await fiber.dispose()
  assert.equal(ctx.sessionProjections.snapshot(session).values.whileplayMission, undefined)
  console.log('Projection smoke passed: real Session events, registry updates, snapshot and unload')
} finally { await ctx.fiber.dispose() }
