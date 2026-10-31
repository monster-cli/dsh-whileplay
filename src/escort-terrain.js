/** Physical task landmarks, projected from simulation time without extra save state. */
export const ESCORT_ROUTE_NODES = [
  { id: 'radar', name: '雷达岛', task: '设计交互', x: 126, arrival: 15, berthY: 520 },
  { id: 'supply', name: '补给岛', task: '实现番茄钟', x: 350, arrival: 36, berthY: 460 },
  { id: 'reef', name: '礁石水道', task: '联调与检查', x: 240, arrival: 49, berthY: 400 },
  { id: 'harbor', name: '交付港', task: '交付网页和说明', x: 240, arrival: 62, berthY: 330 },
]

export function escortRouteStage(g) {
  if (g.mode === 'live') {
    const todos = g.live?.todos || []
    const active = todos.findIndex(todo => todo.status === 'in_progress')
    if (active >= 0) return active
    const pending = todos.findIndex(todo => todo.status === 'pending')
    return pending >= 0 ? pending : Math.max(0, todos.length - 1)
  }
  const active = g.todos.findIndex(status => status === '进行中')
  if (active >= 0) return active
  return g.todos.every(status => status === '已完成') ? 3 : 0
}

export function escortRouteLandmarks(g) {
  if (g.mode === 'live') {
    const todos = g.live?.todos || [], stage = escortRouteStage(g), start = Math.max(0, stage - 1)
    // The current Todo anchors the route. Elapsed play time never advances real work.
    return todos.slice(start, start + 4).map((todo, offset) => {
      const index = start + offset, template = ESCORT_ROUTE_NODES[index === todos.length - 1 ? 3 : index % 3]
      return { ...template, index, task: todo.content, y: 345 + (stage - index) * 240,
        status: ({ pending: '待处理', in_progress: '进行中', completed: '已完成' })[todo.status] || '待处理', active: index === stage }
    })
  }
  return ESCORT_ROUTE_NODES.map((node, i) => ({ ...node,
    y: node.berthY + (g.time - node.arrival) * 24,
    status: g.todos[i], active: i === escortRouteStage(g),
  }))
}

