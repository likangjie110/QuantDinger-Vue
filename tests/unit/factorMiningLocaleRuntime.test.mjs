import test from 'node:test'
import assert from 'node:assert/strict'

import Vue from 'vue'
import VueI18n from 'vue-i18n'

import factorMiningMessages from '../../src/locales/factor-mining-overrides.js'

// The contract test next door proves the keys exist. This one proves they resolve.
//
// The catalog is a flat map whose keys carry their own dots, and the bundle layers this file over
// it with a shallow spread. Whether `i18n.t('factorMining.submit.budget')` finds a key stored
// under exactly that literal spelling is a property of the runtime, not of the file, so it is
// checked by building the same message shape the app builds and asking it.

Vue.use(VueI18n)

// A stand-in for the shared catalog entries this view borrows rather than defines.
const SHARED = { 'common.actions': 'Action', 'common.cancel': 'Cancel', 'common.refresh': 'Refresh' }

function build (locale) {
  return new VueI18n({
    locale,
    fallbackLocale: locale,
    silentTranslationWarn: true,
    silentFallbackWarn: true,
    messages: { [locale]: { ...SHARED, ...factorMiningMessages[locale] } }
  })
}

test('a flat factor-mining key resolves through the runtime, not just in the file', () => {
  // The shallow spread the app performs, then a lookup -- the two together, at runtime.
  const cases = {
    'zh-CN': { 'factorMining.title': '全自动因子挖掘', 'factorMining.submit.budget': '预算' },
    'en-US': { 'factorMining.submit.budget': 'Budget' }
  }
  for (const [locale, expectations] of Object.entries(cases)) {
    const i18n = build(locale)
    for (const [key, expected] of Object.entries(expectations)) {
      assert.equal(i18n.t(key), expected, `${locale}:${key}`)
    }
  }
})

test('a borrowed shared key still resolves beside the feature copy', () => {
  // This is the shape that a nested `common` object in the feature file would break.
  const i18n = build('en-US')
  assert.equal(i18n.t('common.actions'), 'Action')
  assert.equal(i18n.t('common.cancel'), 'Cancel')
  assert.equal(i18n.t('factorMining.submit.submit'), 'Submit job')
})

test('an interpolated family resolves, and an unknown key falls back to itself', () => {
  const i18n = build('zh-CN')
  for (const status of ['queued', 'running', 'succeeded', 'failed', 'cancelled']) {
    const text = i18n.t(`factorMining.jobStatus.${status}`)
    assert.notEqual(text, `factorMining.jobStatus.${status}`, status)
  }
  // The view renders `msg` straight from the backend, so an unknown key has to survive as itself
  // rather than as an empty string.
  assert.equal(i18n.t('factorMining.notAKey'), 'factorMining.notAKey')
})
