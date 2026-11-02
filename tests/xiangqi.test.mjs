import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createXiangqi, xiangqiMovesFrom, xiangqiMove, xiangqiUndo, xiangqiAttacked, xiangqiResult, chooseXiangqi } from '../src/xiangqi.js'
import { createBoardGame, playXiangqi, boardResult, undoBoard, serializeBoard, restoreBoard } from '../src/board-games.js'

const at = (x, y) => y * 9 + x
/** Custom position; generals default to (4,9) red / (3,0) black unless overridden via rk / bk keys. */
function custom(pieces = {}, turn = 'r') {
  const state = { board: Array(90).fill(null), turn, history: [] }
  const put = (key, x, y) => { state.board[at(x, y)] = { color: key[0], type: key[1] } }
  if (!pieces.rk) put('rk', 4, 9)
  if (!pieces.bk) put('bk', 3, 0)
  for (const [key, [x, y]] of Object.entries(pieces)) put(key, x, y)
  return state
}
const sorted = moves => moves.map(m => m.to).sort((a, b) => a - b)

test('xiangqi initial setup mirrors both armies and red moves first', () => {
  const s = createXiangqi()
  assert.equal(s.board.filter(Boolean).length, 32)
  assert.deepEqual(s.board[at(4, 9)], { color: 'r', type: 'k' })
  assert.deepEqual(s.board[at(4, 0)], { color: 'b', type: 'k' })
  assert.deepEqual(s.board[at(0, 9)], { color: 'r', type: 'r' })
  assert.deepEqual(s.board[at(8, 0)], { color: 'b', type: 'r' })
  assert.deepEqual(s.board[at(1, 7)], { color: 'r', type: 'c' })
  assert.deepEqual(s.board[at(4, 6)], { color: 'r', type: 'p' })
  assert.equal(s.turn, 'r')
})

test('horse moves in 日 and is blocked by an occupied leg', () => {
  const s = createXiangqi()
  assert.deepEqual(sorted(xiangqiMovesFrom(s, at(1, 9))), [at(0, 7), at(2, 7)].sort((a, b) => a - b)) // (3,8) blocked by 相 at (2,9)
  const blocked = custom({ rn: [4, 4], rp: [4, 3] })
  assert.equal(xiangqiMovesFrom(blocked, at(4, 4)).some(m => m.to === at(3, 2) || m.to === at(5, 2)), false)
  const free = custom({ rn: [4, 4] })
  assert.equal(xiangqiMovesFrom(free, at(4, 4)).length, 8)
})

test('elephant moves in 田, cannot cross the river or jump a blocked eye', () => {
  const s = createXiangqi()
  assert.deepEqual(sorted(xiangqiMovesFrom(s, at(2, 9))), [at(0, 7), at(4, 7)].sort((a, b) => a - b))
  const s2 = custom({ re: [4, 5] })
  assert.equal(xiangqiMovesFrom(s2, at(4, 5)).some(m => m.to === at(2, 3) || m.to === at(6, 3)), false) // river
  const s3 = custom({ re: [2, 9], bp: [3, 8] })
  assert.equal(xiangqiMovesFrom(s3, at(2, 9)).some(m => m.to === at(4, 7)), false) // 塞象眼
})

test('advisor and general stay inside the palace', () => {
  const s = createXiangqi()
  assert.deepEqual(sorted(xiangqiMovesFrom(s, at(3, 9))), [at(4, 8)])
  const g = custom({})
  assert.deepEqual(sorted(xiangqiMovesFrom(g, at(4, 9))), [at(4, 8), at(5, 9)].sort((a, b) => a - b)) // (3,9) would face the black general at (3,0)
})

test('rook slides until blocked; cannon needs exactly one screen to capture', () => {
  const s = custom({ rr: [0, 5], br: [0, 1] })
  const rookMoves = xiangqiMovesFrom(s, at(0, 5)).map(m => m.to)
  assert.ok(rookMoves.includes(at(0, 1)) && rookMoves.includes(at(8, 5)))
  assert.ok(!rookMoves.includes(at(0, 0))) // cannot pass the black rook
  const c = custom({ rc: [1, 7], bp: [1, 4], bn: [1, 2] })
  const cannonMoves = xiangqiMovesFrom(c, at(1, 7)).map(m => m.to)
  assert.ok(cannonMoves.includes(at(1, 2)))  // capture over the pawn screen
  assert.ok(!cannonMoves.includes(at(1, 4))) // no capture without a screen
  assert.ok(cannonMoves.includes(at(1, 6)))  // quiet move
})

test('soldier advances, gains sideways steps across the river, never retreats', () => {
  const before = custom({ rp: [0, 6] })
  assert.deepEqual(sorted(xiangqiMovesFrom(before, at(0, 6))), [at(0, 5)])
  const after = custom({ rp: [4, 4] })
  assert.deepEqual(sorted(xiangqiMovesFrom(after, at(4, 4))), [at(3, 4), at(4, 3), at(5, 4)].sort((a, b) => a - b))
})

