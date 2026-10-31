const React = require('react')
const h = React.createElement
const { useEffect, useRef, useState } = React
const NS = 'whileplay'
const dictionaries = {
  zh: {
    title: '玩一小局', subtitle: '让等待变成一小局', open: '玩一小局', close: '收起',
    plane: '飞机大战', tank: '坦克大战', snake: '贪吃蛇', start: '开始游戏', resume: '继续', pause: '暂停', restart: '重新开始',
    score: '得分', best: '最高分', paused: '已暂停', over: '本局结束', idle: '随时开始，随时停下',
    working: 'AI 正在工作 · 可以玩一小局', ready: 'AI 已结束运行 · 游戏已暂停，请查看回复',
    attention: 'AI 需要你的操作 · 游戏已暂停', unavailable: '会话状态暂不可用 · 游戏已暂停', switched: '已切换会话 · 游戏已暂停',
    focus: '离开游戏后已暂停', planeHint: '方向键或拖动移动，自动射击。Step 带来补给与升级；接住升级胶囊，或按 1 / 2 选择火力、生存、机动路线。',
    snakeHint: '方向键转向，避开边界和自己。工具带来限时果实；Step 补给提供双倍、护盾或减速。', tankHint: '方向键移动，空格射击。工具生成三血精英坦克；Step 补给提供连发、护盾或炸弹。',
    canvas: '游戏画布，点击后可用键盘操作', up: '上', down: '下', left: '左', right: '右', fire: '发射',
    saveError: '浏览器存储不可用，纪录和存档可能无法保存。', resetHint: '飞机大战按会话保存；切换游戏或刷新后，可继续这一局。',
    restored: '已恢复飞机存档 · 点击继续', upgradeChoice: '二选一升级', firePath: '火力', guardPath: '生存', movePath: '机动', savedRound: '本局已保存，可先返回会话',
    library: '游戏库', count: '{count} 款游戏', search: '搜索游戏', all: '全部', flight: '飞行', action: '动作', puzzle: '益智',
    noResults: '没有找到游戏，试试其他关键词。', portrait: '竖屏', landscape: '横屏',
    planeDescription: '自动开火，迎战敌机', tankDescription: '穿越砖墙，守卫基地', snakeDescription: '再吃一颗，就一颗',
    square: '方形', lives: '生命', base: '基地', intact: '完好', destroyed: '已摧毁', baseLost: '基地被击毁',
    choose: '选择游戏', libraryTip: '找一款喜欢的，随时玩一局。', playing: '游戏进行中',
    minimal: '极简模式', restore: '完整模式', drag: '移动窗口', resize: '调整窗口大小',
    demo: '联动演练', demoHint: '模拟工具调用与 Step 补给 · 不发送模型请求', liveHint: '工具带来新目标，Step 结束掉补给；游戏不影响任务。',
    escortEnd: '本次任务已结束', demoEnd: '联动演练结束', escortStats: '工具 / 完成 / 失败 / 目标完成', demoRunning: '联动演练中 · 模拟工具调用',
    n: '上边', s: '下边', e: '右边', w: '左边', nw: '左上角', ne: '右上角', sw: '左下角', se: '右下角',
  },
  en: {
    title: 'Whileplay', subtitle: 'A little play between replies', open: 'Play a little', close: 'Collapse',
    plane: 'Air battle', tank: 'Tank battle', snake: 'Snake', start: 'Start game', resume: 'Resume', pause: 'Pause', restart: 'Restart',
    score: 'Score', best: 'Best', paused: 'Paused', over: 'Game over', idle: 'Start anytime. Pause anytime.',
    working: 'AI is working · enjoy a little game', ready: 'AI stopped · game paused, check the reply',
    attention: 'AI needs your input · game paused', unavailable: 'Session status unavailable · game paused', switched: 'Session changed · game paused',
    focus: 'Game paused while away', planeHint: 'Arrows or drag to move; auto fire. Steps bring supplies and upgrades. Catch an upgrade capsule or press 1 / 2 for Firepower, Survival or Mobility.',
    snakeHint: 'Arrows to turn; avoid walls and yourself. Tools spawn timed fruit; Steps provide double score, a shield or slow motion.', tankHint: 'Arrows to move, Space to fire. Tools spawn armored tanks; Steps provide rapid fire, a shield or a bomb.',
    canvas: 'Game canvas. Click to use keyboard controls', up: 'Up', down: 'Down', left: 'Left', right: 'Right', fire: 'Fire',
    saveError: 'Browser storage unavailable. Scores and checkpoints may not be saved.', resetHint: 'Air battle saves per session. Return after switching games or refreshing.',
    restored: 'Air battle restored · press Resume', upgradeChoice: 'Choose an upgrade', firePath: 'Firepower', guardPath: 'Survival', movePath: 'Mobility', savedRound: 'Round saved. You can return to the conversation.',
    library: 'Game library', count: '{count} games', search: 'Search games', all: 'All', flight: 'Flight', action: 'Action', puzzle: 'Puzzle',
    noResults: 'No games found. Try another keyword.', portrait: 'Portrait', landscape: 'Landscape',
    planeDescription: 'Auto fire. Take on the enemy fleet.', tankDescription: 'Break through bricks. Defend the base.', snakeDescription: 'Just one more bite',
    square: 'Square', lives: 'Lives', base: 'Base', intact: 'Intact', destroyed: 'Destroyed', baseLost: 'Base destroyed',
    choose: 'Choose a game', libraryTip: 'Pick a favorite for a little break.', playing: 'Playing',
    minimal: 'Minimal mode', restore: 'Full mode', drag: 'Move window', resize: 'Resize window',
    demo: 'Try task escort', demoHint: 'Simulated tools and Step supplies · no model requests', liveHint: 'Tools spawn targets; completed Steps bring supplies. Play never changes the task.',
    escortEnd: 'Task ended', demoEnd: 'Rehearsal ended', escortStats: 'Tools / Done / Failed / Targets', demoRunning: 'Rehearsal · simulated tool calls',
    n: 'Top', s: 'Bottom', e: 'Right', w: 'Left', nw: 'Top left', ne: 'Top right', sw: 'Bottom left', se: 'Bottom right',
  },
}

