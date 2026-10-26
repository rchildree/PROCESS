// The step-by-step flow for one sentence, as a pure reducer.
import {
  checkAgreement, checkCompoundForm, checkConjType, checkIdentify, checkNomForm, checkNounLabel, checkPos,
  checkPrepCase, checkVerbForm, checkVerbLabel, type Label, type NomForm, type UiPos, type VerbForm,
} from './checks.ts'
import { NOUN_LABELS, VERB_LABELS } from './data/labels.ts'
import { analysesFor, checkInfinitiveEnding, checkNominalEnding, checkPersonalEnding, checkVerbSegments } from './endings.ts'
import type { Token } from './sets.ts'
import type { Case, Check, Gender, Lexicon, Mood, Num, Person, Tense, Voice } from './types.ts'

export type StepId =
  | 'identify' | 'pos' | 'ending' | 'nomForm' | 'nomRole' | 'personal' | 'marker' | 'infEnding' | 'verbForm' | 'verbRole'
  | 'compoundForm' | 'compoundRole' | 'prepCase' | 'conjType' | 'linkPending' | 'clauseBoundary' | 'encliticPos'
  | 'encliticConj' | 'resolvePending' | 'done'

export type Role =
  | { kind: 'label'; label: Label }
  | { kind: 'modifies'; target: number }
  | { kind: 'pendingNoun' }
  | { kind: 'predicate'; label: 'SC' | 'OC' }
  | { kind: 'substantive'; label: Label }
  | { kind: 'verbPart'; target?: number }
  | { kind: 'aux'; target?: number }

export type Answer =
  | { step: 'identify'; entryId: string }
  | { step: 'pos'; pos: UiPos }
  | { step: 'ending' | 'infEnding' | 'personal'; ending: string }
  | { step: 'marker'; marker: string | null }
  | { step: 'nomForm'; form: NomForm }
  | { step: 'verbForm' | 'compoundForm'; form: VerbForm }
  | { step: 'nomRole' | 'verbRole' | 'compoundRole' | 'resolvePending'; role: Role }
  | { step: 'linkPending'; target: number | null }
  | { step: 'prepCase'; c: Case }
  | { step: 'conjType' | 'encliticConj'; t: '+' | '↓' }
  | { step: 'encliticPos'; pos: UiPos }
  | { step: 'clauseBoundary'; ends: boolean }

export interface Compound { ptc: number; sum: number; form?: VerbForm; label?: Label }

export interface WordState {
  entryId?: string
  pos?: UiPos
  /** 'nominal' = ending → case/number/gender; 'finite' = personal → marker; 'inf' = infinitive ending. */
  path?: 'nominal' | 'finite' | 'inf' | 'none'
  ending?: string
  personal?: string
  marker?: string | null
  nomForm?: NomForm
  verbForm?: VerbForm
  role?: Role
  prepCase?: Case
  conjType?: '+' | '↓'
  compound?: Compound
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
  pendingLinkCandidates: number[]
  resolving: number | null
  error: string | null
  log: Answer[]
}

export interface Options {
  cases?: Case[]; numbers?: Num[]; genders?: Gender[]; persons?: Person[]; tenses?: Tense[]; moods?: Mood[]; voices?: Voice[]
  labels?: Label[]; nounTargets?: number[]; pendingTargets?: number[]; pos?: UiPos[]
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
  return st.resolving ?? st.current
}

const isGloss = (id?: string) => !!id && id.startsWith('gloss:')

/** A word that can be the noun an adjective points to. */
export function isNounLike(w: WordState): boolean {
  if (!w.role) return false
  if (!w.nomForm && w.path !== 'none') return false
  if (w.role.kind === 'substantive') return true
  return w.role.kind === 'label' && (w.pos === 'N' || w.pos === 'PRO')
}

