import { ESCORT_ROUTE_NODES, escortRouteStage } from './escort-terrain.js'

const ESCORT_TOOL_CALLS = [
  { start: .6, end: 2, name: 'web_search', text: '检索交互参考 · 完成后投放火力补给' },
  { start: 4.2, end: 6, name: 'read_file', text: '读取项目资料 · 完成后投放护盾补给' },
  { start: 8.2, end: 10, name: 'write_file', text: '写入网页文件 · 完成后获得工程修复' },
  { start: 19, end: 21, name: 'apply_patch', text: '修改计时逻辑 · 完成后投放火力补给' },
  { start: 40, end: 42, name: 'shell_exec', text: '执行构建检查 · 完成后获得空袭支援' },
]

export function escortTaskView(g) {
  const stage = escortRouteStage(g)
  if (g.mode === 'live') {
    const live = g.live || {}, todos = Array.isArray(live.todos) ? live.todos : []
    return {
      title: live.title || live.request || '当前会话', stage,
      todo: todos[stage]?.content || (live.running ? '等待任务规划 · 正在护航' : '等待当前会话继续'),
      total: todos.length, completed: todos.filter(todo => todo.status === 'completed').length,
      status: todos[stage]?.status,
      call: live.call || null,
      event: [...g.log].reverse().find(row => ['工具', '子 Agent', 'Todo', '交付物', '会话'].includes(row.source)),
      agents: (live.agents || []).filter(agent => agent.status === 'completed').slice(0, 2).map(agent => ({ ...agent, joined: true })),
      cargo: (live.cargo || []).slice(0, 24),
    }
  }
  const call = ESCORT_TOOL_CALLS.find(c => g.time >= c.start && g.time < c.end)
  const event = [...g.log].reverse().find(row => ['工具', '子 Agent', 'Todo', '交付物'].includes(row.source))
  return {
    title: '番茄钟小站', stage, todo: ESCORT_ROUTE_NODES[stage].task, total: 4,
    completed: g.todos.filter(status => status === '已完成').length,
    status: g.todos[stage],
    call: call ? { ...call, name: call.name === 'shell_exec' && g.decision === 'reject' ? '替代检查' : call.name } : null,
    event,
    agents: [{ name: '界面 Agent', joined: g.wings >= 1 }, { name: '逻辑 Agent', joined: g.wings >= 2 }],
    cargo: g.cargo.slice(0, 2),
  }
}

const taskText = (value, limit) => {
  const text = Array.from(String(value || '').replace(/\s+/g, ' ').trim())
  return text.length > limit ? text.slice(0, limit - 1).join('') + '…' : text.join('')
}

function taskPlate(ctx, x, y, w, h, accent = '#8fc5d1') {
  ctx.fillStyle = 'rgba(6, 20, 31, .91)'; ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(153, 192, 198, .23)'; ctx.lineWidth = .8; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1)
  ctx.fillStyle = accent; ctx.fillRect(x, y, 2, h)
}

