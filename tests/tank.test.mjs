import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, stepGame, drawGame } from '../src/engine.js'
const input = (...keys) => ({ keys: new Set(keys), direction: keys.find(key => key.startsWith('Arrow')), pointer: false })
const step = (game, controls = input(), dt = 0.05) => stepGame(game, controls, dt, () => 0)
const emptyField = () => {
  const game = createGame('tank')
  game.walls = []; game.enemies = []; game.spawn = 999; game.invulnerable = 0
  return game
}
const shot = (x, y, team, dx = 0, dy = 1) => ({ x, y, w: 4, h: 4, dx, dy, team })
const enemy = (x, y) => ({ x, y, w: 26, h: 26, direction: 'down', cooldown: 99, decision: 99 })

test('tank map is square with independent destructible bricks, steel and a protected base', () => {
  const game = createGame('tank'), other = createGame('tank')
  assert.equal(game.width, 416); assert.equal(game.height, 416)
  assert.equal(game.lives, 3); assert.equal(game.enemies.length, 3)
  assert.ok(game.walls.some(wall => wall.kind === 'brick'))
  assert.ok(game.walls.some(wall => wall.kind === 'steel'))
  assert.ok(game.walls.some(wall => wall.y === 368 && wall.x === game.base.x))
  game.walls[0].destroyed = true
  assert.equal(other.walls[0].destroyed, undefined)
})

test('walls, other tanks and field edges block movement while allowing turret turns', () => {
  const game = emptyField(); Object.assign(game.player, { x: 3, y: 35 })
  game.walls = [{ x: 32, y: 32, w: 16, h: 16, kind: 'brick' }]
  step(game, input('ArrowRight'))
  assert.equal(game.player.x, 3); assert.equal(game.player.direction, 'right')
  game.walls = []; Object.assign(game.player, { x: 0, y: 0 })
  step(game, input('ArrowLeft')); assert.equal(game.player.x, 0)
  game.enemies = [enemy(28, 0)]
  step(game, input('ArrowRight')); assert.equal(game.player.x, 0)
})

test('turning near a lane aligns the tank into a one-tile passage', () => {
  const game = emptyField(); Object.assign(game.player, { x: 104, y: 99, direction: 'right' })
  step(game, input('ArrowUp'), 0)
  assert.equal(game.player.x, 99); assert.equal(game.player.direction, 'up')
})

test('tank shots follow each of the four facing directions and respect cooldown', () => {
  for (const [key, dx, dy] of [['ArrowUp', 0, -1], ['ArrowRight', 1, 0], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0]]) {
    const game = emptyField(); Object.assign(game.player, { x: 99, y: 99 })
    step(game, input(key, 'Space'), 0)
    assert.equal(game.bullets.length, 1)
    assert.equal(game.bullets[0].dx, dx); assert.equal(game.bullets[0].dy, dy)
    step(game, input('Space'), 0.01); assert.equal(game.bullets.length, 1)
  }
})

test('projectiles destroy brick fragments, stop at steel, and cannot tunnel through walls', () => {
  for (const team of ['player', 'enemy']) for (const kind of ['brick', 'steel']) {
    const game = emptyField()
    game.walls = [{ x: 100, y: 100, w: 16, h: 16, kind }]
    game.bullets = [shot(104, 88, team)]
    step(game)
    assert.equal(game.bullets.length, 0)
    assert.equal(game.walls.length, kind === 'brick' ? 0 : 1)
  }
})

test('destroying an enemy awards 100 once even when multiple shots arrive together', () => {
  const game = emptyField(); game.enemies = [enemy(100, 100)]
  game.bullets = [shot(104, 104, 'player'), shot(108, 104, 'player')]
  step(game, input(), 0)
  assert.equal(game.score, 100); assert.equal(game.enemies.length, 0)
  step(game); assert.equal(game.score, 100)
})

test('enemy hits consume lives, respawn the player and grant temporary protection', () => {
  const game = emptyField()
  for (let remaining = 2; remaining >= 0; remaining--) {
    game.invulnerable = 0
    game.bullets = [shot(game.player.x + 10, game.player.y + 10, 'enemy')]
    step(game, input(), 0)
    assert.equal(game.lives, remaining)
    if (remaining > 0) {
      assert.equal(game.player.y, 387); assert.ok(game.invulnerable > 0)
      game.bullets = [shot(game.player.x + 10, game.player.y + 10, 'enemy')]
      step(game, input(), 0)
      assert.equal(game.lives, remaining)
    }
  }
  assert.equal(game.over, true)
  const time = game.time; step(game); assert.equal(game.time, time)
})

test('base protection must be broken before either faction can destroy the base', () => {
  for (const team of ['player', 'enemy']) {
    const game = emptyField()
    game.walls = [{ x: 200, y: 368, w: 16, h: 16, kind: 'brick' }]
    game.bullets = [shot(204, 360, team)]
    step(game); assert.equal(game.base.destroyed, false); assert.equal(game.walls.length, 0)
    game.bullets = [shot(204, 381, team)]
    step(game); assert.equal(game.base.destroyed, true); assert.equal(game.over, true)
  }
})

test('enemies move, fire and spawn only into unoccupied entrances', () => {
  const game = emptyField(); game.spawn = 0
  step(game); assert.equal(game.enemies.length, 1)
  const moving = game.enemies[0], previousY = moving.y
  moving.cooldown = 0
  step(game); assert.ok(moving.y > previousY)
  assert.ok(game.bullets.some(bullet => bullet.team === 'enemy'))
  const blocked = emptyField(); blocked.spawn = 0
  blocked.enemies = [enemy(3, 3), enemy(195, 3), enemy(387, 3)]
  step(blocked, input(), 0); assert.equal(blocked.enemies.length, 3)
})

test('opposing projectiles cancel one another', () => {
  const game = emptyField()
  game.bullets = [shot(50, 50, 'player', 1, 0), shot(52, 50, 'enemy', -1, 0)]
  step(game, input(), 0); assert.equal(game.bullets.length, 0)
})

test('tank renderer draws the complete map without mutating its state', () => {
  const game = createGame('tank'), before = structuredClone(game)
  const calls = []
  const ctx = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])), set: (target, key, value) => { target[key] = value; return true } })
  drawGame(ctx, game)
  assert.deepEqual(game, before)
  assert.ok(calls.filter(call => call[0] === 'fillRect').length > 190)
  assert.ok(calls.some(call => call[0] === 'rotate'))
})
