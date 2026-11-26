# Bright Minds: notes for Claude

The class app for Bright Minds, a teacher's private English classes in Grand-Bassam, Côte d'Ivoire. Students and parents open it with a 4-digit code; the teacher signs in with Google. The teacher is not a developer and works from an iPhone: explain things in plain words, and do the git work yourself.

- Live site: https://brightmindsci.github.io/ (GitHub Pages, branch `main`, root folder)
- Firebase project: `brightminds-3a9d6` (Google sign-in + Firestore, free Spark plan)

## Privacy: this repository is public

The teacher asked that their real name and personal Google address never appear here. Do not write either into any file, commit message or link. `config.js` names the teacher only by `teacherKeys`, a SHA-256 hex fingerprint of their lowercase Google address; `firestore.rules` uses the placeholder `TEACHER_GOOGLE_ADDRESS`. Never commit student names, phone numbers or payment data either.

## Layout

- `src/app.jsx`: the whole app, one file. React 18 UMD globals (`React`, `ReactDOM`) and the Firebase compat SDK (`firebase`) are loaded by `index.html`; there are no imports. Student and parent screens come in English and French: their text lives in the `STR` table (`en` and `fr`) near the top of the file, so add both when adding text there. The teacher screens are in English.
- `src/styles.css`: the stylesheet (light and dark tokens). The look is "warm and Ivorian", chosen by the teacher: cream paper, dark brown ink, orange `--accent` for buttons and the open tab, green and gold, Poppins headings (`--font-head`) and DM Sans text. The woven strip (`--weave`) sits under the header and on top of each screen's main card (`.panel`); `.rings` adds wax-print circles in a corner. Keep the logo and app icon as they are.
- `src/build.js`: transpiles `src/app.jsx` with TypeScript (global install, `npm root -g`) and writes `app.js`, `app.css` and `index.html` at the root, with cache-busting hashes.
- `config.js`: `window.BM_CONFIG` with the Firebase web config (public by design) and `teacherKeys`. Not generated; edit by hand.
- `firestore.rules`: reference copy only. GitHub does not deploy it. The live rules are in the Firebase console (Firestore → Rules) with the teacher's real address in place of the placeholder; when rules change, give the teacher the new text with their address filled in to paste and Publish there, and keep the placeholder in this file.

## Lesson plans (`courses.json`)

The teacher's lesson plans, shown to the teacher only in Lessons → Library. The file itself is public like the rest of the site, so it holds no student names, client details or term dates.

- Shape: `{ updated, courses: [{ id, title, level, about, items: [{ id, section, sectionIntro?, title, body, send? }] }], wordLists: [{ id, title, about, cards: [{ en, fr, ex }] }] }`. Keep ids stable; items show in file order, grouped by `section`.
- `body` is light markdown: `###` headings, `**bold**`, `_italic_`, `- ` and `1. ` lists (indent 2+ spaces for a sub-item), `| tables |` (the first row is the header).
- `send` is what "Use for a class" fills into a new lesson for students: `{ title, notes, homework }`. Leave it out for pages that aren't a class (routines, checklists, quizzes).
- A word list's "Add to Vocab" copies it into the site's word lists for the group the teacher picks. Cards may have `pic` (one emoji); lists marked `kids: true` are the picture lists. A word list with 4 or more pictures gets the Listen and Memory games.
- `skills` on a course: `[{ id, unit, unitFr, en, fr }]`, the "I can..." statements the teacher ticks per student (Library → a student → What <name> can do). Students read them in their language, so write both. Keep ids stable: ticks are stored as `<courseId>/<skillId>`.
- To add plans from one of the teacher's Claude docs: read the doc with the Claude Docs tools, turn it into a course or items here, run `node src/build.js` (it fails on invalid JSON), commit and push.

## Teacher screens

