import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RawDataset } from './types.ts'

export function loadDatasetFromDir(dir: string): RawDataset {
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const m = read('manifest.json')
  return {
    entries: read(m.entries),
    forms: { n: read(m.forms.n), adj: read(m.forms.adj), v: read(m.forms.v), pron: read(m.forms.pron) },
  }
}
