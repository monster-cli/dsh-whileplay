import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultArcadeWindow, fitArcadeWindow, moveArcadeWindow, resizeArcadeWindow } from '../src/window.js'
const viewport = { width: 1280, height: 900 }
const rect = { x: 100, y: 100, width: 720, height: 680 }

test('default and moved windows stay reachable within the viewport', () => {
  for (const size of [viewport, { width: 390, height: 844 }, { width: 320, height: 240 }]) {
    const frame = defaultArcadeWindow(size)
    assert.ok(frame.x >= 8 && frame.y >= 8)
    assert.ok(frame.x + frame.width <= size.width - 8)
    assert.ok(frame.y + frame.height <= size.height - 8)
    const moved = moveArcadeWindow(frame, -5000, 5000, size)
    assert.equal(moved.x, 8)
    assert.ok(moved.y + moved.height <= size.height - 8)
  }
})

test('all eight resize handles resize their requested edges and respect minimum size', () => {
  const east = resizeArcadeWindow(rect, 'e', 50, 0, viewport)
  assert.equal(east.width, 770); assert.equal(east.x, 100)
  const west = resizeArcadeWindow(rect, 'w', 50, 0, viewport)
  assert.equal(west.width, 670); assert.equal(west.x + west.width, rect.x + rect.width)
  const north = resizeArcadeWindow(rect, 'n', 0, 50, viewport)
  assert.equal(north.height, 630); assert.equal(north.y + north.height, rect.y + rect.height)
  const south = resizeArcadeWindow(rect, 's', 0, 50, viewport)
  assert.equal(south.height, 730)
  for (const edge of ['ne', 'nw', 'se', 'sw']) {
    const resized = resizeArcadeWindow(rect, edge, 40, 40, viewport)
    assert.equal(resized.width, rect.width + (edge.includes('w') ? -40 : 40))
    assert.equal(resized.height, rect.height + (edge.includes('n') ? -40 : 40))
  }
  const small = resizeArcadeWindow(rect, 'se', -2000, -2000, viewport)
  assert.equal(small.width, 420); assert.equal(small.height, 400)
})

test('compact resize maintains each game aspect ratio without leaving the viewport', () => {
  for (const ratio of [2 / 3, 1, 1.5]) {
    const options = { minimal: true, ratio }
    const initial = fitArcadeWindow({ x: 100, y: 100, width: 240 }, viewport, options)
    for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const resized = resizeArcadeWindow(initial, edge, 500, 500, viewport, options)
      assert.ok(Math.abs((resized.width - 2) / (resized.height - 2) - ratio) < 0.0001)
      assert.ok(resized.x + resized.width <= viewport.width - 8)
      assert.ok(resized.y + resized.height <= viewport.height - 8)
    }
  }
})

test('viewport changes shrink and relocate full and compact windows into view', () => {
  const smaller = { width: 390, height: 600 }
  const oversized = { x: 1000, y: 800, width: 900, height: 900 }
  for (const options of [{}, { minimal: true, ratio: 2 / 3 }]) {
    const frame = fitArcadeWindow(oversized, smaller, options)
    assert.ok(frame.x >= 8 && frame.y >= 8)
    assert.ok(frame.x + frame.width <= smaller.width - 8)
    assert.ok(frame.y + frame.height <= smaller.height - 8)
  }
})
