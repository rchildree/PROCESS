import { tokenProblems } from './completable.ts'
import type { Gloss, Lexicon, Pos } from './types.ts'

export interface Token { index: number; surface: string; host?: string; enclitic?: 'que' | 'ne' | 've'; punctAfter?: string; punctBefore?: string }
export interface SetSentence { text: string; tokens: Token[] }
export interface SentenceSet { id: string; title: string; lesson?: number; sentences: SetSentence[]; glosses?: Gloss[] }
export interface SetIndexItem { id: string; title: string; lesson?: number; count: number; file: string }

const PUNCT = `,.;:?!"“”'‘’()[]—–`
const ENCLITICS = ['que', 'ne', 've'] as const

export function tokenize(text: string, isKnown: (w: string) => boolean): Token[] {
  const out: Token[] = []
  for (const raw of text.normalize('NFC').split(/\s+/)) {
    let a = 0
    let b = raw.length
    while (a < b && PUNCT.includes(raw[a])) a++
    while (b > a && PUNCT.includes(raw[b - 1])) b--
    const before = raw.slice(0, a)
    const after = raw.slice(b)
    const word = raw.slice(a, b)
    if (!word) {
      // Stray punctuation: attach to the previous token.
      if (out.length && raw) out[out.length - 1].punctAfter = (out[out.length - 1].punctAfter ?? '') + raw
      continue
    }
    const tok: Token = { index: out.length, surface: word }
    if (before) tok.punctBefore = before
    if (after) tok.punctAfter = after
    if (!isKnown(word)) {
      for (const enc of ENCLITICS) {
        const host = word.slice(0, -enc.length)
        if (word.endsWith(enc) && host && isKnown(host)) {
          tok.host = host
          tok.enclitic = enc
          break
        }
      }
    }
    out.push(tok)
  }
  return out
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const POS_SET: Pos[] = ['n', 'adj', 'v', 'pron', 'adv', 'conj', 'prep', 'particle', 'num', 'phrase', 'other']

function parseGlosses(lines: string[]): { glosses: Gloss[]; rest: string[] } {
  const glosses: Gloss[] = []
  const rest: string[] = []
  let inBlock = false
  for (const line of lines) {
    if (/^\s*glosses:\s*$/i.test(line)) { inBlock = true; continue }
    if (inBlock) {
      if (!line.trim()) { inBlock = false; continue }
      const parts = line.split('|').map((p) => p.trim())
      if (parts.length === 4 && POS_SET.includes(parts[3] as Pos)) {
        glosses.push({ lemma: parts[0], dict: parts[1], definition: parts[2], pos: parts[3] as Pos })
        continue
      }
      inBlock = false
    }
    rest.push(line)
  }
  return { glosses, rest }
}

/** Split running prose into sentences after . ? ! ; (closing quotes stay with their sentence). */
export function splitProse(text: string): string[] {
  const out: string[] = []
  const re = /[^.?!;]*[.?!;]+["”’']*|[^.?!;]+$/g
  for (const m of text.matchAll(re)) {
    const s = m[0].trim()
    if (s) out.push(s)
  }
  return out
}

function sentencesFromSection(lines: string[]): string[] {
  const bold: string[] = []
  for (const line of lines) {
    const m = /^\s*\d+\.\s+\*\*(.+?)\*\*/.exec(line)
    if (m) bold.push(m[1].trim())
  }
  if (bold.length) return bold
  // Prose: take paragraph text under "### Latin" (or the whole section), stopping at the next heading.
  const start = lines.findIndex((l) => /^###\s+Latin/i.test(l))
  const body: string[] = []
  for (const l of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(l) || /^---\s*$/.test(l)) { if (body.some((b) => b.trim())) break; continue }
    if (l.trim().startsWith('*') && !body.length) continue
    body.push(l)
  }
  return splitProse(body.join(' '))
}

function makeSet(id: string, title: string, lesson: number | undefined, texts: string[], glosses: Gloss[], isKnown: (w: string) => boolean): SentenceSet {
  const glossKnown = (w: string) => isKnown(w) || glosses.some((g) => g.lemma === w || g.lemma === w[0]?.toLowerCase() + w.slice(1))
  const set: SentenceSet = { id, title, sentences: texts.map((text) => ({ text, tokens: tokenize(text, glossKnown) })) }
  if (lesson !== undefined) set.lesson = lesson
  if (glosses.length) set.glosses = glosses
  return set
}

export function parseSetFile(filename: string, text: string, isKnown: (w: string) => boolean): SentenceSet[] {
  const base = slug(filename)
  const { glosses, rest } = parseGlosses(text.normalize('NFC').split(/\r?\n/))
  const lessonLine = rest.map((l) => /^\s*lesson:\s*(\d+)\s*$/i.exec(l)).find(Boolean)
  const explicitLesson = lessonLine ? Number(lessonLine[1]) : undefined
  const lines = rest.filter((l) => !/^\s*lesson:\s*\d+\s*$/i.test(l))

  if (!filename.toLowerCase().endsWith('.md')) {
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean)
    const [title, ...sentences] = nonEmpty
    return [makeSet(base, title ?? base, explicitLesson, sentences, glosses, isKnown)]
  }

  const title = (lines.find((l) => /^#\s/.test(l)) ?? `# ${base}`).replace(/^#\s+/, '').trim()
  const sections: { lesson: number; lines: string[] }[] = []
  for (const l of lines) {
    const m = /^##\s+Lesson\s+(\d+)\s*$/i.exec(l)
    if (m) sections.push({ lesson: Number(m[1]), lines: [] })
    else if (sections.length) sections[sections.length - 1].lines.push(l)
  }
  if (sections.length > 1) {
    return sections.map((s) => makeSet(`${base}-lesson-${s.lesson}`, `Lesson ${s.lesson}`, s.lesson, sentencesFromSection(s.lines), glosses, isKnown))
  }
  const lesson = explicitLesson ?? sections[0]?.lesson
  return [makeSet(base, title, lesson, sentencesFromSection(sections[0]?.lines ?? lines), glosses, isKnown)]
}

export function validateSet(set: SentenceSet, lex: Lexicon): string[] {
  const glossed = new Set((set.glosses ?? []).map((g) => g.lemma))
  const problems: string[] = []
  set.sentences.forEach((s, i) => {
    if (!s.tokens.length) problems.push(`sentence ${i + 1}: empty`)
    for (const t of s.tokens) {
      const w = t.host ?? t.surface
      const low = w[0].toLowerCase() + w.slice(1)
      if (glossed.has(w) || glossed.has(low)) continue
      const p = tokenProblems(lex, t)
      if (p) problems.push(`sentence ${i + 1}: ${p}`)
    }
  })
  if (!set.sentences.length) problems.push('no sentences found')
  return problems
}
