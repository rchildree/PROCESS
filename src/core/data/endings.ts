// Standard textbook endings, written without macrons (comparison is macron-insensitive).
import type { Case, Num } from '../types.ts'

export type EndingTable = Partial<Record<Case, Partial<Record<Num, string[]>>>>

const t = (sg: string[][], pl: string[][]): EndingTable => {
  const cases: Case[] = ['nom', 'gen', 'dat', 'acc', 'abl', 'voc']
  const out: EndingTable = {}
  cases.forEach((c, i) => { out[c] = { sg: sg[i], pl: pl[i] } })
  return out
}

export const FIRST = t([['a'], ['ae'], ['ae'], ['am'], ['a'], ['a']], [['ae'], ['arum'], ['is'], ['as'], ['is'], ['ae']])
export const SECOND_M = t([['us', ''], ['i'], ['o'], ['um'], ['o'], ['e', '', 'i']], [['i'], ['orum'], ['is'], ['os'], ['is'], ['i']])
export const SECOND_N = t([['um'], ['i'], ['o'], ['um'], ['o'], ['um']], [['a'], ['orum'], ['is'], ['a'], ['is'], ['a']])
// Third declension: consonant and i-stem endings together (the app only rejects the impossible).
export const THIRD_MF = t([[''], ['is'], ['i'], ['em', 'im'], ['e', 'i'], ['']], [['es'], ['um', 'ium'], ['ibus'], ['es', 'is'], ['ibus'], ['es']])
export const THIRD_N = t([[''], ['is'], ['i'], [''], ['e', 'i'], ['']], [['a', 'ia'], ['um', 'ium'], ['ibus'], ['a', 'ia'], ['ibus'], ['a', 'ia']])
export const FOURTH_M = t([['us'], ['us'], ['ui', 'u'], ['um'], ['u'], ['us']], [['us'], ['uum'], ['ibus'], ['us'], ['ibus'], ['us']])
export const FOURTH_N = t([['u'], ['us'], ['u', 'ui'], ['u'], ['u'], ['u']], [['ua'], ['uum'], ['ibus'], ['ua'], ['ibus'], ['ua']])
export const FIFTH = t([['es'], ['ei'], ['ei'], ['em'], ['e'], ['es']], [['es'], ['erum'], ['ebus'], ['es'], ['ebus'], ['es']])
// Third-declension adjectives add -is / -e nominatives to the noun endings.
export const ADJ3_MF = merge(THIRD_MF, { nom: { sg: ['is'] }, voc: { sg: ['is'] } })
export const ADJ3_N = merge(THIRD_N, { nom: { sg: ['e'] }, acc: { sg: ['e'] }, voc: { sg: ['e'] } })

export const PRONOMINAL = ['ius', 'i', 'o', 'um', 'am', 'a', 'ae', 'e', 'ud', 'd', 'c', 's', 'os', 'as', 'orum', 'arum', 'is', 'ibus', 'es', 'ia', 'em', 'us', 'ic', 'oc', 'anc', 'unc', 'ac', 'arunc', 'orunc', 'ec', 'ius', 'ui', 'obus', 'abus', 'ium']

export function merge(...tables: EndingTable[]): EndingTable {
  const out: EndingTable = {}
  for (const tab of tables) {
    for (const [c, byNum] of Object.entries(tab) as [Case, Partial<Record<Num, string[]>>][]) {
      const o = (out[c] ??= {})
      for (const [n, list] of Object.entries(byNum) as [Num, string[]][]) o[n] = [...new Set([...(o[n] ?? []), ...list])]
    }
  }
  return out
}

// Verbs
export const PERSONAL_ACT: Record<string, string[]> = { '1sg': ['o', 'm'], '2sg': ['s'], '3sg': ['t'], '1pl': ['mus'], '2pl': ['tis'], '3pl': ['nt'] }
export const PERSONAL_PASS: Record<string, string[]> = { '1sg': ['or', 'r'], '2sg': ['ris', 're'], '3sg': ['tur'], '1pl': ['mur'], '2pl': ['mini'], '3pl': ['ntur'] }
export const PERSONAL_PERF: Record<string, string[]> = { '1sg': ['i'], '2sg': ['isti'], '3sg': ['it'], '1pl': ['imus'], '2pl': ['istis'], '3pl': ['erunt', 'ere'] }
export const PERSONAL_IMP: Record<string, string[]> = { sg: ['', 're'], pl: ['te', 'mini'] }

/** Tense/mood markers; '' means "no marker". `ANY` = irregular, anything accepted. */
export const ANY = ['*']
export function markersFor(t: string, m: string, cls: string | undefined): string[] {
  if (cls === 'irreg') return ANY
  const early = cls === '1' || cls === '2'
  if (m === 'ind') {
    switch (t) {
      case 'pres': case 'pf': return ['']
      case 'impf': return ['ba', 'eba', 'ieba']
      case 'fut': return early ? ['b', 'bi', 'bu', 'be'] : ['e', 'a', 'ie', 'ia']
      case 'plupf': return ['era']
      case 'futpf': return ['eri', 'er']
    }
  }
  if (m === 'subj') {
    switch (t) {
      case 'pres': return cls === '1' ? ['e'] : ['a', 'ea', 'ia']
      case 'impf': return ['re', 'are', 'ere', 'ire']
      case 'pf': return ['eri']
      case 'plupf': return ['isse']
    }
  }
  return ['']
}

export const INFINITIVE = ['re', 'ri', 'i', 'isse', 'esse', 'se', 'ere', 'are', 'ire', 'le', 'lle']
