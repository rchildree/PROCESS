// The step-by-step flow for one sentence, as a pure reducer.
import {
  checkAgreement, checkCompoundForm, compoundForms, checkConjType, checkIdentify, checkNomForm, checkNounLabel, checkPos,
  checkPrepCase, checkVerbForm, checkVerbLabel, type Label, type NomForm, type UiPos, type VerbForm,
} from './checks.ts'
import { NOUN_LABELS, VERB_LABELS } from './data/labels.ts'
import { analysesFor, checkInfinitiveEnding, checkNominalEnding, checkPersonalEnding } from './endings.ts'
import type { Token } from './sets.ts'
import { checkStem, checkStemType, STEM_NAME, stemLimits, tensesForStem, type StemType } from './stems.ts'
import type { Analysis, Case, Check, Gender, Lexicon, Mood, Num, Person, Tense, Voice } from './types.ts'

export type StepId =
  | 'identify' | 'pos' | 'ending' | 'nomForm' | 'nomRole' | 'personal' | 'stem' | 'stemType' | 'infEnding' | 'verbForm' | 'verbRole'
  | 'relNG' | 'antecedent' | 'relCase'
  | 'compoundForm' | 'compoundRole' | 'prepCase' | 'conjType' | 'clauseBoundary' | 'encliticPos'
  | 'encliticConj' | 'sumUse' | 'completes' | 'ppPrep' | 'done'

export type Role =
  | { kind: 'label'; label: Label }
  | { kind: 'modifies'; target: number }
  | { kind: 'predicate'; label: 'SC' | 'OC' }
  | { kind: 'substantive'; label: Label }
  | { kind: 'verbPart'; target: number }
  | { kind: 'aux'; target: number }

export type Answer =
  | { step: 'identify'; entryId: string }
  | { step: 'pos'; pos: UiPos }
  | { step: 'ending' | 'infEnding' | 'personal'; ending: string }
  | { step: 'stem'; stem: string }
  | { step: 'stemType'; t: StemType }
  | { step: 'relNG'; n: Num; g: Gender }
  | { step: 'antecedent'; target: number | null }
  | { step: 'relCase'; c: Case }
  | { step: 'nomForm'; form: NomForm }
  | { step: 'verbForm' | 'compoundForm'; form: VerbForm }
  | { step: 'nomRole' | 'verbRole' | 'compoundRole'; role: Role }
  | { step: 'prepCase'; c: Case }
  | { step: 'conjType' | 'encliticConj'; t: '+' | '↓' }
  | { step: 'encliticPos'; pos: UiPos }
  | { step: 'clauseBoundary'; ends: boolean }
  /** A form of sum: null = a verb on its own; a number = part of a verb with that later participle. */
  | { step: 'sumUse'; target: number | null }
  /** A complementary infinitive: the finite verb it completes. */
  | { step: 'completes'; target: number }
  /** A word labeled PP: the preposition it goes with. */
  | { step: 'ppPrep'; target: number }

export interface Compound { ptc: number; sum: number; form?: VerbForm; label?: Label }

export interface WordState {
  entryId?: string
  pos?: UiPos
  /** 'nominal' = ending → case/number/gender; 'finite' = personal → marker; 'inf' = infinitive ending. */
  path?: 'nominal' | 'finite' | 'inf' | 'none'
  ending?: string
  personal?: string
  /** Letters from the start of the word up to the marker (verbs and participles). */
  stem?: string
  stemType?: StemType
  /** Whatever sits between the stem and the ending; null when nothing does. */
  marker?: string | null
  /** Relative pronouns: number and gender (they match the antecedent), then the antecedent itself. */
  relNG?: { n: Num; g: Gender }
  antecedent?: number | null
  nomForm?: NomForm
  verbForm?: VerbForm
  role?: Role
  prepCase?: Case
  conjType?: '+' | '↓'
  compound?: Compound
  /** A complementary infinitive (CINF): the finite verb it completes. */
  completes?: number
  /** A word labeled PP: the preposition it goes with. */
  ppWith?: number
  enclitic?: { pos?: UiPos; conjType?: '+' | '↓'; done: boolean }
  clauseDepth: number
  done: boolean
}

export interface SessionState {
  tokens: Token[]
  current: number
  step: StepId
  words: WordState[]
  openPP: { prep: number; c: Case; soft?: boolean; conj?: number } | null
  /** The prepositional phrase that just closed, so a following + can extend it (ex agrō et aquā). */
  lastPP: { prep: number; c: Case; closer: number } | null
  clauses: { conj: number; hasFiniteVerb: boolean }[]
  error: string | null
  log: Answer[]
  /** Which word and step each logged answer belongs to. */
  trace: { word: number; step: StepId }[]
  /** Set while a changed earlier answer is being carried through the rest of the sentence. */
  editing: Editing | null
}

