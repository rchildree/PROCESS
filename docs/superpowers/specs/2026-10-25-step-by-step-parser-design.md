# Saban: step-by-step Latin sentence parser — design

Date: 2026-10-25

## Intent

A web app that makes students read a Latin sentence the way they are taught to: one word at a
time, left to right, working out everything about each word in a fixed order, with each answer
building on the one before. The app does not translate and does not give answers. It refuses to
let the student move on until the current step is answered with something that *could* be true.

The course is Knudsvig, *Latin for Reading*. Terminology (kernel, S / O / SC, personal ending,
tense/mood marker, kernel types) follows that book and the teacher's existing materials in
`/Users/randallchildree/Documents/Vibes/sentences/`.

## Goals

- Only one word of the sentence is revealed at a time, left to right. Words not yet reached are
  hidden (shown as blanks so the student sees sentence length).
- For each word the student answers a fixed sequence of questions (below). Each step unlocks
  only after the previous one is accepted.
- The app checks **for wrongness, not rightness**: it rejects any answer that is impossible
  given the dictionary data and the student's own earlier answers, and accepts any answer that
  is possible. No per-sentence answer key is required.
- On a rejected answer, the student sees a short reason ("*-ae* in the 1st declension can't be
  ablative") and tries again.
- The teacher publishes titled sentence sets; students pick a set from a menu, then a sentence.

## Non-goals (v1)

- No answer key. A parse that is possible but wrong in context (calling *puellae* dative when it
  is nominative plural) is accepted. An optional answer-key layer may come later; the data model
  should not make it hard to add, but nothing is built for it now.
- No server, no accounts, no logins, no teacher dashboard, no grade reporting.
- No translation step.

## Anti-goals

- Revealing upcoming words, or letting a student skip or reorder steps.
- Showing the correct answer after wrong attempts (it would let students click through).
- Server infrastructure the teacher has to maintain.

## Constraints and decided "how"

- **Stack (decided):** Vite + React + TypeScript, static build, deployed to GitHub Pages via a
  GitHub Actions workflow — same as the teacher's `llm-latin-learning-machine-2` project
  (`.github/workflows/deploy-pages.yml` there is the template).
- **No server (decided).** Everything runs in the browser.
- **Vocabulary data (decided):** the `knudsvig-731` dataset at
  `/Users/randallchildree/Documents/Vibes/llm-latin-learning-machine-2/public/datasets/knudsvig-731/`,
  copied into this project's `public/`. Files:
  - `entries.json` — 732 entries: `id`, `lemma`, `dict` (full dictionary form), `definition`,
    `pos` (n, adj, v, pron, adv, conj, prep, particle, num, phrase, other), `chapter`, `pp`
    (principal parts), `cls` (declension/conjugation, present on 562), `gender` (nouns),
    `genSg` (some 3rd-decl adjectives), `flags`, `morphOverride`.
  - `forms.n.json`, `forms.adj.json`, `forms.pron.json`, `forms.v.json` — every generated
    surface form → lemma id + list of analyses. Nominal analyses: `{c: case, n: number, g: gender}`.
    Verb analyses: `{k: fin|inf|ptc|imp, t, m, v, p, n}`.
  - The `sentences/verify/` scripts (`latindb.py`, `gen.py`) show how the teacher already indexes
    this data, including repairs and additions the raw dataset lacks (declined participles,
    comparatives/superlatives, a blacklist of bad surfaces). The builder should port what is
    needed so the browser index matches what the sentence-writing tooling validates against.
- **Sentence sets (decided):** files in a `sets/` folder in the repo, each with a title. The
  teacher "uploads" by adding a file and pushing; GitHub Pages redeploys and the title appears in
  the student's menu. A build step (or a generated `sets/index.json`) lists the available sets.
  Sets are variable and added as needed; nothing is hard-coded.
- **Set file format:** must accept the teacher's existing lesson Markdown (see
  `sentences/lesson-10-kernel-discrimination.md`): title from the `#` heading, sentences from the
  numbered `**bold**` lines under `### Latin`, English section ignored. Also accept a plain-text
  file: first line title, then one sentence per line. An optional `lesson: N` line orders the set in the menu.
- **Macrons:** sentences are written with macrons and displayed as written. Word lookup must
  ignore macrons and case when the student types.

## The per-word sequence

Display: the sentence as a row of slots. Finished words show the word plus a compact summary of
the student's parse beneath it (e.g. `puerum · N · acc sg m · O`). The current word is
highlighted. Future words are blank.

