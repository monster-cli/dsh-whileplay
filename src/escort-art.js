/** Canvas artwork shared by the escort scene. Rendering never changes the simulation. */
function escortArtPolygon(ctx, points, fill, stroke, width = .7) {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke() }
}

function escortArtGradient(ctx, x0, y0, x1, y1, stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  return gradient
}

let escortWaterTexture
function escortArtWaterTexture() {
  if (escortWaterTexture !== undefined) return escortWaterTexture
  // This optional visual cache contains no session data; rule tests need no DOM/canvas polyfill.
  if (typeof OffscreenCanvas === 'undefined') return null
  const tile = new OffscreenCanvas(192, 192), surface = tile.getContext('2d')
  if (!surface) return null
  const pixels = surface.createImageData(192, 192)
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
    const u = x / 192 * Math.PI * 2, v = y / 192 * Math.PI * 2
    // Integer-frequency interference is seamless at both tile edges; fine grain is fixed.
    const current = Math.sin(u * 3 + Math.sin(v * 2)) * .3 + Math.sin(v * 7 + Math.sin(u * 2)) * .22
      + Math.sin(u * 11 + v * 9) * .11 + Math.cos(u * 19 - v * 13) * .07
    const grain = (((x * 73 + y * 151) ^ (x * y * 17)) & 31) / 31 - .5
    const value = Math.round(121 + current * 75 + grain * 16), offset = (y * 192 + x) * 4
    pixels.data[offset] = value; pixels.data[offset + 1] = value + 7; pixels.data[offset + 2] = value + 9; pixels.data[offset + 3] = 255
  }
  surface.putImageData(pixels, 0, 0); escortWaterTexture = tile
  return tile
}

export function drawEscortOcean(ctx, g, p = {}) {
  ctx.save()
  const time = g.time || 0, scroll = time * 24
  ctx.fillStyle = escortArtGradient(ctx, 0, 0, 480, 720, [
    [0, '#183c48'], [.32, '#123744'], [.68, '#102e3d'], [1, '#0b2434'],
  ])
  ctx.fillRect(0, 0, 480, 720)
  const texture = escortArtWaterTexture()
  if (texture) {
    ctx.save(); ctx.globalAlpha *= .20; ctx.globalCompositeOperation = 'soft-light'
    const textureY = scroll * .72 % 288
    for (let row = -1; row < 3; row++) for (let column = 0; column < 2; column++) ctx.drawImage(texture, column * 288, row * 288 + textureY, 288, 288)
    ctx.restore()
  }
  // Broad light falloff creates depth without drawing bands across the ocean.
  ctx.fillStyle = escortArtGradient(ctx, 0, 0, 480, 0, [
    [0, 'rgba(3,16,28,.22)'], [.33, 'rgba(100,167,174,.045)'], [.7, 'rgba(80,151,166,.025)'], [1, 'rgba(3,16,28,.18)'],
  ])
  ctx.fillRect(0, 0, 480, 720)
  ctx.lineCap = 'round'
  // Each swell has a different length, curvature, speed and opacity; the field is periodic only far offscreen.
  for (let i = 0; i < 150; i++) {
    const x = (i * 127.31 + Math.sin(i * 4.63) * 77 + 480) % 480
    const y = ((i * 83.17 + scroll * (.88 + i % 7 * .037)) % 820) - 50
    const phase = Math.sin(time * .65 + i * 2.7), length = 5 + (i * 13 % 35)
    const alpha = .025 + (i % 6) * .007 + Math.max(0, phase) * .018
    ctx.strokeStyle = `rgba(155,204,205,${alpha})`; ctx.lineWidth = i % 5 === 0 ? 1 : .65
    ctx.beginPath(); ctx.moveTo(x - length / 2, y)
    ctx.bezierCurveTo(x - length / 4, y - 2, x + length / 4, y + 1 + phase, x + length / 2, y - .5)
    ctx.stroke()
    if (i % 3 === 0) {
      ctx.strokeStyle = 'rgba(2,21,35,.11)'; ctx.lineWidth = 1.3
      ctx.beginPath(); ctx.moveTo(x - length / 3, y + 3); ctx.quadraticCurveTo(x, y + 5, x + length / 3, y + 3); ctx.stroke()
    }
  }
  // Small glints are deliberately restrained so moving bullets remain the brightest objects.
  for (let i = 0; i < 54; i++) {
    const x = (i * 193.17) % 480, y = ((i * 107.9 + scroll * 1.07) % 780) - 30
    const shimmer = .025 + Math.max(0, Math.sin(time * .8 + i * 3.7)) * .035
    ctx.fillStyle = `rgba(210,226,207,${shimmer})`; ctx.fillRect(x, y, i % 4 === 0 ? 4 : 1.5, .65)
  }
  ctx.restore()
}

