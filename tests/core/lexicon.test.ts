import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { searchKey, stripMacrons } from '../../src/core/normalize.ts'

const ids = (s: string) => lex().lookup(s).map((c) => c.entryId)
const analyses = (s: string, id: string) => lex().lookup(s).find((c) => c.entryId === id)?.analyses ?? []

describe('normalize', () => {
  test('strips macrons and lowercases', () => {
    expect(stripMacrons('Fūr āēīōū')).toBe('Fur aeiou')
    expect(searchKey('Īnstrūcta')).toBe('instructa')
  })
})

describe('lookup', () => {
  test('aciēs includes acc pl f', () => {
    expect(ids('aciēs')).toEqual(['acies-n'])
    expect(analyses('aciēs', 'acies-n')).toContainEqual(expect.objectContaining({ c: 'acc', n: 'pl', g: 'f' }))
  })

  test('puellae has exactly gen sg, dat sg, nom pl, voc pl', () => {
    const a = analyses('puellae', 'puella-n').map((x) => `${(x as any).c} ${x.n}`).sort()
    expect(a).toEqual(['dat sg', 'gen sg', 'nom pl', 'voc pl'])
  })

  test('lookup handles capitalized first word', () => {
    expect(ids('Fūr')).toContain('fur-n')
    expect(ids('Caesare')).toContain('caesar-n')
  })

  test('indeclinables', () => {
    expect(ids('ā')).toContain('a-prep')
    expect(ids('ab')).toContain('a-prep')
    expect(ids('que')).toContain('que-conj')
    expect(lex().lookup('et')[0].analyses).toEqual([])
  })

  test('generated participle', () => {
    expect(analyses('īnstrūcta', 'instruo-v')).toContainEqual({ k: 'ptc', t: 'pf', v: 'pass', c: 'nom', n: 'sg', g: 'f' })
  })

  test('generated present participle oblique', () => {
    expect(analyses('amantis', 'amo-v')).toContainEqual(expect.objectContaining({ k: 'ptc', t: 'pres', v: 'act', c: 'gen', n: 'sg' }))
  })

  test('generated comparative', () => {
    expect(analyses('fortior', 'fortis-adj').some((a) => (a as any).deg === 'cmp')).toBe(true)
  })

  test('two-word compound present', () => {
    expect(analyses('appellātus est', 'appello-v')).toContainEqual(expect.objectContaining({ k: 'fin', t: 'pf', v: 'pass', p: '3', n: 'sg' }))
  })

  test('unknown word', () => {
    expect(lex().lookup('blorpus')).toEqual([])
  })
})

describe('search', () => {
  test('puer first', () => {
    expect(lex().search('puer')[0].id).toBe('puer-n')
  })
  test('macron-insensitive', () => {
    expect(lex().search('amo').map((e) => e.id)).toContain('amo-v')
  })
})

import { withGlosses } from '../../src/core/lexicon.ts'
describe('withGlosses', () => {
  test('glossed words become known and searchable', () => {
    const g = withGlosses(lex(), [{ lemma: 'Blorpus', dict: 'Blorpus, -ī m.', definition: 'Blorpus (a name)', pos: 'n' }])
    expect(g.lookup('Blorpus').map((c) => c.entryId)).toContain('gloss:Blorpus')
    expect(g.search('blorp')[0].id).toBe('gloss:Blorpus')
    expect(g.lookup('puer').map((c) => c.entryId)).toContain('puer-n')
  })
})
