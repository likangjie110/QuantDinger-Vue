import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Vue from 'vue'
import compiler from 'vue-template-compiler'
import moment from 'moment'
import { buildRunPayload } from '../../src/views/factor-mining/aiPayload.js'
import messages from '../../src/locales/factor-mining-overrides.js'

// Run the actual SFC options and compiled render functions; replace only network boundaries.
function component (file, dependencies = {}, overrides = {}) {
  const source = readFileSync(new URL(`../../src/views/factor-mining/${file}`, import.meta.url), 'utf8')
  const sfc = compiler.parseComponent(source)
  const deps = { buildRunPayload, moment, ...dependencies }
  const script = sfc.script.content.replace(/^import .+ from .+$/gm, '').replace('export default', 'return')
  const options = new Function(...Object.keys(deps), script)(...Object.values(deps))
  const compiled = compiler.compileToFunctions(sfc.template.content)
  return new Vue({
    ...options,
    ...compiled,
    propsData: overrides,
    beforeCreate () {
      this.$t = key => messages['en-US'][key] || key
      this.$message = { error () {}, success () {} }
      Vue.util.defineReactive(this, '$route', { path: '/factor-mining', query: {} })
      Object.assign(this, overrides)
    }
  })
}

function nodes (node) {
  if (!node) return []
  return [node, ...(node.children || []).flatMap(nodes)]
}

function text (vm) {
  return nodes(vm._render()).map(node => node.text || '').join(' ')
}

function ruleError (rule, value) {
  let error
  rule({}, value, result => { error = result })
  return error
}

test('new evolution jobs submit default breeding settings and reserve a holdout', async () => {
  const sent = []
  const vm = component('components/SubmitJob.vue', { submitJob: async payload => { sent.push(payload); return { code: 1, data: { jobId: 'new' } } } })
  vm.$refs.form = { validate: async () => true }
  vm.form.searchMode = 'evolution'
  vm.form.sourceId = 7
  vm.form.startDate = '2024-01-01'
  vm.form.endDate = '2024-12-31'
  await vm.handleSubmit()
  assert.equal(sent[0].population, 32)
  assert.equal(sent[0].generations, 20)
  assert.equal(sent[0].eliteRatio, 0.25)
  assert.equal(sent[0].holdoutRatio, 0.1)
  assert.equal('aiRounds' in sent[0], false)
  assert.match(text(vm), /Evolution search/)
})

test('evolution bounds reject missing, fractional counts and invalid elite ratios only in evolution', () => {
  const vm = component('components/SubmitJob.vue')
  vm.form.searchMode = 'evolution'
  for (const [field, invalid, valid] of [
    ['population', [null, '', 0, 1.5, Infinity], [1, 32]],
    ['generations', [null, '', 0, 1.5, Infinity], [1, 20]],
    ['eliteRatio', [null, '', -0.01, 1, NaN], [0, 0.25, 0.99]]
  ]) {
    const validator = vm.rules[field]?.[0]?.validator
    assert.equal(typeof validator, 'function', field)
    for (const value of invalid) assert.ok(ruleError(validator, value), `${field}:${value}`)
    for (const value of valid) assert.equal(ruleError(validator, value), undefined, `${field}:${value}`)
    vm.form.searchMode = 'enumeration'
    assert.equal(ruleError(validator, null), undefined)
    vm.form.searchMode = 'evolution'
  }
})

test('holdout validation accepts zero through .30 and rejects empty or non-finite values', () => {
  const vm = component('components/SubmitJob.vue')
  const validator = vm.rules.holdoutRatio?.[0]?.validator
  assert.equal(typeof validator, 'function')
  for (const value of [0, 0.1, 0.3]) assert.equal(ruleError(validator, value), undefined)
  for (const value of [null, '', -0.01, 0.31, NaN, Infinity]) assert.ok(ruleError(validator, value))
})

