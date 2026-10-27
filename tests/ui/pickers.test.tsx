// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Workbench } from '../../src/ui/Workbench.tsx'
import { startSession, submit, type Answer } from '../../src/core/session.ts'
import { tokenize } from '../../src/core/sets.ts'
import { lex } from '../helpers/lex.ts'

afterEach(cleanup)

function at(text: string, answers: Answer[]) {
  let st = startSession(tokenize(text, (w) => lex().lookup(w).length > 0))
  for (const a of answers) {
    st = submit(st, a, lex())
    if (st.error) throw new Error(st.error)
  }
  return st
}
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

test('the case screen keeps the marked ending in view', () => {
  const st = at('puellae', [{ step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ae' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByText('-ae')).toBeTruthy()
  expect(screen.queryByText(/can be/)).toBeNull()
})

test('a present stem greys out the perfect-system tenses', () => {
  const st = at('amat', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 't' }, { step: 'stem', stem: 'am' }, { step: 'stemType', t: 'pres' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(btn('Perfect').className).toContain('off')
  expect(btn('Present').className ?? '').not.toContain('off')
  expect(btn('Passive').className ?? '').not.toContain('off')
  expect(screen.queryByText(/Greyed out/)).toBeNull()
})

test('a perfect active stem greys out present tenses, passive, and imperative', () => {
  const st = at('amāvit', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'it' }, { step: 'stem', stem: 'amāv' }, { step: 'stemType', t: 'pfAct' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(btn('Present').className).toContain('off')
  expect(btn('Perfect').className ?? '').not.toContain('off')
  expect(btn('Passive').className).toContain('off')
  expect(btn('Imperative').className).toContain('off')
})

test('a noun an earlier adjective was linked to starts with that adjective\'s case, number, and gender', () => {
  const st = at('magnae puellae', [
    { step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ae' },
    { step: 'nomForm', form: { c: 'dat', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'modifies', target: 1 } },
    { step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ae' },
  ])
  expect(st.step).toBe('nomForm')
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(btn('Dat.').getAttribute('aria-pressed')).toBe('true')
  expect(btn('Sg.').getAttribute('aria-pressed')).toBe('true')
  expect(btn('F.').getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText(/preselected based on rules of agreement with/)).toBeTruthy()
  expect(btn('Check').disabled).toBe(false)
})

test('a greyed-out tense can still be picked, and Check explains why it is wrong', async () => {
  const { fireEvent } = await import('@testing-library/react')
  const st = at('amat', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 't' }, { step: 'stem', stem: 'am' }, { step: 'stemType', t: 'pres' }])
  let sent: Answer | null = null
  render(<Workbench st={st} lex={lex()} onAnswer={(a) => { sent = a }} />)
  for (const name of ['3sg', 'Perfect', 'Active', 'Indicative']) fireEvent.click(btn(name))
  expect(btn('Perfect').getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(btn('Check'))
  expect(sent).not.toBeNull()
  expect(submit(st, sent!, lex()).error).toBe('That tense is not built on the stem you marked.')
})

test('the passive on a perfect active stem is explained on Check', () => {
  const st = at('amāvit', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'it' }, { step: 'stem', stem: 'amāv' }, { step: 'stemType', t: 'pfAct' }])
  const r = submit(st, { step: 'verbForm', form: { k: 'fin', p: '3', n: 'sg', t: 'pf', m: 'ind', v: 'pass' } }, lex())
  expect(r.error).toBe('The perfect active stem does not build the passive.')
})
