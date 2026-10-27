import { useState } from 'react'
import type { Lexicon } from '../core/types.ts'
import { activeIndex, findCompound, isRelative, optionsFor, surfaceOf, tagged, type Answer, type SessionState } from '../core/session.ts'
import type { LookupMode } from '../core/headword.ts'
import { STEM_NAME, STEM_TYPES } from '../core/stems.ts'
import type { UiPos } from '../core/checks.ts'
import { ChoiceStep } from './steps/ChoiceStep.tsx'
import { EndingSelector } from './steps/EndingSelector.tsx'
import { NomFormPicker, NumGenPicker, VerbFormPicker } from './steps/FormPicker.tsx'
import { IdentifyStep } from './steps/IdentifyStep.tsx'
import { LaterPicker, RoleStep } from './steps/RoleStep.tsx'
import { StemSelector } from './steps/StemSelector.tsx'
import { describeAnswer, POS_NAME, segments, STEP_NAME } from './summary.ts'

interface Props {
  st: SessionState
  lex: Lexicon
  onAnswer: (a: Answer) => void
  onNext?: () => void
  mode?: LookupMode
  /** A word opened for review: its answers are listed and any one can be changed. */
  reviewing?: number | null
  onEdit?: (logIndex: number) => void
  onCloseReview?: () => void
  onCancelEdit?: () => void
}

const CASE_OPTIONS = [
  { value: 'nom', label: 'Nominative' }, { value: 'gen', label: 'Genitive' }, { value: 'dat', label: 'Dative' },
  { value: 'acc', label: 'Accusative' }, { value: 'abl', label: 'Ablative' }, { value: 'voc', label: 'Vocative' },
] as const
const STEM_OPTIONS = STEM_TYPES.map((t) => ({ value: t, label: STEM_NAME[t][0].toUpperCase() + STEM_NAME[t].slice(1) }))

function Review({ st, lex, i, onEdit, onClose }: { st: SessionState; lex: Lexicon; i: number; onEdit?: (k: number) => void; onClose?: () => void }) {
  const rows = tagged(st).map((t, k) => ({ ...t, k })).filter((t) => t.word === i)
  return (
    <section className="workbench review" aria-live="polite">
      <h3>Your answers for “{surfaceOf(st.tokens[i])}”</h3>
      {rows.length === 0 && <p className="muted">No answers yet for this word.</p>}
      <ul className="answers">
        {rows.map((r) => (
          <li key={r.k}>
            <span className="step-name">{STEP_NAME[r.step]}</span>
            <span className="step-answer">{describeAnswer(r.a, st, lex)}</span>
            {onEdit && <button type="button" onClick={() => onEdit(r.k)}>Change</button>}
          </li>
        ))}
      </ul>
      <p className="hint">Changing an answer keeps everything after it that still fits. Anything it breaks is marked, and you answer just that part again.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={onClose}>Back to the current question</button>
      </div>
    </section>
  )
}

function EditNotice({ st, onCancel }: { st: SessionState; onCancel?: () => void }) {
  const ed = st.editing
  if (!ed) return null
  const changed = surfaceOf(st.tokens[ed.word])
  if (ed.pristine) {
    return (
      <div className="notice">
        Changing your answer for <strong>{changed}</strong>. The rest of the sentence is kept and checked again after you answer.
        {onCancel && <button type="button" className="link" onClick={onCancel}>Keep my old answer</button>}
      </div>
    )
  }
  const b = ed.broken
  if (b && b.word !== ed.word) {
    return (
      <div className="notice broken" role="alert">
        <strong>Chain broken.</strong> Your change to <strong>{changed}</strong> affects <strong>{surfaceOf(st.tokens[b.word])}</strong>
        {b.reason ? <>: {b.reason}</> : <>, which needs a new answer here.</>}
      </div>
    )
  }
  if (b?.reason) return <div className="notice broken" role="alert">Your earlier answer here no longer fits: {b.reason}</div>
  return <div className="notice">Still carrying your change to <strong>{changed}</strong> through the sentence.</div>
}

