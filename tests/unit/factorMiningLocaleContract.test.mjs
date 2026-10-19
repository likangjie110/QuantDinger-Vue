import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import factorMiningMessages from '../../src/locales/factor-mining-overrides.js'

// The factor-mining view is only reachable behind a login, so a missing key would surface as a
// raw `factorMining.submit.budget` on a customer's screen rather than in any build. These tests
// read the components and pin every key they ask for against both locales.

const HERE = dirname(fileURLToPath(import.meta.url))
const VIEW = resolve(HERE, '../../src/views/factor-mining')

const SOURCES = [
  `${VIEW}/index.vue`,
  `${VIEW}/components/SubmitJob.vue`,
  `${VIEW}/components/JobList.vue`,
  `${VIEW}/components/CandidateList.vue`
]

const LOCALES = ['en-US', 'zh-CN']

// `$t('literal')` only. A template literal that interpolates is a family (`factorMining.jobStatus.
// ${status}`), and the families are pinned by the exhaustive lists below instead.
const STATIC_KEY_RE = /\$t\(\s*['"]([^'"]+)['"]\s*\)/g

// Keys the view resolves through a variable, so no source scan can see the concrete spellings.
const STATUS_KEYS = ['queued', 'running', 'succeeded', 'failed', 'cancelled']
const CANDIDATE_STATUS_KEYS = ['search', 'frozen', 'rejected']
const PROPOSAL_STATUS_KEYS = ['proposed', 'evaluated', 'l1Rejected', 'duplicate']
const MARKET_KEYS = ['Crypto', 'USStock', 'CNStock', 'HKStock', 'Forex', 'Futures', 'MOEX']

// The backend answers a rejection with an i18n key in `msg`; the view renders it through the same
// catalog, so a key the service can emit and the bundle cannot resolve is a visible defect. This
// is the key list from docs/product/FACTOR_MINING.md, minus the two parameterised families
// (`templateNotFound:<id>`, `fingerprintInvalid:<index>`, `reject.invalid:<reason>`) whose prefix
// is covered by their bare key.
const BACKEND_KEYS = [
  'runFailed', 'estimateFailed', 'jobNotFound', 'candidateNotFound', 'invalidQuery',
  'invalidParameter', 'thresholdsInvalid', 'sourceRequired', 'sourceNotFound',
  'sourceCodeRequired', 'dateRangeRequired', 'dateRangeTooShort', 'invalidMarket',
  'budgetInvalid', 'budgetExceeded', 'concurrentLimit', 'workerInterrupted',
  'freezeRatioInvalid', 'searchFreezeOverlap', 'universeTooSmall', 'usableUniverseTooSmall',
  'noMarketData', 'missingIcSeries', 'runNotFound', 'templateNotFound', 'fingerprintInvalid',
  'aiProposalFailed', 'aiNoValidProposals', 'aiReplayNotFound', 'aiReplayIncompatible'
]

const REJECT_KEYS = [
  'invalid', 'lowCoverage', 'insufficientObservations', 'weakIc', 'weakIcir', 'unstableFolds',
  'unstableHalves', 'highTurnover', 'duplicateBuiltin', 'duplicateProposal',
  'unverifiableRedundancy', 'weakOutOfSample', 'selectionBias'
]

function keysUsedInSources () {
  const keys = new Set()
  for (const file of SOURCES) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(STATIC_KEY_RE)) keys.add(match[1])
  }
  return [...keys].sort()
}

function requiredKeys () {
  return [
    ...keysUsedInSources(),
    ...STATUS_KEYS.map(status => `factorMining.jobStatus.${status}`),
    ...CANDIDATE_STATUS_KEYS.map(status => `factorMining.candidateStatus.${status}`),
    ...PROPOSAL_STATUS_KEYS.map(status => `factorMining.proposalStatus.${status}`),
    ...MARKET_KEYS.map(market => `factorMining.markets.${market}`),
    ...BACKEND_KEYS.map(key => `factorMining.${key}`),
    ...REJECT_KEYS.map(key => `factorMining.reject.${key}`)
  ]
}

