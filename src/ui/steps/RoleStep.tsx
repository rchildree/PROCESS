import { useState } from 'react'
import { LABELS, NOUN_LABELS, type Label } from '../../core/data/labels.ts'
import { IDEAS, type Idea, type Options, type Role } from '../../core/session.ts'

interface Props {
  /** 'noun' = label only; 'adjective' = adjective roles; 'pronoun' = both; 'participle' = participle roles; 'adverb'; 'verb'. */
  kind: 'noun' | 'adjective' | 'pronoun' | 'participle' | 'adverb' | 'verb'
  options: Options
  wordAt: (i: number) => string
  /** The current word's place in the sentence, and the sentence's length, for picking a linked word. */
  here: number
  count: number
  onRole: (r: Role) => void
  /** An earlier ablative S that already named this participle: the ablative absolute's subject, no need to ask again. */
  absSubject?: number
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

type Use = 'adjectival' | 'circumstantial' | 'ablAbs'

export function RoleStep({ kind, options, wordAt, here, count, onRole, absSubject }: Props) {
  const [sub, setSub] = useState<'substantive' | 'sum' | null>(null)
  const [use, setUse] = useState<Use | null>(null)
  const [idea, setIdea] = useState<Idea | null>(null)

  // An adverb only ever takes ADV: the label is applied, the student just moves on.
  if (kind === 'adverb') return <button type="button" className="primary" autoFocus onClick={() => onRole({ kind: 'label', label: 'ADV' })}>Continue</button>

  if (kind === 'verb') return <Labels labels={options.labels ?? []} onPick={(label) => onRole({ kind: 'label', label })} />

  if (sub === 'sum') {
    return <PickWord heading="Which word is the form of sum?" here={here} count={count} wordAt={wordAt}
      onPick={(target) => onRole({ kind: 'verbPart', target })} onBack={() => setSub(null)} />
  }

  if (use === 'adjectival') {
    return <PickWord heading="Which noun does the participle modify?" here={here} count={count} wordAt={wordAt}
      onPick={(target) => onRole({ kind: 'modifies', target })} onBack={() => setUse(null)} />
  }

  if (use && !idea) {
    return (
      <div className="roles">
        <h4>{use === 'ablAbs' ? 'Ablative absolute: what idea does it add?' : 'Adverbial: what idea does it add?'}</h4>
        <Ideas onPick={(i) => {
          // An earlier S already named this participle: that S is the subject, so send it straight for checking.
          if (use === 'ablAbs' && absSubject !== undefined) onRole({ kind: 'ablAbs', target: absSubject, idea: i })
          else setIdea(i)
        }} />
        <button type="button" className="link" onClick={() => setUse(null)}>← back</button>
      </div>
    )
  }

  if (use && idea) {
    const u = use as 'circumstantial' | 'ablAbs'
    const heading = u === 'ablAbs' ? 'Which word is the subject of the ablative absolute?' : 'Which noun does the participle agree with?'
    return <PickWord heading={heading} here={here} count={count} wordAt={wordAt}
      onPick={(target) => onRole({ kind: u, target, idea })} onBack={() => setIdea(null)} />
  }

  if (kind === 'noun') {
    return (
      <div className="roles">
        <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'label', label })} />
      </div>
    )
  }

  if (sub === 'substantive') {
    return (
      <div className="roles">
        <h4>Used as a noun. What is its function?</h4>
        <Labels labels={NOUN_LABELS} onPick={(label) => onRole({ kind: 'substantive', label })} />
        <button type="button" className="link" onClick={() => setSub(null)}>← back</button>
      </div>
    )
  }

  if (kind === 'participle') {
    return (
      <div className="roles">
        <section>
          <h4>Main uses</h4>
          <div className="choices">
            <button type="button" onClick={() => setUse('adjectival')}>
              <span className="choice-label">adjectival</span>
              <span className="choice-hint">modifies a noun</span>
            </button>
            <button type="button" onClick={() => setUse('circumstantial')}>
              <span className="choice-label">adverbial</span>
              <span className="choice-hint">agrees with a noun, adds a clause idea</span>
            </button>
            <button type="button" onClick={() => setUse('ablAbs')}>
              <span className="choice-label">ablative absolute</span>
              <span className="choice-hint">the verb of its own clause</span>
            </button>
          </div>
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
