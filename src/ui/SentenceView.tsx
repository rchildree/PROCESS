import { useLayoutEffect, useRef, useState } from 'react'
import type { SessionState, WordState } from '../core/session.ts'
import { activeIndex } from '../core/session.ts'
import { detailsOf, labelOf } from './summary.ts'

interface Props {
  st: SessionState
  /** Words that have answers and can be opened to review or change. */
  reviewable?: Set<number>
  reviewing?: number | null
  onPickWord?: (i: number) => void
}

interface Link { from: number; to: number; kind: 'mod' | 'ante' | 'pending' }
interface Arc { d: string; kind: Link['kind']; key: string; open?: boolean }

function linksOf(words: WordState[]): Link[] {
  const out: Link[] = []
  words.forEach((w, i) => {
    const r = w.role
    // A link to a later word stays provisional (dashed, with a ?) until that word is finished and the link checked.
    if (r && 'target' in r && r.target > i && !words[r.target]?.done) out.push({ from: i, to: r.target, kind: 'pending' })
    else if (r?.kind === 'modifies') out.push({ from: i, to: r.target, kind: 'mod' })
    if (w.antecedent !== undefined && w.antecedent !== null) out.push({ from: i, to: w.antecedent, kind: 'ante' })
  })
  return out
}

export function SentenceView({ st, reviewable, reviewing = null, onPickWord }: Props) {
  const active = activeIndex(st)
  const ed = st.editing
  const finished = st.step === 'done'
  const box = useRef<HTMLDivElement>(null)
  const wordEls = useRef<(HTMLElement | null)[]>([])
  const [paths, setPaths] = useState<Arc[]>([])
  const links = linksOf(st.words)
  const linkKey = links.map((l) => `${l.from}-${l.to}-${l.kind}`).join(',')

  // A word that still has answers waiting to be re-applied after a change shows its old parse faintly.
  const isGhost = (i: number) => !!ed && !finished && i > st.current && !!ed.ghost[i]?.entryId

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const b = el.getBoundingClientRect()
      const out: Arc[] = []
      for (const l of links) {
        const a = wordEls.current[l.from]?.getBoundingClientRect()
        const t = wordEls.current[l.to]?.getBoundingClientRect()
        if (!a || !t) continue
        const dir = l.from < l.to ? 1 : -1
        // Ends sit a little off-centre and the curve leans in, so it lands at an angle rather than straight down.
        const x1 = a.left + a.width / 2 - b.left + dir * 6
        const y1 = a.top - b.top + 4
        const x2 = t.left + t.width / 2 - b.left - dir * 6
        const y2 = t.top - b.top + 4
        const key = `${l.from}-${l.to}-${l.kind}`
        if (Math.abs(y1 - y2) > 10) {
          // Different lines: a hook leaving one word and a hook arriving at the other, so nothing crosses the text.
          out.push({ d: `M ${x1} ${y1} Q ${x1 + dir * 4} ${y1 - 16}, ${x1 + dir * 26} ${y1 - 16}`, kind: l.kind, key: key + 'a', open: true })
          out.push({ d: `M ${x2 - dir * 26} ${y2 - 16} Q ${x2 - dir * 4} ${y2 - 16}, ${x2} ${y2}`, kind: l.kind, key })
          continue
        }
        const span = Math.abs(x2 - x1)
        const lift = Math.min(28, 14 + span * 0.06)
        const lean = Math.min(18, span * 0.25)
        const top = Math.min(y1, y2) - lift
        out.push({ d: `M ${x1} ${y1} C ${x1 + dir * lean} ${top}, ${x2 - dir * lean} ${top}, ${x2} ${y2}`, kind: l.kind, key })
      }
      setPaths(out)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => ro.disconnect()
    // Word widths change as labels fill in, so measure again after every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey, st])

  return (
    <div className="sentence-wrap" ref={box}>
      <svg className="arrows" aria-hidden="true">
        <defs>
          {/* A dot where the line lands on the noun (or antecedent): no direction to look awkward. */}
          <marker id="dot-mod" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6">
            <circle cx="4" cy="4" r="3.5" className="head-mod" />
          </marker>
          <marker id="dot-ante" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6">
            <circle cx="4" cy="4" r="3.5" className="head-ante" />
          </marker>
          {/* A provisional link to a word not reached yet ends in a question mark instead of a dot. */}
          <marker id="dot-pending" viewBox="0 0 16 20" refX="8" refY="17" markerWidth="16" markerHeight="20" markerUnits="userSpaceOnUse">
            <text x="8" y="17" textAnchor="middle" className="head-pending">?</text>
          </marker>
        </defs>
        {paths.map((p) => <path key={p.key} d={p.d} className={`arc ${p.kind}${p.open ? ' open' : ''}`} markerEnd={p.open ? undefined : `url(#dot-${p.kind})`} />)}
      </svg>
      <ol className="sentence" aria-label="Sentence">
        {st.tokens.map((t, i) => {
          const ghost = isGhost(i)
          const words = ghost ? ed!.ghost : st.words
          const w = words[i]
          const ahead = i > st.current && !finished && !ghost && !w.done
          const inPP = st.openPP && i >= st.openPP.prep && i <= st.current && !finished
          const broken = ed?.broken && ed.broken.word === i && ed.broken.word !== ed.word
          const cls = [
            'slot',
            i === active && !finished ? 'current' : '',
            ahead ? 'ahead' : '',
            w.clauseDepth ? `clause-${Math.min(w.clauseDepth, 3)}` : '',
            inPP ? 'in-pp' : '',
            ghost ? 'ghost' : '',
            broken ? 'broken' : '',
            reviewing === i ? 'reviewing' : '',
          ].filter(Boolean).join(' ')
          const showParse = ghost || w.done || finished || (i !== active && !!w.role)
          const label = showParse ? labelOf(st, i, words) : ''
          const canOpen = !ahead && !!onPickWord && !!reviewable?.has(i)
          const inner = (
            <>
              <span className="word" ref={(el) => { wordEls.current[i] = el }}>{t.punctBefore}{t.surface}{t.punctAfter}</span>
              <span className="fn">{label}</span>
              <span className="parse">{showParse ? detailsOf(st, i, words).map((line, j) => (
                <span key={j}>{line.map((part, k) => typeof part === 'string'
                  ? <span key={k} className="gram">{part}</span>
                  : <span key={k} className="la">{part.la}</span>)}</span>
              )) : null}</span>
            </>
          )
          return (
            <li key={i} className={cls}>
              {canOpen
                ? <button type="button" className="tok" onClick={() => onPickWord!(i)} aria-label={`Review “${t.surface}”`}>{inner}</button>
                : <span className="tok">{inner}</span>}
              {broken && <span className="badge" aria-label="needs a new answer">!</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
