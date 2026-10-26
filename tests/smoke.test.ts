import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('dataset manifest is present with 732 entries', () => {
  const m = JSON.parse(readFileSync('public/data/knudsvig-731/manifest.json', 'utf8'))
  expect(m.stats.entries).toBe(732)
})
