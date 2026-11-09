import { useState, type ReactNode } from 'react'
import { declineTeacher, teacherPasswordNeeded, unlockTeacher } from './progress.ts'

/** Asks for the teacher password when the address says ?key, before the page loads. */
export function TeacherGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(teacherPasswordNeeded)
  const [attempt, setAttempt] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!open) return children

  const asStudent = () => {
    declineTeacher()
    // Drop ?key so a reload doesn't ask again.
    const url = new URL(location.href)
    url.searchParams.delete('key')
    history.replaceState(null, '', url)
    setOpen(false)
  }

  return (
    <main className="app">
      <form className="teacher-login workbench" role="dialog" aria-modal="true" aria-labelledby="teacher-login-heading"
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy || !attempt.trim()) return
          setBusy(true)
          const ok = await unlockTeacher(attempt)
          setBusy(false)
          if (ok) setOpen(false)
          else { setWrong(true); setAttempt('') }
        }}>
        <h2 id="teacher-login-heading">Teacher mode</h2>
        <label>
          <span>Teacher password</span>
          <input type="password" autoFocus autoComplete="current-password" value={attempt}
            onChange={(e) => { setAttempt(e.target.value); setWrong(false) }} aria-invalid={wrong} aria-describedby={wrong ? 'teacher-login-error' : undefined} />
        </label>
        {wrong && <p className="error" id="teacher-login-error" role="alert">That password isn’t right.</p>}
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !attempt.trim()}>{busy ? 'Checking…' : 'Unlock'}</button>
          <button type="button" className="link" onClick={asStudent}>Continue as a student</button>
        </div>
      </form>
    </main>
  )
}
