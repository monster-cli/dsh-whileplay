import { earnFlightSteps, stepFlight, chooseFlightUpgrade, damageFlight, flightUpgradeName } from './flight.js'
/** Tool names select game archetypes; never inspect arguments or execute a tool. */
export function toolAircraft(name) {
  const value = name.toLowerCase()
  if (/search|browse|web|fetch/.test(value)) return { type: 'search', label: '搜索扫描机', en: 'Search scanner', hp: 7 }
  if (/read|list|glob|find|ls|cat/.test(value)) return { type: 'read', label: '读取运输机', en: 'Read transport', hp: 5 }
  if (/write|edit|patch|replace/.test(value)) return { type: 'edit', label: '工程装甲机', en: 'Engineering armor', hp: 9 }
  if (/exec|shell|bash|terminal|test|command/.test(value)) return { type: 'command', label: '命令重装机', en: 'Command heavy', hp: 11 }
  return { type: 'tool', label: '工具巡航机', en: 'Tool cruiser', hp: 6 }
}

export function createEscort() {
  return { turn: null, seq: -1, running: false, demo: false, calls: [], queue: [], bosses: [], shots: [], drops: [], kills: 0, total: 0, completed: 0, failed: 0, summary: null, notice: '', noticeUntil: 0, invincible: 0, shield: 0, dual: 0, bombFlash: 0, stepsSeen: null, pendingSupply: 0, supplyCooldown: 0, supplyIndex: 0, slow: 0, multiplier: 0 }
}

