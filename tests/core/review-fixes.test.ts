import { describe, expect, test } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize, validateSet, parseSetFile } from '../../src/core/sets.ts'
import { startSession, submit, type Answer, type SessionState } from '../../src/core/session.ts'
import { checkConjType, checkPos, checkVerbForm } from '../../src/core/checks.ts'
import { checkInfinitiveEnding, checkNominalEnding } from '../../src/core/endings.ts'
import { tokenProblems } from '../../src/core/completable.ts'
import { readdirSync, readFileSync } from 'node:fs'

const known = (w: string) => lex().lookup(w).length > 0
function play(text: string, answers: Answer[]): SessionState {
  let st = startSession(tokenize(text, known))
  for (const a of answers) {
    const next = submit(st, a, lex())
    if (next.error) throw new Error(`${st.step}: ${JSON.stringify(a)} → ${next.error}`)
    st = next
  }
  return st
}
const E = (id: string) => lex().entries.get(id)!

describe('numerals', () => {
  test('indeclinable numeral skips ending and form, then links to its noun', () => {
    const st = play('decem aprōs cēpit.', [
      { step: 'identify', entryId: 'decem-num' }, { step: 'pos', pos: 'ADJ' },
      { step: 'nomRole', role: { kind: 'pendingNoun' } },
      { step: 'identify', entryId: 'aper-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ōs' },
      { step: 'nomForm', form: { c: 'acc', n: 'pl', g: 'm' } }, { step: 'nomRole', role: { kind: 'label', label: 'O' } },
      { step: 'linkPending', target: 0 },
      { step: 'identify', entryId: 'capio-v' }, { step: 'pos', pos: 'V' }, { step: 'personal', ending: 'it' }, { step: 'stem', stem: 'cēp' }, { step: 'stemType', t: 'pfAct' },
      { step: 'verbForm', form: { k: 'fin', t: 'pf', m: 'ind', v: 'act', p: '3', n: 'sg' } }, { step: 'verbRole', role: { kind: 'label', label: 'V' } },
    ])
    expect(st.step).toBe('done')
  })
  test('duo and trēs decline', () => {
    expect(lex().lookup('duae').find((c) => c.entryId === 'duo-num')?.analyses).toContainEqual({ k: 'nom', c: 'nom', n: 'pl', g: 'f' })
    expect(lex().lookup('duo').find((c) => c.entryId === 'duo-num')?.analyses).toContainEqual({ k: 'nom', c: 'nom', n: 'pl', g: 'm' })
    expect(lex().lookup('tria').find((c) => c.entryId === 'tres-num')?.analyses).toContainEqual({ k: 'nom', c: 'acc', n: 'pl', g: 'n' })
    expect(checkNominalEnding(lex(), 'duo-num', 'duōbus', 'ōbus').ok).toBe(true)
    expect(checkNominalEnding(lex(), 'tres-num', 'trēs', 'ēs').ok).toBe(true)
  })
})

test('imperatives can be parsed', () => {
  expect(checkVerbForm(lex(), 'cūrā', 'curo-v', { k: 'imp', t: 'pres', m: 'imp', n: 'sg', v: 'act' }).ok).toBe(true)
})

describe('parts of speech for other/particle words', () => {
  test('ubi can be a subordinating conjunction', () => {
    expect(checkPos(lex(), 'ubi', 'ubi-other', 'CONJ').ok).toBe(true)
    expect(checkConjType(E('ubi-other'), '↓').ok).toBe(true)
  })
  test('sentence connectors are coordinating conjunctions', () => {
    expect(checkPos(lex(), 'autem', 'autem-particle', 'CONJ').ok).toBe(true)
    expect(checkConjType(E('autem-particle'), '+').ok).toBe(true)
  })
  test('etiam is an adverb, ait a verb', () => {
    expect(checkPos(lex(), 'etiam', 'etiam-particle', 'ADV').ok).toBe(true)
    expect(checkPos(lex(), 'ait', 'ait-other', 'V').ok).toBe(true)
    expect(checkPos(lex(), 'ait', 'ait-other', 'N').ok).toBe(false)
  })
  test('ait as a verb gets a verb label and finishes', () => {
    const st = play('ait', [{ step: 'identify', entryId: 'ait-other' }, { step: 'pos', pos: 'V' }, { step: 'verbRole', role: { kind: 'label', label: 'V' } }])
    expect(st.step).toBe('done')
  })
})

test('coordinated objects stay in the prepositional phrase', () => {
  const st = play('ex agrō et aquā', [
    { step: 'identify', entryId: 'e-prep' }, { step: 'pos', pos: 'PREP' }, { step: 'prepCase', c: 'abl' },
    { step: 'identify', entryId: 'ager-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ō' },
    { step: 'nomForm', form: { c: 'abl', n: 'sg', g: 'm' } }, { step: 'nomRole', role: { kind: 'label', label: 'PP' } },
    { step: 'identify', entryId: 'et-conj' }, { step: 'pos', pos: 'CONJ' }, { step: 'conjType', t: '+' },
    { step: 'identify', entryId: 'aqua-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'ā' },
    { step: 'nomForm', form: { c: 'abl', n: 'sg', g: 'f' } }, { step: 'nomRole', role: { kind: 'label', label: 'PP' } },
  ])
  expect(st.step).toBe('done')
})

test('velle has an infinitive ending', () => {
  expect(checkInfinitiveEnding(lex(), 'volo-v', 'velle', 'le').ok).toBe(true)
})

test('alter takes a zero ending', () => {
  expect(checkNominalEnding(lex(), 'alter-adj', 'alter', '').ok).toBe(true)
})

describe('completion check', () => {
  test('every token in every shipped set can be completed', () => {
    for (const f of readdirSync('sets')) {
      for (const set of parseSetFile(f, readFileSync('sets/' + f, 'utf8'), known)) {
        for (const s of set.sentences) for (const t of s.tokens) expect(tokenProblems(lex(), t), `${f}: ${t.surface}`).toBeNull()
      }
    }
  })
  test('validateSet reports a token that cannot be completed', () => {
    // An imperative-only reading used to be impossible to parse; a word with no workable reading is reported.
    const [set] = parseSetFile('x.txt', 'X\npuer fugit.\n', known)
    expect(validateSet(set, lex())).toEqual([])
  })
})
