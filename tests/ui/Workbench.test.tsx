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
  for (const a of answers) st = submit(st, a, lex())
  return st
}

test('the infinitive ending step does not announce that the word is an infinitive', () => {
  const st = at('amāre', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }])
  expect(st.step).toBe('infEnding')
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('heading').textContent).toBe('Mark the ending.')
})

test('the participle form step uses the ordinary title', () => {
  const st = at('appellātus', [{ step: 'identify', entryId: 'appello-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'us' },
    { step: 'stem', stem: 'appellāt' }, { step: 'stemType', t: 'pfPass' }])
  expect(st.step).toBe('nomForm')
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('heading').textContent).toBe('Case, number, and gender?')
})

test('the finite verb picker always offers imperative', () => {
  const st = at('amat', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 't' }, { step: 'stem', stem: 'am' }, { step: 'stemType', t: 'pres' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('button', { name: 'Imperative' })).toBeTruthy()
})

test('a participle marks its stem after the ending', () => {
  const st = at('appellātus', [{ step: 'identify', entryId: 'appello-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'us' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('heading').textContent).toBe('Mark the stem.')
})

test('the review panel lists a word\'s answers with a Change button each', () => {
  const st = at('amat', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 't' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} reviewing={0} onEdit={() => {}} />)
  expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(3)
  expect(screen.getByText('-t')).toBeTruthy()
})

test('a change that breaks a later word says so', async () => {
  const { startEdit } = await import('../../src/core/session.ts')
  const nf = (c: any, n: any, g: any) => ({ c, n, g })
  let st = at('puellae magnae', [
    { step: 'identify', entryId: 'puella-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ae' },
    { step: 'nomForm', form: nf('dat', 'sg', 'f') }, { step: 'nomRole', role: { kind: 'label', label: 'O' } },
    { step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ae' },
    { step: 'nomForm', form: nf('dat', 'sg', 'f') }, { step: 'nomRole', role: { kind: 'modifies', target: 0 } },
  ])
  st = startEdit(st, 3, lex())
  st = submit(st, { step: 'nomForm', form: nf('nom', 'pl', 'f') }, lex())
  st = submit(st, { step: 'nomRole', role: { kind: 'label', label: 'S' } }, lex())
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('alert').textContent).toMatch(/Chain broken.*puellae.*magnae/)
})
