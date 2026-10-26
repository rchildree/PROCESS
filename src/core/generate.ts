// Port of sentences/verify/gen.py: forms the dataset does not emit, with analyses attached.
import type { Analysis, Case, Entry, Gender, Num, Tense, Voice } from './types.ts'

export interface GenForm { s: string; l: string; a: Analysis[] }
type Slot = [Case, Num, Gender][]

const s = (c: Case, n: Num, g: Gender): [Case, Num, Gender] => [c, n, g]

// gen.py E12 order, with vocatives folded into the nominative slots that share the form.
const E12: [string, Slot][] = [
  ['us', [s('nom', 'sg', 'm')]], ['ī', [s('gen', 'sg', 'm')]], ['ō', [s('dat', 'sg', 'm')]], ['um', [s('acc', 'sg', 'm')]], ['ō', [s('abl', 'sg', 'm')]], ['e', [s('voc', 'sg', 'm')]],
  ['ī', [s('nom', 'pl', 'm'), s('voc', 'pl', 'm')]], ['ōrum', [s('gen', 'pl', 'm')]], ['īs', [s('dat', 'pl', 'm')]], ['ōs', [s('acc', 'pl', 'm')]], ['īs', [s('abl', 'pl', 'm')]],
  ['a', [s('nom', 'sg', 'f'), s('voc', 'sg', 'f')]], ['ae', [s('gen', 'sg', 'f')]], ['ae', [s('dat', 'sg', 'f')]], ['am', [s('acc', 'sg', 'f')]], ['ā', [s('abl', 'sg', 'f')]],
  ['ae', [s('nom', 'pl', 'f'), s('voc', 'pl', 'f')]], ['ārum', [s('gen', 'pl', 'f')]], ['īs', [s('dat', 'pl', 'f')]], ['ās', [s('acc', 'pl', 'f')]], ['īs', [s('abl', 'pl', 'f')]],
  ['um', [s('nom', 'sg', 'n'), s('voc', 'sg', 'n')]], ['ī', [s('gen', 'sg', 'n')]], ['ō', [s('dat', 'sg', 'n')]], ['um', [s('acc', 'sg', 'n')]], ['ō', [s('abl', 'sg', 'n')]],
  ['a', [s('nom', 'pl', 'n'), s('voc', 'pl', 'n')]], ['ōrum', [s('gen', 'pl', 'n')]], ['īs', [s('dat', 'pl', 'n')]], ['a', [s('acc', 'pl', 'n')]], ['īs', [s('abl', 'pl', 'n')]],
]

const ALL: Gender[] = ['m', 'f', 'n']
const MF: Gender[] = ['m', 'f']
const each = (c: Case, n: Num, gs: Gender[]) => gs.map((g) => s(c, n, g))

// Present participle (gen.py E3PTC) — third-declension endings.
const E3PTC: [string, Slot][] = [
  ['ntis', each('gen', 'sg', ALL)], ['ntī', [...each('dat', 'sg', ALL), ...each('abl', 'sg', ALL)]],
  ['ntem', each('acc', 'sg', MF)], ['nte', each('abl', 'sg', ALL)],
  ['ntēs', [...each('nom', 'pl', MF), ...each('voc', 'pl', MF), ...each('acc', 'pl', MF)]],
  ['ntium', each('gen', 'pl', ALL)], ['ntibus', [...each('dat', 'pl', ALL), ...each('abl', 'pl', ALL)]],
  ['ntia', [...each('nom', 'pl', ['n']), ...each('acc', 'pl', ['n']), ...each('voc', 'pl', ['n'])]],
]
const NS_SLOT: Slot = [...each('nom', 'sg', ALL), ...each('voc', 'sg', ALL), s('acc', 'sg', 'n')]

const CMP: [string, Slot][] = [
  ['ior', [...each('nom', 'sg', MF), ...each('voc', 'sg', MF)]], ['iōris', each('gen', 'sg', ALL)], ['iōrī', each('dat', 'sg', ALL)],
  ['iōrem', each('acc', 'sg', MF)], ['iōre', each('abl', 'sg', ALL)],
  ['iōrēs', [...each('nom', 'pl', MF), ...each('voc', 'pl', MF), ...each('acc', 'pl', MF)]], ['iōrum', each('gen', 'pl', ALL)],
  ['iōribus', [...each('dat', 'pl', ALL), ...each('abl', 'pl', ALL)]],
  ['ius', [s('nom', 'sg', 'n'), s('acc', 'sg', 'n'), s('voc', 'sg', 'n')]], ['iōra', [s('nom', 'pl', 'n'), s('acc', 'pl', 'n'), s('voc', 'pl', 'n')]],
]

