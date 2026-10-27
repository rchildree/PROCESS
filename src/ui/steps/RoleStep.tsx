import { useState } from 'react'
import { LABELS, NOUN_LABELS, type Label } from '../../core/data/labels.ts'
import type { Options, Role } from '../../core/session.ts'

interface Props {
  /** 'noun' = label only; 'adjective' = adjective roles; 'pronoun' = both; 'adverb'; 'verb'. */
  kind: 'noun' | 'adjective' | 'pronoun' | 'adverb' | 'verb'
  participle?: boolean
  options: Options
  wordAt: (i: number) => string
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

/** The words after the current one, as buttons: for linking to a word not reached yet. */
export function LaterPicker({ heading, later, wordAt, onPick, onBack }: {
  heading: string; later: number[]; wordAt: (i: number) => string; onPick: (i: number) => void; onBack: () => void
}) {
  return (
    <div className="roles">
      <h4>{heading}</h4>
      <div className="choices">
        {later.map((t) => <button key={t} type="button" onClick={() => onPick(t)}><em>{wordAt(t)}</em></button>)}
        {later.length === 0 && <span className="muted">This is the last word.</span>}
      </div>
      <button type="button" className="link" onClick={onBack}>← back</button>
    </div>
  )
}

export function RoleStep({ kind, participle, options, wordAt, onRole }: Props) {
  const [sub, setSub] = useState<'substantive' | 'nounLater' | 'verbLater' | null>(null)

  if (kind === 'adverb') return <Labels labels={['ADV']} onPick={(label) => onRole({ kind: 'label', label })} />

  if (kind === 'verb') return <Labels labels={options.labels ?? []} onPick={(label) => onRole({ kind: 'label', label })} />

  if (sub === 'nounLater') {
    return <LaterPicker heading="Which later word is its noun?" later={options.later ?? []} wordAt={wordAt}
      onPick={(target) => onRole({ kind: 'modifies', target })} onBack={() => setSub(null)} />
  }
  if (sub === 'verbLater') {
    return <LaterPicker heading="Which later word is the form of sum?" later={options.later ?? []} wordAt={wordAt}
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
        <div className="choices">
          {(options.nounTargets ?? []).map((t) => (
            <button key={t} type="button" onClick={() => onRole({ kind: 'modifies', target: t })}><em>{wordAt(t)}</em></button>
          ))}
          <button type="button" onClick={() => setSub('nounLater')}>its noun comes later</button>
        </div>
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
            <button type="button" onClick={() => setSub('verbLater')}>part of a verb with…</button>
          </div>
        </section>
      )}
    </div>
  )
}