function isUnresolved(w: WordState): boolean {
  const r = w.role
  if (!r) return false
  if (r.kind === 'pendingNoun') return true
  if ((r.kind === 'verbPart' || r.kind === 'aux') && r.target === undefined) return true
  return false
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
    pendingLinkCandidates: [],
    resolving: null,
    error: null,
    log: [],
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
  return nextUnresolved({ ...st, resolving: null })
}

function nextUnresolved(st: SessionState): SessionState {
  const i = st.words.findIndex(isUnresolved)
  if (i < 0) return { ...st, resolving: null, step: 'done' }
  return { ...st, resolving: i, step: 'resolvePending' }
}

/** After a noun-like word is labeled: offer pending adjectives that agree with it. */
function afterNounLike(st: SessionState): SessionState {
  const i = st.current
  const w = st.words[i]
  if (!isNounLike(w)) return finishWord(st)
  const cands = st.words
    .map((x, j) => ({ x, j }))
    .filter(({ x, j }) => j < i && x.role?.kind === 'pendingNoun' && (!x.nomForm || !w.nomForm || checkAgreement(x.nomForm, w.nomForm).ok))
    .map(({ j }) => j)
  if (!cands.length) return finishWord(st)
  return { ...st, pendingLinkCandidates: cands, step: 'linkPending' }
}

function closePPIfObject(st: SessionState, i: number): SessionState {
  const w = st.words[i]
  const label = w.role?.kind === 'label' || w.role?.kind === 'substantive' ? w.role.label : null
  if (label !== 'PP' || !st.openPP) return st
  return { ...st, openPP: null, lastPP: { prep: st.openPP.prep, c: st.openPP.c, closer: i } }
}

// ---------- role checks ----------

function checkNominalRole(st: SessionState, i: number, role: Role, lex: Lexicon, resolving: boolean): Check {
  const w = st.words[i]
  const form = w.nomForm
  const openPP = resolving ? null : st.openPP ? { case: st.openPP.c, soft: st.openPP.soft } : null
  const gloss = isGloss(w.entryId) || (w.path === 'none' && !form)
  const no = (reason: string): Check => ({ ok: false, reason })

  if (w.pos === 'ADV') {
    return role.kind === 'label' && role.label === 'ADV' ? { ok: true } : no('An adverb is labeled ADV.')
  }
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
      if (!resolving && role.target > i) return no('That word has not been reached yet.')
      if (!isNounLike(t)) return no('That word is not being used as a noun.')
      return form && t.nomForm ? checkAgreement(form, t.nomForm) : { ok: true }
    }
    case 'pendingNoun':
      if (resolving) return no('The sentence is finished — decide now.')
      if (w.pos === 'N') return no('A noun does not wait for another noun.')
      return { ok: true }
    case 'verbPart': {
      if (resolving) return no('There is no form of sum left for this participle — decide what else it does.')
      const ptc = w.entryId ? analysesFor(lex, w.entryId, surfaceOf(st.tokens[i])).some((a) => a.k === 'ptc') : false
      if (!ptc) return no('Only a participle can be part of a verb.')
      if (role.target !== undefined) {
        const t = st.words[role.target]
        if (!t || role.target >= i || t.role?.kind !== 'aux' || t.role.target !== undefined) return no('Choose a form of sum that is waiting for a participle.')
      }
      return { ok: true }
    }
    case 'aux':
      return no('Only a form of sum can be an auxiliary.')
  }
}

function checkVerbRole(st: SessionState, i: number, role: Role, lex: Lexicon, resolving: boolean): Check {
  const w = st.words[i]
  const no = (reason: string): Check => ({ ok: false, reason })
  if (role.kind === 'label') {
    if (isGloss(w.entryId) || (w.path === 'none' && !w.verbForm)) return VERB_LABELS.includes(role.label) ? { ok: true } : no('That label is not for verbs.')
    return w.verbForm && w.entryId ? checkVerbLabel(lex, w.entryId, w.verbForm, role.label) : no('Missing verb form.')
  }
  if (role.kind === 'aux') {
    if (w.entryId !== 'sum-v') return no('Only a form of sum can be an auxiliary.')
    if (resolving) return no('There is no participle left for this verb — label it.')
    if (role.target !== undefined) {
      const t = st.words[role.target]
      if (!t || role.target >= i || t.role?.kind !== 'verbPart' || t.role.target !== undefined) return no('Choose a participle that is waiting for its auxiliary.')
    }
    return { ok: true }
  }
  return no('Give the verb a verb label.')
}

