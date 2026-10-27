# Look-ahead and Forward Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the whole sentence, let students link a word to a later word when they decide, and parse two-word verbs once.

**Architecture:** All rules live in the pure reducer `src/core/session.ts`. Forward links are stored on the earlier word's role (`modifies` / `verbPart` / `aux` with a target after it). The later word looks for incoming links (`incomingLinks(st, j)`) at identify, part of speech, nomForm and finish. The "comes later" roles, `linkPending`, `resolvePending` and `resolving` are removed. The UI drops hidden blanks and adds a later-words picker.

**Tech Stack:** TypeScript, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-look-ahead-and-forward-links-design.md`

## Global Constraints

- Option wording on both words of a two-word verb: **"part of a verb with"**.
- Clicking a word in the sentence only means review, and only for parsed words.
- The later-words list is every word after the current one, unfiltered.
- No migration of saved progress; old saves stop replaying at the first answer that no longer fits.

## Review Focus

1. Editing an earlier answer (review → change) with a forward link: re-applied answers must still pass the later word's link checks. Test: change the adjective's form so it no longer agrees → the noun's finishing answer is marked broken.
2. Indeclinable adjective (*decem*) linked forward: there is no form, so only the noun-like check applies. Test in Task 1.
3. *est* identified as *edō* after a participle linked to it → rejected at identify. Test in Task 2.
4. *sum* first inside a ↓ clause: saying "clause ends" right after *est* is allowed, because *est* marked the clause finite. Test in Task 2.
5. A later word linked as a noun and answered as V at part of speech → rejected at pos with the adjective's name. Test in Task 1.

---

### Task 1: Forward links for adjectives; remove pending machinery

**Files:**
- Modify: `src/core/session.ts`
- Test: `tests/core/session.test.ts`, `tests/core/review-fixes.test.ts`

**Interfaces:**
- Produces:
  - `Role` without `pendingNoun`; `verbPart`/`aux` keep an optional `target` until Task 2.
  - `StepId` without `linkPending`, `resolvePending`.
  - `SessionState` without `resolving` and `pendingLinkCandidates`.
  - `activeIndex(st)` returns `st.current` (kept for callers).
  - `Options.later?: number[]` (indices after the current word).
  - `incomingLinks(st: SessionState, j: number): { from: number; kind: 'noun' | 'sum' | 'ptc' }[]`, exported.

- [ ] **Step 1: Rewrite the tests.**
  - `L10_2_ANSWERS` uses `{ kind: 'modifies', target: 2 }` and `{ kind: 'modifies', target: 5 }` in place of pendingNoun, and has no linkPending answers. The existing expectations hold.
  - Do the same in the L10 #8 test (`is` → `{ modifies, target: 2 }`) and the numerals test (`decem` → `{ modifies, target: 1 }`).
  - Replace "pending must resolve" with these:
    - `'forward link is checked when the noun finishes'`: *magnus puerum videt*. magnus nom sg m → modifies 1. puerum's nomRole O is rejected with an error matching `/magnus/` and `/case/`.
    - `'forward link to a word that cannot agree is refused at once'`: *magnus puellās* (or any later word with no nom sg m reading). The error matches `/cannot agree/`.
    - `'word linked as a noun must be N, ADJ or PRO'`: an adjective modifies a later verb. At the verb, `pos: 'V'` gives an error matching the adjective's surface.
    - `'changing an earlier answer breaks a forward link'`: from the L10_2 state, `startEdit` on timidum's nomForm answer, then submit `acc sg f`. Expect `st.editing.broken.word === 2`.
- [ ] **Step 2: Run `npx vitest run tests/core` and confirm the new tests fail.**
- [ ] **Step 3: Implement.**
  - `checkNominalRole` `modifies`: when `target > i`, the later surface must have some `lex.lookup` reading with `c/n/g` equal to the adjective's form. Skip this when there is no form. Error: "That word cannot agree with this adjective." Otherwise the existing earlier-word checks apply.
  - Remove pendingNoun, linkPending, resolvePending, nextUnresolved, isUnresolved and afterNounLike. `advance` at the last word goes to `'done'`.
  - `apply('pos')`: if an incoming `noun` link exists and pos ∉ {N, ADJ, PRO}, fail with "“X” was linked to this word as its noun."
  - `finishWord`, before anything else: for each incoming `noun` link, require `isNounLike` and `checkAgreement` (when both forms exist). Fail with "“X” goes with this word, but they do not agree in case." (use checkAgreement's reason, lower-cased).
  - The `drain` filter keeps `t.word >= cur.current`.
  - `optionsFor('nomRole')`: `nounTargets` are earlier noun-like words only; `later` = all indices after i.
- [ ] **Step 4: Run `npx vitest run` and confirm everything passes** (UI tests may need the types from Task 3, so stub compile errors there minimally if needed).
- [ ] **Step 5: Commit** `feat(core): link adjectives to later nouns; drop pending steps`.

### Task 2: Two-word verbs with forward links and the sum-use step

**Files:**
- Modify: `src/core/session.ts`
- Test: `tests/core/session.test.ts`

**Interfaces:**
- Consumes: `incomingLinks` from Task 1.
- Produces:
  - `verbPart`/`aux` roles with a required `target: number`.
  - New step `'sumUse'` and answer `{ step: 'sumUse'; target: number | null }` (null = on its own).
  - `optionsFor('sumUse')` → `{ later }`.

- [ ] **Step 1: Write the tests.**
  - Rewrite L10 #8 (participle first). The participle's nomRole is `{ kind: 'verbPart', target: 8 }`. Then for *est*: identify `sum-v`, pos V, then **straight** to compoundForm `pf pass 3 sg`, then compoundRole PV. Expect done, and `words[7].compound` toMatchObject `{ ptc: 7, sum: 8, label: 'PV' }`.
  - `'sum first: est appellātus'`: sentence *Carbō est appellātus.* After *est* pos V, the step is `'sumUse'`. Submit target 2 → the word is done, with role `{ aux, target: 2 }` and no personal step. The participle does ending/stem/stemType/nomForm, then the step is `'compoundForm'`, then compoundRole → done.
  - `'sumUse null takes the normal verb path'`: step becomes `'personal'`.
  - `'participle link to a word that is not sum is refused'`: error `/one verb form/`.
  - `'later word linked as sum must be identified as sum'`: identify `edo-v` (if it exists in the lexicon; otherwise any non-sum entry for the surface) is rejected.
  - `'sum first in a ↓ clause marks the clause finite'`: *ubi est appellātus* style; after *est* is linked, `clauseBoundary` `ends: true` is not rejected for lack of a finite verb.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
  - **Participle nomRole `verbPart`:** target must be > i and `compoundForms(lex, ptcEntry, ptcSurf, laterSurf).length > 0`. Store `compound: { ptc: i, sum: target }` and finish the word.
  - **identify:**
    - Incoming `sum` link (a participle pointing here) → entry must be `sum-v`, error "“X” was linked to this word as part of a verb with a form of sum."
    - Incoming `ptc` link (an aux pointing here) → `compoundForms(entry, surf, sumSurf)` must be non-empty.
  - **pos:**
    - Incoming verb link → must be V.
    - With an incoming `sum` link: set role `{ aux, target: p }`, `path: 'none'`, go to `'compoundForm'`.
    - Plain `sum-v` with no incoming link → `'sumUse'`.
  - **sumUse:**
    - null → the usual finite path (`'personal'`).
    - A target → it must be later, and some `lex.lookup(laterSurf)` reading with `k: 'ptc'` must give a non-empty `compoundForms`. Set role `{ aux, target }`, `path: 'none'`, `compound` on neither word yet. If this *sum* surface has a `fin` reading, `markFinite`. Then finish.
  - **nomForm:** with an incoming `ptc` link, set role `{ verbPart, target: s }` and `compound: { ptc: i, sum: s }`, then go to `'compoundForm'`.
  - **compoundRole:** `markFinite` only when the *sum* is the current word (participle first).
  - Remove the "earlier waiting" target options and checks.
- [ ] **Step 4: Run `npx vitest run tests/core` and confirm it passes.**
- [ ] **Step 5: Commit** `feat(core): two-word verbs link forward; sum asks on its own or part of a verb`.

### Task 3: UI — whole sentence, later-words picker, sum-use step

**Files:**
- Modify: `src/ui/SentenceView.tsx`, `src/ui/steps/RoleStep.tsx`, `src/ui/Workbench.tsx`, `src/ui/summary.ts`, `src/ui/styles.css`
- Test: `tests/ui/Workbench.test.tsx`

**Interfaces:**
- Consumes: `Options.later`, the `'sumUse'` step, and roles with required targets.
- Produces: `LaterPicker({ later, wordAt, onPick, onBack })` in `RoleStep.tsx`.

- [ ] **Step 1: Write the tests.**
  - At an adjective's nomRole, clicking "its noun comes later" shows a button per later word. Clicking one submits `{ modifies, target }`.
  - At the *sum* `sumUse` step, the buttons "on its own" and "part of a verb with…" show.
  - The SentenceView renders every token's text, with no `.hidden` slot.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
  - **SentenceView:** always show the word text. Words after `current` get class `ahead` (muted colour in CSS), no parse, not clickable. Draw `modifies` arcs only once the target is `done`. Ghost parse during an edit is unchanged.
  - **RoleStep:**
    - Adjective: "its noun comes later" opens `LaterPicker`, with ← back.
    - Participle section: heading "Part of a verb with a form of sum". Button "part of a verb with…" opens `LaterPicker`, giving `{ verbPart, target }`.
    - Remove the verb-kind aux section and the `isSum`/`resolving` props.
  - **Workbench:**
    - Add the `sumUse` case. Title: "Is this form of sum a verb on its own?" Buttons: "on its own", and "part of a verb with…" → `LaterPicker`.
    - Remove the linkPending/resolvePending cases.
  - **summary.ts:**
    - Remove pendingNoun.
    - roleText for verbPart/aux: `part of a verb with X`.
    - STEP_NAME `sumUse: 'On its own or part of a verb'`.
    - describeAnswer for sumUse.
- [ ] **Step 4: Run `npx vitest run` and `npx tsc --noEmit` and confirm both are clean.**
- [ ] **Step 5: Check in the browser** (`preview_start` "dev"):
  - L11 Crassus sentence 2 (*appellātus est*): parse through the two-word verb.
  - An adjective-before-noun sentence: link forward and see the arc after the noun.
- [ ] **Step 6: Commit** `feat(ui): show whole sentence; pick later words for forward links`.
