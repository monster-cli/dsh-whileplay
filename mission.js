/** Bounded read model: arguments, output and paths never leave this fold. */
export const initialMission = () => ({ turn: -1, seq: -1, running: false, total: 0, completed: 0, failed: 0, calls: [], steps: 0, lastStep: -1 })
export function foldMission(state, event) {
  if (event.type === 'turn/start') return { ...initialMission(), turn: event.seq, seq: event.seq, running: true }
  if (event.type === 'turn/end') return { ...state, seq: event.seq, running: false }
  if (event.type === 'step/end') {
    if (!Number.isSafeInteger(event.data.step) || event.data.step <= state.lastStep) return state
    return { ...state, seq: event.seq, steps: state.steps + 1, lastStep: event.data.step }
  }
  if (event.type === 'tool/call') {
    const id = String(event.data.callId)
    if (state.calls.some(call => call.id === id)) return state
    const calls = [...state.calls, { id, name: String(event.data.name).slice(0, 64), phase: 'running', seq: event.seq }]
    if (calls.length > 128) calls.splice(Math.max(0, calls.findIndex(call => call.phase !== 'running')), 1)
    return { ...state, seq: event.seq, total: state.total + 1, calls }
  }
  if (event.type === 'tool/result') {
    const id = String(event.data.message.source.callId)
    const call = state.calls.find(call => call.id === id)
    if (!call || call.phase !== 'running') return state
    const failed = event.data.message.isError === true || event.data.error !== undefined
    return { ...state, seq: event.seq, completed: state.completed + 1, failed: state.failed + Number(failed),
      calls: state.calls.map(call => call.id === id ? { ...call, phase: failed ? 'error' : 'done', seq: event.seq } : call) }
  }
  return state
}
