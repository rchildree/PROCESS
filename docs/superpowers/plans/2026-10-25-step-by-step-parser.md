# Saban Step-by-Step Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app where students parse a Latin sentence one word at a time through a fixed sequence of questions, with every answer checked for *impossibility* against the knudsvig-731 dataset and the student's own earlier answers.

**Architecture:** All checking logic lives in framework-free TypeScript under `src/core/` (lexicon, endings, checks, session state machine), unit-tested with Vitest against the real dataset. A Node build script (`scripts/build-sets.ts`, run with `tsx`) turns teacher files in `sets/` into JSON and fails the build on any unknown word, reusing `src/core`. A thin React UI under `src/ui/` drives the session reducer.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, @testing-library/react, tsx, GitHub Pages via Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-step-by-step-parser-design.md`

## Global Constraints

- No lesson-based filtering of answer choices: every case, number, person, tense, mood, voice is always offered (teacher's decision). A set's `lesson` number is kept only for sorting the menu.

- No server, no accounts. Static build only; deploy target is GitHub Pages.
- Vite `base: './'`; all runtime fetches use relative URLs (`./data/...`, `./sets/...`) so the repo name never matters.
- Dataset copied verbatim from `/Users/randallchildree/Documents/Vibes/llm-latin-learning-machine-2/public/datasets/knudsvig-731/` to `public/data/knudsvig-731/`.
- Checking rule everywhere: reject only what is impossible; accept anything possible. Never reveal the correct answer.
- Error messages: one short sentence naming why the choice is impossible, never naming the right choice.
- Macron- and case-insensitive comparison for student search input and for ending/marker comparison; sentences are displayed exactly as written.
- Function labels (data-driven, `src/core/data/labels.ts`): `S, O, SC, OC, V, PV, =, X, PP, ADV, +, ↓`.
- Words not yet reached are never rendered (blank slots sized to sentence length only).
- localStorage keys prefixed `saban:v1:`; every access wrapped in try/catch.

## Review Focus

1. **Feminine/neuter perfect passives** (*īnstrūcta est*, *frācta est*): the dataset's two-word table only has masculine forms; uniting must normalize the participle before lookup → Task 5 test `compound accepts feminine participle`.
2. **Sentence-initial capitals and proper names** (*Caesare*, *Crassus*): lookup must fall back to lower-case first letter and still find capitalized proper-noun entries → Task 2 test `lookup handles capitalized first word`.
3. **Words that look like enclitics but aren't** (*neque, itaque, quoque, atque*): must not be split → Task 3 test `tokenize does not split real words ending in que`.
4. **Refresh mid-sentence**: progress must survive reload and replay to the same step → Task 8 test `replay restores step`.
5. **Ambiguous forms where only one reading is right in context** (*puellae*): every analysis must be accepted at every step, including agreement checks downstream → Task 7 test `ambiguous form accepted then agreement uses chosen reading`.

---

### Task 1: Project scaffold, dataset copy, deploy workflow

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx` (placeholder), `.gitignore`, `.github/workflows/deploy-pages.yml`, `public/data/knudsvig-731/*` (copied), `tests/smoke.test.ts`

- [ ] **Step 1:** `git init`; scaffold Vite React-TS by hand (no interactive CLI). Dev deps: `vitest`, `@testing-library/react`, `jsdom`, `tsx`, `@types/node`. Scripts:
  - `"sets": "tsx scripts/build-sets.ts"` (script created in Task 3; until then a stub that writes `public/sets/index.json` as `[]`)
  - `"predev": "npm run sets"`, `"dev": "vite"`, `"prebuild": "npm run sets"`, `"build": "tsc -b && vite build"`, `"test": "vitest run"`.
  - `vite.config.ts`: `base: './'`, Vitest `environment: 'jsdom'` for `*.tsx` tests (node default otherwise).
- [ ] **Step 2:** Copy the dataset directory. Copy `.github/workflows/deploy-pages.yml` from `llm-latin-learning-machine-2` unchanged (it builds `dist/` on push to `main`). `.gitignore`: `node_modules`, `dist`, `public/sets/`.
- [ ] **Step 3: Smoke test** `tests/smoke.test.ts`: reads `public/data/knudsvig-731/manifest.json` via `fs` and asserts `stats.entries === 732`.
- [ ] **Step 4:** Run `npm test` → PASS; `npm run build` → succeeds.
- [ ] **Step 5:** Commit `chore: scaffold vite app with knudsvig-731 dataset`.

