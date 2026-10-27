import { spawnMissionTank, damageMissionTank, missionTankCells } from './tank.js'

const groundHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
const groundNames = { rapid: ['连发', 'Rapid fire'], shield: ['护盾', 'Shield'], bomb: ['炸弹', 'Bomb'], double: ['双倍', 'Double score'], slow: ['减速', 'Slow'], bounty: ['工具果实', 'Tool fruit'] }

function snakeMissionCells(game) {
  const cells = []
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
    if (game.body.some(part => part.x === x && part.y === y) || (game.food?.x === x && game.food?.y === y)) continue
    if (game.escort.drops.some(drop => !drop.hit && drop.cellX === x && drop.cellY === y)) continue
    cells.push({ x: x * 20 + 2, y: y * 20 + 2, cellX: x, cellY: y })
  }
  return cells
}

/** All event-driven objects use bounded game-time lifetimes, independent of tool results. */
export function stepGroundMission(game, dt, random = Math.random) {
  const m = game.escort
  m.dual = Math.max(0, m.dual - dt); m.slow = Math.max(0, m.slow - dt); m.multiplier = Math.max(0, m.multiplier - dt)
  m.bombFlash = Math.max(0, m.bombFlash - dt); m.supplyCooldown -= dt
  for (const drop of m.drops) drop.ttl -= dt
  m.drops = m.drops.filter(drop => !drop.hit && drop.ttl > 0)
  if (game.kind === 'tank') {
    if (m.queue.length && spawnMissionTank(game, m.queue[0])) m.queue.shift()
  } else if (m.queue.length && m.drops.filter(drop => drop.type === 'bounty').length < 2) {
    const cells = snakeMissionCells(game)
    if (cells.length) {
      const call = m.queue.shift(), cell = cells[Math.floor(random() * cells.length)]
      m.drops.push({ ...cell, w: 16, h: 16, type: 'bounty', ttl: 12, call, turn: m.turn })
    }
  }
  if (m.pendingSupply > 0 && m.supplyCooldown <= 0 && m.drops.length < 6) {
    const cells = game.kind === 'tank' ? missionTankCells(game) : snakeMissionCells(game)
    if (cells.length) {
      const types = game.kind === 'tank' ? ['rapid', 'shield', 'bomb'] : ['double', 'shield', 'slow']
      const roll = random(), type = types[m.demo ? m.supplyIndex % 3 : roll < .65 ? 0 : roll < .9 ? 1 : 2]
      // Near-player reachable cells in tank demos; no board alteration is needed for either game.
      const cell = cells[m.demo && game.kind === 'tank' ? 0 : Math.floor(random() * cells.length)]
      m.drops.push({ ...cell, w: game.kind === 'tank' ? 20 : 16, h: game.kind === 'tank' ? 20 : 16, ttl: 12, type })
      m.pendingSupply--; m.supplyIndex++; m.supplyCooldown = 1.8
      m.notice = `Step 完成 · ${groundNames[type][0]}入场`; m.noticeUntil = game.time + 3
    }
  }
  if (game.kind === 'tank') {
    for (const drop of m.drops) if (!drop.hit && groundHit(game.player, drop)) {
      drop.hit = true; game.score += 20
      if (drop.type === 'rapid') m.dual = 8
      else if (drop.type === 'shield') m.shield = 1
      else {
        game.bullets = game.bullets.filter(shot => shot.team === 'player'); m.bombFlash = .35
        for (const enemy of game.enemies) damageMissionTank(game, enemy, 3)
        game.enemies = game.enemies.filter(enemy => !enemy.destroyed)
      }
      m.notice = `拾取${groundNames[drop.type][0]} +20`; m.noticeUntil = game.time + 3
    }
    m.drops = m.drops.filter(drop => !drop.hit)
  }
}

export function snakeMissionPrize(game, head) {
  return game.escort.drops.find(drop => !drop.hit && drop.cellX === head.x && drop.cellY === head.y)
}

export function collectSnakeMissionPrize(game, drop) {
  if (!drop || drop.hit) return
  const m = game.escort
  drop.hit = true; game.score += (drop.type === 'bounty' ? 30 : 20) * (m.multiplier > 0 ? 2 : 1)
  if (drop.type === 'bounty') { drop.call.defeated = true; if (drop.turn === m.turn) m.kills++ }
  else if (drop.type === 'double') m.multiplier = 8
  else if (drop.type === 'shield') m.shield = 1
  else if (drop.type === 'slow') m.slow = 8
  m.notice = `${groundNames[drop.type][0]}已拾取`; m.noticeUntil = game.time + 3
}

/** One shield rescues a collision by selecting a free adjacent direction; trapped snakes still end. */
export function rescueMissionSnake(game, input) {
  if (!game.escort.shield) return false
  const head = game.body[0], body = game.body.slice(0, -1)
  for (const direction of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
    const x = head.x + direction.x, y = head.y + direction.y
    if (x < 0 || x >= 24 || y < 0 || y >= 16 || body.some(part => part.x === x && part.y === y)) continue
    game.escort.shield = 0; game.direction = direction; input.direction = null
    game.escort.notice = '护盾生效 · 自动转向'; game.escort.noticeUntil = game.time + 3
    return true
  }
  return false
}

export function drawGroundMission(ctx, game, p) {
  const m = game.escort, en = game.language === 'en'
  for (const drop of m.drops) if (!drop.hit) {
    ctx.fillStyle = drop.type === 'bounty' ? p.food : p.accent; ctx.fillRect(drop.x, drop.y, drop.w, drop.h)
    ctx.fillStyle = p.background; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(({ rapid: 'Ⅱ', double: '×2', shield: '+', bomb: 'B', slow: 'S', bounty: '★' })[drop.type], drop.x + drop.w / 2, drop.y + drop.h / 2 + 4)
    ctx.fillStyle = p.ink; ctx.font = '9px sans-serif'
    const label = drop.type === 'bounty' ? drop.call.name.slice(0, 14) : groundNames[drop.type][Number(en)]
    ctx.fillText(`${label} ${Math.ceil(drop.ttl)}s`, Math.max(45, Math.min(game.width - 45, drop.x + drop.w / 2)), drop.y < 26 ? drop.y + drop.h + 11 : drop.y - 4)
  }
  ctx.textAlign = 'left'
  if (m.bombFlash) { ctx.fillStyle = p.food; ctx.globalAlpha = m.bombFlash / .35 * .3; ctx.fillRect(0, 0, game.width, game.height); ctx.globalAlpha = 1 }
  if (m.turn === null) return
  const buffs = [m.dual > 0 ? `${en ? 'Rapid' : '连发'} ${Math.ceil(m.dual)}s` : '', m.multiplier > 0 ? `×2 ${Math.ceil(m.multiplier)}s` : '', m.slow > 0 ? `${en ? 'Slow' : '减速'} ${Math.ceil(m.slow)}s` : '', m.shield ? (en ? 'Shield' : '护盾') : ''].filter(Boolean)
  ctx.font = '10px sans-serif'
  const text = `${m.demo ? (en ? 'DEMO' : '演练') : (en ? 'LIVE' : '任务')} · ${m.completed}/${m.total} · Step ${m.stepsSeen ?? 0}${buffs.length ? ` · ${buffs.join(' · ')}` : ''}`
  const width = Math.min(game.width - 8, (ctx.measureText(text)?.width ?? text.length * 8) + 12)
  ctx.globalAlpha = .9; ctx.fillStyle = p.background; ctx.fillRect(4, 4, width, 20); ctx.globalAlpha = 1
  ctx.fillStyle = p.ink; ctx.fillText(text, 10, 18)
}
