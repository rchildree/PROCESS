# PROCESS

A step-by-step Latin parsing drill. Students see one word at a time and must answer a fixed
sequence of questions about it (dictionary entry, part of speech, ending, case/number/gender or
verb form, function) before the next word appears. Answers are checked against the
*Latin for Reading* (knudsvig-731) vocabulary: impossible answers are rejected, possible ones accepted.

## Adding a sentence set

1. Put a `.md` or `.txt` file in `sets/`.
   - **Markdown** (your lesson files): title from the `# ` heading; sentences are the numbered
     `**bold**` lines (or the paragraph under `### Latin` for stories). A file with several
     `## Lesson N` sections becomes one set per lesson.
   - **Plain text**: first line is the title, then one sentence per line. An optional
     `lesson: N` line only orders the menu.
   - For a word not in the vocabulary (a proper name, say), add a gloss block:
     ```
     glosses:
     Blorpus | Blorpus, -ī m. | Blorpus (a name) | n
     ```
2. Run `npm run sets`. It lists any word it can't find; fix those before pushing.
3. Commit and push to `main`. GitHub Pages rebuilds and the set appears in the menu.

## Development

```bash
npm install
npm run dev     # local server
npm test        # checking-logic and UI tests
npm run build   # production build into dist/
```

First-time GitHub setup: create the repository, push, then in **Settings → Pages** set the
source to **GitHub Actions**.

Dictionary lookup has three modes, picked at the top of the page: **Help** (search as you type),
**Normal** (type at least the first part of the entry) and **Real** (type the whole entry). Macrons,
commas and periods never count. Extra accepted spellings of a first part (like *ac* for *atque*) live
in `src/core/data/alternates.ts`.

Function labels live in `src/core/data/labels.ts`; copular/factitive verb lists in
`src/core/data/copular.ts`; ending tables in `src/core/data/endings.ts`.

Sentences are worked in order: a student can open any sentence they've finished plus the first
unfinished one, never one further ahead.

## Teacher mode and answer keys

Open the app with `?key` at the end of the address (for example `…/saban-the-process/?key`) to turn on
teacher mode; the browser remembers it until you click **turn off** in the header (or open `?key=off`).
In teacher mode:

- your parsing is saved apart from any student progress on the same computer;
- every sentence can be opened, in any order;
- **Export key** (under the sentence) downloads `<set-id>.key.md` with every word you've finished in
  that set: one line per word giving its dictionary entry, part of speech, form and function, with
  links named by word number. A final JSON column preserves the parsing path, stem, stem type,
  marker, and ending (including zero endings). Unfinished words and sentences are left out.

Put the key file in `sets/` next to the set and run `npm run sets`. The builder turns it into
`public/sets/<set-id>.key.json` and stops if a key's words no longer line up with the set (say, after
a sentence was edited): re-export the key then.

Once a student finishes a sentence that has a key, a **Hold to see the key** button appears. Holding it
(mouse, finger, or Space/Enter) shows the key's parse in place of theirs, with the words that differ
marked; letting go shows their own work again. The key is a public file, so this is honor-system only.
The teacher's stem breakdown and participle description appear in this view too. Older six-column
keys still load, but must be re-exported from the teacher's saved work to include those details.

## Translations

When a sentence is finished, a box under it takes the student's translation. It saves as they type
and prints on the worksheet in place of the ruled lines (untick **My translations** to get blank lines).

## Printable worksheet

`print.html` (linked as **Printable worksheet** under each sentence) prints a set with the
student's saved parsing (labels, forms, arrows), the dictionary entries they looked up, and ruled
lines for a translation. Use the browser's print dialog to save it as a PDF. It lives apart from
the app in `print.html` and `src/print/`; to drop it, delete those, the `print` input in
`vite.config.ts`, and the link in `src/ui/App.tsx`.
