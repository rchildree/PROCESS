# Look-ahead and forward links — design

## Why

Students are asked to decide things that depend on words they cannot yet see: which noun an
adjective goes with, whether a participle is half of a verb, whether *est* is a helper. Today
later words are blanks, so the student answers "comes later", and the app collects the loose
ends afterwards (a "does any earlier adjective go with this noun?" question, and an
end-of-sentence clean-up). Two-word verbs (*appellātus est*) are the clumsiest case: the
participle is parsed, then *est* gets its own full parse (personal ending, stem, person,
number, …), then the student picks the combined form again.

The teacher's decision: **looking ahead is fine; working one word at a time, in order, stays.**

## Goals

1. The whole sentence is visible from the start.
2. A student can link a word to a *later* word at the moment they decide, instead of saying
   "comes later" and coming back.
3. A two-word verb has its form picked once, and the form of *sum* is not parsed on its own.

## Non-goals

- No peek button. Words are simply visible.
- No change to the order of work: the current word, then the next.
- No change to the printable worksheet.
- No narrowing of the later-words list by part of speech (that would give away answers).

## Anti-goals

- Clicking a word in the sentence must keep meaning only "review this word". Forward links are
  never chosen by clicking the sentence.

## What changes

### 1. The sentence

- Every word is shown from the start. The current word is highlighted as now.
- Words not reached yet show their text only: no label, no parsing, and they are not
  clickable. Clicking stays "review", for parsed words only, as now.

### 2. Adjective before its noun

- In the adjective's "modifies" choice, the earlier nouns stay as they are. The old
  **"its noun comes later"** button now opens a list of **all later words** (as buttons, in the
  question panel). The student picks one.
- The role stored is `modifies` with a target after the adjective.
- **Checks:**
  - At once (when picked): the later word must be able to be a noun-like form that agrees with
    the adjective's case, number and gender — any analysis of its surface in the lexicon will do.
    Otherwise: "That word cannot agree with this adjective."
  - When the later word is finished: it must have been used as a noun (`isNounLike`) and its
    parsed case/number/gender (the student's own answers) must agree. If not, the answer that
    finished that word is rejected with a reason that names the adjective, e.g. "*magnā* goes
    with this word, but they do not agree in case." The student fixes the later word's answers,
    or reviews the adjective and changes it.
- The arc from the adjective to its noun is drawn once the noun is finished.

### 3. Two-word verbs

The option wording on **both** words is **"part of a verb with"**.

**Participle comes first (*appellātus est*):**
- The participle keeps its own steps: ending, then case/number/gender (gender only shows here).
- Its role choice "part of a verb with" offers the **later words** list. (The old "form of sum
  comes later" button goes; an earlier unlinked *sum* can no longer exist.)
- Check at once: the two words must make a verb form together (`compoundForms` is non-empty).
  Otherwise: "These two words do not make one verb form."
- At the form of *sum*: after identify (and part of speech), the app sees the link already
  made, skips the early question and the solo parse, shows that it is part of a verb with
  *appellātus*, and asks the **combined form**, then the **verb label** (normally PV).

**Form of *sum* comes first (*est appellātus*):**
- New step right after the student marks *sum* as a verb: **"on its own"** or
  **"part of a verb with"** → later words list.
  - "On its own" → the usual verb steps (personal ending, stem, form, label).
  - "Part of a verb with" → check at once that some reading of the later word is a participle
    that combines with this *sum* (`compoundForms` non-empty). Then the word is finished: no
    personal ending, stem, form or label.
- At the participle: its own steps (ending, case/number/gender), then the app skips the role
  question (the link is known) and asks the combined form, then the verb label.

**In both orders** the combined form and its label are asked once, at whichever word comes
second. The combined form counts as the clause's finite verb when it is finite (as now).

To correct a wrong link, the student reviews the earlier word and changes its answer (the
existing review-and-change flow).

### 4. What goes away

- The "does any earlier adjective go with this noun?" step (`linkPending`).
- The end-of-sentence clean-up (`resolvePending`, `resolving`) — nothing can be left waiting.
- The "comes later" roles with no target (`pendingNoun`, `verbPart`/`aux` without a target).
- *sum* linking back to an earlier waiting participle, and a participle linking back to an
  earlier waiting *sum*.

### 5. When the later word does not fit (Claude's calls)

Mismatches are caught at the earliest step that shows them, with a reason that names the
earlier word, so the student is never stuck at a step that is not about the mistake:

- **Linked as a noun:** at part of speech, the later word must be N, ADJ or PRO; otherwise
  "*magnā* was linked to this word as its noun." When it finishes it must be used as a noun and
  agree (section 2).
- **Linked as the *sum* of a participle:** at identify, the word must be *sum*; at part of
  speech, V.
- **Linked as the participle of a *sum*:** at identify, the entry must make a verb form with
  that *sum* (`compoundForms` non-empty); at part of speech, V.

The immediate check for an adjective's later noun counts **any** reading that has case, number
and gender (noun, adjective, pronoun, participle), because an adjective can point to a word
used as a noun.

**Clauses:** when *sum* comes first and is linked, its clause counts as having its finite verb
at once if that *sum* form is finite (*est*, not *esse*); the participle then does not mark a
clause again. Links across a clause boundary are not checked (labels are not tied to
particular clauses today either).

**Review:** while an earlier answer is being changed, later words keep showing their old parse
faintly, as now.

## Constraints

- The step logic is a pure reducer (`src/core/session.ts`) with replay and edit-and-reapply.
  Forward links must survive replay and the review-and-change flow: changing an earlier answer
  re-applies the later ones; a link to a later word is just part of the earlier answer.
- Saved progress is a list of answers in `localStorage`. Old saves that contain removed steps
  stop replaying at that answer and the student continues from there. No migration.

## Left to the builder

- Step and role names, and how a word records that an earlier word linked to it.
- Exact error wording beyond the samples above.
- Whether the "on its own / part of a verb with" step is a new step id or folded into an
  existing one, as long as it comes before any personal-ending step.
- How to show a word that is "part of a verb with" a later word in the summary under it.
- Which tests to rewrite; the old pending tests are replaced by forward-link tests in both
  orders, plus the agreement failure at the later word.
