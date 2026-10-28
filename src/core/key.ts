// Answer keys: a teacher's finished parse written as plain lines (one per word), and read back.
// The same lines can be built from a student's parse, so a later check can compare column by column.
import type { VerbForm } from './checks.ts'
import { findCompound, surfaceOf, type SessionState } from './session.ts'
import type { SentenceSet } from './sets.ts'

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
  const clauseEnds = new Set(st.trace.flatMap((t, k) => {
    const a = st.log[k]
    return t.step === 'clauseBoundary' && a.step === 'clauseBoundary' && a.ends ? [t.word] : []
  }))
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
    if (w.conjType) fn.push(w.conjType)
    if (w.enclitic?.done) fn.push(`-${st.tokens[i].enclitic} ${w.enclitic.conjType ?? w.enclitic.pos ?? ''}`.trim())
    if (clauseEnds.has(i)) fn.push('clause ends')

    out.push({ n: i + 1, word: surfaceOf(st.tokens[i]), entry: w.entryId ?? '', pos: w.pos ?? '', form: form.join('; '), fn: fn.join('; ') })
  })
  return out
}

function table(words: KeyWord[]): string {
  const cols = (k: KeyWord) => [String(k.n), k.word, k.entry, k.pos, k.form, k.fn]
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

/** Reads a key file back. Lines that aren't word rows (the sentence text, blank lines) are skipped. */
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
    current.push({ n: Number(cells[0]), word: cells[1], entry: cells[2], pos: cells[3], form: cells[4], fn: cells.slice(5).join('|') })
  }
  return { setId, title, sentences }
}
