// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IdentifyStep } from '../../src/ui/steps/IdentifyStep.tsx'
import { lex } from '../helpers/lex.ts'

afterEach(cleanup)

test('a list item appearing under the pointer does not steal the highlight', () => {
  const onPick = vi.fn()
  render(<IdentifyStep lex={lex()} onPick={onPick} />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'sum' } })
  const options = screen.getAllByRole('option')
  fireEvent.mouseEnter(options[3])
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onPick).toHaveBeenCalledWith('sum-v')
})

test('moving the pointer over an item highlights it', () => {
  const onPick = vi.fn()
  render(<IdentifyStep lex={lex()} onPick={onPick} />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'sum' } })
  const options = screen.getAllByRole('option')
  fireEvent.mouseMove(options[1])
  expect(options[1].getAttribute('aria-selected')).toBe('true')
})

test('normal mode picks the entry on Enter without showing a list', () => {
  const onPick = vi.fn()
  render(<IdentifyStep lex={lex()} onPick={onPick} mode="normal" />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'amo' } })
  expect(screen.queryAllByRole('option')).toHaveLength(0)
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onPick).toHaveBeenCalledWith('amo-v')
})

test('normal mode offers a choice when entries share a first part', () => {
  const onPick = vi.fn()
  render(<IdentifyStep lex={lex()} onPick={onPick} mode="normal" />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'qui' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onPick).not.toHaveBeenCalled()
  expect(screen.getAllByRole('option')).toHaveLength(2)
})

test('real mode rejects only the first part', () => {
  const onPick = vi.fn()
  render(<IdentifyStep lex={lex()} onPick={onPick} mode="real" />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'amo' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onPick).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toMatch(/whole entry/)
})