export function drawEscortSupply(ctx, g, d) {
  const salvage = d.type === 'salvage'
  if (salvage) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(g.time * .45)
    ctx.fillStyle = '#99c8c9'; ctx.strokeStyle = '#d8e6d8'; ctx.lineWidth = .8
    ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8)
    ctx.fillStyle = '#578289'; ctx.fillRect(-2, -2, 4, 4); ctx.restore(); return
  }
  ctx.save(); ctx.translate(d.x, d.y)
  const age = Number.isFinite(d.born) ? g.time - d.born : 3
  if (age < 3) {
    const sway = Math.sin(g.time * 2) * 3
    ctx.fillStyle = '#c3c6b1'; ctx.beginPath(); ctx.arc(sway, -29, 22, Math.PI, Math.PI * 2); ctx.quadraticCurveTo(sway + 10, -33, sway, -29); ctx.quadraticCurveTo(sway - 10, -33, sway - 22, -29); ctx.fill()
    ctx.strokeStyle = '#8caaa6'; ctx.lineWidth = .8
    for (const dx of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(sway + dx, -29); ctx.lineTo(dx * .35, -10); ctx.stroke() }
  }
  ctx.fillStyle = 'rgba(0, 8, 16, .32)'; ctx.beginPath(); ctx.ellipse(4, 15, 18, 7, 0, 0, Math.PI * 2); ctx.fill()
  const crate = ctx.createLinearGradient(-13, -13, 13, 13); crate.addColorStop(0, '#b7a581'); crate.addColorStop(1, '#5d665a')
  ctx.fillStyle = crate; ctx.fillRect(-12, -10, 24, 22)
  ctx.strokeStyle = '#c7c7a8'; ctx.lineWidth = 1; ctx.strokeRect(-12, -10, 24, 22)
  ctx.fillStyle = '#344e53'; ctx.fillRect(-3, -10, 6, 22)
  ctx.fillStyle = '#e5dcaf'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.type === 'boost' ? 'Ⅱ' : '+', 0, 7)
  ctx.restore()
  const x = Math.max(10, Math.min(326, d.x - 72)), y = Math.min(608, d.y + 22)
  taskPlate(ctx, x, y, 144, d.source ? 39 : 24, '#c6b47f')
  ctx.textAlign = 'left'; ctx.font = 'bold 12px ui-monospace, monospace'; ctx.fillStyle = '#e1ddc7'
  ctx.fillText(taskText(d.source || '战利品补给', 18), x + 9, y + 15)
  if (d.source) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#b5c9c9'; ctx.fillText(d.type === 'boost' ? '已返回 → 三发火力' : '已返回 → 船体护盾', x + 9, y + 30) }
}

export function drawEscortTaskWorld(ctx, g) {
  const view = escortTaskView(g), c = g.convoy, live = g.mode === 'live'
  ctx.save()
  // The manifest belongs to the actual freighter, not the surrounding UI.
  const x = 282, y = Math.max(150, Math.min(561, c.y - 16))
  ctx.strokeStyle = '#78969c'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(c.x + 23, c.y); ctx.lineTo(x, y + 13); ctx.stroke()
  const manifest = view.cargo.slice(0, 2)
  const h = manifest.length ? 44 + manifest.length * 15 : 44
  taskPlate(ctx, x, y, 181, h, '#9dbca6')
  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#d7e2d7'; ctx.fillText('交付物运输船', x + 10, y + 16)
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#9fb7ba'; ctx.fillText(view.cargo.length ? `${view.cargo.length}${live ? '' : '/2'} 件已装船 · 护送入港` : live ? '等待会话提交交付文件' : '等待装船 · 网页与使用说明', x + 10, y + 32)
  ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#d0d6b7'
  manifest.forEach((name, i) => ctx.fillText(`✓ ${taskText(name, 23)}`, x + 10, y + 48 + i * 15))
  const leftLabel = Math.max(8, Math.min(266, g.player.x - 154))
  for (let i = 0; i < Math.min(g.wings, view.agents.length); i++) {
    const wingX = g.player.x + (i ? 38 : -38), wingY = g.player.y + 28
    const labelX = i ? Math.max(leftLabel + 110, Math.min(370, wingX + 16)) : leftLabel
    const labelY = Math.max(115, Math.min(625, wingY - 18))
    ctx.strokeStyle = '#829b9b'; ctx.beginPath(); ctx.moveTo(wingX, wingY); ctx.lineTo(labelX + (i ? 0 : 102), labelY + 13); ctx.stroke()
    taskPlate(ctx, labelX, labelY, 102, 30, i ? '#aeb69b' : '#88b9c8')
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#d7e3df'; ctx.fillText(taskText(view.agents[i].name, 11), labelX + 8, labelY + 13)
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#91b4ba'; ctx.fillText('子任务完成 · 协同射击', labelX + 8, labelY + 25)
  }
  ctx.restore()
}

