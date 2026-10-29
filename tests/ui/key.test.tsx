// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/ui/App.tsx'
import { fetchDataset } from '../../src/core/loadDataset.browser.ts'
import { loadDatasetFromDir } from '../../src/core/loadDataset.node.ts'
import { keyFile, parseKey } from '../../src/core/key.ts'
import { replay, type Answer } from '../../src/core/session.ts'
import { parseSetFile, tokenize, type SentenceSet } from '../../src/core/sets.ts'
import { loadLog, markDone, saveLog, setTeacher, writeLast } from '../../src/ui/progress.ts'
import { lex } from '../helpers/lex.ts'

vi.mock('../../src/core/loadDataset.browser.ts', () => ({ fetchDataset: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  setTeacher(null)
  vi.unstubAllGlobals()
})

test.each(['Sentence 2', 'Next sentence →'])('Gladiator 1 → 2 via %s after editing keeps the parse and key together', async (navigation) => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
  setTeacher(false)
  const filename = 'lesson-11-story-gladiator-aper.md'
  const [set] = parseSetFile(filename, readFileSync(`sets/${filename}`, 'utf8'), (w) => lex().lookup(w).length > 0)
  const key = parseKey(readFileSync('sets/lesson-11-story-gladiator-aper.key.md', 'utf8'))
  const nominal = (entryId: string, ending: string, form: Extract<Answer, { step: 'nomForm' }>['form'], role: Extract<Answer, { step: 'nomRole' | 'verbRole' | 'compoundRole' }>['role'], pos: 'N' | 'ADJ' = 'N'): Answer[] => [
    { step: 'identify', entryId }, { step: 'pos', pos }, { step: 'ending', ending }, { step: 'nomForm', form }, { step: 'nomRole', role },
  ]
  const log: Answer[] = [
    ...nominal('unus-adj', 'ō', { c: 'abl', n: 'sg', g: 'm' }, { kind: 'modifies', target: 1 }, 'ADJ'),
    ...nominal('dies-n', 'ē', { c: 'abl', n: 'sg', g: 'm' }, { kind: 'label', label: '——' }),
    { step: 'identify', entryId: 'in-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
    ...nominal('harena-n', 'ā', { c: 'abl', n: 'sg', g: 'f' }, { kind: 'label', label: 'PP' }), { step: 'ppPrep', target: 2 },
    { step: 'identify', entryId: 'sum-v' }, { step: 'pos', pos: 'V' }, { step: 'sumUse', target: null },
    { step: 'personal', ending: 'ērunt' }, { step: 'stem', stem: 'fu' }, { step: 'stemType', t: 'pfAct' },
    { step: 'verbForm', form: { k: 'fin', t: 'pf', v: 'act', m: 'ind', p: '3', n: 'pl' } }, { step: 'verbRole', role: { kind: 'label', label: 'X' } },
    { step: 'identify', entryId: 'mille-num' }, { step: 'pos', pos: 'ADJ' }, { step: 'nomRole', role: { kind: 'modifies', target: 6 } },
    ...nominal('homo-n', 'ēs', { c: 'nom', n: 'pl', g: 'm' }, { kind: 'label', label: 'S' }),
    { step: 'identify', entryId: 'et-conj' }, { step: 'pos', pos: 'CONJ' }, { step: 'conjType', t: '+' },
    ...nominal('caesar-n', '', { c: 'nom', n: 'sg', g: 'm' }, { kind: 'label', label: 'S' }),
    { step: 'identify', entryId: 'cum-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
    ...nominal('senatus-n', 'ū', { c: 'abl', n: 'sg', g: 'm' }, { kind: 'label', label: 'PP' }), { step: 'ppPrep', target: 9 },
  ]
  const finished = replay(set.sentences[0].tokens, log, lex())
  expect(finished.log).toEqual(log)
  expect(finished.step).toBe('done')
  const routes: Record<string, unknown> = {
    './sets/index.json': [{ id: set.id, title: set.title, count: set.sentences.length, file: 'story.json', key: 'story.key.json' }],
    './sets/story.json': set,
    './sets/story.key.json': { setId: set.id, sentences: Object.fromEntries(key.sentences) },
  }
  vi.mocked(fetchDataset).mockResolvedValue(loadDatasetFromDir('public/data/knudsvig-731'))
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!(url in routes)) throw new Error(`Unexpected fetch: ${url}`)
    return { ok: true, json: async () => routes[url] }
  }))
  saveLog(set.id, 0, log)
  markDone(set.id, 0)
  const secondLog: Answer[] = [{ step: 'identify', entryId: 'quia-conj' }]
  saveLog(set.id, 1, secondLog)
  writeLast({ setId: set.id, i: 0 })
  const { container } = render(<App />)
  await screen.findByRole('button', { name: 'Hold to see the key' }, { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Review “senātū”' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Noun' }))
  expect(screen.getByRole('button', { name: 'Hold to see the key' })).toBeTruthy()
  fireEvent.change(screen.getByRole('textbox', { name: 'Your translation' }), { target: { value: 'One day in the arena…' } })

  fireEvent.click(screen.getByRole('button', { name: navigation }))
  expect(screen.getByRole('heading', { name: 'What part of speech is it?' })).toBeTruthy()
  expect(container.querySelectorAll('.sentence .word')).toHaveLength(12)
  expect(container.querySelector('.sentence .word')?.textContent).toBe('quia')
  expect(screen.queryByRole('button', { name: 'Hold to see the key' })).toBeNull()
  expect(loadLog(set.id, 0)).toEqual(log)
  expect(loadLog(set.id, 1)).toEqual(secondLog)

  fireEvent.click(screen.getByRole('button', { name: 'Sentence 1 (done)' }))
  expect(container.querySelectorAll('.sentence .word')).toHaveLength(11)
  expect((screen.getByRole('textbox', { name: 'Your translation' }) as HTMLTextAreaElement).value).toBe('One day in the arena…')
  fireEvent.click(screen.getByRole('button', { name: 'Sentence 2' }))
  expect(screen.getByRole('heading', { name: 'What part of speech is it?' })).toBeTruthy()
}, 10000)

test('returning to an open page refreshes an older key with the teacher’s breakdown and participle details', async () => {
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
  const legacy = parseKey(keyFile(set, [teacher]).split('\n').map((line) => line.split('|').slice(0, 6).join('|')).join('\n'))
  const routes: Record<string, unknown> = {
    './sets/index.json': [{ id: set.id, title: set.title, count: 1, file: 'demo.json', key: 'demo.key.json' }],
    './sets/demo.json': set,
    './sets/demo.key.json': { setId: set.id, sentences: Object.fromEntries(legacy.sentences) },
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
  expect(details()[0]).not.toContain('īnstrūct·a')
  fireEvent.keyUp(peek, { key: ' ' })
  // A deployment updates the file while the same sentence is still open.
  routes['./sets/demo.key.json'] = { setId: set.id, sentences: Object.fromEntries(key.sentences) }
  fireEvent(window, new Event('focus'))
  fireEvent.keyDown(peek, { key: ' ' })
  await waitFor(() => expect(details()).toEqual(original))
  expect(fetch).toHaveBeenLastCalledWith('./sets/demo.key.json', expect.objectContaining({ cache: 'no-cache' }))
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