### Step 1 — Identify the word (all words)
Student types into a search box that filters the vocab list (match lemma and dictionary form,
macron- and case-insensitive). They select an entry; its full `dict` and `definition` are shown.
**Wrong if** the current surface form is not a form of that entry (lookup in the forms tables;
indeclinables match their lemma / slash-alternatives as in `latindb.py`). Proper names or words
not in the dataset: see open questions.

### Step 2 — Part of speech (all words)
Student picks from: Noun, Adjective, Pronoun, Verb, Adverb, Preposition, Conjunction, Other.
**Wrong if** it doesn't match the entry's `pos` (with sensible mapping: num → Adjective,
particle/other → Other). Verb participles: see "Participles and infinitives" below.

### Step 3a — Nouns, adjectives, pronouns
1. **Mark the ending.** The word is shown letter by letter; ← extends a highlight from the end of
   the word leftward, Enter confirms. **Wrong if** the highlighted ending is not a valid ending
   for this entry's declension in a form that produces this surface. The ending tables per
   declension (and per pronoun) are new data the builder writes; stem is derived from the
   genitive (`pp[1]`). Third-declension nominative singulars with no separable ending (*rēx*) are
   accepted with an empty ending (and the whole-word alternative should be considered — builder's
   call, document it).
2. **Case, number, gender.** Three pickers (case; sg/pl; m/f/n). **Wrong if** the triple is not
   among the surface form's analyses for that lemma. Noun gender is fixed by the entry; the app
   rejects a different one.
3. **Function** — labels use the teacher's symbols (see "Function labels" below).
   - **Noun / pronoun used as a noun:** pick **S, O, SC, OC, PP, or ADV**. **Wrong if**
     incompatible with the chosen case: nom → S/SC; acc → O/OC, or PP when inside an
     accusative prepositional phrase; abl → PP when inside a prepositional phrase, otherwise ADV
     (ablative of means, time, etc. is labeled ADV — Claude's reading, teacher to confirm).
     PP is required (and only allowed) when the word is the object of an open prepositional
     phrase (step 3c) and its case matches the preposition's.
   - **Adjective (and demonstratives used adjectivally):** pick one of
     - *modifies* a noun — choose the noun from the already-parsed words, **or** mark
       *noun still to come* (pending);
     - *substantive* — then pick a function as for a noun;
     - *predicate* (SC or OC).
     **Wrong if** the linked noun's parsed case/number/gender (from the student's own earlier
     answers) doesn't agree with the adjective's.
   - **Pending adjectives (adjective before its noun):** when the student finishes parsing a
     later noun, if any pending adjective agrees with it, the app asks "Does any earlier
     adjective go with this noun?" and the student links it (or says no). A sentence cannot be
     finished with an unresolved pending adjective; at the end the student must link it or
     re-label it substantive/predicate.

### Step 3b — Verbs
1. **Mark the personal ending** with ← from the end of the word (e.g. *-t*, *-nt*, *-tur*,
   perfect *-it*, *-ērunt*).
2. **Mark the tense/mood marker** with ← continuing left from the personal ending, or press
   "none" (e.g. *-ba-*, *-bi-*, *-era-*, *-eri-*, *-ā-/-ē-* subjunctive; present and perfect
   indicative have none). **Wrong if** the ending/marker split isn't valid for this conjugation
   and form. Segmentation tables are new data the builder writes, with accepted alternatives
   (e.g. future 3rd conj *-e-* vs *-ē-*).
3. **Person, number, tense, mood, voice.** Pickers. **Wrong if** not among the surface form's
   analyses.
4. **Verb label:** **V** (verb), **PV** (passive verb), **=** (copular verb), **X**
   (existential verb). **Wrong if** PV is chosen for an active form or V for a passive one;
   = and X only for verbs that can be copular/existential (small list the builder writes:
   *sum* and compounds, *fīō*, passives of factitive verbs such as *appellor*, *videor* for =;
   *sum* for X). Factitive verbs are labeled V; their OC is labeled on the complement word.
5. Then the next word.

There is no separate kernel-type step and **labels are not tied to particular verbs** (teacher's
decision): in multi-clause sentences the app does not check which S goes with which verb.

### Compound verb forms (perfect passive *appellātus est*, etc.)
The two words get two slots, parsed separately, then united — the same "pending" mechanism as
adjectives, in either order:
- The participle (*appellātus*) gets the participle steps (ending; case/number/gender), then
  for its function the student may choose **part of a verb — auxiliary still to come**.
- The form of *sum* (*est*) gets the verb steps (personal ending, marker, person/number/…),
  then for its label the student may choose **auxiliary — goes with participle** and links it
  to the pending participle (or, if *est* comes first, marks it pending and links when the
  participle arrives).
