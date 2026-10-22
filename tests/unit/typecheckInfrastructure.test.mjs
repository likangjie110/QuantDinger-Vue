import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, undefined, undefined, [
  { extension: '.vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }
])

function applicationFiles (directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? applicationFiles(path) : /\.(?:vue|[cm]?jsx?|tsx?)$/.test(entry.name) ? [path] : []
  })
}

test('typecheck runs the pinned Vue compiler with JavaScript semantic checks', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.typecheck, 'vue-tsc --noEmit --project tsconfig.json')
  assert.equal(pkg.devDependencies['vue-tsc'], '2.2.12')
  assert.equal(pkg.devDependencies.typescript, '5.8.3')
  assert.equal(parsed.options.allowJs, true)
  assert.equal(parsed.options.checkJs, true)
  assert.equal(parsed.options.noImplicitThis, true)
  assert.equal(parsed.options.noEmit, true)
  assert.equal(config.config.vueCompilerOptions.target, 2.7)
  assert.deepEqual(parsed.errors, [])
})

test('typecheck includes every application JS and Vue file, including factor mining pages', () => {
  const included = new Set(parsed.fileNames.map(path => resolve(path)))
  const files = applicationFiles(resolve(root, 'src'))
  assert.ok(files.length > 200)
  assert.ok(files.some(path => path.endsWith('factor-mining/index.vue') || path.endsWith('factor-mining\\index.vue')))
  for (const path of files) assert.ok(included.has(path), `Application file is not typechecked: ${path}`)
})

test('the compiler accepts typed JS/Vue and rejects semantic errors in both', t => {
  const directory = mkdtempSync(resolve(root, 'tests/fixtures/typecheck-probe-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const project = resolve(directory, 'tsconfig.json')
  writeFileSync(project, JSON.stringify({
    extends: resolve(root, 'tsconfig.json'),
    include: ['./probe.js', './Probe.vue', '../../../types/**/*.d.ts']
  }))
  const js = resolve(directory, 'probe.js')
  const vue = resolve(directory, 'Probe.vue')
  const component = count => `<template><div>{{ count.toFixed(2) }}</div></template>
<script>export default { data () { return { count: ${count} } } }</script>`
  const compile = () => spawnSync(process.execPath, [
    resolve(root, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit', '--project', project, '--pretty', 'false'
  ], { cwd: root, encoding: 'utf8', timeout: 30000 })
  writeFileSync(js, '/** @type {number} */\nexport const count = 1\n')
  writeFileSync(vue, component('1'))
  const valid = compile()
  assert.equal(valid.status, 0, valid.stdout + valid.stderr)
  writeFileSync(js, '/** @type {number} */\nexport const count = "wrong"\n')
  writeFileSync(vue, component('"wrong"'))
  const invalid = compile()
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stdout, /probe\.js.*TS2322/)
  assert.match(invalid.stdout, /Probe\.vue.*TS2551/)
})
