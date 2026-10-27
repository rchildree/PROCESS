import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize } from '../../src/core/sets.ts'
import { replay, startSession, submit, type Answer, type SessionState } from '../../src/core/session.ts'
import { withGlosses } from '../../src/core/lexicon.ts'
import type { NomForm, VerbForm } from '../../src/core/checks.ts'
import type { StemType } from '../../src/core/stems.ts'

const known = (w: string) => lex().lookup(w).length > 0
const toks = (s: string) => tokenize(s, known)

function play(text: string, answers: Answer[], from?: SessionState): SessionState {
  let st = from ?? startSession(toks(text))
  for (const a of answers) {
    const next = submit(st, a, lex())
    if (next.error) throw new Error(`word ${st.current} step ${st.step}: ${JSON.stringify(a)} rejected: ${next.error}`)
    st = next
  }
  return st
}

const nf = (c: NomForm['c'], n: NomForm['n'], g: NomForm['g']): NomForm => ({ c, n, g })
const fin = (t: VerbForm['t'], v: VerbForm['v'], p: VerbForm['p'], n: VerbForm['n'], m: VerbForm['m'] = 'ind'): VerbForm => ({ k: 'fin', t, m, v, p, n })
const noun = (id: string, ending: string, form: NomForm, label: any): Answer[] => [
  { step: 'identify', entryId: id }, { step: 'pos', pos: 'N' }, { step: 'ending', ending }, { step: 'nomForm', form },
  { step: 'nomRole', role: { kind: 'label', label } },
]
const adjStart = (id: string, ending: string, form: NomForm, pos: any = 'ADJ'): Answer[] => [
  { step: 'identify', entryId: id }, { step: 'pos', pos }, { step: 'ending', ending }, { step: 'nomForm', form },
]
const verb = (id: string, personal: string, stem: string, t: StemType, form: VerbForm): Answer[] => [
  { step: 'identify', entryId: id }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: personal }, { step: 'stem', stem }, { step: 'stemType', t },
  { step: 'verbForm', form },
]

