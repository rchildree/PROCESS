import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize } from '../../src/core/sets.ts'
import { replay, startSession, submit, type Answer, type SessionState } from '../../src/core/session.ts'
import type { NomForm, VerbForm } from '../../src/core/checks.ts'

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
const verb = (id: string, personal: string, marker: string | null, form: VerbForm): Answer[] => [
  { step: 'identify', entryId: id }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: personal }, { step: 'marker', marker },
  { step: 'verbForm', form },
]

const L10_2 = 'medicus timidum puerum magnā cum cūrā cūrāvit.'
const L10_2_ANSWERS: Answer[] = [
  ...noun('medicus-n', 'us', nf('nom', 'sg', 'm'), 'S'),
  ...adjStart('timidus-adj', 'um', nf('acc', 'sg', 'm')), { step: 'nomRole', role: { kind: 'pendingNoun' } },
  ...noun('puer-n', 'um', nf('acc', 'sg', 'm'), 'O'), { step: 'linkPending', target: 1 },
  ...adjStart('magnus-adj', 'ā', nf('abl', 'sg', 'f')), { step: 'nomRole', role: { kind: 'pendingNoun' } },
  { step: 'identify', entryId: 'cum-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
  ...noun('cura-n', 'ā', nf('abl', 'sg', 'f'), 'PP'), { step: 'linkPending', target: 3 },
  ...verb('curo-v', 'it', null, fin('pf', 'act', '3', 'sg')), { step: 'verbRole', role: { kind: 'label', label: 'V' } },
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
      ...adjStart('is-pron', 'ō', nf('abl', 'sg', 'n'), 'PRO'), { step: 'nomRole', role: { kind: 'pendingNoun' } },
      ...noun('tempus-n', 'e', nf('abl', 'sg', 'n'), 'ADV'), { step: 'linkPending', target: 1 },
      { step: 'identify', entryId: 'a-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
      ...noun('caesar-n', 'e', nf('abl', 'sg', 'm'), 'PP'),
      { step: 'identify', entryId: 'in-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
      ...noun('ager-n', 'ō', nf('abl', 'sg', 'm'), 'PP'),
      ...adjStart('instruo-v', 'a', nf('nom', 'sg', 'f'), 'V'), { step: 'nomRole', role: { kind: 'verbPart' } },
      ...verb('sum-v', 't', null, fin('pres', 'act', '3', 'sg')), { step: 'verbRole', role: { kind: 'aux', target: 7 } },
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
    st = play('', [{ step: 'clauseBoundary', ends: false }, ...verb('dormio-v', 'nt', null, fin('pres', 'act', '3', 'pl')),
      { step: 'verbRole', role: { kind: 'label', label: 'V' } }, { step: 'clauseBoundary', ends: true }], st)
    expect(st.words[0].clauseDepth).toBe(1)
    expect(st.words[2].clauseDepth).toBe(1)
    st = play('', noun('lupus-n', 'us', nf('nom', 'sg', 'm'), 'S'), st)
    expect(st.words[3].clauseDepth).toBe(0)
    expect(st.step).toBe('identify')
  })

  test('pending must resolve', () => {
    let st = play('puer fugit magnus', [
      ...noun('puer-n', '', nf('nom', 'sg', 'm'), 'S'),
      ...verb('fugio-v', 't', null, fin('pres', 'act', '3', 'sg')), { step: 'verbRole', role: { kind: 'label', label: 'V' } },
      ...adjStart('magnus-adj', 'us', nf('nom', 'sg', 'm')), { step: 'nomRole', role: { kind: 'pendingNoun' } },
    ])
    expect(st.step).toBe('resolvePending')
    expect(submit(st, { step: 'resolvePending', role: { kind: 'pendingNoun' } }, lex()).error).toBeTruthy()
    st = play('', [{ step: 'resolvePending', role: { kind: 'modifies', target: 0 } }], st)
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