/** Whole snapshots may repeat or skip frames. Baseline completed history is never spawned. */
export function syncEscort(game, snapshot, baseline = false) {
  if (!game.escort || !snapshot || snapshot.turn < 0) return
  let m = game.escort
  if (m.turn !== snapshot.turn) {
    const battlefield = { bosses: m.bosses, shots: m.shots, drops: m.drops, shield: m.shield, invincible: m.invincible, dual: m.dual, bombFlash: m.bombFlash, pendingSupply: m.pendingSupply, supplyCooldown: m.supplyCooldown, supplyIndex: m.supplyIndex, slow: m.slow, multiplier: m.multiplier }
    game.escort = m = createEscort()
    Object.assign(m, battlefield)
    m.turn = snapshot.turn
    baseline = baseline || !snapshot.running
  }
  if (snapshot.seq <= m.seq) return
  const oldSeq = m.seq
  m.seq = snapshot.seq; m.running = snapshot.running
  m.total = snapshot.total; m.completed = snapshot.completed; m.failed = snapshot.failed
  const steps = snapshot.steps ?? 0
  if (m.stepsSeen === null) m.stepsSeen = baseline ? steps : 0
  const newSteps = Math.max(0, steps - m.stepsSeen)
  m.pendingSupply += newSteps
  earnFlightSteps(game, newSteps)
  m.stepsSeen = Math.max(m.stepsSeen, steps)
  for (const call of snapshot.calls) {
    let record = m.calls.find(row => row.id === call.id)
    const phaseChanged = !record || record.phase !== call.phase
    if (!record) {
      record = { ...call, ...toolAircraft(call.name), defeated: false }
      m.calls.push(record)
      if (snapshot.running && (call.phase === 'running' || (!baseline && call.seq > oldSeq))) {
        // Bound visual backlog without losing the task's real totals.
        if (m.queue.length < 12) m.queue.push(record)
        else if (game.flight) { game.flight.overflow++; if (game.flight.overflow % 4 === 0) game.flight.salvage = Math.min(3, game.flight.salvage + 1) }
      }
    } else record.phase = call.phase
    if (call.phase !== 'running' && phaseChanged) {
      m.notice = `${call.name.slice(0, 24)} · ${call.phase === 'error' ? '失败' : '完成'}`
      m.noticeUntil = game.time + 3
    }
  }
  m.calls = m.calls.filter(call => snapshot.calls.some(row => row.id === call.id))
  if (!snapshot.running && !baseline && !m.summary) {
    m.summary = { total: m.total, completed: m.completed, failed: m.failed, kills: m.kills, score: game.score }
    m.queue = []
    m.notice = '本次任务已结束'; m.noticeUntil = game.time + 4
  }
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
export function stepEscort(game, dt, random = Math.random) {
  const m = game.escort
  if (game.flight) stepFlight(game, dt)
  m.invincible = Math.max(0, m.invincible - dt)
  m.dual = Math.max(0, m.dual - dt)
  m.bombFlash = Math.max(0, m.bombFlash - dt)
  m.supplyCooldown -= dt
  if (m.pendingSupply > 0 && m.supplyCooldown <= 0 && m.drops.length < 6) {
    const roll = random()
    const type = m.demo ? ['dual', 'shield', 'bomb'][m.supplyIndex % 3] : roll < .65 ? 'dual' : roll < .9 ? 'shield' : 'bomb'
    const x = m.demo ? [148, 232, 64][m.supplyIndex % 3] : 24 + random() * (game.width - 72)
    m.drops.push({ x, y: -24, w: 24, h: 24, type })
    m.pendingSupply--; m.supplyIndex++; m.supplyCooldown = 1.8
    m.notice = `Step 完成 · ${supplyName(type, false)}补给入场`; m.noticeUntil = game.time + 3
  }
  if (game.flight?.salvage && m.drops.length < 6) {
    m.drops.push({ x: 148, y: -24, w: 24, h: 24, type: 'dual' }); game.flight.salvage--
    m.notice = game.language === 'en' ? 'Busy formation · bonus supply' : '密集工具编队 · 额外补给'; m.noticeUntil = game.time + 3
  }
  const newWave = m.running && m.queue.length && !m.bosses.length && (!game.flight || game.flight.waveCooldown <= 0)
  if (newWave && game.flight) { game.flight.wave++; game.flight.waveCooldown = 2 }
  while (newWave && m.bosses.length < 2 && m.queue.length) {
    const call = m.queue.shift(), slot = m.bosses.some(boss => boss.slot === 0) ? 1 : 0
    m.bosses.push({ call, turn: m.turn, slot, x: slot ? 202 : 38, y: -60, w: 64, h: 42, hp: call.hp, fire: 2, age: 0,
      speed: ({ read: 70, edit: 65, command: 75 })[call.type] || 85, cargo: false, flash: 0, aimX: null })
    m.notice = `${call.label} · ${call.name.slice(0, 24)}`; m.noticeUntil = game.time + 3
  }
  for (const boss of m.bosses) {
    boss.age += dt
    boss.flash = Math.max(0, (boss.flash || 0) - dt)
    // Once spawned, flight, firing and lifetime belong entirely to the game.
    boss.y += boss.speed * dt
    boss.x = (boss.slot ? 202 : 38) + Math.sin(boss.age * (boss.call.type === 'read' ? .65 : 1.3)) * 25
    if (boss.y >= game.height + boss.h) { boss.gone = true; continue }
    boss.fire -= dt
    if (boss.call.type === 'command' && boss.fire <= .8 && boss.aimX === null) boss.aimX = game.player.x + game.player.w / 2
    if (boss.fire <= 0 && boss.y > 20) {
      const command = boss.call.type === 'command'
      for (const vx of boss.call.type === 'search' ? [-55, 0, 55] : [0]) m.shots.push({ x: command ? boss.aimX ?? boss.x + 32 : boss.x + boss.w / 2, y: boss.y + boss.h, w: command ? 12 : 6, h: command ? 26 : 9, vx, speed: command ? 205 : 115 })
      boss.fire = command ? 3 : boss.call.type === 'read' ? 3.4 : 2.4; boss.aimX = null
    }
    for (const shot of game.bullets) if (!shot.hit && hit(boss, shot)) {
      if (shot.hitBosses?.includes(`${boss.turn}:${boss.call.id}`)) continue
      const armored = boss.call.type === 'edit' && Math.floor(boss.age / 1.4) % 2 === 0
      const sideHit = shot.x < boss.x + 16 || shot.x > boss.x + boss.w - 20
      if (!shot.pierce) shot.hit = true
      else (shot.hitBosses ||= []).push(`${boss.turn}:${boss.call.id}`)
      if (armored && !sideHit && !shot.pierce) { boss.flash = .18; continue }
      boss.hp--
      if (boss.call.type === 'read' && !boss.cargo && boss.hp <= boss.call.hp / 2) {
        boss.cargo = true; m.drops.push({ x: boss.x + 20, y: boss.y + 42, w: 24, h: 24, type: 'dual' })
        m.notice = game.language === 'en' ? 'Cargo released' : '运输机货舱打开 · 补给释放'; m.noticeUntil = game.time + 3
      }
      if (boss.hp <= 0) {
        defeatEscortBoss(game, boss)
        break
      }
    }
    if (!boss.gone && hit(game.player, boss)) damageFlight(game)
  }
  for (const shot of m.shots) {
    shot.y += (shot.speed || 115) * dt; shot.x += shot.vx * dt
    if (hit(game.player, shot)) { shot.hit = true; damageFlight(game) }
    else if (game.flight?.upgrades.move >= 3 && !shot.grazed && hit({ x: game.player.x - 14, y: game.player.y - 14, w: game.player.w + 28, h: game.player.h + 28 }, shot)) {
      shot.grazed = true; game.flight.grazes++; game.score += 5
      if (game.flight.grazes % 5 === 0) m.dual = 8
    }
  }
  for (const drop of m.drops) {
    if (drop.hit) continue
    drop.y += (drop.speed || 90) * dt
    if (drop.type === 'upgrade') {
      drop.ttl -= dt
      if (drop.ttl <= 0) { drop.hit = true; if (game.flight.choice) game.flight.choice.banked = true; continue }
      if (!game.flight.choice || game.flight.choice.id !== drop.choiceId) { drop.hit = true; continue }
      if (hit(game.player, drop)) {
        const id = drop.choiceId
        chooseFlightUpgrade(game, drop.path)
        for (const other of m.drops) if (other.choiceId === id) other.hit = true
      }
      continue
    }
    if (hit(game.player, drop)) {
      drop.hit = true; game.score += 20
      const type = drop.type || 'shield'
      if (type === 'dual') m.dual = 8
      else if (type === 'shield') m.shield = 1
      else {
        m.shots = []; m.bombFlash = .35
        for (const enemy of game.enemies) if (!enemy.hit) {
          enemy.hit = true; game.score += 10
          game.bursts.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, life: .3 })
        }
        for (const boss of m.bosses) if (!boss.gone) { boss.hp -= 6; if (boss.hp <= 0) defeatEscortBoss(game, boss) }
      }
      m.notice = `补给 +20 · ${supplyName(type, false)}${type === 'dual' ? ' 8 秒' : ''}`; m.noticeUntil = game.time + 3
    }
  }
  const hadBosses = m.bosses.length > 0
  m.bosses = m.bosses.filter(boss => !boss.gone)
  if (hadBosses && !m.bosses.length && game.flight) game.flight.waveCooldown = 1.2
  m.shots = m.shots.filter(shot => !shot.hit && shot.y < game.height && shot.x > 0 && shot.x < game.width)
  m.drops = m.drops.filter(drop => !drop.hit && drop.y < game.height)
}
function supplyName(type, en) {
  return ({ dual: en ? 'Twin shot' : '双发', shield: en ? 'Shield' : '护盾', bomb: en ? 'Bomb' : '清屏炸弹' })[type]
}
function defeatEscortBoss(game, boss) {
  if (boss.gone) return
  const m = game.escort
  boss.gone = true; boss.call.defeated = true
  if (boss.turn === m.turn) m.kills++
  game.score += 100
  game.bursts.push({ x: boss.x + 32, y: boss.y + 21, life: .3, points: 100 })
  m.drops.push({ x: boss.x + 32, y: boss.y + 42, w: 12, h: 12 })
}

