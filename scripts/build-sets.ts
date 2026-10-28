// Turns teacher files in sets/ into public/sets/*.json. Fails if any word is unknown.
// Answer keys (*.key.md) sit beside the sets; each becomes public/sets/<set-id>.key.json.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadDatasetFromDir } from '../src/core/loadDataset.node.ts'
import { buildLexicon, withGlosses } from '../src/core/lexicon.ts'
import { keyProblems, parseKey } from '../src/core/key.ts'
import { parseSetFile, validateSet, type SentenceSet, type SetIndexItem } from '../src/core/sets.ts'

const SRC = 'sets'
const OUT = 'public/sets'
const lex = buildLexicon(loadDatasetFromDir('public/data/knudsvig-731'))
const known = (w: string) => lex.lookup(w).length > 0

const index: SetIndexItem[] = []
const problems: string[] = []
const outputs: [string, string][] = []
const seen = new Set<string>()
const sets = new Map<string, SentenceSet>()

for (const f of readdirSync(SRC).filter((f) => /\.(md|txt)$/i.test(f) && !/\.key\.md$/i.test(f)).sort()) {
  for (const set of parseSetFile(f, readFileSync(join(SRC, f), 'utf8'), known)) {
    if (seen.has(set.id)) { problems.push(`${f}: duplicate set id "${set.id}"`); continue }
    seen.add(set.id)
    for (const p of validateSet(set, withGlosses(lex, set.glosses ?? []))) problems.push(`${f} (${set.title}): ${p}`)
    sets.set(set.id, set)
    const file = `${set.id}.json`
    outputs.push([file, JSON.stringify(set)])
    index.push({ id: set.id, title: set.title, ...(set.lesson !== undefined ? { lesson: set.lesson } : {}), count: set.sentences.length, file })
  }
}

for (const f of readdirSync(SRC).filter((f) => /\.key\.md$/i.test(f)).sort()) {
  const key = parseKey(readFileSync(join(SRC, f), 'utf8'))
  const set = sets.get(key.setId)
  if (!set) { problems.push(`${f}: no set has the id "${key.setId}" (check the "set:" line)`); continue }
  const item = index.find((x) => x.id === key.setId)!
  if (item.key) { problems.push(`${f}: the set "${key.setId}" already has a key`); continue }
  for (const p of keyProblems(set, key)) problems.push(`${f}: ${p}`)
  item.key = `${set.id}.key.json`
  outputs.push([item.key, JSON.stringify({ setId: key.setId, sentences: Object.fromEntries(key.sentences) })])
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
