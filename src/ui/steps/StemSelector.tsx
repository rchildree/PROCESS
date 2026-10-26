import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

interface Props {
  word: string
  /** Letters at the right end already marked as the ending. */
  endLen: number
  onSubmit: (stem: string) => void
}

/** Select the stem from the start of the word with → (and ← to shrink). The rest up to the ending is the marker. */
export function StemSelector({ word, endLen, onSubmit }: Props) {
  const letters = [...word]
  const max = Math.max(1, letters.length - endLen)
  const [len, setLen] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLen(0)
    ref.current?.focus()
  }, [word, endLen])

  const endStart = letters.length - endLen
  const stem = letters.slice(0, len).join('')
  const grow = () => setLen((n) => Math.min(max, n + 1))
  const shrink = () => setLen((n) => Math.max(0, n - 1))
  const submit = () => { if (len > 0) onSubmit(stem) }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); grow() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); shrink() }
    else if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <div className="ending">
      <div className="ending-word" role="group" aria-label="Select the stem from the start with the right arrow" tabIndex={0} ref={ref} onKeyDown={onKeyDown}>
        {letters.map((ch, i) => (
          <span key={i} className={i < len ? 'ch stem' : i >= endStart ? 'ch used' : 'ch'}>{ch}</span>
        ))}
      </div>
      <div className="ending-controls">
        <button type="button" onClick={shrink} aria-label="Shrink selection">←</button>
        <button type="button" onClick={grow} aria-label="Extend selection right">→</button>
        <button type="button" className="primary" disabled={len === 0} onClick={submit}>
          {len === 0 ? 'Select the stem' : `Check “${stem}-”`}
        </button>
      </div>
      <p className="hint">Use → to select the stem from the start of the word, ← to shrink, Enter to check. Whatever is left before the ending is the marker.</p>
    </div>
  )
}
