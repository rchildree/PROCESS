import { useState } from 'react'
import type { NomForm, VerbForm } from '../../core/checks.ts'
import type { Options } from '../../core/session.ts'

const CASE_LABEL: Record<string, string> = { nom: 'Nom.', gen: 'Gen.', dat: 'Dat.', acc: 'Acc.', abl: 'Abl.', voc: 'Voc.' }
const NUM_LABEL: Record<string, string> = { sg: 'Sg.', pl: 'Pl.' }
const GEN_LABEL: Record<string, string> = { m: 'M.', f: 'F.', n: 'N.' }
const PERSON_LABEL: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' }
const TENSE_LABEL: Record<string, string> = { pres: 'Present', impf: 'Imperfect', fut: 'Future', pf: 'Perfect', plupf: 'Pluperfect', futpf: 'Fut. perf.' }
const MOOD_LABEL: Record<string, string> = { ind: 'Indicative', subj: 'Subjunctive', imp: 'Imperative' }
const VOICE_LABEL: Record<string, string> = { act: 'Active', pass: 'Passive' }

function Group<T extends string>({ title, values, labels, value, onChange }: { title: string; values: T[]; labels: Record<string, string>; value?: T; onChange: (v: T) => void }) {
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      {values.map((v) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{labels[v] ?? v}</button>
      ))}
    </fieldset>
  )
}

export function NomFormPicker({ options, onSubmit }: { options: Options; onSubmit: (f: NomForm) => void }) {
  const [c, setC] = useState<NomForm['c']>()
  const [n, setN] = useState<NomForm['n']>()
  const [g, setG] = useState<NomForm['g']>()
  const ready = c && n && g
  return (
    <div className="form-picker">
      <Group title="Case" values={options.cases ?? []} labels={CASE_LABEL} value={c} onChange={setC} />
      <Group title="Number" values={options.numbers ?? []} labels={NUM_LABEL} value={n} onChange={setN} />
      <Group title="Gender" values={options.genders ?? []} labels={GEN_LABEL} value={g} onChange={setG} />
      <button type="button" className="primary" disabled={!ready} onClick={() => ready && onSubmit({ c, n, g })}>Check</button>
    </div>
  )
}

type Kind = 'fin' | 'inf' | 'imp'

export function VerbFormPicker({ options, kinds, onSubmit }: { options: Options; kinds: Kind[]; onSubmit: (f: VerbForm) => void }) {
  const [k, setK] = useState<Kind>(kinds[0])
  const [p, setP] = useState<VerbForm['p']>()
  const [n, setN] = useState<VerbForm['n']>()
  const [t, setT] = useState<VerbForm['t']>()
  const [m, setM] = useState<VerbForm['m']>()
  const [v, setV] = useState<VerbForm['v']>()
  const KIND_LABEL: Record<string, string> = { fin: 'Finite', inf: 'Infinitive', imp: 'Imperative' }
  const ready = k === 'inf' ? t && v : k === 'imp' ? n && v : p && n && t && m && v
  const submit = () => {
    if (!ready) return
    if (k === 'inf') onSubmit({ k, t: t!, v: v! })
    else if (k === 'imp') onSubmit({ k, t: 'pres', m: 'imp', n, v: v! })
    else onSubmit({ k, p, n, t: t!, m, v: v! })
  }
  return (
    <div className="form-picker">
      {kinds.length > 1 && <Group title="Form" values={kinds} labels={KIND_LABEL} value={k} onChange={setK} />}
      {k === 'fin' && <Group title="Person" values={options.persons ?? []} labels={PERSON_LABEL} value={p} onChange={setP} />}
      {k !== 'inf' && <Group title="Number" values={options.numbers ?? []} labels={NUM_LABEL} value={n} onChange={setN} />}
      {k !== 'imp' && <Group title="Tense" values={options.tenses ?? []} labels={TENSE_LABEL} value={t} onChange={setT} />}
      {k === 'fin' && <Group title="Mood" values={(options.moods ?? []).filter((x) => x !== 'imp')} labels={MOOD_LABEL} value={m} onChange={setM} />}
      <Group title="Voice" values={options.voices ?? []} labels={VOICE_LABEL} value={v} onChange={setV} />
      <button type="button" className="primary" disabled={!ready} onClick={submit}>Check</button>
    </div>
  )
}

/** Relative pronouns: number and gender only (they match the antecedent); case comes later. */
export function NumGenPicker({ options, onSubmit }: { options: Options; onSubmit: (n: NomForm['n'], g: NomForm['g']) => void }) {
  const [n, setN] = useState<NomForm['n']>()
  const [g, setG] = useState<NomForm['g']>()
  return (
    <div className="form-picker">
      <Group title="Number" values={options.numbers ?? []} labels={NUM_LABEL} value={n} onChange={setN} />
      <Group title="Gender" values={options.genders ?? []} labels={GEN_LABEL} value={g} onChange={setG} />
      <button type="button" className="primary" disabled={!n || !g} onClick={() => n && g && onSubmit(n, g)}>Check</button>
    </div>
  )
}