---

### Task 2: Types, normalization, lexicon (port of `latindb.py` + `gen.py`)

**Files:**
- Create: `src/core/types.ts`, `src/core/normalize.ts`, `src/core/lexicon.ts`, `src/core/generate.ts`, `src/core/loadDataset.node.ts`, `src/core/loadDataset.browser.ts`
- Test: `tests/core/lexicon.test.ts`, `tests/helpers/lex.ts` (builds the lexicon once from `public/data` for all tests)

**Interfaces — Produces:**
```ts
// types.ts
type Pos = 'n'|'adj'|'v'|'pron'|'adv'|'conj'|'prep'|'particle'|'num'|'phrase'|'other';
type Case = 'nom'|'gen'|'dat'|'acc'|'abl'|'voc'; type Num = 'sg'|'pl'; type Gender = 'm'|'f'|'n';
type Tense = 'pres'|'impf'|'fut'|'pf'|'plupf'|'futpf'; type Mood = 'ind'|'subj'|'imp'; type Voice = 'act'|'pass';
type Person = '1'|'2'|'3';
interface Entry { id: string; chapter: number; lemma: string; dict: string; definition: string; pos: Pos;
  pp: (string|null)[]; cls?: string; gender?: string; genSg?: string; flags: string[] }
interface NomAnalysis { k: 'nom'; c: Case; n: Num; g: Gender }
interface VerbAnalysis { k: 'fin'|'inf'|'ptc'|'imp'|'ger'; t?: Tense; m?: Mood; v?: Voice; p?: Person; n?: Num; c?: Case; g?: Gender }
type Analysis = NomAnalysis | VerbAnalysis;
interface Candidate { entryId: string; pos: Pos; analyses: Analysis[] } // [] for indeclinables
interface RawDataset { entries: Entry[]; forms: Record<'n'|'adj'|'v'|'pron', {s: string; l: string; a: Analysis[]}[]> }
type Check = { ok: true } | { ok: false; reason: string };
// normalize.ts
stripMacrons(s: string): string            // ā→a … also ӯ/ȳ→y
searchKey(s: string): string               // stripMacrons + lowercase
// lexicon.ts
interface Lexicon { entries: Map<string, Entry>; lookup(surface: string): Candidate[]; search(query: string, limit?: number): Entry[] }
buildLexicon(raw: RawDataset): Lexicon
withGlosses(lex: Lexicon, glosses: Gloss[]): Lexicon   // adds entries with id `gloss:<lemma>`, indeclinable-style (no analyses)
// loaders
loadDatasetFromDir(dir: string): RawDataset            // node, fs
fetchDataset(baseUrl: string): Promise<RawDataset>     // browser, fetch manifest then files
```

- `lookup`: union of forms tables + indeclinables (pos in adv, conj, prep, particle, other, num, phrase; lemma plus slash-alternatives of `dict` when `dict` has `/` and no space; leading `-` stripped so `que` indexes) + generated forms; tries the surface as given, then with first letter lower-cased; de-duplicates by `entryId`, merging analyses.
- `generate.ts` ports `sentences/verify/gen.py` and **attaches analyses** (gen.py only records lemma ids):
  - Declined participles from every `k:'ptc'` nominative ending `-us` (and from two-word heads): use the `E12` order from gen.py — m sg nom gen dat acc abl voc, m pl nom gen dat acc abl, f sg nom gen dat acc abl, f pl nom gen dat acc abl, n sg nom gen dat acc abl, n pl nom gen dat acc abl. Analysis `{k:'ptc', t, v, c, n, g}` copying `t`/`v` from the source participle (`-tus` pf pass, `-tūrus` fut act, `-ndus` fut pass). Identical surfaces from different slots simply accumulate analyses; vocative = nominative except m sg `-e`.
  - Present participles `-ns` with the shortening rule and `E3PTC` order (nom sg all genders + n acc sg, gen, dat, acc m/f, abl `-nte`, abl `-ntī`, nom pl m/f, gen pl, dat pl, acc pl m/f, abl pl, n nom/acc pl `-ntia`), `t:'pres', v:'act'`.
  - Gerunds from `-ndus`: `{k:'ger', c, n:'sg', g:'n'}` for gen/dat/acc/abl.
  - Comparatives (`CMP_M`, `CMP_N`) and superlatives (`E12` on the superlative base) as `k:'nom'` with an extra field `deg: 'cmp'|'sup'` on NomAnalysis (add `deg?: 'cmp'|'sup'` to the type). Superlative adverbs → indeclinable adverb candidates.
  - Future active participles from parenthesized 4th principal parts; multiword-conjunction tokens; `_STILL_ABSENT` (`domī` → `{k:'nom', c:'loc'...}` add `'loc'` to Case).

