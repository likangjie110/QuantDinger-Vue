import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))

test('request contract exposes the unwrapped envelope, typed payloads and binary responses', t => {
  const directory = mkdtempSync(resolve(root, 'tests/fixtures/request-types-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const project = resolve(directory, 'tsconfig.json')
  writeFileSync(project, JSON.stringify({
    extends: resolve(root, 'tsconfig.json'),
    compilerOptions: { skipLibCheck: false, strict: true },
    include: ['./probe.ts']
  }))
  const probe = resolve(directory, 'probe.ts')
  const compile = () => spawnSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', project, '--pretty', 'false'
  ], { cwd: root, encoding: 'utf8', timeout: 30000 })
  const source = `import type { HttpClient } from '../../../types/http'
declare const request: HttpClient
const envelope = await request<{ price: number }>({ url: '/api/quote' })
envelope.code.toFixed()
envelope.msg.toUpperCase()
envelope.data.price.toFixed()
const binary = await request({ url: '/api/export', responseType: 'blob' })
binary.arrayBuffer()
const text = await request({ url: '/api/export', responseType: 'text' })
text.toUpperCase()
const unknown = await request({ url: '/api/untyped' })
`
  writeFileSync(probe, source)
  const valid = compile()
  assert.equal(valid.status, 0, valid.stdout + valid.stderr)
  writeFileSync(probe, source + '\nenvelope.data.price.toUpperCase()\nbinary.code\nunknown.data.price\nenvelope.invalidField\n')
  const invalid = compile()
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stdout, /toUpperCase.*number/)
  assert.match(invalid.stdout, /code.*Blob/)
  assert.match(invalid.stdout, /unknown\.data.*unknown|price.*unknown/)
  assert.match(invalid.stdout, /invalidField/)
})

test('Vue plugins and Moment locales retain upstream signatures and reject invented members', t => {
  const directory = mkdtempSync(resolve(root, 'tests/fixtures/plugin-types-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const project = resolve(directory, 'tsconfig.json')
  writeFileSync(project, JSON.stringify({
    extends: resolve(root, 'tsconfig.json'),
    compilerOptions: { strict: true },
    include: ['./probe.ts', '../../../types/**/*.d.ts']
  }))
  const probe = resolve(directory, 'probe.ts')
  const compile = () => spawnSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', project, '--pretty', 'false'
  ], { cwd: root, encoding: 'utf8', timeout: 30000 })
  const source = `import type { ComponentCustomProperties } from 'vue'
import type { TranslateResult } from 'vue-i18n'
import locale from 'moment/locale/zh-cn'
declare const vm: ComponentCustomProperties
const translated: TranslateResult = vm.$t('common.save')
vm.$message.success('Saved')
vm.$notification.error({ message: 'Failed', description: 'Reason' })
vm.$confirm({ title: 'Confirm' })
vm.$route.path.toUpperCase()
locale.firstDayOfWeek().toFixed()
`
  writeFileSync(probe, source)
  const valid = compile()
  assert.equal(valid.status, 0, valid.stdout + valid.stderr)
  writeFileSync(probe, source + '\nconst narrowed: string = vm.$t("common.save")\nvm.$message.invented()\nlocale.invented()\n')
  const invalid = compile()
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stdout, /TranslateResult.*not assignable to type 'string'/)
  assert.match(invalid.stdout, /invented.*Message/)
  assert.match(invalid.stdout, /invented.*Locale/)
})
