import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDataset } from '../core/loadDataset.browser.ts'
import { buildLexicon, withGlosses } from '../core/lexicon.ts'
import type { SentenceSet, SetIndexItem } from '../core/sets.ts'
import { cancelEdit, replay, startEdit, submit, type Answer, type SessionState } from '../core/session.ts'
import type { LookupMode } from '../core/headword.ts'
import type { Lexicon } from '../core/types.ts'
import { differences, keyFile, wordsWithKey, type KeyWord } from '../core/key.ts'
import {
  clearLog, doneSet, frontierOf, isTeacher, loadMode, loadProgress, loadTranslation, markDone, readLast, saveLog, saveMode, saveTranslation, writeLast,
} from './progress.ts'
import { SentenceView } from './SentenceView.tsx'
import { Workbench } from './Workbench.tsx'
import { CustomTextForm } from './CustomTextForm.tsx'
import { customSet, loadCustomTexts, saveCustomTexts, type CustomText } from './customTexts.ts'
import './styles.css'

/** The furthest sentence that can be opened. Teachers can open any of them. */
const reachOf = (done: Set<number>, count: number) => (isTeacher() ? count - 1 : frontierOf(done, count))

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The student's translation of a finished sentence, saved as they type. */
function TranslationBox({ setId, i }: { setId: string; i: number }) {
  const [text, setText] = useState(() => loadTranslation(setId, i))
  return (
    <label className="translation">
      <span>Your translation</span>
      <textarea
        rows={3}
        value={text}
        placeholder="Type your English translation here."
        onChange={(e) => { setText(e.target.value); saveTranslation(setId, i, e.target.value) }}
      />
    </label>
  )
}

/** Press and hold (mouse, touch, or Space/Enter) to see the answer key; letting go shows your own work again. */
function PeekButton({ on, onChange, diff }: { on: boolean; onChange: (on: boolean) => void; diff: number }) {
  const end = () => onChange(false)
  useEffect(() => {
    if (!on) return
    // Switching windows mid-hold never delivers the release, so treat it as one.
    window.addEventListener('blur', end)
    return () => window.removeEventListener('blur', end)
  })
  const isKey = (k: string) => k === ' ' || k === 'Enter'
  return (
    <div className="peek-row">
      <button
        type="button"
        className={on ? 'peek on' : 'peek'}
        aria-pressed={on}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          // Keep the release coming here even if the finger or mouse slides off the button.
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable: release still ends it */ }
          onChange(true)
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={(e) => { if (isKey(e.key)) { e.preventDefault(); if (!e.repeat) onChange(true) } }}
        onKeyUp={(e) => { if (isKey(e.key)) { e.preventDefault(); end() } }}
        onBlur={end}
        onContextMenu={(e) => e.preventDefault()}
      >
        {on ? 'Showing the key' : 'Hold to see the key'}
      </button>
      <p className={on ? 'peek-note' : 'peek-note concealed'} role="status" aria-hidden={!on}>
        {diff === 0 ? 'Your parse matches the key.' : `${diff} ${diff === 1 ? 'word differs' : 'words differ'} from yours (marked).`}
      </p>
    </div>
  )
}

