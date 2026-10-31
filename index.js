/** Read-only tool activity projection. Never calls tools or changes the agent. */
import { z } from 'zod'
import { initialMission, foldMission } from './mission.js'
import { initialEscortMission, foldEscortMission } from './escort-mission.js'
export const name = 'whileplay'
export function apply(ctx) {
  ctx.inject(['sessionProjections'], ctx => {
    const schema = z.object({
      turn: z.number(), seq: z.number(), running: z.boolean(),
      total: z.number(), completed: z.number(), failed: z.number(),
      steps: z.number().int().nonnegative(), lastStep: z.number().int(),
      calls: z.array(z.object({ id: z.string(), name: z.string(), phase: z.enum(['running', 'done', 'error']), seq: z.number() })).max(128),
    })
    ctx.sessionProjections.register({
      key: 'whileplayMission', stateVersion: 2, stateSchema: schema,
      init: initialMission, apply: foldMission,
      wire: { viewSchema: schema, view: state => state },
    })
    const expeditionSchema = z.object({
      turn: z.number().int(), seq: z.number().int(), turnStartedAt: z.number().nonnegative().nullable(), running: z.boolean(),
      request: z.string().max(120), endReason: z.string().max(64).nullable(),
      cargo: z.array(z.string().max(80)).max(24),
    })
    ctx.sessionProjections.register({
      key: 'whileplayExpedition', stateVersion: 1, stateSchema: expeditionSchema,
      init: initialEscortMission, apply: foldEscortMission,
      wire: { viewSchema: expeditionSchema, view: state => state },
    })
  })
}