// The shared catalog owns the `common.*` namespace this view borrows from, and this file is
// merged over that catalog rather than beside it: a key the view asks for that only the shared
// catalog can answer is checked there, because redefining it here would be the bug.
const SHARED_CATALOGS = {
  'en-US': resolve(HERE, '../../src/locales/lang/en-US.js'),
  'zh-CN': resolve(HERE, '../../src/locales/lang/zh-CN.js')
}

function isOwnedByThisFile (key) {
  return key.startsWith('factorMining.') || key === 'menu.dashboard.factorMining'
}

function appearsInCatalog (catalogText, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`['"]${escaped}['"]\\s*:`).test(catalogText)
}

test('every key the factor-mining view asks for is translated in both locales', () => {
  const missing = []
  for (const locale of LOCALES) {
    const own = factorMiningMessages[locale]
    const catalogText = readFileSync(SHARED_CATALOGS[locale], 'utf8')
    for (const key of requiredKeys()) {
      if (isOwnedByThisFile(key)) {
        if (typeof own[key] !== 'string' || !own[key].length) missing.push(`${locale}:${key}`)
      } else if (!appearsInCatalog(catalogText, key)) {
        missing.push(`${locale}:${key}`)
      }
    }
  }
  assert.deepEqual(missing, [])
})

test('the two factor-mining locales hold the same key set', () => {
  const [base, ...rest] = LOCALES.map(locale => Object.keys(factorMiningMessages[locale]).sort())
  for (const keys of rest) assert.deepEqual(keys, base)
})

test('a translated key is never answered with the key itself', () => {
  // A value equal to its own key is how a half-finished locale hides: the screen renders
  // `factorMining.submit.budget` and no test notices.
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(factorMiningMessages[locale])) {
      assert.notEqual(value, key, `${locale}:${key}`)
    }
  }
})

test('the menu entry the router names resolves in both locales', () => {
  // `src/config/router.config.js` titles the route `menu.dashboard.factorMining`.
  for (const locale of LOCALES) {
    assert.equal(typeof factorMiningMessages[locale]['menu.dashboard.factorMining'], 'string')
    assert.notEqual(factorMiningMessages[locale]['menu.dashboard.factorMining'].length, 0)
  }
})

test('the factor-mining copy defines no nested namespace that would replace a shared one', () => {
  // The bundle merges this file over the shared catalog with a shallow spread, so a nested object
  // here would drop every sibling key of that namespace.
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(factorMiningMessages[locale])) {
      assert.equal(typeof value, 'string', `${locale}:${key}`)
    }
  }
})

test('the factor-mining copy stays inside its own namespace', () => {
  // `common.*` belongs to the base catalogs: this file is merged over them, so a key added here
  // would shadow a shared one the moment the base catalog grows the same name -- and the search
  // for it would land in a feature file. Borrow a shared key, never mint one.
  for (const locale of LOCALES) {
    for (const key of Object.keys(factorMiningMessages[locale])) {
      assert.ok(isOwnedByThisFile(key), `${locale}:${key}`)
    }
  }
})

test('the factor-mining copy is merged into every catalog path, not just one', () => {
  // `src/locales/index.js` builds the same catalog three times -- the initial default-locale
  // object, `mergeLocaleOverrides`, and the lazy loader -- and a file spread into some of them
  // but not all renders as raw keys in the paths it missed. Importing the module is not proof,
  // so the wiring is counted against a sibling known to be complete.
  const source = readFileSync(resolve(HERE, '../../src/locales/index.js'), 'utf8')
  const references = name => source.split(`${name}[`).length - 1
  assert.equal(
    references('factorMiningMessages'),
    references('quickTradeSpotSellMessages'),
    'factor-mining must be spread into as many catalog paths as an established sibling'
  )
})
