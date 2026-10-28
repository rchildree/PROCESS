// Turns teacher files in sets/ into public/sets/*.json. Fails if any word is unknown.
// Answer keys (*.key.md) sit beside the sets and are skipped here.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadDatasetFromDir } from '../src/core/loadDataset.node.ts'
import { buildLexicon, withGlosses } from '../src/core/lexicon.ts'
import { parseSetFile, validateSet, type SetIndexItem } from '../src/core/sets.ts'

const SRC = 'sets'
const OUT = 'public/sets'
const lex = buildLexicon(loadDatasetFromDir('public/data/knudsvig-731'))
const known = (w: string) => lex.lookup(w).length > 0

const index: SetIndexItem[] = []
const problems: string[] = []
const outputs: [string, string][] = []
const seen = new Set<string>()

for (const f of readdirSync(SRC).filter((f) => /\.(md|txt)$/i.test(f) && !/\.key\.md$/i.test(f)).sort()) {
  for (const set of parseSetFile(f, readFileSync(join(SRC, f), 'utf8'), known)) {
    if (seen.has(set.id)) { problems.push(`${f}: duplicate set id "${set.id}"`); continue }
    seen.add(set.id)
    for (const p of validateSet(set, withGlosses(lex, set.glosses ?? []))) problems.push(`${f} (${set.title}): ${p}`)
    const file = `${set.id}.json`
    outputs.push([file, JSON.stringify(set)])
    index.push({ id: set.id, title: set.title, ...(set.lesson !== undefined ? { lesson: set.lesson } : {}), count: set.sentences.length, file })
  }
}

if (problems.length) {
  console.error('Sentence sets have problems:\n' + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}

index.sort((a, b) => (a.lesson ?? 999) - (b.lesson ?? 999) || a.title.localeCompare(b.title))
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const [file, json] of outputs) writeFileSync(join(OUT, file), json)
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`Built ${index.length} sets: ${index.map((s) => `${s.title} (${s.count})`).join('; ')}`)