export interface Tagged { a: Answer; word: number; step: StepId }

export interface Editing {
  /** The word whose answer was changed. */
  word: number
  /** The original answer at the changed step, so the change can be dropped before it is made. */
  original: Tagged
  /** True until the student gives the new answer. */
  pristine: boolean
  /** Later answers still waiting to be re-applied. */
  queue: Tagged[]
  /** The words as they were before the change, shown faintly until they are re-applied. */
  ghost: WordState[]
  /** A later word the change broke: the re-run stopped here. reason null = it needs an answer it never had. */
  broken: { word: number; reason: string | null } | null
}

export interface Options {
  cases?: Case[]; numbers?: Num[]; genders?: Gender[]; persons?: Person[]; tenses?: Tense[]; moods?: Mood[]; voices?: Voice[]
  labels?: Label[]; pos?: UiPos[]
  /** Values shown but greyed out (a verb's tenses, voices and moods its marked stem cannot build), with why. */
  disabled?: { tenses?: Tense[]; voices?: Voice[]; moods?: Mood[]; why: string }
  /** An earlier word linked to this one as its modifier: its case, number and gender, to start from. */
  agree?: { from: number; form: NomForm }
}

export const ALL_CASES: Case[] = ['nom', 'gen', 'dat', 'acc', 'abl', 'voc']
export const ALL_NUMBERS: Num[] = ['sg', 'pl']
export const ALL_GENDERS: Gender[] = ['m', 'f', 'n']
export const ALL_PERSONS: Person[] = ['1', '2', '3']
export const ALL_TENSES: Tense[] = ['pres', 'impf', 'fut', 'pf', 'plupf', 'futpf']
export const ALL_MOODS: Mood[] = ['ind', 'subj', 'imp']
export const ALL_VOICES: Voice[] = ['act', 'pass']
export const ALL_POS: UiPos[] = ['N', 'ADJ', 'PRO', 'V', 'ADV', 'PREP', 'CONJ', 'OTHER']

// ---------- helpers ----------

export const surfaceOf = (t: Token) => t.host ?? t.surface

export function activeIndex(st: SessionState): number {
  return st.current
}

const isGloss = (id?: string) => !!id && id.startsWith('gloss:')

/** Relative pronouns: number/gender, antecedent, then case, and they open a ↓ clause. */
export const RELATIVE_IDS = new Set(['qui-pron-2', 'quicumque-pron', 'quisquis-pron'])
export const isRelative = (w: WordState) => !!w.entryId && RELATIVE_IDS.has(w.entryId) && w.pos === 'PRO'

/** A word that can be the noun an adjective points to. */
export function isNounLike(w: WordState): boolean {
  if (!w.role) return false
  if (!w.nomForm && w.path !== 'none') return false
  if (w.role.kind === 'substantive') return true
  return w.role.kind === 'label' && (w.pos === 'N' || w.pos === 'PRO')
}

export interface IncomingLink { from: number; kind: 'noun' | 'sum' | 'ptc' | 'cinf' }

/** Earlier words that point forward to word j: an adjective to its noun, a participle to its sum, a sum to its participle. */
export function incomingLinks(st: SessionState, j: number): IncomingLink[] {
  const out: IncomingLink[] = []
  st.words.forEach((x, from) => {
    const r = x.role
    if (from >= j || !r || !('target' in r) || r.target !== j) return
    if (r.kind === 'modifies') out.push({ from, kind: 'noun' })
    if (r.kind === 'verbPart') out.push({ from, kind: 'sum' })
    if (r.kind === 'aux') out.push({ from, kind: 'ptc' })
  })
  st.words.forEach((x, from) => { if (from < j && x.completes === j) out.push({ from, kind: 'cinf' }) })
  return out
}

const quoted = (st: SessionState, j: number) => `“${surfaceOf(st.tokens[j])}”`
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** An earlier adjective linked to this word: it must be used as a noun and agree. */
function checkIncomingNoun(st: SessionState, i: number): string | null {
  const w = st.words[i]
  for (const l of incomingLinks(st, i)) {
    if (l.kind !== 'noun') continue
    if (!isNounLike(w)) return `${quoted(st, l.from)} was linked to this word as its noun, but it is not used as a noun here.`
    const f = st.words[l.from].nomForm
    if (f && w.nomForm) {
      const c = checkAgreement(f, w.nomForm)
      if (!c.ok) return `${quoted(st, l.from)} goes with this word, but ${lowerFirst(c.reason)}`
    }
  }
  return null
}

/** Is word j, already parsed, a finite verb? A form of sum or participle waiting for its partner counts for now. */
function isFiniteVerb(st: SessionState, j: number, pending = false): boolean {
  const w = st.words[j]
  if (!w || w.pos !== 'V') return false
  const cp = findCompound(st, j)
  if (cp?.form) return cp.form.k === 'fin'
  if (w.role?.kind === 'aux' || w.role?.kind === 'verbPart') return pending
  if (w.verbForm) return w.verbForm.k === 'fin' || w.verbForm.k === 'imp'
  // Glossed verbs carry no form to check; a CINF is never the finite verb.
  return w.path === 'none' && !(w.role?.kind === 'label' && w.role.label === 'CINF')
}

