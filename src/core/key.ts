// Answer keys: a teacher's finished parse written as plain lines (one per word), and read back.
// The same lines can be built from a student's parse, so a later check can compare column by column.
import type { Label, NomForm, UiPos, VerbForm } from './checks.ts'
import { findCompound, surfaceOf, type Role, type SessionState, type WordState } from './session.ts'
import { STEM_TYPES } from './stems.ts'
import type { SentenceSet, Token } from './sets.ts'
import type { Case, Gender, Mood, Num, Person, Tense, Voice } from './types.ts'

const WORK_FIELDS = ['path', 'ending', 'personal', 'stem', 'stemType', 'marker'] as const
export type KeyWork = Pick<WordState, typeof WORK_FIELDS[number]>

export interface KeyWord {
  /** Word number in the sentence, from 1. */
  n: number
  word: string
  entry: string
  pos: string
  /** Parts joined by '; ' (case/number/gender, verb form, + case). */
  form: string
  /** Parts joined by '; ' (label, links, conjunction type, clause end). */
  fn: string
  /** The teacher's working: keep empty endings and null markers as well as the selected split. */
  work?: KeyWork
}

export interface ParsedKey { setId: string; title: string; sentences: Map<number, KeyWord[]> }

const verbText = (f: VerbForm): string => {
  if (f.k === 'inf') return `${f.t} ${f.v} inf`
  if (f.k === 'imp') return `${f.v} imp 2${f.n}`
  return `${f.t} ${f.v} ${f.m} ${f.p}${f.n}`
}

/** The key lines for every finished word of a sentence. */
export function keyWords(st: SessionState): KeyWord[] {
  const ref = (j: number) => `${j + 1} ${surfaceOf(st.tokens[j])}`
  // A word can close more than one clause (the end of a nested clause and the one around it).
  const clauseEnds = new Map<number, number>()
  st.trace.forEach((t, k) => {
    const a = st.log[k]
    if (t.step === 'clauseBoundary' && a.step === 'clauseBoundary' && a.ends) clauseEnds.set(t.word, (clauseEnds.get(t.word) ?? 0) + 1)
  })
  const out: KeyWord[] = []
  st.words.forEach((w, i) => {
    if (!w.done) return
    const form: string[] = []
    if (w.nomForm) form.push(`${w.nomForm.c} ${w.nomForm.n} ${w.nomForm.g}`)
    if (w.verbForm) form.push(verbText(w.verbForm))
    if (w.compound?.form) form.push(verbText(w.compound.form))
    if (w.prepCase) form.push(`+ ${w.prepCase}`)

    const fn: string[] = []
    const r = w.role
    if (r) {
      switch (r.kind) {
        case 'label': fn.push(r.label); break
        case 'substantive': fn.push(`subst. ${r.label}`); break
        case 'predicate': fn.push(`pred. ${r.label}`); break
        case 'modifies': fn.push(`→ ${ref(r.target)}`); break
        case 'verbPart': case 'aux': {
          const cp = findCompound(st, i)
          fn.push(`${cp?.label ?? '?'} with ${ref(r.target)}`)
          break
        }
      }
    }
    if (w.antecedent !== undefined) fn.push(w.antecedent === null ? 'rel. none' : `rel. → ${ref(w.antecedent)}`)
    if (w.completes !== undefined) fn.push(`completes ${ref(w.completes)}`)
    if (w.ppWith !== undefined) fn.push(`with ${ref(w.ppWith)}`)
    if (w.conjType && !(r?.kind === 'label' && r.label === w.conjType)) fn.push(w.conjType)
    if (w.enclitic?.done) fn.push(`-${st.tokens[i].enclitic} ${w.enclitic.conjType ?? w.enclitic.pos ?? ''}`.trim())
    const ends = clauseEnds.get(i) ?? 0
    if (ends) fn.push(ends > 1 ? `clause ends ×${ends}` : 'clause ends')

    const work: KeyWork = Object.fromEntries(WORK_FIELDS.filter((f) => w[f] !== undefined).map((f) => [f, w[f]]))
    out.push({ n: i + 1, word: surfaceOf(st.tokens[i]), entry: w.entryId ?? '', pos: w.pos ?? '', form: form.join('; '), fn: fn.join('; '), ...(Object.keys(work).length ? { work } : {}) })
  })
  return out
}