test('replay bypasses ordinary form validation and estimation and uses the minimal payload', async () => {
  const sent = []
  let estimates = 0
  const vm = component('components/SubmitJob.vue', {
    submitJob: async payload => { sent.push(payload); return { code: 1, data: { jobId: 'replayed' } } },
    estimateJob: async () => { estimates++; throw new Error('replay must not estimate a fabricated config') }
  })
  vm.replayJob = { jobId: 'original', config: { sourceId: 7, searchMode: 'ai' } }
  vm.$refs.form = { validate: async () => false }
  await vm.handleEstimate()
  await vm.handleSubmit()
  assert.deepEqual(sent, [{ searchMode: 'ai', replayJobId: 'original' }])
  assert.equal(estimates, 0)
})

test('failed replay retains its source and reports the translated backend error', async () => {
  const errors = []
  const vm = component('components/SubmitJob.vue', {
    submitJob: async () => { throw { response: { data: { msg: 'factorMining.aiReplayNotFound' } } } }
  })
  vm.$message.error = error => errors.push(error)
  vm.replayJob = { jobId: 'original', config: {} }
  vm.$refs.form = { validate: async () => false }
  await vm.handleSubmit()
  assert.equal(vm.replayJob.jobId, 'original')
  assert.deepEqual(errors, [messages['en-US']['factorMining.aiReplayNotFound']])
  assert.equal(vm.submitting, false)
})

test('changing a run setting clears an obsolete estimate', async () => {
  const vm = component('components/SubmitJob.vue')
  vm.estimate = { candidateBudget: 100 }
  vm.form.holdoutRatio = 0.2
  await Vue.nextTick()
  assert.equal(vm.estimate, null)
})

test('an estimate that finishes after its form changes cannot enable submission', async () => {
  let resolveEstimate
  const vm = component('components/SubmitJob.vue', {
    estimateJob: () => new Promise(resolve => { resolveEstimate = resolve })
  })
  vm.$refs.form = { validate: async () => true }
  const pending = vm.handleEstimate()
  await Vue.nextTick()
  vm.form.holdoutRatio = 0.2
  resolveEstimate({ code: 1, data: { candidateBudget: 400 } })
  await pending
  assert.equal(vm.estimate, null)
  assert.equal(vm.estimating, false)
})

test('only replayable terminal AI jobs expose an explicit replay action', () => {
  const vm = component('components/JobList.vue')
  for (const [status, mode, expected] of [
    ['succeeded', 'ai', true], ['failed', 'ai', true], ['queued', 'ai', false],
    ['running', 'ai', false], ['cancelled', 'ai', false], ['succeeded', 'evolution', false]
  ]) {
    vm.detail = { jobId: 'original', status, config: { searchMode: mode } }
    assert.equal(vm.canReplay, expected, `${status}/${mode}`)
  }
  vm.detail = { jobId: 'original', status: 'succeeded', config: { searchMode: 'ai' } }
  let selected
  vm.$on('replay', job => { selected = job.jobId })
  vm.startReplay()
  assert.equal(selected, 'original')
  assert.equal(vm.detailVisible, false)
})

test('a job links to the actual result run rather than its job id', () => {
  const vm = component('components/JobList.vue')
  vm.detail = { jobId: 'job-999', config: {}, result: { runId: 42 } }
  let runId
  vm.$on('view-candidates', value => { runId = value })
  vm.viewCandidates()
  assert.equal(runId, 42)
  assert.equal(vm.detailVisible, false)
})

function page (query = {}) {
  const pushed = []
  const vm = component('index.vue', {
    mapState: () => ({}), SubmitJob: {}, JobList: {}, CandidateList: {}
  }, { $route: { path: '/factor-mining', query }, $router: { push: async location => { pushed.push(location) } } })
  return { vm, pushed }
}

test('candidate tab and run filter restore directly from the URL on refresh', () => {
  const { vm } = page({ tab: 'candidates', runId: '42' })
  assert.equal(vm.activeTab, 'candidates')
  assert.equal(vm.candidateRunId, 42)
  assert.equal(vm.replayJob, null)
})

