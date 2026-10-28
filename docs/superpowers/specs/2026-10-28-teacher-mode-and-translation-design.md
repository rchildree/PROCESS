# Teacher mode, answer keys, and the translation box

## Teacher mode (`?key`)

- Opening the app (or `print.html`) with `?key` turns teacher mode on; the browser remembers it.
  `?key=off` turns it off. A "Teacher mode" badge in the header has a turn-off link.
- It hides nothing securely: it only keeps the Export button out of students' way.
- Teacher work is saved apart from student progress (`process:v1:t:` instead of `process:v1:`),
  so parsing to make a key never touches a student's saved work on a shared computer.
- Any sentence can be opened, not just the first unfinished one.

## Export as key

The footer gets **Export key**, which downloads `<set-id>.key.md` holding every word the teacher has
finished in that set. Unparsed sentences and words are left out (a partial key is fine: Check will
give no feedback where the key is silent).

```
# Key: Lesson 11 — Story: Crassus et Carbō
set: lesson-11-story-crassus-carbo

## 4
1  | ūnā      | unus-adj    | ADJ  | abl sg f         | → 2 nocte
2  | nocte    | nox-n       | N    | abl sg f         | ADV
3  | dum      | dum-conj    | CONJ |                  | ↓
...
```

Columns: word number · word · dictionary entry id · part of speech · form · function. The form and
function columns are made of parts joined by `; `. Links name the target by number (then the word,
for reading), so repeated words are never ambiguous. Every column is plain text produced the same way
for any parse, so Check can build the same lines from a student's work and compare column by column.

Key files sit in `sets/` beside the set; the set builder skips `*.key.md`.

## Translation box

Once a sentence is finished, a box under it takes the student's translation. It saves as they type,
is kept apart in teacher mode like everything else, survives Restart, and prints on the worksheet in
place of the ruled lines (a "My translations" option, on by default).

## Later: Check (not built)

A Check button after a finished sentence compares the student's lines with the key, column by
column, and marks differing words in the sentence view. Comparison only: no model translation, no notes.

## Hold to see the key (built 2026-10-28)

The set builder compiles `*.key.md` into `public/sets/<set-id>.key.json` (named in the index as `key`)
and fails when key words no longer match the set. Once a keyed sentence is finished, holding
**Hold to see the key** (pointer with capture, or Space/Enter) swaps the key's words into the sentence
view; unkeyed words keep the student's answers, words that differ are marked, and a line says how many.
Letting go, losing focus, or leaving the window shows the student's work again. Keys don't carry the
stem split, so it isn't shown while peeking. A subordinating conjunction is written once (`↓`), and a
word closing two clauses writes `clause ends ×2`, so clause shading can be rebuilt from the key.
Check, when built, can sit beside this; peeking does not wait for it.
