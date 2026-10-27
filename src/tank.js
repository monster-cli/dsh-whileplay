/** Classic tank field: 13 by 13 tiles, brick fragments, steel and a defended base. */
const TANK_TILE = 32
const TANK_SIZE = 26
const TANK_VECTORS = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } }
const tankOverlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Build fresh map objects for every round; no destructible state is shared. */
export function createTankState(base) {
  const walls = []
  const brick = (col, row) => {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) walls.push({ x: col * TANK_TILE + dx * 16, y: row * TANK_TILE + dy * 16, w: 16, h: 16, kind: 'brick' })
  }
  for (const row of [1, 2, 4, 5, 7, 8, 10]) for (const col of [1, 3, 5, 7, 9, 11]) brick(col, row)
  for (const [col, row] of [[3, 3], [9, 3], [5, 6], [7, 6], [1, 9], [11, 9]]) walls.push({ x: col * TANK_TILE, y: row * TANK_TILE, w: TANK_TILE, h: TANK_TILE, kind: 'steel' })
  for (const [col, row] of [[5, 11], [6, 11], [7, 11], [5, 12], [7, 12]]) brick(col, row)
  return {
    ...base, walls, base: { x: 192, y: 384, w: 32, h: 32, destroyed: false },
    player: { x: 131, y: 387, w: TANK_SIZE, h: TANK_SIZE, direction: 'up', cooldown: 0 },
    enemies: [3, 195, 387].map(x => ({ x, y: 3, w: TANK_SIZE, h: TANK_SIZE, direction: 'down', cooldown: 1, decision: 1.2 })),
    bullets: [], bursts: [], lives: 3, invulnerable: 1.5, spawn: 2.5,
  }
}

function tankBlocked(game, rect, actor) {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > game.width || rect.y + rect.h > game.height) return true
  if (tankOverlaps(rect, game.base) || game.walls.some(wall => !wall.destroyed && tankOverlaps(rect, wall))) return true
  if (game.enemies.some(enemy => enemy !== actor && !enemy.destroyed && tankOverlaps(rect, enemy))) return true
  return actor !== game.player && game.invulnerable <= 0 && tankOverlaps(rect, game.player)
}

function moveTank(game, actor, direction, distance) {
  const vector = TANK_VECTORS[direction]
  // Small lane alignment makes turns into a one-tile passage forgiving.
  const candidate = { ...actor }
  if (actor.direction !== direction) {
    const axis = vector.x ? 'y' : 'x'
    const aligned = Math.round((actor[axis] - 3) / TANK_TILE) * TANK_TILE + 3
    if (Math.abs(actor[axis] - aligned) <= 9) candidate[axis] = aligned
  }
  actor.direction = direction
  candidate.x += vector.x * distance; candidate.y += vector.y * distance
  if (tankBlocked(game, candidate, actor)) return false
  actor.x = candidate.x; actor.y = candidate.y
  return true
}

function shootTank(game, actor, team) {
  const vector = TANK_VECTORS[actor.direction]
  game.bullets.push({ x: actor.x + 11 + vector.x * 14, y: actor.y + 11 + vector.y * 14, w: 4, h: 4, dx: vector.x, dy: vector.y, team })
}

function tankBurst(game, rect) {
  game.bursts.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, life: 0.3 })
}

function hitPlayerTank(game) {
  if (game.invulnerable > 0) return
  tankBurst(game, game.player)
  game.lives--
  if (game.lives <= 0) { game.over = true; return }
  const spawn = [131, 259, 3, 387].map(x => ({ ...game.player, x, y: 387 })).find(rect => !tankBlocked(game, rect, game.player))
  Object.assign(game.player, { x: spawn?.x ?? 131, y: 387, direction: 'up', cooldown: 0.3 })
  game.invulnerable = 2
}

function stepTankBullet(game, shot, dt) {
  // Substeps keep thin bullets from crossing a brick or tank between frames.
  const distance = 250 * dt
  const count = Math.max(1, Math.ceil(distance / 4))
  for (let index = 0; index < count && !shot.hit && !game.over; index++) {
    shot.x += shot.dx * distance / count; shot.y += shot.dy * distance / count
    if (shot.x + shot.w < 0 || shot.y + shot.h < 0 || shot.x > game.width || shot.y > game.height) { shot.hit = true; break }
    const wall = game.walls.find(item => !item.destroyed && tankOverlaps(shot, item))
    if (wall) {
      shot.hit = true
      if (wall.kind === 'brick') { wall.destroyed = true; tankBurst(game, wall) }
      break
    }
    if (tankOverlaps(shot, game.base)) {
      shot.hit = true; game.base.destroyed = true; game.over = true; tankBurst(game, game.base); break
    }
    if (shot.team === 'player') {
      const enemy = game.enemies.find(item => !item.destroyed && tankOverlaps(shot, item))
      if (enemy) { shot.hit = true; enemy.destroyed = true; game.score += 100; tankBurst(game, enemy) }
    } else if (tankOverlaps(shot, game.player)) { shot.hit = true; hitPlayerTank(game) }
    if (!shot.hit) {
      const opposing = game.bullets.find(other => other !== shot && !other.hit && other.team !== shot.team && tankOverlaps(shot, other))
      if (opposing) { shot.hit = true; opposing.hit = true }
    }
  }
}

