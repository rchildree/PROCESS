import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize, type SentenceSet } from '../../src/core/sets.ts'
import { replay, startSession, type Answer, type SessionState } from '../../src/core/session.ts'
import type { NomForm, VerbForm } from '../../src/core/checks.ts'
import { differences, keyFile, keyProblems, keyWords, parseKey, wordsWithKey } from '../../src/core/key.ts'
import { detailsOf, labelOf } from '../../src/ui/summary.ts'

const known = (w: string) => lex().lookup(w).length > 0
const nf = (c: NomForm['c'], n: NomForm['n'], g: NomForm['g']): NomForm => ({ c, n, g })
const fin = (t: VerbForm['t'], v: VerbForm['v'], p: VerbForm['p'], n: VerbForm['n']): VerbForm => ({ k: 'fin', t, m: 'ind', v, p, n })
const noun = (id: string, ending: string, form: NomForm, label: any): Answer[] => [
  { step: 'identify', entryId: id }, { step: 'pos', pos: 'N' }, { step: 'ending', ending }, { step: 'nomForm', form },
  { step: 'nomRole', role: { kind: 'label', label } },
]

const PP_TEXT = 'medicus timidum puerum magnā cum cūrā cūrāvit.'
const PP: Answer[] = [
  ...noun('medicus-n', 'us', nf('nom', 'sg', 'm'), 'S'),
  { step: 'identify', entryId: 'timidus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'um' }, { step: 'nomForm', form: nf('acc', 'sg', 'm') },
  { step: 'nomRole', role: { kind: 'modifies', target: 2 } },
  ...noun('puer-n', 'um', nf('acc', 'sg', 'm'), 'O'),
  { step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ā' }, { step: 'nomForm', form: nf('abl', 'sg', 'f') },
  { step: 'nomRole', role: { kind: 'modifies', target: 5 } },
  { step: 'identify', entryId: 'cum-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
  ...noun('cura-n', 'ā', nf('abl', 'sg', 'f'), 'PP'), { step: 'ppPrep', target: 4 },
  { step: 'identify', entryId: 'curo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'it' }, { step: 'stem', stem: 'cūrāv' }, { step: 'stemType', t: 'pfAct' },
  { step: 'verbForm', form: fin('pf', 'act', '3', 'sg') }, { step: 'verbRole', role: { kind: 'label', label: 'V' } },
]

const PV_TEXT = 'aciēs in agrō īnstrūcta est.'
const PV: Answer[] = [
  ...noun('acies-n', 'ēs', nf('nom', 'sg', 'f'), 'S'),
  { step: 'identify', entryId: 'in-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
  ...noun('ager-n', 'ō', nf('abl', 'sg', 'm'), 'PP'), { step: 'ppPrep', target: 1 },
  { step: 'identify', entryId: 'instruo-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'a' },
  { step: 'stem', stem: 'īnstrūct' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('nom', 'sg', 'f') }, { step: 'nomRole', role: { kind: 'verbPart', target: 4 } },
  { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' },
  { step: 'compoundForm', form: fin('pf', 'pass', '3', 'sg') }, { step: 'compoundRole', role: { kind: 'label', label: 'PV' } },
]

const st = (text: string, log: Answer[]) => {
  const s = replay(tokenize(text, known), log, lex())
  expect(s.log.length).toBe(log.length)
  return s
}

describe('answer keys', () => {
  test('a word line names the entry, form and function, with links by number', () => {
    const words = keyWords(st(PP_TEXT, PP))
    expect(words[1]).toEqual({ n: 2, word: 'timidum', entry: 'timidus-adj', pos: 'ADJ', form: 'acc sg m', fn: '→ 3 puerum', work: { path: 'nominal', ending: 'um' } })
    expect(words[4]).toMatchObject({ word: 'cum', form: '+ abl' })
    expect(words[5]).toMatchObject({ word: 'cūrā', fn: 'PP; with 5 cum' })
    expect(words[6]).toMatchObject({ form: 'pf act ind 3sg', fn: 'V' })
  })

  test('a compound verb carries its form and label on both parts', () => {
    const words = keyWords(st(PV_TEXT, PV))
    expect(words[3]).toMatchObject({ word: 'īnstrūcta', form: 'nom sg f; pf pass ind 3sg', fn: 'PV with 5 est' })
    expect(words[4]).toMatchObject({ word: 'est', fn: 'PV with 4 īnstrūcta' })
  })

  test('only finished words go in; untouched sentences are left out', () => {
    const half = st(PP_TEXT, PP.slice(0, 5))
    expect(keyWords(half).map((w) => w.word)).toEqual(['medicus'])
    const set: SentenceSet = {
      id: 'demo', title: 'Demo',
      sentences: [PP_TEXT, PV_TEXT].map((text) => ({ text, tokens: tokenize(text, known) })),
    }
    const file = keyFile(set, [null, st(PV_TEXT, PV)])
    expect(file).not.toMatch(/^## 1$/m)
    expect(file).toMatch(/^## 2$/m)
  })

  test('a key file reads back to the same lines', () => {
    const set: SentenceSet = {
      id: 'demo', title: 'Demo',
      sentences: [PP_TEXT, PV_TEXT].map((text) => ({ text, tokens: tokenize(text, known) })),
    }
    const a = st(PP_TEXT, PP)
    const b = st(PV_TEXT, PV)
    const parsed = parseKey(keyFile(set, [a, b]))
    expect(parsed.setId).toBe('demo')
    expect(parsed.title).toBe('Demo')
    expect(parsed.sentences.get(1)).toEqual(keyWords(a))
    expect(parsed.sentences.get(2)).toEqual(keyWords(b))
  })
})

const CLAUSE_TEXT = 'dum frātrēs dormiunt, lupus agnum rapuit.'
const CLAUSE: Answer[] = [
  { step: 'identify', entryId: 'dum-conj' }, { step: 'pos', pos: 'CONJ' }, { step: 'conjType', t: '↓' },
  ...noun('frater-n', 'ēs', nf('nom', 'pl', 'm'), 'S'), { step: 'clauseBoundary', ends: false },
  { step: 'identify', entryId: 'dormio-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'nt' }, { step: 'stem', stem: 'dormi' }, { step: 'stemType', t: 'pres' },
  { step: 'verbForm', form: fin('pres', 'act', '3', 'pl') }, { step: 'verbRole', role: { kind: 'label', label: 'V' } }, { step: 'clauseBoundary', ends: true },
  ...noun('lupus-n', 'us', nf('nom', 'sg', 'm'), 'S'),
  ...noun('agnus-n', 'um', nf('acc', 'sg', 'm'), 'O'),
  { step: 'identify', entryId: 'rapio-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'it' }, { step: 'stem', stem: 'rapu' }, { step: 'stemType', t: 'pfAct' },
  { step: 'verbForm', form: fin('pf', 'act', '3', 'sg') }, { step: 'verbRole', role: { kind: 'label', label: 'V' } },
]

/** Every field the sentence view uses, including the teacher's working. */
const drawn = (words: SessionState['words']) => words.map((w) => ({
  entryId: w.entryId, pos: w.pos, nomForm: w.nomForm, verbForm: w.verbForm, prepCase: w.prepCase, role: w.role, ppWith: w.ppWith,
  compound: w.compound && { ...w.compound }, antecedent: w.antecedent, completes: w.completes, conjType: w.conjType, clauseDepth: w.clauseDepth,
  path: w.path, ending: w.ending, personal: w.personal, stem: w.stem, stemType: w.stemType, marker: w.marker,
}))

describe('seeing the key', () => {
  test.each([['prepositional phrase', PP_TEXT, PP], ['compound passive', PV_TEXT, PV], ['dependent clause', CLAUSE_TEXT, CLAUSE]])(
    'a %s reads back to the same parse', (_, text, log) => {
      const s = st(text as string, log as Answer[])
      const fresh = startSession(s.tokens)
      const shown = wordsWithKey(fresh.words, s.tokens, parseKey(keyFile({ id: 'x', title: 'x', sentences: [{ text: text as string, tokens: s.tokens }] }, [s])).sentences.get(1)!)
      expect(drawn(shown)).toEqual(drawn(s.words))
      s.words.forEach((_, i) => {
        expect(detailsOf(s, i, shown)).toEqual(detailsOf(s, i))
        expect(labelOf(s, i, shown)).toEqual(labelOf(s, i))
      })
    })

  test('a subordinating conjunction is written once, and its clause end is kept', () => {
    const words = keyWords(st(CLAUSE_TEXT, CLAUSE))
    expect(words[0].fn).toBe('↓')
    expect(words[2].fn).toBe('V; clause ends')
  })

  test('words the key leaves out keep the student’s answers', () => {
    const s = st(PP_TEXT, PP)
    const key = keyWords(s).filter((k) => k.n === 1)
    const shown = wordsWithKey(s.words, s.tokens, key)
    expect(shown[1]).toBe(s.words[1])
  })

  test('the key supplies the teacher’s split, independently of the student’s working', () => {
    const s = st(PP_TEXT, PP)
    const key = keyWords(s)
    const mine = structuredClone(s.words)
    mine[6].stem = 'cūrā'
    mine[6].marker = 'v'
    const shown = wordsWithKey(mine, s.tokens, key)
    expect(shown[6]).toMatchObject({ path: 'finite', stem: 'cūrāv', marker: null, personal: 'it', stemType: 'pfAct' })
    expect(detailsOf(s, 6, shown)).toEqual(detailsOf(s, 6))
    expect(mine[6].stem).toBe('cūrā')
    expect([...differences({ ...s, words: mine }, key)]).toEqual([6])
  })

  test('old six-column keys still show their parse and do not assess omitted working', () => {
    const s = st(PP_TEXT, PP)
    const old = keyFile({ id: 'x', title: 'x', sentences: [{ text: PP_TEXT, tokens: s.tokens }] }, [s])
      .split('\n').map((line) => /^\d+\s*\|/.test(line) ? line.split('|').slice(0, 6).join('|').trimEnd() : line).join('\n')
    const key = parseKey(old).sentences.get(1)!
    expect(key.every((k) => k.work === undefined)).toBe(true)
    expect(wordsWithKey(startSession(s.tokens).words, s.tokens, key)[6].verbForm).toEqual(s.words[6].verbForm)
    expect(differences(s, key).size).toBe(0)
  })

  test('empty endings and markers survive export and import', () => {
    const s = st(PP_TEXT, PP)
    s.words[6].personal = ''
    s.words[6].marker = ''
    const key = parseKey(keyFile({ id: 'x', title: 'x', sentences: [{ text: PP_TEXT, tokens: s.tokens }] }, [s])).sentences.get(1)!
    expect(key[6].work).toMatchObject({ personal: '', marker: '' })
    expect(wordsWithKey(startSession(s.tokens).words, s.tokens, key)[6]).toMatchObject({ personal: '', marker: '' })
  })

  test('malformed working is reported instead of silently losing the teacher’s details', () => {
    expect(() => parseKey('## 1\n1 | amat | amo-v | V | pres act ind 3sg | V | {broken}')).toThrow('Invalid working details for word 1')
    expect(() => parseKey('## 1\n1 | amat | amo-v | V | pres act ind 3sg | V | {"stemType":"unknown"}')).toThrow('Invalid working details for word 1')
  })

  test('differences name only the words that disagree with the key', () => {
    const s = st(PP_TEXT, PP)
    const key = keyWords(s).map((k) => (k.n === 3 ? { ...k, fn: 'SC' } : k))
    expect([...differences(s, key)]).toEqual([2])
    expect(differences(s, keyWords(s)).size).toBe(0)
  })

  test('a key whose words no longer match the set is reported', () => {
    const s = st(PP_TEXT, PP)
    const set: SentenceSet = { id: 'demo', title: 'Demo', sentences: [{ text: PP_TEXT, tokens: s.tokens }] }
    const key = parseKey(keyFile(set, [s]).replace('| puerum ', '| puellam'))
    expect(keyProblems(set, key)).toEqual(['sentence 1: word 3 is "puerum" in the set but "puellam" in the key'])
  })
})
