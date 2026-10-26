// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EndingSelector } from '../../src/ui/steps/EndingSelector.tsx'

afterEach(cleanup)

describe('EndingSelector', () => {
  test('two left presses then Enter submits the last two letters', () => {
    const onSubmit = vi.fn()
    render(<EndingSelector word="puellae" onSubmit={onSubmit} />)
    const box = screen.getByRole('group')
    fireEvent.keyDown(box, { key: 'ArrowLeft' })
    fireEvent.keyDown(box, { key: 'ArrowLeft' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('ae')
  })

  test('right arrow shrinks the selection', () => {
    const onSubmit = vi.fn()
    render(<EndingSelector word="puellae" onSubmit={onSubmit} />)
    const box = screen.getByRole('group')
    for (let i = 0; i < 3; i++) fireEvent.keyDown(box, { key: 'ArrowLeft' })
    fireEvent.keyDown(box, { key: 'ArrowRight' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('ae')
  })

  test('marker selection starts left of the personal ending', () => {
    const onSubmit = vi.fn()
    render(<EndingSelector word="amābat" offset={1} allowNone onSubmit={onSubmit} />)
    const box = screen.getByRole('group')
    fireEvent.keyDown(box, { key: 'ArrowLeft' })
    fireEvent.keyDown(box, { key: 'ArrowLeft' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('ba')
    fireEvent.click(screen.getByRole('button', { name: /none/i }))
    expect(onSubmit).toHaveBeenLastCalledWith(null)
  })

  test('cannot select the whole word', () => {
    const onSubmit = vi.fn()
    render(<EndingSelector word="et" onSubmit={onSubmit} />)
    const box = screen.getByRole('group')
    for (let i = 0; i < 5; i++) fireEvent.keyDown(box, { key: 'ArrowLeft' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('t')
  })
})