test('invalid URL inputs do not turn into invalid candidate API filters', () => {
  for (const runId of ['0', '-1', '1.5', 'wat', ['42', '43']]) {
    const { vm } = page({ tab: 'unknown', runId })
    assert.equal(vm.activeTab, 'submit')
    assert.equal(vm.candidateRunId, undefined)
  }
})

test('job navigation persists tab/runId and preserves unrelated route context', async () => {
  const { vm, pushed } = page({ language: 'en-US', runId: '2' })
  await vm.onViewCandidates(42)
  assert.deepEqual(pushed, [{ path: '/factor-mining', query: { language: 'en-US', tab: 'candidates', runId: '42' } }])
})

test('candidate initial loading and later run changes use the selected run and reset pagination', async () => {
  const sent = []
  const vm = component('components/CandidateList.vue', {
    getCandidates: async params => { sent.push(params); return { code: 1, data: { items: [] } } }
  }, { runId: 42 })
  await vm.load()
  assert.deepEqual(sent[0], { limit: 50, offset: 0, runId: 42 })
  vm.offset = 100
  vm.filters.status = 'rejected'
  assert.ok(vm.$options.watch.runId)
  await vm.$options.watch.runId.call(vm, 43)
  assert.deepEqual(sent[1], { limit: 50, offset: 0, runId: 43, status: 'rejected' })
})

test('a slow previous candidate request cannot replace the newly selected run', async () => {
  const pending = []
  const vm = component('components/CandidateList.vue', {
    getCandidates: () => new Promise(resolve => pending.push(resolve))
  }, { runId: 42 })
  const previous = vm.load()
  vm.filters.runId = 43
  const current = vm.load()
  pending[1]({ code: 1, data: { items: [{ id: 9, runId: 43 }] } })
  await current
  pending[0]({ code: 1, data: { items: [{ id: 8, runId: 42 }] } })
  await previous
  assert.equal(vm.items[0].runId, 43)
})

test('browser back/forward updates the selected tab and replay prefills stay temporary', async () => {
  const { vm } = page({ tab: 'jobs' })
  await vm.onReplay({ jobId: 'original', config: { sourceId: 7 } })
  assert.equal(vm.activeTab, 'submit')
  assert.equal(vm.replayJob.jobId, 'original')
  vm.$route = { path: '/factor-mining', query: { tab: 'candidates', runId: '42' } }
  await Vue.nextTick()
  assert.equal(vm.activeTab, 'candidates')
  assert.equal(vm.candidateRunId, 42)
  const refreshed = page({ tab: 'submit' }).vm
  assert.equal(refreshed.replayJob, null)
})

test('resetting candidate filters asks the parent to clear the URL runId', () => {
  const vm = component('components/CandidateList.vue', {}, { runId: 42 })
  const updates = []
  vm.$on('filter-run', value => updates.push(value))
  vm.reset()
  assert.deepEqual(updates, [undefined])
  assert.equal(vm.offset, 0)
})

test('research summary renders cumulative trials, freeze identity and reserved unevaluated dates', () => {
  const vm = component('components/JobList.vue')
  vm.detail = {
    jobId: 'new', status: 'succeeded', config: {},
    result: { runId: 42, summary: { research: {
      experimentId: 12, contextHash: 'context-abc', runTrials: 0, cumulativeTrials: 610,
      freezeVersion: 'freeze-v1', freezeSnapshotId: 'snapshot-xyz',
      holdout: { reserved: true, startDate: '2024-11-01', endDate: '2024-12-31', evaluated: false }
    } } }
  }
  const rendered = text(vm)
  for (const value of ['12', 'context-abc', '0', '610', 'freeze-v1', 'snapshot-xyz', '2024-11-01', '2024-12-31', 'Reserved', 'Not evaluated']) {
    assert.ok(rendered.includes(value), value)
  }
  vm.detail.result.summary = {}
  assert.doesNotMatch(text(vm), /Research governance/)
})