- [ ] **Step 1: Write failing tests** (`tests/core/lexicon.test.ts`):
  - `lookup aciēs` → one candidate `acies-n` whose analyses include `{c:'acc', n:'pl', g:'f'}`.
  - `lookup puellae` → `puella-n` analyses exactly gen sg, dat sg, nom pl, voc pl (f).
  - `lookup handles capitalized first word`: `lookup('Fūr')` returns `fur-n`; `lookup('Caesare')` returns the Caesar entry.
  - `indeclinables`: `lookup('ā')` and `lookup('ab')` include `a-prep`; `lookup('que')` includes `que-conj`.
  - `generated participle`: `lookup('īnstrūcta')` includes the instruo entry with `{k:'ptc', t:'pf', v:'pass', c:'nom', n:'sg', g:'f'}`.
  - `generated comparative`: some candidate for `fortior` has `deg:'cmp'`.
  - `search('puer')` returns `puer-n` first; `search('amo')` finds `amo-v` (macron-insensitive).
- [ ] **Step 2:** Run `npx vitest run tests/core/lexicon.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the interfaces above. `search` ranks: exact lemma key match, then lemma prefix, then `dict` substring; default limit 20.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat(core): lexicon with generated forms and analyses`.

---

### Task 3: Set files, tokenizer, build-sets script with validation

**Files:**
- Create: `src/core/sets.ts`, `scripts/build-sets.ts`, `sets/lesson-9-short-phrases.md`, `sets/lesson-10-kernel-discrimination.md`, `sets/lesson-11-story-crassus-carbo.md` (copied from `/Users/randallchildree/Documents/Vibes/sentences/`)
- Test: `tests/core/sets.test.ts`

**Interfaces — Consumes:** `Lexicon` (Task 2). **Produces:**
```ts
interface Token { index: number; surface: string; host?: string; enclitic?: 'que'|'ne'|'ve'; punctAfter?: string; punctBefore?: string }
interface SetSentence { text: string; tokens: Token[] }
interface Gloss { lemma: string; dict: string; definition: string; pos: Pos }
interface SentenceSet { id: string; title: string; lesson?: number; sentences: SetSentence[]; glosses?: Gloss[] }
interface SetIndexItem { id: string; title: string; lesson?: number; count: number; file: string }
tokenize(text: string, isKnown: (w: string) => boolean): Token[]
parseSetFile(filename: string, text: string, isKnown: (w: string) => boolean): SentenceSet[]
validateSet(set: SentenceSet, lex: Lexicon): string[]   // list of problems, empty = valid
```
Rules:
- Markdown: title from first `# ` heading. If the file has multiple `## Lesson N` sections, emit one set per section titled `Lesson N` with `lesson: N`; otherwise one set. Single-section files get `lesson` from a `lesson: N` line or a single `## Lesson N` heading. Under `### Latin`: numbered `**bold**` lines are sentences; if none, the paragraph text is split into sentences after `.`, `?`, `!`, `;` (keeping quotes attached). In multi-lesson files, sentence lines are `N. **Latin** — English`; take the bold part.
- Plain `.txt`: line 1 title, optional `lesson: N`, then one sentence per line.
- Optional glosses: a `glosses:` block of `lemma | dict | definition | pos` lines (md or txt); glossed words count as known and are added to the lexicon at runtime.
- `id` = slug of filename (+ `-lesson-N` for multi-lesson files).
- Tokenizer: split on whitespace; peel punctuation (`, . ; : ? ! " “ ” ' ( )`) into `punctBefore`/`punctAfter`. Enclitic split only when the whole word is **not** known and `word.slice(0,-k)` **is** known (k = length of que/ne/ve).
- `build-sets.ts`: load dataset with `loadDatasetFromDir`, build lexicon, parse every file in `sets/`, run `validateSet`; on any problem print `file: sentence N: "word" not found` and `process.exit(1)`; else write `public/sets/<id>.json` and `public/sets/index.json` (sorted by lesson, then title).

