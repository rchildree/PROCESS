// Participles as their own part of speech, their uses (attributive, circumstantial, ablative absolute),
// and the ablative absolute parsed as a clause whose ablative noun is S and whose participle is its verb.
import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize, type SentenceSet } from '../../src/core/sets.ts'
import { replay, startSession, submit, type Answer, type Role, type SessionState } from '../../src/core/session.ts'
import type { NomForm } from '../../src/core/checks.ts'
import { differences, keyFile, keyWords, parseKey, wordsWithKey } from '../../src/core/key.ts'
import { detailsOf, labelOf } from '../../src/ui/summary.ts'

const known = (w: string) => lex().lookup(w).length > 0
const toks = (s: string) => tokenize(s, known)
const nf = (c: NomForm['c'], n: NomForm['n'], g: NomForm['g']): NomForm => ({ c, n, g })

function play(text: string, answers: Answer[]): SessionState {
  let st = startSession(toks(text))
  for (const a of answers) {
    const next = submit(st, a, lex())
    if (next.error) throw new Error(`word ${st.current} step ${st.step}: ${JSON.stringify(a)} rejected: ${next.error}`)
    st = next
  }
  return st
}
/** The error the answer after `answers` gets. */
function refused(text: string, answers: Answer[], last: Answer): string | null {
  return submit(play(text, answers), last, lex()).error
}

