import { useState } from 'react'
import type { NomForm, VerbForm } from '../../core/checks.ts'
import type { Options } from '../../core/session.ts'

const CASE_LABEL: Record<string, string> = { nom: 'Nom.', gen: 'Gen.', dat: 'Dat.', acc: 'Acc.', abl: 'Abl.', voc: 'Voc.' }
const NUM_LABEL: Record<string, string> = { sg: 'Sg.', pl: 'Pl.' }
const GEN_LABEL: Record<string, string> = { m: 'M.', f: 'F.', n: 'N.' }
const TENSE_LABEL: Record<string, string> = { pres: 'Present', impf: 'Imperfect', fut: 'Future', pf: 'Perfect', plupf: 'Pluperfect', futpf: 'Fut. perf.' }
const MOOD_LABEL: Record<string, string> = { ind: 'Indicative', subj: 'Subjunctive', imp: 'Imperative' }
const VOICE_LABEL: Record<string, string> = { act: 'Active', pass: 'Passive' }

function Group<T extends string>({ title, values, labels, value, onChange, off = [], why, preset = false }: {
  title: string; values: T[]; labels: Record<string, string>; value?: T; onChange: (v: T) => void
  /** The selected value was filled in for the student, not chosen: shown in its own colour until they click. */
  preset?: boolean
  /** Values shown greyed out (still clickable), with `why` as their tooltip. */
  off?: string[]; why?: string
}) {
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      {values.map((v) => {
        const dis = off.includes(v)
        return (
          // Greyed, but still clickable: Check then explains why it does not fit the stem.
          <button key={v} type="button" className={[value === v ? 'on' : '', value === v && preset ? 'preset' : '', dis ? 'off' : ''].filter(Boolean).join(' ') || undefined}
            aria-pressed={value === v} title={dis ? why : undefined} onClick={() => onChange(v)}>{labels[v] ?? v}</button>
        )
      })}
    </fieldset>
  )
}

/** The ending marked on the previous screen, kept in view while case, number, and gender are chosen. */
function EndingNote({ ending }: { ending: string }) {
  return (
    <div className="ending-note">
      <span className="muted">Ending</span>
      <span className="ending-mark">{ending ? `-${ending}` : 'Ø'}</span>
    </div>
  )
}

export function NomFormPicker({ options, ending, agreeWord, onSubmit }: {
  options: Options; onSubmit: (f: NomForm) => void
  /** The ending marked on the previous screen. */
  ending?: string
  /** The earlier modifier this word was linked to, shown in the note about the preset values. */
  agreeWord?: string
}) {
  const start = options.agree?.form
  const [c, setC] = useState<NomForm['c'] | undefined>(start?.c)
  const [n, setN] = useState<NomForm['n'] | undefined>(start?.n)
  const [g, setG] = useState<NomForm['g'] | undefined>(start?.g)
  // Which groups still hold the preselected value the student has not touched.
  const [untouched, setUntouched] = useState({ c: !!start, n: !!start, g: !!start })
  const touch = <T,>(key: 'c' | 'n' | 'g', set: (v: T) => void) => (v: T) => { set(v); setUntouched((u) => ({ ...u, [key]: false })) }
  const ready = c && n && g
  return (
    <div className="form-picker">
      {ending !== undefined && <EndingNote ending={ending} />}
      {start && (
        <p className="notice preset">
          Case, number, and gender preselected based on rules of agreement with <em>{agreeWord}</em>. Verify that the information is correct.
        </p>
      )}
      <Group title="Case" values={options.cases ?? []} labels={CASE_LABEL} value={c} onChange={touch('c', setC)} preset={untouched.c} />
      <Group title="Number" values={options.numbers ?? []} labels={NUM_LABEL} value={n} onChange={touch('n', setN)} preset={untouched.n} />
      <Group title="Gender" values={options.genders ?? []} labels={GEN_LABEL} value={g} onChange={touch('g', setG)} preset={untouched.g} />
      <button type="button" className="primary" disabled={!ready} onClick={() => ready && onSubmit({ c, n, g })}>Check</button>
    </div>
  )
}

