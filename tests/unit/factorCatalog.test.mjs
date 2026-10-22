import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { loadNativeFactorIds, parseNativeFactorIds } from '../../scripts/factor-catalog.mjs'

const catalogPath = fileURLToPath(new URL('../fixtures/native-factor-catalog.json', import.meta.url))
const scriptPath = fileURLToPath(new URL('../../scripts/factor-catalog.mjs', import.meta.url))
const registryPath = 'backend_api_python/app/services/factors/registry.py'
const frontendRoot = fileURLToPath(new URL('../../', import.meta.url))

function backendFixture (t, source) {
  const root = mkdtempSync(join(tmpdir(), 'quantdinger-factor-catalog-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const registry = join(root, registryPath)
  mkdirSync(join(registry, '..'), { recursive: true })
  writeFileSync(registry, source)
  return root
}

test('native factor catalog is complete, nonempty, unique and independent of backend checkout', () => {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const ids = loadNativeFactorIds({ backendSrcPath: '' })
  assert.equal(catalog.schemaVersion, 1)
  assert.equal(catalog.source, registryPath)
  assert.equal(ids.length, 61)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.includes('sma'))
  assert.ok(ids.includes('free_cash_flow_yield'))
})

test('registry parser accepts both factory types, whitespace and quote styles', () => {
  assert.deepEqual(parseNativeFactorIds(`
    _technical(\n 'sma', 'trend', ...),
    _fundamental ("market_cap", "size", ...),
  `), ['market_cap', 'sma'])
})

test('registry parser refuses empty or duplicate factor IDs', () => {
  assert.throws(() => parseNativeFactorIds('no registry entries'), /nonempty/i)
  assert.throws(() => parseNativeFactorIds('_technical("sma", ...), _technical("sma", ...)'), /duplicate/i)
})

test('explicit backend checkout must match every committed factor ID', t => {
  const ids = loadNativeFactorIds({ backendSrcPath: '' })
  const source = ids.map(id => `_technical("${id}", ...)`).join('\n')
  const backendSrcPath = backendFixture(t, source)
  assert.deepEqual(loadNativeFactorIds({ backendSrcPath }), ids)
  assert.deepEqual(loadNativeFactorIds({ backendSrcPath: join(backendSrcPath, 'backend_api_python') }), ids)
})

test('explicit backend checkout cannot silently fall back when missing or drifted', t => {
  const backendSrcPath = backendFixture(t, '_technical("unknown_new_factor", ...)')
  assert.throws(() => loadNativeFactorIds({ backendSrcPath }), /catalog.*(differs|drift)/i)
  assert.throws(() => loadNativeFactorIds({ backendSrcPath: join(backendSrcPath, 'missing') }), /BACKEND_SRC_PATH/)
})

test('malformed, empty and duplicate committed catalogs fail closed', t => {
  const root = mkdtempSync(join(tmpdir(), 'quantdinger-factor-catalog-invalid-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const manifestPath = join(root, 'catalog.json')
  for (const factorIds of [[], ['sma', 'sma'], ['invalid.id']]) {
    writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, source: registryPath, factorIds }))
    assert.throws(() => loadNativeFactorIds({ catalogPath: manifestPath, backendSrcPath: '' }), /nonempty|duplicate|invalid/i)
  }
  writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 2, source: registryPath, factorIds: ['sma'] }))
  assert.throws(() => loadNativeFactorIds({ catalogPath: manifestPath, backendSrcPath: '' }), /schema/i)
})

test('catalog CLI requires an explicit backend and never overwrites in check mode', t => {
  const missing = spawnSync(process.execPath, [scriptPath, '--check'], {
    encoding: 'utf8', env: { ...process.env, BACKEND_SRC_PATH: '' }
  })
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /BACKEND_SRC_PATH/)

  const backendSrcPath = backendFixture(t, '_technical("unknown_new_factor", ...)')
  const before = readFileSync(catalogPath)
  const drifted = spawnSync(process.execPath, [scriptPath, '--check'], {
    encoding: 'utf8', env: { ...process.env, BACKEND_SRC_PATH: backendSrcPath }
  })
  assert.notEqual(drifted.status, 0)
  assert.deepEqual(readFileSync(catalogPath), before)
})

test('all localization assertions run in an isolated checkout without backend source', t => {
  const root = mkdtempSync(join(tmpdir(), 'quantdinger-localization-standalone-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const files = [
    'package.json', 'scripts/factor-catalog.mjs', 'tests/fixtures/native-factor-catalog.json',
    'tests/unit/factorLibraryLocalization.test.mjs',
    ...['en-US', 'zh-CN', 'factor-research-factors', 'factor-library-enhancements', 'talib-factors']
      .map(name => `src/locales/lang/${name}.js`)
  ]
  for (const file of files) {
    const target = join(root, file)
    mkdirSync(join(target, '..'), { recursive: true })
    copyFileSync(join(frontendRoot, file), target)
  }
  const environment = { ...process.env, BACKEND_SRC_PATH: '' }
  delete environment.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/unit/factorLibraryLocalization.test.mjs'], {
    cwd: root, encoding: 'utf8', env: environment, timeout: 15000
  })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /(?:pass|passed) 4/)
  assert.match(result.stdout, /skipped 0/)
})
