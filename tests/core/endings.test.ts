import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { checkInfinitiveEnding, checkNominalEnding, checkVerbSegments } from '../../src/core/endings.ts'

const nom = (w: string, id: string, e: string) => checkNominalEnding(lex(), id, w, e).ok
const verb = (w: string, id: string, p: string, m: string | null) => checkVerbSegments(lex(), id, w, p, m).ok

describe('nominal endings', () => {
  test('puellae', () => {
    expect(nom('puellae', 'puella-n', 'ae')).toBe(true)
    expect(nom('puellae', 'puella-n', 'e')).toBe(false)
    expect(nom('puellae', 'puella-n', 'lae')).toBe(false)
  })
  test('third declension nominative has zero ending', () => {
    expect(nom('rēx', 'rex-n', '')).toBe(true)
    expect(nom('rēx', 'rex-n', 'ēx')).toBe(false)
    expect(nom('corpore', 'corpus-n', 'e')).toBe(true)
  })
  test('ending must leave a stem', () => {
    expect(nom('ā', 'a-prep', 'ā')).toBe(false)
  })
  test('second declension', () => {
    expect(nom('puerum', 'puer-n', 'um')).toBe(true)
    expect(nom('puer', 'puer-n', '')).toBe(true)
    expect(nom('medicus', 'medicus-n', 'us')).toBe(true)
    expect(nom('medicus', 'medicus-n', 's')).toBe(false)
  })
  test('fifth declension', () => {
    expect(nom('aciēs', 'acies-n', 'ēs')).toBe(true)
  })
  test('adjectives', () => {
    expect(nom('timidum', 'timidus-adj', 'um')).toBe(true)
    expect(nom('magnā', 'magnus-adj', 'ā')).toBe(true)
    expect(nom('fortior', 'fortis-adj', 'ior')).toBe(true)
    expect(nom('sapientem', 'sapiens-adj', 'em')).toBe(true)
  })
  test('participles', () => {
    expect(nom('īnstrūcta', 'instruo-v', 'a')).toBe(true)
    expect(nom('appellātus', 'appello-v', 'us')).toBe(true)
  })
  test('pronouns are lenient but need a real ending', () => {
    expect(nom('hunc', 'hic-pron', 'c')).toBe(true)
    expect(nom('hunc', 'hic-pron', 'nc')).toBe(false)
  })
})

describe('verb segments', () => {
  test('imperfect needs its marker', () => {
    expect(verb('amābat', 'amo-v', 't', 'bā')).toBe(true)
    expect(verb('amābat', 'amo-v', 't', null)).toBe(false)
  })
  test('present and perfect have no marker', () => {
    expect(verb('amat', 'amo-v', 't', null)).toBe(true)
    expect(verb('amat', 'amo-v', 't', 'a')).toBe(false)
    expect(verb('amāvit', 'amo-v', 'it', null)).toBe(true)
    expect(verb('regunt', 'rego-v', 'nt', null)).toBe(true)
    expect(verb('amātur', 'amo-v', 'tur', null)).toBe(true)
  })
  test('wrong personal ending', () => {
    expect(verb('amat', 'amo-v', 'at', null)).toBe(false)
    expect(verb('amāvit', 'amo-v', 't', null)).toBe(false)
  })
  test('future markers', () => {
    expect(verb('reget', 'rego-v', 't', 'e')).toBe(true)
    expect(verb('amābit', 'amo-v', 't', 'bi')).toBe(true)
  })
  test('pluperfect', () => {
    expect(verb('amāverat', 'amo-v', 't', 'era')).toBe(true)
  })
  test('irregular sum', () => {
    expect(verb('est', 'sum-v', 't', null)).toBe(true)
    expect(verb('sunt', 'sum-v', 'nt', null)).toBe(true)
  })
})

describe('infinitives', () => {
  test('endings', () => {
    expect(checkInfinitiveEnding(lex(), 'amo-v', 'amāre', 're').ok).toBe(true)
    expect(checkInfinitiveEnding(lex(), 'capio-v', 'capere', 're').ok).toBe(true)
    expect(checkInfinitiveEnding(lex(), 'amo-v', 'amāre', 'e').ok).toBe(false)
  })
})
