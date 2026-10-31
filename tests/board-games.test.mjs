import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { createBoardGame, playGomoku, gomokuLine, chooseGomoku, chooseChess, boardResult, undoBoard, serializeBoard, restoreBoard } from '../src/board-games.js'

test('chess rules cover king safety, castling, en passant and all promotions', () => {
  const pinned = new Chess('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1')
  assert.ok(!pinned.moves({ square: 'e2', verbose: true }).some(m => m.to === 'd2'))
  const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
  castle.move('O-O'); assert.equal(castle.get('f1').type, 'r'); assert.equal(castle.get('g1').type, 'k')
  const passant = new Chess(); ['e4', 'a6', 'e5', 'd5', 'exd6'].forEach(m => passant.move(m))
  assert.equal(passant.get('d5'), undefined); assert.equal(passant.get('d6').color, 'w')
  const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1')
  assert.deepEqual(promotion.moves({ square: 'a7', verbose: true }).map(m => m.promotion).sort(), ['b', 'n', 'q', 'r'])
})
test('chess terminal positions, legal computer moves and read-only search', () => {
  const g = createBoardGame('chess'); ['f3', 'e5', 'g4', 'Qh4#'].forEach(m => g.chess.move(m))
  assert.equal(boardResult(g), 'blackWin'); assert.equal(chooseChess(g.chess), null)
  g.chess = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); assert.equal(boardResult(g), 'stalemate')
  const chess = new Chess(); chess.move('e4'); const fen = chess.fen(), history = chess.history()
  const move = chooseChess(chess); assert.equal(chess.fen(), fen); assert.deepEqual(chess.history(), history); assert.ok(chess.move(move))
})
test('saved chess replays repetition history; undo pairs and rejects corrupted saves', () => {
  const g = createBoardGame('chess'); ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'].forEach(m => g.chess.move(m))
  const restored = restoreBoard(serializeBoard(g), 'chess'); assert.equal(boardResult(restored), 'draw')
  undoBoard(restored); assert.equal(restored.chess.history().length, 6)
  assert.equal(restoreBoard('{bad', 'chess'), null)
  assert.equal(restoreBoard(JSON.stringify({ version: 1, kind: 'chess', mode: 'computer', moves: ['e5'] }), 'chess'), null)
})
test('gomoku wins in four directions and does not wrap at board edges', () => {
  for (const step of [1, 15, 16, 14]) {
    const cells = Array(225).fill(0), start = step === 14 ? 10 : 32
    for (let n = 0; n < 5; n++) cells[start + n * step] = 1
    assert.equal(gomokuLine(cells, start, 1).length, 5)
  }
  const cells = Array(225).fill(0); [13, 14, 15, 16, 17].forEach(i => cells[i] = 1)
  assert.equal(gomokuLine(cells, 14, 1).length, 0)
})
test('gomoku computer wins or blocks an immediate five without mutating the board', () => {
  const g = createBoardGame('gomoku')
  ;[0, 15, 1, 16, 2, 17, 3].forEach(at => playGomoku(g, at))
  const before = serializeBoard(g); assert.equal(chooseGomoku(g), 4); assert.equal(serializeBoard(g), before)
  playGomoku(g, 18); assert.equal(chooseGomoku(g), 4)
  playGomoku(g, 4); assert.equal(boardResult(g), 'blackWin'); assert.equal(playGomoku(g, 50), false)
  assert.equal(chooseGomoku(g), null)
})
test('gomoku rejects occupied and invalid points, restores and undoes a complete turn', () => {
  const g = createBoardGame('gomoku'); assert.equal(chooseGomoku(g), 112)
  assert.equal(playGomoku(g, -1), false); assert.equal(playGomoku(g, 1.5), false)
  playGomoku(g, 112); assert.equal(playGomoku(g, 112), false); playGomoku(g, 113)
  const restored = restoreBoard(serializeBoard(g), 'gomoku'); assert.deepEqual(restored.cells, g.cells)
  undoBoard(restored); assert.equal(restored.moves.length, 0); assert.equal(restored.cells.filter(Boolean).length, 0)
  assert.equal(restoreBoard(serializeBoard(g), 'chess'), null)
})
