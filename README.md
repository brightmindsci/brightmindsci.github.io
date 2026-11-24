# Bright Minds

The Bright Minds class app: word practice, homework, class times and payments for students and families, with a private teacher view.

Live at **https://brightmindsci.github.io/**

- `index.html`, `app.js`, `app.css`: the app (built from `src/`, served by GitHub Pages)
- `config.js`: the Firebase project settings and the teacher's fingerprint
- `firestore.rules`: a reference copy of the database security rules
- `src/`: the source. Edit `src/app.jsx` and `src/styles.css`, then run `node src/build.js`

Student data, payments and phone numbers are not in this repository. They live in Firebase, protected by the rules.
