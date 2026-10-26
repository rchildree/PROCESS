import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

interface Props {
  word: string
  /** Letters at the right end already used (the personal ending) — selection starts left of them. */
  offset?: number
  /** Marker mode: "None" button; Enter with nothing selected means no marker. */
  allowNone?: boolean
  onSubmit: (ending: string | null) => void
}

export function EndingSelector({ word, offset = 0, allowNone = false, onSubmit }: Props) {
  const letters = [...word]
  const max = Math.max(0, letters.length - offset - 1)
  const [len, setLen] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLen(0)
    ref.current?.focus()
  }, [word, offset])

  const end = letters.length - offset
  const start = end - len
  const selected = letters.slice(start, end).join('')
  const submit = () => onSubmit(allowNone && len === 0 ? null : selected)

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setLen((n) => Math.min(max, n + 1)) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setLen((n) => Math.max(0, n - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <div className="ending">
      <div className="ending-word" role="group" aria-label="Select from the end with the left arrow" tabIndex={0} ref={ref} onKeyDown={onKeyDown}>
        {letters.map((ch, i) => (
          <span key={i} className={i >= start && i < end ? 'ch sel' : i >= end ? 'ch used' : 'ch'}>{ch}</span>
        ))}
      </div>
      <div className="ending-controls">
        <button type="button" onClick={() => setLen((n) => Math.min(max, n + 1))} aria-label="Extend selection left">←</button>
        <button type="button" onClick={() => setLen((n) => Math.max(0, n - 1))} aria-label="Shrink selection">→</button>
        <button type="button" className="primary" onClick={submit}>
          {len === 0 ? (allowNone ? 'Check: no marker' : 'Check: no ending (Ø)') : `Check “-${selected}${allowNone ? '-' : ''}”`}
        </button>
        {allowNone && <button type="button" onClick={() => onSubmit(null)}>None</button>}
      </div>
      <p className="hint">Use ← to select from the end of the word, → to shrink, Enter to check.</p>
    </div>
  )
}
