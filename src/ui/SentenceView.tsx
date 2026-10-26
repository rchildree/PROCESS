import type { SessionState } from '../core/session.ts'
import { activeIndex } from '../core/session.ts'
import { summarize } from './summary.ts'

export function SentenceView({ st }: { st: SessionState }) {
  const active = activeIndex(st)
  return (
    <ol className="sentence" aria-label="Sentence">
      {st.tokens.map((t, i) => {
        const w = st.words[i]
        const revealed = i <= st.current || st.step === 'done' || st.resolving !== null
        const inPP = st.openPP && i >= st.openPP.prep && i <= st.current && st.step !== 'done'
        const cls = ['slot', i === active && st.step !== 'done' ? 'current' : '', revealed ? '' : 'hidden', w.clauseDepth ? `clause-${Math.min(w.clauseDepth, 3)}` : '', inPP ? 'in-pp' : '']
          .filter(Boolean).join(' ')
        if (!revealed) return <li key={i} className={cls} aria-label="hidden word"><span className="blank" /></li>
        return (
          <li key={i} className={cls}>
            <span className="word">{t.punctBefore}{t.surface}{t.punctAfter}</span>
            <span className="parse">{w.done || st.step === 'done' ? summarize(st, i).map((l, j) => <span key={j}>{l}</span>) : null}</span>
          </li>
        )
      })}
    </ol>
  )
}
