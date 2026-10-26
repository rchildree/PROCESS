interface Props<T extends string> {
  options: { value: T; label: string; hint?: string }[]
  onPick: (v: T) => void
}

export function ChoiceStep<T extends string>({ options, onPick }: Props<T>) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onPick(o.value)} title={o.hint}>
          <span className="choice-label">{o.label}</span>
          {o.hint && <span className="choice-hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}
