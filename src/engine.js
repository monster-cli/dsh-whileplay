import { createTankState, stepTank, drawTank } from './tank.js'

/** Game catalog owns display geometry and browsing categories. */
export const GAME_CATALOG = [
  { id: 'plane', category: 'flight', width: 320, height: 480 },
  { id: 'tank', category: 'action', width: 416, height: 416 },
  { id: 'snake', category: 'puzzle', width: 480, height: 320 },
]
/** Neutral fallback for standalone renders; the client supplies DSH theme tokens. */
export const DEFAULT_PALETTE = { background: '#f8f9fb', grid: '#e9ecf1', ink: '#263148', accent: '#4d6bfe', obstacle: '#aab5c8', food: '#db8e48', enemy: '#d56868' }
const same = (a, b) => a.x === b.x && a.y === b.y
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
const clamp = (n, low, high) => Math.max(low, Math.min(high, n))

export function createGame(kind, random = Math.random) {
  const spec = GAME_CATALOG.find(item => item.id === kind)
  if (!spec) throw new Error(`Unknown game: ${kind}`)
  const base = { kind, width: spec.width, height: spec.height, score: 0, over: false, time: 0 }
  if (kind === 'snake') {
    const game = { ...base, body: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }], direction: { x: 1, y: 0 }, food: null, accumulator: 0 }
    placeFood(game, random)
    return game
  }
  if (kind === 'plane') return { ...base, player: { x: 148, y: 398, w: 24, h: 32 }, enemies: [], bullets: [], bursts: [], cooldown: 0, spawn: 0.35 }
  if (kind === 'tank') return createTankState(base)
  throw new Error(`Unknown game: ${kind}`)
}

function placeFood(game, random) {
  const free = []
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
    if (!game.body.some(part => same(part, { x, y }))) free.push({ x, y })
  }
  if (!free.length) { game.over = true; game.food = null; return }
  game.food = free[Math.floor(random() * free.length)]
}

/** Resolve only known active to idle transitions; missing status is never completion. */
export function sessionPause(previous, status) {
  if (status?.pendingInteraction) return 'attention'
  if (previous === true && status?.running === false) return 'ready'
  if (status?.running === undefined) return 'unavailable'
  return null
}

/** Advance one bounded tick. Input is scoped to the focused game canvas. */
export function stepGame(game, input, seconds, random = Math.random) {
  if (game.over) return
  const dt = clamp(seconds, 0, 0.05)
  game.time += dt
  if (game.kind === 'snake') {
    game.accumulator += dt
    if (game.accumulator < Math.max(0.075, 0.15 - game.score * 0.001)) return
    game.accumulator = 0
    const directions = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } }
    const next = directions[input.direction]
    if (next && next.x !== -game.direction.x && next.y !== -game.direction.y) game.direction = next
    const head = { x: game.body[0].x + game.direction.x, y: game.body[0].y + game.direction.y }
    const eat = same(head, game.food)
    const body = eat ? game.body : game.body.slice(0, -1)
    if (head.x < 0 || head.x >= 24 || head.y < 0 || head.y >= 16 || body.some(part => same(part, head))) { game.over = true; return }
    game.body.unshift(head)
    if (eat) { game.score += 10; placeFood(game, random) } else game.body.pop()
  } else if (game.kind === 'plane') {
    const player = game.player
    const horizontal = (input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('ArrowLeft') ? 1 : 0)
    player.x = clamp(player.x + horizontal * 220 * dt, 0, game.width - player.w)
    if (input.pointer && Number.isFinite(input.targetX)) player.x = clamp(input.targetX - player.w / 2, 0, game.width - player.w)
    game.cooldown -= dt
    if (game.cooldown <= 0) {
      game.bullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 10, w: 4, h: 12 })
      game.cooldown += 0.16
    }
    game.spawn -= dt
    if (game.spawn <= 0) {
      game.enemies.push({ x: 8 + random() * (game.width - 44), y: -34, w: 28, h: 30, speed: 85 + random() * 55 + Math.min(game.score / 10, 65) })
      game.spawn += Math.max(0.32, 0.85 - game.score / 1200)
    }
    for (const burst of game.bursts) burst.life -= dt
    for (const bullet of game.bullets) bullet.y -= 380 * dt
    for (const enemy of game.enemies) {
      enemy.y += enemy.speed * dt
      const bullet = game.bullets.find(shot => !shot.hit && overlaps(enemy, shot))
      if (bullet) {
        bullet.hit = true; enemy.hit = true; game.score += 10
        game.bursts.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, life: 0.3 })
      } else if (overlaps(player, enemy)) game.over = true
    }
    game.bullets = game.bullets.filter(shot => !shot.hit && shot.y + shot.h > 0)
    game.enemies = game.enemies.filter(enemy => !enemy.hit && enemy.y < game.height + enemy.h)
    game.bursts = game.bursts.filter(burst => burst.life > 0)
  } else {
    stepTank(game, input, dt, random)
  }
}

