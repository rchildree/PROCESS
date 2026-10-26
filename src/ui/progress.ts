// Per-device progress in localStorage. Every access is guarded: storage may be blocked or full.
import type { Answer } from '../core/session.ts'

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

export function saveLog(setId: string, i: number, log: Answer[]) {
  write(logKey(setId, i), log)
}

export function loadLog(setId: string, i: number): Answer[] {
  const v = read<unknown>(logKey(setId, i), [])
  return Array.isArray(v) ? (v as Answer[]) : []
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
