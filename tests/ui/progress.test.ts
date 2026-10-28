// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize } from '../../src/core/sets.ts'
import { replay, startSession, submit, type Answer } from '../../src/core/session.ts'
import {
  clearLog, doneSet, frontierOf, initTeacherMode, isTeacher, loadLog, loadTranslation, markDone, saveLog, saveTranslation, setTeacher,
} from '../../src/ui/progress.ts'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('progress', () => {
  test('replay restores step', () => {
    const tokens = tokenize('medicus puerum cūrat.', (w) => lex().lookup(w).length > 0)
    const answers: Answer[] = [{ step: 'identify', entryId: 'medicus-n' }, { step: 'pos', pos: 'N' }, { step: 'ending', ending: 'us' }]
    let live = startSession(tokens)
    for (const a of answers) live = submit(live, a, lex())
    saveLog('set-a', 0, live.log)
    const restored = replay(tokens, loadLog('set-a', 0), lex())
    expect(restored.step).toBe(live.step)
    expect(restored.step).toBe('nomForm')
  })

  test('done set', () => {
    markDone('set-a', 2)
    markDone('set-a', 0)
    expect([...doneSet('set-a')].sort()).toEqual([0, 2])
    expect(doneSet('other').size).toBe(0)
  })

  test('clearLog', () => {
    saveLog('s', 1, [{ step: 'identify', entryId: 'x' }])
    clearLog('s', 1)
    expect(loadLog('s', 1)).toEqual([])
  })

  test('loadLog returns [] when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadLog('s', 0)).toEqual([])
    expect(doneSet('s').size).toBe(0)
  })

  test('saveLog survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(() => saveLog('s', 0, [])).not.toThrow()
  })
})

describe('frontierOf', () => {
  test('nothing done: only the first sentence is open', () => {
    expect(frontierOf(new Set(), 5)).toBe(0)
  })
  test('opens up to the first unfinished sentence', () => {
    expect(frontierOf(new Set([0, 1]), 5)).toBe(2)
  })
  test('a gap stops the frontier, even if later ones are done', () => {
    expect(frontierOf(new Set([0, 2, 3]), 5)).toBe(1)
  })
  test('all done: stays on the last sentence', () => {
    expect(frontierOf(new Set([0, 1, 2]), 3)).toBe(2)
  })
})

describe('teacher mode', () => {
  afterEach(() => setTeacher(null))

  test('?key turns it on and remembers; ?key=off turns it off', () => {
    expect(initTeacherMode('')).toBe(false)
    expect(initTeacherMode('?key')).toBe(true)
    setTeacher(null)
    expect(isTeacher()).toBe(true)
    expect(initTeacherMode('?key=off')).toBe(false)
    setTeacher(null)
    expect(isTeacher()).toBe(false)
  })

  test('teacher work and translations are kept apart from the student’s', () => {
    const log: Answer[] = [{ step: 'identify', entryId: 'medicus-n' }]
    saveLog('set-a', 0, log)
    markDone('set-a', 0)
    saveTranslation('set-a', 0, 'The doctor')
    setTeacher(true)
    expect(loadLog('set-a', 0)).toEqual([])
    expect(doneSet('set-a').size).toBe(0)
    expect(loadTranslation('set-a', 0)).toBe('')
    saveTranslation('set-a', 0, 'Key version')
    setTeacher(false)
    expect(loadLog('set-a', 0)).toEqual(log)
    expect(loadTranslation('set-a', 0)).toBe('The doctor')
  })
})
