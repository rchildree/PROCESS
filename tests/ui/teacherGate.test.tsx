// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { hashPassword, type PasswordHash } from '../../src/core/password.ts'
import { initTeacherMode, isTeacher, setTeacher, setTeacherPassword, teacherPasswordNeeded, unlockTeacher } from '../../src/ui/progress.ts'
import { TeacherGate } from '../../src/ui/TeacherGate.tsx'

let pw: PasswordHash
beforeAll(async () => { pw = { salt: 'test-salt', hash: await hashPassword('magister', 'test-salt') } })

afterEach(() => {
  cleanup()
  localStorage.clear()
  setTeacher(null)
  setTeacherPassword(null)
  history.replaceState(null, '', '/')
})

test('with a password set, ?key asks for it and a wrong one stays out', async () => {
  setTeacherPassword(pw)
  expect(initTeacherMode('?key')).toBe(false)
  expect(teacherPasswordNeeded()).toBe(true)
  expect(isTeacher()).toBe(false)
  expect(await unlockTeacher('discipulus')).toBe(false)
  expect(isTeacher()).toBe(false)
  expect(await unlockTeacher(' magister ')).toBe(true)
  setTeacher(null)
  // Remembered: the next visit, with or without ?key, needs no password.
  expect(initTeacherMode('')).toBe(true)
  expect(initTeacherMode('?key')).toBe(true)
  expect(teacherPasswordNeeded()).toBe(false)
})

test('an old remembered teacher flag or a changed password signs the browser out', async () => {
  localStorage.setItem('process:v1:teacher', '1')
  setTeacherPassword(pw)
  expect(isTeacher()).toBe(false)
  await unlockTeacher('magister')
  setTeacher(null)
  expect(isTeacher()).toBe(true)
  setTeacherPassword({ salt: 'new', hash: await hashPassword('other', 'new') })
  expect(isTeacher()).toBe(false)
})

test('the prompt guards the page until the right password is given', async () => {
  setTeacherPassword(pw)
  initTeacherMode('?key')
  render(<TeacherGate><p>the app</p></TeacherGate>)
  expect(screen.queryByText('the app')).toBeNull()
  const input = screen.getByLabelText('Teacher password')
  fireEvent.change(input, { target: { value: 'guess' } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  expect((await screen.findByRole('alert')).textContent).toBe('That password isn’t right.')
  expect(screen.queryByText('the app')).toBeNull()
  fireEvent.change(input, { target: { value: 'magister' } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  await screen.findByText('the app')
  expect(isTeacher()).toBe(true)
})

test('continuing as a student opens the page in student mode and drops ?key', () => {
  setTeacherPassword(pw)
  history.replaceState(null, '', '/?key&set=demo')
  initTeacherMode(location.search)
  render(<TeacherGate><p>the app</p></TeacherGate>)
  fireEvent.click(screen.getByRole('button', { name: 'Continue as a student' }))
  expect(screen.getByText('the app')).toBeTruthy()
  expect(isTeacher()).toBe(false)
  expect(location.search).toBe('?set=demo')
})
