import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import {
  checkAgreement, checkCompoundForm, checkConjType, checkIdentify, checkNomForm, checkNounLabel, checkPos, checkPrepCase,
  checkVerbForm, checkVerbLabel, compoundForms,
} from '../../src/core/checks.ts'
import { COPULAR, EXISTENTIAL, FACTITIVE } from '../../src/core/data/copular.ts'
import { LABELS } from '../../src/core/data/labels.ts'
import type { NomForm, VerbForm } from '../../src/core/checks.ts'

const L = () => lex()
const E = (id: string) => L().entries.get(id)!
const ok = (c: { ok: boolean }) => c.ok

describe('identify and pos', () => {
  test('identify', () => {
    expect(ok(checkIdentify(L(), 'puellae', 'puer-n'))).toBe(false)
    expect(ok(checkIdentify(L(), 'puellae', 'puella-n'))).toBe(true)
    expect(ok(checkIdentify(L(), 'Caesare', 'caesar-n'))).toBe(true)
  })
  test('pos', () => {
    expect(ok(checkPos(L(), 'amātus', 'amo-v', 'V'))).toBe(true)
    expect(ok(checkPos(L(), 'amātus', 'amo-v', 'ADJ'))).toBe(true)
    expect(ok(checkPos(L(), 'et', 'et-conj', 'CONJ'))).toBe(true)
    expect(ok(checkPos(L(), 'et', 'et-conj', 'ADV'))).toBe(false)
    expect(ok(checkPos(L(), 'medicus', 'medicus-n', 'V'))).toBe(false)
    expect(ok(checkPos(L(), 'duo', 'duo-num', 'ADJ'))).toBe(true)
    expect(ok(checkPos(L(), 'hunc', 'hic-pron', 'ADJ'))).toBe(true)
    expect(ok(checkPos(L(), 'ille', 'ille-adj', 'PRO'))).toBe(true)
  })
})

describe('forms', () => {
  const f = (c: any, n: any, g: any): NomForm => ({ c, n, g })
  test('nominal', () => {
    expect(ok(checkNomForm(L(), 'puellae', 'puella-n', f('abl', 'sg', 'f')))).toBe(false)
    expect(ok(checkNomForm(L(), 'puellae', 'puella-n', f('dat', 'sg', 'f')))).toBe(true)
    expect(ok(checkNomForm(L(), 'puer', 'puer-n', f('nom', 'sg', 'f')))).toBe(false)
    expect(ok(checkNomForm(L(), 'īnstrūcta', 'instruo-v', f('nom', 'sg', 'f')))).toBe(true)
  })
  test('verbal', () => {
    const v: VerbForm = { k: 'fin', p: '3', n: 'sg', t: 'impf', m: 'ind', v: 'act' }
    expect(ok(checkVerbForm(L(), 'amābat', 'amo-v', v))).toBe(true)
    expect(ok(checkVerbForm(L(), 'amābat', 'amo-v', { ...v, t: 'pf' }))).toBe(false)
    expect(ok(checkVerbForm(L(), 'amāre', 'amo-v', { k: 'inf', t: 'pres', v: 'act' }))).toBe(true)
  })
})

