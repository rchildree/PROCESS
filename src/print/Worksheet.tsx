import { useEffect, useMemo, useState } from 'react'
import { fetchDataset } from '../core/loadDataset.browser.ts'
import { buildLexicon, withGlosses } from '../core/lexicon.ts'
import type { SentenceSet, SetIndexItem } from '../core/sets.ts'
import { replay, type SessionState } from '../core/session.ts'
import type { Lexicon } from '../core/types.ts'
import { loadProgress } from '../ui/progress.ts'
import { SentenceView } from '../ui/SentenceView.tsx'
import '../ui/styles.css'
import './print.css'

const LAST_KEY = 'process:v1:last'
const OPTS_KEY = 'process:v1:print'

interface Opts { parsing: boolean; vocab: boolean; lines: number }
const DEFAULT_OPTS: Opts = { parsing: true, vocab: true, lines: 3 }

function readJSON<T>(key: string, fallback: T): T {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') } } catch { return fallback }
}

interface Item { n: number; text: string; st: SessionState | null; started: boolean; finished: boolean; vocab: { dict: string; def: string }[] }

/** A sentence's saved work, shown with every word visible whether or not the student reached it. */
function itemFor(set: SentenceSet, i: number, lex: Lexicon): Item {
  const s = set.sentences[i]
  const st = replay(s.tokens, loadProgress(set.id, i).log, lex)
  const started = st.log.length > 0
  const seen = new Set<string>()
  const vocab: Item['vocab'] = []
  for (const w of st.words) {
    const e = w.entryId ? lex.entries.get(w.entryId) : undefined
    if (e && !seen.has(e.id)) { seen.add(e.id); vocab.push({ dict: e.dict, def: e.definition }) }
  }
  return {
    n: i + 1,
    text: s.text,
    st: started ? { ...st, step: 'done', editing: null, openPP: null } : null,
    started,
    finished: st.step === 'done',
    vocab,
  }
}

export function Worksheet() {
  const [baseLex, setBaseLex] = useState<Lexicon | null>(null)
  const [index, setIndex] = useState<SetIndexItem[] | null>(null)
  const [set, setSet] = useState<SentenceSet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opts, setOpts] = useState<Opts>(() => readJSON(OPTS_KEY, DEFAULT_OPTS))

  useEffect(() => {
    Promise.all([
      fetchDataset('./data/knudsvig-731/').then(buildLexicon),
      fetch('./sets/index.json').then((r) => { if (!r.ok) throw new Error('Could not load the sentence sets.'); return r.json() }),
    ])
      .then(([lex, idx]: [Lexicon, SetIndexItem[]]) => {
        setBaseLex(lex)
        setIndex(idx)
        const wanted = new URLSearchParams(location.search).get('set') ?? readJSON<{ setId?: string }>(LAST_KEY, {}).setId
        const item = idx.find((x) => x.id === wanted) ?? idx[0]
        if (item) open(item)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const open = (item: SetIndexItem) => {
    fetch(`./sets/${item.file}`)
      .then((r) => { if (!r.ok) throw new Error('Could not load that set.'); return r.json() })
      .then(setSet)
      .catch((e: Error) => setError(e.message))
  }

  const change = (o: Partial<Opts>) => {
    const next = { ...opts, ...o }
    setOpts(next)
    try { localStorage.setItem(OPTS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const lex = useMemo(() => (baseLex && set ? withGlosses(baseLex, set.glosses ?? []) : baseLex), [baseLex, set])
  const items = useMemo(() => (set && lex ? set.sentences.map((_, i) => itemFor(set, i, lex)) : []), [set, lex])
  const unfinished = items.filter((it) => !it.finished).length

  if (error) return <main className="ws-screen"><p className="error">{error}</p></main>
  if (!index || !lex) return <main className="ws-screen"><p className="muted">Loading…</p></main>

  return (
    <>
      <div className="ws-toolbar">
        <a href="./" className="link">← Back to PROCESS</a>
        <label>
          <span>Sentence set</span>
          <select value={set?.id ?? ''} onChange={(e) => { const it = index.find((x) => x.id === e.target.value); if (it) open(it) }}>
            {index.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={opts.parsing} onChange={(e) => change({ parsing: e.target.checked })} /> My parsing</label>
        <label className="check"><input type="checkbox" checked={opts.vocab} onChange={(e) => change({ vocab: e.target.checked })} /> Vocabulary</label>
        <label>
          <span>Lines per sentence</span>
          <select value={opts.lines} onChange={(e) => change({ lines: Number(e.target.value) })}>
            {[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="primary" onClick={() => window.print()}>Print / Save as PDF</button>
        {opts.parsing && unfinished > 0 && (
          <p className="ws-note">{unfinished} of {items.length} sentences aren't finished in the app yet; they print with whatever parsing has been done.</p>
        )}
      </div>

      {set && (
        <article className="ws-page">
          <header className="ws-head">
            <div>
              <div className="ws-brand">PROCESS</div>
              <h1>{set.title}</h1>
            </div>
            <div className="ws-fields">
              <span>Name <i /></span>
              <span>Date <i /></span>
            </div>
          </header>

          {items.map((it) => (
            <section key={it.n} className="ws-item">
              <div className="ws-num">{it.n}.</div>
              <div className="ws-body">
                {opts.parsing && it.st
                  ? <SentenceView st={it.st} />
                  : <p className="ws-latin">{it.text}</p>}
                {opts.parsing && it.started && !it.finished && <p className="ws-partial">Parsing not finished.</p>}
                {opts.vocab && it.vocab.length > 0 && (
                  <ul className="ws-vocab">
                    {it.vocab.map((v) => <li key={v.dict}><b>{v.dict}</b> {v.def}</li>)}
                  </ul>
                )}
                <div className="ws-lines" aria-label="Space for your translation">
                  {Array.from({ length: opts.lines }, (_, k) => <div key={k} className="ws-line" />)}
                </div>
              </div>
            </section>
          ))}
        </article>
      )}
    </>
  )
}
