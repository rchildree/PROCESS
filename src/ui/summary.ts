// Short descriptions of a word's parse: its function label (one row across the sentence) and smaller details.
import type { Answer, Role, SessionState, StepId, WordState } from '../core/session.ts'
import { findCompound, surfaceOf } from '../core/session.ts'
import type { VerbForm } from '../core/checks.ts'
import { participleName, STEM_NAME } from '../core/stems.ts'
import type { Lexicon } from '../core/types.ts'

export const POS_NAME: Record<string, string> = {
  N: 'Noun', ADJ: 'Adjective', PRO: 'Pronoun', V: 'Verb', ADV: 'Adverb', PREP: 'Preposition', CONJ: 'Conjunction', OTHER: 'Other',
}
export const CASE_ABBR: Record<string, string> = { nom: 'nom', gen: 'gen', dat: 'dat', acc: 'acc', abl: 'abl', voc: 'voc', loc: 'loc' }

export function verbText(f: VerbForm): string {
  if (f.k === 'inf') return `${f.t} ${f.v} inf`
  if (f.k === 'imp') return `${f.v} imp ${f.n}`
  return `${f.t} ${f.m} ${f.v} ${f.p}${f.n}`
}

/** The function label shown in the shared label row. Empty when an arrow shows the job instead. */
export function labelOf(st: SessionState, i: number, words: WordState[] = st.words): string {
  const w = words[i]
  const r = w.role
  let label = ''
  if (r) {
    switch (r.kind) {
      case 'label': case 'substantive': case 'predicate': label = r.label; break
      case 'pendingNoun': label = '…'; break
      case 'modifies': label = ''; break
      case 'verbPart': case 'aux': {
        const cp = findCompound({ ...st, words }, i)
        label = cp?.label ?? '…'
        break
      }
    }
  }
  if (w.enclitic?.done && w.enclitic.conjType) label = label ? `${label} ${w.enclitic.conjType}` : w.enclitic.conjType
  return label
}

/** Stem · marker · ending, when the word has been split that way. */
export function segments(st: SessionState, i: number, words: WordState[] = st.words): string | null {
  const w = words[i]
  if (!w.stemType || w.stem === undefined) return null
  void st
  const end = w.path === 'finite' ? w.personal ?? '' : w.ending ?? ''
  return [w.stem, ...(w.marker ? [w.marker] : []), end || 'Ø'].join('·')
}

export function detailsOf(st: SessionState, i: number, words: WordState[] = st.words): string[] {
  const w = words[i]
  const word = (j: number) => surfaceOf(st.tokens[j])
  const lines: string[] = []
  if (w.pos) lines.push(w.pos)
  const seg = segments(st, i, words)
  if (seg) lines.push(seg)
  if (w.nomForm) lines.push(`${CASE_ABBR[w.nomForm.c]} ${w.nomForm.n} ${w.nomForm.g}`)
  if (w.stemType && w.path === 'nominal') lines.push(participleName(w.stemType, w.marker, false))
  if (w.verbForm) lines.push(verbText(w.verbForm))
  if (w.prepCase) lines.push(`+ ${w.prepCase}`)
  if (w.antecedent !== undefined) lines.push(w.antecedent === null ? 'rel. (no antecedent)' : `rel. → ${word(w.antecedent)}`)
  const r = w.role
  if (r?.kind === 'modifies') lines.push(`→ ${word(r.target)}`)
  if (r?.kind === 'substantive') lines.push('subst.')
  if (r?.kind === 'predicate') lines.push('pred.')
  if ((r?.kind === 'verbPart' || r?.kind === 'aux') && r.target !== undefined) lines.push(`+ ${word(r.target)}`)
  if (w.compound?.form) lines.push(verbText(w.compound.form))
  if (w.enclitic?.done) lines.push(`-${st.tokens[i].enclitic}`)
  return lines
}

// ---------- describing logged answers (the review panel) ----------

export const STEP_NAME: Record<StepId, string> = {
  identify: 'Dictionary entry', pos: 'Part of speech', ending: 'Ending', nomForm: 'Case, number, gender', nomRole: 'Function',
  personal: 'Personal ending', stem: 'Stem', stemType: 'Stem type', infEnding: 'Ending', verbForm: 'Verb form', verbRole: 'Function',
  relNG: 'Number, gender', antecedent: 'Antecedent', relCase: 'Case', compoundForm: 'Compound verb form', compoundRole: 'Compound verb label',
  prepCase: 'Case it takes', conjType: 'Conjunction type', linkPending: 'Earlier word joined', clauseBoundary: 'Clause end',
  encliticPos: 'Enclitic part of speech', encliticConj: 'Enclitic type', resolvePending: 'Final decision', done: '',
}

function roleText(r: Role, word: (j: number) => string): string {
  switch (r.kind) {
    case 'label': return r.label
    case 'modifies': return `modifies ${word(r.target)}`
    case 'pendingNoun': return 'its noun comes later'
    case 'predicate': return `predicate ${r.label}`
    case 'substantive': return `used as a noun: ${r.label}`
    case 'verbPart': return r.target === undefined ? 'part of a compound verb (sum later)' : `with ${word(r.target)}`
    case 'aux': return r.target === undefined ? 'auxiliary (participle later)' : `with ${word(r.target)}`
  }
}

export function describeAnswer(a: Answer, st: SessionState, lex: Lexicon): string {
  const word = (j: number) => surfaceOf(st.tokens[j])
  switch (a.step) {
    case 'identify': return lex.entries.get(a.entryId)?.dict ?? a.entryId
    case 'pos': case 'encliticPos': return POS_NAME[a.pos]
    case 'ending': case 'infEnding': case 'personal': return a.ending ? `-${a.ending}` : 'Ø (none)'
    case 'stem': return `${a.stem}-`
    case 'stemType': return STEM_NAME[a.t]
    case 'nomForm': return `${a.form.c} ${a.form.n} ${a.form.g}`
    case 'relNG': return `${a.n} ${a.g}`
    case 'relCase': case 'prepCase': return a.c
    case 'antecedent': return a.target === null ? 'none stated' : word(a.target)
    case 'verbForm': case 'compoundForm': return verbText(a.form)
    case 'nomRole': case 'verbRole': case 'compoundRole': case 'resolvePending': return roleText(a.role, word)
    case 'linkPending': return a.target === null ? 'none' : word(a.target)
    case 'conjType': case 'encliticConj': return a.t === '+' ? '+ coordinating' : '↓ subordinating'
    case 'clauseBoundary': return a.ends ? 'clause ends here' : 'clause continues'
  }
}
