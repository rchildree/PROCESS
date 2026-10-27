// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Workbench } from '../../src/ui/Workbench.tsx'
import { SentenceView } from '../../src/ui/SentenceView.tsx'
import { startSession, submit, type Answer } from '../../src/core/session.ts'
import { tokenize } from '../../src/core/sets.ts'
import { lex } from '../helpers/lex.ts'

afterEach(cleanup)

function at(text: string, answers: Answer[]) {
  let st = startSession(tokenize(text, (w) => lex().lookup(w).length > 0))
  for (const a of answers) st = submit(st, a, lex())
  return st
}

test('an adjective can pick its noun from the later words', () => {
  const st = at('magnae puellae vident', [{ step: 'identify', entryId: 'magnus-adj' }, { step: 'pos', pos: 'ADJ' }, { step: 'ending', ending: 'ae' },
    { step: 'nomForm', form: { c: 'nom', n: 'pl', g: 'f' } }])
  const onAnswer = vi.fn()
  render(<Workbench st={st} lex={lex()} onAnswer={onAnswer} />)
  fireEvent.click(screen.getByRole('button', { name: 'its noun comes later' }))
  expect(screen.getByRole('button', { name: 'vident' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'puellae' }))
  expect(onAnswer).toHaveBeenCalledWith({ step: 'nomRole', role: { kind: 'modifies', target: 1 } })
})

test('a form of sum asks whether it is a verb on its own', () => {
  const st = at('est appellātus', [{ step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' }])
  const onAnswer = vi.fn()
  render(<Workbench st={st} lex={lex()} onAnswer={onAnswer} />)
  fireEvent.click(screen.getByRole('button', { name: 'part of a verb with…' }))
  fireEvent.click(screen.getByRole('button', { name: 'appellātus' }))
  expect(onAnswer).toHaveBeenCalledWith({ step: 'sumUse', target: 1 })
  cleanup()
  render(<Workbench st={st} lex={lex()} onAnswer={onAnswer} />)
  fireEvent.click(screen.getByRole('button', { name: 'on its own' }))
  expect(onAnswer).toHaveBeenCalledWith({ step: 'sumUse', target: null })
})

test('the whole sentence is visible from the start', () => {
  // jsdom has no ResizeObserver; the arcs only need it to re-measure.
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver
  const st = at('magnae puellae vident', [])
  const { container } = render(<SentenceView st={st} />)
  expect(container.querySelector('.hidden')).toBeNull()
  expect(container.textContent).toContain('vident')
  expect(container.querySelectorAll('.ahead')).toHaveLength(2)
})