- Once linked, the student labels the **united form**: tense, mood, voice, person, number, and
  verb label (normally PV). Checked against the two-word entry in `forms.v.json` (e.g.
  "appellātus est" = pf ind pass 3 sg). The participle's number must match *est*'s.
- Any unresolved pending part at the end of the sentence must be linked or re-labeled (e.g.
  the participle was really adjectival, or *est* was really copular =).
- The same mechanism covers future active / perfect passive infinitives and other periphrastic
  forms the dataset stores as two words; builder enumerates them from `forms.v.json`.

### Function labels (teacher's symbols)
| Label | Meaning |
|---|---|
| S | subject |
| O | object |
| SC | subject complement |
| OC | object complement |
| V | verb |
| PV | passive verb |
| = | copular verb |
| X | existential verb |
| PP | prepositional phrase (the phrase as a whole) |
| ADV | adverb / adverbial |
| + | coordinating conjunction |
| ↓ | subordinating conjunction |

Dative and genitive uses (Lessons 16–17) have no label yet; the builder should make the label
list data-driven so labels can be added without code changes.

### Step 3c — Prepositions
Label **PP**, then pick the case the preposition takes (from the entry's definition, e.g.
"(prep. + abl.)"; some take two). This opens a prepositional phrase: the following words are
visually grouped with it. Nouns/adjectives inside it in that case are labeled PP. The phrase
closes automatically once its object noun is parsed (builder's call on how to handle adjectives
that follow the noun, e.g. *magnā cum cūrā*, *in agrō magnō*).

### Step 3d — Conjunctions
Pick **+** (coordinating) or **↓** (subordinating). This is right-or-wrong, from a small lookup
list the builder writes (many entries already say "(coord. conj.)" in `definition`).

**Subordinate clauses:** choosing ↓ starts a subordinate clause. Every following word is shown
in a different color until the student marks the end of the clause: after each word in the
clause, a **"subordinate clause ends here"** control is available. **Wrong if** the student
tries to close the clause before it contains a finite verb, or reaches the end of the sentence
without closing it (the last word can close it). Nested ↓ clauses stack, each with its own color
(Claude's call).

### Step 3e — Adverbs, particles, other
Adverbs: label **ADV**. Particles/other: POS only, then move on.

### Participles and infinitives
`forms.v.json` tags these as `k: ptc` / `k: inf`. Participles: after POS = Verb (or Adjective —
builder decides which to accept and documents it), treat like an adjective for ending,
case/number/gender, and function, plus tense and voice. Infinitives: personal-ending step is
replaced by marking the infinitive ending; then tense and voice. These appear from Lesson 9 on in
the teacher's sets.

## Grammar ceiling by lesson

Not used (teacher's decision, 2026-10-25): all options are always available. A set's lesson number only orders the menu.

## Progress

Progress within a sentence is kept in the browser (localStorage) so a refresh doesn't lose work.
Finished sentences are marked done in the menu on that device. No other persistence.

## Calls made by Claude (teacher to check)

- **Enclitics (*-que*, *-ne*, *-ve*):** the host word and the enclitic share one slot. The host
  word is parsed first, then the enclitic gets its own steps (POS = Conjunction → coordinating
  for *-que*/*-ve*; *-ne* = particle).
- **Words missing from the dataset:** a set validator runs at build time and fails the build,
  naming the word, so a student can never get stuck partway through. A set may list extra
  glossed words (lemma, dictionary form, definition, POS) for one-off proper names.
- **What counts as a set:** each `## Lesson N` section in a multi-lesson file
  (`latin-sentences-by-lesson.md`) is its own set, titled "Lesson N". A single-lesson file is one set. Prose stories with no numbered bold
  lines (`lesson-11-story-crassus-carbo.md`) are split into sentences at `.`, `?`, `!`, `;` and
  kept in order as one set.
- **Pronouns:** offered both noun use (function picker) and adjective use (modifies a noun),
  like adjectives.
- **Forms created by `gen.py` without analyses:** the builder adds the analyses when porting.

## Left to the builder

- Component structure, state management, styling (clean, readable, works on a laptop; phones
  are not a priority but shouldn't break).
- Exact wording of error messages (short, specific, never giving away the answer).
- Exact ending and segmentation tables, provided they follow standard Knudsvig/textbook
  analysis and accept common alternatives.
- How the sets index is generated.
- Tests for the checking logic (it is the core of the app and must be unit-tested against real
  sentences from the teacher's lesson files).