// ---------- submit ----------

export function submit(st: SessionState, a: Answer, lex: Lexicon): SessionState {
  if (st.step === 'done') return fail(st, 'This sentence is finished.')
  if (a.step !== st.step) return fail(st, 'Answer the current question first.')
  const next = apply({ ...st, error: null }, a, lex)
  if (next.error) return { ...next, log: st.log }
  return { ...next, error: null, log: [...st.log, a] }
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
      return { ...withWord(st, i, { entryId: a.entryId }), step: 'pos', error: null }
    }

    case 'pos': {
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
        case 'V': {
          const an = anAll
          if (an.length && an.every((x) => x.k === 'ptc' || x.k === 'ger')) return { ...withWord(st, i, { path: 'nominal' }), step: 'ending' }
          if (an.some((x) => x.k === 'inf')) return { ...withWord(st, i, { path: 'inf' }), step: 'infEnding' }
          return { ...withWord(st, i, { path: 'finite' }), step: 'personal' }
        }
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
      return { ...withWord(st, i, { ending: a.ending }), step: 'nomForm' }
    }

    case 'nomForm': {
      const c = checkNomForm(lex, surface, w.entryId!, a.form)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { nomForm: a.form }), step: 'nomRole' }
    }

    case 'nomRole': {
      const c = checkNominalRole(st, i, a.role, lex, false)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, i, { role: a.role })
      if (a.role.kind === 'verbPart' && a.role.target !== undefined) {
        st = withWord(st, a.role.target, { role: { kind: 'aux', target: i } })
        const compound: Compound = { ptc: i, sum: a.role.target }
        return { ...withWord(st, i, { compound }), step: 'compoundForm' }
      }
      st = closePPIfObject(st, i)
      return afterNounLike(st)
    }

    case 'linkPending': {
      if (a.target === null) return finishWord({ ...st, pendingLinkCandidates: [] })
      if (!st.pendingLinkCandidates.includes(a.target)) return fail(st, 'That word is not waiting for this noun.')
      st = withWord(st, a.target, { role: { kind: 'modifies', target: i } })
      const rest = st.pendingLinkCandidates.filter((j) => j !== a.target)
      if (rest.length) return { ...st, pendingLinkCandidates: rest }
      return finishWord({ ...st, pendingLinkCandidates: [] })
    }

    case 'personal': {
      const c = checkPersonalEnding(lex, w.entryId!, surface, a.ending)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { personal: a.ending }), step: 'marker' }
    }

    case 'marker': {
      const c = checkVerbSegments(lex, w.entryId!, surface, w.personal ?? '', a.marker)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { marker: a.marker }), step: 'verbForm' }
    }

    case 'infEnding': {
      const c = checkInfinitiveEnding(lex, w.entryId!, surface, a.ending)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { ending: a.ending }), step: 'verbForm' }
    }

    case 'verbForm': {
      if (w.path === 'inf' && a.form.k !== 'inf') return fail(st, 'This is an infinitive.')
      if (w.path === 'finite' && a.form.k === 'inf') return fail(st, 'This form has a personal ending, so it is not an infinitive.')
      const c = checkVerbForm(lex, surface, w.entryId!, a.form)
      if (!c.ok) return fail(st, c.reason)
      return { ...withWord(st, i, { verbForm: a.form }), step: 'verbRole' }
    }

    case 'verbRole': {
      const c = checkVerbRole(st, i, a.role, lex, false)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, i, { role: a.role })
      if (a.role.kind === 'aux') {
        if (a.role.target === undefined) return finishWord(st)
        const p = a.role.target
        st = withWord(st, p, { role: { kind: 'verbPart', target: i }, compound: { ptc: p, sum: i } })
        return { ...st, step: 'compoundForm' }
      }
      if (w.verbForm?.k === 'fin' || w.verbForm?.k === 'imp' || (w.path === 'none' && !w.verbForm)) st = markFinite(st)
      return finishWord(st)
    }

    case 'compoundForm': {
      const cp = findCompound(st, i)
      if (!cp) return fail(st, 'No compound verb here.')
      const ptcW = st.words[cp.ptc]
      const c = checkCompoundForm(lex, ptcW.entryId!, surfaceOf(st.tokens[cp.ptc]), surfaceOf(st.tokens[cp.sum]), a.form)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, cp.ptc, { compound: { ...cp, form: a.form } })
      return { ...st, step: 'compoundRole' }
    }

    case 'compoundRole': {
      const cp = findCompound(st, i)
      if (!cp?.form) return fail(st, 'No compound verb here.')
      if (a.role.kind !== 'label') return fail(st, 'Give the verb a verb label.')
      const c = checkVerbLabel(lex, st.words[cp.ptc].entryId!, cp.form, a.role.label)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, cp.ptc, { compound: { ...cp, label: a.role.label } })
      if (cp.form.k === 'fin') st = markFinite(st)
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

    case 'resolvePending': {
      const r = st.resolving
      if (r === null) return fail(st, 'Nothing to resolve.')
      const rw = st.words[r]
      const isVerb = rw.role?.kind === 'aux'
      const c = isVerb ? checkVerbRole(st, r, a.role, lex, true) : checkNominalRole(st, r, a.role, lex, true)
      if (!c.ok) return fail(st, c.reason)
      st = withWord(st, r, { role: a.role })
      return nextUnresolved(st)
    }
  }
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

