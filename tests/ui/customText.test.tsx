// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../../src/ui/App.tsx'
import { CustomTextForm } from '../../src/ui/CustomTextForm.tsx'
import { customSet, loadCustomTexts, saveCustomTexts } from '../../src/ui/customTexts.ts'
import { Worksheet } from '../../src/print/Worksheet.tsx'
import { fetchDataset } from '../../src/core/loadDataset.browser.ts'
import { loadDatasetFromDir } from '../../src/core/loadDataset.node.ts'
import { loadLog, saveLog, setTeacher, writeLast } from '../../src/ui/progress.ts'
import { lex } from '../helpers/lex.ts'

vi.mock('../../src/core/loadDataset.browser.ts', () => ({ fetchDataset: vi.fn() }))

beforeEach(() => {
  setTeacher(false)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
  vi.mocked(fetchDataset).mockResolvedValue(loadDatasetFromDir('public/data/knudsvig-731'))
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url !== './sets/index.json') throw new Error(`Unexpected fetch: ${url}`)
    return { ok: true, json: async () => [] }
  }))
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  setTeacher(null)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('pasted prose and blank-line-separated sentences retain punctuation and enclitics', () => {
  const set = customSet({ id: 'custom-example', title: 'Example', text: 'Puella fugit. Puerque fugit!\n\nMedicus amat\n\nPuer fugit' }, lex())
  expect(set.sentences).toHaveLength(4)
  expect(set.sentences[1].tokens[0]).toMatchObject({ surface: 'Puerque', host: 'Puer', enclitic: 'que' })
  expect(set.sentences[1].tokens[1].punctAfter).toBe('!')
})

test('unsupported or punctuation-only text is explained without starting a session', () => {
  const start = vi.fn()
  render(<CustomTextForm lex={lex()} onStart={start} onCancel={() => {}} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Latin text' }), { target: { value: 'Blorpus fugit.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start parsing' }))
  expect(screen.getByRole('alert').textContent).toContain('"Blorpus" not found')
  expect(start).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Latin text' }), { target: { value: '...?!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start parsing' }))
  expect(screen.getByRole('alert').textContent).toContain('at least one Latin sentence')
  expect(start).not.toHaveBeenCalled()
})

test('a pasted text can be parsed, switched away from, reopened, and resumed after reload', async () => {
  const view = render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Use your own text' }, { timeout: 5000 }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Title (optional)' }), { target: { value: 'My practice' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Latin text' }), { target: { value: 'Puella fugit. Puer fugit.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start parsing' }))
  expect(screen.getByRole('heading', { name: 'What word is “Puella”?' })).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Sentence 2 (locked)' }) as HTMLButtonElement).disabled).toBe(true)
  const [source] = loadCustomTexts()
  expect(source.title).toBe('My practice')
  expect(screen.getByRole('link', { name: 'Printable worksheet' }).getAttribute('href')).toContain(source.id)
  fireEvent.change(screen.getByRole('textbox', { name: 'Dictionary entry' }), { target: { value: 'puella' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check' }))
  expect(screen.getByRole('heading', { name: 'What part of speech is it?' })).toBeTruthy()
  expect(loadLog(source.id, 0)).toEqual([{ step: 'identify', entryId: 'puella-n' }])

  fireEvent.click(screen.getByRole('button', { name: 'Use your own text' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Latin text' }), { target: { value: 'Puer fugit.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start parsing' }))
  expect(screen.getByRole('heading', { name: 'What word is “Puer”?' })).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Sentence set' }), { target: { value: source.id } })
  expect(screen.getByRole('heading', { name: 'What part of speech is it?' })).toBeTruthy()
  view.unmount()
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'What part of speech is it?' }, { timeout: 5000 })).toBeTruthy()
  expect((screen.getByRole('combobox', { name: 'Sentence set' }) as HTMLSelectElement).value).toBe(source.id)
  expect(screen.queryByRole('button', { name: 'Hold to see the key' })).toBeNull()
}, 10000)

test('the worksheet opens saved custom text and its progress without fetching a set file', async () => {
  const source = { id: 'custom-print', title: 'My worksheet', text: 'Puella fugit.' }
  saveCustomTexts([source])
  saveLog(source.id, 0, [{ step: 'identify', entryId: 'puella-n' }])
  writeLast({ setId: source.id, i: 0 })
  render(<Worksheet />)
  expect(await screen.findByRole('heading', { name: 'My worksheet' }, { timeout: 5000 })).toBeTruthy()
  expect(screen.getByText('Parsing not finished.')).toBeTruthy()
  expect(screen.getByText('Puella')).toBeTruthy()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('storage failures keep the pasted text available and explain why it could not be saved', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Use your own text' }, { timeout: 5000 }))
  const input = screen.getByRole('textbox', { name: 'Latin text' }) as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: 'Puella fugit.' } })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
  fireEvent.click(screen.getByRole('button', { name: 'Start parsing' }))
  expect(screen.getByRole('alert').textContent).toContain('could not save')
  expect(input.value).toBe('Puella fugit.')
  expect(loadCustomTexts()).toEqual([])
})