describe('labels', () => {
  const f = (c: any): NomForm => ({ c, n: 'sg', g: 'm' })
  test('noun labels follow case', () => {
    expect(ok(checkNounLabel(f('acc'), 'S', null))).toBe(false)
    expect(ok(checkNounLabel(f('nom'), 'S', null))).toBe(true)
    expect(ok(checkNounLabel(f('abl'), 'ADV', null))).toBe(true)
    expect(ok(checkNounLabel(f('abl'), 'PP', null))).toBe(false)
    expect(ok(checkNounLabel(f('abl'), '——', null))).toBe(true)
    expect(ok(checkNounLabel(f('abl'), '——', { case: 'abl' }))).toBe(false)
    expect(ok(checkNounLabel(f('abl'), 'PP', { case: 'abl' }))).toBe(true)
    expect(ok(checkNounLabel(f('abl'), 'O', { case: 'abl' }))).toBe(false)
    expect(ok(checkNounLabel(f('acc'), 'PP', { case: 'abl' }))).toBe(false)
    expect(ok(checkNounLabel(f('dat'), 'O', null))).toBe(true)
  })
  test('agreement', () => {
    expect(ok(checkAgreement({ c: 'acc', n: 'sg', g: 'm' }, { c: 'acc', n: 'sg', g: 'f' }))).toBe(false)
    expect(ok(checkAgreement({ c: 'acc', n: 'sg', g: 'm' }, { c: 'acc', n: 'sg', g: 'm' }))).toBe(true)
  })
  test('verb labels', () => {
    const act: VerbForm = { k: 'fin', p: '3', n: 'sg', t: 'pres', m: 'ind', v: 'act' }
    const pass: VerbForm = { ...act, v: 'pass' }
    expect(ok(checkVerbLabel(L(), 'amo-v', act, 'PV'))).toBe(false)
    expect(ok(checkVerbLabel(L(), 'amo-v', act, 'V'))).toBe(true)
    expect(ok(checkVerbLabel(L(), 'amo-v', pass, 'V'))).toBe(false)
    expect(ok(checkVerbLabel(L(), 'sequor-v', pass, 'V'))).toBe(true)
    expect(ok(checkVerbLabel(L(), 'sum-v', act, '='))).toBe(true)
    expect(ok(checkVerbLabel(L(), 'sum-v', act, 'X'))).toBe(true)
    expect(ok(checkVerbLabel(L(), 'amo-v', act, 'X'))).toBe(false)
    expect(ok(checkVerbLabel(L(), 'appello-v', pass, '='))).toBe(true)
    expect(ok(checkVerbLabel(L(), 'appello-v', act, '='))).toBe(false)
  })
  test('label list', () => {
    expect(LABELS.map((l) => l.id)).toEqual(['S', 'O', 'SC', 'OC', 'V', 'PV', '=', 'X', 'PP', 'ADV', '+', '↓', '——', 'CINF'])
  })
})

describe('prepositions and conjunctions', () => {
  test('prep case', () => {
    expect(ok(checkPrepCase(E('sub-prep'), 'acc'))).toBe(true)
    expect(ok(checkPrepCase(E('sub-prep'), 'abl'))).toBe(true)
    expect(ok(checkPrepCase(E('cum-prep'), 'acc'))).toBe(false)
    expect(ok(checkPrepCase(E('in-prep'), 'acc'))).toBe(true)
  })
  test('conj type', () => {
    expect(ok(checkConjType(E('et-conj'), '+'))).toBe(true)
    expect(ok(checkConjType(E('et-conj'), '↓'))).toBe(false)
    expect(ok(checkConjType(E('quod-conj'), '↓'))).toBe(true)
    expect(ok(checkConjType(E('que-conj'), '+'))).toBe(true)
  })
})

describe('compound verbs', () => {
  test('compound accepts feminine participle', () => {
    expect(compoundForms(L(), 'instruo-v', 'īnstrūcta', 'est')).toContainEqual({ k: 'fin', t: 'pf', m: 'ind', v: 'pass', p: '3', n: 'sg' })
  })
  test('number mismatch is not a compound', () => {
    expect(compoundForms(L(), 'appello-v', 'appellātus', 'sunt')).toEqual([])
  })
  test('neuter plural participle with sunt', () => {
    expect(compoundForms(L(), 'facio-v', 'facta', 'sunt').length).toBeGreaterThan(0)
  })
  test('check compound form', () => {
    expect(ok(checkCompoundForm(L(), 'appello-v', 'appellātus', 'est', { k: 'fin', t: 'pf', m: 'ind', v: 'pass', p: '3', n: 'sg' }))).toBe(true)
    expect(ok(checkCompoundForm(L(), 'appello-v', 'appellātus', 'est', { k: 'fin', t: 'pres', m: 'ind', v: 'pass', p: '3', n: 'sg' }))).toBe(false)
  })
})

test('copular / factitive / existential ids exist', () => {
  for (const id of [...COPULAR, ...FACTITIVE, ...EXISTENTIAL]) expect(L().entries.has(id), id).toBe(true)
})
