import { splitProse, tokenize, type SentenceSet } from '../core/sets.ts'
import type { Lexicon } from '../core/types.ts'

export interface CustomText { id: string; title: string; text: string }
const STORAGE_KEY = 'process:v1:custom-texts'

/** Store source text, so tokens can always be rebuilt with the current vocabulary. */
export function loadCustomTexts(): CustomText[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((v): v is CustomText =>
      v && typeof v.id === 'string' && v.id.startsWith('custom-') &&
      typeof v.title === 'string' && typeof v.text === 'string' && !!v.text.trim()) : []
  } catch { return [] }
}

export function saveCustomTexts(texts: CustomText[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(texts))
    return true
  } catch { return false }
}

export function customSet(source: CustomText, lex: Lexicon): SentenceSet {
  // Blank lines can separate sentences even when final punctuation is omitted.
  const sentences = source.text.normalize('NFC').split(/\n\s*\n/).flatMap(splitProse)
    .map((text) => ({ text, tokens: tokenize(text, (w) => lex.lookup(w).length > 0) }))
    .filter((s) => s.tokens.length > 0)
  return { id: source.id, title: source.title, sentences }
}
