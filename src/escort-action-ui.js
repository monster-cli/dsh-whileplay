function Expedition(props) {
  const { useState, useRef } = React
  const { useProjection, useSessions, useSessionStatus, sessionId } = props
  const [mode, setMode] = useState('live')
  const detail = useProjection('whileplayExpedition'), mission = useProjection('whileplayMission')
  const title = useProjection('title'), todos = useProjection('todos'), catalog = useProjection('subagentCatalog')
  const summaries = useSessions(s => s.byId), statuses = useSessionStatus(s => s)
  const observed = useRef({ turn: -1, ids: [] })
  const liveView = escortLiveView({ sessionId, title, detail, todos, catalog, summaries, statuses, status: statuses?.get(sessionId), observedAgents: observed.current.turn === detail?.turn ? observed.current.ids : [] })
  observed.current = { turn: detail?.turn, ids: liveView.agents.map(row => row.id) }
  return h(EscortBattle, { ...props, key: `${sessionId}:${mode}`, mode, setMode, liveView, mission })
}

function EscortBattle({ sessionId, frame, panelRef, onMove, gestureProps, onClose, useSessionStatus, mode, setMode, liveView, mission }) {
  const { useRef, useState, useEffect } = React
  const status = useSessionStatus(snapshot => snapshot.get(sessionId)), blocked = !!status?.pendingInteraction || status?.running === undefined
  const live = mode === 'live'
  const key = `${live ? 'dsh-whileplay.escort-live.v1' : 'dsh-whileplay.escort-action.v2'}:${sessionId || 'draft'}`
  const game = useRef(null), canvasRef = useRef(null), input = useRef({ keys: new Set(), pointer: false, x: 240, y: 625 })
  if (!game.current) { try { game.current = restoreEscortAction(localStorage.getItem(key)) } catch {} if (game.current?.mode !== mode) game.current = null; game.current ||= createEscortAction(mode); if (live) syncEscortLive(game.current, liveView, mission, true) }
  const [active, setActive] = useState(false), [, redraw] = useState(0), [saveFailed, setSaveFailed] = useState(false), [confirmRestart, setConfirmRestart] = useState(false)
  const record = useRef(0)
  if (!record.current) { try { const n = Number(localStorage.getItem('dsh-whileplay.escort-record.v1')); if (Number.isFinite(n) && n > 0 && n < 1e7) record.current = n } catch {} }
  const clear = () => { input.current.keys.clear(); input.current.pointer = false }
  const save = () => { try { localStorage.setItem(key, saveEscortAction(game.current)); if (['complete', 'over'].includes(game.current.phase) && game.current.score > record.current) { record.current = game.current.score; localStorage.setItem('dsh-whileplay.escort-record.v1', String(record.current)) } } catch { setSaveFailed(true) } }
  const paint = () => { if (canvasRef.current) drawEscortAction(canvasRef.current.getContext('2d'), game.current, { ...canvasPalette(canvasRef.current), reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }) }
  const pause = () => { clear(); if (game.current.phase === 'playing') game.current.phase = 'paused'; setActive(false); save(); redraw(n => n + 1); paint() }
  const start = () => {
    if (blocked || ['complete', 'over', 'attention'].includes(game.current.phase)) return
    game.current.phase = 'playing'; game.current.player.grace = Math.max(1.5, game.current.player.grace)
    clear(); setActive(true); redraw(n => n + 1); canvasRef.current?.focus()
  }
  const skill = kind => { if (!blocked && actionSupport(game.current, kind)) { save(); redraw(n => n + 1); paint(); canvasRef.current?.focus() } }
  const wasRunning = useRef(status?.running)
  useEffect(() => {
    if (!live) return
    syncEscortLive(game.current, liveView, mission)
    if ((wasRunning.current === true && status?.running === false) || game.current.phase !== 'playing') setActive(false)
    if (wasRunning.current === true && status?.running === false && game.current.phase === 'playing') game.current.phase = 'paused'
    wasRunning.current = status?.running
    save(); redraw(n => n + 1); paint()
  }, [liveView, mission, status?.running])
  useEffect(() => { if (blocked) pause() }, [blocked])
  useEffect(() => {
    const blur = () => pause(), hidden = () => { if (document.hidden) pause() }
    window.addEventListener('blur', blur); window.addEventListener('pagehide', blur); document.addEventListener('visibilitychange', hidden)
    return () => { clear(); save(); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', blur); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  useEffect(() => {
    paint()
    const observer = new MutationObserver(paint); observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'style'] })
    if (!active) return () => observer.disconnect()
    let raf, last, lastHUD = -1, lastSave = -1, disposed = false
    const tick = now => {
      if (disposed) return
      if (last !== undefined) stepEscortAction(game.current, input.current, (now - last) / 1000)
      last = now; paint()
      if (Math.floor(game.current.time * 5) !== lastHUD) { lastHUD = Math.floor(game.current.time * 5); redraw(n => n + 1) }
      if (Math.floor(game.current.time) !== lastSave) { lastSave = Math.floor(game.current.time); save() }
      if (game.current.phase !== 'playing') { setActive(false); save(); redraw(n => n + 1); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect() }
  }, [active])
  const g = game.current
  const todoRows = live ? (g.live?.todos || []) : ESCORT_ROUTE_NODES.map((row, i) => ({ content: row.task, status: g.todos[i] === '已完成' ? 'completed' : g.todos[i] === '进行中' ? 'in_progress' : 'pending' }))
  const agentRows = live ? (g.live?.agents || []) : ['界面设计队', '计时逻辑队'].map((name, i) => ({ id: `demo-agent-${i}`, name, status: g.agents[i] === '已归航' ? 'completed' : 'running' }))
  const switchMode = next => { pause(); setMode(next) }
  const move = (event, edge) => { if (edge || !event.target.closest('button')) pause(); onMove(event, edge) }
  const pointer = event => { const b = event.currentTarget.getBoundingClientRect(); input.current.x = (event.clientX - b.left) / b.width * 480; input.current.y = (event.clientY - b.top) / b.height * 720 }
  const keyDown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const movement = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']
    if (![...movement, 'KeyQ', 'KeyE', 'Space', 'Escape'].includes(event.code)) return
    event.preventDefault(); event.stopPropagation()
    if (event.code === 'Escape') { pause(); return }
    if (!active || blocked) return
    if (event.code === 'KeyQ' && !event.repeat) skill('repair')
    else if (event.code === 'KeyE' && !event.repeat) skill('strike')
    else if (event.code === 'Space' && !event.repeat) skill('dash')
    else if (movement.includes(event.code)) input.current.keys.add(event.code)
  }
  const decide = decision => { if (blocked || g.phase !== 'attention') return; g.decision = decision; g.phase = 'paused'; g.notice = '模拟交互已处理 · 点击继续护航返回战场'; g.noticeUntil = g.time + 5; save(); redraw(n => n + 1); paint() }
  const pad = (code, label) => h('button', { type: 'button', disabled: !active || blocked, 'aria-label': label,
    onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current.keys.add(code) },
    onPointerUp: () => input.current.keys.delete(code), onPointerCancel: () => input.current.keys.delete(code), onLostPointerCapture: () => input.current.keys.delete(code) }, label)
  return h('section', { ref: panelRef, className: 'arcade-panel exp-action-panel', 'aria-label': '小队护送远征', style: { left: frame.x, top: frame.y, width: frame.width, height: frame.height, '--exp-play-height': `${Math.max(270, frame.height - 280)}px` }, onBlur: e => { if (!e.currentTarget.contains(e.relatedTarget)) pause() } },
    h('header', { className: 'arcade-header exp-header', onPointerDown: e => move(e), ...gestureProps }, h('span', { className: 'exp-logo', 'aria-hidden': true }, '⌁'), h('div', { className: 'arcade-heading' }, h('h2', null, '小队护送远征'), h('p', null, 'Todo 航程 · 工具补给 · Agent 编队 · 成果交付')),
      h('button', { type: 'button', onClick: active ? pause : start, disabled: blocked || ['attention', 'complete', 'over'].includes(g.phase) }, active ? '暂停护航' : '继续护航'), h('button', { type: 'button', onClick: () => { pause(); setConfirmRestart(true) } }, live ? '重新护航' : '重新演练'), h('button', { type: 'button', onClick: () => { pause(); onClose() }, 'aria-label': '返回游戏库' }, '×')),
    h('div', { className: 'exp-simulation' }, h('div', { className: 'exp-modes', role: 'group', 'aria-label': '任务来源' }, h('button', { type: 'button', 'aria-pressed': live, onClick: () => { if (!live) switchMode('live') } }, '当前会话'), h('button', { type: 'button', 'aria-pressed': !live, onClick: () => { if (live) switchMode('demo') } }, '联动演练')), h('span', null, live ? !sessionId ? '选择会话后连接任务' : !liveView.available ? '正在连接会话数据' : status?.running ? '真实任务执行中' : '当前会话未在运行' : '示例任务 · 本地模拟')),
    h('div', { className: 'exp-action-body' }, h('main', { className: 'exp-action-main' },
      h('div', { className: 'exp-action-stage' }, h('canvas', { ref: canvasRef, width: 480, height: 720, tabIndex: 0, 'aria-label': '实时护航战场', onKeyDown: keyDown, onKeyUp: e => input.current.keys.delete(e.code), onBlur: clear,
        onPointerDown: e => { e.currentTarget.focus(); if (active) { e.currentTarget.setPointerCapture(e.pointerId); input.current.pointer = true; pointer(e) } }, onPointerMove: e => { if (input.current.pointer) pointer(e) }, onPointerUp: () => { input.current.pointer = false }, onPointerCancel: () => { input.current.pointer = false }, onLostPointerCapture: () => { input.current.pointer = false } }),
        (!active || blocked) && h('div', { className: 'exp-action-curtain' }, h('h3', null, blocked ? '真实会话需要处理' : ({ ready: '破浪出航', paused: '战场已暂停', attention: '模拟任务需要你查看', complete: '成果已入港 · 护航完成', over: '护航失利' })[g.phase] || '战场已暂停'),
          h('p', null, blocked ? '先处理真实会话，再手动继续。' : g.phase === 'ready' ? live ? '护航当前会话：Todo 成为航程节点，工具调用带来拦截机和补给，完成任务的 Agent 加入编队，已交付文件装船。没有任务运行时也可以自由练习。' : '护送番茄钟小站的网页与使用说明。穿过四个 Todo 航段，接住工具补给，与归航的 Agent 并肩作战。' : g.phase === 'attention' ? '模拟构建检查请求。战场冻结，两种决定奖励相同，不执行真实命令。' : g.phase === 'complete' ? `${g.convoy.hp >= 80 && g.bossKills >= 2 ? 'S · 王牌护航' : g.convoy.hp >= 50 ? 'A · 坚实护卫' : 'B · 突围归航'}｜得分 ${g.score} · 最高连击 ${g.bestCombo} · 旗舰 ${g.bossKills}/2。两件成果已入港（模拟）。` : g.phase === 'over' ? `本次得分 ${g.score} · 最高连击 ${g.bestCombo}。拾取蓝色能量提升火力，红线锁定后用空格冲刺，运输船受损时按 Q。` : live ? '战场已冻结；任务信息继续同步。任务是否完成，以会话结果为准。' : '演练、敌机、子弹与补给都已冻结。'),
          g.phase === 'attention' ? h('div', { className: 'exp-action-line' }, h('button', { type: 'button', disabled: blocked, onClick: () => decide('allow') }, '模拟允许'), h('button', { type: 'button', disabled: blocked, onClick: () => decide('reject') }, '模拟拒绝')) : ['ready', 'paused'].includes(g.phase) ? h('button', { type: 'button', className: 'exp-primary', disabled: blocked, onClick: start }, g.phase === 'ready' ? live ? '开始任务护航' : '开始实时演练' : '继续护航') : h('button', { type: 'button', onClick: () => setConfirmRestart(true) }, '再护航一次'))),
      h('div', { className: 'exp-action-skills' }, h('button', { type: 'button', className: 'exp-dash', disabled: !active || blocked || g.dashCooldown > 0, onClick: () => skill('dash') }, g.dashCooldown > 0 ? `冲刺 · ${g.dashCooldown.toFixed(1)}s` : '空格 · 闪避冲刺'), h('button', { type: 'button', disabled: !active || blocked || !g.repair, onClick: () => skill('repair') }, `Q · 工程修复 ×${g.repair}`), h('button', { type: 'button', disabled: !active || blocked || !g.strike, onClick: () => skill('strike') }, `E · 空袭支援 ×${g.strike}`), h('div', { className: 'exp-action-pad' }, pad('ArrowLeft', '←'), pad('ArrowUp', '↑'), pad('ArrowDown', '↓'), pad('ArrowRight', '→'))), h('p', { className: 'exp-action-help' }, 'WASD / 方向键移动 · 自动锁敌 · 空格冲刺 · Q 修复 · E 空袭 · 蓝色能量升级火力')),
      h('aside', { className: 'exp-action-sidebar' }, h('small', { className: 'exp-eyebrow' }, live ? '任务简报 · 当前会话' : '任务简报 · 联动演练'), h('h3', { className: 'exp-mission-title' }, live ? liveView.title : '番茄钟小站'), h('p', { className: 'exp-mission-goal' }, live ? liveView.sessionTitle && liveView.sessionTitle !== liveView.title ? `会话：${liveView.sessionTitle}` : '跟随当前会话事件实时更新' : '交付网页与使用说明'), h('h4', null, 'TODO / 航程'), ...todoRows.map((row, i) => h('div', { className: 'exp-action-todo', key: i, 'data-status': escortTodoStatus[row.status] }, h('span', null, row.status === 'completed' ? '✓' : `${i + 1}`), h('div', null, row.content, h('small', null, live ? escortTodoStatus[row.status] : `${ESCORT_ROUTE_NODES[i].name} · ${escortTodoStatus[row.status]}`)))), !todoRows.length && h('p', { className: 'exp-muted' }, '当前任务尚未提供 Todo'),
        h('h4', null, 'AGENTS / 护航编队'), ...agentRows.map(row => h('p', { className: 'exp-action-agent', key: row.id }, row.name, h('small', null, ({ running: '执行中', completed: '子任务完成 · 可提供僚机支援', idle: '已停止 · 未确认完成', unknown: '状态暂不可用' })[row.status]))), !agentRows.length && h('p', { className: 'exp-muted' }, '当前任务暂无子 Agent'), h('h4', null, '任务电台'), live && g.live?.call && h('div', { className: 'exp-action-event' }, h('small', null, '工具执行中'), h('p', null, g.live.call.name)), ...g.log.slice(-3).reverse().map((row, i) => h('div', { className: 'exp-action-event', key: `${g.log.length}-${i}` }, h('small', null, row.source), h('p', null, row.text))), !g.log.length && h('p', { className: 'exp-muted' }, live ? '等待当前会话的新事件' : '开始后，工具补给与支援队按时间进入战场。'), h('div', { className: 'exp-action-cargo' }, h('h4', null, '已装船 / 交付物'), ...g.cargo.map((name, i) => h('p', { key: i }, `✓ ${name}`)), !g.cargo.length && h('p', { className: 'exp-muted' }, live ? '尚未收到交付文件' : '等待网页与使用说明')))),
    h('footer', { className: 'exp-footer', role: 'status' }, h('span', null, `${live ? `护航 ${Math.floor(g.time)} 秒` : `演练 ${Math.floor(g.time)} / 62 秒`} · ${active ? '实时战斗中' : '已暂停'}`), h('span', null, saveFailed ? '存储不可用' : `最佳 ${record.current.toLocaleString()} · 自动保存`)),
    confirmRestart && h('div', { className: 'exp-modal-backdrop' }, h('div', { className: 'exp-modal', role: 'dialog', 'aria-modal': true, 'aria-label': live ? '重新护航' : '重新演练' }, h('h3', null, '从头开始实时护航？'), h('p', null, '覆盖当前模式的远征存档。任务本身和其他游戏不受影响。'), h('div', { className: 'exp-action-line' }, h('button', { type: 'button', onClick: () => setConfirmRestart(false) }, '取消'), h('button', { type: 'button', className: 'exp-primary', onClick: () => { game.current = createEscortAction(mode); if (live) syncEscortLive(game.current, liveView, mission); save(); setConfirmRestart(false); redraw(n => n + 1); paint() } }, '确认重开')))),
    ...['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map(edge => h('div', { key: edge, className: `arcade-resize-handle arcade-resize-${edge}`, onPointerDown: e => move(e, edge), ...gestureProps })))
}
