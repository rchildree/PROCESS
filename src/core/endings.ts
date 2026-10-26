import {
  ADJ3_MF, ADJ3_N, ANY, FIFTH, FIRST, FOURTH_M, FOURTH_N, INFINITIVE, PERSONAL_ACT, PERSONAL_IMP, PERSONAL_PASS, PERSONAL_PERF,
  PRONOMINAL, SECOND_M, SECOND_N, THIRD_MF, THIRD_N, markersFor, merge, type EndingTable,
} from './data/endings.ts'
import { stripMacrons } from './normalize.ts'
import type { Analysis, Check, Entry, Gender, Lexicon } from './types.ts'

export type Paradigm = '1' | '2' | '3' | '4' | '5' | 'adj12' | 'adj3' | 'cmp' | 'ptc12' | 'ptc3' | 'pron' | 'any'

const LENIENT_IDS = new Set(['ille-adj', 'iste-adj', 'ipse-adj', 'unus-adj', 'alius-adj', 'solus-adj', 'totus-adj', 'nullus-adj', 'ullus-adj', 'alter-adj', 'neuter-adj', 'uter-adj'])
const ALL_NOUNS = merge(FIRST, SECOND_M, SECOND_N, THIRD_MF, THIRD_N, FOURTH_M, FOURTH_N, FIFTH)

const no = (reason: string): Check => ({ ok: false, reason })
const yes: Check = { ok: true }
const strip = (s: string) => stripMacrons(s).toLowerCase()

export function analysesFor(lex: Lexicon, entryId: string, surface: string): Analysis[] {
  return lex.lookup(surface).find((c) => c.entryId === entryId)?.analyses ?? []
}

export function paradigmFor(entry: Entry, a: Analysis): Paradigm {
  if (entry.pos === 'pron' || entry.pos === 'num' || LENIENT_IDS.has(entry.id) || entry.flags.includes('pronominal')) return 'pron'
  if (a.k === 'ptc') return a.t === 'pres' ? 'ptc3' : 'ptc12'
  if (a.k === 'ger') return 'ptc12'
  if (a.k === 'nom' && a.deg === 'cmp') return 'cmp'
  if (a.k === 'nom' && a.deg === 'sup') return 'adj12'
  if (entry.cls === 'irreg' || entry.flags.includes('irreg') || entry.id === 'domus-n') return 'any'
  if (entry.pos === 'adj') return entry.cls === '3' ? 'adj3' : 'adj12'
  if (entry.cls && ['1', '2', '3', '4', '5'].includes(entry.cls)) return entry.cls as Paradigm
  return 'any'
}

function tableFor(p: Paradigm, g: Gender): EndingTable {
  switch (p) {
    case '1': return FIRST
    case '2': return g === 'n' ? SECOND_N : SECOND_M
    case '3': return g === 'n' ? THIRD_N : THIRD_MF
    case '4': return g === 'n' ? FOURTH_N : FOURTH_M
    case '5': return FIFTH
    case 'adj12': case 'ptc12': return g === 'f' ? FIRST : g === 'n' ? SECOND_N : SECOND_M
    case 'adj3': return g === 'n' ? ADJ3_N : ADJ3_MF
    case 'ptc3': return merge(g === 'n' ? THIRD_N : THIRD_MF, { nom: { sg: ['s', 'ns'] }, voc: { sg: ['s', 'ns'] }, ...(g === 'n' ? { acc: { sg: ['s', 'ns'] } } : {}) })
    case 'cmp': {
      const base = g === 'n' ? THIRD_N : THIRD_MF
      const withIor: EndingTable = {}
      for (const [c, byNum] of Object.entries(base)) {
        withIor[c as keyof EndingTable] = Object.fromEntries(Object.entries(byNum!).map(([n, list]) => [n, list.map((e) => 'ior' + e)]))
      }
      const nSg: EndingTable = g === 'n' ? { nom: { sg: ['ius', 'us'] }, acc: { sg: ['ius', 'us'] }, voc: { sg: ['ius', 'us'] } } : {}
      return merge(base, withIor, nSg)
    }
    case 'pron': case 'any': return ALL_NOUNS
  }
}

