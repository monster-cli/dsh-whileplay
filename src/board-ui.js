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
  const [compact, setCompact] = useState(false), [cursor, setCursor] = useState(kind === 'chess' ? 52 : 112)
  const status = useSessionStatus(snapshot => snapshot.get(sessionId)), previous = useRef(status?.running)
  const blocked = !status || !!status.pendingInteraction, result = boardResult(g)
  const history = kind === 'chess' ? g.chess.history() : g.moves.map(at => `${String.fromCharCode(65 + at % 15)}${15 - Math.floor(at / 15)}`)
  const botTurn = g.mode === 'computer' && (kind === 'chess' ? g.chess.turn() === 'b' : g.moves.length % 2 === 1)
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
      else { const at = chooseGomoku(g); if (at !== null) playGomoku(g, at) }
      changed()
    }, 350)
    return () => clearTimeout(timer)
  }, [g, revision, active, botTurn])
  const legal = selected && kind === 'chess' ? g.chess.moves({ square: selected, verbose: true }) : []
  const last = kind === 'chess' ? g.chess.history({ verbose: true }).at(-1) : g.moves.at(-1)
  const pieces = { w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } }
  const pieceNames = en ? { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' } : { k: '王', q: '后', r: '车', b: '象', n: '马', p: '兵' }
  const playSquare = at => {
    if (!active || botTurn || promotion) return
    if (kind === 'gomoku') { if (playGomoku(g, at)) changed(); return }
    const choices = legal.filter(move => move.to === at)
    if (choices.length) {
      if (choices.some(move => move.promotion)) setPromotion({ from: selected, to: at })
      else { g.chess.move({ from: selected, to: at }); changed() }
    } else setSelected(g.chess.get(at)?.color === g.chess.turn() ? at : null)
  }
  const newGame = (mode, start = true) => { setGame(createBoardGame(kind, mode)); changed(); setPaused(!start || blocked || document.hidden); setConfirmMode(null) }
  const requestNew = mode => { if (history.length && !result) { setPaused(true); setConfirmMode(mode) } else newGame(mode, mode === g.mode) }
  const resultText = { whiteWin: text('白方获胜', 'White wins'), blackWin: text('黑方获胜', 'Black wins'), draw: text('和棋', 'Draw'), stalemate: text('逼和', 'Stalemate') }
  const drawn = result === 'draw' || result === 'stalemate'
  const won = result === (kind === 'chess' ? 'whiteWin' : 'blackWin')
  const resultTone = drawn ? 'draw' : g.mode === 'local' || won ? 'win' : 'loss'
  const resultTitle = drawn ? text('本局和棋', 'A draw') : g.mode === 'local' ? resultText[result] : won ? text('你赢了！', 'You win!') : text('本局落败', 'You lost this round')
  const resultReason = drawn ? (result === 'stalemate' ? text('无合法走法，逼和收场。', 'No legal moves. Stalemate.') : text('本局未分胜负，再下一局吧。', 'Honors even. Ready for another round?')) : kind === 'gomoku' ? text('五子连线，胜负已定。', 'Five in a row decides the game.') : text('将杀！王已无路可退。', 'Checkmate! The king has no escape.')
  const trapDialogFocus = event => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('button')].filter(button => !button.disabled)
    const at = buttons.indexOf(document.activeElement)
    buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
  }
  const turnWhite = kind === 'chess' ? g.chess.turn() === 'w' : g.moves.length % 2 === 1
  const turn = turnWhite ? text('白方', 'White') : text('黑方', 'Black')
  const stateText = blocked ? t(status?.pendingInteraction ? 'attention' : 'unavailable') : result ? resultText[result] : paused ? text('已暂停 · 随时继续这一局', 'Paused · resume anytime') : botTurn ? text('电脑思考中…', 'Computer thinking…') : `${turn}${text('行棋', ' to move')}${kind === 'chess' && g.chess.isCheck() ? text(' · 将军！', ' · Check!') : ''}`
  const size = kind === 'chess' ? 8 : 15
  const cells = Array.from({ length: size * size }, (_, i) => {
    const x = i % size, y = Math.floor(i / size), square = kind === 'chess' ? `${'abcdefgh'[x]}${8 - y}` : i
    const piece = kind === 'chess' ? g.chess.get(square) : null, stone = g.cells[i]
    const target = legal.some(move => move.to === square), marked = kind === 'chess' ? last?.from === square || last?.to === square : last === i
    const checked = piece?.type === 'k' && piece.color === g.chess.turn() && g.chess.isCheck()
    const label = kind === 'chess' ? `${square}${piece ? ` ${piece.color === 'w' ? text('白', 'white ') : text('黑', 'black ')}${pieceNames[piece.type]}` : ''}` : `${String.fromCharCode(65 + x)}${15 - y}${stone ? stone === 1 ? text(' 黑子', ' black') : text(' 白子', ' white') : ''}`
    return h('button', { type: 'button', key: i, className: `board-cell ${(x + y) % 2 ? 'dark' : 'light'} ${marked ? 'last' : ''} ${selected === square ? 'selected' : ''} ${target ? 'legal' : ''} ${checked ? 'check' : ''} ${g.line.includes(i) ? 'winning' : ''}`,
      style: kind === 'gomoku' ? { '--line-left': x === 0 ? '50%' : '0%', '--line-right': x === 14 ? '50%' : '0%', '--line-top': y === 0 ? '50%' : '0%', '--line-bottom': y === 14 ? '50%' : '0%' } : undefined,
      'aria-label': label, 'aria-disabled': !active || botTurn || !!promotion, tabIndex: cursor === i ? 0 : -1,
      onFocus: () => setCursor(i), onClick: () => playSquare(square), onKeyDown: event => {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key]
        if (delta !== undefined) { event.preventDefault(); event.stopPropagation(); const next = Math.max(0, Math.min(size * size - 1, i + delta)); setCursor(next); event.currentTarget.parentElement.children[next].focus() }
      },
    }, piece && h('span', { className: `chess-piece ${piece.color}`, 'aria-hidden': true }, pieces[piece.color][piece.type]),
    kind === 'chess' && (x === 0 || y === 7) && h('small', { className: 'board-coordinate', 'aria-hidden': true }, `${x === 0 ? 8 - y : ''}${y === 7 ? 'abcdefgh'[x] : ''}`),
    kind === 'gomoku' && [3, 7, 11].includes(x) && [3, 7, 11].includes(y) && h('i', { className: 'board-star' }),
    kind === 'gomoku' && !!stone && h('span', { className: `board-stone stone-${stone}`, 'aria-hidden': true }))
  })
  const moveWindow = (event, edge) => { if (event.target.closest('button') && !edge) return; setPaused(true); onMove(event, edge) }
  return h('section', { ref: panelRef, className: 'arcade-panel board-panel', 'data-compact': compact, 'aria-label': t(kind), style: { left: frame.x, top: frame.y, width: frame.width, height: frame.height },
    onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(true) },
    onKeyDown: event => { if (event.key === 'Escape') { event.stopPropagation(); setPaused(true); setPromotion(null); setConfirmMode(null); if (showResult) setResultDismissed(true) } },
  }, h('header', { className: 'arcade-header', onPointerDown: moveWindow, ...gestureProps },
    h('span', { className: 'board-header-icon', 'aria-hidden': true }, kind === 'chess' ? '♞' : '◉'), h('div', { className: 'arcade-heading' }, h('h2', null, t(kind)), !compact && h('p', null, text('落一子，让等待慢下来', 'A thoughtful move between replies'))),
    h('button', { type: 'button', onClick: () => setCompact(!compact) }, t(compact ? 'restore' : 'minimal')),
    h('button', { type: 'button', onClick: onClose }, text('游戏库', 'Library'))),
  h('div', { className: 'board-layout' }, h('main', { className: 'board-main', style: { maxWidth: Math.max(180, Math.min(660, frame.height - (compact ? 155 : 205))) } },
    h('div', { className: 'board-turn', role: 'status' }, h('span', { className: `board-turn-dot ${turnWhite ? 'white' : 'black'}` }), stateText),
    h('div', { className: `board-grid ${kind}`, role: 'group', 'aria-label': text('棋盘', 'Board') }, ...cells),
    h('div', { className: 'board-controls' }, h('button', { type: 'button', className: 'arcade-primary', disabled: blocked || !!confirmMode, onClick: () => result ? setResultDismissed(false) : setPaused(!paused) }, result ? text('查看结算', 'View result') : paused ? history.length ? t('resume') : text('开始对弈', 'Start game') : t('pause')),
      h('button', { type: 'button', disabled: !history.length || !!confirmMode, onClick: () => { undoBoard(g); changed() } }, text('悔棋', 'Undo')),
      h('button', { type: 'button', onClick: () => requestNew(g.mode) }, text('新的一局', 'New game'))),
    promotion && h('div', { className: 'board-promotion', role: 'group', 'aria-label': text('选择升变棋子', 'Choose promotion') }, h('strong', null, text('兵升变', 'Promote pawn')), ...['q', 'r', 'b', 'n'].map(p => h('button', { type: 'button', key: p, disabled: !active, onClick: () => { g.chess.move({ ...promotion, promotion: p }); changed() } }, pieces[g.chess.turn()][p], ' ', pieceNames[p])), h('button', { type: 'button', onClick: () => setPromotion(null) }, text('取消', 'Cancel'))),
    ),
    !compact && h('aside', { className: 'board-sidebar' }, h('div', { className: 'board-mode', role: 'group', 'aria-label': text('对弈模式', 'Game mode') }, ...[['computer', text('人机对弈', 'Computer')], ['local', text('本地双人', 'Two players')]].map(([mode, label]) => h('button', { key: mode, type: 'button', 'aria-pressed': g.mode === mode, onClick: () => { if (mode !== g.mode) requestNew(mode) } }, label))),
      h('h3', null, g.mode === 'computer' ? text(kind === 'chess' ? '你执白，先行' : '你执黑，先行', kind === 'chess' ? 'You play White' : 'You play Black') : text('轮流行棋', 'Take turns')),
      h('p', null, kind === 'chess' ? text('点击棋子查看合法落点，再点击目标格。支持王车易位、吃过路兵与升变。', 'Select a piece to see legal moves. Castling, en passant and promotion are supported.') : text('横、竖或斜向连成五子即可获胜。15×15 自由规则，长连也算胜利，无禁手。', 'Connect five horizontally, vertically or diagonally. Freestyle 15×15: overlines win, no forbidden moves.')),
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