export function drawEscortTaskHUD(ctx, g) {
  const view = escortTaskView(g), live = g.mode === 'live'
  ctx.save()
  const shade = ctx.createLinearGradient(0, 0, 0, 100); shade.addColorStop(0, '#0c1c29'); shade.addColorStop(1, 'rgba(9, 27, 39, .94)')
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 480, 100)
  ctx.textAlign = 'left'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#8caab8'; ctx.fillText(live ? `当前任务  /  ${taskText(view.title, 27)}` : '联动演练  /  构建番茄钟小站', 16, 18)
  ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#e2e7de'; ctx.fillText(taskText(`${view.total ? `${view.stage + 1}. ` : ''}${view.todo}`, 21), 16, 42)
  ctx.textAlign = 'right'; ctx.fillStyle = '#a4c6c7'; ctx.font = '11px sans-serif'; ctx.fillText(view.total ? `${view.completed}/${view.total} Todo 完成` : '暂无 Todo', 464, 18)
  ctx.font = 'bold 18px ui-monospace, monospace'; ctx.fillStyle = '#decba0'; ctx.fillText(String(g.score).padStart(6, '0'), 464, 43)
  if (view.total) for (let i = 0; i < view.total; i++) {
    const done = live ? g.live.todos[i].status === 'completed' : g.todos[i] === '已完成'
    const width = 448 / view.total
    ctx.fillStyle = done ? '#8eae97' : i === view.stage ? '#7caebb' : '#284451'; ctx.fillRect(16 + i * width, 53, Math.max(1, width - Math.min(8, width * .1)), 3)
  }
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#b5c8ce'
  ctx.fillText(`战机 ${g.player.hp}/5`, 16, 78); ctx.fillText(`运输船 ${Math.ceil(g.convoy.hp)}%`, 100, 78); ctx.fillText(`火力 Lv.${g.level}`, 226, 78)
  ctx.textAlign = 'right'; ctx.fillStyle = '#d4c094'; ctx.fillText(g.combo > 1 ? `${g.combo} 连击 ×${Math.min(4, 1 + Math.floor(g.combo / 5))}` : `击落 ${g.kills}`, 464, 78)
  ctx.fillStyle = '#263f4b'; ctx.fillRect(16, 86, 72, 3); ctx.fillStyle = '#a6bfad'; ctx.fillRect(16, 86, 72 * g.player.hp / 5, 3)
  ctx.fillStyle = '#263f4b'; ctx.fillRect(100, 86, 104, 3); ctx.fillStyle = g.convoy.hp > 30 ? '#84b8ba' : '#d48a76'; ctx.fillRect(100, 86, 104 * g.convoy.hp / 100, 3)
  const boss = g.enemies.find(e => e.boss)
  if (boss) {
    taskPlate(ctx, 105, 108, 270, 29, '#c98773'); ctx.textAlign = 'center'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#d9a08a'; ctx.fillText('重装旗舰拦截 · 红线锁定后冲刺', 240, 122)
    ctx.fillStyle = '#463e40'; ctx.fillRect(116, 129, 248, 3); ctx.fillStyle = '#c98773'; ctx.fillRect(116, 129, 248 * boss.hp / boss.maxHP, 3)
  }
  if (g.phase === 'playing') {
    const event = view.event, call = view.call
    const title = call ? `工具调用 · ${call.name}` : event ? `${event.source} · 任务广播` : live ? `当前会话 · ${view.title}` : '任务开始 · 护送番茄钟小站'
    const detail = call ? call.text : event?.text || (live ? '等待当前会话的新事件，战场独立运行' : 'Todo 推进航程，工具投放补给，子 Agent 加入护航')
    taskPlate(ctx, 12, 660, 456, 49, call ? '#bbab7f' : '#739eab')
    ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#d4dfd8'; ctx.fillText(taskText(title, 36), 23, 678)
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#9ebac1'; ctx.fillText(taskText(detail, 37), 23, 697)
    if (call) { ctx.fillStyle = '#bcae84'; ctx.fillRect(442, 671, 3, 3); ctx.fillRect(449, 671, 3, 3) }
  }
  ctx.restore()
}