export function optionsFor(st: SessionState, lex: Lexicon): Options {
  const i = activeIndex(st)
  const w = st.words[i]
  const nounTargets = st.words.map((x, j) => ({ x, j })).filter(({ x, j }) => j !== i && isNounLike(x) && (st.step === 'resolvePending' || j < i)).map(({ j }) => j)
  switch (st.step) {
    case 'pos': case 'encliticPos': return { pos: ALL_POS }
    case 'nomForm': return { cases: ALL_CASES, numbers: ALL_NUMBERS, genders: ALL_GENDERS }
    case 'verbForm': case 'compoundForm': return { persons: ALL_PERSONS, numbers: ALL_NUMBERS, tenses: ALL_TENSES, moods: ALL_MOODS, voices: ALL_VOICES }
    case 'prepCase': return { cases: ['acc', 'abl'] }
    case 'nomRole': {
      const pendingTargets = st.words.map((x, j) => ({ x, j })).filter(({ x, j }) => j < i && x.role?.kind === 'aux' && x.role.target === undefined).map(({ j }) => j)
      const ptc = w.entryId && !isGloss(w.entryId) ? analysesFor(lex, w.entryId, surfaceOf(st.tokens[i])).some((a) => a.k === 'ptc') : false
      return { labels: w.pos === 'ADV' ? ['ADV'] : NOUN_LABELS, nounTargets, pendingTargets: ptc ? pendingTargets : [] }
    }
    case 'verbRole': case 'compoundRole': {
      const pendingTargets = st.words.map((x, j) => ({ x, j })).filter(({ x, j }) => j < i && x.role?.kind === 'verbPart' && x.role.target === undefined).map(({ j }) => j)
      return { labels: VERB_LABELS, pendingTargets: st.step === 'verbRole' && w.entryId === 'sum-v' ? pendingTargets : [] }
    }
    case 'linkPending': return { pendingTargets: st.pendingLinkCandidates }
    case 'resolvePending': return { labels: w.role?.kind === 'aux' ? VERB_LABELS : NOUN_LABELS, nounTargets }
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