- [ ] **Step 1: Failing tests:**
  - `tokenize does not split real words ending in que`: tokens of `neque itaque quoque atque` have no `enclitic`.
  - `tokenize splits hōramque`: one token, `host:'hōram'`, `enclitic:'que'`.
  - `punctuation peeled`: `ait: "sī homō` → tokens `ait` (punctAfter `:`), `sī` (punctBefore `"`), `homō`.
  - `lesson-10 file`: one set, title `Lesson 10 — Kernel Discrimination and Demonstrative Forms`, `lesson: 10`, 10 sentences, sentence 1 text `ille puer ā populō dux appellātus est.`.
  - `lesson-11 story`: 10 sentences; sentence 7 contains `ait`.
  - `multi-lesson`: parsing a fixture with `## Lesson 1` and `## Lesson 2` sections yields 2 sets with lessons 1 and 2.
  - `validateSet` reports a made-up word `blorpus` and nothing for the three real set files.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. If a real set file fails validation, fix the lexicon port (Task 2 code), not the set file.
- [ ] **Step 4:** Run tests → PASS; `npm run sets` writes 3 set JSONs + index.
- [ ] **Step 5:** Commit `feat: sentence set parsing and build-time validation`.

---

### Task 4: Ending and segmentation tables + checks

**Files:**
- Create: `src/core/data/endings.ts`, `src/core/endings.ts`
- Test: `tests/core/endings.test.ts`

**Interfaces — Consumes:** `Lexicon`, `Entry`, `Analysis`. **Produces:**
```ts
type Paradigm = '1'|'2'|'3'|'3i'|'4'|'5'|'adj12'|'adj3'|'cmp'|'ptc12'|'ptc3'|'pron'
paradigmFor(entry: Entry, a: Analysis): Paradigm
checkNominalEnding(lex: Lexicon, entryId: string, surface: string, ending: string): Check
checkVerbSegments(lex: Lexicon, entryId: string, surface: string, personal: string, marker: string|null): Check
checkInfinitiveEnding(lex: Lexicon, entryId: string, surface: string, ending: string): Check
```
Rule (nominal): valid iff the stem left is non-empty and, for **some** analysis of this surface/lemma, `stripMacrons(ending)` is in `ENDINGS[paradigm][case][number]` (stripped) for that gender. Zero ending `""` is valid only for nom/voc sg of 3rd decl, 2nd decl `-er`, adj `-er`/one-termination, and n acc sg of 3rd decl. Pronouns (`pos:'pron'`, `ille-adj`, `is`, `hic`, `idem`, `unus-adj`, `duo-num`): lenient — any non-empty ending from `PRONOMINAL = ['ius','ī','ō','um','am','ā','a','ae','e','ud','d','c','s','ōs','ās','ōrum','ārum','īs','ibus','ēs','ia','em','i']` accepted when stem non-empty.

Tables (standard Knudsvig/textbook): 1: a ae ae am ā a | ae ārum īs ās īs ae. 2 m: us/""(er) ī ō um ō e | ī ōrum īs ōs īs ī; 2 n: um ī ō um ō um | a ōrum īs a īs a. 3: "" is ī em e "" | ēs um ibus ēs ibus ēs; n pl a. 3i: as 3 plus gen pl ium, abl sg ī, n pl ia, acc pl īs. 4: us ūs uī um ū us | ūs uum ibus ūs ibus ūs; n ū. 5: ēs eī/ēī eī/ēī em ē ēs | ēs ērum ēbus ēs ēbus ēs. adj12 = 1 + 2. adj3 = 3i with m/f nom sg `is`/"" and n `e`/"". cmp: ior iōris iōrī iōrem iōre | iōrēs iōrum iōribus iōrēs, n ius/iōra; also accept the split leaving `-ior-` in the stem (endings = 3rd decl consonant). Accept `ius` → also accept `us` for students who keep `-i-` in the stem. ptc12 = adj12; ptc3 = adj3 with abl e/ī.

