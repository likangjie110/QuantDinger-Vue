// The run endpoints refuse AI fields on a non-AI search (`factorMining.invalidParameter`), and the
// form keeps those values while the user switches modes. Strip them here, once, so the estimate
// and the submission always carry the same payload.
export function buildRunPayload (form) {
  const payload = { ...form }
  if (payload.searchMode !== 'ai') {
    delete payload.aiRounds
    delete payload.aiProposalsPerRound
    delete payload.researchNotes
    delete payload.replayJobId
  }
  return payload
}