export default function App() {
  const teacher = isTeacher()
  const [baseLex, setBaseLex] = useState<Lexicon | null>(null)
  const [index, setIndex] = useState<SetIndexItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [set, setSet] = useState<SentenceSet | null>(null)
  const [sentence, setSentence] = useState<number | null>(null)
  const [sessionState, setSt] = useState<SessionState | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<LookupMode>(loadMode)
  const [reviewing, setReviewing] = useState<number | null>(null)
  /** The set's answer key: sentence number (from 1) → keyed words. */
  const [answerKey, setAnswerKey] = useState<Map<number, KeyWord[]> | null>(null)
  const [peek, setPeek] = useState(false)
  const [customTexts, setCustomTexts] = useState(loadCustomTexts)
  const [addingText, setAddingText] = useState(false)
  const openRequest = useRef(0)
  const customButton = useRef<HTMLButtonElement>(null)

  // Navigation renders before the effect below restores the selected sentence.
  // Never combine the previous parse with the new sentence's key or storage ID.
  const tokens = set && sentence !== null ? set.sentences[sentence].tokens : undefined
  const st = sessionState?.tokens === tokens ? sessionState : null

  useEffect(() => {
    Promise.all([
      fetchDataset('./data/knudsvig-731/').then(buildLexicon),
      fetch('./sets/index.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('Could not load the sentence sets.'); return r.json() }),
    ])
      .then(([lex, idx]) => { setBaseLex(lex); setIndex(idx) })
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  const lex = useMemo(() => (baseLex && set ? withGlosses(baseLex, set.glosses ?? []) : baseLex), [baseLex, set])

  const selectSet = useCallback((s: SentenceSet, sentenceIdx?: number) => {
    setAnswerKey(null)
    const d = doneSet(s.id)
    const front = reachOf(d, s.sentences.length)
    setSet(s)
    setDone(d)
    setAddingText(false)
    // Sentences are worked in order: only reopen one within the unlocked range.
    setSentence(sentenceIdx !== undefined && sentenceIdx >= 0 && sentenceIdx <= front ? sentenceIdx : front)
  }, [])

  const openSet = useCallback(async (item: SetIndexItem, sentenceIdx?: number) => {
    const request = ++openRequest.current
    try {
      const r = await fetch(`./sets/${item.file}`, { cache: 'no-cache' })
      if (!r.ok) throw new Error('Could not load that set.')
      const s: SentenceSet = await r.json()
      if (request === openRequest.current) selectSet(s, sentenceIdx)
    } catch (e) {
      if (request === openRequest.current) setLoadError((e as Error).message)
    }
  }, [selectSet])

  const startCustomText = (source: CustomText) => {
    if (!baseLex) return false
    const existing = customTexts.find((s) => s.text === source.text && s.title === source.title)
    const texts = existing ? customTexts : [...customTexts, source]
    if (!saveCustomTexts(texts)) return false
    ++openRequest.current
    setCustomTexts(texts)
    selectSet(customSet(existing ?? source, baseLex))
    return true
  }

  const keyPath = index?.find((item) => item.id === set?.id)?.key
  useEffect(() => {
    if (!keyPath) return
    let request: AbortController | undefined
    const refresh = () => {
      request?.abort()
      const controller = new AbortController()
      request = controller
      fetch(`./sets/${keyPath}`, { cache: 'no-cache', signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((k: { sentences: Record<string, KeyWord[]> } | null) => {
          if (k && !controller.signal.aborted) setAnswerKey(new Map(Object.entries(k.sentences).map(([n, w]) => [Number(n), w])))
        })
        .catch(() => { /* Keep the last loaded key if a refresh fails or is cancelled. */ })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      request?.abort()
      window.removeEventListener('focus', refresh)
    }
  }, [keyPath, set])

  // Reopen where the student left off.
  useEffect(() => {
    if (!index || !baseLex) return
    const last = readLast()
    const own = loadCustomTexts().find((x) => x.id === last.setId)
    if (own) {
      const s = customSet(own, baseLex)
      if (s.sentences.length) selectSet(s, last.i)
      return
    }
    const item = index.find((x) => x.id === last.setId)
    if (item) openSet(item, last.i)
  }, [index, baseLex, openSet, selectSet])

  useEffect(() => {
    if (!set || sentence === null || !lex) { setSt(null); return }
    const tokens = set.sentences[sentence].tokens
    const saved = loadProgress(set.id, sentence)
    const base = replay(tokens, saved.log, lex)
    setSt(saved.editing && base.log.length === saved.log.length ? { ...base, editing: saved.editing } : base)
    setReviewing(null)
    setPeek(false)
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

  const frontier = set ? reachOf(done, set.sentences.length) : 0

  const exportKey = () => {
    if (!set || !lex) return
    const states = set.sentences.map((s, i) => {
      const log = loadProgress(set.id, i).log
      return log.length ? replay(s.tokens, log, lex) : null
    })
    download(`${set.id}.key.md`, keyFile(set, states))
  }

  const sentenceKey = sentence !== null ? answerKey?.get(sentence + 1) : undefined
  const canPeek = !!st && st.step === 'done' && !st.editing && !!sentenceKey?.length
  const peeking = canPeek && peek
  const diff = useMemo(() => (canPeek && st && sentenceKey ? differences(st, sentenceKey) : new Set<number>()), [canPeek, st, sentenceKey])
  const keyed = useMemo(
    () => (canPeek && st && sentenceKey ? { ...st, words: wordsWithKey(st.words, st.tokens, sentenceKey) } : null),
    [canPeek, st, sentenceKey],
  )

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
        {teacher && (
          <p className="teacher-badge">
            Teacher mode <a className="link" href="?key=off">turn off</a>
          </p>
        )}
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
        <div className="set-picker">
          <div className="set-picker-heading">
            <label htmlFor="sentence-set">Sentence set</label>
            <button type="button" className="link custom-text-toggle" ref={customButton} aria-expanded={addingText}
              onClick={() => { ++openRequest.current; setAddingText((on) => !on) }}>Use your own text</button>
          </div>
          <select
            id="sentence-set"
            value={set?.id ?? ''}
            onChange={(e) => {
              const own = customTexts.find((x) => x.id === e.target.value)
              if (own && baseLex) { ++openRequest.current; selectSet(customSet(own, baseLex)); return }
              const it = index.find((x) => x.id === e.target.value)
              if (it) openSet(it)
            }}
          >
            <option value="" disabled>Choose a set…</option>
            {index.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.count})</option>)}
            {customTexts.length > 0 && <optgroup label="Your texts">
              {customTexts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </optgroup>}
          </select>
        </div>
      </header>

      {addingText && baseLex && <CustomTextForm lex={baseLex} onStart={startCustomText}
        onCancel={() => { setAddingText(false); customButton.current?.focus() }} />}

      {!addingText && <>
      {set && (
        <nav className="sentences" aria-label="Sentences">
          {set.sentences.map((_, i) => {
            const locked = i > frontier
            return (
              <button key={i} type="button" disabled={locked} className={[i === sentence ? 'on' : '', done.has(i) ? 'done' : '', locked ? 'locked' : ''].filter(Boolean).join(' ')}
                onClick={() => setSentence(i)} title={locked ? 'Finish the earlier sentences first' : undefined}
                aria-label={`Sentence ${i + 1}${done.has(i) ? ' (done)' : locked ? ' (locked)' : ''}`}>
                {i + 1}{done.has(i) ? ' ✓' : ''}
              </button>
            )
          })}
        </nav>
      )}

      {!set && <p className="muted intro">Choose a sentence set or use your own text to begin. You'll work through each sentence one word at a time.</p>}

      {st && set && sentence !== null && (
        <>
          <SentenceView
            st={peeking && keyed ? keyed : st}
            peeking={peeking}
            marked={peeking ? diff : undefined}
            compareWords={keyed ? (peeking ? st.words : keyed.words) : undefined}
            reviewable={peeking ? undefined : reviewable}
            reviewing={peeking ? null : reviewing}
            onPickWord={peeking ? undefined : (i) => setReviewing(reviewing === i ? null : i)}
          />
          {reviewable.size > 0 && <p className={peeking ? 'sentence-hint concealed' : 'sentence-hint'} aria-hidden={peeking}>Click a word to see or change your answers.</p>}
          {canPeek && <PeekButton on={peeking} onChange={(on) => { setPeek(on); if (on) setReviewing(null) }} diff={diff.size} />}
          {st.step === 'done' && !st.editing && <TranslationBox key={`${set.id}:${sentence}`} setId={set.id} i={sentence} />}
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
            {/* Separate printable worksheet (print.html). Remove this link to hide it. */}
            <a className="link" href={`./print.html?set=${encodeURIComponent(set.id)}`}>Printable worksheet</a>
            {teacher && (
              <button type="button" className="link" onClick={exportKey} title="Download every word you have finished in this set as an answer key">
                Export key
              </button>
            )}
          </footer>
        </>
      )}
      </>}
    </main>
  )
}
