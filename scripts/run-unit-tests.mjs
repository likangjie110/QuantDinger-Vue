// Node's own `--test` does not agree across versions on how to take a directory or a glob: Node
// 24 rejects a directory argument on Windows while Node 18/20 reject a quoted glob. Enumerating the
// files here keeps `pnpm run test:unit` working on every supported Node and on Windows.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testsDir = join(root, 'tests', 'unit')
const files = readdirSync(testsDir)
  .filter(name => name.endsWith('.test.mjs'))
  .sort()
  .map(name => join(testsDir, name))

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
