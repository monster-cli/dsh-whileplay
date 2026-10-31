/** Bounded, versioned per-session checkpoints; never save input or task bodies. */
const FLIGHT_SAVE_KEY = 'dsh-whileplay.flights.v1'
const validNumber = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e9
function boundedTree(value, depth = 0) {
  if (depth > 12) return false
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return validNumber(value)
  if (typeof value === 'string') return value.length <= 200
  if (Array.isArray(value)) return value.length <= 512 && value.every(row => boundedTree(row, depth + 1))
  if (typeof value !== 'object') return false
  return Object.entries(value).every(([key, row]) => !['__proto__', 'prototype', 'constructor'].includes(key) && boundedTree(row, depth + 1))
}
function validFlightSave(g) {
  if (!g || !boundedTree(g) || g.kind !== 'plane' || g.width !== 320 || g.height !== 480 || typeof g.over !== 'boolean') return false
  if (![g.time, g.score, g.cooldown, g.spawn, g.player?.x, g.player?.y].every(validNumber) || g.time < 0 || g.score < 0) return false
  if (g.player.w !== 24 || g.player.h !== 32 || !g.flight || !g.escort) return false
  const f = g.flight, m = g.escort
  if (!['fire', 'guard', 'move'].every(path => Number.isInteger(f.upgrades?.[path]) && f.upgrades[path] >= 0 && f.upgrades[path] <= 3)) return false
  if (!['earned', 'steps', 'next', 'pending', 'choiceId', 'wave', 'waveCooldown', 'overflow', 'salvage', 'regen', 'grazes', 'ready'].every(key => validNumber(f[key]) && f[key] >= 0)) return false
  if (f.pending > 9 || f.earned > 9 || typeof f.rescued !== 'boolean') return false
  if (f.choice && (!Number.isInteger(f.choice.id) || !Array.isArray(f.choice.options) || !f.choice.options.length || f.choice.options.length > 2 || !f.choice.options.every(path => ['fire', 'guard', 'move'].includes(path)))) return false
  if (!['seq', 'total', 'completed', 'failed', 'kills', 'invincible', 'shield', 'dual', 'bombFlash', 'pendingSupply', 'supplyCooldown', 'supplyIndex', 'slow', 'multiplier', 'noticeUntil'].every(key => validNumber(m[key]))) return false
  if (!(m.turn === null || validNumber(m.turn)) || !(m.stepsSeen === null || validNumber(m.stepsSeen)) || typeof m.running !== 'boolean' || typeof m.demo !== 'boolean') return false
  const entity = row => row && ['x', 'y', 'w', 'h'].every(key => validNumber(row[key]))
  const call = row => row && typeof row.id === 'string' && typeof row.name === 'string' && ['running', 'done', 'error'].includes(row.phase)
    && ['search', 'read', 'edit', 'command', 'tool'].includes(row.type) && validNumber(row.hp) && row.hp > 0 && typeof row.label === 'string' && typeof row.en === 'string'
  if (typeof m.notice !== 'string' || (m.summary && !['total', 'completed', 'failed', 'kills', 'score'].every(key => validNumber(m.summary[key])))) return false
  if (!Array.isArray(m.calls) || m.calls.length > 128 || !m.calls.every(call) || !Array.isArray(m.queue) || m.queue.length > 12 || !m.queue.every(call)) return false
  if (!Array.isArray(m.bosses) || m.bosses.length > 2 || !m.bosses.every(row => entity(row) && call(row.call) && ['age', 'hp', 'fire', 'speed', 'slot'].every(key => validNumber(row[key])))) return false
  if (!Array.isArray(m.drops) || m.drops.length > 16 || !m.drops.every(row => entity(row) && (row.type !== 'upgrade' || ['fire', 'guard', 'move'].includes(row.path)))) return false
  if (!Array.isArray(m.shots) || !m.shots.every(row => entity(row) && validNumber(row.vx))) return false
  if (!Array.isArray(g.enemies) || !g.enemies.every(row => entity(row) && validNumber(row.speed)) || !Array.isArray(g.bullets) || !g.bullets.every(row => entity(row) && (row.hitBosses === undefined || (Array.isArray(row.hitBosses) && row.hitBosses.every(id => typeof id === 'string'))))) return false
  return Array.isArray(g.bursts) && g.bursts.every(row => ['x', 'y', 'life'].every(key => validNumber(row[key])))
}
function readFlightBook(storage) {
  const raw = storage.getItem(FLIGHT_SAVE_KEY)
  if (!raw || raw.length > 1500000) return []
  let book
  try { book = JSON.parse(raw) } catch { return [] }
  return book?.version === 1 && Array.isArray(book.rows) ? book.rows.slice(0, 8) : []
}
export function saveFlight(storage, sessionId, game) {
  if (!sessionId || game.kind !== 'plane' || !validFlightSave(game)) return false
  const rows = readFlightBook(storage).filter(row => row && row.sessionId !== sessionId && typeof row.sessionId === 'string').slice(0, 7)
  rows.unshift({ sessionId: String(sessionId).slice(0, 200), game })
  storage.setItem(FLIGHT_SAVE_KEY, JSON.stringify({ version: 1, rows }))
  return true
}
export function loadFlight(storage, sessionId) {
  const row = readFlightBook(storage).find(row => row?.sessionId === sessionId)
  if (!row || !validFlightSave(row.game)) return null
  const game = row.game
  // JSON copies call records; reconnect identity before resuming the simulation.
  for (const boss of game.escort.bosses) if (boss.turn === game.escort.turn) boss.call = game.escort.calls.find(call => call.id === boss.call.id) ?? boss.call
  game.escort.queue = game.escort.queue.map(call => game.escort.calls.find(row => row.id === call.id) ?? call)
  game.flight.ready = 1.5
  return game
}