// Stable texture noise keeps the terrain identical after pause or save restoration.
function terrainNoise(n) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function terrainIsland(ctx, x, y, rx, ry, seed, time) {
  ctx.save(); ctx.translate(x, y)
  const points = Array.from({ length: 32 }, (_, i) => {
    const a = i / 32 * Math.PI * 2, r = 1 + .085 * Math.sin(a * 5 + seed) + .035 * Math.cos(a * 9)
    return { x: Math.cos(a) * rx * r, y: Math.sin(a) * ry * r }
  })
  const shape = scale => {
    ctx.beginPath()
    const last = points[points.length - 1], first = points[0]
    ctx.moveTo((last.x + first.x) * scale / 2, (last.y + first.y) * scale / 2)
    for (let i = 0; i < points.length; i++) {
      const point = points[i], next = points[(i + 1) % points.length]
      ctx.quadraticCurveTo(point.x * scale, point.y * scale, (point.x + next.x) * scale / 2, (point.y + next.y) * scale / 2)
    }
    ctx.closePath()
  }
  // Soft underwater shelf and occasional breaking foam, not concentric map outlines.
  ctx.fillStyle = '#2c6468'; ctx.globalAlpha = .17; shape(1.24); ctx.fill()
  ctx.globalAlpha = .22; ctx.fillStyle = '#14383f'; ctx.save(); ctx.translate(4, 6); shape(1.07); ctx.fill(); ctx.restore()
  ctx.globalAlpha = 1
  const beach = ctx.createLinearGradient(-rx, -ry, rx, ry)
  beach.addColorStop(0, '#a5a38a'); beach.addColorStop(.55, '#778372'); beach.addColorStop(1, '#465e55')
  ctx.fillStyle = beach; shape(1); ctx.fill()
  ctx.save(); shape(.91); ctx.clip()
  const earth = ctx.createLinearGradient(-rx, -ry, rx, ry)
  earth.addColorStop(0, '#667550'); earth.addColorStop(.5, '#415d42'); earth.addColorStop(1, '#2e4b3b')
  ctx.fillStyle = earth; ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4)
  for (let i = 0; i < 160; i++) {
    const px = (terrainNoise(seed * 100 + i * 3) * 2 - 1) * rx, py = (terrainNoise(seed * 100 + i * 3 + 1) * 2 - 1) * ry
    ctx.globalAlpha = .09 + terrainNoise(i + seed) * .13; ctx.fillStyle = i % 3 ? '#a1ad78' : '#172e2a'
    ctx.fillRect(px, py, 1 + i % 3, 1 + i % 2)
  }
  ctx.globalAlpha = 1; ctx.restore()
  // Small, irregular overlapping crowns form groves rather than a ring of beads.
  for (let i = 0; i < 22; i++) {
    const angle = i * 2.4 + seed, r = .4 + terrainNoise(i + seed * 9) * .38
    const px = Math.cos(angle) * rx * r, py = Math.sin(angle) * ry * r
    if (Math.abs(px) < 25 && Math.abs(py) < 31) continue
    ctx.save(); ctx.translate(px, py)
    ctx.fillStyle = '#1c352c'; ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(3, 4, 8, 10, .4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
    for (let j = 0; j < 5; j++) {
      const a = j * 2.3 + i, dx = Math.cos(a) * 3, dy = Math.sin(a) * 3
      ctx.fillStyle = ['#36563b', '#496743', '#5f7850', '#3d5e3f', '#69805a'][j]
      ctx.beginPath(); ctx.ellipse(dx, dy, 3.8 + j % 2, 5.2, a, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  ctx.strokeStyle = '#c1d8ce'; ctx.lineWidth = .9
  for (let i = 0; i < 12; i++) {
    const a = i * .52 + seed, swell = Math.sin(time * 1.2 + i) * .018, scale = 1.025 + swell
    const px = Math.cos(a) * rx * (1 + .085 * Math.sin(a * 5 + seed) + .035 * Math.cos(a * 9)) * scale
    const py = Math.sin(a) * ry * (1 + .085 * Math.sin(a * 5 + seed) + .035 * Math.cos(a * 9)) * scale
    ctx.globalAlpha = .12 + Math.max(0, Math.sin(time * 1.5 + i * 2)) * .17
    ctx.beginPath(); ctx.moveTo(px - Math.sin(a) * 3, py + Math.cos(a) * 3); ctx.lineTo(px + Math.sin(a) * 4, py - Math.cos(a) * 4); ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

function terrainRock(ctx, x, y, radius, seed, time) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(seed)
  ctx.fillStyle = '#285965'; ctx.globalAlpha = .22; ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.8, radius * 1.15, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = .18; ctx.strokeStyle = '#c0dbd5'; ctx.lineWidth = .7
  ctx.beginPath(); ctx.ellipse(0, 2, radius * (1.25 + Math.sin(time * 2 + seed) * .05), radius * .9, 0, .25, Math.PI * 1.15); ctx.stroke(); ctx.globalAlpha = 1
  ctx.fillStyle = '#36424a'; ctx.beginPath(); ctx.moveTo(-radius, 0); ctx.lineTo(-radius * .5, -radius * .65); ctx.lineTo(radius * .3, -radius * .85); ctx.lineTo(radius, -radius * .1); ctx.lineTo(radius * .7, radius * .6); ctx.lineTo(-radius * .5, radius * .6); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#86918a'; ctx.beginPath(); ctx.moveTo(-radius * .5, -radius * .65); ctx.lineTo(radius * .3, -radius * .85); ctx.lineTo(radius * .22, 0); ctx.lineTo(-radius * .8, radius * .15); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#b5b8a5'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-radius * .5, -radius * .65); ctx.lineTo(radius * .3, -radius * .85); ctx.lineTo(radius, -radius * .1); ctx.stroke()
  ctx.strokeStyle = '#3c5054'; ctx.lineWidth = .7
  ctx.beginPath(); ctx.moveTo(radius * .3, -radius * .78); ctx.lineTo(radius * .17, -radius * .2); ctx.lineTo(radius * .5, radius * .14); ctx.moveTo(-radius * .8, 0); ctx.lineTo(-radius * .2, -radius * .27); ctx.stroke()
  for (let i = 0; i < 14; i++) {
    const px = (terrainNoise(i + seed * 17) - .5) * radius * 1.1, py = (terrainNoise(i * 2 + seed) - .7) * radius
    ctx.fillStyle = i % 2 ? '#b5b8a5' : '#283d42'; ctx.globalAlpha = .2; ctx.fillRect(px, py, .9, .9)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

function terrainBuilding(ctx, x, y, w, h, color) {
  ctx.fillStyle = '#1a302b'; ctx.globalAlpha = .6; ctx.fillRect(x + 4, y + 5, w + 2, h); ctx.globalAlpha = 1
  ctx.fillStyle = '#9b9b85'; ctx.fillRect(x, y, w, h)
  ctx.fillStyle = color; ctx.fillRect(x - 2, y - 2, w + 4, h - 3)
  ctx.strokeStyle = '#c5c6ac'; ctx.globalAlpha = .38; ctx.lineWidth = .6
  for (let i = 4; i < w; i += 5) { ctx.beginPath(); ctx.moveTo(x + i, y - 1); ctx.lineTo(x + i, y + h - 6); ctx.stroke() }
  ctx.globalAlpha = 1; ctx.fillStyle = '#344c52'; ctx.fillRect(x + w / 2 - 3, y + h - 5, 6, 5)
  ctx.strokeStyle = '#c5c6ac'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + w + 2, y - 2); ctx.lineTo(x + w + 2, y + h - 5); ctx.stroke()
  ctx.fillStyle = '#3c5457'; ctx.fillRect(x + 4, y + 2, 5, 3)
  ctx.fillStyle = '#adb5a1'; ctx.fillRect(x + w - 8, y + 3, 4, 4)
}

function terrainTaskLabel(ctx, node, index) {
  const left = node.id === 'radar' || node.id === 'reef'
  const x = left ? 16 : 280, width = 184
  const anchorX = node.id === 'reef' ? 145 : node.id === 'harbor' ? 335 : node.x
  const anchorY = node.y + (node.id === 'reef' ? 88 : node.id === 'harbor' ? 72 : 92)
  const y = Math.max(83, anchorY + 13)
  if (anchorY < 52 || y + 44 > 679) return
  const done = node.status === '已完成', accent = done ? '#90bc9d' : node.active ? '#c6dda9' : '#7393a0'
  ctx.save(); ctx.lineWidth = .8; ctx.strokeStyle = accent; ctx.globalAlpha = .6
  ctx.beginPath(); ctx.moveTo(anchorX, anchorY); ctx.lineTo(anchorX, y); ctx.stroke(); ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(7, 25, 34, .92)'; ctx.strokeStyle = node.active ? '#5d796c' : '#2c4850'
  ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + width - 5, y); ctx.quadraticCurveTo(x + width, y, x + width, y + 5); ctx.lineTo(x + width, y + 39); ctx.quadraticCurveTo(x + width, y + 44, x + width - 5, y + 44); ctx.lineTo(x + 5, y + 44); ctx.quadraticCurveTo(x, y + 44, x, y + 39); ctx.lineTo(x, y + 5); ctx.quadraticCurveTo(x, y, x + 5, y); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = accent; ctx.fillRect(x, y + 8, 2, 27)
  const task = Array.from(String(node.task || '')), title = task.length > 11 ? task.slice(0, 10).join('') + '…' : task.join('')
  ctx.textAlign = 'left'; ctx.font = '600 13px sans-serif'; ctx.fillText(`${done ? '✓' : String((node.index ?? index) + 1).padStart(2, '0')}  ${title}`, x + 11, y + 18)
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#9bb3b7'; ctx.fillText(`${node.name} · ${node.status}`, x + 11, y + 34)
  ctx.restore()
}

export function drawEscortTerrain(ctx, g) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, 52, 480, 633); ctx.clip()
  for (const [index, node] of escortRouteLandmarks(g).entries()) {
    if (node.y < -160 || node.y > 870) continue
    const { x, y } = node
    if (node.id === 'radar') {
      terrainIsland(ctx, x, y, 47, 66, 2, g.time)
      terrainBuilding(ctx, x - 18, y + 11, 26, 19, '#758579')
      ctx.fillStyle = '#7c8275'; ctx.fillRect(x - 12, y - 28, 25, 29)
      ctx.strokeStyle = '#bccac3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 21); ctx.lineTo(x - 8, y - 1); ctx.moveTo(x, y - 21); ctx.lineTo(x + 8, y - 1); ctx.stroke()
      ctx.save(); ctx.translate(x, y - 23); ctx.rotate(Math.sin(g.time * .6) * .7)
      ctx.fillStyle = '#c2cfc4'; ctx.beginPath(); ctx.ellipse(0, 0, 17, 8, -.3, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#71878a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, -.3, 0, Math.PI * 2); ctx.moveTo(0, 0); ctx.lineTo(8, -11); ctx.stroke(); ctx.restore()
      terrainRock(ctx, x + 42, y + 77, 10, .7, g.time)
    } else if (node.id === 'supply') {
      terrainIsland(ctx, x, y, 49, 63, 5, g.time)
      ctx.fillStyle = '#75847f'; ctx.fillRect(x - 14, y + 42, 24, 58)
      ctx.strokeStyle = '#a6b2a5'; ctx.lineWidth = 1
      for (let j = 0; j < 7; j++) { ctx.beginPath(); ctx.moveTo(x - 13, y + 45 + j * 8); ctx.lineTo(x + 9, y + 45 + j * 8); ctx.stroke() }
      terrainBuilding(ctx, x - 25, y - 28, 44, 27, '#a79169')
      terrainBuilding(ctx, x - 21, y + 8, 22, 18, '#6b8581')
      ctx.fillStyle = '#b29b70'; ctx.fillRect(x + 8, y + 11, 10, 14); ctx.fillRect(x + 8, y + 30, 10, 14)
      ctx.fillStyle = '#c3bc92'; for (let j = 0; j < 3; j++) { ctx.fillRect(x - 17, y + 55 + j * 18, 3, 4); ctx.fillRect(x + 11, y + 55 + j * 18, 3, 4) }
    } else if (node.id === 'reef') {
      for (const [rx, ry, radius, seed] of [[145, -70, 22, .2], [178, -25, 15, .8], [137, 45, 27, 1.5], [185, 82, 11, 2.1], [333, -45, 24, 1.1], [304, 12, 15, .4], [349, 67, 21, 2.5]]) terrainRock(ctx, rx, y + ry, radius, seed, g.time)
    } else {
      terrainIsland(ctx, 123, y - 47, 52, 80, 3, g.time)
      terrainIsland(ctx, 354, y - 40, 54, 75, 8, g.time)
      // Two quays face the clear central approach; the back wall is beyond the bow at arrival.
      ctx.fillStyle = '#273c42'; ctx.fillRect(133, y - 108, 218, 25)
      ctx.fillStyle = '#7e8a84'; ctx.fillRect(130, y - 113, 220, 20)
      for (const px of [164, 294]) {
        ctx.fillStyle = '#2a4147'; ctx.fillRect(px + 4, y - 96, 26, 172)
        ctx.fillStyle = '#8c9690'; ctx.fillRect(px, y - 98, 23, 170)
        ctx.fillStyle = '#bec5b1'; ctx.fillRect(px + (px < 240 ? 20 : 0), y - 98, 3, 170)
        for (let j = 0; j < 7; j++) { ctx.fillStyle = '#b9a167'; ctx.fillRect(px + 8, y - 86 + j * 24, 6, 4) }
      }
      terrainBuilding(ctx, 104, y - 67, 37, 27, '#9b8c73'); terrainBuilding(ctx, 332, y - 76, 38, 25, '#6e8885')
      ctx.strokeStyle = '#c3b076'; ctx.lineWidth = 3
      for (const px of [145, 333]) { ctx.beginPath(); ctx.moveTo(px, y - 28); ctx.lineTo(px, y + 14); ctx.lineTo(px + (px < 240 ? 24 : -24), y + 14); ctx.stroke() }
      ctx.fillStyle = '#d9d3aa'; ctx.fillRect(184, y + 67, 4, 5); ctx.fillRect(293, y + 67, 4, 5)
    }
    terrainTaskLabel(ctx, node, index)
  }
  ctx.restore()
}
