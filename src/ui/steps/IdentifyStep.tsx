import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { matchHeadword, type LookupMode } from '../../core/headword.ts'
import type { Entry, Lexicon } from '../../core/types.ts'

interface Props { lex: Lexicon; onPick: (entryId: string) => void; mode?: LookupMode }

export function IdentifyStep({ lex, onPick, mode = 'help' }: Props) {
  return mode === 'help' ? <SearchList lex={lex} onPick={onPick} /> : <TypeEntry lex={lex} onPick={onPick} mode={mode} />
}

/** Normal / Real: type the entry, press Enter. Several entries sharing the first part are offered to choose from. */
function TypeEntry({ lex, onPick, mode }: { lex: Lexicon; onPick: (id: string) => void; mode: 'normal' | 'real' }) {
  const [q, setQ] = useState('')
  const [choices, setChoices] = useState<Entry[] | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const check = () => {
    const r = matchHeadword(lex, q, mode)
    if (r.matches.length === 1) { onPick(r.matches[0].id); return }
    setChoices(r.matches.length ? r.matches : null)
    setReason(r.matches.length ? null : r.reason ?? null)
  }

  return (
    <div className="identify">
      <div className="type-entry">
        <input
          ref={ref}
          className="search"
          placeholder={mode === 'real' ? 'Type the full dictionary entry…' : 'Type the dictionary form…'}
          value={q}
          onChange={(e) => { setQ(e.target.value); setChoices(null); setReason(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); check() } }}
          aria-label="Dictionary entry"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="primary" disabled={!q.trim()} onClick={check}>Check</button>
      </div>
      <p className="hint">
        {mode === 'real' ? 'Every part of the entry, e.g. amō, amāre, amāvī, amātum or rēx, rēgis, m.' : 'At least the first part of the entry, e.g. amō or rēx.'}
        {' '}Macrons and commas are optional.
      </p>
      {reason && <p className="error" role="alert">{reason}</p>}
      {choices && (
        <>
          <h4>More than one entry begins that way. Which is it?</h4>
          <ul className="results" role="listbox">
            {choices.map((e) => (
              <li key={e.id} role="option" aria-selected={false} onClick={() => onPick(e.id)}>
                <span className="dict">{e.dict}</span>
                <span className="def">{e.definition}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Help: search as you type. */
function SearchList({ lex, onPick }: { lex: Lexicon; onPick: (id: string) => void }) {
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
            <li key={e.id} role="option" aria-selected={i === hi} className={i === hi ? 'hi' : ''} onMouseMove={() => setHi(i)} onClick={() => onPick(e.id)}>
              <span className="dict">{e.dict}</span>
              <span className="def">{e.definition}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
