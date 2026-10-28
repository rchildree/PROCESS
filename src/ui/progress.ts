// Per-device progress in localStorage. Every access is guarded: storage may be blocked or full.
import type { Answer, Editing } from '../core/session.ts'

const TEACHER_KEY = 'process:v1:teacher'
let forced: boolean | null = null

/** Teacher mode: `?key` in the address turns it on (and the browser remembers), `?key=off` turns it off. */
export function initTeacherMode(search: string): boolean {
  const p = new URLSearchParams(search)
  if (p.has('key')) {
    try {
      if (p.get('key') === 'off') localStorage.removeItem(TEACHER_KEY)
      else localStorage.setItem(TEACHER_KEY, '1')
    } catch { /* storage unavailable: teacher mode lasts only while the address says so */ }
    forced = p.get('key') !== 'off'
    return forced
  }
  return isTeacher()
}

/** For tests and for a page whose address says ?key while storage is blocked. */
export function setTeacher(on: boolean | null) { forced = on }

export function isTeacher(): boolean {
  if (forced !== null) return forced
  try { return localStorage.getItem(TEACHER_KEY) === '1' } catch { return false }
}

// Teacher work is kept apart from student progress, so making a key never touches a student's saved work.
const ns = () => (isTeacher() ? 'process:v1:t:' : 'process:v1:')
const logKey = (setId: string, i: number) => `${ns()}log:${setId}:${i}`
const doneKey = (setId: string) => `${ns()}done:${setId}`
const trKey = (setId: string, i: number) => `${ns()}tr:${setId}:${i}`
const lastKey = () => `${ns()}last`

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

/** The furthest sentence a student may open: the first one not yet finished. Earlier ones stay open for review. */
export function frontierOf(done: Set<number>, count: number): number {
  let i = 0
  while (i < count - 1 && done.has(i)) i++
  return i
}

export function loadTranslation(setId: string, i: number): string {
  const v = read<unknown>(trKey(setId, i), '')
  return typeof v === 'string' ? v : ''
}

export function saveTranslation(setId: string, i: number, text: string) {
  if (text) write(trKey(setId, i), text)
  else try { localStorage.removeItem(trKey(setId, i)) } catch { /* ignore */ }
}

/** Where the student (or teacher) left off. */
export function readLast(): { setId?: string; i?: number } {
  const v = read<unknown>(lastKey(), {})
  return v && typeof v === 'object' ? (v as { setId?: string; i?: number }) : {}
}
export function writeLast(v: { setId: string; i: number }) {
  write(lastKey(), v)
}
