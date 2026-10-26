import { useState } from 'react'
import { LABELS, NOUN_LABELS, type Label } from '../../core/data/labels.ts'
import type { Options, Role } from '../../core/session.ts'

interface Props {
  /** 'noun' = label only; 'adjective' = adjective roles; 'pronoun' = both; 'adverb'; 'verb'. */
  kind: 'noun' | 'adjective' | 'pronoun' | 'adverb' | 'verb'
  participle?: boolean
  isSum?: boolean
  resolving?: boolean
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

export function RoleStep({ kind, participle, isSum, resolving, options, wordAt, onRole }: Props) {
  const [sub, setSub] = useState<'substantive' | null>(null)

  if (kind === 'adverb') return <Labels labels={['ADV']} onPick={(label) => onRole({ kind: 'label', label })} />

  if (kind === 'verb') {
    return (
      <div className="roles">
        <Labels labels={options.labels ?? []} onPick={(label) => onRole({ kind: 'label', label })} />
        {isSum && !resolving && (
          <section>
            <h4>Auxiliary: part of a compound verb with a participle</h4>
            <div className="choices">
              {(options.pendingTargets ?? []).map((t) => (
                <button key={t} type="button" onClick={() => onRole({ kind: 'aux', target: t })}>goes with <em>{wordAt(t)}</em></button>
              ))}
              <button type="button" onClick={() => onRole({ kind: 'aux' })}>participle comes later</button>
            </div>
          </section>
        )}
      </div>
    )
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
          {!resolving && <button type="button" onClick={() => onRole({ kind: 'pendingNoun' })}>its noun comes later</button>}
          {(options.nounTargets ?? []).length === 0 && resolving && <span className="muted">No nouns to choose.</span>}
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
      {participle && !resolving && (
        <section>
          <h4>Part of a compound verb with a form of sum</h4>
          <div className="choices">
            {(options.pendingTargets ?? []).map((t) => (
              <button key={t} type="button" onClick={() => onRole({ kind: 'verbPart', target: t })}>goes with <em>{wordAt(t)}</em></button>
            ))}
            <button type="button" onClick={() => onRole({ kind: 'verbPart' })}>form of sum comes later</button>
          </div>
        </section>
      )}
    </div>
  )
}
