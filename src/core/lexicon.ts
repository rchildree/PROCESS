import { generateForms, type SurfaceSource } from './generate.ts'
import { searchKey } from './normalize.ts'
import type { Analysis, Candidate, Entry, Gloss, Lexicon, Pos, RawDataset } from './types.ts'

const INDECL_POS: Pos[] = ['adv', 'conj', 'prep', 'particle', 'other', 'num', 'phrase']

const akey = (a: Analysis) => JSON.stringify(Object.entries(a).sort())

class LexiconImpl implements Lexicon {
  entries: Map<string, Entry>
  private surf = new Map<string, Map<string, Candidate>>()
  private seen = new Map<string, Set<string>>()

  constructor(entries: Entry[]) {
    this.entries = new Map(entries.map((e) => [e.id, e]))
  }

  add(surface: string, entryId: string, analyses: Analysis[]) {
    const s = surface.normalize('NFC')
    const e = this.entries.get(entryId)
    if (!e) return
    let byId = this.surf.get(s)
    if (!byId) this.surf.set(s, (byId = new Map()))
    let cand = byId.get(entryId)
    if (!cand) byId.set(entryId, (cand = { entryId, pos: e.pos, analyses: [] }))
    const seenKey = s + '\u0000' + entryId
    let seen = this.seen.get(seenKey)
    if (!seen) this.seen.set(seenKey, (seen = new Set()))
    for (const a of analyses) {
      const k = akey(a)
      if (!seen.has(k)) { seen.add(k); cand.analyses.push(a) }
    }
  }

  lookup(surface: string): Candidate[] {
    const w = surface.normalize('NFC')
    const variants = new Set([w, w ? w[0].toLowerCase() + w.slice(1) : w])
    const out = new Map<string, Candidate>()
    for (const v of variants) {
      for (const c of this.surf.get(v)?.values() ?? []) {
        const prev = out.get(c.entryId)
        if (!prev) out.set(c.entryId, { ...c, analyses: [...c.analyses] })
        else for (const a of c.analyses) if (!prev.analyses.some((b) => akey(b) === akey(a))) prev.analyses.push(a)
      }
    }
    return [...out.values()]
  }

  search(query: string, limit = 20): Entry[] {
    const q = searchKey(query).trim()
    if (!q) return []
    const ranked: [number, Entry][] = []
    for (const e of this.entries.values()) {
      const lk = searchKey(e.lemma).replace(/^-/, '')
      const dk = searchKey(e.dict)
      const alts = e.dict.includes('/') && !e.dict.includes(' ') ? e.dict.split('/').map(searchKey) : []
      let r = -1
      if (lk === q || alts.includes(q)) r = 0
      else if (lk.startsWith(q)) r = 1
      else if (dk.split(/[\s,/()]+/).some((w) => w.startsWith(q))) r = 2
      else if (dk.includes(q)) r = 3
      if (r >= 0) ranked.push([r, e])
    }
    ranked.sort((a, b) => a[0] - b[0] || a[1].lemma.length - b[1].lemma.length || a[1].chapter - b[1].chapter)
    return ranked.slice(0, limit).map((x) => x[1])
  }
}

export function buildLexicon(raw: RawDataset): Lexicon {
  const lex = new LexiconImpl(raw.entries)
  const rows: SurfaceSource[] = []
  for (const pos of ['n', 'adj', 'v', 'pron'] as const) {
    for (const r of raw.forms[pos]) {
      lex.add(r.s, r.l, r.a)
      rows.push({ s: r.s, l: r.l, pos, a: r.a })
    }
  }
  for (const e of raw.entries) {
    if (!INDECL_POS.includes(e.pos)) continue
    const cands = new Set([e.lemma])
    if (e.dict.includes('/') && !e.dict.includes(' ')) for (const p of e.dict.split('/')) cands.add(p)
    for (const c of cands) {
      const w = c.replace(/^-/, '')
      if (w && !w.includes(' ')) lex.add(w, e.id, [])
    }
  }
  for (const g of generateForms(lex.entries, rows)) lex.add(g.s, g.l, g.a)
  return lex
}

export function withGlosses(base: Lexicon, glosses: Gloss[]): Lexicon {
  if (!glosses.length) return base
  const extra = new Map<string, Entry>()
  for (const g of glosses) {
    const id = `gloss:${g.lemma}`
    extra.set(id, { id, chapter: 0, lemma: g.lemma, dict: g.dict, definition: g.definition, pos: g.pos, pp: [g.lemma], flags: ['gloss'] })
  }
  const entries = new Map([...base.entries, ...extra])
  return {
    entries,
    lookup(surface: string) {
      const found = base.lookup(surface)
      const low = surface ? surface[0].toLowerCase() + surface.slice(1) : surface
      for (const e of extra.values()) {
        if (e.lemma === surface || e.lemma === low) found.push({ entryId: e.id, pos: e.pos, analyses: [] })
      }
      return found
    },
    search(query: string, limit = 20) {
      const q = searchKey(query).trim()
      const glossHits = [...extra.values()].filter((e) => q && searchKey(e.lemma).startsWith(q))
      return [...glossHits, ...base.search(query, limit)].slice(0, limit)
    },
  }
}
