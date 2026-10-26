// Per-device progress in localStorage. Every access is guarded: storage may be blocked or full.
import type { Answer, Editing } from '../core/session.ts'

const logKey = (setId: string, i: number) => `process:v1:log:${setId}:${i}`
const doneKey = (setId: string) => `process:v1:done:${setId}`

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: progress just isn't kept */
  }
}

export function saveLog(setId: string, i: number, log: Answer[], editing: Editing | null = null) {
  write(logKey(setId, i), editing ? { log, editing } : log)
}

export function loadLog(setId: string, i: number): Answer[] {
  return loadProgress(setId, i).log
}

/** The saved answers, plus a change still being carried through the sentence. Older saves are a bare array. */
export function loadProgress(setId: string, i: number): { log: Answer[]; editing: Editing | null } {
  const v = read<unknown>(logKey(setId, i), [])
  if (Array.isArray(v)) return { log: v as Answer[], editing: null }
  if (v && typeof v === 'object' && Array.isArray((v as { log?: unknown }).log)) {
    const o = v as { log: Answer[]; editing?: Editing }
    return { log: o.log, editing: o.editing ?? null }
  }
  return { log: [], editing: null }
}

const MODE_KEY = 'process:v1:lookup'
export type { LookupMode } from '../core/headword.ts'
export function loadMode(): 'help' | 'normal' | 'real' {
  const v = read<unknown>(MODE_KEY, 'normal')
  if (v === 'hard') return 'real' // the mode's old name
  return v === 'help' || v === 'real' ? v : 'normal'
}
export function saveMode(m: 'help' | 'normal' | 'real') {
  write(MODE_KEY, m)
}

export function clearLog(setId: string, i: number) {
  try {
    localStorage.removeItem(logKey(setId, i))
  } catch {
    /* ignore */
  }
}

export function markDone(setId: string, i: number) {
  const s = doneSet(setId)
  s.add(i)
  write(doneKey(setId), [...s])
}

export function doneSet(setId: string): Set<number> {
  const v = read<unknown>(doneKey(setId), [])
  return new Set(Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [])
}
