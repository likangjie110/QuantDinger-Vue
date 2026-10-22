import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRunPayload } from '../../src/views/factor-mining/aiPayload.js'

// The service rejects AI fields on a non-AI run, so the payload the view sends is part of the
// contract, not a presentation detail. The form holds all four keys in both modes; only the mode
// decides which of them travel.

const FORM = {
  sourceId: 7,
  market: 'USStock',
  timeframe: '1D',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  budget: 400,
  seed: 42,
  searchMode: 'enumeration',
  aiRounds: 2,
  aiProposalsPerRound: 10,
  researchNotes: 'momentum turns before earnings'
}

test('an enumeration payload carries no AI fields', () => {
  const payload = buildRunPayload(FORM)
  assert.equal('aiRounds' in payload, false)
  assert.equal('aiProposalsPerRound' in payload, false)
  assert.equal('researchNotes' in payload, false)
  assert.equal('replayJobId' in payload, false)
  assert.equal(payload.searchMode, 'enumeration')
  assert.equal(payload.sourceId, 7)
})

test('a fresh AI payload keeps the AI fields', () => {
  const payload = buildRunPayload({ ...FORM, searchMode: 'ai' })
  assert.equal(payload.aiRounds, 2)
  assert.equal(payload.aiProposalsPerRound, 10)
  assert.equal(payload.researchNotes, 'momentum turns before earnings')
})

test('an explicit replay sends only its AI mode and original job id', () => {
  const payload = buildRunPayload({ ...FORM, searchMode: 'ai', replayJobId: 'job-1', holdoutRatio: 0.1 })
  assert.deepEqual(payload, { searchMode: 'ai', replayJobId: 'job-1' })
})

for (const searchMode of ['enumeration', 'ai']) {
  test(`${searchMode} strips retained evolution fields while preserving holdout`, () => {
    const payload = buildRunPayload({ ...FORM, searchMode, population: 32, generations: 20, eliteRatio: 0.25, holdoutRatio: 0.1 })
    assert.equal('population' in payload, false)
    assert.equal('generations' in payload, false)
    assert.equal('eliteRatio' in payload, false)
    assert.equal(payload.holdoutRatio, 0.1)
  })
}

test('evolution carries its settings and strips retained AI settings', () => {
  const payload = buildRunPayload({ ...FORM, searchMode: 'evolution', population: 32, generations: 20, eliteRatio: 0.25, replayJobId: 'old', holdoutRatio: 0 })
  assert.deepEqual(payload, {
    sourceId: 7, market: 'USStock', timeframe: '1D', startDate: '2024-01-01', endDate: '2024-12-31',
    budget: 400, seed: 42, searchMode: 'evolution', population: 32, generations: 20, eliteRatio: 0.25, holdoutRatio: 0
  })
})

test('building a payload does not mutate the form', () => {
  const form = { ...FORM }
  buildRunPayload(form)
  assert.equal(form.aiRounds, 2)
  assert.equal(form.aiProposalsPerRound, 10)
  assert.equal(form.researchNotes, 'momentum turns before earnings')
})
