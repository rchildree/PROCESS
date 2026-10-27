import { COPULAR_ALWAYS, COPULAR_PASSIVE, EXISTENTIAL } from './data/copular.ts'
import { NOUN_LABELS, type Label } from './data/labels.ts'
import { analysesFor } from './endings.ts'
import type { Case, Check, Entry, Gender, Lexicon, Mood, Num, Person, Pos, Tense, Voice } from './types.ts'

export type { Label }
export type UiPos = 'N' | 'ADJ' | 'PRO' | 'V' | 'ADV' | 'PREP' | 'CONJ' | 'OTHER'
export interface NomForm { c: Case; n: Num; g: Gender }
export interface VerbForm { k: 'fin' | 'inf' | 'imp'; t: Tense; v: Voice; m?: Mood; p?: Person; n?: Num }

const yes: Check = { ok: true }
const no = (reason: string): Check => ({ ok: false, reason })

export const CASE_NAME: Record<Case, string> = { nom: 'nominative', gen: 'genitive', dat: 'dative', acc: 'accusative', abl: 'ablative', voc: 'vocative', loc: 'locative' }

export function checkIdentify(lex: Lexicon, surface: string, entryId: string): Check {
  return lex.lookup(surface).some((c) => c.entryId === entryId) ? yes : no(`“${surface}” cannot be a form of that word.`)
}

const POS_MAP: Record<Pos, UiPos[]> = {
  n: ['N'], adj: ['ADJ'], num: ['ADJ'], pron: ['PRO'], v: ['V'], adv: ['ADV'], prep: ['PREP'], conj: ['CONJ'],
  particle: ['OTHER'], other: ['OTHER'], phrase: ['OTHER'],
}
const DEMONSTRATIVE_PRON = new Set(['hic-pron', 'is-pron', 'idem-pron'])
const PRONOMINAL_ADJ = new Set(['ille-adj', 'iste-adj', 'ipse-adj', 'unus-adj'])
/** Defective verbs the dataset files under 'other'. */
const VERB_LIKE = new Set(['ait-other', 'inquit-other'])

export function allowedPos(lex: Lexicon, surface: string, entryId: string): UiPos[] {
  const e = lex.entries.get(entryId)
  if (!e) return []
  const out = new Set(POS_MAP[e.pos])
  if (DEMONSTRATIVE_PRON.has(entryId)) out.add('ADJ')
  if (PRONOMINAL_ADJ.has(entryId)) out.add('PRO')
  if (e.pos === 'other' || e.pos === 'particle') {
    const d = e.definition.toLowerCase()
    if (/(subord\. conj|coord\. conj|sentence connector)/.test(d)) out.add('CONJ')
    if (/(question word|interrogative adv|intensifier|sentence connector|\badv\b|adv\.)/.test(d)) out.add('ADV')
    if (/indecl\. adj/.test(d)) out.add('ADJ')
    if (VERB_LIKE.has(entryId)) out.add('V')
  }
  if (e.pos === 'v') {
    const a = analysesFor(lex, entryId, surface)
    if (a.length && a.every((x) => x.k === 'ptc' || x.k === 'ger')) out.add('ADJ')
  }
  return [...out]
}

export function checkPos(lex: Lexicon, surface: string, entryId: string, pos: UiPos): Check {
  return allowedPos(lex, surface, entryId).includes(pos) ? yes : no('That is not the part of speech of this word.')
}

export function checkNomForm(lex: Lexicon, surface: string, entryId: string, f: NomForm): Check {
  const all = analysesFor(lex, entryId, surface).filter((a) => a.c && a.n && a.g)
  if (all.some((a) => a.c === f.c && a.n === f.n && a.g === f.g)) return yes
  if (all.some((a) => a.c === f.c && a.n === f.n)) {
    const e = lex.entries.get(entryId)
    if (e?.pos === 'n') return no('Check the gender in the dictionary entry.')
    return no('This form cannot be that gender.')
  }
  return no(`This form cannot be ${CASE_NAME[f.c]} ${f.n === 'sg' ? 'singular' : 'plural'}.`)
}

export function checkNounLabel(f: NomForm, label: Label, openPP: { case: Case; soft?: boolean } | null): Check {
  if (!NOUN_LABELS.includes(label)) return no('That label is not for nouns.')
  if (openPP && !openPP.soft && f.c === openPP.case && label !== 'PP') return no('This word is in the case the preposition takes.')
  if (label === 'PP') {
    if (!openPP) return no('There is no preposition for this word to belong to.')
    if (openPP.case !== f.c) return no(`The preposition does not take the ${CASE_NAME[f.c]}.`)
    return yes
  }
  // Outside the kernel (e.g. ūnō diē): any case may take it.
  if (label === '——') return yes
  const fits: Partial<Record<Case, Label[]>> = { nom: ['S', 'SC'], acc: ['O', 'OC'], abl: ['ADV'], loc: ['ADV'] }
  const allowed = fits[f.c]
  if (!allowed) return yes // genitive, dative, vocative: no labels yet
  return allowed.includes(label) ? yes : no(`A ${CASE_NAME[f.c]} cannot be ${label}.`)
}

export function checkAgreement(adj: NomForm, noun: NomForm): Check {
  if (adj.c !== noun.c) return no('They do not agree in case.')
  if (adj.n !== noun.n) return no('They do not agree in number.')
  if (adj.g !== noun.g) return no('They do not agree in gender.')
  return yes
}

