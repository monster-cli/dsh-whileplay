/**
 * Xiangqi (Chinese chess) rules engine.
 * Board is 9 files × 10 ranks stored as a flat array of 90 points.
 * x: 0–8 left to right from Red's view, y: 0–9 from Black's back rank (top) to Red's (bottom).
 * Red moves first. Piece: { color: 'r' | 'b', type: 'k' | 'a' | 'e' | 'n' | 'r' | 'c' | 'p' }.
 * Simplification: repetition / long-check ruling is not enforced, so games only end by
 * checkmate or stalemate (both are a loss for the side to move, per xiangqi rules).
 */
export const XIANGQI_FILES = 9
export const XIANGQI_RANKS = 10
const RED = 'r'
const BLACK = 'b'
const BACK_RANK = ['r', 'n', 'e', 'a', 'k', 'a', 'e', 'n', 'r']

export function createXiangqi() {
  const board = Array(XIANGQI_FILES * XIANGQI_RANKS).fill(null)
  const place = (x, y, color, type) => { board[y * XIANGQI_FILES + x] = { color, type } }
  BACK_RANK.forEach((type, x) => { place(x, 0, BLACK, type); place(x, 9, RED, type) })
  for (const x of [1, 7]) { place(x, 2, BLACK, 'c'); place(x, 7, RED, 'c') }
  for (const x of [0, 2, 4, 6, 8]) { place(x, 3, BLACK, 'p'); place(x, 6, RED, 'p') }
  return { board, turn: RED, history: [] }
}

/** Strictly-in-between piece count for two points on one line, or -1 when not aligned. */
function piecesBetween(board, from, to) {
  const fx = from % XIANGQI_FILES, fy = Math.floor(from / XIANGQI_FILES)
  const tx = to % XIANGQI_FILES, ty = Math.floor(to / XIANGQI_FILES)
  if (fx !== tx && fy !== ty) return -1
  const dx = Math.sign(tx - fx), dy = Math.sign(ty - fy)
  let count = 0
  for (let x = fx + dx, y = fy + dy; x !== tx || y !== ty; x += dx, y += dy) {
    if (board[y * XIANGQI_FILES + x]) count++
  }
  return count
}

function generalAt(board, color) {
  for (let at = 0; at < board.length; at++) {
    const piece = board[at]
    if (piece && piece.color === color && piece.type === 'k') return at
  }
  return -1
}

/** Whether the general of `color` is attacked (including the flying-general rule). */
export function xiangqiAttacked(board, color) {
  const g = generalAt(board, color)
  if (g < 0) return true
  const gx = g % XIANGQI_FILES, gy = Math.floor(g / XIANGQI_FILES)
  for (let at = 0; at < board.length; at++) {
    const piece = board[at]
    if (!piece || piece.color === color) continue
    const x = at % XIANGQI_FILES, y = Math.floor(at / XIANGQI_FILES)
    if (piece.type === 'r' || piece.type === 'c') {
      if (x !== gx && y !== gy) continue
      const between = piecesBetween(board, at, g)
      if (piece.type === 'r' ? between === 0 : between === 1) return true
    } else if (piece.type === 'n') {
      const dx = gx - x, dy = gy - y, ax = Math.abs(dx), ay = Math.abs(dy)
      if ((ax === 2 && ay === 1) || (ax === 1 && ay === 2)) {
        const leg = ax === 2 ? y * XIANGQI_FILES + x + Math.sign(dx) : (y + Math.sign(dy)) * XIANGQI_FILES + x
        if (!board[leg]) return true
      }
    } else if (piece.type === 'p') {
      const forward = piece.color === RED ? -1 : 1
      if (x === gx && y + forward === gy) return true
      const crossed = piece.color === RED ? y <= 4 : y >= 5
      if (crossed && y === gy && Math.abs(x - gx) === 1) return true
    } else if (piece.type === 'k') {
      if (x === gx && piecesBetween(board, at, g) === 0) return true
    }
  }
  return false
}

const inPalace = (x, y, color) => x >= 3 && x <= 5 && (color === RED ? y >= 7 && y <= 9 : y >= 0 && y <= 2)
const ownSide = (y, color) => color === RED ? y >= 5 : y <= 4

