# Bright Minds: notes for Claude

The class app for Bright Minds, a teacher's private English classes in Grand-Bassam, Côte d'Ivoire. Students and parents open it with a 4-digit code; the teacher signs in with Google. The teacher is not a developer and works from an iPhone: explain things in plain words, and do the git work yourself.

- Live site: https://brightmindsci.github.io/ (GitHub Pages, branch `main`, root folder)
- Firebase project: `brightminds-3a9d6` (Google sign-in + Firestore, free Spark plan)

## Privacy: this repository is public

The teacher asked that their real name and personal Google address never appear here. Do not write either into any file, commit message or link. `config.js` names the teacher only by `teacherKeys`, a SHA-256 hex fingerprint of their lowercase Google address; `firestore.rules` uses the placeholder `TEACHER_GOOGLE_ADDRESS`. Never commit student names, phone numbers or payment data either.

## Layout

- `src/app.jsx`: the whole app, one file. React 18 UMD globals (`React`, `ReactDOM`) and the Firebase compat SDK (`firebase`) are loaded by `index.html`; there are no imports. Student and parent screens come in English and French: their text lives in the `STR` table (`en` and `fr`) near the top of the file, so add both when adding text there. The teacher screens are in English.
- `src/styles.css`: the stylesheet (light and dark tokens).
- `src/build.js`: transpiles `src/app.jsx` with TypeScript (global install, `npm root -g`) and writes `app.js`, `app.css` and `index.html` at the root, with cache-busting hashes.
- `config.js`: `window.BM_CONFIG` with the Firebase web config (public by design) and `teacherKeys`. Not generated; edit by hand.
- `firestore.rules`: reference copy only. GitHub does not deploy it. The live rules are in the Firebase console (Firestore → Rules) with the teacher's real address in place of the placeholder; when rules change, give the teacher the new text with their address filled in to paste and Publish there, and keep the placeholder in this file.

## Lesson plans (`courses.json`)

The teacher's lesson plans, shown to the teacher only in Lessons → Library. The file itself is public like the rest of the site, so it holds no student names, client details or term dates.

- Shape: `{ updated, courses: [{ id, title, level, about, items: [{ id, section, sectionIntro?, title, body, send? }] }], wordLists: [{ id, title, about, cards: [{ en, fr, ex }] }] }`. Keep ids stable; items show in file order, grouped by `section`.
- `body` is light markdown: `###` headings, `**bold**`, `_italic_`, `- ` and `1. ` lists (indent 2+ spaces for a sub-item), `| tables |` (the first row is the header).
- `send` is what "Use for a class" fills into a new lesson for students: `{ title, notes, homework }`. Leave it out for pages that aren't a class (routines, checklists, quizzes).
- A word list's "Add to Words" copies it into the site's word lists for the group the teacher picks.
- To add plans from one of the teacher's Claude docs: read the doc with the Claude Docs tools, turn it into a course or items here, run `node src/build.js` (it fails on invalid JSON), commit and push.

## Making a change

1. Edit `src/app.jsx` and/or `src/styles.css`.
2. Run `node src/build.js` (it fails loudly on a JSX parse error).
3. Commit the source and the built files together and push to `main`. Pages redeploys in about a minute.

## Data (Firestore)

- `site/content`: lessons, word lists, class times, announcements, prices, group counts. Everyone reads; the teacher writes.
- `students/{code}`: one doc per student, keyed by their code, with their name, group and status (`st`: classes left, paid). Anyone can `get` a single code; only the teacher can list or write.
- `data/users/{uid}/...`: the teacher's private records (fees, payments, attendance, schools, lesson library). Teacher only.

If a change adds a new collection or path, update the rules too, or the app will get permission errors.