const LLIMUS = new Set(['facilis', 'difficilis', 'similis', 'dissimilis', 'gracilis', 'humilis'])
const SHORT: Record<string, string> = { ā: 'a', ē: 'e', ī: 'i', ō: 'o', ū: 'u' }

export interface SurfaceSource { s: string; l: string; pos: string; a: Analysis[] }

export function generateForms(entries: Map<string, Entry>, rows: SurfaceSource[]): GenForm[] {
  const out: GenForm[] = []
  const add = (surface: string, l: string, a: Analysis[]) => out.push({ s: surface, l, a })
  const ptc12 = (stem: string, l: string, t: Tense, v: Voice) => {
    for (const [end, slot] of E12) add(stem + end, l, slot.map(([c, n, g]) => ({ k: 'ptc', t, v, c, n, g })))
  }
  const adj12 = (stem: string, l: string, deg: 'sup') => {
    for (const [end, slot] of E12) add(stem + end, l, slot.map(([c, n, g]) => ({ k: 'nom', c, n, g, deg })))
  }

  const genM = new Map<string, string[]>()
  for (const r of rows) {
    if (r.pos === 'v') {
      if (r.s.includes(' ')) {
        const head = r.s.split(' ')[0]
        if (head.endsWith('us')) {
          const fin = r.a[0]
          const t: Tense = head.endsWith('ūrus') ? 'fut' : 'pf'
          const v: Voice = t === 'fut' ? 'act' : 'pass'
          if (fin) ptc12(head.slice(0, -2), r.l, t, v)
        }
        continue
      }
      for (const a of r.a) {
        if (a.k !== 'ptc') continue
        const t = a.t ?? 'pf'
        const v = a.v ?? 'pass'
        if (r.s.endsWith('us')) {
          ptc12(r.s.slice(0, -2), r.l, t, v)
          if (r.s.endsWith('ndus')) {
            const g = r.s.slice(0, -2)
            add(g + 'ī', r.l, [{ k: 'ger', c: 'gen', n: 'sg', g: 'n' }])
            add(g + 'ō', r.l, [{ k: 'ger', c: 'dat', n: 'sg', g: 'n' }, { k: 'ger', c: 'abl', n: 'sg', g: 'n' }])
            add(g + 'um', r.l, [{ k: 'ger', c: 'acc', n: 'sg', g: 'n' }])
          }
        } else if (r.s.endsWith('ns')) {
          add(r.s, r.l, NS_SLOT.map(([c, n, g]) => ({ k: 'ptc', t: 'pres', v: 'act', c, n, g })))
          let stem = r.s.slice(0, -2)
          for (let i = stem.length - 1; i >= 0; i--) {
            if ('āēīōūaeiou'.includes(stem[i])) { stem = stem.slice(0, i) + (SHORT[stem[i]] ?? stem[i]) + stem.slice(i + 1); break }
          }
          for (const [end, slot] of E3PTC) add(stem + end, r.l, slot.map(([c, n, g]) => ({ k: 'ptc', t: 'pres', v: 'act', c, n, g })))
        }
      }
    } else if (r.pos === 'adj') {
      if (r.a.some((a) => a.k === 'nom' && a.c === 'gen' && a.n === 'sg' && a.g === 'm')) {
        const list = genM.get(r.l) ?? []
        list.push(r.s)
        genM.set(r.l, list)
      }
    }
  }

  // Comparatives and superlatives.
  for (const [l, forms] of genM) {
    const e = entries.get(l)
    if (!e || e.cls === 'irreg') continue
    let g = [...forms].sort()[0]
    if (l === 'felix-adj') g = 'fēlīcis'
    let stem: string
    if (g.endsWith('ī')) stem = g.slice(0, -1)
    else if (g.endsWith('is')) stem = g.slice(0, -2)
    else continue
    for (const [end, slot] of CMP) add(stem + end, l, slot.map(([c, n, gg]) => ({ k: 'nom', c, n, g: gg, deg: 'cmp' })))
    const nom = l === 'acer-adj' ? 'ācer' : e.lemma
    const sup = nom.endsWith('er') ? nom + 'rimus' : LLIMUS.has(nom) ? stem + 'limus' : stem + 'issimus'
    const b = sup.slice(0, -2)
    adj12(b, l, 'sup')
    add(b + 'ē', l, [])
  }

  // Future active participles from parenthesized fourth principal parts.
  for (const e of entries.values()) {
    if (e.pos !== 'v') continue
    const m = /\(([^)]+)\)/.exec(e.dict)
    if (!m) continue
    const p = m[1].trim()
    if (p.endsWith('ūrus') || p.endsWith('ūrum')) {
      const b = p.slice(0, -2)
      ptc12(b, e.id, 'fut', 'act')
      add(b + 'um esse', e.id, [{ k: 'inf', t: 'fut', v: 'act' }])
    }
  }

  // Tokens of multiword conjunctions and phrases.
  for (const e of entries.values()) {
    if (['conj', 'phrase', 'other'].includes(e.pos) && e.dict.includes(' ')) {
      for (const tok of e.dict.split(/\s+/)) if (/^[\p{L}]+$/u.test(tok)) add(tok, e.id, [])
    }
  }

  // Numerals duo and trēs (the dataset lists them without forms).
  const nf = (c: Case, n: Num, g: Gender): Analysis => ({ k: 'nom', c, n, g })
  if (entries.has('duo-num')) {
    const D: [string, Analysis[]][] = [
      ['duo', [nf('nom', 'pl', 'm'), nf('nom', 'pl', 'n'), nf('acc', 'pl', 'm'), nf('acc', 'pl', 'n'), nf('voc', 'pl', 'm'), nf('voc', 'pl', 'n')]],
      ['duae', [nf('nom', 'pl', 'f'), nf('voc', 'pl', 'f')]], ['duōs', [nf('acc', 'pl', 'm')]], ['duās', [nf('acc', 'pl', 'f')]],
      ['duōrum', [nf('gen', 'pl', 'm'), nf('gen', 'pl', 'n')]], ['duārum', [nf('gen', 'pl', 'f')]],
      ['duōbus', [nf('dat', 'pl', 'm'), nf('dat', 'pl', 'n'), nf('abl', 'pl', 'm'), nf('abl', 'pl', 'n')]],
      ['duābus', [nf('dat', 'pl', 'f'), nf('abl', 'pl', 'f')]],
    ]
    for (const [w, a] of D) add(w, 'duo-num', a)
  }
  if (entries.has('tres-num')) {
    const all = (c: Case) => (['m', 'f', 'n'] as Gender[]).map((g) => nf(c, 'pl', g))
    add('trēs', 'tres-num', [nf('nom', 'pl', 'm'), nf('nom', 'pl', 'f'), nf('acc', 'pl', 'm'), nf('acc', 'pl', 'f'), nf('voc', 'pl', 'm'), nf('voc', 'pl', 'f')])
    add('tria', 'tres-num', [nf('nom', 'pl', 'n'), nf('acc', 'pl', 'n'), nf('voc', 'pl', 'n')])
    add('trium', 'tres-num', all('gen'))
    add('tribus', 'tres-num', [...all('dat'), ...all('abl')])
  }

  // Forms the dataset still does not emit.
  if (entries.has('domus-n')) add('domī', 'domus-n', [{ k: 'nom', c: 'loc', n: 'sg', g: 'f' }])
  const pass3 = (l: string, w: string) => entries.has(l) && add(w, l, [{ k: 'fin', t: 'pres', m: 'ind', v: 'pass', p: '3', n: 'sg' }])
  pass3('eo-v', 'ītur')
  pass3('adeo-v', 'adītur')
  if (entries.has('eo-v')) {
    add('eundī', 'eo-v', [{ k: 'ger', c: 'gen', n: 'sg', g: 'n' }])
    add('eundō', 'eo-v', [{ k: 'ger', c: 'dat', n: 'sg', g: 'n' }, { k: 'ger', c: 'abl', n: 'sg', g: 'n' }])
    add('eundum', 'eo-v', [{ k: 'ger', c: 'acc', n: 'sg', g: 'n' }])
  }
  if (entries.has('adeo-v')) ptc12('adeund', 'adeo-v', 'fut', 'pass')

  return out
}
