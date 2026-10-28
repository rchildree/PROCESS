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

## Later: hold to see the key (not built)

Holding a button swaps key data into the sentence view; letting go shows the student's work again.
Only available after Check. Unkeyed parts keep the student's answers; differing words stay marked
while held. Needs pointer events that don't trigger touch text selection, and a keyboard equivalent.