/** Draw the current simulation without mutating game state. */
export function drawGame(ctx, game, palette = DEFAULT_PALETTE) {
  const { width, height } = game
  ctx.fillStyle = palette.background; ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = palette.grid; ctx.lineWidth = 1
  const offset = game.kind === 'plane' ? (game.time * 125) % 24 : 0
  for (let x = 0; x < width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
  for (let y = offset; y < height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
  if (game.kind === 'snake') {
    game.body.forEach((p, i) => { ctx.fillStyle = i ? palette.accent : palette.ink; ctx.fillRect(p.x * 20 + 2, p.y * 20 + 2, 16, 16) })
    if (game.food) { ctx.fillStyle = palette.food; ctx.beginPath(); ctx.arc(game.food.x * 20 + 10, game.food.y * 20 + 10, 6, 0, Math.PI * 2); ctx.fill() }
  } else if (game.kind === 'plane') {
    ctx.fillStyle = palette.accent
    for (const shot of game.bullets) ctx.fillRect(shot.x, shot.y, shot.w, shot.h)
    ctx.fillStyle = palette.enemy
    for (const enemy of game.enemies) {
      const { x, y, w, h } = enemy
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + h); ctx.lineTo(x + w / 2 - 4, y + 16); ctx.lineTo(x, y + 10); ctx.lineTo(x, y + 5); ctx.lineTo(x + w / 2 - 4, y + 9); ctx.lineTo(x + w / 2 - 4, y); ctx.lineTo(x + w / 2 + 4, y); ctx.lineTo(x + w / 2 + 4, y + 9); ctx.lineTo(x + w, y + 5); ctx.lineTo(x + w, y + 10); ctx.lineTo(x + w / 2 + 4, y + 16); ctx.closePath(); ctx.fill()
    }
    const { x, y } = game.player
    ctx.fillStyle = palette.accent
    ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.lineTo(x + 16, y + 14); ctx.lineTo(x + 24, y + 22); ctx.lineTo(x + 24, y + 27); ctx.lineTo(x + 16, y + 24); ctx.lineTo(x + 16, y + 32); ctx.lineTo(x + 8, y + 32); ctx.lineTo(x + 8, y + 24); ctx.lineTo(x, y + 27); ctx.lineTo(x, y + 22); ctx.lineTo(x + 8, y + 14); ctx.closePath(); ctx.fill()
    ctx.fillStyle = palette.background; ctx.fillRect(x + 10, y + 12, 4, 8)
    ctx.fillStyle = palette.food; ctx.fillRect(x + 10, y + 33, 4, 4 + Math.floor(game.time * 12) % 2 * 4)
    for (const burst of game.bursts) {
      ctx.strokeStyle = palette.food; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(burst.x, burst.y, 5 + (0.3 - burst.life) * 45, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = palette.ink; ctx.font = '12px sans-serif'; ctx.fillText('+10', burst.x - 10, burst.y - 16 - (0.3 - burst.life) * 30)
    }
  } else {
    drawTank(ctx, game, palette)
  }
}