function gameIcon(kind, className) {
  const paths = {
    plane: 'M12 2 9 10 3 15v3l6-2v5h6v-5l6 2v-3l-6-5-3-8Z',
    tank: 'M5 8h14v12H5zM3 7v14m18-14v14M12 3v9m-3 0h6v5H9z',
    snake: 'M17 5h-7a4 4 0 0 0 0 8h4a3 3 0 0 1 0 6H5m12-14h3v4h-3z',
  }
  return h('svg', { className, viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round', 'aria-hidden': true }, h('path', { d: paths[kind] }))
}

function canvasPalette(element) {
  const style = window.getComputedStyle(element)
  return Object.fromEntries(Object.entries(DEFAULT_PALETTE).map(([key, fallback]) => [key, style.getPropertyValue(`--arcade-${key}`).trim() || fallback]))
}

function gameOrientation(spec) {
  return spec.height === spec.width ? 'square' : spec.height > spec.width ? 'portrait' : 'landscape'
}

function Arcade({ sessionId, useSessionStatus, useProjection = () => undefined, useSessions = () => undefined, t }) {
  const status = useSessionStatus(snapshot => snapshot.get(sessionId))
  const mission = useProjection('whileplayMission')
  const [open, setOpen] = useState(false)
  const [expeditionOpen, setExpeditionOpen] = useState(false)
  const expeditionFrame = useRef(null)
  const [kind, setKind] = useState('plane')
  const [playing, setPlaying] = useState(false)
  const [notice, setNotice] = useState('idle')
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [best, setBest] = useState({})
  const [saveError, setSaveError] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [tankLives, setTankLives] = useState(3)
  const [minimal, setMinimal] = useState(false)
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight })
  const [frame, setFrame] = useState(() => defaultArcadeWindow(viewport()))
  const [stageSize, setStageSize] = useState({ width: 264, height: 396 })
  const fullFrame = useRef(null)
  const compactFrame = useRef(null)
  const gesture = useRef(null)
  const panel = useRef(null)
  const arena = useRef(null)
  const scoreKey = kind === 'plane' ? 'planeShooter' : kind === 'tank' ? 'tankClassic' : kind
  const canvas = useRef(null)
  const game = useRef(createGame('plane'))
  game.current.language = t('title') === 'Whileplay' ? 'en' : 'zh'
  const input = useRef({ keys: new Set(), direction: null, pointer: false })
  const previous = useRef({ sessionId, running: undefined })
  const scores = useRef({})
  const latestMission = useRef(mission)
  latestMission.current = mission
  const missionBinding = useRef({ sessionId, initialized: false })
  const [demoMode, setDemoMode] = useState(false)
  const [escortSummary, setEscortSummary] = useState(null)
  const [flightStatus, setFlightStatus] = useState('')
  const saveSession = useRef(sessionId)
  const lastSave = useRef(-1)
  const checkpoint = () => {
    if (game.current.kind !== 'plane') return
    try { saveFlight(localStorage, saveSession.current, game.current) }
    catch { setSaveError(true) }
  }
  const clearInput = () => { input.current.keys.clear(); input.current.pointer = false; input.current.direction = null; input.current.targetX = undefined; input.current.targetY = undefined }
  const stop = reason => { clearInput(); setPlaying(false); setNotice(reason); checkpoint() }
  const windowOptions = { minimal, ratio: game.current.width / game.current.height }

  useEffect(() => {
    saveSession.current = sessionId
    let restored = null
    try { restored = loadFlight(localStorage, sessionId) } catch { setSaveError(true) }
    if (restored) {
      game.current = restored; setKind('plane'); setScore(restored.score); setOver(restored.over)
      setDemoMode(restored.escort.demo); setEscortSummary(restored.escort.summary); setNotice('restored')
      missionBinding.current = { sessionId, initialized: true }
    } else {
      game.current = createGame(kind); setScore(0); setOver(false); setDemoMode(false); setEscortSummary(null)
      missionBinding.current = { sessionId, initialized: false }
    }
    setFlightStatus(''); setPlaying(false); clearInput(); lastSave.current = -1
    const pageHide = () => checkpoint()
    window.addEventListener('pagehide', pageHide)
    return () => { checkpoint(); window.removeEventListener('pagehide', pageHide) }
  }, [sessionId])

  useEffect(() => {
    const fit = () => setFrame(current => fitArcadeWindow(current, viewport(), windowOptions))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [minimal, kind])

  useEffect(() => {
    if (!open || expeditionOpen || minimal || !window.ResizeObserver) return
    const element = arena.current
    const resize = () => {
      const bounds = element.getBoundingClientRect()
      const ratio = game.current.width / game.current.height
      const width = Math.max(1, Math.min(bounds.width, Math.max(1, bounds.height - 8) * ratio))
      setStageSize({ width, height: width / ratio })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element); resize()
    return () => observer.disconnect()
  }, [open, expeditionOpen, minimal, kind])

  useEffect(() => {
    try {
      const current = localStorage.getItem('dsh-whileplay.best.v1')
      const legacy = current === null ? localStorage.getItem('dsh-waiting-arcade.best.v1') : null
      const saved = JSON.parse(current ?? legacy ?? '{}')
      for (const key of ['planeShooter', 'snake', 'tankClassic']) {
        if (Number.isSafeInteger(saved?.[key]) && saved[key] >= 0) scores.current[key] = saved[key]
      }
      setBest({ ...scores.current })
      if (current === null && legacy !== null) localStorage.setItem('dsh-whileplay.best.v1', JSON.stringify(scores.current))
    } catch (error) { setSaveError(true) }
  }, [])

  useEffect(() => {
    const before = previous.current
    const reason = before.sessionId !== sessionId ? 'switched' : sessionPause(before.running, status)
    previous.current = { sessionId, running: status?.running }
    if (reason) stop(reason)
  }, [sessionId, status?.running, status?.pendingInteraction])

  useEffect(() => {
    if (missionBinding.current.sessionId !== sessionId) {
      missionBinding.current = { sessionId, initialized: false }
      game.current = createGame(kind); setScore(0); setOver(false); setEscortSummary(null); setDemoMode(false)
      if (canvas.current) drawGame(canvas.current.getContext('2d'), game.current, canvasPalette(canvas.current))
    }
    if (!mission) return
    if (game.current.escort.demo && !status?.running) return
    if (game.current.escort.demo) {
      game.current = createGame(kind); setScore(0); setOver(false); setEscortSummary(null); setDemoMode(false)
    }
    syncEscort(game.current, mission, !missionBinding.current.initialized)
    missionBinding.current.initialized = true
    setEscortSummary(game.current.escort.summary)
    if (game.current.escort.summary) stop('ready')
    checkpoint()
    if (open && canvas.current) drawGame(canvas.current.getContext('2d'), game.current, canvasPalette(canvas.current))
  }, [sessionId, mission, kind, status?.running])

  useEffect(() => {
    const blur = () => stop('focus')
    const visibility = () => { if (document.hidden) stop('focus') }
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => {
    if (!open || expeditionOpen) return
    const ctx = canvas.current.getContext('2d')
    const paint = () => drawGame(ctx, game.current, canvasPalette(canvas.current))
    paint()
    const themeObserver = new MutationObserver(paint)
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'style'] })
    return () => themeObserver.disconnect()
  }, [open, expeditionOpen, kind])

  useEffect(() => {
    if (!open || expeditionOpen) return
    const ctx = canvas.current.getContext('2d')
    drawGame(ctx, game.current, canvasPalette(canvas.current))
    if (!playing) return
    let frame, last, cancelled = false
    const tick = now => {
      if (cancelled) return
      if (game.current.escort.demo) {
        syncEscort(game.current, kind === 'plane' ? demoFlightMission(game.current.time) : demoMission(game.current.time))
        game.current.escort.demo = true
        if (game.current.escort.summary) { setEscortSummary(game.current.escort.summary); drawGame(ctx, game.current, canvasPalette(canvas.current)); stop('paused'); return }
      }
      if (last !== undefined) stepGame(game.current, input.current, (now - last) / 1000)
      last = now
      drawGame(ctx, game.current, canvasPalette(canvas.current))
      setScore(game.current.score)
      if (game.current.flight) {
        const f = game.current.flight
        setFlightStatus(JSON.stringify([f.wave, f.upgrades, f.choice, f.pending]))
        if (Math.floor(game.current.time) !== lastSave.current) { lastSave.current = Math.floor(game.current.time); checkpoint() }
      }
      if (kind === 'tank') setTankLives(game.current.lives)
      const value = game.current.score
      if (value > (scores.current[scoreKey] || 0)) {
        scores.current[scoreKey] = value
        setBest({ ...scores.current })
        try { localStorage.setItem('dsh-whileplay.best.v1', JSON.stringify(scores.current)) }
        catch (error) { setSaveError(true) }
      }
      if (game.current.over) { setOver(true); stop('over'); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [open, expeditionOpen, playing, kind])

  const reset = next => {
    if (next !== kind) checkpoint()
    stop('idle'); setKind(next); game.current = createGame(next); setScore(0); setOver(false); setLibraryOpen(false); setTankLives(3)
    setDemoMode(false); setEscortSummary(null)
    if (next === 'plane' && kind !== 'plane') {
      try {
        const restored = loadFlight(localStorage, sessionId)
        if (restored) {
          game.current = restored; setScore(restored.score); setOver(restored.over); setDemoMode(restored.escort.demo); setEscortSummary(restored.escort.summary); setNotice('restored')
          setFlightStatus('restored'); return
        }
      } catch { setSaveError(true) }
    }
    if (latestMission.current) { syncEscort(game.current, latestMission.current, true); setEscortSummary(game.current.escort.summary) }
    setFlightStatus(''); checkpoint()
    if (canvas.current) drawGame(canvas.current.getContext('2d'), game.current, canvasPalette(canvas.current))
  }
  const canPlay = status?.running !== undefined && !status?.pendingInteraction
  const start = () => {
    if (!canPlay) return
    if (game.current.over) reset(kind)
    if (game.current.escort?.summary) {
      if (game.current.kind === 'plane') { game.current.escort.summary = null; setEscortSummary(null); game.current.escort.demo = false; setDemoMode(false) }
      else reset(kind)
    }
    if (game.current.kind === 'plane' && game.current.time > 0) game.current.flight.ready = 1.5
    clearInput(); setNotice('idle'); setPlaying(true); canvas.current.focus()
  }
  const startDemo = () => {
    reset(kind)
    game.current = createGame(kind)
    syncEscort(game.current, kind === 'plane' ? demoFlightMission(0) : demoMission(0), true); game.current.escort.demo = true
    if (kind === 'plane') game.current.escort.shield = 1
    setDemoMode(true); setPlaying(true); setNotice('idle'); canvas.current?.focus()
    checkpoint()
  }
  const chooseUpgrade = path => {
    if (!playing || !canPlay || !chooseFlightUpgrade(game.current, path)) return
    setFlightStatus(JSON.stringify(game.current.flight)); checkpoint(); canvas.current?.focus()
  }
  const close = () => { stop('paused'); setOpen(false) }
  const toggleMinimal = () => {
    const next = !minimal
    if (next) fullFrame.current = frame
    else compactFrame.current = frame
    const size = next ? compactFrame.current ?? { width: game.current.kind === 'plane' ? 224 : 300 } : fullFrame.current ?? defaultArcadeWindow(viewport())
    setFrame(fitArcadeWindow({ ...frame, ...size, x: frame.x, y: frame.y }, viewport(), { minimal: next, ratio: game.current.width / game.current.height }))
    setLibraryOpen(false); setMinimal(next)
    canvas.current.focus()
  }
  const beginGesture = (event, edge = 'move') => {
    if (event.button !== 0) return
    if (edge === 'move' && event.target.closest('button,input') && !event.target.closest('[data-drag-handle]')) return
    event.preventDefault(); event.stopPropagation()
    const bounds = panel.current.getBoundingClientRect()
    gesture.current = { pointerId: event.pointerId, edge, x: event.clientX, y: event.clientY, frame: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }
    event.currentTarget.setPointerCapture(event.pointerId)
    stop('paused')
  }
  const moveGesture = event => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    const dx = event.clientX - active.x, dy = event.clientY - active.y
    setFrame(active.edge === 'move' ? moveArcadeWindow(active.frame, dx, dy, viewport(), windowOptions) : resizeArcadeWindow(active.frame, active.edge, dx, dy, viewport(), windowOptions))
  }
  const endGesture = event => { if (gesture.current?.pointerId === event.pointerId) gesture.current = null }
  const gestureProps = { onPointerMove: moveGesture, onPointerUp: endGesture, onPointerCancel: endGesture, onLostPointerCapture: endGesture }
  const keyboardGeometry = (event, edge) => {
    const direction = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.code]
    if (!direction) return
    event.preventDefault(); event.stopPropagation(); stop('paused')
    setFrame(current => edge === 'move' ? moveArcadeWindow(current, ...direction, viewport(), windowOptions) : resizeArcadeWindow(current, edge, ...direction, viewport(), windowOptions))
  }
  const dragHandle = className => h('button', { className, type: 'button', 'data-drag-handle': '', 'aria-label': t('drag'), title: t('drag'), onPointerDown: event => beginGesture(event), onKeyDown: event => keyboardGeometry(event, 'move'), ...gestureProps }, '⠿')
  const keyDown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (kind === 'plane' && ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation()
      const path = game.current.flight.choice?.options[Number(event.code.slice(-1)) - 1]
      if (path && !event.repeat) chooseUpgrade(path)
      return
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) return
    event.preventDefault(); event.stopPropagation()
    if (!playing) return
    input.current.keys.add(event.code)
    if (event.code.startsWith('Arrow')) input.current.direction = event.code
  }
  const keyUp = event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation(); input.current.keys.delete(event.code)
    }
  }
  const pad = (code, label) => h('button', {
    key: code, type: 'button', 'aria-label': t(label), disabled: !playing,
    onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); canvas.current.focus(); input.current.keys.add(code); if (code.startsWith('Arrow')) input.current.direction = code },
    onPointerUp: () => input.current.keys.delete(code), onPointerCancel: () => input.current.keys.delete(code), onLostPointerCapture: () => input.current.keys.delete(code),
  }, t(label))

  const selected = GAME_CATALOG.find(item => item.id === kind)
  const orientation = gameOrientation(selected)
  const categories = ['all', ...new Set(GAME_CATALOG.map(item => item.category))]
  const visibleGames = GAME_CATALOG.filter(item => (category === 'all' || item.category === category)
    && `${t(item.id)} ${t(`${item.id}Description`)} ${t(item.category)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const showExpedition = ['all', 'action'].includes(category) && '小队护送远征 expedition todo 子agent 工具 交付物'.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const openExpedition = () => {
    stop('paused'); expeditionFrame.current = frame; setMinimal(false); setExpeditionOpen(true)
    setFrame(fitArcadeWindow({ x: 80, y: 30, width: Math.min(800, window.innerWidth - 32), height: Math.min(900, window.innerHeight - 48) }, viewport()))
  }
  const closeExpedition = () => { setExpeditionOpen(false); if (expeditionFrame.current) setFrame(fitArcadeWindow(expeditionFrame.current, viewport())) }
  const pointerPosition = event => {
    const bounds = event.currentTarget.getBoundingClientRect()
    input.current.targetX = (event.clientX - bounds.left) * game.current.width / bounds.width
    input.current.targetY = (event.clientY - bounds.top) * game.current.height / bounds.height
  }

  return h('div', { className: 'dsh-arcade' },
    h('button', { className: 'arcade-launch', type: 'button', 'aria-expanded': open, onClick: () => open ? close() : setOpen(true) }, '◈ ', t('open')),
    open && expeditionOpen && h(Expedition, { key: sessionId, sessionId, frame, panelRef: panel, onMove: beginGesture, gestureProps, onClose: closeExpedition, useSessionStatus, useProjection, useSessions }),
    open && !expeditionOpen && h('section', {
      ref: panel, className: 'arcade-panel', 'aria-label': t('title'), 'data-orientation': orientation, 'data-minimal': minimal,
      style: { left: frame.x, top: frame.y, width: frame.width, height: frame.height },
      onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget)) stop('focus') },
    },
      h('header', { className: 'arcade-header', onPointerDown: event => beginGesture(event), ...gestureProps }, dragHandle('arcade-drag-handle'), h('div', { className: 'arcade-heading' }, h('h2', null, t('title')), h('p', null, t('subtitle'))),
        h('button', { className: 'arcade-menu-toggle', type: 'button', 'aria-expanded': libraryOpen, onClick: () => { if (!libraryOpen) stop('paused'); setLibraryOpen(!libraryOpen) } }, t('library'), ' ▾'),
        h('button', { className: 'arcade-mode-toggle', type: 'button', onClick: toggleMinimal }, t('minimal')),
        h('button', { className: 'arcade-close', type: 'button', onClick: close, 'aria-label': t('close') }, '×')),
      h('div', { className: 'arcade-body' },
        h('aside', { className: 'arcade-library', 'data-expanded': libraryOpen, 'aria-label': t('library') },
          h('div', { className: 'arcade-library-heading' }, h('strong', null, t('library')), h('small', null, t('count').replace('{count}', GAME_CATALOG.length + 1))),
          h('input', { className: 'arcade-search', type: 'search', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: event => setQuery(event.target.value) }),
          h('div', { className: 'arcade-filters', role: 'group', 'aria-label': t('choose') }, ...categories.map(item => h('button', { key: item, type: 'button', 'aria-pressed': category === item, onClick: () => setCategory(item) }, t(item)))),
          h('nav', { className: 'arcade-game-list', 'aria-label': t('choose') }, ...visibleGames.map(item => h('button', {
            type: 'button', key: item.id, 'aria-label': t(item.id), 'aria-pressed': item.id === kind, onClick: () => { if (item.id !== kind) reset(item.id); else setLibraryOpen(false) },
          }, gameIcon(item.id, 'arcade-game-icon'), h('span', null, h('strong', null, t(item.id)), h('small', null, t(item.category), ' · ', t(gameOrientation(item)))))),
          showExpedition && h('button', { type: 'button', 'aria-label': '小队护送远征', 'aria-pressed': false, onClick: openExpedition }, h('span', { className: 'exp-library-icon', 'aria-hidden': true }, '⌁'), h('span', null, h('strong', null, '小队护送远征'), h('small', null, '任务联动 · 实时护航'))),
          !visibleGames.length && !showExpedition && h('p', { className: 'arcade-empty' }, t('noResults'))),
          h('small', { className: 'arcade-library-tip' }, t('libraryTip'))),
        h('main', { className: 'arcade-play' },
          h('div', { className: 'arcade-game-heading' }, h('div', null, h('h3', null, t(kind)), h('p', null, t(`${kind}Description`))), h('span', { className: 'arcade-orientation' }, t(orientation))),
          h('div', { className: 'arcade-scores' }, h('span', null, t('score'), h('strong', null, String(score).padStart(3, '0'))), h('span', null, t('best'), h('strong', null, String(best[scoreKey] || 0).padStart(3, '0')))),
          kind === 'tank' && h('div', { className: 'arcade-tank-hud' }, h('span', null, t('lives'), ' ', tankLives, ' / 3'), h('span', null, t('base'), ' · ', t(game.current.base.destroyed ? 'destroyed' : 'intact'))),
          h('div', { className: 'arcade-escort-info' }, h('small', null, t(demoMode ? 'demoHint' : 'liveHint')), h('button', { type: 'button', onClick: startDemo, disabled: status?.running || !!status?.pendingInteraction || !canPlay }, t('demo'))),
          kind === 'plane' && game.current.flight?.choice && h('div', { className: 'arcade-upgrades', role: 'group', 'aria-label': t('upgradeChoice') }, h('small', null, t('upgradeChoice')),
            ...game.current.flight.choice.options.map((path, i) => h('button', { type: 'button', key: path, disabled: !playing || !canPlay, onClick: () => chooseUpgrade(path) }, `${i + 1} · ${t(`${path}Path`)} · ${flightUpgradeName(game.current, path)}`))),
      h('div', { className: 'arcade-arena', ref: arena }, h('div', { className: 'arcade-stage', style: minimal ? { width: '100%', height: '100%' } : stageSize },
        h('canvas', {
          ref: canvas, width: selected.width, height: selected.height, tabIndex: 0, 'aria-label': t('canvas'), onKeyDown: keyDown, onKeyUp: keyUp,
          onPointerDown: e => { e.currentTarget.focus(); if (playing) { e.currentTarget.setPointerCapture(e.pointerId); input.current.pointer = true; pointerPosition(e) } },
          onPointerMove: e => { if (input.current.pointer) pointerPosition(e) },
          onPointerUp: () => { input.current.pointer = false }, onPointerCancel: () => { input.current.pointer = false }, onLostPointerCapture: () => { input.current.pointer = false },
          onBlur: clearInput,
        }),
        !playing && h('div', { className: 'arcade-curtain' }, gameIcon(kind, 'arcade-curtain-icon'), h('strong', null, t(over ? kind === 'tank' && game.current.base.destroyed ? 'baseLost' : 'over' : notice === 'idle' ? 'idle' : 'paused')),
          escortSummary && h('div', { className: 'arcade-escort-summary', role: 'status' }, h('strong', null, t(demoMode ? 'demoEnd' : 'escortEnd')), h('small', null, t('escortStats')), h('span', null, `${escortSummary.total} / ${escortSummary.completed} / ${escortSummary.failed} / ${escortSummary.kills}`), h('small', null, `${t('score')} ${escortSummary.score}`)),
          kind === 'plane' && escortSummary && h('small', null, t('savedRound')),
          h('button', { type: 'button', className: 'arcade-primary', disabled: !canPlay, onClick: start }, t(over || (escortSummary && kind !== 'plane') ? 'restart' : game.current.time ? 'resume' : 'start'))))),
      h('p', { className: 'arcade-hint' }, t(`${kind}Hint`)),
      h('div', { className: 'arcade-toolbar' },
        h('div', { className: 'arcade-controls' }, pad('ArrowLeft', 'left'), pad('ArrowUp', 'up'), pad('ArrowDown', 'down'), pad('ArrowRight', 'right'), kind === 'tank' && pad('Space', 'fire')),
        h('div', { className: 'arcade-actions' }, h('button', { type: 'button', disabled: !canPlay, onClick: () => playing ? stop('paused') : start() }, t(playing ? 'pause' : 'resume')), h('button', { type: 'button', onClick: () => reset(kind) }, t('restart')))),
      saveError && h('p', { className: 'arcade-hint' }, t('saveError')),
      h('small', { className: 'arcade-footnote' }, t('resetHint')))),
      h('footer', { className: 'arcade-status', role: 'status' }, h('span', { className: `arcade-dot ${status?.running ? 'working' : ''}` }), t(status?.pendingInteraction ? 'attention' : demoMode && playing ? 'demoRunning' : notice !== 'idle' && notice !== 'paused' && notice !== 'over' ? notice : status?.running ? 'working' : playing ? 'playing' : 'idle')),
      minimal && h('div', { className: 'arcade-mini-tools' }, dragHandle('arcade-mini-drag'),
        h('button', { type: 'button', onClick: () => playing ? stop('paused') : start(), disabled: !canPlay, 'aria-label': t(playing ? 'pause' : 'resume'), title: t(playing ? 'pause' : 'resume') }, playing ? 'Ⅱ' : '▷'),
        h('button', { type: 'button', onClick: toggleMinimal, 'aria-label': t('restore'), title: t('restore') }, '↗'),
        h('button', { type: 'button', onClick: close, 'aria-label': t('close'), title: t('close') }, '×')),
      minimal && ['ready', 'attention', 'unavailable'].includes(status?.pendingInteraction ? 'attention' : notice) && h('div', { className: 'arcade-mini-notice', role: 'status' }, t(status?.pendingInteraction ? 'attention' : notice)),
      ...['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map(edge => h('div', { key: edge, role: 'button', tabIndex: 0, className: `arcade-resize-handle arcade-resize-${edge}`, 'aria-label': `${t('resize')}：${t(edge)}`, title: t('resize'), onPointerDown: event => beginGesture(event, edge), onKeyDown: event => keyboardGeometry(event, edge), ...gestureProps })),
    ))
}

return {
  name: 'whileplay',
  inject: ['slots', 'locale'],
  apply(ctx) {
    ctx.effect(() => {
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-whileplay'; style.textContent = arcadeCSS; document.head.append(style)
      return () => style.remove()
    })
    ctx.effect(() => ctx.locale.register(NS, dictionaries))
    ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
      name: 'conversation.input.left', id: 'whileplay', order: 90, locale: NS,
    }, Arcade))
  },
}
