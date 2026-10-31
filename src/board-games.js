import { Chess as BoardChess } from 'chess.js'

export function createBoardGame(kind, mode = 'computer') {
  return { kind, mode, chess: kind === 'chess' ? new BoardChess() : null, cells: Array(225).fill(0), moves: [], winner: 0, line: [] }
}
export function gomokuLine(cells, at, player) {
  const x = at % 15, y = Math.floor(at / 15)
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [at]
    for (const sign of [-1, 1]) for (let n = 1; n < 15; n++) {
      const xx = x + dx * n * sign, yy = y + dy * n * sign
      if (xx < 0 || xx > 14 || yy < 0 || yy > 14 || cells[yy * 15 + xx] !== player) break
      line.push(yy * 15 + xx)
    }
    if (line.length >= 5) return line
  }
  return []
}
export function playGomoku(g, at) {
  if (!Number.isInteger(at) || at < 0 || at >= 225 || g.cells[at] || g.winner || g.moves.length === 225) return false
  const player = g.moves.length % 2 + 1
  g.cells[at] = player; g.moves.push(at); g.line = gomokuLine(g.cells, at, player)
  if (g.line.length) g.winner = player
  return true
}
export function undoBoard(g) {
  const count = g.kind === 'chess' ? g.chess.history().length : g.moves.length
  const n = g.mode === 'computer' && count % 2 === 0 ? 2 : 1
  for (let i = 0; i < n; i++) {
    if (g.kind === 'chess') g.chess.undo()
    else if (g.moves.length) g.cells[g.moves.pop()] = 0
  }
  g.winner = 0; g.line = []
}
export function boardResult(g) {
  if (g.kind === 'gomoku') return g.winner ? (g.winner === 1 ? 'blackWin' : 'whiteWin') : g.moves.length === 225 ? 'draw' : null
  if (g.chess.isCheckmate()) return g.chess.turn() === 'w' ? 'blackWin' : 'whiteWin'
  if (g.chess.isStalemate()) return 'stalemate'
  if (g.chess.isDraw()) return 'draw'
  return null
}
export function chooseGomoku(g) {
  if (boardResult(g)) return null
  if (!g.moves.length) return 112
  const player = g.moves.length % 2 + 1, opponent = 3 - player
  const candidates = g.cells.map((v, at) => v ? -1 : at).filter(at => at >= 0 && g.moves.some(p => Math.abs(p % 15 - at % 15) <= 2 && Math.abs(Math.floor(p / 15) - Math.floor(at / 15)) <= 2))
  const shape = (at, who) => {
    g.cells[at] = who
    let score = 0
    if (gomokuLine(g.cells, at, who).length) score = 1e7
    else for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let count = 1, open = 0
      for (const sign of [-1, 1]) for (let n = 1; n <= 5; n++) {
        const x = at % 15 + dx * n * sign, y = Math.floor(at / 15) + dy * n * sign
        if (x < 0 || x > 14 || y < 0 || y > 14) break
        const v = g.cells[y * 15 + x]
        if (v === who) count++
        else { if (!v) open++; break }
      }
      score += open ? [0, 2, 30, 700, 18000][Math.min(count, 4)] * (open === 2 ? 5 : 1) : 0
    }
    g.cells[at] = 0
    return score
  }
  let best = candidates[0], max = -Infinity
  for (const at of candidates) {
    const attack = shape(at, player), defend = shape(at, opponent)
    const value = attack >= 1e7 ? 1e10 : defend >= 1e7 ? 1e9 : attack + defend * 1.1 - Math.hypot(at % 15 - 7, Math.floor(at / 15) - 7)
    if (value > max) { max = value; best = at }
  }
  return best ?? null
}
const BOARD_PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
export function chooseChess(chess, maxMs = 220) {
  if (chess.isGameOver()) return null
  const end = Date.now() + maxMs, color = chess.turn()
  const evaluate = () => {
    if (chess.isCheckmate()) return chess.turn() === color ? -100000 : 100000
    if (chess.isDraw()) return 0
    let value = 0
    chess.board().forEach((row, y) => row.forEach((p, x) => {
      if (!p) return
      const central = (3.5 - Math.abs(x - 3.5) + 3.5 - Math.abs(y - 3.5)) * (p.type === 'n' || p.type === 'b' ? 8 : 2)
      value += (p.color === color ? 1 : -1) * (BOARD_PIECE_VALUE[p.type] + central)
    }))
    return value
  }
  const moves = chess.moves({ verbose: true }).sort((a, b) => (BOARD_PIECE_VALUE[b.captured] || 0) - (BOARD_PIECE_VALUE[a.captured] || 0))
  let best = moves[0], bestValue = -Infinity
  for (const move of moves) {
    chess.move(move)
    let value = evaluate(), complete = true
    if (!chess.isGameOver()) {
      value = Infinity
      for (const reply of chess.moves()) {
        chess.move(reply)
        value = Math.min(value, evaluate()); chess.undo()
        if (value <= bestValue) break
        if (Date.now() > end) { complete = false; break }
      }
    }
    chess.undo()
    if (complete && value > bestValue) { bestValue = value; best = move }
    if (Date.now() > end) break
  }
  return { from: best.from, to: best.to, ...(best.promotion ? { promotion: best.promotion } : {}) }
}
export function serializeBoard(g) {
  return JSON.stringify({ version: 1, kind: g.kind, mode: g.mode, moves: g.kind === 'chess' ? g.chess.history() : g.moves })
}
export function restoreBoard(raw, kind) {
  try {
    if (!raw || raw.length > 40000) return null
    const data = JSON.parse(raw)
    if (data.version !== 1 || data.kind !== kind || !['computer', 'local'].includes(data.mode) || !Array.isArray(data.moves) || data.moves.length > (kind === 'chess' ? 1200 : 225)) return null
    const g = createBoardGame(kind, data.mode)
    for (const move of data.moves) {
      if (boardResult(g)) return null
      if (kind === 'chess') { if (typeof move !== 'string' || move.length > 12 || !g.chess.move(move)) return null }
      else if (!playGomoku(g, move)) return null
    }
    return g
  } catch { return null }
}
