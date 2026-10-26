import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDataset } from '../core/loadDataset.browser.ts'
import { buildLexicon, withGlosses } from '../core/lexicon.ts'
import type { SentenceSet, SetIndexItem } from '../core/sets.ts'
import { replay, submit, type Answer, type SessionState } from '../core/session.ts'
import type { Lexicon } from '../core/types.ts'
import { clearLog, doneSet, loadLog, markDone, saveLog } from './progress.ts'
import { SentenceView } from './SentenceView.tsx'
import { Workbench } from './Workbench.tsx'
import './styles.css'

const LAST_KEY = 'saban:v1:last'

function readLast(): { setId?: string; i?: number } {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') } catch { return {} }
}
function writeLast(v: { setId: string; i: number }) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(v)) } catch { /* ignore */ }
}

export default function App() {
  const [baseLex, setBaseLex] = useState<Lexicon | null>(null)
  const [index, setIndex] = useState<SetIndexItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [set, setSet] = useState<SentenceSet | null>(null)
  const [sentence, setSentence] = useState<number | null>(null)
  const [st, setSt] = useState<SessionState | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())

  useEffect(() => {
    Promise.all([
      fetchDataset('./data/knudsvig-731/').then(buildLexicon),
      fetch('./sets/index.json').then((r) => { if (!r.ok) throw new Error('Could not load the sentence sets.'); return r.json() }),
    ])
      .then(([lex, idx]) => { setBaseLex(lex); setIndex(idx) })
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  const lex = useMemo(() => (baseLex && set ? withGlosses(baseLex, set.glosses ?? []) : baseLex), [baseLex, set])

  const openSet = useCallback(async (item: SetIndexItem, sentenceIdx?: number) => {
    try {
      const r = await fetch(`./sets/${item.file}`)
      if (!r.ok) throw new Error('Could not load that set.')
      const s: SentenceSet = await r.json()
      setSet(s)
      setDone(doneSet(s.id))
      setSentence(sentenceIdx !== undefined && sentenceIdx < s.sentences.length ? sentenceIdx : null)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])

  // Reopen where the student left off.
  useEffect(() => {
    if (!index) return
    const last = readLast()
    const item = index.find((x) => x.id === last.setId)
    if (item) openSet(item, last.i)
  }, [index, openSet])

  useEffect(() => {
    if (!set || sentence === null || !lex) { setSt(null); return }
    const tokens = set.sentences[sentence].tokens
    setSt(replay(tokens, loadLog(set.id, sentence), lex))
    writeLast({ setId: set.id, i: sentence })
  }, [set, sentence, lex])

  const onAnswer = (a: Answer) => {
    if (!st || !lex || !set || sentence === null) return
    const next = submit(st, a, lex)
    setSt(next)
    if (!next.error) {
      saveLog(set.id, sentence, next.log)
      if (next.step === 'done') { markDone(set.id, sentence); setDone(doneSet(set.id)) }
    }
  }

  const restart = () => {
    if (!set || sentence === null || !lex) return
    clearLog(set.id, sentence)
    setSt(replay(set.sentences[sentence].tokens, [], lex))
  }

  if (loadError) return <main className="app"><p className="error">{loadError}</p></main>
  if (!index || !lex) return <main className="app"><p className="muted">Loading vocabulary…</p></main>

  return (
    <main className="app">
      <header className="top">
        <h1>Saban <span>· the process</span></h1>
        <label className="set-picker">
          <span>Sentence set</span>
          <select
            value={set?.id ?? ''}
            onChange={(e) => { const it = index.find((x) => x.id === e.target.value); if (it) openSet(it) }}
          >
            <option value="" disabled>Choose a set…</option>
            {index.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.count})</option>)}
          </select>
        </label>
      </header>

      {set && (
        <nav className="sentences" aria-label="Sentences">
          {set.sentences.map((_, i) => (
            <button key={i} type="button" className={[i === sentence ? 'on' : '', done.has(i) ? 'done' : ''].join(' ')} onClick={() => setSentence(i)} aria-label={`Sentence ${i + 1}${done.has(i) ? ' (done)' : ''}`}>
              {i + 1}{done.has(i) ? ' ✓' : ''}
            </button>
          ))}
        </nav>
      )}

      {!set && <p className="muted intro">Choose a sentence set to begin. You'll work through each sentence one word at a time.</p>}
      {set && sentence === null && <p className="muted intro">Choose a sentence.</p>}

      {st && set && sentence !== null && (
        <>
          <SentenceView st={st} />
          <Workbench
            st={st}
            lex={lex}
            onAnswer={onAnswer}
            onNext={sentence < set.sentences.length - 1 ? () => setSentence(sentence + 1) : undefined}
          />
          <footer className="actions">
            <button type="button" className="link" onClick={restart}>Restart this sentence</button>
          </footer>
        </>
      )}
    </main>
  )
}