/** Advance map movement, enemy decisions and faction-owned projectiles. */
export function stepTank(game, input, dt, random) {
  game.invulnerable = Math.max(0, game.invulnerable - dt)
  game.player.cooldown -= dt
  game.spawn -= dt
  for (const burst of game.bursts) burst.life -= dt
  const keyDirections = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }
  const held = [...input.keys].filter(key => keyDirections[key])
  const key = held.includes(input.direction) ? input.direction : held.at(-1)
  if (key) moveTank(game, game.player, keyDirections[key], 98 * dt)
  if ((input.keys.has('Space') || input.pointer) && game.player.cooldown <= 0) {
    shootTank(game, game.player, 'player'); game.player.cooldown = 0.3
  }
  if (game.spawn <= 0 && game.enemies.length < 4) {
    const start = Math.floor(random() * 3)
    for (let offset = 0; offset < 3; offset++) {
      const enemy = { x: [3, 195, 387][(start + offset) % 3], y: 3, w: TANK_SIZE, h: TANK_SIZE, direction: 'down', cooldown: 0.6, decision: 1 }
      if (tankBlocked(game, enemy, enemy)) continue
      game.enemies.push(enemy); game.spawn = 1.8; break
    }
  }
  for (const enemy of game.enemies) {
    enemy.cooldown -= dt; enemy.decision -= dt
    let direction = enemy.direction
    if (enemy.decision <= 0) {
      const choice = random()
      direction = choice < 0.5 ? 'down' : choice < 0.82 ? (enemy.x < game.base.x ? 'right' : 'left') : 'up'
      enemy.decision = 0.7 + random() * 1.1
    }
    if (!moveTank(game, enemy, direction, (55 + Math.min(game.score / 100, 25)) * dt)) {
      // Stay facing the obstruction long enough to shoot through brickwork.
      enemy.decision = Math.min(enemy.decision, 0.25)
    }
    if (enemy.cooldown <= 0) { shootTank(game, enemy, 'enemy'); enemy.cooldown = 0.9 + random() * 0.6 }
  }
  for (const shot of game.bullets) {
    if (game.over) break
    if (!shot.hit) stepTankBullet(game, shot, dt)
  }
  game.walls = game.walls.filter(wall => !wall.destroyed)
  game.enemies = game.enemies.filter(enemy => !enemy.destroyed)
  game.bullets = game.bullets.filter(shot => !shot.hit)
  game.bursts = game.bursts.filter(burst => burst.life > 0)
}

/** Render brick courses, steel plates, the base and tanks facing four directions. */
export function drawTank(ctx, game, palette) {
  for (const wall of game.walls) {
    ctx.fillStyle = wall.kind === 'brick' ? palette.food : palette.obstacle
    ctx.fillRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2)
    ctx.strokeStyle = palette.background; ctx.lineWidth = 1
    if (wall.kind === 'brick') {
      ctx.beginPath(); ctx.moveTo(wall.x + 1, wall.y + 8); ctx.lineTo(wall.x + 15, wall.y + 8); ctx.moveTo(wall.x + 8, wall.y + 1); ctx.lineTo(wall.x + 8, wall.y + 8); ctx.moveTo(wall.x + 4, wall.y + 8); ctx.lineTo(wall.x + 4, wall.y + 15); ctx.stroke()
    } else { ctx.strokeRect(wall.x + 5, wall.y + 5, wall.w - 10, wall.h - 10) }
  }
  const base = game.base
  ctx.fillStyle = base.destroyed ? palette.enemy : palette.ink
  ctx.fillRect(base.x + 2, base.y + 2, 28, 28)
  ctx.strokeStyle = palette.background; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(base.x + 6, base.y + 9); ctx.lineTo(base.x + 16, base.y + 17); ctx.lineTo(base.x + 26, base.y + 9); ctx.moveTo(base.x + 16, base.y + 17); ctx.lineTo(base.x + 16, base.y + 26); ctx.stroke()
  const tank = (actor, color) => {
    ctx.save(); ctx.translate(actor.x + 13, actor.y + 13)
    ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[actor.direction])
    ctx.fillStyle = color; ctx.fillRect(-13, -13, 6, 26); ctx.fillRect(7, -13, 6, 26); ctx.fillRect(-6, -10, 12, 22)
    ctx.fillStyle = palette.background; ctx.fillRect(-4, -5, 8, 8)
    ctx.fillStyle = color; ctx.fillRect(-2, -18, 4, 18)
    ctx.restore()
  }
  game.enemies.forEach(enemy => tank(enemy, palette.enemy))
  if (!game.over || game.lives > 0) tank(game.player, palette.accent)
  if (game.invulnerable > 0 && !game.over) {
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(game.player.x + 13, game.player.y + 13, 19, 0, Math.PI * 2); ctx.stroke()
  }
  for (const shot of game.bullets) { ctx.fillStyle = shot.team === 'player' ? palette.accent : palette.enemy; ctx.fillRect(shot.x, shot.y, shot.w, shot.h) }
  for (const burst of game.bursts) {
    ctx.strokeStyle = palette.food; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(burst.x, burst.y, 3 + (0.3 - burst.life) * 45, 0, Math.PI * 2); ctx.stroke()
  }
}