function sameVerbForm(a: VerbForm, b: Partial<VerbForm> & { k?: string }): boolean {
  if (a.k !== b.k) return false
  if (a.k === 'imp') return a.n === b.n && (b.v === undefined || a.v === b.v)
  if (a.t !== b.t || a.v !== b.v) return false
  if (a.k === 'inf') return true
  return a.m === b.m && a.p === b.p && a.n === b.n
}

export function checkVerbForm(lex: Lexicon, surface: string, entryId: string, f: VerbForm): Check {
  const all = analysesFor(lex, entryId, surface)
  const deponent = !!lex.entries.get(entryId)?.flags.includes('deponent')
  if (f.k === 'imp' && f.v === 'pass' && !deponent && all.some((a) => a.k === 'imp' && a.v === undefined)) return no('This form cannot be parsed that way.')
  if (all.some((a) => a.k === f.k && sameVerbForm(f, { ...a, k: a.k as VerbForm['k'], t: a.t ?? (a.k === 'imp' ? 'pres' : undefined) } as VerbForm))) return yes
  return no('This form cannot be parsed that way.')
}

export function checkVerbLabel(lex: Lexicon, entryId: string, f: VerbForm, label: Label): Check {
  const e = lex.entries.get(entryId)
  if (!e) return no('Unknown word.')
  const deponent = e.flags.includes('deponent')
  switch (label) {
    case 'PV': return f.v === 'pass' && !deponent ? yes : no(f.v === 'pass' ? 'A deponent verb is active in meaning.' : 'This verb is not passive.')
    case 'V': return f.v === 'act' || deponent ? yes : no('This verb is passive.')
    case '=':
      if (COPULAR_ALWAYS.includes(entryId)) return yes
      if (COPULAR_PASSIVE.includes(entryId) && f.v === 'pass') return yes
      return no('This verb cannot be copular here.')
    case 'X': return EXISTENTIAL.includes(entryId) ? yes : no('Only a form of sum can be existential.')
    case 'CINF': return f.k === 'inf' ? yes : no('Only an infinitive can be a complementary infinitive.')
    default: return no('That label is not for verbs.')
  }
}

export function prepCases(entry: Entry): Case[] {
  const out = new Set<Case>()
  for (const m of entry.definition.matchAll(/\+\s*((?:(?:acc|abl)\.?\s*)+)/g)) {
    if (m[1].includes('acc')) out.add('acc')
    if (m[1].includes('abl')) out.add('abl')
  }
  return [...out]
}

export function checkPrepCase(entry: Entry, c: Case): Check {
  return prepCases(entry).includes(c) ? yes : no(`This preposition does not take the ${CASE_NAME[c]}.`)
}

export function checkConjType(entry: Entry, t: '+' | '↓'): Check {
  const d = entry.definition.toLowerCase()
  const coord = d.includes('coord') || d.includes('sentence connector')
  const sub = d.includes('subord')
  if (t === '+') return coord ? yes : no('This conjunction is not coordinating.')
  return sub || !coord ? yes : no('This conjunction is not subordinating.')
}

const NOMACC_END: Record<string, string> = {
  'nom sg m': 'us', 'acc sg m': 'um', 'nom sg f': 'a', 'acc sg f': 'am', 'nom sg n': 'um', 'acc sg n': 'um',
  'nom pl m': 'ī', 'acc pl m': 'ōs', 'nom pl f': 'ae', 'acc pl f': 'ās', 'nom pl n': 'a', 'acc pl n': 'a',
}

/** Forms the participle + sum pair can make together; [] if they cannot combine. */
export function compoundForms(lex: Lexicon, entryId: string, ptcSurface: string, sumSurface: string): VerbForm[] {
  if (!lex.lookup(sumSurface).some((c) => c.entryId === 'sum-v')) return []
  const out: VerbForm[] = []
  const add = (f: VerbForm) => { if (!out.some((o) => sameVerbForm(o, f))) out.push(f) }
  for (const a of analysesFor(lex, entryId, ptcSurface)) {
    if (a.k !== 'ptc' || !a.c || !a.n || !a.g || (a.c !== 'nom' && a.c !== 'acc')) continue
    const end = NOMACC_END[`${a.c} ${a.n} ${a.g}`]
    if (!ptcSurface.normalize('NFC').endsWith(end)) continue
    const stem = ptcSurface.normalize('NFC').slice(0, -end.length)
    const masc = a.n === 'sg' ? ['us', 'um'] : ['ī', 'ōs']
    for (const m of masc) {
      for (const r of analysesFor(lex, entryId, `${stem}${m} ${sumSurface}`)) {
        if (r.k === 'fin' && r.n === a.n && a.c === 'nom') add({ k: 'fin', t: r.t!, m: r.m, v: r.v!, p: r.p, n: r.n })
        if (r.k === 'inf') add({ k: 'inf', t: r.t!, v: r.v! })
      }
    }
  }
  return out
}

export function checkCompoundForm(lex: Lexicon, entryId: string, ptcSurface: string, sumSurface: string, f: VerbForm): Check {
  const forms = compoundForms(lex, entryId, ptcSurface, sumSurface)
  if (!forms.length) return no('These two words do not make one verb form.')
  return forms.some((x) => sameVerbForm(x, f)) ? yes : no('The two words together cannot be parsed that way.')
}
