import { useState } from 'react'
import { LABELS, NOUN_LABELS, type Label } from '../../core/data/labels.ts'
import { IDEAS, type Idea, type Options, type Role } from '../../core/session.ts'

interface Props {
  /** 'noun' = label only; 'adjective' = adjective roles; 'pronoun' = both; 'participle' = participle roles; 'adverb'; 'verb'. */
  kind: 'noun' | 'adjective' | 'pronoun' | 'participle' | 'adverb' | 'verb'
  /** A relative pronoun: its own clause's label only, never the subject of an ablative absolute. */
  relative?: boolean
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

/** The subject of an ablative absolute: an ablative S that opens (or completes) that clause. */
function AbsSubject({ onPick }: { onPick: () => void }) {
  return (
    <div className="choices labels">
      <button type="button" onClick={onPick} title="subject of an ablative absolute">
        <span className="choice-label">S (abl. abs.)</span>
        <span className="choice-hint">subject of an ablative absolute</span>
      </button>
    </div>
  )
}

const IDEA_HINT: Record<Idea, string> = { temporal: 'when, while, after', causal: 'because, since', concessive: 'although', conditional: 'if' }

function Ideas({ onPick }: { onPick: (idea: Idea) => void }) {
  return (
    <div className="choices">
      {IDEAS.map((idea) => (
        <button key={idea} type="button" onClick={() => onPick(idea)} title={IDEA_HINT[idea]}>
          <span className="choice-label">{idea}</span>
          <span className="choice-hint">{IDEA_HINT[idea]}</span>
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

export function RoleStep({ kind, relative, options, wordAt, here, count, onRole }: Props) {
  const [sub, setSub] = useState<'substantive' | 'sum' | null>(null)
  const [idea, setIdea] = useState<{ use: 'circumstantial' | 'ablAbs'; idea: Idea } | null>(null)

  // An adverb only ever takes ADV: the label is applied, the student just moves on.
  if (kind === 'adverb') return <button type="button" className="primary" autoFocus onClick={() => onRole({ kind: 'label', label: 'ADV' })}>Continue</button>

  if (kind === 'verb') return <Labels labels={options.labels ?? []} onPick={(label) => onRole({ kind: 'label', label })} />

  if (sub === 'sum') {
    return <PickWord heading="Which word is the form of sum?" here={here} count={count} wordAt={wordAt}
      onPick={(target) => onRole({ kind: 'verbPart', target })} onBack={() => setSub(null)} />
  }

  if (idea) {
    const heading = idea.use === 'ablAbs' ? 'Which word is the subject of the ablative absolute?' : 'Which noun does the participle agree with?'
    return <PickWord heading={heading} here={here} count={count} wordAt={wordAt}
      onPick={(target) => onRole({ kind: idea.use, target, idea: idea.idea })} onBack={() => setIdea(null)} />
  }

  if (kind === 'noun') {
    return (
      <div className="roles">
        <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'label', label })} />
        {!relative && <AbsSubject onPick={() => onRole({ kind: 'label', label: 'S', abs: true })} />}
      </div>
    )
  }

  if (sub === 'substantive') {
    return (
      <div className="roles">
        <h4>Used as a noun. What is its function?</h4>
        <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'substantive', label })} />
        <AbsSubject onPick={() => onRole({ kind: 'substantive', label: 'S', abs: true })} />
        <button type="button" className="link" onClick={() => setSub(null)}>← back</button>
      </div>
    )
  }

  if (kind === 'participle') {
    return (
      <div className="roles">
        <section>
          <h4>Attributive (adjectival): modifies a noun</h4>
          <WordRow here={here} count={count} wordAt={wordAt} onPick={(target) => onRole({ kind: 'modifies', target })} />
        </section>
        <section>
          <h4>Circumstantial (adverbial): agrees with a noun and adds…</h4>
          <Ideas onPick={(i) => setIdea({ use: 'circumstantial', idea: i })} />
        </section>
        <section>
          <h4>Ablative absolute: the verb of its own clause, adding…</h4>
          <Ideas onPick={(i) => setIdea({ use: 'ablAbs', idea: i })} />
        </section>
        <section>
          <h4>Other uses</h4>
          <div className="choices">
            <button type="button" onClick={() => setSub('substantive')}>substantive (used as a noun)</button>
            <button type="button" onClick={() => onRole({ kind: 'predicate', label: 'SC' })}>predicate: SC</button>
            <button type="button" onClick={() => onRole({ kind: 'predicate', label: 'OC' })}>predicate: OC</button>
            <button type="button" onClick={() => setSub('sum')}>part of a verb with…</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="roles">
      {kind === 'pronoun' && (
        <section>
          <h4>Stands alone (as a noun): its function</h4>
          <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'label', label })} />
          <AbsSubject onPick={() => onRole({ kind: 'label', label: 'S', abs: true })} />
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
    </div>
  )
}
