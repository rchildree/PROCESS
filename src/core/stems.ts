// Verb stems from the principal parts: present (amā-), perfect active (amāv-), perfect passive (amāt-).
import { analysesFor } from './endings.ts'
import { stripMacrons } from './normalize.ts'
import type { Analysis, Check, Entry, Lexicon } from './types.ts'

export type StemType = 'pres' | 'pfAct' | 'pfPass'
export const STEM_TYPES: StemType[] = ['pres', 'pfAct', 'pfPass']
export const STEM_NAME: Record<StemType, string> = { pres: 'present', pfAct: 'perfect active', pfPass: 'perfect passive' }

const key = (s: string) => stripMacrons(s).toLowerCase()
const no = (reason: string): Check => ({ ok: false, reason })
const yes: Check = { ok: true }
const VOWELS = 'aeiou'

function cut(word: string | null | undefined, endings: string[]): string | null {
  if (!word) return null
  const w = key(word)
  for (const e of endings) if (w.endsWith(e) && w.length > e.length) return w.slice(0, -e.length)
  return null
}

/** Stems this verb allows for a stem type; 'any' = irregular present, any stem accepted. */
export function stemCandidates(entry: Entry, type: StemType): Set<string> | 'any' {
  const out = new Set<string>()
  const add = (s: string | null) => { if (s) out.add(s) }
  const deponent = entry.flags.includes('deponent')
  const perfectOnly = entry.flags.includes('perfect-only')
  const [p1, p2, p3, p4] = entry.pp
  if (type === 'pres') {
    if (perfectOnly) return out
    if (entry.cls === 'irreg' || entry.flags.includes('irreg')) return 'any'
    const base = cut(p2, ['re', 'ri', 'i'])
    add(base)
    // The stem vowel may be counted with the stem or with the marker: amā- or am-, rege- or reg-.
    if (base && VOWELS.includes(base[base.length - 1]) && base.length > 1) add(base.slice(0, -1))
    add(cut(p1, ['or', 'o']))
    return out
  }
  if (type === 'pfAct') {
    if (deponent) return out
    add(cut(perfectOnly ? p1 : p3, ['i']))
    return out
  }
  // Perfect passive: the participle part, plus any future participle in the entry (cāsūrus, itūrum).
  add(cut(deponent || perfectOnly ? p3 : p4, ['um', 'us']))
  for (const w of entry.dict.split(/[\s()]+/)) add(cut(w, ['urus', 'urum']))
  return out
}

function fits(type: StemType, a: Analysis, deponent: boolean): boolean {
  if (a.k === 'nom') return false
  if (a.k === 'ptc' || a.k === 'ger') {
    if (type === 'pres') return a.k === 'ger' || a.t === 'pres' || (a.t === 'fut' && a.v === 'pass')
    if (type === 'pfPass') return a.t === 'pf' || (a.t === 'fut' && a.v === 'act')
    return false
  }
  if (a.k === 'imp') return type === 'pres'
  const t = a.t ?? 'pres'
  if (type === 'pres') return t === 'pres' || t === 'impf' || t === 'fut'
  if (type === 'pfAct') return !deponent && (t === 'pf' || t === 'plupf' || t === 'futpf') && a.v !== 'pass'
  return false
}

function stemOk(entry: Entry, type: StemType, stem: string): boolean {
  const c = stemCandidates(entry, type)
  return c === 'any' ? stem.length > 0 : c.has(key(stem))
}

/** Can `stem` be the stem of this form for `type`? */
export function checkStemType(lex: Lexicon, entryId: string, surface: string, stem: string, type: StemType): Check {
  const entry = lex.entries.get(entryId)
  if (!entry) return no('Unknown word.')
  const an = analysesFor(lex, entryId, surface)
  const deponent = entry.flags.includes('deponent')
  if (!an.some((a) => fits(type, a, deponent))) return no(`This form is not built on the ${STEM_NAME[type]} stem.`)
  if (!stemOk(entry, type, stem)) return no(`“${stem}-” is not the ${STEM_NAME[type]} stem of this verb.`)
  return yes
}

/** The stem step on its own: is this the stem for some stem type the form can have? */
export function checkStem(lex: Lexicon, entryId: string, surface: string, endLen: number, stem: string): Check {
  const letters = [...surface.normalize('NFC')]
  if (!stem) return no('Mark the stem from the start of the word.')
  if (!key(surface).startsWith(key(stem))) return no('The stem starts at the beginning of the word.')
  if ([...stem].length > letters.length - endLen) return no('The stem cannot overlap the ending.')
  return STEM_TYPES.some((t) => checkStemType(lex, entryId, surface, stem, t).ok) ? yes : no(`“${stem}-” is not a stem of this verb.`)
}

/** Tenses a finite form or infinitive can have on a given stem. */
export function tensesForStem(type: StemType): string[] {
  return type === 'pres' ? ['pres', 'impf', 'fut'] : type === 'pfAct' ? ['pf', 'plupf', 'futpf'] : []
}

/** What a participle is, from its stem and the marker between stem and ending. */
export function participleName(type: StemType, marker: string | null | undefined, gerund: boolean): string {
  const m = key(marker ?? '')
  if (type === 'pres') {
    if (m.startsWith('nd')) return gerund ? 'gerund' : 'gerundive'
    return 'pres act ptc'
  }
  if (m.startsWith('ur')) return 'fut act ptc'
  return 'pf pass ptc'
}

/** What a stem can build in a finite form or infinitive: its tenses, voices, and whether an imperative fits. */
export function stemLimits(type: StemType): { tenses: string[]; voices: string[]; imperative: boolean } {
  if (type === 'pres') return { tenses: ['pres', 'impf', 'fut'], voices: ['act', 'pass'], imperative: true }
  // The perfect passive is built on the participle stem with sum, so the perfect active stem is active only.
  if (type === 'pfAct') return { tenses: ['pf', 'plupf', 'futpf'], voices: ['act'], imperative: false }
  return { tenses: [], voices: [], imperative: false }
}
