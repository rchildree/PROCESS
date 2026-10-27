import { useState } from 'react'
import { LABELS, NOUN_LABELS, type Label } from '../../core/data/labels.ts'
import type { Options, Role } from '../../core/session.ts'

interface Props {
  /** 'noun' = label only; 'adjective' = adjective roles; 'pronoun' = both; 'adverb'; 'verb'. */
  kind: 'noun' | 'adjective' | 'pronoun' | 'adverb' | 'verb'
  participle?: boolean
  options: Options
  wordAt: (i: number) => string
  /** The current word's place in the sentence, and the sentence's length, for picking a linked word. */
  here: number
  count: number
  onRole: (r: Role) => void
}

const labelName = (l: Label) => LABELS.find((x) => x.id === l)?.name ?? l

function Labels({ labels, onPick }: { labels: Label[]; onPick: (l: Label) => void }) {
  return (
    <div className="choices labels">
      {labels.map((l) => (
        <button key={l} type="button" onClick={() => onPick(l)} title={labelName(l)}>
          <span className="choice-label">{l}</span>
          <span className="choice-hint">{labelName(l)}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The sentence's words in order, each a button, for linking to another word on either side.
 * The current word stays in its place as plain text, marked by a small triangle beneath it.
 */
export function WordRow({ here, count, wordAt, onPick }: { here: number; count: number; wordAt: (i: number) => string; onPick: (i: number) => void }) {
  return (
    <div className="choices word-row">
      {Array.from({ length: count }, (_, j) => j === here
        ? <span key={j} className="here" aria-current="true"><em>{wordAt(j)}</em></span>
        : <button key={j} type="button" onClick={() => onPick(j)}><em>{wordAt(j)}</em></button>)}
    </div>
  )
}

/** A sub-question that picks one word of the sentence, with a way back. */
function PickWord({ heading, here, count, wordAt, onPick, onBack }: {
  heading: string; here: number; count: number; wordAt: (i: number) => string; onPick: (i: number) => void; onBack: () => void
}) {
  return (
    <div className="roles">
      <h4>{heading}</h4>
      <WordRow here={here} count={count} wordAt={wordAt} onPick={onPick} />
      <button type="button" className="link" onClick={onBack}>← back</button>
    </div>
  )
}
export { PickWord }

export function RoleStep({ kind, participle, options, wordAt, here, count, onRole }: Props) {
  const [sub, setSub] = useState<'substantive' | 'sum' | null>(null)

  // An adverb only ever takes ADV: the label is applied, the student just moves on.
  if (kind === 'adverb') return <button type="button" className="primary" autoFocus onClick={() => onRole({ kind: 'label', label: 'ADV' })}>Continue</button>

  if (kind === 'verb') return <Labels labels={options.labels ?? []} onPick={(label) => onRole({ kind: 'label', label })} />

  if (sub === 'sum') {
    return <PickWord heading="Which word is the form of sum?" here={here} count={count} wordAt={wordAt}
      onPick={(target) => onRole({ kind: 'verbPart', target })} onBack={() => setSub(null)} />
  }

  if (kind === 'noun') return <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'label', label })} />

  if (sub === 'substantive') {
    return (
      <div className="roles">
        <h4>Used as a noun. What is its function?</h4>
        <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'substantive', label })} />
        <button type="button" className="link" onClick={() => setSub(null)}>← back</button>
      </div>
    )
  }

  return (
    <div className="roles">
      {kind === 'pronoun' && (
        <section>
          <h4>Stands alone (as a noun): its function</h4>
          <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'label', label })} />
        </section>
      )}
      <section>
        <h4>Modifies a noun</h4>
        <WordRow here={here} count={count} wordAt={wordAt} onPick={(target) => onRole({ kind: 'modifies', target })} />
      </section>
      {kind === 'adjective' && (
        <section>
          <h4>Other uses</h4>
          <div className="choices">
            <button type="button" onClick={() => setSub('substantive')}>substantive (used as a noun)</button>
            <button type="button" onClick={() => onRole({ kind: 'predicate', label: 'SC' })}>predicate: SC</button>
            <button type="button" onClick={() => onRole({ kind: 'predicate', label: 'OC' })}>predicate: OC</button>
          </div>
        </section>
      )}
      {participle && (
        <section>
          <h4>Part of a verb with a form of sum</h4>
          <div className="choices">
            <button type="button" onClick={() => setSub('sum')}>part of a verb with…</button>
          </div>
        </section>
      )}
    </div>
  )
}
