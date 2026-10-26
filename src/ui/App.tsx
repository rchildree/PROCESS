import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDataset } from '../core/loadDataset.browser.ts'
import { buildLexicon, withGlosses } from '../core/lexicon.ts'
import type { SentenceSet, SetIndexItem } from '../core/sets.ts'
import { cancelEdit, replay, startEdit, submit, type Answer, type SessionState } from '../core/session.ts'
import type { LookupMode } from '../core/headword.ts'
import type { Lexicon } from '../core/types.ts'
import { clearLog, doneSet, loadMode, loadProgress, markDone, saveLog, saveMode } from './progress.ts'
import { SentenceView } from './SentenceView.tsx'
import { Workbench } from './Workbench.tsx'
import './styles.css'

const LAST_KEY = 'process:v1:last'

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
  const [mode, setMode] = useState<LookupMode>(loadMode)
  const [reviewing, setReviewing] = useState<number | null>(null)

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
    const saved = loadProgress(set.id, sentence)
    const base = replay(tokens, saved.log, lex)
    setSt(saved.editing && base.log.length === saved.log.length ? { ...base, editing: saved.editing } : base)
    setReviewing(null)
    writeLast({ setId: set.id, i: sentence })
  }, [set, sentence, lex])

  const commit = (next: SessionState) => {
    if (!set || sentence === null) return
    setSt(next)
    if (next.error) return
    saveLog(set.id, sentence, next.log, next.editing)
    if (next.step === 'done') { markDone(set.id, sentence); setDone(doneSet(set.id)) }
  }

  const onAnswer = (a: Answer) => {
    if (!st || !lex) return
    commit(submit(st, a, lex))
  }

  const onEdit = (k: number) => {
    if (!st || !lex) return
    setReviewing(null)
    commit(startEdit(st, k, lex))
  }

  const onCancelEdit = () => {
    if (!st || !lex) return
    commit(cancelEdit(st, lex))
  }

  const changeMode = (m: LookupMode) => { setMode(m); saveMode(m) }

  const reviewable = useMemo(() => new Set(st?.trace.map((t) => t.word) ?? []), [st])

  const restart = () => {
    if (!set || sentence === null || !lex) return
    clearLog(set.id, sentence)
    setReviewing(null)
    setSt(replay(set.sentences[sentence].tokens, [], lex))
  }

  if (loadError) return <main className="app"><p className="error">{loadError}</p></main>
  if (!index || !lex) return <main className="app"><p className="muted">Loading vocabulary…</p></main>

  return (
    <main className="app">
      <header className="top">
        <h1>PROCESS</h1>
        <div className="mode-picker" role="radiogroup" aria-label="Dictionary lookup">
          <span>Dictionary lookup</span>
          <div className="seg">
            {(['help', 'normal', 'real'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => changeMode(m)}
                title={m === 'help' ? 'Search as you type' : m === 'normal' ? 'Type at least the first part of the entry' : 'Type the whole dictionary entry'}>
                {m === 'help' ? 'Help' : m === 'normal' ? 'Normal' : 'Real'}
              </button>
            ))}
          </div>
        </div>
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
          <SentenceView st={st} reviewable={reviewable} reviewing={reviewing} onPickWord={(i) => setReviewing(reviewing === i ? null : i)} />
          {reviewable.size > 0 && <p className="sentence-hint">Click a word to see or change your answers.</p>}
          <Workbench
            st={st}
            lex={lex}
            mode={mode}
            reviewing={reviewing}
            onEdit={onEdit}
            onCloseReview={() => setReviewing(null)}
            onCancelEdit={onCancelEdit}
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
