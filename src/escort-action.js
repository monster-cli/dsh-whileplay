import { drawEscortTerrain, escortRouteStage } from './escort-terrain.js'
import { drawEscortOcean, drawEscortJet, drawEscortConvoy } from './escort-art.js'
import { drawEscortSupply, drawEscortTaskWorld, drawEscortTaskHUD } from './escort-task.js'

/** The fixed timeline belongs exclusively to the opt-in rehearsal. */
export function createEscortAction(mode = 'demo') {
  return { version: 3, mode, time: 0, phase: 'ready', score: 0, kills: 0, player: { x: 240, y: 625, hp: 5, grace: 2 },
    convoy: { x: 240, y: 560, hp: 100 }, enemies: [], bullets: [], shots: [], drops: [], bursts: [],
    combo: 0, comboTTL: 0, bestCombo: 0, salvage: 0, level: 1, dash: 0, dashCooldown: 0, shake: 0, flash: 0, wave: 0, bossKills: 0, particles: [], floaters: [], cooldown: 0, spawn: .35, seen: [], todos: mode === 'live' ? [] : ['进行中', '待处理', '待处理', '待处理'],
    agents: mode === 'live' ? [] : ['执行中', '执行中'], wings: 0, repair: 1, strike: 1, boost: 0, shield: 0, used: 0, cargo: [],
    decision: null, log: [], notice: '方向键 / WASD 移动，靠近运输船护航；空格冲刺穿越弹幕；Q 修复，E 空袭。', noticeUntil: 6 }
}
function actionLog(g, source, text) {
  g.log.push({ source, text, time: g.time }); g.log = g.log.slice(-20); g.notice = text; g.noticeUntil = g.time + 4
}
export function actionTaskEvents(g) {
  if (g.mode === 'live') return
  const once = (id, time, fn) => { if (g.time >= time && !g.seen.includes(id)) { g.seen.push(id); fn() } }
  once('search', 2, () => { g.drops.push({ x: 170, y: 420, type: 'boost', ttl: 14, source: 'web_search', born: g.time }); actionLog(g, '工具', 'web_search 返回 · 火力补给进入战场，移动拾取') })
  once('read', 6, () => { g.drops.push({ x: 310, y: 475, type: 'shield', ttl: 14, source: 'read_file', born: g.time }); actionLog(g, '工具', 'read_file 返回 · 护盾补给投放') })
  once('write', 10, () => { g.repair = Math.min(3, g.repair + 1); actionLog(g, '工具', 'write_file 返回 · 工程支援 +1，按 Q 修复运输船') })
  once('ui', 15, () => { g.agents[0] = '已归航'; g.wings = 1; g.todos = ['已完成', '进行中', '待处理', '待处理']; actionLog(g, '子 Agent', '界面 Agent 归航 · 设计 Todo 完成，加入编队协同射击') })
  once('patch', 21, () => { g.drops.push({ x: 200, y: 350, type: 'boost', ttl: 14, source: 'apply_patch', born: g.time }); actionLog(g, '工具', 'apply_patch 返回 · 新火力补给已投放') })
  once('attention', 31, () => { g.phase = 'attention'; actionLog(g, '模拟交互', '任务需要用户查看 · 战场已冻结，不会损失生命或补给') })
  once('logic', 36, () => { g.agents[1] = '已归航'; g.wings = 2; g.cargo = ['pomodoro.html']; g.todos = ['已完成', '已完成', '进行中', '待处理']; actionLog(g, '子 Agent', '逻辑 Agent 归航 · pomodoro.html 已装船，第二架僚机加入') })
  once('command', 42, () => { g.strike = Math.min(3, g.strike + 1); actionLog(g, '工具', `${g.decision === 'reject' ? '替代检查' : 'shell_exec'} 返回 · 空袭支援 +1，按 E 清除敌机与敌弹`) })
  once('check', 49, () => { g.cargo = ['pomodoro.html', '使用说明.md']; g.todos = ['已完成', '已完成', '已完成', '进行中']; actionLog(g, 'Todo', '检查 Todo 完成 · 使用说明.md 已装船，护送两件成果入港') })
  once('delivery', 62, () => {
    g.todos = ['已完成', '已完成', '已完成', '已完成']; g.phase = 'complete'
    g.cargo = ['pomodoro.html', '使用说明.md']; g.shots = []; g.enemies = []
    actionLog(g, '交付物', '模拟任务结束 · 两件成果货物已安全入港，战场暂停')
  })
}
export function actionSupport(g, kind) {
  if (g.phase !== 'playing') return false
  if (kind === 'dash' && g.dashCooldown <= 0) {
    g.dash = .23; g.dashCooldown = 2.8; g.player.grace = Math.max(g.player.grace, .35); g.shake = 2; return true
  }
  if (kind === 'repair' && g.repair > 0) {
    g.repair--; g.used++; g.convoy.hp = Math.min(100, g.convoy.hp + 28); g.shield = 4
    actionLog(g, '支援', '工程修复 · 运输船恢复 28 耐久，护盾持续 4 秒'); return true
  }
  if (kind === 'strike' && g.strike > 0) {
    g.strike--; g.used++; g.shots = []; g.flash = .35; g.shake = 12
    for (const e of g.enemies) { e.hp -= e.boss ? 24 : 99; if (e.hp <= 0) actionKill(g, e); else e.hit = .15 }
    g.enemies = g.enemies.filter(e => e.hp > 0); g.bursts.push({ x: g.convoy.x, y: g.convoy.y, life: .7, radius: 170 })
    actionLog(g, '支援', '空袭支援 · 清除杂兵与敌弹，重创旗舰'); return true
  }
  return false
}
const actionDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
function actionShot(from, target, speed, extra = {}) {
  const dx = target.x - from.x, dy = target.y - from.y, length = Math.hypot(dx, dy) || 1
  return { x: from.x, y: from.y, vx: dx / length * speed, vy: dy / length * speed, ttl: 2.5, ...extra }
}
function actionFloat(g, x, y, text, color = 'gold') {
  g.floaters.push({ x, y, text, color, life: 1.1 })
}
function actionKill(g, e) {
  g.combo++; g.bestCombo = Math.max(g.bestCombo, g.combo); g.comboTTL = 3
  const points = (e.boss ? 600 : e.heavy ? 80 : 30) * Math.min(4, 1 + Math.floor(g.combo / 5))
  g.score += points; g.kills++; g.shake = e.boss ? 10 : 3
  if (e.boss) { g.bossKills++; g.strike = Math.min(3, g.strike + 1) }
  g.bursts.push({ x: e.x, y: e.y, life: .65, radius: e.boss ? 95 : 28 })
  actionFloat(g, e.x, e.y - 15, `+${points}`)
  // Deterministic visual debris never consumes the gameplay random stream.
  for (let i = 0; i < (e.boss ? 24 : 9); i++) {
    const a = i * 2.4, speed = 35 + i % 5 * 22
    g.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .65, hot: true })
  }
  g.drops.push({ x: e.x, y: e.y, type: 'salvage', ttl: 11 })
  if (e.boss) g.drops.push({ x: e.x + 25, y: e.y, type: 'boost', ttl: 15 })
}
function actionBoss(g, stage) {
  const id = `flagship-${stage}`
  if (g.seen.includes(id)) return
  g.seen.push(id)
  g.enemies.push({ x: 240, y: -45, hp: stage === 1 ? 48 : 72, maxHP: stage === 1 ? 48 : 72, boss: true, heavy: true, kind: 'flagship', fire: 2.6, speed: 24, age: 0, hit: 0 })
  actionFloat(g, 240, 180, stage === 1 ? '重装旗舰入侵' : '最终拦截', 'gold')
  actionLog(g, '敌情', stage === 1 ? '重装旗舰接近 · 红线锁定后冲刺躲避，击破可获得空袭补给' : '最终拦截 · 旗舰与编队来袭，保护成果运输船')
}
export function stepEscortAction(g, input, seconds, random = Math.random) {
  if (g.phase !== 'playing') return
  const dt = Math.max(0, Math.min(.05, seconds)); g.time += dt
  actionTaskEvents(g)
  if (g.phase !== 'playing') return
  g.player.grace = Math.max(0, g.player.grace - dt); g.boost = Math.max(0, g.boost - dt); g.shield = Math.max(0, g.shield - dt)
  for (const key of ['dash', 'dashCooldown', 'flash', 'comboTTL']) g[key] = Math.max(0, g[key] - dt)
  g.shake *= Math.exp(-18 * dt)
  if (!g.comboTTL) g.combo = 0
  if (g.time >= 18) actionBoss(g, 1)
  if (g.time >= 49) actionBoss(g, 2)
  const keys = input.keys || new Set()
  const dx = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'))
  const dy = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'))
  const norm = Math.hypot(dx, dy) || 1
  g.player.x = Math.max(18, Math.min(462, g.player.x + dx / norm * 235 * (g.dash > 0 ? 3.2 : 1) * dt))
  g.player.y = Math.max(110, Math.min(640, g.player.y + dy / norm * 235 * (g.dash > 0 ? 3.2 : 1) * dt))
  if (input.pointer) { g.player.x = Math.max(18, Math.min(462, input.x)); g.player.y = Math.max(110, Math.min(640, input.y)) }
  // Autonomous convoy movement follows the rehearsal's task route, not player score.
  const stage = escortRouteStage(g)
  const target = g.mode === 'live' ? { x: 240, y: 520 - (g.todos.length ? g.todos.filter(s => s === '已完成').length / g.todos.length * 190 : 0) } : [{ x: 240, y: 520 }, { x: 240, y: 460 }, { x: 240, y: 400 }, { x: 240, y: 330 }][stage]
  const dist = actionDistance(g.convoy, target)
  if (dist > 1) { g.convoy.x += (target.x - g.convoy.x) / dist * Math.min(dist, 65 * dt); g.convoy.y += (target.y - g.convoy.y) / dist * Math.min(dist, 65 * dt) }
  g.spawn -= dt
  if (g.spawn <= 0 && g.enemies.filter(e => !e.boss).length < 12) {
    g.wave++
    const kind = g.wave % 4 === 0 ? 'gunner' : g.wave % 3 === 0 ? 'raider' : 'scout'
    const count = g.time < 8 ? 2 : 3, center = 90 + random() * 300
    for (let i = 0; i < count; i++) {
      const heavy = kind === 'gunner', hp = heavy ? 5 : 2
      g.enemies.push({ x: Math.max(35, Math.min(445, center + (i - 1) * 65)), y: -25 - i * 23,
        hp, maxHP: hp, heavy, kind, fire: 1.9 + i * .25, speed: kind === 'raider' ? 88 : heavy ? 34 : 52, age: 0, hit: 0 })
    }
    g.spawn = Math.max(2.2, 3.7 - g.time / 70)
  }
  g.cooldown -= dt
  if (g.cooldown <= 0) {
    const nearest = [...g.enemies].sort((a, b) => actionDistance(g.player, a) - actionDistance(g.player, b))[0]
    const aim = nearest || { x: g.player.x, y: g.player.y - 100 }
    g.bullets.push(actionShot(g.player, aim, 540, { damage: g.level >= 3 ? 2 : 1 }))
    if (g.level >= 2 && !g.boost) g.bullets.push(actionShot({ x: g.player.x + 12, y: g.player.y }, aim, 540))
    if (g.boost) for (const offset of [-12, 12]) g.bullets.push(actionShot({ x: g.player.x + offset, y: g.player.y }, aim, 420))
    for (let i = 0; i < g.wings; i++) {
      const from = { x: g.player.x + (i ? 34 : -34), y: g.player.y + 25 }
      g.bullets.push(actionShot(from, aim, 380, { wing: true }))
    }
    g.cooldown = g.boost ? .12 : .20
  }
  for (const e of g.enemies) {
    e.age = (e.age || 0) + dt; e.hit = Math.max(0, (e.hit || 0) - dt)
    const d = actionDistance(e, g.convoy) || 1
    if (e.boss) { e.y += (185 - e.y) * dt; e.x = 240 + Math.sin(e.age * .65) * 150 }
    else {
      e.x += (g.convoy.x - e.x) / d * e.speed * dt + Math.sin(e.age * 3) * (e.kind === 'raider' ? 55 : 12) * dt
      e.y += (g.convoy.y - e.y) / d * e.speed * dt
    }
    e.fire -= dt
    if ((e.boss || e.kind === 'gunner') && e.fire < .65 && !e.aim) e.aim = { x: g.player.x, y: g.player.y }
    if (e.fire <= 0 && e.y > 110) {
      const aim = e.aim || (e.kind === 'raider' ? g.player : g.convoy), speed = e.boss ? 185 : 125
      const shot = actionShot(e, aim, speed)
      const angles = e.boss ? [-.32, -.16, 0, .16, .32] : e.kind === 'gunner' ? [-.2, 0, .2] : [0]
      for (const angle of angles) g.shots.push({ ...shot, vx: shot.vx * Math.cos(angle) - shot.vy * Math.sin(angle), vy: shot.vx * Math.sin(angle) + shot.vy * Math.cos(angle), ttl: 5 })
      e.aim = null; e.fire = e.boss ? 2.1 : e.heavy ? 2.8 : 3.5
    }
    if (!e.boss && d < 29) { e.hp = 0; g.shake = 5; if (!g.shield) g.convoy.hp -= e.heavy ? 10 : 5 }
  }
  for (const b of g.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt
    const enemy = g.enemies.find(e => e.hp > 0 && actionDistance(b, e) < (e.boss ? 42 : e.heavy ? 20 : 15))
    if (enemy) { b.ttl = 0; enemy.hp -= b.damage || 1; enemy.hit = .09; g.particles.push({ x: b.x, y: b.y, vx: -b.vx * .07, vy: -b.vy * .07, life: .16, hot: true }); if (enemy.hp <= 0) actionKill(g, enemy) }
  }
  for (const b of g.shots) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt
    if (actionDistance(b, g.player) < 14 && !g.player.grace) { b.ttl = 0; g.player.hp--; g.player.grace = 1.5; g.shake = 8; g.combo = 0; g.comboTTL = 0 }
    else if (actionDistance(b, g.convoy) < 26) { b.ttl = 0; if (!g.shield) g.convoy.hp -= 4 }
  }
  for (const e of g.enemies) if (e.hp > 0 && actionDistance(e, g.player) < 24 && !g.player.grace) { g.player.hp--; g.player.grace = 1.5; g.shake = 8; g.combo = 0; g.comboTTL = 0; if (!e.boss) e.hp = 0 }
  for (const d of g.drops) {
    d.ttl -= dt
    const distance = actionDistance(d, g.player)
    if (distance < 105 && distance > 1) { d.x += (g.player.x - d.x) / distance * 180 * dt; d.y += (g.player.y - d.y) / distance * 180 * dt }
    if (distance < 30) {
      d.ttl = 0; g.score += 20
      if (d.type === 'boost') g.boost = 10
      else if (d.type === 'salvage') {
        g.salvage++; const next = Math.min(3, 1 + Math.floor(g.salvage / 5))
        if (next > g.level) { g.level = next; actionFloat(g, g.player.x, g.player.y - 35, `火力 Lv.${next}`); g.flash = .12 }
        else actionFloat(g, d.x, d.y, '能量 +1', 'blue')
      }
      else { g.shield = 7; g.player.grace = 3 }
      if (d.type !== 'salvage') actionLog(g, '拾取', d.type === 'boost' ? '火力强化 10 秒 · 三发齐射' : '运输船护盾 7 秒')
    }
  }
  for (const b of g.bursts) b.life -= dt
  for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt }
  for (const f of g.floaters) { f.life -= dt; f.y -= 26 * dt }
  g.particles = g.particles.filter(p => p.life > 0).slice(-150); g.floaters = g.floaters.filter(f => f.life > 0).slice(-24)
  g.enemies = g.enemies.filter(e => e.hp > 0); g.bullets = g.bullets.filter(b => b.ttl > 0).slice(-160)
  g.shots = g.shots.filter(b => b.ttl > 0).slice(-100); g.drops = g.drops.filter(d => d.ttl > 0).slice(-40); g.bursts = g.bursts.filter(b => b.life > 0)
  if (g.player.hp <= 0 || g.convoy.hp <= 0) { g.phase = 'over'; g.convoy.hp = Math.max(0, g.convoy.hp); actionLog(g, '战斗', '本次护航失利 · 可重新演练；游戏胜负不影响真实任务') }
}
export function drawEscortAction(ctx, g, p) {
  const cyan = '#a4d8dc', gold = '#d9bd86', red = '#e09a83', white = '#e5ece5'
  ctx.save()
  drawEscortOcean(ctx, g, p)
  const scroll = g.time * 24
  ctx.save(); ctx.beginPath(); ctx.rect(0, 100, 480, 560); ctx.clip()
  const coast = (x, y, size, seed) => {
    ctx.save(); ctx.translate(x, y)
    const shore = scale => {
      ctx.beginPath()
      for (let i = 0; i <= 36; i++) {
        const a = i / 36 * Math.PI * 2, r = size * (1 + .12 * Math.sin(a * 5 + seed) + .07 * Math.cos(a * 9 - seed))
        const px = Math.cos(a) * r * scale, py = Math.sin(a) * r * 1.8 * scale
        if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
    }
    ctx.globalAlpha = .25; ctx.fillStyle = '#397986'; shore(1.23); ctx.fill()
    ctx.globalAlpha = .35; ctx.strokeStyle = '#a0c7be'; ctx.lineWidth = 1; shore(1.13 + Math.sin(g.time * 1.3 + seed) * .015); ctx.stroke()
    ctx.globalAlpha = 1; ctx.fillStyle = '#777c66'; shore(1.04); ctx.fill()
    ctx.fillStyle = '#314e47'; shore(1); ctx.fill()
    ctx.fillStyle = '#28443d'; shore(.88); ctx.fill()
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.4, r = size * Math.sqrt(i / 25) * .8
      const px = Math.cos(angle) * r, py = Math.sin(angle) * r * 1.8
      ctx.fillStyle = i % 3 ? '#38584a' : '#536450'; ctx.beginPath(); ctx.ellipse(px, py, 6 + i % 5, 9 + i % 6, angle, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  coast(-55, (110 + scroll * .8) % 1150 - 220, 90, 2)
  coast(548, (650 + scroll * .8) % 1150 - 220, 105, 7)
  ctx.restore(); ctx.globalAlpha = 1
  drawEscortTerrain(ctx, g)
  ctx.save()
  if (g.shake > .05 && !p.reducedMotion) ctx.translate(Math.sin(g.time * 93) * g.shake * .55, Math.cos(g.time * 81) * g.shake * .4)
  const jet = (x, y, scale, angle, hostile = false, hit = false, boss = false) => drawEscortJet(ctx, g, x, y, scale, angle, hostile, hit, boss)
  // Telegraphs precede aimed volleys; they do not follow the player after locking.
  for (const e of g.enemies) if (e.aim && e.fire > 0) {
    ctx.strokeStyle = red; ctx.globalAlpha = .25 + Math.sin(g.time * 22) * .12; ctx.lineWidth = e.boss ? 2 : 1; ctx.setLineDash([7, 6])
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.aim.x, e.aim.y); ctx.stroke(); ctx.setLineDash([])
    ctx.beginPath(); ctx.arc(e.aim.x, e.aim.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
  }
  for (const e of g.enemies) {
    jet(e.x, e.y, e.boss ? 1.8 : e.heavy ? 1 : .78, Math.PI, true, e.hit > 0, e.boss)
    if (e.tool && e.y > 115) { ctx.textAlign = 'center'; ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#ded8ba'; ctx.fillText(e.tool.slice(0, 20), e.x, e.y + 35) }
    if (e.heavy && !e.boss) { ctx.fillStyle = '#293047'; ctx.fillRect(e.x - 17, e.y - 29, 34, 3); ctx.fillStyle = red; ctx.fillRect(e.x - 17, e.y - 29, 34 * e.hp / (e.maxHP || 5), 3) }
  }
  for (const b of g.bullets) {
    ctx.strokeStyle = b.wing ? gold : cyan; ctx.lineWidth = b.wing ? 2 : 3; ctx.shadowColor = cyan; ctx.shadowBlur = 3
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .022, b.y - b.vy * .022); ctx.stroke()
  }
  ctx.shadowBlur = 0
  for (const b of g.shots) {
    ctx.fillStyle = red; ctx.shadowColor = red; ctx.shadowBlur = 3; ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffe7df'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill()
  }
  ctx.shadowBlur = 0
  for (const d of g.drops) drawEscortSupply(ctx, g, d)
  drawEscortConvoy(ctx, g)
  if (g.dash > 0) { ctx.globalAlpha = .22; jet(g.player.x, g.player.y + 30, .9, 0); jet(g.player.x, g.player.y + 55, .8, 0); ctx.globalAlpha = 1 }
  jet(g.player.x, g.player.y, 1.05, 0)
  if (g.player.grace > 0) { ctx.strokeStyle = cyan; ctx.globalAlpha = .3 + Math.sin(g.time * 15) * .15; ctx.beginPath(); ctx.arc(g.player.x, g.player.y, 28, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
  for (let i = 0; i < g.wings; i++) jet(g.player.x + (i ? 38 : -38), g.player.y + 28 + Math.sin(g.time * 3) * 3, .5, 0)
  for (const b of g.bursts) { ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.globalAlpha = Math.min(1, b.life * 2); ctx.beginPath(); ctx.arc(b.x, b.y, (b.radius || 30) * (1 - b.life / .7), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
  for (const part of g.particles) { ctx.globalAlpha = Math.min(1, part.life * 3); ctx.fillStyle = part.hot ? gold : cyan; ctx.fillRect(part.x, part.y, 3, 3) }
  ctx.globalAlpha = 1
  for (const f of g.floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color === 'blue' ? cyan : gold; ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y) }
  ctx.globalAlpha = 1; ctx.restore()
  drawEscortTaskWorld(ctx, g)
  drawEscortTaskHUD(ctx, g)
  if (g.flash) { ctx.globalAlpha = Math.min(.35, g.flash); ctx.fillStyle = '#d4f5ff'; ctx.fillRect(0, 0, 480, 720); ctx.globalAlpha = 1 }
  ctx.restore()
}

export function restoreEscortAction(raw) {
  try {
    if (!raw || raw.length > 150000) return null
    const g = JSON.parse(raw), finite = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e7
    if (!g || ![2, 3].includes(g.version) || !['ready', 'playing', 'paused', 'attention', 'complete', 'over'].includes(g.phase)) return null
    if (!['time', 'score', 'kills', 'wings', 'repair', 'strike', 'boost', 'shield', 'used', 'cooldown', 'spawn', 'noticeUntil'].every(key => finite(g[key]))) return null
    if (g.mode !== undefined && !['live', 'demo'].includes(g.mode)) return null
    g.mode ||= 'demo'
    if (g.time < 0 || g.time > (g.mode === 'live' ? 86400 : 63) || !g.player || !g.convoy || !['x', 'y', 'hp', 'grace'].every(key => finite(g.player[key])) || !['x', 'y', 'hp'].every(key => finite(g.convoy[key]))) return null
    if (!['enemies', 'bullets', 'shots', 'drops', 'bursts', 'seen', 'todos', 'agents', 'cargo', 'log'].every(key => Array.isArray(g[key]) && g[key].length <= 180)) return null
    for (const key of ['enemies', 'bullets', 'shots', 'drops', 'bursts']) if (!g[key].every(row => row && finite(row.x) && finite(row.y))) return null
    if (!g.enemies.every(e => ['hp', 'fire', 'speed'].every(key => finite(e[key]))) || ![...g.bullets, ...g.shots].every(b => ['vx', 'vy', 'ttl'].every(key => finite(b[key])))) return null
    if (!g.drops.every(d => ['boost', 'shield', 'salvage'].includes(d.type) && finite(d.ttl) && (d.source === undefined || typeof d.source === 'string' && d.source.length <= 40) && (d.born === undefined || finite(d.born))) || !g.bursts.every(b => finite(b.life))) return null
    if (!['seen', 'todos', 'agents', 'cargo'].every(key => g[key].every(row => typeof row === 'string' && row.length < 100)) || !g.log.every(row => row && typeof row.source === 'string' && typeof row.text === 'string') || typeof g.notice !== 'string') return null
    if ((g.mode === 'demo' && (g.todos.length !== 4 || g.agents.length !== 2)) || g.wings < 0 || g.wings > 2 || g.repair < 0 || g.repair > 3 || g.strike < 0 || g.strike > 3) return null
    if (g.mode === 'live') {
      delete g.live
      if (g.liveCursor && !['turn', 'seq', 'steps'].every(key => Number.isSafeInteger(g.liveCursor[key]) && g.liveCursor[key] >= -1)) return null
      if (g.liveCursor?.calls !== undefined && (!Array.isArray(g.liveCursor.calls) || g.liveCursor.calls.length > 128 || !g.liveCursor.calls.every(id => typeof id === 'string' && id.length <= 160))) return null
    }
    if (!g.enemies.every(e => (e.tool === undefined || typeof e.tool === 'string' && e.tool.length <= 40) && (e.callId === undefined || typeof e.callId === 'string' && e.callId.length <= 180))) return null
    const defaults = createEscortAction()
    for (const field of ['combo', 'comboTTL', 'bestCombo', 'salvage', 'level', 'dash', 'dashCooldown', 'shake', 'flash', 'wave', 'bossKills']) {
      if (g[field] === undefined) g[field] = defaults[field]
      if (!finite(g[field]) || g[field] < 0) return null
    }
    for (const field of ['particles', 'floaters']) g[field] = []
    if (g.level < 1 || g.level > 3 || g.dashCooldown > 3 || g.dash > 1) return null
    for (const e of g.enemies) { if (e.aim && (!finite(e.aim.x) || !finite(e.aim.y))) return null; if (e.age !== undefined && !finite(e.age)) return null; if (e.boss && (!finite(e.maxHP) || e.maxHP <= 0)) return null }
    // Earlier saves recorded completed rehearsal milestones before staged loading existed.
    if (g.mode === 'demo' && g.seen.includes('check') && g.cargo.length < 2) g.cargo = ['pomodoro.html', '使用说明.md']
    else if (g.mode === 'demo' && g.seen.includes('logic') && !g.cargo.length) g.cargo = ['pomodoro.html']
    if (g.version === 2) {
      // Retain the entire battle when moving from the old landscape field.
      const remap = row => { row.x *= .6; row.y *= 1.5 }
      remap(g.player); remap(g.convoy)
      for (const field of ['enemies', 'bullets', 'shots', 'drops', 'bursts']) for (const row of g[field]) {
        remap(row); if (row.aim) remap(row.aim)
        if (row.vx !== undefined) { row.vx *= .6; row.vy *= 1.5 }
      }
      g.convoy.x = 240; g.convoy.y = [520, 460, 400, 330][Math.max(0, g.todos.findIndex(state => state === '进行中'))]; g.version = 3
      if (g.phase === 'ready') { g.player.x = 240; g.player.y = 625; g.convoy.y = 560 }
    }
    g.player.x = Math.max(18, Math.min(462, g.player.x)); g.player.y = Math.max(110, Math.min(640, g.player.y))
    if (g.phase === 'playing') g.phase = 'paused'
    return g
  } catch { return null }
}