/** Pseudo-legal destinations for the piece at `from`; king safety is filtered later. */
function pseudoMoves(board, from) {
  const piece = board[from]
  if (!piece) return []
  const x = from % XIANGQI_FILES, y = Math.floor(from / XIANGQI_FILES), out = []
  const push = (tx, ty) => {
    if (tx < 0 || tx >= XIANGQI_FILES || ty < 0 || ty >= XIANGQI_RANKS) return
    const target = board[ty * XIANGQI_FILES + tx]
    if (!target || target.color !== piece.color) out.push(ty * XIANGQI_FILES + tx)
  }
  if (piece.type === 'k') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (inPalace(x + dx, y + dy, piece.color)) push(x + dx, y + dy)
    }
    // Flying general: capture the opposing general down an open file.
    const dir = piece.color === RED ? -1 : 1
    for (let ty = y + dir; ty >= 0 && ty < XIANGQI_RANKS; ty += dir) {
      const target = board[ty * XIANGQI_FILES + x]
      if (target) { if (target.type === 'k') out.push(ty * XIANGQI_FILES + x); break }
    }
  } else if (piece.type === 'a') {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (inPalace(x + dx, y + dy, piece.color)) push(x + dx, y + dy)
    }
  } else if (piece.type === 'e') {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const tx = x + dx, ty = y + dy
      if (tx < 0 || tx >= XIANGQI_FILES || ty < 0 || ty >= XIANGQI_RANKS || !ownSide(ty, piece.color)) continue
      if (!board[(y + dy / 2) * XIANGQI_FILES + x + dx / 2]) push(tx, ty)
    }
  } else if (piece.type === 'n') {
    for (const [dx, dy, lx, ly] of [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]]) {
      if (!board[(y + ly) * XIANGQI_FILES + x + lx]) push(x + dx, y + dy)
    }
  } else if (piece.type === 'r') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let tx = x + dx, ty = y + dy; tx >= 0 && tx < XIANGQI_FILES && ty >= 0 && ty < XIANGQI_RANKS; tx += dx, ty += dy) {
        const target = board[ty * XIANGQI_FILES + tx]
        if (!target) { out.push(ty * XIANGQI_FILES + tx); continue }
        if (target.color !== piece.color) out.push(ty * XIANGQI_FILES + tx)
        break
      }
    }
  } else if (piece.type === 'c') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let screen = false
      for (let tx = x + dx, ty = y + dy; tx >= 0 && tx < XIANGQI_FILES && ty >= 0 && ty < XIANGQI_RANKS; tx += dx, ty += dy) {
        const target = board[ty * XIANGQI_FILES + tx]
        if (!screen) {
          if (!target) out.push(ty * XIANGQI_FILES + tx)
          else screen = true
        } else if (target) {
          if (target.color !== piece.color) out.push(ty * XIANGQI_FILES + tx)
          break
        }
      }
    }
  } else if (piece.type === 'p') {
    const forward = piece.color === RED ? -1 : 1
    push(x, y + forward)
    if (!ownSide(y, piece.color)) { push(x - 1, y); push(x + 1, y) }
  }
  return out
}

function applyMove(state, move) {
  state.board[move.to] = state.board[move.from]
  state.board[move.from] = null
  state.history.push(move)
  state.turn = state.turn === RED ? BLACK : RED
}

/** Legal moves for the piece at `from`, filtered for king safety. */
export function xiangqiMovesFrom(state, from) {
  const piece = state.board[from]
  if (!piece || piece.color !== state.turn) return []
  return pseudoMoves(state.board, from).filter(to => {
    const captured = state.board[to]
    state.board[to] = piece
    state.board[from] = null
    const safe = !xiangqiAttacked(state.board, piece.color)
    state.board[from] = piece
    state.board[to] = captured
    return safe
  }).map(to => ({ from, to, captured: state.board[to] }))
}

/** All legal moves for the side to move. */
export function xiangqiMoves(state) {
  const moves = []
  for (let from = 0; from < state.board.length; from++) {
    const piece = state.board[from]
    if (piece && piece.color === state.turn) moves.push(...xiangqiMovesFrom(state, from))
  }
  return moves
}

/** Play a move; returns true when legal. */
export function xiangqiMove(state, from, to) {
  const move = xiangqiMovesFrom(state, from).find(candidate => candidate.to === to)
  if (!move) return false
  applyMove(state, move)
  return true
}

export function xiangqiUndo(state) {
  const last = state.history.pop()
  if (!last) return false
  state.board[last.from] = state.board[last.to]
  state.board[last.to] = last.captured
  state.turn = state.turn === RED ? BLACK : RED
  return true
}

/** 'redWin' | 'blackWin' when the side to move has no legal move, else null. */
export function xiangqiResult(state) {
  for (let from = 0; from < state.board.length; from++) {
    const piece = state.board[from]
    if (piece && piece.color === state.turn && xiangqiMovesFrom(state, from).length) return null
  }
  return state.turn === RED ? 'blackWin' : 'redWin'
}

const XIANGQI_VALUE = { k: 20000, r: 950, c: 500, n: 420, e: 115, a: 110, p: 90 }
const XIANGQI_MATE = 100000
const SEARCH_TIMEOUT = Symbol('xiangqi search timeout')