export function drawEscortJet(ctx, g, x, y, scale, angle, hostile = false, hit = false, boss = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale)
  const time = g.time || 0
  const flash = hit ? '#f1f5ec' : null
  const wing = flash || (hostile ? '#6d777c' : '#426d82')
  const wingEdge = flash || (hostile ? '#9c9e99' : '#89adba')
  const body = escortArtGradient(ctx, -7, 0, 7, 0, [
    [0, flash || '#526d79'], [.4, flash || '#d0dcda'], [.64, flash || '#a8bbc0'], [1, flash || '#5b7885'],
  ])
  const accent = hostile ? '#c47a60' : '#9bd6df'
  const silhouette = boss
    ? [[0, -23], [7, -14], [11, -4], [29, 12], [27, 19], [14, 15], [9, 23], [-9, 23], [-14, 15], [-27, 19], [-29, 12], [-11, -4], [-7, -14]]
    : [[0, -29], [5, -16], [6, -7], [23, 10], [21, 16], [7, 10], [6, 21], [12, 25], [10, 28], [0, 23], [-10, 28], [-12, 25], [-6, 21], [-7, 10], [-21, 16], [-23, 10], [-6, -7], [-5, -16]]
  // Aircraft shadows are offset down-sun and sit below the metal body.
  ctx.save(); ctx.translate(hostile ? -4 : 5, hostile ? -8 : 9)
  escortArtPolygon(ctx, silhouette, 'rgba(2,12,20,.22)'); ctx.restore()
  const flame = 5 + Math.sin(time * 39 + x * .7) * 1.7
  for (const engineX of boss ? [-9, 9] : [0]) {
    ctx.fillStyle = hostile ? 'rgba(226,160,107,.13)' : 'rgba(143,211,230,.12)'
    ctx.beginPath(); ctx.ellipse(engineX, 25, boss ? 5 : 4, flame + 6, 0, 0, Math.PI * 2); ctx.fill()
    escortArtPolygon(ctx, [[engineX - 2, 20], [engineX, 24 + flame], [engineX + 2, 20]], hostile ? '#e6bc91' : '#caeaf0')
  }
  escortArtPolygon(ctx, silhouette, wing, wingEdge, .75)
  if (boss) {
    // Twin nacelles and a swept flying-wing plan distinguish the flagship from a scaled fighter.
    for (const side of [-1, 1]) {
      escortArtPolygon(ctx, [[side * 6, -8], [side * 12, -5], [side * 14, 18], [side * 7, 22]], flash || '#485d69', wingEdge, .5)
      ctx.fillStyle = flash || '#b4c1bd'; ctx.fillRect(side < 0 ? -11 : 8, -3, 3, 18)
      escortArtPolygon(ctx, [[side * 12, 0], [side * 26, 12], [side * 23, 13], [side * 12, 5]], flash || '#84928f')
      ctx.fillStyle = '#243d4a'; ctx.fillRect(side < 0 ? -12 : 7, 17, 5, 4)
    }
    escortArtPolygon(ctx, [[0, -23], [5, -13], [5, 10], [0, 16], [-5, 10], [-5, -13]], body)
  } else {
    for (const side of [-1, 1]) {
      escortArtPolygon(ctx, [[side * 6, -6], [side * 20, 10], [side * 9, 8], [side * 6, 2]], flash || (hostile ? '#93968f' : '#7198a8'))
      ctx.strokeStyle = hostile ? '#4f5e65' : '#254e65'; ctx.lineWidth = .65
      ctx.beginPath(); ctx.moveTo(side * 8, 5); ctx.lineTo(side * 18, 13); ctx.moveTo(side * 7, 18); ctx.lineTo(side * 10, 25); ctx.stroke()
      // Wing hardpoints and small navigation lamps provide recognizable scale.
      ctx.fillStyle = '#b5c5c7'; ctx.fillRect(side < 0 ? -16 : 14, 7, 2, 7)
      ctx.fillStyle = accent; ctx.fillRect(side < 0 ? -22 : 20, 11, 2, 2)
    }
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(0, -29)
    ctx.bezierCurveTo(3, -25, 6, -14, 5, -3); ctx.lineTo(4, 18); ctx.lineTo(2.5, 22); ctx.lineTo(-2.5, 22); ctx.lineTo(-4, 18); ctx.lineTo(-5, -3)
    ctx.bezierCurveTo(-6, -14, -3, -25, 0, -29); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#dbe7df'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(-.7, -26); ctx.lineTo(-1.5, 18); ctx.stroke()
    ctx.fillStyle = '#304b5b'; ctx.fillRect(-3, 17, 6, 5)
  }
  const glass = escortArtGradient(ctx, -3, -14, 3, -3, [[0, '#d5e9df'], [.28, '#7fa7b5'], [.55, '#214e68'], [1, '#132e41']])
  ctx.fillStyle = flash || glass; ctx.beginPath(); ctx.moveTo(0, -18); ctx.bezierCurveTo(4, -14, 4, -8, 0, -5); ctx.bezierCurveTo(-4, -8, -4, -14, 0, -18); ctx.fill()
  ctx.strokeStyle = '#acc2c4'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(-1, -15); ctx.lineTo(-1.5, -10); ctx.stroke()
  ctx.fillStyle = accent; ctx.fillRect(-1, 1, 2, 5)
  // A small wing insignia gives each side an identity without covering the silhouette.
  ctx.strokeStyle = hostile ? '#d88b70' : '#d4e7df'; ctx.lineWidth = .75
  ctx.beginPath(); ctx.arc(boss ? 18 : 12, boss ? 11 : 9, boss ? 2.1 : 1.5, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

export function drawEscortConvoy(ctx, g) {
  const c = g.convoy, time = g.time || 0
  ctx.save(); ctx.translate(c.x, c.y)
  // A soft propeller wash and small broken bow waves replace repeated outline chevrons.
  ctx.fillStyle = escortArtGradient(ctx, 0, 26, 0, 139, [[0, 'rgba(182,220,213,.18)'], [.35, 'rgba(146,195,196,.10)'], [1, 'rgba(146,195,196,0)']])
  ctx.beginPath(); ctx.moveTo(-7, 27); ctx.lineTo(-27, 139); ctx.quadraticCurveTo(0, 151, 27, 139); ctx.lineTo(7, 27); ctx.closePath(); ctx.fill()
  for (let i = 0; i < 24; i++) {
    const age = (i * .119 + time * .5) % 2.8, side = i % 2 ? 1 : -1
    const spread = 7 + age * 11, py = 32 + age * 32
    ctx.strokeStyle = `rgba(206,229,219,${(1 - age / 2.8) * .25})`; ctx.lineWidth = .65 + i % 3 * .25
    ctx.beginPath(); ctx.moveTo(side * spread, py); ctx.quadraticCurveTo(side * (spread + 4), py + 4, side * (spread + 8), py + 3); ctx.stroke()
    if (i % 3 === 0) { ctx.fillStyle = `rgba(214,235,225,${(1 - age / 2.8) * .2})`; ctx.fillRect(side * (spread - 4), py + 1, 1.5, 2) }
  }
  ctx.fillStyle = 'rgba(1,13,22,.26)'; ctx.beginPath(); ctx.ellipse(7, 8, 24, 44, -.05, 0, Math.PI * 2); ctx.fill()
  const hull = escortArtGradient(ctx, -21, 0, 21, 0, [[0, '#38535d'], [.16, '#708c94'], [.4, '#becbc6'], [.72, '#92a9ac'], [1, '#4c6873']])
  ctx.fillStyle = hull; ctx.strokeStyle = '#becfc8'; ctx.lineWidth = .8
  ctx.beginPath(); ctx.moveTo(0, -44); ctx.bezierCurveTo(14, -34, 21, -17, 20, 7); ctx.lineTo(18, 34); ctx.quadraticCurveTo(0, 38, -18, 34); ctx.lineTo(-20, 7); ctx.bezierCurveTo(-21, -17, -14, -34, 0, -44); ctx.closePath(); ctx.fill(); ctx.stroke()
  // Hull stripe, narrow gangways, deck framing and cargo lashings.
  ctx.strokeStyle = '#254c5d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-17, -9); ctx.lineTo(-16, 30); ctx.moveTo(17, -9); ctx.lineTo(16, 30); ctx.stroke()
  ctx.fillStyle = '#536d72'; ctx.fillRect(-14, -14, 28, 44)
  ctx.strokeStyle = '#b8c6bc'; ctx.lineWidth = .7; ctx.strokeRect(-14, -14, 28, 44)
  const cargoColors = ['#ae956c', '#6e9294', '#947e61', '#7c9a91', '#b2a277', '#628791']
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
    const x = -12 + col * 13, y = -10 + row * 12
    ctx.fillStyle = 'rgba(7,24,29,.45)'; ctx.fillRect(x + 1, y + 1, 11, 10)
    ctx.fillStyle = col < g.cargo.length ? cargoColors[row * 2 + col] : '#4b646c'; ctx.fillRect(x, y, 11, 10)
    ctx.fillStyle = 'rgba(223,230,208,.25)'; ctx.fillRect(x, y, 11, 1)
    ctx.strokeStyle = 'rgba(30,52,53,.42)'; ctx.lineWidth = .5
    for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(x + j * 2.7, y + 2); ctx.lineTo(x + j * 2.7, y + 8); ctx.stroke() }
  }
  // Forward bridge with glazing, roof equipment, mast and anchor deck.
  ctx.fillStyle = '#2e464f'; ctx.fillRect(-11, -26, 23, 12)
  ctx.fillStyle = '#d0d8cb'; ctx.fillRect(-11, -28, 22, 11)
  ctx.fillStyle = '#264f68'; ctx.fillRect(-9, -27, 18, 3)
  ctx.fillStyle = '#8eafb3'; for (let i = 0; i < 5; i++) ctx.fillRect(-8 + i * 3.5, -27, 2.4, 1)
  ctx.fillStyle = '#adbbb4'; ctx.fillRect(-6, -23, 12, 5)
  ctx.fillStyle = '#e1e5d3'; ctx.fillRect(-4, -22, 3, 2); ctx.fillRect(2, -22, 3, 2)
  ctx.strokeStyle = '#d4decd'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, -27); ctx.moveTo(-5, -33); ctx.lineTo(5, -33); ctx.stroke()
  ctx.fillStyle = '#3f5962'; ctx.beginPath(); ctx.arc(0, -35, 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#caaf76'; ctx.fillRect(-13, 31, 3, 2); ctx.fillRect(10, 31, 3, 2)
  ctx.strokeStyle = 'rgba(225,240,226,.5)'; ctx.lineWidth = .8
  ctx.beginPath(); ctx.moveTo(-2, -45); ctx.quadraticCurveTo(-17, -33, -22, -14); ctx.moveTo(2, -45); ctx.quadraticCurveTo(17, -33, 22, -14); ctx.stroke()
  ctx.fillStyle = '#0d2430'; ctx.fillRect(-27, -56, 54, 4)
  ctx.fillStyle = c.hp > 30 ? '#a2c8b5' : '#df9276'; ctx.fillRect(-27, -56, 54 * Math.max(0, c.hp) / 100, 3)
  if (g.shield) {
    ctx.strokeStyle = 'rgba(144,213,216,.65)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(0, -1, 32, 54, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(167,227,222,.18)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.ellipse(0, -1, 34, 56, 0, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}
