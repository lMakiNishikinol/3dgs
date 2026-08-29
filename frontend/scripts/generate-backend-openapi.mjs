import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { openapi } from './backend-openapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '..', 'docs', 'backend', 'api', 'backend-api-openapi.json')
await writeFile(target, JSON.stringify(openapi, null, 2) + '\n', 'utf8')
console.log(`Generated ${target}`)
