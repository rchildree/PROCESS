// Build-time guarantee: every word in a set has at least one reading a student can get through.
import { analysesFor, checkInfinitiveEnding, checkNominalEnding, checkVerbSegments } from './endings.ts'
import { stripMacrons } from './normalize.ts'
import type { Token } from './sets.ts'
import type { Lexicon } from './types.ts'

const suffixes = (w: string) => Array.from({ length: [...w].length }, (_, k) => [...w].slice(k).join('')).concat([''])

function entryWorks(lex: Lexicon, entryId: string, surface: string): boolean {
  const an = analysesFor(lex, entryId, surface)
  if (!an.length) return true // indeclinable or formless: no ending/form steps
  const ends = suffixes(surface)
  for (const a of an) {
    if (a.c && a.n && a.g) {
      if (ends.some((e) => checkNominalEnding(lex, entryId, surface, e).ok)) return true
    } else if (a.k === 'inf') {
      if (ends.some((e) => checkInfinitiveEnding(lex, entryId, surface, e).ok)) return true
    } else if (a.k === 'fin' || a.k === 'imp') {
      for (const p of ends) {
        const rest = [...surface].slice(0, [...surface].length - [...p].length).join('')
        if (checkVerbSegments(lex, entryId, surface, p, null).ok) return true
        if (suffixes(rest).some((m) => m && checkVerbSegments(lex, entryId, surface, p, m).ok)) return true
      }
    } else if (a.k === 'ptc' || a.k === 'ger') {
      continue // declined participles carry c/n/g and are handled above
    }
  }
  return false
}

/** null if the token can be completed; otherwise a short description of the problem. */
export function tokenProblems(lex: Lexicon, t: Token): string | null {
  const w = t.host ?? t.surface
  const cands = lex.lookup(w)
  if (!cands.length) return `"${w}" not found`
  if (cands.some((c) => entryWorks(lex, c.entryId, w))) return null
  return `"${stripMacrons(w)}" has no reading a student can complete`
}
