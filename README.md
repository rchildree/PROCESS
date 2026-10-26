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