The teacher lands on **Today** (`TodayTeacher`): today's and tomorrow's classes with who's in them, each student's next planned lesson and last class note, Mark taught (`ClassLog`: who came, notes, a WhatsApp message for absent students' families), classes from the last 3 days not logged yet, voice notes and homework waiting (`HomeworkCheck`), Get ready (the `Materials:` / `Print before class` lines of the next planned lessons), the to-do list, and who still owes money. "Message families" (`FamilyMessages`) builds class reminders, cancellations, homework reminders or a free message per family, in each family's language; students sharing one WhatsApp number get one message. Tapping a student's name opens their page (`StudentFile`). `goTab(id, jump)` in `App` opens another tab at a given place (a Library view, the voice notes, a student in Students). The teacher has four tabs (Today, Classes, Lessons, Students); keep the bar that short, as the teacher asked for a less cluttered bottom. Business is its own section, opened from the Business button in the header (`TeacherHeaderActions`, `bizOpen` in `App`); Student view and Sign out are in the header's ⋯ menu. Word lists live inside Lessons as "Vocab", next to Library and Voice; students see them in the "Vocab" tab (both languages) (`LessonsTeacher` modes `lessons`, `words`, `library`, `voice`).

## Free trial (visitors without a code)

"Essayer l'application gratuitement" on the welcome screen, or the ad link https://brightmindsci.github.io/#essai (also `#try`), opens the trial as the guest student (`GUEST`, `trialOn` in `App`). It shows sample content built in the browser: picture lists from `courses.json` (`TRIAL_LISTS`) plus an everyday-phrases list, a sample lesson with homework (`trialLesson`), a voice recording that stays on the phone with a sample teacher reply (`TrialVoice`), an example progress page (`trialProgress`), and a banner pointing to the prices page (`#join`) and the teacher's WhatsApp. The trial never writes to Firestore (test_trial checks the database is unchanged), and only lists, lessons and classes set for "Everyone" show in it. A student who already has a code, or the teacher, keeps their own view when opening the ad link.

## Making a change

1. Edit `src/app.jsx` and/or `src/styles.css`.
2. Run `node src/build.js` (it fails loudly on a JSX parse error).
3. Commit the source and the built files together and push to `main`. Pages redeploys in about a minute.

## Data (Firestore)

- `site/content`: lessons, word lists, class times, announcements, prices, group counts. Everyone reads; the teacher writes. A lesson is for `group` (one group, or "Everyone"); when the teacher picks several, `groups` holds them all and `group` the first. Filter lessons with `forGroup(lessonGroups(l), studentGroup)`.
- `students/{code}`: one doc per student, keyed by their code, with their name, group and status (`st`: classes left, paid). Anyone can `get` a single code; only the teacher can list or write.
- `data/users/{uid}/...`: the teacher's private records (fees, payments, attendance, schools, lesson library). Teacher only. Firestore paths alternate collection/document: a document path has an even number of parts, a collection path an odd number (the test harness enforces this too).
  - `money/attendance/{YYYY-MM}`: `{ taken: [{ id, studentId, date, slot?, place?, note?, own? }], absent: [{ id, studentId, date, slot?, place? }] }`. `note` is the class note, `own` a note for that one student; only the teacher sees them. Absences don't count as classes taken. Always save both arrays together (`att.save(taken, absent)`), since the write replaces the document.
  - `homework`: `{ checks: { <lessonId>: { <studentId>: "done" | "missing" } } }`. A voice note for that lesson counts as handed in unless the teacher marks otherwise.
  - `todo`: `{ items: [{ id, text, at, done? }] }`, the teacher's own to-do list on Today.
- `progress/{studentId}`: what a student can do and the teacher's replies to their voice notes, `{ skills: { "<courseId>/<skillId>": "YYYY-MM-DD" }, courses: [courseIds], replies: { <voiceId>: { stars, note, title, lessonId, at } }, updated }`. Anyone can `get` one (the id is the student's private id, not their code); only the teacher can list or write. Students see it in the Progress tab, and replies under the matching homework.
- `voice/{id}` and `voice/{id}/parts/{0..5}`: a student's recorded homework. The student creates them without signing in; the rules check the code belongs to that student id and limit the fields and sizes. The audio is base64 split into parts of up to 700,000 characters. Only the teacher can read, update (`heard`, `replied`) or delete them (Lessons → Voice).
- `data/users/{uid}/money/plans/{studentId}`: each student's own lesson list in Lessons → Library, `{ items: [{ id, course, item } | { id, custom: { title, notes, homework } }, used?: "YYYY-MM-DD"], updated }`. `course`/`item` are ids from `courses.json`, so keep those ids stable. "Use for <name>'s class" sets `used` when the new lesson is saved.

If a change adds a new collection or path, update the rules too, or the app will get permission errors.