Rule (verb): valid iff, for some finite analysis `a` of the surface: `stripMacrons(surface)` ends with `stripMacrons(personal)` ∈ `PERSONAL[a]`, and the remainder ends with `stripMacrons(marker)` ∈ `MARKERS[a]` (or `marker === null` and `MARKERS[a]` contains `""`).
- PERSONAL non-perfect act: 1sg `ō`,`m`; 2sg `s`; 3sg `t`; 1pl `mus`; 2pl `tis`; 3pl `nt`. Pass: `or`,`r`; `ris`,`re`; `tur`; `mur`; `minī`; `ntur`. Perfect active (pf ind only): `ī`,`istī`,`it`,`imus`,`istis`,`ērunt`,`ēre`. Imperative: `""` sg, `te` pl, pass `re`/`minī`.
- MARKERS: pres ind `""`; impf ind `bā`,`ba`,`ēbā`,`ēba`; fut ind conj 1/2 `bi`,`b`,`bu`; fut ind conj 3/3io/4 `ē`,`e`,`a`; pf ind `""`; plupf ind `erā`,`era`; futpf ind `eri`,`er`; pres subj conj 1 `ē`,`e`; other conj `ā`,`a`; impf subj `rē`,`re`; pf subj `erī`,`eri`; plupf subj `issē`,`isse`; irregular verbs (`cls:'irreg'`): any marker or none accepted.
- Infinitive endings: `re`, `rī`, `ī`, `isse`, `esse`, `se`.

- [ ] **Step 1: Failing tests:** `puellae` accepts `ae`, rejects `e` and `lae`; `rēx` accepts `""` and `ēx` is rejected; `corpore` accepts `e`; `amābat` accepts personal `t` + marker `bā`, rejects marker null; `amat` accepts `t` + null; `amāvit` accepts `it` + null; `regunt` accepts `nt` + null; `reget` accepts `t` + `e`; `amātur` accepts `tur` + null; `fortior` accepts `ior`; `hunc` accepts `c` (lenient pronoun).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): ending and verb segmentation checks`.

---

### Task 5: Step checks

**Files:**
- Create: `src/core/checks.ts`, `src/core/data/labels.ts`, `src/core/data/copular.ts`
- Test: `tests/core/checks.test.ts`

**Interfaces — Consumes:** Tasks 2, 4. **Produces:**
```ts
type UiPos = 'N'|'ADJ'|'PRO'|'V'|'ADV'|'PREP'|'CONJ'|'OTHER';
type Label = 'S'|'O'|'SC'|'OC'|'V'|'PV'|'='|'X'|'PP'|'ADV'|'+'|'↓';
interface NomForm { c: Case; n: Num; g: Gender }
interface VerbForm { p?: Person; n?: Num; t: Tense; m?: Mood; v: Voice; k: 'fin'|'inf'|'imp' }
checkIdentify(lex, surface, entryId): Check
checkPos(lex, surface, entryId, pos: UiPos): Check
checkNomForm(lex, surface, entryId, f: NomForm): Check
checkNounLabel(f: NomForm, label: Label, openPP: {case: Case} | null): Check
checkAgreement(adj: NomForm, noun: NomForm): Check
checkVerbForm(lex, surface, entryId, f: VerbForm): Check
checkVerbLabel(lex, entryId, f: VerbForm, label: Label): Check
checkPrepCase(entry: Entry, c: Case): Check
checkConjType(entry: Entry, t: '+'|'↓'): Check
compoundForms(lex, entryId, ptcSurface, sumSurface): VerbForm[]   // [] = not a compound
checkCompoundForm(lex, entryId, ptcSurface, sumSurface, f: VerbForm): Check
```
Rules:
- POS mapping: n→N; adj, num→ADJ; pron→PRO (also accept ADJ for demonstratives `hic`,`is`,`idem`); `ille-adj`, `unus-adj` accept ADJ or PRO; v→V, and for a surface whose analyses are all `ptc`, accept V or ADJ; adv→ADV; prep→PREP; conj→CONJ; particle, other, phrase→OTHER.
- Noun gender: noun forms whose `g` differs from `entry.gender` never appear in analyses, so `checkNomForm` alone covers it; reason text says "this noun is <gender>" only when case+number were possible (the gender is already in the shown dictionary entry, so this reveals nothing).
- `checkNounLabel`: nom → S, SC; acc → O, OC, PP; abl → PP, ADV; loc → ADV; voc, gen, dat → any label accepted (no labels for these yet). If `openPP` and case matches → must be PP; PP when no open PP or case mismatch → reject.
- `checkVerbLabel`: PV requires `v:'pass'`; V rejects `v:'pass'` unless entry has flag `deponent`; `=` only for `COPULAR` (`sum-v`, `fio-v`, and any passive form of `video-v` = *videor*) and for any passive form of a `FACTITIVE` verb (the ids among appello, voco, nomino, facio, creo, dico, habeo, iudico, puto, existimo that exist in entries.json — look them up once and hard-code the found ids); `X` only for `EXISTENTIAL = ['sum-v']`.
- `checkPrepCase`: allowed cases parsed from definition `(prep. + acc.)`, `(prep. + abl.)`, `(prep. + acc. abl.)`, and `in` also `+ acc.` later in its definition.
- `checkConjType`: `+` iff definition contains `coord`; `↓` iff contains `subord`; `nē` and others with neither: accept `↓`.
- `compoundForms`: participle surface must have a `ptc` analysis (nom or acc) for `entryId`; `sumSurface` must be a form of `sum-v`; try lookups of `"<masc> <sum>"` where `<masc>` is the participle rewritten to masc nom sg (`-us`), nom pl (`-ī`), acc sg (`-um`), acc pl (`-ōs`) of the same number; collect analyses for `entryId`. Order of the two words in the sentence is irrelevant. Participle number must equal sum number for finite forms.

- [ ] **Step 1: Failing tests:**
  - `checkIdentify('puellae','puer-n')` fails; `('puellae','puella-n')` ok.
  - `checkPos` for `amātus` accepts V and ADJ; `et` accepts CONJ only.
  - `checkNomForm('puellae','puella-n',{c:'abl',n:'sg',g:'f'})` fails; `{c:'dat',n:'sg',g:'f'}` ok; `('puer','puer-n',{c:'nom',n:'sg',g:'f'})` fails.
  - `checkNounLabel({c:'acc'...},'S',null)` fails; `({c:'abl'},'ADV',null)` ok; `({c:'abl'},'PP',null)` fails; `({c:'abl'},'O',{case:'abl'})` fails.
  - `checkAgreement` m sg acc vs f sg acc fails.
  - `checkVerbLabel` PV on `amat` form fails; V on a deponent passive form ok; `=` on `sum-v` ok; `X` on `amo-v` fails.
  - `checkPrepCase(sub, 'acc')` and `(sub,'abl')` ok; `(cum-prep,'acc')` fails.
  - `compound accepts feminine participle`: `compoundForms(lex, instruo id, 'īnstrūcta', 'est')` contains `{t:'pf', m:'ind', v:'pass', p:'3', n:'sg'}`.
  - `compoundForms(..., 'appellātus','sunt')` is `[]` (number mismatch).
  - A test asserting every id in `COPULAR`, `FACTITIVE`, `EXISTENTIAL` exists in entries.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): per-step checks`.