function table(words: KeyWord[]): string {
  // A final JSON cell preserves the working without changing the original six columns.
  const cols = (k: KeyWord) => [String(k.n), k.word, k.entry, k.pos, k.form, k.fn, k.work ? JSON.stringify(k.work).replace(/\|/g, '\\u007c') : '']
  const rows = words.map(cols)
  const widths = rows.reduce((w, r) => r.map((c, j) => Math.max(w[j] ?? 0, [...c].length)), [] as number[])
  return rows.map((r) => r.map((c, j) => (j === r.length - 1 ? c : c + ' '.repeat(widths[j] - [...c].length))).join(' | ').trimEnd()).join('\n')
}

/** The whole key file for a set. `states[i]` is the teacher's parse of sentence i, or null if not started. */
export function keyFile(set: SentenceSet, states: (SessionState | null)[]): string {
  const parts = [`# Key: ${set.title}`, `set: ${set.id}`]
  states.forEach((st, i) => {
    const words = st ? keyWords(st) : []
    if (!words.length) return
    parts.push(`## ${i + 1}\n${set.sentences[i].text}\n\n${table(words)}`)
  })
  return parts.join('\n\n') + '\n'
}

function parseWork(text: string, word: string): KeyWork {
  const invalid = () => new Error(`Invalid working details for word ${word} in the answer key`)
  let value: unknown
  try { value = JSON.parse(text) } catch { throw invalid() }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const work = value as Record<string, unknown>
  for (const [field, v] of Object.entries(work)) {
    if (!WORK_FIELDS.some((f) => f === field)) throw invalid()
    if (field === 'path') {
      if (!['nominal', 'finite', 'inf', 'none'].includes(v as string)) throw invalid()
    } else if (field === 'stemType') {
      if (!STEM_TYPES.some((t) => t === v)) throw invalid()
    } else if (!(field === 'marker' && v === null) && typeof v !== 'string') throw invalid()
  }
  return work as KeyWork
}

