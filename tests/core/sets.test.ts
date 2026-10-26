import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { parseSetFile, tokenize, validateSet } from '../../src/core/sets.ts'

const known = (w: string) => lex().lookup(w).length > 0
const file = (p: string) => readFileSync(p, 'utf8')

describe('tokenize', () => {
  test('tokenize does not split real words ending in que', () => {
    const t = tokenize('neque itaque quoque atque', known)
    expect(t.map((x) => x.enclitic)).toEqual([undefined, undefined, undefined, undefined])
  })
  test('tokenize splits hōramque', () => {
    const [t] = tokenize('hōramque', known)
    expect(t).toMatchObject({ surface: 'hōramque', host: 'hōram', enclitic: 'que' })
  })
  test('punctuation peeled', () => {
    const t = tokenize('ait: "sī homō', known)
    expect(t.map((x) => x.surface)).toEqual(['ait', 'sī', 'homō'])
    expect(t[0].punctAfter).toBe(':')
    expect(t[1].punctBefore).toBe('"')
    expect(t.map((x) => x.index)).toEqual([0, 1, 2])
  })
})

describe('parseSetFile', () => {
  test('lesson-10 file', () => {
    const sets = parseSetFile('lesson-10-kernel-discrimination.md', file('sets/lesson-10-kernel-discrimination.md'), known)
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ id: 'lesson-10-kernel-discrimination', title: 'Lesson 10 — Kernel Discrimination and Demonstrative Forms', lesson: 10 })
    expect(sets[0].sentences).toHaveLength(10)
    expect(sets[0].sentences[0].text).toBe('ille puer ā populō dux appellātus est.')
  })
  test('lesson-11 story', () => {
    const [set] = parseSetFile('lesson-11-story-crassus-carbo.md', file('sets/lesson-11-story-crassus-carbo.md'), known)
    expect(set.sentences).toHaveLength(10)
    expect(set.sentences[6].text).toContain('ait')
    expect(set.sentences[6].text.endsWith('frangitur."')).toBe(true)
  })
  test('multi-lesson', () => {
    const sets = parseSetFile('multi.md', file('tests/fixtures/multi.md'), known)
    expect(sets.map((s) => [s.id, s.title, s.lesson, s.sentences.length])).toEqual([
      ['multi-lesson-1', 'Lesson 1', 1, 2],
      ['multi-lesson-2', 'Lesson 2', 2, 1],
    ])
    expect(sets[0].sentences[0].text).toBe('Fūr fugit.')
  })
  test('plain text with lesson and glosses', () => {
    const txt = 'My Set\nlesson: 3\nBlorpus fugit.\nPuella fugit.\nglosses:\nBlorpus | Blorpus, -ī m. | Blorpus (a name) | n\n'
    const [set] = parseSetFile('my-set.txt', txt, known)
    expect(set).toMatchObject({ id: 'my-set', title: 'My Set', lesson: 3 })
    expect(set.sentences.map((s) => s.text)).toEqual(['Blorpus fugit.', 'Puella fugit.'])
    expect(set.glosses).toEqual([{ lemma: 'Blorpus', dict: 'Blorpus, -ī m.', definition: 'Blorpus (a name)', pos: 'n' }])
    expect(validateSet(set, lex())).toEqual([])
  })
})

describe('validateSet', () => {
  test('reports unknown words', () => {
    const [set] = parseSetFile('x.txt', 'X\nblorpus fugit.\n', known)
    expect(validateSet(set, lex())).toEqual(['sentence 1: "blorpus" not found'])
  })
  test('real set files are valid', () => {
    for (const f of ['lesson-9-short-phrases.md', 'lesson-10-kernel-discrimination.md', 'lesson-11-story-crassus-carbo.md']) {
      for (const set of parseSetFile(f, file('sets/' + f), known)) expect(validateSet(set, lex()), f).toEqual([])
    }
  })
})