---

### Task 6: (removed — teacher decided all options are always available)

---

### Task 7: Session state machine

**Files:** Create `src/core/session.ts`; Test `tests/core/session.test.ts`

**Consumes:** Tasks 2–5. **Produces:**
```ts
type StepId = 'identify'|'pos'|'ending'|'nomForm'|'nomRole'|'personal'|'marker'|'infEnding'|'verbForm'|'verbRole'|
  'compoundForm'|'prepCase'|'conjType'|'linkPending'|'clauseBoundary'|'encliticPos'|'encliticConj'|'resolvePending'|'done';
type Role =
  | { kind: 'label'; label: Label }                          // nouns, substantive adj (with label), verbs
  | { kind: 'modifies'; target: number }                     // adj/pron → earlier noun token index
  | { kind: 'pendingNoun' }
  | { kind: 'predicate'; label: 'SC'|'OC' }
  | { kind: 'substantive'; label: Label }
  | { kind: 'verbPart'; target?: number }                    // participle awaiting/linked to sum
  | { kind: 'aux'; target?: number };                        // sum awaiting/linked to participle
type Answer =
  | { step: 'identify'; entryId: string } | { step: 'pos'; pos: UiPos }
  | { step: 'ending' | 'infEnding'; ending: string } | { step: 'personal'; ending: string } | { step: 'marker'; marker: string|null }
  | { step: 'nomForm'; form: NomForm } | { step: 'verbForm' | 'compoundForm'; form: VerbForm }
  | { step: 'nomRole' | 'verbRole' | 'resolvePending'; role: Role }
  | { step: 'linkPending'; target: number | null }           // null = "none of these"
  | { step: 'prepCase'; c: Case } | { step: 'conjType' | 'encliticConj'; t: '+'|'↓' }
  | { step: 'encliticPos'; pos: UiPos }
  | { step: 'clauseBoundary'; ends: boolean };
interface WordState { entryId?: string; pos?: UiPos; ending?: string; personal?: string; marker?: string|null;
  nomForm?: NomForm; verbForm?: VerbForm; role?: Role; prepCase?: Case; conjType?: '+'|'↓'; clauseDepth: number; done: boolean }
interface SessionState { tokens: Token[]; current: number; step: StepId; words: WordState[];
  openPP: { prep: number; c: Case } | null; clauses: { conj: number; hasFiniteVerb: boolean }[];
  pendingLinkCandidates: number[]; error: string | null; log: Answer[] }
startSession(tokens: Token[]): SessionState
submit(state: SessionState, answer: Answer, lex: Lexicon): SessionState   // pure; on reject returns same state with error set, log unchanged
optionsFor(state: SessionState, lex: Lexicon): { cases?: Case[]; numbers?: Num[]; genders?: Gender[]; persons?: Person[]; tenses?: Tense[]; moods?: Mood[]; voices?: Voice[]; labels?: Label[]; nounTargets?: number[]; pendingTargets?: number[] }
replay(tokens: Token[], log: Answer[], lex: Lexicon): SessionState
```
Step order per word (after `identify` → `pos`):
- N / PRO used as noun: `ending` → `nomForm` → `nomRole` (label) → `linkPending` if any pending adjective agrees → next.
- ADJ / PRO / participle-as-ADJ: `ending` → `nomForm` (participle adds no extra; tense/voice come from its analysis) → `nomRole` (modifies | pendingNoun | substantive | predicate | verbPart) → next.
- V finite: `personal` → `marker` → `verbForm` → `verbRole` (V, PV, =, X, or aux) → if aux linked to a pending participle (or participle verbPart linked to a pending aux): `compoundForm` then a `verbRole` for the united form, stored on the participle's word; marks clause `hasFiniteVerb`.
- V infinitive: `infEnding` → `verbForm` (`k:'inf'`) → `verbRole`.
- PREP: `nomRole`-equivalent is fixed PP (auto), then `prepCase` → opens `openPP`.
- CONJ: `conjType`; `↓` pushes a clause.
- ADV: `verbRole`-style label ADV only (one button; still a required click). OTHER: nothing after pos.
- Enclitic token: after the host's steps, `encliticPos` → `encliticConj`.
- After any word while `clauses.length > 0`: `clauseBoundary` (ends=true rejected if top clause has no finite verb; ends=false rejected on the last token). The word on which `↓` was chosen does not get a boundary step.
- After the last word: one `resolvePending` per remaining pending word (pendingNoun / verbPart / aux disallowed now), then `done`.
- `openPP` closes when a noun/substantive with label PP is accepted.
- Accept answers only for the current step; every accepted answer is appended to `log`.
- `checkNomForm` must accept participle analyses (`k:'ptc'` with `c/n/g`) as nominal forms.
- Glossed words (`gloss:` ids): `identify` → `pos` → `nomRole`/`verbRole` with labels unchecked; no ending or form steps.

