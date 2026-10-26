// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { lex } from '../helpers/lex.ts'
import { tokenize } from '../../src/core/sets.ts'
import { replay, startSession, submit, type Answer } from '../../src/core/session.ts'
import { clearLog, doneSet, loadLog, markDone, saveLog } from '../../src/ui/progress.ts'

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