/** An earlier complementary infinitive linked to this word: it must be a finite verb. */
function checkIncomingCinf(st: SessionState, i: number): string | null {
  for (const l of incomingLinks(st, i)) {
    if (l.kind === 'cinf' && !isFiniteVerb(st, i, true)) return `${quoted(st, l.from)} was linked to this word as the finite verb it completes, but this is not a finite verb.`
  }
  return null
}

function withWord(st: SessionState, i: number, patch: Partial<WordState>): SessionState {
  const words = st.words.slice()
  words[i] = { ...words[i], ...patch }
  return { ...st, words }
}

const fail = (st: SessionState, reason: string): SessionState => ({ ...st, error: reason })

// ---------- start / advance ----------

export function startSession(tokens: Token[]): SessionState {
  return {
    tokens,
    current: 0,
    step: tokens.length ? 'identify' : 'done',
    words: tokens.map(() => ({ clauseDepth: 0, done: false })),
    openPP: null,
    lastPP: null,
    clauses: [],
    error: null,
    log: [],
    trace: [],
    editing: null,
  }
}

function markFinite(st: SessionState): SessionState {
  if (!st.clauses.length) return st
  const clauses = st.clauses.slice()
  clauses[clauses.length - 1] = { ...clauses[clauses.length - 1], hasFiniteVerb: true }
  return { ...st, clauses }
}

/** Called when the current word's own steps are complete. */
function finishWord(st: SessionState): SessionState {
  const i = st.current
  const tok = st.tokens[i]
  const w = st.words[i]
  const linkErr = checkIncomingNoun(st, i) ?? checkIncomingCinf(st, i)
  if (linkErr) return fail(st, linkErr)
  if (tok.enclitic && !w.enclitic?.done) {
    return { ...withWord(st, i, { enclitic: { done: false } }), step: 'encliticPos' }
  }
  st = withWord(st, i, { done: true })
  if (st.openPP?.soft && st.openPP.conj !== i && (isNounLike(st.words[i]) || ['V', 'PREP', 'CONJ'].includes(st.words[i].pos ?? ''))) {
    st = { ...st, openPP: null }
  }
  const top = st.clauses[st.clauses.length - 1]
  if (top && top.conj !== i) return { ...st, step: 'clauseBoundary' }
  return advance(st)
}

function advance(st: SessionState): SessionState {
  if (st.current < st.tokens.length - 1) {
    const next = st.current + 1
    return { ...withWord(st, next, { clauseDepth: st.clauses.length }), current: next, step: 'identify' }
  }
  return { ...st, step: 'done' }
}

function closePPIfObject(st: SessionState, i: number): SessionState {
  const w = st.words[i]
  const label = w.role?.kind === 'label' || w.role?.kind === 'substantive' ? w.role.label : null
  if (label !== 'PP' || !st.openPP) return st
  return { ...st, openPP: null, lastPP: { prep: st.openPP.prep, c: st.openPP.c, closer: i } }
}

/** A nominal word's role is settled: close its prepositional phrase, open a relative clause, finish the word. */
function afterNomRole(st: SessionState, i: number): SessionState {
  st = closePPIfObject(st, i)
  if (isRelative(st.words[i])) {
    const clauses = [...st.clauses, { conj: i, hasFiniteVerb: false }]
    st = withWord({ ...st, clauses }, i, { clauseDepth: clauses.length })
  }
  return finishWord(st)
}

// ---------- role checks ----------

