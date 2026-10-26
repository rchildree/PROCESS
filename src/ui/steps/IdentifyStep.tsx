import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Entry, Lexicon } from '../../core/types.ts'

interface Props { lex: Lexicon; onPick: (entryId: string) => void }

export function IdentifyStep({ lex, onPick }: Props) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const results: Entry[] = useMemo(() => lex.search(q, 12), [lex, q])

  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => setHi(0), [q])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); onPick(results[hi].id) }
  }

  return (
    <div className="identify">
      <input
        ref={ref}
        className="search"
        placeholder="Start typing the dictionary form…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Search the vocabulary"
        autoComplete="off"
        spellCheck={false}
      />
      {q.trim() && (
        <ul className="results" role="listbox">
          {results.length === 0 && <li className="empty">No matches.</li>}
          {results.map((e, i) => (
            <li key={e.id} role="option" aria-selected={i === hi} className={i === hi ? 'hi' : ''} onMouseEnter={() => setHi(i)} onClick={() => onPick(e.id)}>
              <span className="dict">{e.dict}</span>
              <span className="def">{e.definition}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
