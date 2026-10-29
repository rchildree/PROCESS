import { useState } from 'react'
import { validateSet } from '../core/sets.ts'
import type { Lexicon } from '../core/types.ts'
import { customSet, type CustomText } from './customTexts.ts'

interface Props {
  lex: Lexicon
  onStart: (source: CustomText) => boolean
  onCancel: () => void
}

export function CustomTextForm({ lex, onStart, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  return (
    <form className="custom-text workbench" aria-labelledby="custom-text-heading" onSubmit={(e) => {
      e.preventDefault()
      const source = { id: `custom-${crypto.randomUUID()}`, title: title.trim() || 'My Latin text', text: text.trim() }
      const set = customSet(source, lex)
      if (!set.sentences.length) { setProblems(['Type or paste at least one Latin sentence.']); return }
      const errors = validateSet(set, lex)
      if (errors.length) { setProblems(errors); return }
      if (!onStart(source)) setProblems(['Your browser could not save this text. Allow site storage or free some space, then try again.'])
    }}>
      <h2 id="custom-text-heading">Use your own text</h2>
      <p className="hint" id="custom-text-help">Type or paste Latin prose. End sentences with punctuation or separate them with a blank line. Macrons are optional.</p>
      <label>
        <span>Title <span className="muted">(optional)</span></span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Latin text" maxLength={100} />
      </label>
      <label>
        <span>Latin text</span>
        <textarea autoFocus rows={7} value={text} onChange={(e) => { setText(e.target.value); setProblems([]) }}
          aria-describedby="custom-text-help custom-text-vocabulary" spellCheck={false} required />
      </label>
      <p className="hint" id="custom-text-vocabulary">Uses the app’s Knudsvig vocabulary. We’ll flag unsupported words before you start. Your text and progress are saved in this browser; your text won’t have an answer key.</p>
      {problems.length > 0 && <div className="error" role="alert">
        <p>Check your text:</p>
        <ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>}
      <div className="actions">
        <button type="submit" className="primary" disabled={!text.trim()}>Start parsing</button>
        <button type="button" className="link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
