import { expect, test } from 'vitest'
import { startSession, submit, type Answer, type SessionState } from '../../src/core/session.ts'
import { tokenize } from '../../src/core/sets.ts'
import { lex } from '../helpers/lex.ts'

function run(text: string, answers: Answer[]): SessionState {
  let st = startSession(tokenize(text, (w) => lex().lookup(w).length > 0))
  for (const a of answers) {
    st = submit(st, a, lex())
    if (st.error) throw new Error(st.error)
  }
  return st
}

const fugere: Answer[] = [
  { step: 'identify', entryId: 'fugio-v' }, { step: 'pos', pos: 'V' }, { step: 'infEnding', ending: 're' },
  { step: 'stem', stem: 'fug' }, { step: 'stemType', t: 'pres' }, { step: 'verbForm', form: { k: 'inf', t: 'pres', v: 'act' } },
]
const potuit: Answer[] = [
  { step: 'identify', entryId: 'possum-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'it' },
  { step: 'stem', stem: 'potu' }, { step: 'stemType', t: 'pfAct' }, { step: 'verbForm', form: { k: 'fin', p: '3', n: 'sg', t: 'pf', m: 'ind', v: 'act' } },
  { step: 'verbRole', role: { kind: 'label', label: 'V' } },
]
const cinf: Answer = { step: 'verbRole', role: { kind: 'label', label: 'CINF' } }

test('CINF asks which finite verb the infinitive completes', () => {
  const st = run('fugere nōn potuit', [...fugere, cinf])
  expect(st.step).toBe('completes')
})

test('a CINF can complete a later finite verb, checked when that verb is parsed', () => {
  const st = run('fugere nōn potuit', [...fugere, cinf, { step: 'completes', target: 2 },
    { step: 'identify', entryId: 'non-adv' }, { step: 'pos', pos: 'ADV' }, { step: 'nomRole', role: { kind: 'label', label: 'ADV' } },
    ...potuit])
  expect(st.step).toBe('done')
  expect(st.words[0].completes).toBe(2)
})

test('a CINF can complete an earlier finite verb', () => {
  const st = run('potuit fugere', [...potuit, ...fugere, cinf])
  const done = submit(st, { step: 'completes', target: 0 }, lex())
  expect(done.error).toBeNull()
  expect(done.step).toBe('done')
})

test('the completed word must be a finite verb', () => {
  const st = run('fugere amāre', [...fugere, cinf])
  expect(submit(st, { step: 'completes', target: 1 }, lex()).error).toBe('That word cannot be a finite verb.')
})

test('an earlier infinitive is not accepted as the finite verb', () => {
  const st = run('fugere amāre', [...fugere, { step: 'verbRole', role: { kind: 'label', label: 'V' } },
    { step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'infEnding', ending: 're' },
    { step: 'stem', stem: 'am' }, { step: 'stemType', t: 'pres' }, { step: 'verbForm', form: { k: 'inf', t: 'pres', v: 'act' } }, cinf])
  expect(submit(st, { step: 'completes', target: 0 }, lex()).error).toBe('That word is not a finite verb.')
})

test('only an infinitive can be CINF', () => {
  const st = run('potuit', potuit.slice(0, -1))
  expect(submit(st, cinf, lex()).error).toBe('Only an infinitive can be a complementary infinitive.')
})