export function checkNominalEnding(lex: Lexicon, entryId: string, surface: string, ending: string): Check {
  const entry = lex.entries.get(entryId)
  const s = strip(surface)
  const e = strip(ending)
  if (!entry || !s.endsWith(e)) return no('That is not the end of this word.')
  if (s.length - e.length < 1) return no('The ending cannot be the whole word — leave the stem.')
  const analyses = analysesFor(lex, entryId, surface).filter((a) => a.c && a.n && a.g)
  for (const a of analyses) {
    const p = paradigmFor(entry, a)
    if (p === 'pron') {
      if (e && (PRONOMINAL.includes(e) || (tableFor('any', a.g!)[a.c!]?.[a.n!] ?? []).includes(e))) return yes
      continue
    }
    const allowed = tableFor(p, a.g!)[a.c!]?.[a.n!] ?? []
    if (allowed.includes(e)) return yes
  }
  return no(e ? `“-${ending}” is not an ending this word can have.` : 'This form has a visible ending — mark it.')
}

/** The personal-ending step on its own: is there any reading of this form with that personal ending? */
export function checkPersonalEnding(lex: Lexicon, entryId: string, surface: string, personal: string): Check {
  const s = strip(surface)
  const pe = strip(personal)
  if (!s.endsWith(pe)) return no('That is not the end of this word.')
  if (s.length - pe.length < 1) return no('Leave the stem — the ending cannot be the whole word.')
  for (const a of analysesFor(lex, entryId, surface)) {
    if (a.k === 'imp' && PERSONAL_IMP[a.n ?? 'sg'].includes(pe)) return yes
    if (a.k !== 'fin') continue
    const table = a.t === 'pf' && a.m === 'ind' && a.v === 'act' ? PERSONAL_PERF : a.v === 'pass' ? PERSONAL_PASS : PERSONAL_ACT
    if ((table[`${a.p}${a.n}`] ?? []).includes(pe)) return yes
  }
  return no(`“-${personal}” is not a personal ending this form can have.`)
}

export function checkVerbSegments(lex: Lexicon, entryId: string, surface: string, personal: string, marker: string | null): Check {
  const entry = lex.entries.get(entryId)
  const s = strip(surface)
  const pe = strip(personal)
  const mk = marker === null ? null : strip(marker)
  if (!entry || !s.endsWith(pe)) return no('That is not the end of this word.')
  const rest = s.slice(0, s.length - pe.length)
  if (mk !== null && !rest.endsWith(mk)) return no('The marker must sit just before the personal ending.')
  if (mk !== null && rest.length - mk.length < 1) return no('Leave the stem — the marker cannot take the whole word.')
  let personalOk = false
  for (const a of analysesFor(lex, entryId, surface)) {
    let personals: string[]
    if (a.k === 'imp') personals = PERSONAL_IMP[a.n ?? 'sg']
    else if (a.k !== 'fin') continue
    else {
      const key = `${a.p}${a.n}`
      personals = (a.t === 'pf' && a.m === 'ind' && a.v === 'act' ? PERSONAL_PERF : a.v === 'pass' ? PERSONAL_PASS : PERSONAL_ACT)[key] ?? []
    }
    if (!personals.includes(pe)) continue
    personalOk = true
    const markers = a.k === 'imp' ? [''] : markersFor(a.t ?? 'pres', a.m ?? 'ind', entry.cls)
    if (markers === ANY) return yes
    if (mk === null ? markers.includes('') : markers.includes(mk)) return yes
  }
  if (!personalOk) return no(`“-${personal}” is not a personal ending this form can have.`)
  return mk === null ? no('This form has a tense/mood marker — find it.') : no(`“-${marker}-” is not a marker this form can have.`)
}

export function checkInfinitiveEnding(lex: Lexicon, entryId: string, surface: string, ending: string): Check {
  const s = strip(surface)
  const e = strip(ending)
  if (!s.endsWith(e)) return no('That is not the end of this word.')
  if (s.length - e.length < 1) return no('Leave the stem — the ending cannot be the whole word.')
  if (!analysesFor(lex, entryId, surface).some((a) => a.k === 'inf')) return no('This is not an infinitive.')
  return INFINITIVE.includes(e) ? yes : no(`“-${ending}” is not an infinitive ending.`)
}