function checkNominalRole(st: SessionState, i: number, role: Role, lex: Lexicon): Check {
  const w = st.words[i]
  const form = w.nomForm
  const openPP = st.openPP ? { case: st.openPP.c, soft: st.openPP.soft } : null
  const gloss = isGloss(w.entryId) || (w.path === 'none' && !form)
  const no = (reason: string): Check => ({ ok: false, reason })

  if (w.pos === 'ADV') {
    return role.kind === 'label' && role.label === 'ADV' ? { ok: true } : no('An adverb is labeled ADV.')
  }
  if (isRelative(w) && role.kind !== 'label') return no('Give the relative pronoun its function in its own clause.')
  switch (role.kind) {
    case 'label':
      if (w.pos === 'ADJ') return no('Say what this adjective does: does it modify a noun, stand as a noun, or act as a predicate?')
      if (gloss) return NOUN_LABELS.includes(role.label) ? { ok: true } : no('That label is not for nouns.')
      return form ? checkNounLabel(form, role.label, openPP) : no('Missing case.')
    case 'substantive':
      if (w.pos === 'N') return no('A noun is already a noun — just give its label.')
      if (gloss) return { ok: true }
      return form ? checkNounLabel(form, role.label, openPP) : no('Missing case.')
    case 'predicate': {
      if (w.pos === 'N') return no('Give the noun its label (SC or OC) directly.')
      if (!form) return no('Missing case.')
      return checkNounLabel(form, role.label, null)
    }
    case 'modifies': {
      if (w.pos === 'N') return no('A noun does not modify another noun here.')
      const t = st.words[role.target]
      if (!t || role.target === i) return no('Choose a noun in the sentence.')
      if (role.target > i) {
        // Not parsed yet: some reading of it must be able to agree.
        const cands = lex.lookup(surfaceOf(st.tokens[role.target]))
        // Glossed words carry no forms to check against: the check when the noun finishes still runs.
        if (!form || !cands.length || cands.some((c) => !c.analyses.length)) return { ok: true }
        const can = cands.some((c) => c.analyses.some((a) => a.c === form.c && a.n === form.n && a.g === form.g))
        return can ? { ok: true } : no('That word cannot agree with this adjective.')
      }
      if (!isNounLike(t)) return no('That word is not being used as a noun.')
      return form && t.nomForm ? checkAgreement(form, t.nomForm) : { ok: true }
    }
    case 'verbPart': {
      const ptc = w.entryId ? analysesFor(lex, w.entryId, surfaceOf(st.tokens[i])).some((a) => a.k === 'ptc') : false
      if (!ptc) return no('Only a participle can be part of a verb.')
      if (!st.tokens[role.target] || role.target <= i) return no('Choose a later word.')
      if (incomingLinks(st, role.target).some((l) => l.kind === 'sum' || l.kind === 'ptc')) return no('Another word is already part of a verb with that word.')
      return compoundForms(lex, w.entryId!, surfaceOf(st.tokens[i]), surfaceOf(st.tokens[role.target])).length
        ? { ok: true } : no('These two words do not make one verb form.')
    }
    case 'aux':
      return no('Only a form of sum can be an auxiliary.')
    default:
      // Roles from older saves that no longer exist.
      return no('Choose what this word does.')
  }
}

function checkVerbRole(st: SessionState, i: number, role: Role, lex: Lexicon): Check {
  const w = st.words[i]
  const no = (reason: string): Check => ({ ok: false, reason })
  if (role.kind === 'label') {
    if (isGloss(w.entryId) || (w.path === 'none' && !w.verbForm)) return VERB_LABELS.includes(role.label) ? { ok: true } : no('That label is not for verbs.')
    return w.verbForm && w.entryId ? checkVerbLabel(lex, w.entryId, w.verbForm, role.label) : no('Missing verb form.')
  }
  return no('Give the verb a verb label.')
}

// ---------- submit ----------

function submitOne(st: SessionState, a: Answer, lex: Lexicon): SessionState {
  if (st.step === 'done') return fail(st, 'This sentence is finished.')
  if (a.step !== st.step) return fail(st, 'Answer the current question first.')
  const next = apply({ ...st, error: null }, a, lex)
  if (next.error) return { ...next, log: st.log, trace: st.trace }
  return { ...next, error: null, log: [...st.log, a], trace: [...st.trace, { word: activeIndex(st), step: st.step }] }
}

export function submit(st: SessionState, a: Answer, lex: Lexicon): SessionState {
  const next = submitOne(st, a, lex)
  if (next.error || !next.editing) return next
  return drain({ ...next, editing: { ...next.editing, pristine: false } }, lex)
}

// ---------- going back ----------

/** The logged answers, each tagged with its word and step. */
export function tagged(st: SessionState): Tagged[] {
  return st.log.map((a, k) => ({ a, word: st.trace[k]?.word ?? -1, step: st.trace[k]?.step ?? a.step }))
}

/** Go back to logged answer `k` so it can be changed. Later answers are kept and re-applied afterwards. */
export function startEdit(st: SessionState, k: number, lex: Lexicon): SessionState {
  const all = [...tagged(st), ...(st.editing?.queue ?? [])]
  if (k < 0 || k >= st.log.length) return st
  const base = replay(st.tokens, st.log.slice(0, k), lex)
  const editing: Editing = {
    word: all[k].word,
    original: all[k],
    pristine: true,
    queue: all.slice(k + 1),
    ghost: st.editing?.ghost ?? st.words,
    broken: null,
  }
  return { ...base, editing }
}

/** Drop a change before it is made: put the original answer back and re-apply the rest. */
export function cancelEdit(st: SessionState, lex: Lexicon): SessionState {
  if (!st.editing?.pristine) return st
  return submit(st, st.editing.original.a, lex)
}