export function drawEscort(ctx, game, p) {
  const m = game.escort, en = game.language === 'en'
  for (const boss of m.bosses) {
    const { x, y, w, h } = boss
    ctx.fillStyle = boss.call.phase === 'error' ? p.food : p.enemy
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + h); ctx.lineTo(x + w * .62, y + h * .5); ctx.lineTo(x + w, y + h * .35); ctx.lineTo(x + w, y + 4); ctx.lineTo(x + w * .6, y + 12); ctx.lineTo(x + w * .57, y); ctx.lineTo(x + w * .43, y); ctx.lineTo(x + w * .4, y + 12); ctx.lineTo(x, y + 4); ctx.lineTo(x, y + h * .35); ctx.lineTo(x + w * .38, y + h * .5); ctx.closePath(); ctx.fill()
    ctx.fillStyle = p.background
    if (boss.call.type === 'read') ctx.fillRect(x + 24, y + 12, 16, 12)
    else if (boss.call.type === 'edit') { ctx.fillRect(x + 26, y + 10, 12, 4); ctx.fillRect(x + 26, y + 19, 12, 4) }
    else if (boss.call.type === 'command') { ctx.fillRect(x + 7, y + 13, 8, 15); ctx.fillRect(x + 49, y + 13, 8, 15) }
    if (boss.call.type === 'edit') {
      const armored = Math.floor(boss.age / 1.4) % 2 === 0
      ctx.strokeStyle = armored ? p.accent : p.food; ctx.lineWidth = armored ? 4 : 1
      ctx.strokeRect(x + 16, y + 3, w - 32, h - 6)
      ctx.fillStyle = p.food; ctx.fillRect(x + 3, y + 14, 10, 10); ctx.fillRect(x + w - 13, y + 14, 10, 10)
    }
    if (boss.fire > 0 && boss.fire < .8 && y > 20 && boss.call.type !== 'read') {
      ctx.strokeStyle = p.food; ctx.globalAlpha = .3 + Math.sin(boss.age * 18) * .15; ctx.lineWidth = 2
      ctx.beginPath()
      if (boss.call.type === 'command') { const aim = boss.aimX ?? x + 32; ctx.moveTo(aim, y + h); ctx.lineTo(aim, game.height) }
      else { ctx.moveTo(x + 32, y + h); ctx.lineTo(x - 55, y + h + 100); ctx.moveTo(x + 32, y + h); ctx.lineTo(x + 119, y + h + 100) }
      ctx.stroke(); ctx.globalAlpha = 1
    }
    ctx.fillStyle = p.grid; ctx.fillRect(x, y - 6, w, 3)
    ctx.fillStyle = p.accent; ctx.fillRect(x, y - 6, w * Math.max(0, boss.hp / boss.call.hp), 3)
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = p.ink
    ctx.fillText(en ? boss.call.en : boss.call.label, x + 32, y - 12)
    const hint = ({ search: en ? 'Fan burst' : '扇形弹幕', read: en ? 'Cargo inside' : '击中货舱得补给', edit: en ? 'Flank / wait' : '侧翼弱点 / 等转向', command: en ? 'Charged cannon' : '蓄力重炮' })[boss.call.type]
    if (hint) { ctx.fillStyle = p.food; ctx.fillText(hint, x + 32, y + h + 25) }
    const phase = boss.call.phase === 'running' ? '' : boss.call.phase === 'error' ? (en ? 'Failed' : '失败') : (en ? 'Done' : '完成')
    ctx.fillText(`${boss.call.name.slice(0, 16)}${phase ? ` · ${phase}` : ''}`, x + 32, y + h + 13)
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = p.food
  for (const shot of m.shots) ctx.fillRect(shot.x, shot.y, shot.w, shot.h)
  for (const drop of m.drops) {
    if (drop.type === 'upgrade') {
      ctx.fillStyle = p.accent; ctx.fillRect(drop.x - 8, drop.y - 4, drop.w + 16, drop.h + 8)
      ctx.fillStyle = p.background; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(({ fire: 'F', guard: '+', move: '»' })[drop.path], drop.x + 12, drop.y + 17)
      ctx.font = '10px sans-serif'; ctx.fillStyle = p.ink; ctx.fillText(flightUpgradeName(game, drop.path), drop.x + 12, drop.y + 39)
      continue
    }
    ctx.fillStyle = drop.type === 'dual' ? p.accent : p.food
    ctx.fillRect(drop.x, drop.y, drop.w, drop.h)
    ctx.fillStyle = p.background; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(drop.type === 'dual' ? 'Ⅱ' : drop.type === 'bomb' ? 'B' : '+', drop.x + drop.w / 2, drop.y + drop.h / 2 + 5)
    if (drop.type) { ctx.font = '10px sans-serif'; ctx.fillStyle = p.ink; ctx.fillText(supplyName(drop.type, en), drop.x + drop.w / 2, drop.y + drop.h + 12) }
  }
  ctx.textAlign = 'left'
  if (m.bombFlash) { ctx.fillStyle = p.food; ctx.globalAlpha = m.bombFlash / .35 * .3; ctx.fillRect(0, 0, game.width, game.height); ctx.globalAlpha = 1 }
  if (m.shield || m.invincible) { ctx.strokeStyle = p.accent; ctx.beginPath(); ctx.arc(game.player.x + 12, game.player.y + 16, 23, 0, Math.PI * 2); ctx.stroke() }
  if (m.turn === null) return
  ctx.fillStyle = p.background; ctx.globalAlpha = .92; ctx.fillRect(0, 0, game.width, 44); ctx.fillRect(0, game.height - 46, game.width, 46); ctx.globalAlpha = 1
  ctx.font = '11px sans-serif'; ctx.fillStyle = p.ink
  ctx.fillText(`${m.demo ? (en ? 'DEMO' : '演练') : (en ? 'LIVE' : '任务联动')} · ${m.completed}/${m.total} · ${en ? 'Down' : '击落'} ${m.kills}${m.queue.length ? ` · +${m.queue.length}` : ''}`, 10, 19)
  ctx.fillStyle = p.accent; ctx.font = '10px sans-serif'
  ctx.fillText(`Step ${m.stepsSeen ?? 0}${game.flight ? ` · ${en ? 'Wave' : '编队'} ${game.flight.wave} · F${game.flight.upgrades.fire} G${game.flight.upgrades.guard} M${game.flight.upgrades.move}` : ''}${m.shield ? ` · ${supplyName('shield', en)}` : ''}`, 10, 35)
  if (game.flight?.choice) { ctx.fillStyle = p.accent; ctx.fillText(en ? 'Upgrade ready · pick one (1 / 2)' : '二选一升级待领取 · 按 1 / 2 或接胶囊', 10, 59) }
  if (game.flight?.ready > 0) { ctx.fillStyle = p.accent; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(en ? 'READY' : '准备继续', game.width / 2, game.height / 2); ctx.textAlign = 'left' }
  const markers = m.calls.filter(call => call.defeated).slice(-3)
  ctx.font = '10px sans-serif'
  markers.forEach((call, i) => { ctx.fillStyle = call.phase === 'running' ? p.food : call.phase === 'error' ? p.enemy : p.accent; ctx.fillText(`${call.phase === 'running' ? '◌' : call.phase === 'error' ? '!' : '✓'} ${call.name.slice(0, 12)}`, 10 + i * 103, game.height - 29) })
  if (m.noticeUntil > game.time) { ctx.fillStyle = p.ink; ctx.fillText(en ? (m.summary ? 'Task ended' : 'Tool activity updated') : m.notice, 10, game.height - 11) }
  ctx.textAlign = 'left'
}

