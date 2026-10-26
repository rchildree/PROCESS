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
  const st = at('appellātus', [{ step: 'identify', entryId: 'appello-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'us' }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('heading').textContent).toBe('Case, number, and gender?')
})

test('the finite verb picker always offers imperative', () => {
  const st = at('amat', [{ step: 'identify', entryId: 'amo-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 't' }, { step: 'marker', marker: null }])
  render(<Workbench st={st} lex={lex()} onAnswer={() => {}} />)
  expect(screen.getByRole('button', { name: 'Imperative' })).toBeTruthy()
})
