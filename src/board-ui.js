const XQ_GLYPH = { r: { k: '帥', a: '仕', e: '相', n: '馬', r: '車', c: '炮', p: '兵' }, b: { k: '將', a: '士', e: '象', n: '馬', r: '車', c: '砲', p: '卒' } }
const xqPoint = at => `${'abcdefghi'[at % 9]}${10 - Math.floor(at / 9)}`
/** Board lines, palace diagonals, river and star marks as an aligned SVG underlay. */
function xiangqiBoardLines() {
  const lines = []
  for (let y = 0; y < 10; y++) lines.push(`M.5 ${y + .5}h8`)
  for (const x of [0, 8]) lines.push(`M${x + .5} .5v9`)
  for (let x = 1; x < 8; x++) lines.push(`M${x + .5} .5v4M${x + .5} 5.5v4`)
  lines.push('M3.5 .5l2 2M5.5 .5l-2 2M3.5 7.5l2 2M5.5 7.5l-2 2')
  const stars = []
  for (const [x, y] of [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [1, 7], [7, 7], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]]) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      if (x + sx < 0 || x + sx > 8) continue
      stars.push(`M${x + .5 + sx * .07} ${y + .5 + sy * .23}v${-sy * .16}h${sx * .16}`)
    }
  }
  return h('svg', { className: 'xiangqi-lines', viewBox: '0 0 9 10', preserveAspectRatio: 'none', 'aria-hidden': true },
    h('path', { d: lines.join('') }), h('path', { className: 'xiangqi-stars', d: stars.join('') }),
    h('text', { x: 2.5, y: 5 }, '楚河'), h('text', { x: 6.5, y: 5 }, '漢界'))
}
function BoardGames({ kind, sessionId, frame, panelRef, onMove, gestureProps, onClose, useSessionStatus, t }) {
  const en = t('title') === 'Whileplay', text = (zh, english) => en ? english : zh
  const key = `dsh-whileplay.board.v1:${kind}:${sessionId || 'draft'}`
  const [g, setGame] = useState(() => { try { return restoreBoard(localStorage.getItem(key), kind) || createBoardGame(kind) } catch { return createBoardGame(kind) } })
  const [revision, refresh] = useState(0), [paused, setPaused] = useState(true)
  const [selected, setSelected] = useState(null), [promotion, setPromotion] = useState(null)
  const [confirmMode, setConfirmMode] = useState(null), [saveError, setSaveError] = useState(false)
  const confirmCancel = useRef(null)
  const [resultDismissed, setResultDismissed] = useState(false)
  const resultReview = useRef(null)
  const [compact, setCompact] = useState(false), [cursor, setCursor] = useState(kind === 'chess' ? 52 : kind === 'xiangqi' ? 64 : 112)
  const status = useSessionStatus(snapshot => snapshot.get(sessionId)), previous = useRef(status?.running)
  const blocked = !status || !!status.pendingInteraction, result = boardResult(g)
  const history = kind === 'chess' ? g.chess.history() : kind === 'xiangqi' ? g.xiangqi.history.map(move => `${xqPoint(move.from)}→${xqPoint(move.to)}`) : g.moves.map(at => `${String.fromCharCode(65 + at % 15)}${15 - Math.floor(at / 15)}`)
  const botTurn = g.mode === 'computer' && (kind === 'chess' ? g.chess.turn() === 'b' : kind === 'xiangqi' ? g.xiangqi.turn === 'b' : g.moves.length % 2 === 1)
  const active = !paused && !blocked && !result && !confirmMode
  const showResult = !!result && !resultDismissed && !confirmMode && !blocked
  const changed = () => { setSelected(null); setPromotion(null); setResultDismissed(false); refresh(n => n + 1) }
  useEffect(() => { try { localStorage.setItem(key, serializeBoard(g)); setSaveError(false) } catch { setSaveError(true) } }, [g, revision, key])
  useEffect(() => {
    if (!confirmMode) return
    const trigger = document.activeElement
    confirmCancel.current?.focus()
    return () => { if (trigger?.isConnected) trigger.focus() }
  }, [confirmMode])
  useEffect(() => {
    if (!showResult) return
    const trigger = document.activeElement
    resultReview.current?.focus()
    return () => { if (trigger?.isConnected) trigger.focus() }
  }, [showResult])
  useEffect(() => {
    if (blocked || (previous.current === true && status?.running === false)) setPaused(true)
    previous.current = status?.running
  }, [blocked, status?.running])
  useEffect(() => {
    const blur = () => setPaused(true), hide = () => { if (document.hidden) blur() }
    window.addEventListener('blur', blur); window.addEventListener('pagehide', blur); document.addEventListener('visibilitychange', hide)
    return () => { window.removeEventListener('blur', blur); window.removeEventListener('pagehide', blur); document.removeEventListener('visibilitychange', hide) }
  }, [])
  useEffect(() => {
    if (!active || !botTurn) return
    const timer = setTimeout(() => {
      if (kind === 'chess') { const move = chooseChess(g.chess); if (move) g.chess.move(move) }
      else if (kind === 'xiangqi') { const move = chooseXiangqi(g.xiangqi); if (move) playXiangqi(g, move.from, move.to) }
      else { const at = chooseGomoku(g); if (at !== null) playGomoku(g, at) }
      changed()
    }, 350)
    return () => clearTimeout(timer)
  }, [g, revision, active, botTurn])
  const legal = selected !== null && kind === 'chess' ? g.chess.moves({ square: selected, verbose: true }) : selected !== null && kind === 'xiangqi' ? xiangqiMovesFrom(g.xiangqi, selected) : []
  const last = kind === 'chess' ? g.chess.history({ verbose: true }).at(-1) : kind === 'xiangqi' ? g.xiangqi.history.at(-1) : g.moves.at(-1)
  const pieces = { w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } }
  const pieceNames = en ? { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' } : { k: '王', q: '后', r: '车', b: '象', n: '马', p: '兵' }
  const xqNames = en ? { k: 'general', a: 'advisor', e: 'elephant', n: 'horse', r: 'rook', c: 'cannon', p: 'soldier' } : { k: '将', a: '士', e: '象', n: '马', r: '车', c: '炮', p: '兵' }
  const playSquare = at => {
    if (!active || botTurn || promotion) return
    if (kind === 'gomoku') { if (playGomoku(g, at)) changed(); return }
    if (kind === 'xiangqi') {
      if (selected !== null && legal.some(move => move.to === at)) { playXiangqi(g, selected, at); changed() }
      else setSelected(g.xiangqi.board[at]?.color === g.xiangqi.turn ? at : null)
      return
    }
    const choices = legal.filter(move => move.to === at)
    if (choices.length) {
      if (choices.some(move => move.promotion)) setPromotion({ from: selected, to: at })
      else { g.chess.move({ from: selected, to: at }); changed() }
    } else setSelected(g.chess.get(at)?.color === g.chess.turn() ? at : null)
  }
  const newGame = (mode, start = true) => { setGame(createBoardGame(kind, mode)); changed(); setPaused(!start || blocked || document.hidden); setConfirmMode(null) }
  const requestNew = mode => { if (history.length && !result) { setPaused(true); setConfirmMode(mode) } else newGame(mode, mode === g.mode) }
  const resultText = kind === 'xiangqi'
    ? { redWin: text('红方获胜', 'Red wins'), blackWin: text('黑方获胜', 'Black wins'), draw: text('和棋', 'Draw'), stalemate: text('困毙', 'Stalemate') }
    : { whiteWin: text('白方获胜', 'White wins'), blackWin: text('黑方获胜', 'Black wins'), draw: text('和棋', 'Draw'), stalemate: text('逼和', 'Stalemate') }
  const drawn = result === 'draw' || result === 'stalemate'
  const won = result === (kind === 'chess' ? 'whiteWin' : kind === 'xiangqi' ? 'redWin' : 'blackWin')
  const resultTone = drawn ? 'draw' : g.mode === 'local' || won ? 'win' : 'loss'
  const resultTitle = drawn ? text('本局和棋', 'A draw') : g.mode === 'local' ? resultText[result] : won ? text('你赢了！', 'You win!') : text('本局落败', 'You lost this round')
  const resultReason = drawn ? (result === 'stalemate' ? text('无合法走法，逼和收场。', 'No legal moves. Stalemate.') : text('本局未分胜负，再下一局吧。', 'Honors even. Ready for another round?')) : kind === 'gomoku' ? text('五子连线，胜负已定。', 'Five in a row decides the game.') : kind === 'xiangqi' ? text('绝杀！对方老将已无处可逃。', 'Checkmate! The general has no escape.') : text('将杀！王已无路可退。', 'Checkmate! The king has no escape.')
  const trapDialogFocus = event => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('button')].filter(button => !button.disabled)
    const at = buttons.indexOf(document.activeElement)
    buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
  }
  const turnFirst = kind === 'chess' ? g.chess.turn() === 'w' : kind === 'xiangqi' ? g.xiangqi.turn === 'r' : g.moves.length % 2 === 1
  const turn = kind === 'xiangqi' ? (turnFirst ? text('红方', 'Red') : text('黑方', 'Black')) : turnFirst ? text('白方', 'White') : text('黑方', 'Black')
  const inCheck = kind === 'chess' ? g.chess.isCheck() : kind === 'xiangqi' ? xiangqiAttacked(g.xiangqi.board, g.xiangqi.turn) : false
  const stateText = blocked ? t(status?.pendingInteraction ? 'attention' : 'unavailable') : result ? resultText[result] : paused ? text('已暂停 · 随时继续这一局', 'Paused · resume anytime') : botTurn ? text('电脑思考中…', 'Computer thinking…') : `${turn}${text('行棋', ' to move')}${inCheck ? text(' · 将军！', ' · Check!') : ''}`
  const cols = kind === 'chess' ? 8 : kind === 'xiangqi' ? 9 : 15, rows = kind === 'xiangqi' ? 10 : cols, total = cols * rows
  const cells = Array.from({ length: total }, (_, i) => {
    const x = i % cols, y = Math.floor(i / cols), square = kind === 'chess' ? `${'abcdefgh'[x]}${8 - y}` : i
    const piece = kind === 'chess' ? g.chess.get(square) : kind === 'xiangqi' ? g.xiangqi.board[i] : null, stone = g.cells[i]
    const target = legal.some(move => move.to === square)
    const marked = kind === 'chess' ? last?.from === square || last?.to === square : kind === 'xiangqi' ? last?.from === i || last?.to === i : last === i
    const checked = kind === 'chess' ? piece?.type === 'k' && piece.color === g.chess.turn() && g.chess.isCheck() : kind === 'xiangqi' ? piece?.type === 'k' && piece.color === g.xiangqi.turn && inCheck : false
    const label = kind === 'chess' ? `${square}${piece ? ` ${piece.color === 'w' ? text('白', 'white ') : text('黑', 'black ')}${pieceNames[piece.type]}` : ''}` : kind === 'xiangqi' ? `${xqPoint(i)}${piece ? ` ${piece.color === 'r' ? text('红', 'red ') : text('黑', 'black ')}${xqNames[piece.type]}` : ''}` : `${String.fromCharCode(65 + x)}${15 - y}${stone ? stone === 1 ? text(' 黑子', ' black') : text(' 白子', ' white') : ''}`
    return h('button', { type: 'button', key: i, className: `board-cell ${(x + y) % 2 ? 'dark' : 'light'} ${marked ? 'last' : ''} ${selected === square ? 'selected' : ''} ${target ? 'legal' : ''} ${checked ? 'check' : ''} ${g.line.includes(i) ? 'winning' : ''}`,
      style: kind === 'gomoku' ? { '--line-left': x === 0 ? '50%' : '0%', '--line-right': x === 14 ? '50%' : '0%', '--line-top': y === 0 ? '50%' : '0%', '--line-bottom': y === 14 ? '50%' : '0%' } : undefined,
      'aria-label': label, 'aria-disabled': !active || botTurn || !!promotion, tabIndex: cursor === i ? 0 : -1,
      onFocus: () => setCursor(i), onClick: () => playSquare(square), onKeyDown: event => {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[event.key]
        if (delta !== undefined) { event.preventDefault(); event.stopPropagation(); const next = Math.max(0, Math.min(total - 1, i + delta)); setCursor(next); event.currentTarget.parentElement.querySelectorAll('.board-cell')[next].focus() }
      },
    }, kind === 'chess' && piece && h('span', { className: `chess-piece ${piece.color}`, 'aria-hidden': true }, pieces[piece.color][piece.type]),
    kind === 'xiangqi' && piece && h('span', { className: `xiangqi-piece ${piece.color}`, 'aria-hidden': true }, XQ_GLYPH[piece.color][piece.type]),
    kind === 'chess' && (x === 0 || y === 7) && h('small', { className: 'board-coordinate', 'aria-hidden': true }, `${x === 0 ? 8 - y : ''}${y === 7 ? 'abcdefgh'[x] : ''}`),
    kind === 'gomoku' && [3, 7, 11].includes(x) && [3, 7, 11].includes(y) && h('i', { className: 'board-star' }),
    kind === 'gomoku' && !!stone && h('span', { className: `board-stone stone-${stone}`, 'aria-hidden': true }))
  })
  const moveWindow = (event, edge) => { if (event.target.closest('button') && !edge) return; setPaused(true); onMove(event, edge) }
  return h('section', { ref: panelRef, className: 'arcade-panel board-panel', 'data-compact': compact, 'aria-label': t(kind), style: { left: frame.x, top: frame.y, width: frame.width, height: frame.height },
    onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(true) },
    onKeyDown: event => { if (event.key === 'Escape') { event.stopPropagation(); setPaused(true); setPromotion(null); setConfirmMode(null); if (showResult) setResultDismissed(true) } },
  }, h('header', { className: 'arcade-header', onPointerDown: moveWindow, ...gestureProps },
    h('span', { className: 'board-header-icon', 'aria-hidden': true }, { chess: '♞', gomoku: '◉', xiangqi: '帥' }[kind]), h('div', { className: 'arcade-heading' }, h('h2', null, t(kind)), !compact && h('p', null, text('落一子，让等待慢下来', 'A thoughtful move between replies'))),
    h('button', { type: 'button', onClick: () => setCompact(!compact) }, t(compact ? 'restore' : 'minimal')),
    h('button', { type: 'button', onClick: onClose }, text('游戏库', 'Library'))),
  h('div', { className: 'board-layout' }, h('main', { className: 'board-main', style: { maxWidth: Math.max(180, Math.min(660, frame.height - (compact ? 155 : 205))) } },
    h('div', { className: 'board-turn', role: 'status' }, h('span', { className: `board-turn-dot ${turnFirst ? (kind === 'xiangqi' ? 'red' : 'white') : 'black'}` }), stateText),
    h('div', { className: `board-grid ${kind}`, role: 'group', 'aria-label': text('棋盘', 'Board') }, kind === 'xiangqi' && xiangqiBoardLines(), ...cells),
    h('div', { className: 'board-controls' }, h('button', { type: 'button', className: 'arcade-primary', disabled: blocked || !!confirmMode, onClick: () => result ? setResultDismissed(false) : setPaused(!paused) }, result ? text('查看结算', 'View result') : paused ? history.length ? t('resume') : text('开始对弈', 'Start game') : t('pause')),
      h('button', { type: 'button', disabled: !history.length || !!confirmMode, onClick: () => { undoBoard(g); changed() } }, text('悔棋', 'Undo')),
      h('button', { type: 'button', onClick: () => requestNew(g.mode) }, text('新的一局', 'New game'))),
    promotion && h('div', { className: 'board-promotion', role: 'group', 'aria-label': text('选择升变棋子', 'Choose promotion') }, h('strong', null, text('兵升变', 'Promote pawn')), ...['q', 'r', 'b', 'n'].map(p => h('button', { type: 'button', key: p, disabled: !active, onClick: () => { g.chess.move({ ...promotion, promotion: p }); changed() } }, pieces[g.chess.turn()][p], ' ', pieceNames[p])), h('button', { type: 'button', onClick: () => setPromotion(null) }, text('取消', 'Cancel'))),
    ),
    !compact && h('aside', { className: 'board-sidebar' }, h('div', { className: 'board-mode', role: 'group', 'aria-label': text('对弈模式', 'Game mode') }, ...[['computer', text('人机对弈', 'Computer')], ['local', text('本地双人', 'Two players')]].map(([mode, label]) => h('button', { key: mode, type: 'button', 'aria-pressed': g.mode === mode, onClick: () => { if (mode !== g.mode) requestNew(mode) } }, label))),
      h('h3', null, g.mode === 'computer' ? (kind === 'xiangqi' ? text('你执红，先行', 'You play Red') : text(kind === 'chess' ? '你执白，先行' : '你执黑，先行', kind === 'chess' ? 'You play White' : 'You play Black')) : text('轮流行棋', 'Take turns')),
      h('p', null, kind === 'chess' ? text('点击棋子查看合法落点，再点击目标格。支持王车易位、吃过路兵与升变。', 'Select a piece to see legal moves. Castling, en passant and promotion are supported.') : kind === 'xiangqi' ? text('点击棋子查看合法落点。马走日、象走田，炮隔子吃子，兵过河后可平移；将死或困毙对方即获胜。', 'Select a piece to see legal moves. Horses move in 日, elephants in 田, cannons capture over a screen, soldiers shift sideways across the river. Win by checkmate or stalemate.') : text('横、竖或斜向连成五子即可获胜。15×15 自由规则，长连也算胜利，无禁手。', 'Connect five horizontally, vertically or diagonally. Freestyle 15×15: overlines win, no forbidden moves.')),
      h('div', { className: 'board-history-heading' }, h('h3', null, text('棋谱', 'Moves')), h('span', null, `${history.length} ${text('手', 'plies')}`)),
      h('ol', { className: 'board-history', start: Math.max(1, history.length - 11) }, ...history.slice(-12).map((move, i) => h('li', { key: history.length - 12 + i }, move))),
      h('small', { className: 'board-note' }, text('轻量本地电脑 · 无需 API Key。按会话自动保存；任务结束或需要操作时自动暂停。', 'Casual local opponent · no API key. Saved per session; pauses when the task ends or needs input.')))),
    saveError && h('p', { className: 'arcade-hint', role: 'alert' }, t('saveError')),
    showResult && h('div', { className: 'board-result-backdrop' },
      h('div', { className: 'board-result', 'data-result': resultTone, role: 'dialog', 'aria-modal': true, 'aria-label': resultTitle, onKeyDown: trapDialogFocus },
        h('div', { className: 'board-result-emblem', 'aria-hidden': true },
          h('svg', { viewBox: '0 0 64 64', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: resultTone === 'win' ? 'M20 10h24v16a12 12 0 0 1-24 0ZM20 15H10v8a10 10 0 0 0 11 10m23-18h10v8a10 10 0 0 1-11 10M32 38v12m-10 5h20m-17-5h14M27 21l4 4 7-8' : resultTone === 'loss' ? 'M18 54V10m0 2c12-9 18 9 30 0v22c-12 9-18-9-30 0M12 54h12' : 'M16 24h32M16 40h32M10 8h44v48H10Z' }))),
        h('small', { className: 'board-result-eyebrow' }, `${t(kind)} · ${text('本局结束', 'Game complete')}`),
        h('h2', null, resultTitle), h('p', null, resultReason),
        h('div', { className: 'board-result-stats' }, h('span', null, g.mode === 'computer' ? text('人机对弈', 'Computer') : text('本地双人', 'Two players')), h('strong', null, `${history.length} ${text('手', 'plies')}`), h('span', null, resultText[result])),
        h('div', { className: 'board-result-actions' }, h('button', { type: 'button', className: 'arcade-primary', onClick: () => newGame(g.mode) }, text('再来一局', 'Play again')),
          h('button', { ref: resultReview, type: 'button', onClick: () => setResultDismissed(true) }, text('查看棋盘', 'Review board'))))),
    confirmMode && h('div', { className: 'board-confirm-backdrop' },
      h('div', { className: 'board-confirm', role: 'alertdialog', 'aria-modal': true, 'aria-label': text('开始新的一局？', 'Start a new round?'), onKeyDown: trapDialogFocus }, h('strong', null, text('开始新的一局？', 'Start a new round?')),
      h('p', null, text('当前棋局和存档将被替换。', 'This replaces the current game and its save.')),
      h('button', { type: 'button', onClick: () => newGame(confirmMode) }, text('确认新局', 'Start new round')),
      h('button', { ref: confirmCancel, type: 'button', onClick: () => setConfirmMode(null) }, text('取消', 'Cancel')))),
    ...['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map(edge => h('div', { key: edge, className: `arcade-resize-handle arcade-resize-${edge}`, onPointerDown: event => moveWindow(event, edge), ...gestureProps })))
}
