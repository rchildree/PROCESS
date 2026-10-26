// Compact one-line summaries of a finished word's parse, shown under the word.
import type { SessionState, WordState } from '../core/session.ts'
import { surfaceOf } from '../core/session.ts'
import type { VerbForm } from '../core/checks.ts'

export const POS_NAME: Record<string, string> = {
  N: 'Noun', ADJ: 'Adjective', PRO: 'Pronoun', V: 'Verb', ADV: 'Adverb', PREP: 'Preposition', CONJ: 'Conjunction', OTHER: 'Other',
}
export const CASE_ABBR: Record<string, string> = { nom: 'nom', gen: 'gen', dat: 'dat', acc: 'acc', abl: 'abl', voc: 'voc', loc: 'loc' }

export function verbText(f: VerbForm): string {
  if (f.k === 'inf') return `${f.t} ${f.v} inf`
  if (f.k === 'imp') return `${f.v} imp ${f.n}`
  return `${f.t} ${f.m} ${f.v} ${f.p}${f.n}`
}

export function summarize(st: SessionState, i: number): string[] {
  const w: WordState = st.words[i]
  const word = (j: number) => surfaceOf(st.tokens[j])
  const lines: string[] = []
  if (w.pos) lines.push(w.pos)
  if (w.nomForm) lines.push(`${CASE_ABBR[w.nomForm.c]} ${w.nomForm.n} ${w.nomForm.g}`)
  if (w.verbForm) lines.push(verbText(w.verbForm))
  if (w.prepCase) lines.push(`+ ${w.prepCase}`)
  const r = w.role
  if (r) {
    switch (r.kind) {
      case 'label': lines.push(r.label); break
      case 'modifies': lines.push(`→ ${word(r.target)}`); break
      case 'pendingNoun': lines.push('→ …'); break
      case 'substantive': lines.push(`subst. · ${r.label}`); break
      case 'predicate': lines.push(`pred. · ${r.label}`); break
      case 'verbPart': lines.push(r.target === undefined ? 'verb part …' : `+ ${word(r.target)}`); break
      case 'aux': lines.push(r.target === undefined ? 'aux …' : `+ ${word(r.target)}`); break
    }
  }
  if (w.compound?.form) lines.push(`${verbText(w.compound.form)}${w.compound.label ? ' · ' + w.compound.label : ''}`)
  if (w.enclitic?.done) lines.push(`-${st.tokens[i].enclitic} ${w.enclitic.conjType ?? ''}`.trim())
  return lines
}
