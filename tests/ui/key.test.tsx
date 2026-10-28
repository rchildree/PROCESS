// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/ui/App.tsx'
import { fetchDataset } from '../../src/core/loadDataset.browser.ts'
import { loadDatasetFromDir } from '../../src/core/loadDataset.node.ts'
import { keyFile, parseKey } from '../../src/core/key.ts'
import { replay, type Answer } from '../../src/core/session.ts'
import { tokenize, type SentenceSet } from '../../src/core/sets.ts'
import { loadLog, saveLog, setTeacher, writeLast } from '../../src/ui/progress.ts'
import { lex } from '../helpers/lex.ts'

vi.mock('../../src/core/loadDataset.browser.ts', () => ({ fetchDataset: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  setTeacher(null)
  vi.unstubAllGlobals()
})

test('holding the exported key keeps the teacher’s breakdown and participle details visible', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
  setTeacher(false)
  const text = 'īnstrūcta est.'
  const tokens = tokenize(text, (w) => lex().lookup(w).length > 0)
  const log: Answer[] = [
    { step: 'identify', entryId: 'instruo-v' }, { step: 'pos', pos: 'V' }, { step: 'ending', ending: 'a' },
    { step: 'stem', stem: 'īnstrūct' }, { step: 'stemType', t: 'pfPass' },
    { step: 'nomForm', form: { c: 'nom', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'verbPart', target: 1 } },
    { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' },
    { step: 'compoundForm', form: { k: 'fin', t: 'pf', v: 'pass', m: 'ind', p: '3', n: 'sg' } },
    { step: 'compoundRole', role: { kind: 'label', label: 'PV' } },
  ]
  const teacher = replay(tokens, log, lex())
  expect(teacher.step).toBe('done')
  const set: SentenceSet = { id: 'demo', title: 'Demo', sentences: [{ text, tokens }] }
  const key = parseKey(keyFile(set, [teacher]))
  const routes: Record<string, unknown> = {
    './sets/index.json': [{ id: set.id, title: set.title, count: 1, file: 'demo.json', key: 'demo.key.json' }],
    './sets/demo.json': set,
    './sets/demo.key.json': { setId: set.id, sentences: Object.fromEntries(key.sentences) },
  }
  vi.mocked(fetchDataset).mockResolvedValue(loadDatasetFromDir('public/data/knudsvig-731'))
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!(url in routes)) throw new Error(`Unexpected fetch: ${url}`)
    return { ok: true, json: async () => routes[url] }
  }))
  saveLog(set.id, 0, log)
  writeLast({ setId: set.id, i: 0 })
  const { container } = render(<App />)
  // Building the real lexicon can exceed Testing Library's 1s default on CI runners.
  const peek = await screen.findByRole('button', { name: 'Hold to see the key' }, { timeout: 5000 })
  const details = () => [...container.querySelectorAll('.parse:not(.comparison)')].map((el) => el.textContent)
  const original = details()
  expect(original[0]).toContain('īnstrūct·a')
  expect(original[0]).toContain('pf pass ptc')
  fireEvent.keyDown(peek, { key: ' ' })
  expect(peek.getAttribute('aria-pressed')).toBe('true')
  expect(details()).toEqual(original)
  expect(screen.getByRole('status').textContent).toBe('Your parse matches the key.')
  // The hint and alternate details still reserve their space during the hold.
  expect(container.querySelector('.sentence-hint')?.classList.contains('concealed')).toBe(true)
  expect(container.querySelectorAll('.tok.comparing')).toHaveLength(2)
  expect(container.querySelectorAll('.parse.comparison[aria-hidden="true"]')).toHaveLength(2)
  fireEvent.keyUp(peek, { key: ' ' })
  expect(peek.getAttribute('aria-pressed')).toBe('false')
  expect(details()).toEqual(original)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review “īnstrūcta”' })).toBeTruthy())
  expect(loadLog(set.id, 0)).toEqual(log)
}, 10000)
