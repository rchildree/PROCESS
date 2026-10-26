// Typed dictionary entries: Normal mode needs at least the first part, Real mode the whole entry.
// Macrons, capitals, commas, periods and spacing never count. Parts in parentheses are optional.
import { ALT_HEADWORDS } from './data/alternates.ts'
import { stripMacrons } from './normalize.ts'
import type { Entry, Lexicon } from './types.ts'

export type LookupMode = 'help' | 'normal' | 'real'

function tokens(s: string): string[] {
  return stripMacrons(s)
    .toLowerCase()
    .replace(/[,.;:]/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .split(/\s+/)
    .map((t) => t.replace(/^-/, ''))
    .filter(Boolean)
}

/** The entry's parts: required ones in order, plus the optional (parenthesized) ones. */
function parts(e: Entry): { required: string[]; optional: Set<string> } {
  const optional = new Set<string>()
  const req = e.dict.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    for (const t of tokens(inner)) optional.add(t)
    return ' '
  })
  return { required: tokens(req), optional }
}

/** Does typed token `t` fit part `p`? The first part may be any one of its slash forms (ā/ab, ē/ex). */
function fits(t: string, p: string, first: boolean): boolean {
  if (t === p) return true
  if (first) {
    if (p.split('/').includes(t)) return true
    const alt = ALT_HEADWORDS[t]
    if (alt && (alt === p || p.split('/').includes(alt))) return true
  }
  return false
}

export type HeadwordResult = { matches: Entry[]; reason?: string }

export function matchHeadword(lex: Lexicon, typed: string, mode: Exclude<LookupMode, 'help'>): HeadwordResult {
  const typedToks = tokens(typed.replace(/[()]/g, ' '))
  if (!typedToks.length) return { matches: [], reason: 'Type the dictionary entry.' }
  const firstOnly: Entry[] = []
  const matches: Entry[] = []
  for (const e of lex.entries.values()) {
    const { required, optional } = parts(e)
    if (!required.length || !fits(typedToks[0], required[0], true)) continue
    firstOnly.push(e)
    const rest = typedToks.slice(1).filter((t) => !optional.has(t) || required.slice(1).includes(t))
    const need = required.slice(1)
    if (mode === 'real' ? rest.length !== need.length : rest.length > need.length) continue
    if (rest.every((t, k) => fits(t, need[k], false))) matches.push(e)
  }
  if (matches.length) return { matches }
  if (firstOnly.length) {
    return { matches: [], reason: mode === 'real' ? 'The first part is right. Type the whole entry and check each part.' : 'The first part is right, but check the rest of what you typed.' }
  }
  return { matches: [], reason: 'No dictionary entry begins that way.' }
}
