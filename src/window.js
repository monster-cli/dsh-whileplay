/** Keep a floating window reachable without changing the game's physical coordinates. */
const WINDOW_MARGIN = 8
const windowClamp = (value, low, high) => Math.max(low, Math.min(high, value))

export function fitArcadeWindow(rect, viewport, options = {}) {
  const maxWidth = Math.max(1, viewport.width - WINDOW_MARGIN * 2)
  const maxHeight = Math.max(1, viewport.height - WINDOW_MARGIN * 2)
  let width, height
  if (options.minimal) {
    const ratio = options.ratio
    const maximum = Math.min(maxWidth, Math.max(1, (maxHeight - 2) * ratio + 2))
    width = windowClamp(rect.width, Math.min(160, maximum), maximum)
    height = (width - 2) / ratio + 2
  } else {
    width = windowClamp(rect.width, Math.min(420, maxWidth), maxWidth)
    height = windowClamp(rect.height, Math.min(400, maxHeight), maxHeight)
  }
  return {
    x: windowClamp(rect.x, WINDOW_MARGIN, Math.max(WINDOW_MARGIN, viewport.width - width - WINDOW_MARGIN)),
    y: windowClamp(rect.y, WINDOW_MARGIN, Math.max(WINDOW_MARGIN, viewport.height - height - WINDOW_MARGIN)),
    width, height,
  }
}

export function defaultArcadeWindow(viewport) {
  const width = Math.min(720, viewport.width - 32), height = Math.min(780, viewport.height - 48)
  return fitArcadeWindow({ x: viewport.width - width - 24, y: viewport.height - height - 24, width, height }, viewport)
}

export function moveArcadeWindow(rect, dx, dy, viewport, options = {}) {
  return fitArcadeWindow({ ...rect, x: rect.x + dx, y: rect.y + dy }, viewport, options)
}

/** Resize against the opposite edge; compact windows retain the canvas aspect ratio. */
export function resizeArcadeWindow(rect, edge, dx, dy, viewport, options = {}) {
  let width = rect.width + (edge.includes('w') ? -dx : edge.includes('e') ? dx : 0)
  let height = rect.height + (edge.includes('n') ? -dy : edge.includes('s') ? dy : 0)
  if (options.minimal) {
    const verticalWidth = (height - 2) * options.ratio + 2
    if (!/[ew]/.test(edge) || (/[ns]/.test(edge) && Math.abs(verticalWidth - rect.width) > Math.abs(width - rect.width))) width = verticalWidth
  }
  const sized = fitArcadeWindow({ ...rect, width, height }, viewport, options)
  const x = edge.includes('w') ? rect.x + rect.width - sized.width : rect.x
  const y = edge.includes('n') ? rect.y + rect.height - sized.height : rect.y
  return fitArcadeWindow({ ...sized, x, y }, viewport, options)
}