const rege = (role: Role): Answer[] => [
  { step: 'identify', entryId: 'rex-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'e' }, { step: 'nomForm', form: nf('abl', 'sg', 'm') },
  { step: 'nomRole', role },
]
const victoStart: Answer[] = [
  { step: 'identify', entryId: 'vinco-v' }, { step: 'pos', pos: 'PTC' }, { step: 'ending', ending: 'ō' },
  { step: 'stem', stem: 'vict' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('abl', 'sg', 'm') },
]
const bellovaci: Answer[] = [
  { step: 'identify', entryId: 'bellovaci-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ī' }, { step: 'nomForm', form: nf('nom', 'pl', 'm') },
  { step: 'nomRole', role: { kind: 'label', label: 'S' } },
]
const fugerunt: Answer[] = [
  { step: 'identify', entryId: 'fugio-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'ērunt' }, { step: 'stem', stem: 'fūg' },
  { step: 'stemType', t: 'pfAct' }, { step: 'verbForm', form: { k: 'fin', t: 'pf', v: 'act', m: 'ind', p: '3', n: 'pl' } },
  { step: 'verbRole', role: { kind: 'label', label: 'V' } },
]

const SUBJECT_FIRST = 'rēge victō, Bellovacī fūgērunt.'
/** rēge as S, naming word `ptc` (from 0) as its participle. */
const regeSubject = (ptc: number): Answer[] => [...rege({ kind: 'label', label: 'S' }), { step: 'subjectOf', target: ptc }]

const SUBJECT_FIRST_LOG: Answer[] = [
  ...regeSubject(1),
  ...victoStart, { step: 'nomRole', role: { kind: 'ablAbs', target: 0, idea: 'causal' } }, { step: 'clauseBoundary', ends: true },
  ...bellovaci, ...fugerunt,
]

describe('part of speech', () => {
  test('a participle is PTC and goes on to its ending', () => {
    const st = play('victō', [{ step: 'identify', entryId: 'vinco-v' }, { step: 'pos', pos: 'PTC' }])
    expect(st.step).toBe('ending')
    expect(st.words[0].path).toBe('nominal')
  })
  test('calling a participle a verb or an adjective is refused', () => {
    const start: Answer[] = [{ step: 'identify', entryId: 'vinco-v' }]
    expect(refused('victō', start, { step: 'pos', pos: 'V' })).toBeTruthy()
    expect(refused('victō', start, { step: 'pos', pos: 'ADJ' })).toBeTruthy()
  })
  test('saved work that called a participle V still loads', () => {
    const legacy = SUBJECT_FIRST_LOG.map((a) => (a.step === 'pos' && a.pos === 'PTC' ? { ...a, pos: 'V' as const } : a))
    const st = replay(toks(SUBJECT_FIRST), legacy, lex())
    expect(st.step).toBe('done')
    expect(st.words[1].pos).toBe('PTC')
  })
})

describe('participle uses', () => {
  test('circumstantial: agrees with a noun and adds a clause idea', () => {
    const st = play('Bellovacī victī fūgērunt.', [
      ...bellovaci,
      { step: 'identify', entryId: 'vinco-v' }, { step: 'pos', pos: 'PTC' }, { step: 'ending', ending: 'ī' },
      { step: 'stem', stem: 'vict' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('nom', 'pl', 'm') },
      { step: 'nomRole', role: { kind: 'circumstantial', target: 0, idea: 'causal' } },
      ...fugerunt,
    ])
    expect(st.step).toBe('done')
    expect(keyWords(st)[1].fn).toBe('→ 1 Bellovacī; causal')
  })
  test('a participle needs a use, not a bare label', () => {
    const victi: Answer[] = [
      { step: 'identify', entryId: 'vinco-v' }, { step: 'pos', pos: 'PTC' }, { step: 'ending', ending: 'ī' },
      { step: 'stem', stem: 'vict' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('nom', 'pl', 'm') },
    ]
    expect(refused('Bellovacī victī', [...bellovaci, ...victi],
      { step: 'nomRole', role: { kind: 'label', label: 'S' } })).toMatch(/participle/)
  })
  test('only a participle can be circumstantial', () => {
    const magnus: Answer[] = [{ step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ī' }, { step: 'nomForm', form: nf('nom', 'pl', 'm') }]
    expect(refused('Bellovacī magnī', [...bellovaci, ...magnus], { step: 'nomRole', role: { kind: 'circumstantial', target: 0, idea: 'causal' } })).toMatch(/participle/)
  })
})

describe('ablative absolute as a clause', () => {
  test('subject first: the ablative S opens the clause and the participle completes it', () => {
    const st = play(SUBJECT_FIRST, SUBJECT_FIRST_LOG)
    expect(st.step).toBe('done')
    expect(st.words.map((w) => w.clauseDepth)).toEqual([1, 1, 0, 0])
    const k = keyWords(st)
    expect(k[0].fn).toBe('S; abl. abs. → 2 victō')
    expect(k[1].fn).toBe('V; abl. abs. → 1 rēge; causal; clause ends')
  })
  test('the participle is labeled V, and both halves end their details with abl. abs.', () => {
    const st = play(SUBJECT_FIRST, SUBJECT_FIRST_LOG)
    expect(labelOf(st, 0)).toBe('S')
    expect(labelOf(st, 1)).toBe('V')
    expect(detailsOf(st, 0).at(-1)).toEqual(['abl. abs.'])
    expect(detailsOf(st, 1).at(-1)).toEqual(['abl. abs.'])
  })
  test('participle first: the participle opens the clause and its subject completes it', () => {
    const st = play('victō rēge, Bellovacī fūgērunt.', [
      ...victoStart, { step: 'nomRole', role: { kind: 'ablAbs', target: 1, idea: 'temporal' } },
      // The participle already named rēge as its subject, so there is no "subject of which participle?" question.
      ...rege({ kind: 'label', label: 'S' }), { step: 'clauseBoundary', ends: true },
      ...bellovaci, ...fugerunt,
    ])
    expect(st.step).toBe('done')
    expect(st.words.map((w) => w.clauseDepth)).toEqual([1, 1, 0, 0])
  })
  test('an ablative S is asked which participle it is the subject of', () => {
    expect(play('rēge victō', rege({ kind: 'label', label: 'S' })).step).toBe('subjectOf')
  })
  test('a nominative S is not asked', () => {
    expect(play('Bellovacī fūgērunt.', bellovaci).step).toBe('identify')
  })
  test('an ablative S must name a participle, not its own clause verb', () => {
    expect(refused('rēge victō', rege({ kind: 'label', label: 'S' }), { step: 'subjectOf', target: null })).toMatch(/ablative absolute/)
  })
  test('the named word must be able to be an ablative participle', () => {
    expect(refused('rēge fūgērunt.', rege({ kind: 'label', label: 'S' }), { step: 'subjectOf', target: 1 })).toMatch(/participle/)
  })
  test('the participle the subject named must be the one that answers', () => {
    expect(refused('rēge victō captō', [...regeSubject(2), ...victoStart],
      { step: 'nomRole', role: { kind: 'ablAbs', target: 0, idea: 'causal' } })).toMatch(/named another word/)
  })
  test('the named participle must be parsed as the ablative absolute', () => {
    expect(refused(SUBJECT_FIRST, [...regeSubject(1), ...victoStart.slice(0, 1)], { step: 'pos', pos: 'V' })).toMatch(/participle/)
    expect(refused(SUBJECT_FIRST, [...regeSubject(1), ...victoStart],
      { step: 'nomRole', role: { kind: 'modifies', target: 0 } })).toMatch(/ablative absolute/)
  })
  test('the clause cannot end before its participle', () => {
    expect(refused('rēge Bellovacī victō', [...regeSubject(2), ...bellovaci], { step: 'clauseBoundary', ends: true })).toMatch(/no participle/)
  })
  test('no finite verb inside an ablative absolute', () => {
    expect(refused('rēge fūgērunt victō', [...regeSubject(2), ...fugerunt.slice(0, 6)], fugerunt[6])).toMatch(/no finite verb/)
  })
  test('the participle must point at the open subject', () => {
    expect(refused(SUBJECT_FIRST, [...regeSubject(1), ...victoStart],
      { step: 'nomRole', role: { kind: 'ablAbs', target: 2, idea: 'causal' } })).toBeTruthy()
  })
})

describe('keys', () => {
  const set: SentenceSet = { id: 'abs', title: 'Abs', sentences: [{ text: SUBJECT_FIRST, tokens: toks(SUBJECT_FIRST) }] }
  test('ablative absolute roles round-trip through a key file', () => {
    const st = replay(set.sentences[0].tokens, SUBJECT_FIRST_LOG, lex())
    const key = parseKey(keyFile(set, [st]))
    const words = key.sentences.get(1)!
    expect(words[1].pos).toBe('PTC')
    expect(differences(st, words).size).toBe(0)
    const shown = wordsWithKey(st.words, set.sentences[0].tokens, words)
    expect(shown[0].role).toEqual({ kind: 'label', label: 'S', abs: true })
    expect(shown[0].subjectOf).toBe(1)
    expect(shown[1].role).toEqual({ kind: 'ablAbs', target: 0, idea: 'causal' })
    expect(shown.map((w) => w.clauseDepth)).toEqual([1, 1, 0, 0])
  })
  test('older keys that called a participle V read as PTC', () => {
    const old = '# Key: x\nset: x\n## 1\nx\n\n1 | victō | vinco-v | V | abl sg m | → 2 rēge | {"path":"nominal","ending":"ō","stem":"vict","stemType":"pfPass","marker":null}\n'
    expect(parseKey(old).sentences.get(1)![0].pos).toBe('PTC')
  })
})
