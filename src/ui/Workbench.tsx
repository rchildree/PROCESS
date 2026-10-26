import type { Lexicon } from '../core/types.ts'
import { activeIndex, findCompound, optionsFor, surfaceOf, type Answer, type SessionState } from '../core/session.ts'
import type { UiPos } from '../core/checks.ts'
import { ChoiceStep } from './steps/ChoiceStep.tsx'
import { EndingSelector } from './steps/EndingSelector.tsx'
import { NomFormPicker, VerbFormPicker } from './steps/FormPicker.tsx'
import { IdentifyStep } from './steps/IdentifyStep.tsx'
import { RoleStep } from './steps/RoleStep.tsx'
import { POS_NAME } from './summary.ts'

interface Props { st: SessionState; lex: Lexicon; onAnswer: (a: Answer) => void; onNext?: () => void }

const POS_OPTIONS = (Object.keys(POS_NAME) as UiPos[]).map((p) => ({ value: p, label: POS_NAME[p] }))

export function Workbench({ st, lex, onAnswer, onNext }: Props) {
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
      body = <IdentifyStep key={i} lex={lex} onPick={(entryId) => onAnswer({ step: 'identify', entryId })} />
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
      body = <NomFormPicker options={options} onSubmit={(form) => onAnswer({ step: 'nomForm', form })} />
      break
    case 'nomRole': {
      const kind = w.pos === 'N' ? 'noun' : w.pos === 'ADV' ? 'adverb' : w.pos === 'PRO' ? 'pronoun' : 'adjective'
      title = kind === 'noun' ? 'What is its function?' : kind === 'adverb' ? 'Label it.' : 'What does it do in the sentence?'
      body = <RoleStep kind={kind} participle={isPtc} options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'nomRole', role })} />
      break
    }
    case 'personal':
      title = 'Mark the personal ending.'
      body = <EndingSelector word={surface} onSubmit={(e) => onAnswer({ step: 'personal', ending: e ?? '' })} />
      break
    case 'marker':
      title = 'Mark the tense/mood marker, or choose None.'
      body = <EndingSelector word={surface} offset={[...(w.personal ?? '')].length} allowNone onSubmit={(marker) => onAnswer({ step: 'marker', marker })} />
      break
    case 'infEnding':
      title = 'Mark the ending.'
      body = <EndingSelector word={surface} onSubmit={(e) => onAnswer({ step: 'infEnding', ending: e ?? '' })} />
      break
    case 'verbForm': {
      title = 'Parse the verb.'
      const kinds = w.path === 'inf' ? (['inf'] as const) : (['fin', 'imp'] as const)
      body = <VerbFormPicker key={`${i}-vf`} options={options} kinds={[...kinds]} onSubmit={(form) => onAnswer({ step: 'verbForm', form })} />
      break
    }
    case 'verbRole':
      title = 'Label the verb.'
      body = <RoleStep kind="verb" isSum={w.entryId === 'sum-v'} options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'verbRole', role })} />
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
    case 'linkPending':
      title = 'Does an earlier word go with this noun?'
      body = (
        <div className="choices">
          {st.pendingLinkCandidates.map((t) => (
            <button key={t} type="button" onClick={() => onAnswer({ step: 'linkPending', target: t })}><em>{wordAt(t)}</em> goes with it</button>
          ))}
          <button type="button" onClick={() => onAnswer({ step: 'linkPending', target: null })}>No</button>
        </div>
      )
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
    case 'resolvePending': {
      const verb = w.role?.kind === 'aux'
      title = `The sentence is over. What does “${surface}” do?`
      body = verb
        ? <RoleStep kind="verb" resolving options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'resolvePending', role })} />
        : <RoleStep kind={w.pos === 'PRO' ? 'pronoun' : 'adjective'} resolving options={options} wordAt={wordAt} onRole={(role) => onAnswer({ step: 'resolvePending', role })} />
      break
    }
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
      <h3>{title}</h3>
      <div key={`${i}-${st.step}-${st.log.length}`}>{body}</div>
      {st.error && <p className="error" role="alert">{st.error}</p>}
    </section>
  )
}
