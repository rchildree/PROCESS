// Stub until Task 3: writes an empty set index.
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('public/sets', { recursive: true })
writeFileSync('public/sets/index.json', '[]\n')