- [ ] **Step 1: Failing tests** (drive full sentences from the real sets with a helper `play(sentence, answers[])` that asserts no error after each):
  - `L10 #2 medicus timidum puerum magnā cum cūrā cūrāvit.` — *timidum* → pendingNoun; *puerum* → O, then `linkPending` target timidum; *magnā* → pendingNoun; *cum* → prepCase abl; *cūrā* → PP, link magnā; *cūrāvit* → personal `it`, marker null, pf ind act 3 sg, V; ends `done`.
  - `L10 #8 aciēs … īnstrūcta est.` — participle verbPart, *est* aux linked, compoundForm pf ind pass 3 sg, role PV.
  - `ambiguous form accepted then agreement uses chosen reading`: *puellae* accepted as dat sg; a following adjective in nom pl cannot modify it (agreement fails), in dat sg can.
  - `clause boundary`: in `ubi Carbō hoc vīdit, frātrem excitāvit.`, ending the clause after *Carbō* is rejected; after *vīdit* accepted; *frātrem* has clauseDepth 0.
  - `pending must resolve`: a sentence ending with an adjective left pendingNoun forces a `resolvePending` step that rejects `pendingNoun`.
  - `wrong answer does not advance`: submitting `pos: 'V'` for *medicus* returns same step with `error` non-null and `log` unchanged.
  - `replay(log)` of a finished sentence yields `step === 'done'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement as a pure reducer; keep step-transition logic in one `nextStep(state)` function. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): sentence session state machine`.