test('flying general: facing generals attack and opening the file is illegal', () => {
  const facing = custom({ bk: [4, 0] })
  assert.equal(xiangqiAttacked(facing.board, 'b'), true)
  const pinned = custom({ rr: [4, 5], bk: [4, 0] })
  assert.deepEqual(sorted(xiangqiMovesFrom(pinned, at(4, 5))), [at(4, 0), at(4, 1), at(4, 2), at(4, 3), at(4, 4), at(4, 6), at(4, 7), at(4, 8)].sort((a, b) => a - b)) // pinned to the file, sideways moves expose the generals
})

test('checkmate and stalemate both lose for the side to move', () => {
  // Ladder mate: rank 0 covered by one rook, rank 1 by another.
  const mate = custom({ rk: [3, 9], rr: [0, 0], rr2: [1, 1], bk: [4, 0] }, 'b')
  assert.equal(xiangqiAttacked(mate.board, 'b'), true)
  assert.equal(xiangqiResult(mate), 'redWin')
  // Not in check, but every square around the black general is covered: stalemate loses too.
  const stuck = custom({ rr: [1, 1], rr2: [4, 5] }, 'b') // black general at default (3,0)
  assert.equal(xiangqiAttacked(stuck.board, 'b'), false)
  assert.equal(xiangqiResult(stuck), 'redWin')
  assert.equal(xiangqiResult(createXiangqi()), null)
})

test('chooseXiangqi is read-only, takes a hanging rook and finds mate in one', () => {
  const hanging = custom({ rk: [5, 9], rr: [0, 9], br: [0, 0] }) // no mate in one available, so the rook capture must win
  const snapshot = JSON.stringify(hanging)
  const capture = chooseXiangqi(hanging)
  assert.equal(JSON.stringify(hanging), snapshot)
  assert.deepEqual(capture, { from: at(0, 9), to: at(0, 0) })
  const mateInOne = custom({ rk: [3, 9], rr: [0, 1], rr2: [8, 1], bk: [4, 0] })
  const mate = chooseXiangqi(mateInOne)
  xiangqiMove(mateInOne, mate.from, mate.to)
  assert.equal(xiangqiResult(mateInOne), 'redWin')
  const done = custom({ rk: [3, 9], rr: [0, 0], rr2: [1, 1], bk: [4, 0] }, 'b')
  assert.equal(xiangqiResult(done), 'redWin')
  assert.equal(chooseXiangqi(done), null)
})

test('board-games integration: play, reject illegal moves, undo by mode', () => {
  const g = createBoardGame('xiangqi')
  assert.equal(boardResult(g), null)
  assert.equal(playXiangqi(g, at(1, 7), at(4, 7)), true)  // red central cannon
  assert.equal(playXiangqi(g, at(1, 2), at(1, 9)), false) // cannon cannot capture without a screen
  assert.equal(playXiangqi(g, at(1, 9), at(2, 7)), false) // not red's turn anymore
  assert.equal(playXiangqi(g, at(7, 0), at(6, 2)), true)  // black horse out
  assert.equal(g.xiangqi.history.length, 2)
  undoBoard(g) // computer mode undoes a full pair
  assert.equal(g.xiangqi.history.length, 0)
  assert.deepEqual(g.xiangqi.board[at(1, 7)], { color: 'r', type: 'c' })
  const local = createBoardGame('xiangqi', 'local')
  playXiangqi(local, at(1, 9), at(2, 7)); playXiangqi(local, at(1, 0), at(2, 2))
  undoBoard(local) // two-player mode undoes a single ply
  assert.equal(local.xiangqi.history.length, 1)
  assert.deepEqual(local.xiangqi.board[at(1, 0)], { color: 'b', type: 'n' })
})

test('xiangqi saves round-trip and reject corrupted or foreign data', () => {
  const g = createBoardGame('xiangqi')
  playXiangqi(g, at(1, 7), at(4, 7)); playXiangqi(g, at(7, 0), at(6, 2)); playXiangqi(g, at(1, 9), at(2, 7))
  const restored = restoreBoard(serializeBoard(g), 'xiangqi')
  assert.deepEqual(restored.xiangqi.board, g.xiangqi.board)
  assert.equal(restored.xiangqi.history.length, 3)
  assert.equal(restored.xiangqi.turn, 'b')
  assert.equal(restoreBoard(serializeBoard(g), 'chess'), null)
  assert.equal(restoreBoard('{bad', 'xiangqi'), null)
  assert.equal(restoreBoard(JSON.stringify({ version: 1, kind: 'xiangqi', mode: 'computer', moves: [641] }), 'xiangqi'), null) // illegal move
  assert.equal(restoreBoard(JSON.stringify({ version: 1, kind: 'xiangqi', mode: 'computer', moves: [9999] }), 'xiangqi'), null) // off board
})

test('undo restores a captured piece and the turn order', () => {
  const s = custom({ rr: [0, 9], br: [0, 0] })
  assert.equal(xiangqiMove(s, at(0, 9), at(0, 0)), true)
  assert.equal(s.board[at(0, 0)].color, 'r')
  assert.equal(s.turn, 'b')
  assert.equal(xiangqiUndo(s), true)
  assert.deepEqual(s.board[at(0, 0)], { color: 'b', type: 'r' })
  assert.deepEqual(s.board[at(0, 9)], { color: 'r', type: 'r' })
  assert.equal(s.turn, 'r')
  assert.equal(xiangqiUndo(custom({})), false) // nothing to undo
})
