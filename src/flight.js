/** Plane-only progression. Simulation time freezes with the rest of the game. */
export const FLIGHT_PATHS = {
  fire: { zh: ['双发', '散射', '穿透'], en: ['Twin shot', 'Spread', 'Pierce'] },
  guard: { zh: ['护盾', '再生护盾', '紧急救援'], en: ['Shield', 'Regenerating shield', 'Rescue'] },
  move: { zh: ['轻型引擎', '机动引擎', '擦弹充能'], en: ['Light engine', 'Agile engine', 'Graze charge'] },
}
export function createFlight() {
  return { upgrades: { fire: 0, guard: 0, move: 0 }, earned: 0, steps: 0, next: 1, pending: 0, choice: null, choiceId: 0,
    wave: 0, waveCooldown: 0, overflow: 0, salvage: 0, regen: 0, rescued: false, grazes: 0, ready: 0 }
}
export function flightUpgradeName(game, path) {
  const level = game.flight.upgrades[path]
  return FLIGHT_PATHS[path][game.language === 'en' ? 'en' : 'zh'][Math.min(2, level)]
}
export function earnFlightSteps(game, count) {
  const f = game.flight
  if (!f) return
  f.steps += count
  while (f.earned < 9 && f.steps >= f.next) {
    f.pending++; f.earned++; f.next += 1 + f.earned
  }
}
export function chooseFlightUpgrade(game, path) {
  const f = game.flight
  if (!f?.choice?.options.includes(path) || f.upgrades[path] >= 3 || game.over) return false
  f.upgrades[path]++
  if (path === 'guard') { game.escort.shield = 1; f.regen = 0 }
  if (path === 'guard' && f.upgrades.guard === 3) f.rescued = false
  game.escort.drops = game.escort.drops.filter(drop => drop.choiceId !== f.choice.id)
  f.choice = null
  game.escort.notice = `${game.language === 'en' ? 'Upgrade' : '升级'} · ${FLIGHT_PATHS[path][game.language === 'en' ? 'en' : 'zh'][f.upgrades[path] - 1]}`
  game.escort.noticeUntil = game.time + 3
  return true
}
export function stepFlight(game, dt) {
  const f = game.flight, m = game.escort
  f.ready = Math.max(0, f.ready - dt); f.waveCooldown = Math.max(0, f.waveCooldown - dt)
  if (f.upgrades.guard >= 2 && !m.shield) {
    f.regen += dt
    if (f.regen >= 18) { m.shield = 1; f.regen = 0 }
  }
  if (f.pending && !f.choice) {
    const paths = ['fire', 'guard', 'move'].filter(path => f.upgrades[path] < 3)
    const offset = f.choiceId % Math.max(1, paths.length)
    const options = [...paths.slice(offset), ...paths.slice(0, offset)].slice(0, 2)
    if (options.length) {
      f.pending--; f.choice = { id: ++f.choiceId, options, banked: false }
      options.forEach((path, i) => m.drops.push({ x: options.length === 1 ? 148 : i ? 232 : 64, y: 120, w: 24, h: 24,
        type: 'upgrade', path, choiceId: f.choice.id, ttl: 9, speed: 28 }))
      m.notice = game.language === 'en' ? 'Choose one upgrade · catch a capsule or use the buttons' : '二选一升级 · 接住胶囊，或点击升级按钮'
      m.noticeUntil = game.time + 4
    } else f.pending = 0
  }
}
export function damageFlight(game) {
  const m = game.escort, f = game.flight
  if (m.invincible > 0 || f?.ready > 0) return
  if (m.shield) { m.shield = 0; m.invincible = 1.5; if (f) f.regen = 0 }
  else if (f?.upgrades.guard === 3 && !f.rescued) {
    f.rescued = true; m.invincible = 3; m.shots = []; game.enemies = []
    m.notice = game.language === 'en' ? 'Emergency rescue' : '紧急救援生效'; m.noticeUntil = game.time + 3
  } else game.over = true
}
