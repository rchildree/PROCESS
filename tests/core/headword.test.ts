import { expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { matchHeadword } from '../../src/core/headword.ts'

const ids = (typed: string, mode: 'normal' | 'real') => matchHeadword(lex(), typed, mode).matches.map((e) => e.id)

test('normal mode needs the first part, macrons optional', () => {
  expect(ids('amo', 'normal')).toEqual(['amo-v'])
  expect(ids('amō, amāre', 'normal')).toEqual(['amo-v'])
  expect(ids('am', 'normal')).toEqual([])
  expect(ids('amo amare amavi amatum', 'normal')).toEqual(['amo-v'])
  expect(ids('amo amabo', 'normal')).toEqual([])
})

test('either slash form is accepted', () => {
  expect(ids('ex', 'normal')).toContain('e-prep')
  expect(ids('e', 'normal')).toContain('e-prep')
  expect(ids('ab', 'real')).toContain('a-prep')
})

test('shared first parts return every entry', () => {
  expect(ids('qui', 'normal').sort()).toEqual(['qui-pron', 'qui-pron-2'])
})

test('real mode needs the whole entry, loose about commas, periods and macrons', () => {
  expect(ids('amo', 'real')).toEqual([])
  expect(ids('amō, amāre, amāvī, amātum', 'real')).toEqual(['amo-v'])
  expect(ids('rex regis m', 'real')).toEqual(['rex-n'])
  expect(ids('rēx, rēgis, m.', 'real')).toEqual(['rex-n'])
  expect(ids('adeo adire adii', 'real')).toContain('adeo-v')
  expect(ids('adeo adire adii (aditurus)', 'real')).toContain('adeo-v')
  expect(ids('homo hominis m./f.', 'real')).toEqual(['homo-n'])
  expect(matchHeadword(lex(), 'amo amare', 'real').reason).toMatch(/first part is right/)
})
