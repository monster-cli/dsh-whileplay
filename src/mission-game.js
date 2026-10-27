/** Tool names select appearance only; never inspect arguments or execute a tool. */
export function toolAircraft(name) {
  const value = name.toLowerCase()
  if (/search|browse|web|fetch/.test(value)) return { type: 'search', label: '搜索轰炸机', en: 'Search bomber', hp: 7 }
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
  m.pendingSupply += Math.max(0, steps - m.stepsSeen)
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
  while (m.running && m.bosses.length < 2 && m.queue.length) {
    const call = m.queue.shift(), slot = m.bosses.some(boss => boss.slot === 0) ? 1 : 0
    m.bosses.push({ call, turn: m.turn, slot, x: slot ? 202 : 38, y: -60, w: 64, h: 42, hp: call.hp, fire: 2, age: 0, speed: 85 })
    m.notice = `${call.label} · ${call.name.slice(0, 24)}`; m.noticeUntil = game.time + 3
  }
  for (const boss of m.bosses) {
    boss.age += dt
    // Once spawned, flight, firing and lifetime belong entirely to the game.
    boss.y += boss.speed * dt
    boss.x = (boss.slot ? 202 : 38) + Math.sin(boss.age * 1.3) * 25
    if (boss.y >= game.height + boss.h) { boss.gone = true; continue }
    boss.fire -= dt
    if (boss.fire <= 0 && boss.y > 20) {
      for (const vx of boss.call.type === 'search' ? [-34, 0, 34] : [0]) m.shots.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h, w: 6, h: 9, vx })
      boss.fire = 2.4
    }
    for (const shot of game.bullets) if (!shot.hit && hit(boss, shot)) {
      shot.hit = true; boss.hp--
      if (boss.hp <= 0) {
        defeatEscortBoss(game, boss)
        break
      }
    }
    if (!boss.gone && hit(game.player, boss)) damage(game)
  }
  for (const shot of m.shots) { shot.y += 115 * dt; shot.x += shot.vx * dt; if (hit(game.player, shot)) { shot.hit = true; damage(game) } }
  for (const drop of m.drops) {
    drop.y += 90 * dt
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
  m.bosses = m.bosses.filter(boss => !boss.gone)
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
function damage(game) {
  const m = game.escort
  if (m.invincible > 0) return
  if (m.shield) { m.shield = 0; m.invincible = 1.5 }
  else game.over = true
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
    ctx.fillStyle = p.grid; ctx.fillRect(x, y - 6, w, 3)
    ctx.fillStyle = p.accent; ctx.fillRect(x, y - 6, w * Math.max(0, boss.hp / boss.call.hp), 3)
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = p.ink
    ctx.fillText(en ? boss.call.en : boss.call.label, x + 32, y - 12)
    const phase = boss.call.phase === 'running' ? '' : boss.call.phase === 'error' ? (en ? 'Failed' : '失败') : (en ? 'Done' : '完成')
    ctx.fillText(`${boss.call.name.slice(0, 16)}${phase ? ` · ${phase}` : ''}`, x + 32, y + h + 13)
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = p.food
  for (const shot of m.shots) ctx.fillRect(shot.x, shot.y, shot.w, shot.h)
  for (const drop of m.drops) {
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
  ctx.fillText(`Step ${m.stepsSeen ?? 0}${m.dual > 0 ? ` · ${supplyName('dual', en)} ${Math.ceil(m.dual)}s` : ''}${m.shield ? ` · ${supplyName('shield', en)}` : ''}${m.pendingSupply ? ` · ${en ? 'Supplies' : '补给待入场'} +${m.pendingSupply}` : ''}`, 10, 35)
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