---

### Task 8: UI

**Files:**
- Create: `src/ui/App.tsx`, `src/ui/SetPicker.tsx`, `src/ui/SentenceView.tsx`, `src/ui/Workbench.tsx`, `src/ui/steps/IdentifyStep.tsx`, `src/ui/steps/ChoiceStep.tsx` (POS, conj type, prep case, labels, roles, clause boundary), `src/ui/steps/EndingSelector.tsx`, `src/ui/steps/FormPicker.tsx` (nominal and verbal pickers), `src/ui/progress.ts`, `src/ui/styles.css`
- Test: `tests/ui/EndingSelector.test.tsx`, `tests/ui/progress.test.ts`

**Consumes:** `fetchDataset`, `buildLexicon`, `SetIndexItem`, `SentenceSet`, session API (`optionsFor` returns every option; no lesson filtering).
**Produces:** `progress.ts`: `saveLog(setId, i, log: Answer[])`, `loadLog(setId, i): Answer[]`, `markDone(setId, i)`, `doneSet(setId): Set<number>` (keys `saban:v1:log:<setId>:<i>`, `saban:v1:done:<setId>`; all try/catch, return empty on failure).

Behavior:
- Start: fetch `./sets/index.json` and dataset in parallel; show a loading line; on failure show a plain error.
- `SetPicker`: `<select>` of set titles; then a list of sentences shown only as "Sentence N" (+ ✓ if done) — never the Latin text.
- `SentenceView`: one slot per token; finished words show surface + compact summary (`puerum · N · acc sg m · O`, adjectives `→ puerum`, verbs `pf ind act 3sg · V`); current word highlighted; future words blank boxes; words inside an open ↓ clause tinted (color by `clauseDepth`); open PP words underlined; punctuation shown only for revealed words.
- `Workbench`: renders the component for `state.step`, shows the dictionary entry once identified, shows `state.error` under the control.
- `IdentifyStep`: text input filtering `lex.search`; arrow keys + Enter or click to choose.
- `EndingSelector`: word as letters; ← extends highlight leftward from the end (or from the left edge of the personal ending for `marker`), → shrinks, Enter submits; on-screen ← → and Submit buttons; marker step adds a "None" button.
- `FormPicker`: button groups showing every option from `optionsFor(state)`; noun gender pre-shown but still chosen.
- Persist `state.log` after every accepted answer; on open, `replay` the saved log; `markDone` on `done`; "Restart sentence" button clears the log.

- [ ] **Step 1: Failing tests:** `EndingSelector`: given `puellae`, pressing ← twice then Enter calls `onSubmit('ae')`; ← three times, → once, Enter also calls `onSubmit('ae')`. `progress`: `replay restores step` — save a 3-answer log for a sentence, `replay` gives the same step as the live session; `loadLog` returns `[]` when `localStorage.getItem` throws.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement components. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): step-by-step parsing interface`.

---

### Task 9: End-to-end verification and deploy readiness

**Files:** Create `README.md` (how to add a set: drop a `.md`/`.txt` in `sets/`, run `npm run sets` to validate, commit and push; GitHub repo → Settings → Pages → Source: GitHub Actions).

- [ ] **Step 1:** `npm test` → all PASS; `npm run build` → succeeds with 3 sets.
- [ ] **Step 2:** Add `.claude/launch.json` (`npm run dev`, port 5173) and in the browser pane play L10 sentences #1 and #8 and L11 sentence 2 end to end, confirming: future words hidden, a wrong POS shows an error and does not advance, *appellātus est* unites, ↓ clause tint appears and clears, refresh mid-sentence resumes at the same step.
- [ ] **Step 3:** Fix anything found (with a regression test in the owning core test file).
- [ ] **Step 4:** Commit `docs: README and verification fixes`.