/** Explicit offline rehearsal using the exact same snapshot-to-game adapter. */
export function demoMission(time) {
  const entries = [
    ['demo-search', 'web_search', 0, 7, false], ['demo-read', 'read_file', 2, 9, false],
    ['demo-edit', 'apply_patch', 8, 16, false], ['demo-test', 'run_tests', 11, 18, true], ['demo-retry', 'run_tests', 19, 27, false],
  ]
  const calls = entries.filter(([, , start]) => time >= start).map(([id, name, start, end, failed]) => ({ id, name, phase: time < end ? 'running' : failed ? 'error' : 'done', seq: time < end ? start + 1 : end + 1 }))
  const steps = [1, 4, 7, 12, 17, 21].filter(at => time >= at).length
  return { turn: 0, seq: Math.floor(time * 20), running: time < 29, total: calls.length, completed: calls.filter(call => call.phase !== 'running').length, failed: calls.filter(call => call.phase === 'error').length, calls, steps }
}

/** A longer plane rehearsal adds a burst of calls and more upgrade opportunities. */
export function demoFlightMission(time) {
  const base = demoMission(Math.min(time, 28))
  const burst = Array.from({ length: 16 }, (_, i) => ({ id: `formation-${i}`, name: ['web_search', 'read_file', 'apply_patch', 'shell_exec'][i % 4], phase: time < 22 + i * .35 ? 'running' : 'done', seq: Math.floor((time < 22 + i * .35 ? 12 : 22 + i * .35) * 20) }))
  const calls = [...base.calls, ...(time >= 12 ? burst : [])].map(call => time >= 29 ? { ...call, phase: call.id === 'demo-test' ? 'error' : 'done' } : call)
  return { ...base, seq: Math.floor(time * 20), running: time < 42, calls, total: calls.length,
    completed: calls.filter(call => call.phase !== 'running').length, failed: calls.filter(call => call.phase === 'error').length,
    steps: [1, 4, 7, 12, 17, 21, 27, 33].filter(at => time >= at).length }
}