const L10_2 = 'medicus timidum puerum magnā cum cūrā cūrāvit.'
const L10_2_ANSWERS: Answer[] = [
  ...noun('medicus-n', 'us', nf('nom', 'sg', 'm'), 'S'),
  ...adjStart('timidus-adj', 'um', nf('acc', 'sg', 'm')), { step: 'nomRole', role: { kind: 'modifies', target: 2 } },
  ...noun('puer-n', 'um', nf('acc', 'sg', 'm'), 'O'),
  ...adjStart('magnus-adj', 'ā', nf('abl', 'sg', 'f')), { step: 'nomRole', role: { kind: 'modifies', target: 5 } },
  { step: 'identify', entryId: 'cum-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
  ...noun('cura-n', 'ā', nf('abl', 'sg', 'f'), 'PP'),
  ...verb('curo-v', 'it', 'cūrāv', 'pfAct', fin('pf', 'act', '3', 'sg')), { step: 'verbRole', role: { kind: 'label', label: 'V' } },
]

describe('full sentences', () => {
  test('L10 #2 with pending adjectives and a prepositional phrase', () => {
    const st = play(L10_2, L10_2_ANSWERS)
    expect(st.step).toBe('done')
    expect(st.words[1].role).toEqual({ kind: 'modifies', target: 2 })
    expect(st.words[3].role).toEqual({ kind: 'modifies', target: 5 })
    expect(st.openPP).toBeNull()
  })

  test('L10 #8 unites a feminine perfect passive', () => {
    const st = play('aciēs eō tempore ā Caesare in agrō īnstrūcta est.', [
      ...noun('acies-n', 'ēs', nf('nom', 'sg', 'f'), 'S'),
      ...adjStart('is-pron', 'ō', nf('abl', 'sg', 'n'), 'PRO'), { step: 'nomRole', role: { kind: 'modifies', target: 2 } },
      ...noun('tempus-n', 'e', nf('abl', 'sg', 'n'), 'ADV'),
      { step: 'identify', entryId: 'a-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
      ...noun('caesar-n', 'e', nf('abl', 'sg', 'm'), 'PP'),
      { step: 'identify', entryId: 'in-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
      ...noun('ager-n', 'ō', nf('abl', 'sg', 'm'), 'PP'),
      { step: 'identify', entryId: 'instruo-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'a' },
      { step: 'stem', stem: 'īnstrūct' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('nom', 'sg', 'f') }, { step: 'nomRole', role: { kind: 'verbPart', target: 8 } },
      { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' },
      { step: 'compoundForm', form: fin('pf', 'pass', '3', 'sg') },
      { step: 'compoundRole', role: { kind: 'label', label: 'PV' } },
    ])
    expect(st.step).toBe('done')
    expect(st.words[7].compound).toMatchObject({ ptc: 7, sum: 8, label: 'PV' })
  })
})

describe('checks inside the flow', () => {
  test('ambiguous form accepted then agreement uses chosen reading', () => {
    const start = play('puellae magnae', [
      ...noun('puella-n', 'ae', nf('dat', 'sg', 'f'), 'O'),
      ...adjStart('magnus-adj', 'ae', nf('nom', 'pl', 'f')),
    ])
    expect(submit(start, { step: 'nomRole', role: { kind: 'modifies', target: 0 } }, lex()).error).toMatch(/agree/)
    const dat = play('', [{ step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ae' }, { step: 'nomForm', form: nf('dat', 'sg', 'f') }, { step: 'nomRole', role: { kind: 'modifies', target: 0 } }],
      play('puellae magnae', noun('puella-n', 'ae', nf('dat', 'sg', 'f'), 'O')))
    expect(dat.step).toBe('done')
  })

  test('clause boundary', () => {
    let st = play('dum frātrēs dormiunt, lupus agnum rapuit.', [
      { step: 'identify', entryId: 'dum-conj' }, { step: 'pos', pos: 'CONJ' }, { step: 'conjType', t: '↓' },
      ...noun('frater-n', 'ēs', nf('nom', 'pl', 'm'), 'S'),
    ])
    expect(st.step).toBe('clauseBoundary')
    expect(submit(st, { step: 'clauseBoundary', ends: true }, lex()).error).toMatch(/verb/)
    st = play('', [{ step: 'clauseBoundary', ends: false }, ...verb('dormio-v', 'nt', 'dormi', 'pres', fin('pres', 'act', '3', 'pl')),
      { step: 'verbRole', role: { kind: 'label', label: 'V' } }, { step: 'clauseBoundary', ends: true }], st)
    expect(st.words[0].clauseDepth).toBe(1)
    expect(st.words[2].clauseDepth).toBe(1)
    st = play('', noun('lupus-n', 'us', nf('nom', 'sg', 'm'), 'S'), st)
    expect(st.words[3].clauseDepth).toBe(0)
    expect(st.step).toBe('identify')
  })

  test('forward link is checked when the noun finishes', () => {
    const st = play('magnae puellae', [
      ...adjStart('magnus-adj', 'ae', nf('nom', 'pl', 'f')), { step: 'nomRole', role: { kind: 'modifies', target: 1 } },
      { step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ae' }, { step: 'nomForm', form: nf('dat', 'sg', 'f') },
    ])
    const err = submit(st, { step: 'nomRole', role: { kind: 'label', label: 'O' } }, lex()).error
    expect(err).toMatch(/magnae/)
    expect(err).toMatch(/case/)
  })

  test('forward link to a word that cannot agree is refused at once', () => {
    const st = play('magnus puellās', adjStart('magnus-adj', 'us', nf('nom', 'sg', 'm')))
    expect(submit(st, { step: 'nomRole', role: { kind: 'modifies', target: 1 } }, lex()).error).toMatch(/cannot agree/)
  })

  test('word linked as a noun must be N, ADJ or PRO', () => {
    const st = play('magnus puer est', [
      ...adjStart('magnus-adj', 'us', nf('nom', 'sg', 'm')), { step: 'nomRole', role: { kind: 'modifies', target: 1 } },
      { step: 'identify', entryId: 'puer-n' },
    ])
    expect(submit(st, { step: 'pos', pos: 'V' }, lex()).error).toMatch(/magnus/)
  })

  test('nothing is left waiting at the end of the sentence', () => {
    const st = play('puer fugit magnus', [
      ...noun('puer-n', '', nf('nom', 'sg', 'm'), 'S'),
      ...verb('fugio-v', 't', 'fug', 'pres', fin('pres', 'act', '3', 'sg')), { step: 'verbRole', role: { kind: 'label', label: 'V' } },
      ...adjStart('magnus-adj', 'us', nf('nom', 'sg', 'm')), { step: 'nomRole', role: { kind: 'modifies', target: 0 } },
    ])
    expect(st.step).toBe('done')
  })

  test('wrong answer does not advance', () => {
    const st = play(L10_2, [{ step: 'identify', entryId: 'medicus-n' }])
    const bad = submit(st, { step: 'pos', pos: 'V' }, lex())
    expect(bad.step).toBe('pos')
    expect(bad.error).toBeTruthy()
    expect(bad.log).toEqual(st.log)
  })

  test('answer for another step is rejected', () => {
    const st = startSession(toks(L10_2))
    expect(submit(st, { step: 'pos', pos: 'N' }, lex()).error).toBeTruthy()
  })

  test('enclitic gets its own steps after the host', () => {
    const st = play('puerque', [
      ...noun('puer-n', '', nf('nom', 'sg', 'm'), 'S'),
    ])
    expect(st.step).toBe('encliticPos')
    expect(submit(st, { step: 'encliticPos', pos: 'ADV' }, lex()).error).toBeTruthy()
    const done = play('', [{ step: 'encliticPos', pos: 'CONJ' }, { step: 'encliticConj', t: '+' }], st)
    expect(done.step).toBe('done')
  })
})

test('replay of a finished log ends at done', () => {
  const st = play(L10_2, L10_2_ANSWERS)
  const again = replay(toks(L10_2), st.log, lex())
  expect(again.step).toBe('done')
  expect(again.log).toHaveLength(L10_2_ANSWERS.length)
})

test('a correct answer after a rejected one is logged and clears the error', () => {
  const st = play(L10_2, [{ step: 'identify', entryId: 'medicus-n' }])
  const bad = submit(st, { step: 'pos', pos: 'V' }, lex())
  const good = submit(bad, { step: 'pos', pos: 'N' }, lex())
  expect(good.error).toBeNull()
  expect(good.step).toBe('ending')
  expect(good.log).toHaveLength(2)
})

describe('two-word verbs', () => {
  const ptc: Answer[] = [
    { step: 'identify', entryId: 'appello-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'us' },
    { step: 'stem', stem: 'appellāt' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('nom', 'sg', 'm') },
  ]
  const carbo = noun('carbo-n', '', nf('nom', 'sg', 'm'), 'S')

  test('sum first: est appellātus', () => {
    let st = play('Carbō est appellātus.', [...carbo, { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' }])
    expect(st.step).toBe('sumUse')
    st = play('', [{ step: 'sumUse', target: 2 }], st)
    expect(st.current).toBe(2)
    expect(st.words[1]).toMatchObject({ done: true, role: { kind: 'aux', target: 2 } })
    expect(st.words[1].personal).toBeUndefined()
    st = play('', ptc, st)
    expect(st.step).toBe('compoundForm')
    st = play('', [{ step: 'compoundForm', form: fin('pf', 'pass', '3', 'sg') }, { step: 'compoundRole', role: { kind: 'label', label: 'PV' } }], st)
    expect(st.step).toBe('done')
    expect(st.words[2].compound).toMatchObject({ ptc: 2, sum: 1, label: 'PV' })
  })

  test('sumUse null takes the normal verb path', () => {
    const st = play('Carbō est', [...carbo, { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' }, { step: 'sumUse', target: null }])
    expect(st.step).toBe('personal')
  })

  test('sum linked to a word that is not a participle is refused', () => {
    const st = play('est puer', [{ step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' }])
    expect(submit(st, { step: 'sumUse', target: 1 }, lex()).error).toMatch(/one verb form/)
  })

  test('participle link to a word that is not sum is refused', () => {
    const st = play('appellātus puer', ptc)
    expect(submit(st, { step: 'nomRole', role: { kind: 'verbPart', target: 1 } }, lex()).error).toMatch(/one verb form/)
  })

  test('a word linked as sum must be a verb', () => {
    const st = play('appellātus est', [...ptc, { step: 'nomRole', role: { kind: 'verbPart', target: 1 } }, { step: 'identify', entryId: 'sum-v' }])
    expect(submit(st, { step: 'pos', pos: 'N' }, lex()).error).toBeTruthy()
  })

  test('sum first in a ↓ clause marks the clause finite', () => {
    const st = play('dum est appellātus', [
      { step: 'identify', entryId: 'dum-conj' }, { step: 'pos', pos: 'CONJ' }, { step: 'conjType', t: '↓' },
      { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' }, { step: 'sumUse', target: 2 },
    ])
    expect(st.step).toBe('clauseBoundary')
    expect(submit(st, { step: 'clauseBoundary', ends: true }, lex()).error).toBeNull()
  })
})

describe('review fixes', () => {
  test('an old save with "its noun comes later" stops replaying there instead of crashing', () => {
    const old = [...adjStart('magnus-adj', 'ae', nf('nom', 'pl', 'f')), { step: 'nomRole', role: { kind: 'pendingNoun' } } as unknown as Answer]
    const st = replay(toks('magnae puellae'), old, lex())
    expect(st.step).toBe('nomRole')
    expect(st.current).toBe(0)
  })

  test('an adjective can link forward to a glossed noun', () => {
    const g = withGlosses(lex(), [{ lemma: 'Xerxēs', dict: 'Xerxēs, -is m.', definition: 'Xerxes', pos: 'n' }])
    let st = startSession(tokenize('magnus Xerxēs', (w) => g.lookup(w).length > 0))
    for (const a of adjStart('magnus-adj', 'us', nf('nom', 'sg', 'm'))) st = submit(st, a, g)
    expect(submit(st, { step: 'nomRole', role: { kind: 'modifies', target: 1 } }, g).error).toBeNull()
  })

  test('two participles cannot share one form of sum', () => {
    const ptc: Answer[] = [
      { step: 'identify', entryId: 'appello-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'us' },
      { step: 'stem', stem: 'appellāt' }, { step: 'stemType', t: 'pfPass' }, { step: 'nomForm', form: nf('nom', 'sg', 'm') },
    ]
    const st = play('appellātus et appellātus est', [
      ...ptc, { step: 'nomRole', role: { kind: 'verbPart', target: 3 } },
      { step: 'identify', entryId: 'et-conj' }, { step: 'pos', pos: 'CONJ' }, { step: 'conjType', t: '+' },
      ...ptc,
    ])
    expect(submit(st, { step: 'nomRole', role: { kind: 'verbPart', target: 3 } }, lex()).error).toMatch(/already/)
  })
})
