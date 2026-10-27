// Bundles and runs the progression tests in Node: npm run test:progression
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'node_modules', '.cache', 'progression.test.mjs')
await build({ entryPoints: [join(root, 'src/progression/progression.test.js')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' })
await import(`${pathToFileURL(out).href}?${Date.now()}`)
