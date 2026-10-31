/** Bounded task identity and declared deliveries for the current Session turn. */
export const initialEscortMission = () => ({ turn: -1, seq: -1, turnStartedAt: null, running: false, request: '', endReason: null, cargo: [] })

const brief = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

export function foldEscortMission(state, event) {
  if (!Number.isSafeInteger(event?.seq) || event.seq <= state.seq) return state
  const data = event.data || {}
  if (event.type === 'turn/start') return { ...initialEscortMission(), turn: event.seq, seq: event.seq, turnStartedAt: Number.isFinite(event.time) && event.time >= 0 ? event.time : null, running: true, request: state.request }
  if (event.type === 'turn/end') return { ...state, seq: event.seq, running: false, endReason: brief(data.reason?.kind, 64) || null }
  if (event.type === 'user/message') {
    if (data.source?.kind !== 'user' || !Array.isArray(data.content)) return state
    const request = brief(data.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join(' '), 120)
    return request ? { ...state, seq: event.seq, request } : state
  }
  if (event.type === 'deliverables/presented' && Array.isArray(data.files)) {
    const cargo = [...state.cargo]
    for (const file of data.files) {
      if (typeof file?.path !== 'string') continue
      const filename = brief(file.path.split(/[\\/]/).at(-1), 80)
      if (!filename || filename === '.' || filename === '..' || cargo.includes(filename)) continue
      if (cargo.length === 24) break
      cargo.push(filename)
    }
    return { ...state, seq: event.seq, cargo }
  }
  return state
}
