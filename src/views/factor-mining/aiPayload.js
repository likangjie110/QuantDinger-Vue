// Keep inactive mode settings in the form, but never send them to the run endpoints.
// A replay inherits its entire config on the server; form defaults must not override it.
export function buildRunPayload (form) {
  if (form.searchMode === 'ai' && form.replayJobId) {
    return { searchMode: 'ai', replayJobId: form.replayJobId }
  }
  const payload = { ...form }
  if (payload.searchMode !== 'evolution') {
    delete payload.population
    delete payload.generations
    delete payload.eliteRatio
  }
  if (payload.searchMode !== 'ai') {
    delete payload.aiRounds
    delete payload.aiProposalsPerRound
    delete payload.researchNotes
    delete payload.replayJobId
  }
  return payload
}