type Kind = 'fin' | 'inf' | 'imp'
type Mood = 'ind' | 'subj' | 'imp'

/** Person and number together: singular in the first column, plural in the second. */
function PersonNumber({ persons, numbers, p, n, onChange, only }: {
  persons: VerbForm['p'][]; numbers: VerbForm['n'][]; p?: VerbForm['p']; n?: VerbForm['n']
  onChange: (p: VerbForm['p'], n: VerbForm['n']) => void; only?: VerbForm['p']
}) {
  return (
    <fieldset className="group person-number">
      <legend>Person and number</legend>
      {numbers.flatMap((nn) => persons.map((pp) => {
        const on = p === pp && n === nn
        return (
          <button key={`${pp}${nn}`} type="button" className={on ? 'on' : ''} aria-pressed={on}
            disabled={!!only && pp !== only} onClick={() => onChange(pp, nn)}>{pp}{nn}</button>
        )
      }))}
    </fieldset>
  )
}

/**
 * Finite or infinitive first. A finite verb takes person and number, tense, voice, then mood;
 * imperative is a mood here (second person, present only), offered when `kinds` includes 'imp'.
 */
export function VerbFormPicker({ options, kinds, start, onSubmit }: {
  options: Options; kinds: Kind[]; start?: 'fin' | 'inf'; onSubmit: (f: VerbForm) => void
}) {
  const forms = kinds.filter((x): x is 'fin' | 'inf' => x !== 'imp')
  const [k, setK] = useState<'fin' | 'inf'>(start ?? forms[0] ?? 'fin')
  const [p, setP] = useState<VerbForm['p']>()
  const [n, setN] = useState<VerbForm['n']>()
  const [t, setT] = useState<VerbForm['t']>()
  const [m, setM] = useState<Mood>()
  const [v, setV] = useState<VerbForm['v']>()
  const KIND_LABEL: Record<string, string> = { fin: 'Finite', inf: 'Infinitive' }
  const moods = (options.moods ?? []).filter((x) => x !== 'imp' || kinds.includes('imp'))
  const off = options.disabled
  const imp = k === 'fin' && m === 'imp'
  const ready = k === 'inf' ? t && v : imp ? p === '2' && n && v : p && n && t && m && v
  const pickMood = (x: Mood) => {
    setM(x)
    if (x === 'imp') {
      // An imperative is second person and present: clear anything that cannot go with it.
      if (p && p !== '2') { setP(undefined); setN(undefined) }
      if (t && t !== 'pres') setT(undefined)
    }
  }
  const submit = () => {
    if (!ready) return
    if (k === 'inf') onSubmit({ k, t: t!, v: v! })
    else if (imp) onSubmit({ k: 'imp', t: 'pres', m: 'imp', n, v: v! })
    else onSubmit({ k, p, n, t: t!, m: m as VerbForm['m'], v: v! })
  }
  return (
    <div className="form-picker">
      {forms.length > 1 && <Group title="Form" values={forms} labels={KIND_LABEL} value={k} onChange={setK} />}
      {k === 'fin' && <PersonNumber persons={options.persons ?? []} numbers={options.numbers ?? []} p={p} n={n}
        only={imp ? '2' : undefined} onChange={(pp, nn) => { setP(pp); setN(nn) }} />}
      {imp
        ? <Group title="Tense" values={(options.tenses ?? []).filter((x) => x === 'pres')} labels={TENSE_LABEL} value="pres" onChange={() => {}} />
        : <Group title="Tense" values={options.tenses ?? []} labels={TENSE_LABEL} value={t} onChange={setT} off={off?.tenses} why={off?.why} />}
      <Group title="Voice" values={options.voices ?? []} labels={VOICE_LABEL} value={v} onChange={setV} off={off?.voices} why={off?.why} />
      {k === 'fin' && <Group title="Mood" values={moods} labels={MOOD_LABEL} value={m} onChange={pickMood} off={off?.moods} why={off?.why} />}
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