/** Reads a key file back, including older six-column keys. Non-word lines are skipped. */
export function parseKey(text: string): ParsedKey {
  let setId = ''
  let title = ''
  let current: KeyWord[] | null = null
  const sentences = new Map<number, KeyWord[]>()
  for (const line of text.split(/\r?\n/)) {
    let m: RegExpMatchArray | null
    if ((m = line.match(/^#\s+Key:\s*(.*)$/))) { title = m[1].trim(); continue }
    if ((m = line.match(/^set:\s*(\S+)/))) { setId = m[1]; continue }
    if ((m = line.match(/^##\s+(\d+)\s*$/))) { current = []; sentences.set(Number(m[1]), current); continue }
    if (!current) continue
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 6 || !/^\d+$/.test(cells[0])) continue
    current.push({ n: Number(cells[0]), word: cells[1], entry: cells[2], pos: cells[3], form: cells[4], fn: cells[5], ...(cells[6] ? { work: parseWork(cells[6], cells[0]) } : {}) })
  }
  return { setId, title, sentences }
}

// ---------- reading key lines back into a parse the sentence view can draw ----------

const CASES = new Set(['nom', 'gen', 'dat', 'acc', 'abl', 'voc', 'loc'])

function nomFormOf(part: string): NomForm | null {
  const m = part.match(/^(\w+) (sg|pl) (m|f|n)$/)
  return m && CASES.has(m[1]) ? { c: m[1] as Case, n: m[2] as Num, g: m[3] as Gender } : null
}

function verbFormOf(part: string): VerbForm | null {
  let m: RegExpMatchArray | null
  if ((m = part.match(/^(\w+) (act|pass) inf$/))) return { k: 'inf', t: m[1] as Tense, v: m[2] as Voice }
  if ((m = part.match(/^(act|pass) imp 2(sg|pl)$/))) return { k: 'imp', t: 'pres', v: m[1] as Voice, p: '2', n: m[2] as Num }
  if ((m = part.match(/^(\w+) (act|pass) (\w+) ([123])(sg|pl)$/))) {
    return { k: 'fin', t: m[1] as Tense, v: m[2] as Voice, m: m[3] as Mood, p: m[4] as Person, n: m[5] as Num }
  }
  return null
}

const parts = (s: string) => s.split(';').map((p) => p.trim()).filter(Boolean)
/** "3 puerum" → word index 2. */
const target = (s: string) => Number(s) - 1

/** One keyed word as the sentence view sees it, with the teacher's working when supplied. */
function keyWordState(k: KeyWord): WordState {
  const w: WordState = { ...k.work, clauseDepth: 0, done: true }
  if (k.entry) w.entryId = k.entry
  if (k.pos) w.pos = k.pos as UiPos
  const forms = parts(k.form)
  for (const f of forms) {
    const nf = nomFormOf(f)
    const vf = nf ? null : verbFormOf(f)
    const pc = f.match(/^\+ (\w+)$/)
    if (nf) w.nomForm = nf
    else if (vf) w.verbForm = vf
    else if (pc) w.prepCase = pc[1] as Case
  }
  let role: Role | undefined
  for (const f of parts(k.fn)) {
    let m: RegExpMatchArray | null
    if ((m = f.match(/^→ (\d+)/))) role = { kind: 'modifies', target: target(m[1]) }
    else if ((m = f.match(/^subst\. (\S+)$/))) role = { kind: 'substantive', label: m[1] as Label }
    else if ((m = f.match(/^pred\. (SC|OC)$/))) role = { kind: 'predicate', label: m[1] as 'SC' | 'OC' }
    else if ((m = f.match(/^rel\. → (\d+)/))) w.antecedent = target(m[1])
    else if (f === 'rel. none') w.antecedent = null
    else if ((m = f.match(/^completes (\d+)/))) w.completes = target(m[1])
    else if ((m = f.match(/^with (\d+)/))) w.ppWith = target(m[1])
    else if ((m = f.match(/^(\S+) with (\d+)/))) {
      const other = target(m[2])
      if (w.nomForm) {
        // The participle carries the compound: its own case/number/gender, then the whole verb's form.
        role = { kind: 'verbPart', target: other }
        w.compound = { ptc: -1, sum: other, form: w.verbForm, ...(m[1] !== '?' ? { label: m[1] as Label } : {}) }
        delete w.verbForm
      } else role = { kind: 'aux', target: other }
    } else if ((m = f.match(/^-(que|ne|ve)\s*(.*)$/))) {
      const t = m[2]
      w.enclitic = t === '+' || t === '↓' ? { conjType: t, done: true } : { pos: (t || undefined) as UiPos | undefined, done: true }
    } else if (/^clause ends/.test(f)) { /* handled with clause depth */ }
    else if (f === '+' || f === '↓') { w.conjType = f; role ??= { kind: 'label', label: f } }
    else role = { kind: 'label', label: f as Label }
  }
  if (role) w.role = role
  return w
}

function closesOf(k: KeyWord): number {
  const m = k.fn.match(/clause ends(?: ×(\d+))?/)
  return m ? Number(m[1] ?? 1) : 0
}

/**
 * The words of a sentence with every keyed word swapped in. Words the key leaves out keep the student's
 * answers. Clause shading follows the key wherever it has the word.
 */
export function wordsWithKey(words: WordState[], tokens: Token[], key: KeyWord[]): WordState[] {
  const byIndex = new Map(key.filter((k) => k.n >= 1 && k.n <= tokens.length).map((k) => [k.n - 1, k]))
  const out = words.map((w, i) => {
    const k = byIndex.get(i)
    if (!k) return w
    const ws = keyWordState(k)
    if (ws.compound) ws.compound.ptc = i
    return ws
  })
  // Rebuild clause depth: a ↓ conjunction or a relative opens a clause on its own word; "clause ends" closes after it.
  let depth = 0
  out.forEach((w, i) => {
    const k = byIndex.get(i)
    if (!k) { depth = w.clauseDepth; return }
    const opens = w.conjType === '↓' || w.antecedent !== undefined
    if (opens) depth++
    w.clauseDepth = depth
    depth = Math.max(0, depth - closesOf(k))
  })
  return out
}

const cmp = (k: KeyWord) => [k.entry, k.pos, k.form, k.fn].join('|').replace(/\s+/g, ' ')

/** Word indexes (from 0) where the student's finished parse and the key disagree. Unkeyed words never count. */
export function differences(st: SessionState, key: KeyWord[]): Set<number> {
  const mine = new Map(keyWords(st).map((k) => [k.n, k]))
  const out = new Set<number>()
  for (const k of key) {
    const m = mine.get(k.n)
    // Older keys don't assess working they never stored; new keys compare every supplied field.
    if (!m || cmp(m) !== cmp(k) || WORK_FIELDS.some((f) => k.work?.[f] !== undefined && m.work?.[f] !== k.work[f])) out.add(k.n - 1)
  }
  return out
}

/** Problems with a key against its set's sentences (words that no longer line up after a set was edited). */
export function keyProblems(set: SentenceSet, key: ParsedKey): string[] {
  const out: string[] = []
  for (const [n, words] of key.sentences) {
    const s = set.sentences[n - 1]
    if (!s) { out.push(`sentence ${n} is not in the set`); continue }
    for (const k of words) {
      const t = s.tokens[k.n - 1]
      if (!t) out.push(`sentence ${n}: there is no word ${k.n}`)
      else if (surfaceOf(t) !== k.word) out.push(`sentence ${n}: word ${k.n} is "${surfaceOf(t)}" in the set but "${k.word}" in the key`)
    }
  }
  return out
}