/** Re-apply waiting answers until one no longer fits or a new question comes up. */
function drain(st: SessionState, lex: Lexicon): SessionState {
  const ed = st.editing!
  let q = ed.queue
  for (;;) {
    if (st.step === 'done') return { ...st, editing: null }
    const cur = st
    // Answers for words already passed can no longer apply (except end-of-sentence decisions).
    q = q.filter((t) => t.word >= cur.current)
    if (!q.length) return { ...st, editing: null }
    const w = activeIndex(st)
    const idx = q.findIndex((t) => t.word === w && t.step === st.step)
    if (idx < 0) return { ...st, editing: { ...ed, queue: q, broken: w === ed.word ? null : { word: w, reason: null } } }
    const next = submitOne(st, q[idx].a, lex)
    if (next.error) return { ...st, editing: { ...ed, queue: q.slice(idx + 1), broken: { word: w, reason: next.error } } }
    st = next
    q = q.slice(idx + 1)
  }
}

function apply(st: SessionState, a: Answer, lex: Lexicon): SessionState {
  const i = st.current
  const tok = st.tokens[i]
  const surface = surfaceOf(tok)
  const w = st.words[i]

  switch (a.step) {
    case 'identify': {
      const c = checkIdentify(lex, surface, a.entryId)
      if (!c.ok) return fail(st, c.reason)
      for (const l of incomingLinks(st, i)) {
        if (l.kind === 'sum' && a.entryId !== 'sum-v') return fail(st, `${quoted(st, l.from)} was linked to this word as part of a verb with a form of sum.`)
        if (l.kind === 'ptc' && !compoundForms(lex, a.entryId, surface, surfaceOf(st.tokens[l.from])).length) {
          return fail(st, `${quoted(st, l.from)} was linked to this word as part of a verb, but these two words do not make one verb form.`)
        }
      }
      return { ...withWord(st, i, { entryId: a.entryId }), step: 'pos', error: null }
    }

    case 'pos': {
      const asNoun = incomingLinks(st, i).find((l) => l.kind === 'noun')
      if (asNoun && !['N', 'ADJ', 'PRO'].includes(a.pos)) return fail(st, `${quoted(st, asNoun.from)} was linked to this word as its noun.`)
      const asVerb = incomingLinks(st, i).find((l) => l.kind === 'sum' || l.kind === 'ptc')
      if (asVerb && a.pos !== 'V') return fail(st, `${quoted(st, asVerb.from)} was linked to this word as part of a verb.`)
      const asFinite = incomingLinks(st, i).find((l) => l.kind === 'cinf')
      if (asFinite && a.pos !== 'V') return fail(st, `${quoted(st, asFinite.from)} was linked to this word as the finite verb it completes.`)
      if (asVerb?.kind === 'sum') {
        // The participle already chose this form of sum: go straight to the two words together.
        st = withWord(st, i, { pos: a.pos, path: 'none', role: { kind: 'aux', target: asVerb.from } })
        return { ...st, step: 'compoundForm' }
      }
      if (!isGloss(w.entryId)) {
        const c = checkPos(lex, surface, w.entryId!, a.pos)
        if (!c.ok) return fail(st, c.reason)
      } else {
        const e = lex.entries.get(w.entryId!)
        const ok = e ? allowedPosForGloss(e.pos).includes(a.pos) : false
        if (!ok) return fail(st, 'That is not the part of speech of this word.')
      }
      st = withWord(st, i, { pos: a.pos })
      if (isGloss(w.entryId)) {
        if (a.pos === 'V') return { ...withWord(st, i, { path: 'none' }), step: 'verbRole' }
        if (a.pos === 'PREP') return { ...st, step: 'prepCase' }
        if (a.pos === 'CONJ') return { ...st, step: 'conjType' }
        if (a.pos === 'OTHER') return finishWord(withWord(st, i, { path: 'none' }))
        return { ...withWord(st, i, { path: 'none' }), step: 'nomRole' }
      }
      const anAll = analysesFor(lex, w.entryId!, surface)
      if (!anAll.length && (a.pos === 'N' || a.pos === 'ADJ' || a.pos === 'PRO')) return { ...withWord(st, i, { path: 'none' }), step: 'nomRole' }
      if (!anAll.length && a.pos === 'V') return { ...withWord(st, i, { path: 'none' }), step: 'verbRole' }
      switch (a.pos) {
        case 'N': case 'ADJ': case 'PRO':
          return { ...withWord(st, i, { path: 'nominal' }), step: 'ending' }
        case 'V':
          if (w.entryId === 'sum-v') return { ...st, step: 'sumUse' }
          return verbPath(st, i, anAll)
        case 'ADV': return { ...withWord(st, i, { path: 'none' }), step: 'nomRole' }
        case 'PREP': return { ...st, step: 'prepCase' }
        case 'CONJ': return { ...st, step: 'conjType' }
        case 'OTHER': return finishWord(withWord(st, i, { path: 'none' }))
      }
      return st
    }

    case 'ending': {
      const c = checkNominalEnding(lex, w.entryId!, surface, a.ending)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, i, { ending: a.ending })
      if (isRelative(st.words[i])) return { ...st, step: 'relNG' }
      if (w.pos === 'V') return { ...st, step: 'stem' }
      return { ...st, step: 'nomForm' }
    }

    case 'stem': {
      const endLen = [...(w.path === 'finite' ? w.personal ?? '' : w.ending ?? '')].length
      const c = checkStem(lex, w.entryId!, surface, endLen, a.stem)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { stem: a.stem }), step: 'stemType' }
    }

    case 'stemType': {
      const c = checkStemType(lex, w.entryId!, surface, w.stem ?? '', a.t)
      if (!c.ok) return fail(st, c.reason)
      const letters = [...surface.normalize('NFC')]
      const endLen = [...(w.path === 'finite' ? w.personal ?? '' : w.ending ?? '')].length
      const middle = letters.slice([...(w.stem ?? '')].length, letters.length - endLen).join('')
      st = withWord(st, i, { stemType: a.t, marker: middle || null })
      return { ...st, step: w.path === 'nominal' ? 'nomForm' : 'verbForm' }
    }

    case 'relNG': {
      const ok = analysesFor(lex, w.entryId!, surface).some((x) => x.n === a.n && x.g === a.g)
      if (!ok) return fail(st, 'This form cannot be that number and gender.')
      return { ...withWord(st, i, { relNG: { n: a.n, g: a.g } }), step: 'antecedent' }
    }

    case 'antecedent': {
      if (a.target !== null) {
        const t = st.words[a.target]
        if (!t || a.target >= i) return fail(st, 'Choose an earlier word.')
        if (!isNounLike(t)) return fail(st, 'That word is not being used as a noun.')
        if (t.nomForm && w.relNG) {
          if (t.nomForm.n !== w.relNG.n) return fail(st, 'They do not agree in number.')
          if (t.nomForm.g !== w.relNG.g) return fail(st, 'They do not agree in gender.')
        }
      }
      return { ...withWord(st, i, { antecedent: a.target }), step: 'relCase' }
    }

    case 'relCase': {
      const ng = w.relNG!
      const form: NomForm = { c: a.c, n: ng.n, g: ng.g }
      const c = checkNomForm(lex, surface, w.entryId!, form)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { nomForm: form }), step: 'nomRole' }
    }

    case 'nomForm': {
      const c = checkNomForm(lex, surface, w.entryId!, a.form)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, i, { nomForm: a.form })
      const sum = incomingLinks(st, i).find((l) => l.kind === 'ptc')
      if (sum) {
        // A form of sum already chose this participle: no role question, straight to the two words together.
        st = withWord(st, i, { role: { kind: 'verbPart', target: sum.from }, compound: { ptc: i, sum: sum.from } })
        return { ...st, step: 'compoundForm' }
      }
      return { ...st, step: 'nomRole' }
    }

    case 'nomRole': {
      const c = checkNominalRole(st, i, a.role, lex)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, i, { role: a.role })
      if (a.role.kind === 'verbPart') return finishWord(withWord(st, i, { compound: { ptc: i, sum: a.role.target } }))
      if ((a.role.kind === 'label' || a.role.kind === 'substantive') && a.role.label === 'PP') return { ...st, step: 'ppPrep' }
      return afterNomRole(st, i)
    }

    case 'ppPrep': {
      const t = a.target
      const tw = st.words[t]
      if (!st.tokens[t] || t === i) return fail(st, 'Choose another word in the sentence.')
      if (tw?.pos !== 'PREP') return fail(st, 'That word is not a preposition.')
      if (st.openPP && st.openPP.prep !== t) return fail(st, 'This word does not go with that preposition.')
      return afterNomRole(withWord(st, i, { ppWith: t }), i)
    }

    case 'personal': {
      const c = checkPersonalEnding(lex, w.entryId!, surface, a.ending)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { personal: a.ending }), step: 'stem' }
    }

    case 'infEnding': {
      const c = checkInfinitiveEnding(lex, w.entryId!, surface, a.ending)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { ending: a.ending }), step: 'stem' }
    }

    case 'verbForm': {
      if (w.path === 'inf' && a.form.k !== 'inf') return fail(st, 'This is an infinitive.')
      if (w.path === 'finite' && a.form.k === 'inf') return fail(st, 'This form has a personal ending, so it is not an infinitive.')
      if (w.stemType && a.form.k !== 'imp' && !tensesForStem(w.stemType).includes(a.form.t)) return fail(st, 'That tense is not built on the stem you marked.')
      if (w.stemType && a.form.k === 'imp' && w.stemType !== 'pres') return fail(st, 'An imperative is built on the present stem.')
      if (w.stemType && !stemLimits(w.stemType).voices.includes(a.form.v)) return fail(st, `The ${STEM_NAME[w.stemType]} stem does not build the passive.`)
      const c = checkVerbForm(lex, surface, w.entryId!, a.form)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { verbForm: a.form }), step: 'verbRole' }
    }

    case 'verbRole': {
      const c = checkVerbRole(st, i, a.role, lex)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, i, { role: a.role })
      if (a.role.kind === 'label' && a.role.label === 'CINF') return { ...st, step: 'completes' }
      if (w.verbForm?.k === 'fin' || w.verbForm?.k === 'imp' || (w.path === 'none' && !w.verbForm)) st = markFinite(st)
      return finishWord(st)
    }

    case 'completes': {
      const t = a.target
      if (!st.tokens[t] || t === i) return fail(st, 'Choose another word in the sentence.')
      if (t < i && !isFiniteVerb(st, t)) return fail(st, 'That word is not a finite verb.')
      if (t > i) {
        // Not parsed yet: some reading of it must be finite (or a participle that may join a form of sum).
        const cands = lex.lookup(surfaceOf(st.tokens[t]))
        const can = !cands.length || cands.some((c) => !c.analyses.length || c.analyses.some((x) => x.k === 'fin' || x.k === 'imp' || x.k === 'ptc'))
        if (!can) return fail(st, 'That word cannot be a finite verb.')
      }
      return finishWord(withWord(st, i, { completes: t }))
    }

    case 'compoundForm': {
      const cp = findCompound(st, i)
      if (!cp) return fail(st, 'No compound verb here.')
      const ptcW = st.words[cp.ptc]
      const c = checkCompoundForm(lex, ptcW.entryId!, surfaceOf(st.tokens[cp.ptc]), surfaceOf(st.tokens[cp.sum]), a.form)
      if (!c.ok) return fail(st, c.reason)
      const cinf = [...incomingLinks(st, cp.ptc), ...incomingLinks(st, cp.sum)].find((l) => l.kind === 'cinf')
      if (cinf && a.form.k !== 'fin') return fail(st, `${quoted(st, cinf.from)} was linked to this verb as the finite verb it completes, but this is not a finite verb.`)
      st = withWord(st, cp.ptc, { compound: { ...cp, form: a.form } })
      return { ...st, step: 'compoundRole' }
    }

    case 'compoundRole': {
      const cp = findCompound(st, i)
      if (!cp?.form) return fail(st, 'No compound verb here.')
      if (a.role.kind !== 'label') return fail(st, 'Give the verb a verb label.')
      if (a.role.label === 'CINF') return fail(st, 'Label the two words together with a verb label.')
      const c = checkVerbLabel(lex, st.words[cp.ptc].entryId!, cp.form, a.role.label)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, cp.ptc, { compound: { ...cp, label: a.role.label } })
      // When sum came first, its clause was marked when it was linked.
      if (cp.form.k === 'fin' && cp.sum === i) st = markFinite(st)
      return finishWord(st)
    }

    case 'prepCase': {
      const e = lex.entries.get(w.entryId!)
      if (!e) return fail(st, 'Unknown word.')
      if (!isGloss(e.id)) {
        const c = checkPrepCase(e, a.c)
        if (!c.ok) return fail(st, c.reason)
      }
      st = withWord(st, i, { prepCase: a.c, role: { kind: 'label', label: 'PP' } })
      return finishWord({ ...st, openPP: { prep: i, c: a.c } })
    }

    case 'conjType': {
      const e = lex.entries.get(w.entryId!)
      if (!e) return fail(st, 'Unknown word.')
      if (!isGloss(e.id)) {
        const c = checkConjType(e, a.t)
        if (!c.ok) return fail(st, c.reason)
      }
      st = withWord(st, i, { conjType: a.t, role: { kind: 'label', label: a.t } })
      if (a.t === '+' && st.lastPP && st.lastPP.closer === i - 1) {
        st = { ...st, openPP: { prep: st.lastPP.prep, c: st.lastPP.c, soft: true, conj: i }, lastPP: null }
      }
      if (a.t === '↓') {
        const clauses = [...st.clauses, { conj: i, hasFiniteVerb: false }]
        st = withWord({ ...st, clauses }, i, { clauseDepth: clauses.length })
      }
      return finishWord(st)
    }

    case 'encliticPos': {
      const need: UiPos = tok.enclitic === 'ne' ? 'OTHER' : 'CONJ'
      if (a.pos !== need) return fail(st, 'That is not the part of speech of this enclitic.')
      if (need === 'CONJ') return { ...withWord(st, i, { enclitic: { pos: a.pos, done: false } }), step: 'encliticConj' }
      return finishWord(withWord(st, i, { enclitic: { pos: a.pos, done: true } }))
    }

    case 'encliticConj': {
      if (a.t !== '+') return fail(st, 'This enclitic is not subordinating.')
      return finishWord(withWord(st, i, { enclitic: { pos: 'CONJ', conjType: '+', done: true } }))
    }

    case 'sumUse': {
      if (a.target === null) return verbPath(st, i, analysesFor(lex, w.entryId!, surface))
      const t = a.target
      if (!st.tokens[t] || t <= i) return fail(st, 'Choose a later word.')
      const later = surfaceOf(st.tokens[t])
      const fits = lex.lookup(later).some((c) => c.analyses.some((x) => x.k === 'ptc') && compoundForms(lex, c.entryId, later, surface).length > 0)
      if (!fits) return fail(st, 'These two words do not make one verb form.')
      st = withWord(st, i, { path: 'none', role: { kind: 'aux', target: t } })
      if (analysesFor(lex, w.entryId!, surface).some((x) => x.k === 'fin')) st = markFinite(st)
      return finishWord(st)
    }

    case 'clauseBoundary': {
      const last = i === st.tokens.length - 1
      const top = st.clauses[st.clauses.length - 1]
      if (!top) return advance(st)
      if (a.ends) {
        if (!top.hasFiniteVerb && !last) return fail(st, 'This clause has no finite verb yet.')
        const clauses = st.clauses.slice(0, -1)
        st = { ...st, clauses }
        if (clauses.length && (last || clauses[clauses.length - 1].conj !== i)) return { ...st, step: 'clauseBoundary' }
        return advance(st)
      }
      if (last) return fail(st, 'The sentence ends here, so the clause must end too.')
      return advance(st)
    }
  }
}

