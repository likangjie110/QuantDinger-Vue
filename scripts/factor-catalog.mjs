import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const defaultCatalogPath = fileURLToPath(new URL('../tests/fixtures/native-factor-catalog.json', import.meta.url))
const registryPath = 'backend_api_python/app/services/factors/registry.py'

function validateFactorIds (ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('Native factor IDs must be a nonempty array')
  if (ids.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id))) {
    throw new Error('Native factor catalog contains an invalid factor ID')
  }
  if (new Set(ids).size !== ids.length) throw new Error('Native factor catalog contains duplicate factor IDs')
  return [...ids].sort()
}

export function parseNativeFactorIds (source) {
  const ids = [...source.matchAll(/_(?:technical|fundamental)\s*\(\s*["']([a-z0-9_]+)["']/g)]
    .map(match => match[1])
  return validateFactorIds(ids)
}

function readBackendFactorIds (backendSrcPath) {
  if (!backendSrcPath) throw new Error('Set BACKEND_SRC_PATH to the backend repository or backend_api_python directory')
  const candidates = [
    resolve(backendSrcPath, registryPath),
    resolve(backendSrcPath, 'app/services/factors/registry.py')
  ]
  const registry = candidates.find(path => existsSync(path))
  if (!registry) throw new Error('BACKEND_SRC_PATH must contain backend_api_python/app/services/factors/registry.py or app/services/factors/registry.py')
  return parseNativeFactorIds(readFileSync(registry, 'utf8'))
}

export function loadNativeFactorIds ({ catalogPath = defaultCatalogPath, backendSrcPath = process.env.BACKEND_SRC_PATH } = {}) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  if (catalog.schemaVersion !== 1 || catalog.source !== registryPath) throw new Error('Invalid native factor catalog schema or source')
  const ids = validateFactorIds(catalog.factorIds)
  if (backendSrcPath && !isDeepStrictEqual(ids, readBackendFactorIds(backendSrcPath))) {
    throw new Error('Native factor catalog differs from BACKEND_SRC_PATH; review the registry change and run pnpm run factors:catalog:update')
  }
  return ids
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
      throw new Error('Usage: node scripts/factor-catalog.mjs --check|--write (requires BACKEND_SRC_PATH)')
    }
    const ids = readBackendFactorIds(process.env.BACKEND_SRC_PATH)
    if (args[0] === '--write') {
      const catalog = { schemaVersion: 1, source: registryPath, factorIds: ids }
      writeFileSync(defaultCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
      console.log(`Updated the native factor catalog: ${ids.length} factors`)
    } else {
      loadNativeFactorIds()
      console.log(`Native factor catalog matches the backend: ${ids.length} factors`)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