/** Iterative alpha-beta search with capture/check continuations. Search never changes history. */
export function chooseXiangqi(state, maxMs = 650) {
  const rootMoves = xiangqiMoves(state)
  if (!rootMoves.length) return null
  const end = Date.now() + Math.max(0, Number.isFinite(maxMs) ? maxMs : 650)
  const history = new Int32Array(90 * 90)
  const killers = Array.from({ length: 16 }, () => [-1, -1])
  let nodes = 0

  const key = move => move.from * 90 + move.to
  const moveScore = (move, ply, preferred = -1) => {
    const id = key(move)
    if (id === preferred) return 2000000
    if (move.captured) return 1000000 + XIANGQI_VALUE[move.captured.type] * 16 - XIANGQI_VALUE[state.board[move.from].type]
    if (killers[ply]?.includes(id)) return 500000
    return history[id]
  }
  const ordered = (moves, ply, preferred = -1) => moves.sort((a, b) => moveScore(b, ply, preferred) - moveScore(a, ply, preferred))
  const make = move => {
    state.board[move.to] = state.board[move.from]
    state.board[move.from] = null
    state.turn = state.turn === RED ? BLACK : RED
  }
  const unmake = move => {
    state.turn = state.turn === RED ? BLACK : RED
    state.board[move.from] = state.board[move.to]
    state.board[move.to] = move.captured
  }
  const checkTime = () => { if ((++nodes & 15) === 0 && Date.now() >= end) throw SEARCH_TIMEOUT }
  const evaluate = () => {
    let score = 0
    for (let at = 0; at < 90; at++) {
      const piece = state.board[at]
      if (!piece) continue
      const x = at % 9, y = Math.floor(at / 9)
      const center = 4 - Math.abs(x - 4)
      const advance = piece.color === RED ? 9 - y : y
      let positional = 0
      if (piece.type === 'p') positional = advance * 5 + (advance >= 5 ? 45 + center * 8 : 0)
      else if (piece.type === 'n') positional = center * 12 + Math.min(advance, 6) * 5
      else if (piece.type === 'c') positional = center * 7 + Math.min(advance, 5) * 3
      else if (piece.type === 'r') positional = center * 4 + Math.min(advance, 6) * 2
      else if (piece.type === 'k') positional = -advance * 8
      const value = XIANGQI_VALUE[piece.type] + positional
      score += piece.color === RED ? value : -value
    }
    return state.turn === RED ? score : -score
  }
  const quiescence = (alpha, beta, ply, remaining) => {
    checkTime()
    // A check or stalemate must be recognized before using a static evaluation.
    const inCheck = xiangqiAttacked(state.board, state.turn)
    const moves = xiangqiMoves(state)
    if (!moves.length) return -XIANGQI_MATE + ply
    const standPat = evaluate()
    if (!inCheck) {
      if (standPat >= beta) return standPat
      if (standPat > alpha) alpha = standPat
      if (remaining <= 0) return alpha
    } else if (remaining < -1) return standPat
    const tactical = inCheck ? moves : moves.filter(move => move.captured)
    ordered(tactical, ply)
    for (const move of tactical) {
      make(move)
      let score
      try { score = -quiescence(-beta, -alpha, ply + 1, remaining - 1) }
      finally { unmake(move) }
      if (score >= beta) return score
      if (score > alpha) alpha = score
    }
    return alpha
  }
  const search = (depth, alpha, beta, ply) => {
    checkTime()
    if (depth <= 0) return quiescence(alpha, beta, ply, 3)
    const moves = xiangqiMoves(state)
    if (!moves.length) return -XIANGQI_MATE + ply
    ordered(moves, ply)
    for (const move of moves) {
      make(move)
      let score
      try { score = -search(depth - 1, -beta, -alpha, ply + 1) }
      finally { unmake(move) }
      if (score >= beta) {
        if (!move.captured && ply < killers.length) {
          const id = key(move)
          if (killers[ply][0] !== id) killers[ply] = [id, killers[ply][0]]
          history[id] += depth * depth
        }
        return score
      }
      if (score > alpha) alpha = score
    }
    return alpha
  }

  ordered(rootMoves, 0)
  let best = rootMoves[0], preferred = -1
  for (let depth = 1; depth <= 6; depth++) {
    let candidate = best, candidateScore = -Infinity, alpha = -XIANGQI_MATE
    ordered(rootMoves, 0, preferred)
    try {
      for (const move of rootMoves) {
        checkTime()
        make(move)
        let score
        try { score = -search(depth - 1, -XIANGQI_MATE, -alpha, 1) }
        finally { unmake(move) }
        if (score > candidateScore) { candidateScore = score; candidate = move }
        if (score > alpha) alpha = score
      }
    } catch (error) {
      if (error !== SEARCH_TIMEOUT) throw error
      break // A partly searched depth cannot replace the last complete result.
    }
    best = candidate
    preferred = key(best)
    if (candidateScore >= XIANGQI_MATE - 6 || Date.now() >= end) break
  }
  return { from: best.from, to: best.to }
}
