/** Read-only tool activity projection. Never calls tools or changes the agent. */
import { z } from 'zod'
import { initialMission, foldMission } from './mission.js'
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
  })
}