/** The verb steps that follow part of speech: participles decline, infinitives and finite forms do not. */
function verbPath(st: SessionState, i: number, an: Analysis[]): SessionState {
  if (an.length && an.every((x) => x.k === 'ptc' || x.k === 'ger')) return { ...withWord(st, i, { path: 'nominal' }), step: 'ending' }
  if (an.some((x) => x.k === 'inf')) return { ...withWord(st, i, { path: 'inf' }), step: 'infEnding' }
  return { ...withWord(st, i, { path: 'finite' }), step: 'personal' }
}

function allowedPosForGloss(pos: string): UiPos[] {
  const map: Record<string, UiPos[]> = { n: ['N'], adj: ['ADJ'], num: ['ADJ'], pron: ['PRO'], v: ['V'], adv: ['ADV'], prep: ['PREP'], conj: ['CONJ'] }
  return map[pos] ?? ['OTHER']
}

export function findCompound(st: SessionState, i: number): Compound | undefined {
  const w = st.words[i]
  if (w.compound) return w.compound
  if (w.role?.kind === 'aux' && w.role.target !== undefined) return st.words[w.role.target].compound
  return undefined
}

// ---------- options & replay ----------

export function optionsFor(st: SessionState, _lex?: Lexicon): Options {
  const i = activeIndex(st)
  const w = st.words[i]
  switch (st.step) {
    case 'pos': case 'encliticPos': return { pos: ALL_POS }
    case 'nomForm': {
      const from = incomingLinks(st, i).find((l) => l.kind === 'noun')?.from
      const form = from === undefined ? undefined : st.words[from].nomForm
      return { cases: ALL_CASES, numbers: ALL_NUMBERS, genders: ALL_GENDERS, ...(form ? { agree: { from: from!, form } } : {}) }
    }
    case 'relNG': return { numbers: ALL_NUMBERS, genders: ALL_GENDERS }
    case 'relCase': return { cases: ALL_CASES }
    case 'verbForm': case 'compoundForm': {
      const all = { persons: ALL_PERSONS, numbers: ALL_NUMBERS, tenses: ALL_TENSES, moods: ALL_MOODS, voices: ALL_VOICES }
      if (st.step !== 'verbForm' || !w.stemType) return all
      const lim = stemLimits(w.stemType)
      return {
        ...all,
        disabled: {
          tenses: ALL_TENSES.filter((t) => !lim.tenses.includes(t)),
          voices: ALL_VOICES.filter((v) => !lim.voices.includes(v)),
          moods: lim.imperative ? [] : ['imp'],
          why: `Greyed out: not built on the ${STEM_NAME[w.stemType]} stem.`,
        },
      }
    }
    case 'prepCase': return { cases: ['acc', 'abl'] }
    case 'nomRole': return { labels: w.pos === 'ADV' ? ['ADV'] : NOUN_LABELS }
    case 'verbRole': return { labels: VERB_LABELS }
    case 'compoundRole': return { labels: VERB_LABELS.filter((l) => l !== 'CINF') }
    default: return {}
  }
}

export function replay(tokens: Token[], log: Answer[], lex: Lexicon): SessionState {
  let st = startSession(tokens)
  for (const a of log) {
    const next = submit(st, a, lex)
    if (next.error) break
    st = next
  }
  return { ...st, error: null }
}