function SumUse({ later, wordAt, onPick }: { later: number[]; wordAt: (i: number) => string; onPick: (t: number | null) => void }) {
  const [picking, setPicking] = useState(false)
  if (picking) {
    return <LaterPicker heading="Which later word is the participle?" later={later} wordAt={wordAt} onPick={onPick} onBack={() => setPicking(false)} />
  }
  return (
    <div className="choices">
      <button type="button" onClick={() => onPick(null)}>on its own</button>
      <button type="button" onClick={() => setPicking(true)}>part of a verb with…</button>
    </div>
  )
}

const POS_OPTIONS = (Object.keys(POS_NAME) as UiPos[]).map((p) => ({ value: p, label: POS_NAME[p] }))

export function Workbench({ st, lex, onAnswer, onNext, mode = 'help', reviewing = null, onEdit, onCloseReview, onCancelEdit }: Props) {
  if (reviewing !== null) return <Review st={st} lex={lex} i={reviewing} onEdit={onEdit} onClose={onCloseReview} />
  const i = activeIndex(st)
  const tok = st.tokens[i]
  const w = st.words[i]
  const surface = tok ? surfaceOf(tok) : ''
  const entry = w?.entryId ? lex.entries.get(w.entryId) : undefined
  const options = optionsFor(st, lex)
  const wordAt = (j: number) => surfaceOf(st.tokens[j])
  const isPtc = !!w?.entryId && w.pos === 'V' && w.path === 'nominal'
  const cp = tok ? findCompound(st, i) : undefined

  let title = ''
  let body: React.ReactNode = null

  switch (st.step) {
    case 'identify':
      title = `What word is “${surface}”?`
      body = <IdentifyStep key={`${i}-${mode}`} lex={lex} mode={mode} onPick={(entryId) => onAnswer({ step: 'identify', entryId })} />
      break
    case 'pos':
      title = 'What part of speech is it?'
      body = <ChoiceStep options={POS_OPTIONS} onPick={(pos) => onAnswer({ step: 'pos', pos })} />
      break
    case 'ending':
      title = 'Mark the ending.'
      body = <EndingSelector word={surface} onSubmit={(e) => onAnswer({ step: 'ending', ending: e ?? '' })} />
      break
    case 'nomForm':
      title = 'Case, number, and gender?'
      body = <NomFormPicker options={options} ending={w.ending}
        agreeWord={options.agree ? wordAt(options.agree.from) : undefined}
        onSubmit={(form) => onAnswer({ step: 'nomForm', form })} />
      break
    case 'nomRole': {
      if (isRelative(w)) {
        title = 'What is its function in its own clause?'
        body = <RoleStep kind="noun" options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'nomRole', role })} />
        break
      }
      const kind = w.pos === 'N' ? 'noun' : w.pos === 'ADV' ? 'adverb' : w.pos === 'PRO' ? 'pronoun' : 'adjective'
      title = kind === 'noun' ? 'What is its function?' : kind === 'adverb' ? 'Label it.' : 'What does it do in the sentence?'
      body = <RoleStep kind={kind} participle={isPtc} options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'nomRole', role })} />
      break
    }
    case 'personal':
      title = 'Mark the personal ending.'
      body = <EndingSelector word={surface} onSubmit={(e) => onAnswer({ step: 'personal', ending: e ?? '' })} />
      break
    case 'stem': {
      title = 'Mark the stem.'
      const endLen = [...(w.path === 'finite' ? w.personal ?? '' : w.ending ?? '')].length
      body = <StemSelector word={surface} endLen={endLen} onSubmit={(stem) => onAnswer({ step: 'stem', stem })} />
      break
    }
    case 'stemType':
      title = `Which stem is “${w.stem}-”?`
      body = <ChoiceStep options={STEM_OPTIONS} onPick={(t) => onAnswer({ step: 'stemType', t })} />
      break
    case 'relNG':
      title = 'Number and gender? (They match the antecedent.)'
      body = <NumGenPicker options={options} onSubmit={(n, g) => onAnswer({ step: 'relNG', n, g })} />
      break
    case 'antecedent':
      title = 'Which word is its antecedent?'
      body = (
        <div className="choices">
          {(options.nounTargets ?? []).map((t) => (
            <button key={t} type="button" onClick={() => onAnswer({ step: 'antecedent', target: t })}><em>{wordAt(t)}</em></button>
          ))}
          <button type="button" onClick={() => onAnswer({ step: 'antecedent', target: null })}>No antecedent stated</button>
        </div>
      )
      break
    case 'relCase':
      title = 'What case is it in its own clause?'
      body = <ChoiceStep options={[...CASE_OPTIONS]} onPick={(c) => onAnswer({ step: 'relCase', c })} />
      break
    case 'infEnding':
      title = 'Mark the ending.'
      body = <EndingSelector word={surface} onSubmit={(e) => onAnswer({ step: 'infEnding', ending: e ?? '' })} />
      break
    case 'verbForm': {
      title = 'Parse the verb.'
      // Finite and infinitive are both offered: the check explains a wrong pick.
      body = <VerbFormPicker key={`${i}-vf`} options={options} kinds={['fin', 'inf', 'imp']} start={w.path === 'inf' ? 'inf' : 'fin'} onSubmit={(form) => onAnswer({ step: 'verbForm', form })} />
      break
    }
    case 'verbRole':
      title = 'Label the verb.'
      body = <RoleStep kind="verb" options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'verbRole', role })} />
      break
    case 'compoundForm':
      title = cp ? `Parse “${wordAt(cp.ptc)} ${wordAt(cp.sum)}” together.` : 'Parse the compound verb.'
      body = <VerbFormPicker key={`${i}-cf`} options={options} kinds={['fin', 'inf']} onSubmit={(form) => onAnswer({ step: 'compoundForm', form })} />
      break
    case 'compoundRole':
      title = cp ? `Label the verb “${wordAt(cp.ptc)} ${wordAt(cp.sum)}”.` : 'Label the verb.'
      body = <RoleStep kind="verb" options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'compoundRole', role })} />
      break
    case 'prepCase':
      title = 'What case does this preposition take here?'
      body = <ChoiceStep options={[{ value: 'acc', label: 'Accusative' }, { value: 'abl', label: 'Ablative' }]} onPick={(c) => onAnswer({ step: 'prepCase', c })} />
      break
    case 'conjType':
      title = 'Coordinating or subordinating?'
      body = <ChoiceStep options={[{ value: '+', label: '+', hint: 'coordinating' }, { value: '↓', label: '↓', hint: 'subordinating' }]} onPick={(t) => onAnswer({ step: 'conjType', t })} />
      break
    case 'sumUse':
      title = 'Is this form of sum a verb on its own?'
      body = <SumUse later={options.later ?? []} wordAt={wordAt} onPick={(target) => onAnswer({ step: 'sumUse', target })} />
      break
    case 'clauseBoundary':
      title = 'Does the ↓ clause end after this word?'
      body = <ChoiceStep options={[{ value: 'no', label: 'Clause continues' }, { value: 'yes', label: 'Clause ends here' }]} onPick={(v) => onAnswer({ step: 'clauseBoundary', ends: v === 'yes' })} />
      break
    case 'encliticPos':
      title = `What part of speech is “-${tok.enclitic}”?`
      body = <ChoiceStep options={POS_OPTIONS} onPick={(pos) => onAnswer({ step: 'encliticPos', pos })} />
      break
    case 'encliticConj':
      title = `“-${tok.enclitic}”: coordinating or subordinating?`
      body = <ChoiceStep options={[{ value: '+', label: '+', hint: 'coordinating' }, { value: '↓', label: '↓', hint: 'subordinating' }]} onPick={(t) => onAnswer({ step: 'encliticConj', t })} />
      break
    case 'done':
      title = 'Sentence complete.'
      body = onNext ? <button type="button" className="primary" onClick={onNext}>Next sentence →</button> : <p>That was the last sentence in this set.</p>
      break
  }

  return (
    <section className="workbench" aria-live="polite">
      {entry && st.step !== 'done' && (
        <div className="entry">
          <span className="dict">{entry.dict}</span>
          <span className="def">{entry.definition}</span>
        </div>
      )}
      <EditNotice st={st} onCancel={onCancelEdit} />
      {w && segments(st, i) && st.step !== 'done' && <p className="segments">{segments(st, i)}</p>}
      <h3>{title}</h3>
      <div key={`${i}-${st.step}-${st.log.length}`}>{body}</div>
      {st.error && <p className="error" role="alert">{st.error}</p>}
    </section>
  )
}
