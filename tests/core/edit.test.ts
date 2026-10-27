import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize } from '../../src/core/sets.ts'
import { cancelEdit, startEdit, startSession, submit, tagged, type Answer, type SessionState } from '../../src/core/session.ts'
import { checkStem, checkStemType } from '../../src/core/stems.ts'

const toks = (s: string) => tokenize(s, (w) => lex().lookup(w).length > 0)

function play(text: string, answers: Answer[], from?: SessionState): SessionState {
  let st = from ?? startSession(toks(text))
  for (const a of answers) {
    const next = submit(st, a, lex())
    if (next.error) throw new Error(`word ${st.current} step ${st.step}: ${JSON.stringify(a)} rejected: ${next.error}`)
    st = next
  }
  return st
}

describe('stems', () => {
  test('present stem with or without its vowel', () => {
    expect(checkStemType(lex(), 'amo-v', 'amābat', 'amā', 'pres').ok).toBe(true)
    expect(checkStemType(lex(), 'amo-v', 'amābat', 'am', 'pres').ok).toBe(true)
    expect(checkStemType(lex(), 'rego-v', 'regēbat', 'reg', 'pres').ok).toBe(true)
  })
  test('perfect active stem comes from the third principal part', () => {
    expect(checkStemType(lex(), 'amo-v', 'amāvit', 'amāv', 'pfAct').ok).toBe(true)
    expect(checkStemType(lex(), 'amo-v', 'amābat', 'amāv', 'pfAct').ok).toBe(false)
    expect(checkStemType(lex(), 'capio-v', 'cēpit', 'cēp', 'pfAct').ok).toBe(true)
  })
  test('participles use the perfect passive stem, future active too', () => {
    expect(checkStemType(lex(), 'amo-v', 'amātus', 'amāt', 'pfPass').ok).toBe(true)
    expect(checkStemType(lex(), 'amo-v', 'amātūrus', 'amāt', 'pfPass').ok).toBe(true)
    expect(checkStemType(lex(), 'amo-v', 'amātus', 'amāt', 'pfAct').ok).toBe(false)
  })
  test('a wrong stem is rejected', () => {
    expect(checkStem(lex(), 'amo-v', 'amābat', 1, 'amāb').ok).toBe(false)
    expect(checkStem(lex(), 'amo-v', 'amābat', 1, 'amā').ok).toBe(true)
  })
  test('the marker is what sits between stem and ending', () => {
    const st = play('amābat', [
      { step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 't' },
      { step: 'stem', stem: 'amā' }, { step: 'stemType', t: 'pres' },
    ])
    expect(st.words[0].marker).toBe('ba')
    expect(st.step).toBe('verbForm')
    expect(submit(st, { step: 'verbForm', form: { k: 'fin', t: 'pf', m: 'ind', v: 'act', p: '3', n: 'sg' } }, lex()).error).toMatch(/stem/)
  })
})

describe('relative pronouns', () => {
  test('number and gender, antecedent, case, then function; opens a clause', () => {
    const st = play('puer quem vidēs', [
      { step: 'identify', entryId: 'puer-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: '' },
      { step: 'nomForm', form: { c: 'nom', n: 'sg', g: 'm' } }, { step: 'nomRole', role: { kind: 'label', label: 'S' } },
      { step: 'identify', entryId: 'qui-pron-2' }, { step: 'pos', pos: 'PRO' }, { step: 'ending', ending: 'em' },
      { step: 'relNG', n: 'sg', g: 'm' }, { step: 'antecedent', target: 0 }, { step: 'relCase', c: 'acc' },
      { step: 'nomRole', role: { kind: 'label', label: 'O' } },
    ])
    expect(st.words[1].antecedent).toBe(0)
    expect(st.words[1].clauseDepth).toBe(1)
    expect(st.clauses).toHaveLength(1)
  })
  test('the antecedent must match in number and gender', () => {
    const st = play('puella quem', [
      { step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'a' },
      { step: 'nomForm', form: { c: 'nom', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'label', label: 'S' } },
      { step: 'identify', entryId: 'qui-pron-2' }, { step: 'pos', pos: 'PRO' }, { step: 'ending', ending: 'em' },
      { step: 'relNG', n: 'sg', g: 'm' },
    ])
    expect(submit(st, { step: 'antecedent', target: 0 }, lex()).error).toMatch(/gender/)
    expect(submit(st, { step: 'antecedent', target: null }, lex()).step).toBe('relCase')
  })
})

describe('going back', () => {
  const ANSWERS: Answer[] = [
    { step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ae' },
    { step: 'nomForm', form: { c: 'dat', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'label', label: 'O' } },
    { step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ae' },
    { step: 'nomForm', form: { c: 'dat', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'modifies', target: 0 } },
  ]

  test('an unchanged answer re-applies everything after it', () => {
    const st = play('puellae magnae', ANSWERS)
    const ed = startEdit(st, 3, lex())
    expect(ed.step).toBe('nomForm')
    expect(ed.current).toBe(0)
    const back = submit(ed, ANSWERS[3], lex())
    expect(back.step).toBe('done')
    expect(back.editing).toBeNull()
    expect(back.log).toEqual(st.log)
  })

  test('a change stops at the first answer it breaks, on another word', () => {
    const st = play('puellae magnae', ANSWERS)
    let ed = startEdit(st, 3, lex())
    ed = submit(ed, { step: 'nomForm', form: { c: 'nom', n: 'pl', g: 'f' } }, lex())
    // Its own label (O) no longer fits a nominative: asked again on the same word, not flagged as broken.
    expect(ed.step).toBe('nomRole')
    expect(ed.current).toBe(0)
    expect(ed.editing?.broken).toEqual({ word: 0, reason: expect.stringMatching(/nominative/) })
    ed = submit(ed, { step: 'nomRole', role: { kind: 'label', label: 'S' } }, lex())
    // magnae's dative no longer agrees with a nominative noun.
    expect(ed.current).toBe(1)
    expect(ed.step).toBe('nomRole')
    expect(ed.editing?.broken?.word).toBe(1)
    expect(ed.editing?.broken?.reason).toMatch(/agree/)
    expect(ed.words[1].nomForm).toEqual({ c: 'dat', n: 'sg', g: 'f' })
  })

  test('a change can be dropped before it is made', () => {
    const st = play('puellae magnae', ANSWERS)
    const ed = startEdit(st, 1, lex())
    const back = cancelEdit(ed, lex())
    expect(back.step).toBe('done')
    expect(back.log).toEqual(st.log)
  })

  test('answers are tagged with their word', () => {
    const st = play('puellae magnae', ANSWERS)
    expect(tagged(st).filter((t) => t.word === 1)).toHaveLength(5)
  })
})

describe('forward links and changes', () => {
  const FWD: Answer[] = [
    { step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'a' },
    { step: 'nomForm', form: { c: 'nom', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'modifies', target: 1 } },
    { step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'a' },
    { step: 'nomForm', form: { c: 'nom', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'label', label: 'S' } },
  ]

  test('changing an adjective breaks its link at the later noun', () => {
    const st = play('magna puella', FWD)
    expect(st.step).toBe('done')
    let ed = startEdit(st, 3, lex())
    ed = submit(ed, { step: 'nomForm', form: { c: 'voc', n: 'sg', g: 'f' } }, lex())
    expect(ed.editing?.broken?.word).toBe(1)
    expect(ed.editing?.broken?.reason).toMatch(/case/)
  })
})
