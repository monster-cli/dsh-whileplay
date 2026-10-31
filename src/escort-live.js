const escortText = (value, max = 120) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
const escortTodoStatus = { pending: '待处理', in_progress: '进行中', completed: '已完成' }

/** Read only the current session's public projections; absent data stays absent. */
export function escortLiveView({ sessionId, title, detail, todos, catalog, summaries, statuses, status, observedAgents = [] }) {
  const agents = (Array.isArray(catalog) ? catalog : []).filter(row => row && typeof row.id === 'string' && Number.isFinite(detail?.turnStartedAt) && (row.createdAt >= detail.turnStartedAt || summaries?.[row.id]?.projectionValues?.subagentTiming?.active?.since >= detail.turnStartedAt || observedAgents.includes(row.id))).slice(-64).map(row => {
    const summary = summaries?.[row.id], child = statuses?.get(row.id)
    const running = child?.running ?? summary?.running
    const completed = row.mode !== 'external' && running === false && summary?.projectionValues?.subagentTiming?.lastTurnCompleted === true
    return { id: row.id, name: escortText(row.label, 48) || '子 Agent', status: running === true ? 'running' : completed ? 'completed' : running === false ? 'idle' : 'unknown' }
  })
  return {
    available: !!sessionId && detail !== undefined,
    title: escortText(detail?.request) || escortText(title) || (sessionId ? '当前会话' : '尚未选择会话'),
    request: escortText(detail?.request), sessionTitle: escortText(title),
    todos: (Array.isArray(todos) ? todos : []).filter(row => row && escortTodoStatus[row.status] && typeof row.content === 'string').slice(0, 64).map(row => ({ content: escortText(row.content, 160), status: row.status })),
    agents, cargo: (Array.isArray(detail?.cargo) ? detail.cargo : []).map(name => escortText(name, 80)).filter(Boolean).slice(0, 24),
    running: status?.running === true, endReason: detail?.endReason || null,
    turn: Number.isSafeInteger(detail?.turn) ? detail.turn : -1, call: null,
  }
}

/** Sync metadata while paused too. Only newly observed events create gameplay effects. */
export function syncEscortLive(g, view, mission, baseline = false) {
  if (g.mode !== 'live') return
  g.live = view
  g.todos = view.todos.map(row => escortTodoStatus[row.status])
  g.agents = view.agents.map(row => row.status)
  g.wings = Math.min(2, view.agents.filter(row => row.status === 'completed').length)
  g.cargo = view.cargo.slice()
  const log = (source, text) => { g.log.push({ source, text, time: g.time }); g.log = g.log.slice(-20) }
  if (!mission || !Number.isSafeInteger(mission.turn)) return
  const call = [...(mission.calls || [])].reverse().find(row => row.phase === 'running')
  g.live = { ...view, call: call ? { name: escortText(call.name, 40), text: '工具正在执行 · 返回后投放补给' } : null }
  const cursor = g.liveCursor
  const ids = (mission.calls || []).map(row => String(row.id ?? row.seq))
  const known = cursor?.turn === mission.turn ? cursor.calls || [] : []
  const spawn = row => {
    const id = `${mission.turn}:${row.id ?? row.seq}`
    if (g.enemies.some(e => e.callId === id)) return
    if (g.enemies.filter(e => e.tool).length < 3) g.enemies.push({ x: 100 + (row.seq % 3) * 140, y: -30, hp: 8, maxHP: 8, heavy: true, kind: 'gunner', fire: 2.4, speed: 34, age: 0, hit: 0, tool: escortText(row.name, 40), callId: id })
    log('工具', `${escortText(row.name, 40)} 调用 · 拦截机进入战场`)
  }
  const fresh = baseline || !cursor || cursor.turn !== mission.turn
  if (fresh) {
    g.liveCursor = { turn: mission.turn, seq: mission.seq, steps: mission.steps || 0, calls: ids }
    g.log = []
    if (cursor && g.phase === 'playing') g.phase = 'paused'
    log('任务', view.running ? '已连接当前会话 · 等待新任务事件' : '当前会话未在运行 · 可自由护航或体验联动演练')
    for (const row of (mission.calls || []).filter(row => row.phase === 'running' && !known.includes(String(row.id ?? row.seq))).slice(-3)) spawn(row)
    return
  }
  if (mission.seq <= cursor.seq) return
  const updates = (mission.calls || []).filter(row => row.seq > cursor.seq)
  const successful = updates.filter(row => row.phase === 'done')
  for (const [i, row] of successful.slice(-2).entries()) {
    if (g.drops.filter(d => d.source).length < 6) g.drops.push({ x: 170 + i * 130, y: 200, type: 'boost', ttl: 16, source: escortText(row.name, 40), born: g.time })
    log('工具', `${escortText(row.name, 40)} 返回 · 火力补给已投放`)
  }
  for (const row of updates.filter(row => !known.includes(String(row.id ?? row.seq))).slice(-3)) spawn(row)
  for (const row of updates.filter(row => row.phase === 'error').slice(-2)) log('工具', `${escortText(row.name, 40)} 执行异常 · 以会话结果为准`)
  if ((mission.steps || 0) > cursor.steps && g.drops.filter(d => d.source).length < 6) g.drops.push({ x: 240, y: 260, type: 'shield', ttl: 16, source: 'Step 完成', born: g.time })
  if (!mission.running && g.phase === 'playing') {
    g.phase = 'paused'
    log('任务', '本轮任务已停止 · 战场暂停，请查看会话结果')
  }
  g.liveCursor = { turn: mission.turn, seq: mission.seq, steps: mission.steps || 0, calls: ids }
}

/** Keep task wording and filenames in memory, not the game's local checkpoint. */
export function saveEscortAction(g) {
  return JSON.stringify(g.mode === 'live' ? { ...g, live: undefined, todos: [], agents: [], cargo: [], log: [] } : g)
}
