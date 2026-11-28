(function () {
if (!window.React || !window.ReactDOM) {
  var rootEl = document.getElementById("root");
  if (rootEl) rootEl.innerHTML = '<p class="boot">Bright Minds could not load. Check your internet connection, then open the page again.</p>';
  return;
}
const { useState, useEffect, useMemo, useRef, useContext, createContext } = React;

/* ---------- helpers ---------- */
const EVERYONE = "Everyone";
const GUEST = { id: "guest", name: "Guest", group: EVERYONE };
const DEFAULT_CLASSES = 8; // two classes a week
const LOCALE = { en: "en-US", fr: "fr-FR" };
const DAYS = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  fr: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
};

const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, "0");
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shiftMonth = (key, delta) => { const [y, m] = key.split("-").map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
const monthLabel = (key, lang = "en") => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LOCALE[lang], { month: "long", year: "numeric" }); };
const parseISO = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso, lang = "en") => (iso ? parseISO(iso).toLocaleDateString(LOCALE[lang], { weekday: "short", month: "short", day: "numeric" }) : "");
const fmtShort = (iso, lang = "en") => (iso ? parseISO(iso).toLocaleDateString(LOCALE[lang], { month: "short", day: "numeric" }) : "");
const num = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");
const fcfa = (n) => `${num(n)} FCFA`;
const addMin = (hhmm, mins) => { const [h, m] = (hhmm || "00:00").split(":").map(Number); const t = h * 60 + m + (Number(mins) || 0); return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };
const forGroup = (g, mine) => (Array.isArray(g) ? !g.length || g.includes(EVERYONE) || g.includes(mine) : !g || g === EVERYONE || g === mine);
/* A lesson is for one group (group) or several (groups); group always holds the first, for older copies of the app. */
const lessonGroups = (l) => (Array.isArray(l.groups) && l.groups.length ? l.groups : [l.group || EVERYONE]);
const shuffle = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const arr = (x) => (Array.isArray(x) ? x : []);
const classWord = (n) => (n === 1 ? "class" : "classes");
const isLink = (s) => /^https:\/\/\S+$/i.test(String(s || "").trim());
const monthRange = (key) => { const [y, m] = key.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [key + "-01", key + "-" + pad(last)]; };
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NBSP_RE = new RegExp("[" + String.fromCharCode(0x202f) + String.fromCharCode(0xa0) + "]", "g");
const plainNum = (n, dec = 0) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: dec }).replace(NBSP_RE, " ");
const COMBINING_RE = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
const fileSafe = (s) => String(s).normalize("NFD").replace(COMBINING_RE, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
const ONLINE_RE = /online|en ligne|zoom|meet|teams/i;
const placeName = (s) => (s ? s.place || (s.link ? "Online" : "") : "");
const placeKey = (p) => String(p || "").trim().toLowerCase();
const LEVELS = [
  { id: "starter", en: "Starter", fr: "Découverte" }, { id: "beginner", en: "Beginner", fr: "Débutant" },
  { id: "elementary", en: "Elementary", fr: "Élémentaire" }, { id: "intermediate", en: "Intermediate", fr: "Intermédiaire" },
  { id: "upper", en: "Upper-intermediate", fr: "Intermédiaire avancé" }, { id: "advanced", en: "Advanced", fr: "Avancé" },
];
const levelName = (id, lang = "en") => { const l = LEVELS.find((x) => x.id === id); return l ? l[lang] : ""; };
const AUDIENCES = ["Little kids", "Kids", "Teens", "Adults", "Conversation"];
const PDF_LIB = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
const scriptLoads = {};
function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!scriptLoads[src]) {
    scriptLoads[src] = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src; el.async = true;
      el.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error("load failed")));
      el.onerror = () => { delete scriptLoads[src]; reject(new Error("load failed")); };
      document.head.appendChild(el);
    });
  }
  return scriptLoads[src];
}

function makeStore(kind) {
  const s = () => window[kind];
  return {
    get(k, d = null) { try { const v = s().getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { s().setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { s().removeItem(k); } catch (e) { /* storage unavailable */ } },
  };
}
const ls = makeStore("localStorage");
const ss = makeStore("sessionStorage");

const canSpeak = "speechSynthesis" in window;
let enVoice = null;
function pickVoice() {
  try {
    const vs = (window.speechSynthesis.getVoices() || []).filter((v) => /^en[-_]/i.test(v.lang));
    enVoice = vs.find((v) => /^en[-_]US/i.test(v.lang) && /samantha|google us|aaron|nicky|ava/i.test(v.name))
      || vs.find((v) => /^en[-_]US/i.test(v.lang)) || vs.find((v) => /^en[-_]GB/i.test(v.lang)) || vs[0] || null;
  } catch (e) { enVoice = null; }
}
if (canSpeak) { pickVoice(); try { window.speechSynthesis.addEventListener("voiceschanged", pickVoice); } catch (e) { /* older browser */ } }
let lastSaid = { text: "", at: 0 };
/* Saying the same thing again within a few seconds says it slowly. */
function speak(text) {
  if (!canSpeak || !text) return;
  try {
    const clean = String(text).replace(/_{2,}/g, "…").replace(/→/g, ",");
    const now = Date.now();
    const again = lastSaid.text === clean && now - lastSaid.at < 5000;
    lastSaid = { text: clean, at: now };
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = enVoice ? enVoice.lang : "en-US";
    if (enVoice) u.voice = enVoice;
    u.rate = again ? 0.6 : 0.85;
    window.speechSynthesis.speak(u);
  } catch (e) { /* no voice */ }
}


/* ---------- words on the student side, in English and French ---------- */
const STR = {
  en: {
    tagline: "English words, homework and class times in one place.",
    enterCode: "Enter your code", codeHint: "Your teacher sent you a code with 4 numbers.", yourCode: "Your code", open: "Open",
    codeShort: "Your code has 4 numbers.", codeWrong: "That code doesn't match. Check it with your teacher.", noCode: "Try the app for free",
    switchUser: "Switch", otherLang: "Français", otherLangName: "Lire en français",
    tabWords: "Vocab", tabHomework: "Homework", tabClasses: "Classes", tabPay: "Pay",
    words: "Vocabulary", noLists: "Your teacher hasn't added any word lists yet.", nWords: (n) => `${n} ${n === 1 ? "word" : "words"}`,
    allLists: "All lists", flashcards: "Flashcards", quiz: "Quiz", emptyList: "This list has no words yet.",
    tapMeaning: "Tap to see the meaning", ariaFront: (w) => `${w}. Tap to see the meaning.`, ariaBack: (w) => `${w}. Tap to see the English word.`,
    xOfY: (a, b) => `${a} of ${b}`, hearSentence: "Hear the sentence", hearWord: "Hear the word", back: "Back", mix: "Mix", next: "Next",
    quizMin: "A quiz needs at least 4 words in the list.", yourScore: "Your score", perfect: "Perfect score!", great: "Great work.",
    practiceMore: "Practice the flashcards, then try again.", newBest: "New best score", best: (s, t) => `Best: ${s} of ${t}`, tryAgain: "Try again",
    questionN: (i, n) => `Question ${i} of ${n}`, whatMeans: "What does this mean?", howSay: "How do you say this in English?",
    correctAnswer: "Correct answer", yourAnswer: "Your answer", correct: "Correct!", notQuite: "Not quite. The answer is ",
    nextQ: "Next question", seeScore: "See my score",
    homework: "Homework", noLessons: "No lessons yet. Notes and homework from your classes will show up here.",
    due: (d) => `, due ${d}`, markDone: "Mark as done", done: "Done", pastDue: "Past due",
    myClasses: "My classes", nextClass: "Next class", now: "Happening now", todayAt: (t) => `Today at ${t}`, tomorrowAt: (t) => `Tomorrow at ${t}`,
    dayAt: (d, t) => `${d} at ${t}`, placeNotSet: "Place not set", noClasses: "No classes on the schedule yet.", todayDay: (d) => `Today, ${d}`,
    timeRange: (a, b) => `${a} to ${b}`, joinClass: "Join class", join: "Join", online: "Online",
    classesLeft: (l, t, m) => `${l} of ${t} classes left in ${m}`, extraClasses: (x, m) => `${x} extra ${x === 1 ? "class" : "classes"} in ${m}`,
    updatedOn: (d) => `Updated ${d}`,
    payTitle: "Pay for classes", yourFee: "Your class fee", eachMonth: "each month",
    noPayDetails: "Your teacher hasn't added payment details yet. Ask them how to pay.", sendTo: "Send your payment to",
    name: (n) => `Name: ${n}`, payWith: (k) => `Pay with ${k}`, copy: "Copy", copied: "Copied", holdCopy: "Press and hold to copy",
    afterPay: "After you pay, tell your teacher", yourName: "Your name", amount: "Amount (FCFA)", paidWith: "Paid with", cash: "Cash",
    payMsg: (n, a, m, w) => `Hello, this is ${n} from Bright Minds. I paid ${a} for ${m} by ${w}.`, aStudent: "a student", myFee: "my class fee",
    sendWa: "Send on WhatsApp", copyMsg: "Copy the message",
    waFallback: (n) => `If WhatsApp doesn't open, copy the message and send it to ${n} with a screenshot of your payment.`,
    screenshot: "After you pay, send your teacher a screenshot of the payment.",
    paid: (m) => `${cap(m)}: paid`, partial: (m) => `${cap(m)}: partly paid`, unpaid: (m) => `${cap(m)}: not paid yet`,
    announcement: "Announcement",
    codeOffline: "Your code couldn't be checked. Check your internet connection and try again.", teacherSignIn: "Teacher sign-in",
    installTitle: "Put Bright Minds on your Home Screen", installLead: "Then it opens in one tap, like an app. Nothing to download, no App Store.",
    installShow: "Show me how", installNotNow: "Not now", installNow: "Install Bright Minds", installOr: "Or follow the steps below.",
    installWhich: "Which phone do you have?", installIphone: "iPhone or iPad", installAndroid: "Android",
    iosSteps: (host) => [`Open **${host}** in **Safari**.`, "Tap the menu button beside the address at the bottom of the screen (**≡** or **⋯**), then tap **Share**. On an older iPhone, tap the Share button straight away: the square with an arrow pointing up.", "Tap **View More** (the **˅** arrow), then **Add to Home Screen**. On an older iPhone, scroll down the list to find it.", "If you see **Open as Web App**, leave it switched on. Then tap **Add**."],
    androidSteps: (host) => [`Open **${host}** in **Chrome**.`, "Tap **⋮** in the top right corner.", "Tap **Add to Home screen** or **Install app**.", "Tap **Install** (or **Add**)."],
    installAfter: "The Bright Minds icon is now on your Home Screen, next to your other apps. Open it from there. The first time, type your code once more.",
    installDone: "You're already using Bright Minds from your Home Screen.", installShare: "Send these steps to someone",
    installCopy: "Copy the link", installWa: "Send on WhatsApp", installWaText: (link) => `To put Bright Minds on your phone like an app, follow these steps: ${link}`,
    offline: "Bright Minds can't be reached right now. Check your internet connection, then open the page again.", opening: "Opening Bright Minds...",
    seeClasses: "New student? See classes and prices", haveCode: "I have a code",
    joinTagline: "English classes for children and adults, in person and online.", classesPrices: "Classes and prices",
    perMonth: "a month", perClass: "a class", perHour: "an hour", openGroups: "Groups open now",
    spotsLeft: (n) => `${n} ${n === 1 ? "spot" : "spots"} left`, full: "Full",
    bookTrial: "Book a free trial class", trialMsg: "Hello! I would like to book a free trial class with Bright Minds.",
    trialHint: "This opens WhatsApp with a message ready to send.",
    yourLevel: (l) => `Your level: ${l}`, changesTitle: "Changes to classes", makeupLabel: "Make-up class",
    cancelledOn: (d, t) => `${d} at ${t}: cancelled`, makeupOn: (d, t) => `Make-up class on ${d} at ${t}`,
    trialBadge: "Free trial", trialBanner: "You're trying Bright Minds for free. Students get their own lessons, homework and progress.",
    trialBack: "Back to the app", trialPrices: "Classes and prices", trialWrite: "Message the teacher",
    trialWaMsg: "Hello! I tried the Bright Minds app and I'd like to know more about the English classes.",
    sampleTag: "Sample", sampleProgress: "An example of what a family sees: after each class, the teacher ticks what the student can now do in English.",
    trialReplyLabel: "Example of a reply from the teacher", trialReplyNote: "Very good! Say “red” with a strong r. See you on Saturday!",
    trialTryRecord: "Try recording your answer", trialVoiceHint: "Here you only hear yourself. Students send it to their teacher, who listens and replies with stars and advice.",
    trialClassesTitle: "Your classes", trialClasses: "Once you're enrolled, your class times, changes and classes left show here. Have a look at the classes and prices to choose a group.",
    trialPhrases: "Everyday phrases", trialLessonTitle: "Hello and colors",
    trialLessonNotes: "New words: red, blue, yellow, green\nKey sentences: \"What's your name?\" \"My name is Awa.\" \"It's red.\"",
    trialLessonHw: "Look around you and say the color of 3 things in English. Then record your answer.",
    tabProgress: "Progress", cardsShort: "Cards", listenGame: "Listen", memoryGame: "Memory",
    sayIt: "Say it", sayItAria: (w) => `Say "${w}"`, hearIt: (w) => `Hear "${w}"`, listening: "Listening... tap to stop", speakNow: "Say it now.",
    saidRight: (h) => `Great! I heard "${h}".`, saidWrong: (h) => (h ? `I heard "${h}". Listen and try again.` : "Listen and try again."),
    micBlocked: "The microphone is blocked. Allow it for this site in your phone's settings, then try again.", micNo: "The microphone doesn't work here on this phone.",
    micNothing: "I didn't hear anything. Try again a little louder.", recordMe: "Record myself", recordAgain: "Record again", playMine: "Play mine",
    hearModel: "Hear it", compareHint: "Listen to both and compare.",
    practiceTitle: (n) => `Practice saying these (${n})`, practiceHint: "Tap the speaker to listen, then the microphone to say it. Tap the speaker twice to hear it slowly.",
    practiceHintNoMic: "Tap the speaker to listen, then say it out loud. Tap twice to hear it slowly.",
    listenTitle: "Listen and tap", listenHow: "Listen to the word, then tap the right picture.", listenHowRead: "Read the word, then tap the right picture.",
    startGame: "Start", hearAgain: "Hear it again", tapPicture: "Tap the right picture", yesStar: "Yes! You get a star.", gotIt: "Yes, that's it!",
    starsN: (n) => `${n} ${n === 1 ? "star" : "stars"}`, starsOf: (s, n) => `${s} ${s === 1 ? "star" : "stars"} out of ${n}!`, playAgain: "Play again",
    pictureN: (k) => `Picture ${k}`, cardN: (k) => `Card ${k}`, pairsFound: (a, b) => `${a} of ${b} pairs`, movesN: (n) => `${n} ${n === 1 ? "try" : "tries"}`,
    allPairs: (n) => `You found all the pairs in ${n} tries!`, memoryHow: "Find each picture and its word. Tap two cards.",
    recordAnswer: "Record my answer", recordAnother: "Record another answer", recordHint: "Say your homework out loud. You can listen before you send it. Up to 2 minutes.",
    startRec: "Start recording", stopRec: "Stop", sendTeacher: "Send to my teacher", sending: "Sending...", cancel: "Cancel",
    voiceSent: (d) => `Sent to your teacher, ${d}`, voiceFail: "It didn't send. Check your internet and try again.",
    voiceTooLong: "That recording is too long. Try one under 2 minutes.",
    voiceNotReady: "Voice notes aren't switched on yet. Let your teacher know, then try again later. Your recording is still here.",
    voiceSlow: "It's taking a long time. Check your internet, then tap Send again.", teacherReplied: "Your teacher listened to your recording",
    progressTitle: "What I can do", skillsCount: (n) => (n === 1 ? "thing I can do in English" : "things I can do in English"),
    starsFromTeacher: (n) => `${n} ${n === 1 ? "star" : "stars"} from my teacher`, loadingProgress: "Opening your progress...",
    noSkillsYet: "After your classes, your teacher ticks off what you can do. It will show up here.", comingNext: "Coming next", canDoSince: (d) => `Since ${d}`,
  },
  fr: {
    tagline: "Vocabulaire, devoirs et horaires de cours d'anglais, au même endroit.",
    enterCode: "Entrez votre code", codeHint: "Votre professeur vous a envoyé un code à 4 chiffres.", yourCode: "Votre code", open: "Ouvrir",
    codeShort: "Le code a 4 chiffres.", codeWrong: "Ce code ne correspond pas. Vérifiez-le avec votre professeur.", noCode: "Essayer l'application gratuitement",
    switchUser: "Changer", otherLang: "English", otherLangName: "Read in English",
    tabWords: "Vocab", tabHomework: "Devoirs", tabClasses: "Cours", tabPay: "Payer",
    words: "Vocabulaire", noLists: "Votre professeur n'a pas encore ajouté de liste de mots.", nWords: (n) => `${n} mot${n > 1 ? "s" : ""}`,
    allLists: "Toutes les listes", flashcards: "Cartes", quiz: "Quiz", emptyList: "Cette liste n'a pas encore de mots.",
    tapMeaning: "Touchez pour voir la traduction", ariaFront: (w) => `${w}. Touchez pour voir la traduction.`, ariaBack: (w) => `${w}. Touchez pour voir le mot anglais.`,
    xOfY: (a, b) => `${a} sur ${b}`, hearSentence: "Écouter la phrase", hearWord: "Écouter le mot", back: "Retour", mix: "Mélanger", next: "Suivant",
    quizMin: "Il faut au moins 4 mots dans la liste pour faire un quiz.", yourScore: "Votre score", perfect: "Score parfait !", great: "Très bien !",
    practiceMore: "Révisez les cartes, puis réessayez.", newBest: "Nouveau record", best: (s, t) => `Record : ${s} sur ${t}`, tryAgain: "Réessayer",
    questionN: (i, n) => `Question ${i} sur ${n}`, whatMeans: "Que veut dire ceci ?", howSay: "Comment dit-on ceci en anglais ?",
    correctAnswer: "Bonne réponse", yourAnswer: "Votre réponse", correct: "Bravo !", notQuite: "Pas tout à fait. La réponse est ",
    nextQ: "Question suivante", seeScore: "Voir mon score",
    homework: "Devoirs", noLessons: "Pas encore de leçon. Les notes et les devoirs de vos cours apparaîtront ici.",
    due: (d) => `, pour le ${d}`, markDone: "Marquer comme fait", done: "Fait", pastDue: "En retard",
    myClasses: "Mes cours", nextClass: "Prochain cours", now: "En ce moment", todayAt: (t) => `Aujourd'hui à ${t}`, tomorrowAt: (t) => `Demain à ${t}`,
    dayAt: (d, t) => `${cap(d)} à ${t}`, placeNotSet: "Lieu non précisé", noClasses: "Aucun cours n'est encore prévu.", todayDay: (d) => `Aujourd'hui, ${d}`,
    timeRange: (a, b) => `${a} à ${b}`, joinClass: "Rejoindre le cours", join: "Rejoindre", online: "En ligne",
    classesLeft: (l, t, m) => `Il reste ${l} cours sur ${t} en ${m}`, extraClasses: (x, m) => `${x} cours en plus en ${m}`,
    updatedOn: (d) => `Mis à jour le ${d}`,
    payTitle: "Payer les cours", yourFee: "Vos frais de cours", eachMonth: "par mois",
    noPayDetails: "Votre professeur n'a pas encore ajouté ses informations de paiement. Demandez-lui comment payer.", sendTo: "Envoyez votre paiement à",
    name: (n) => `Nom : ${n}`, payWith: (k) => `Payer avec ${k}`, copy: "Copier", copied: "Copié", holdCopy: "Appuyez longuement pour copier",
    afterPay: "Après le paiement, prévenez votre professeur", yourName: "Votre nom", amount: "Montant (FCFA)", paidWith: "Payé avec", cash: "Espèces",
    payMsg: (n, a, m, w) => `Bonjour, c'est ${n} de Bright Minds. J'ai payé ${a} pour ${m} par ${w}.`, aStudent: "un élève", myFee: "mes frais de cours",
    sendWa: "Envoyer sur WhatsApp", copyMsg: "Copier le message",
    waFallback: (n) => `Si WhatsApp ne s'ouvre pas, copiez le message et envoyez-le au ${n} avec une capture d'écran du paiement.`,
    screenshot: "Après le paiement, envoyez une capture d'écran du paiement à votre professeur.",
    paid: (m) => `${cap(m)} : payé`, partial: (m) => `${cap(m)} : payé en partie`, unpaid: (m) => `${cap(m)} : pas encore payé`,
    announcement: "Annonce",
    codeOffline: "Le code n'a pas pu être vérifié. Vérifiez votre connexion internet et réessayez.", teacherSignIn: "Connexion professeur",
    installTitle: "Mettez Bright Minds sur votre écran d'accueil", installLead: "Elle s'ouvrira d'un seul geste, comme une application. Rien à télécharger, pas besoin de l'App Store.",
    installShow: "Montrez-moi comment", installNotNow: "Plus tard", installNow: "Installer Bright Minds", installOr: "Ou suivez les étapes ci-dessous.",
    installWhich: "Quel téléphone avez-vous ?", installIphone: "iPhone ou iPad", installAndroid: "Android",
    iosSteps: (host) => [`Ouvrez **${host}** dans **Safari**.`, "Touchez le bouton menu à côté de l'adresse, en bas de l'écran (**≡** ou **⋯**), puis **Partager**. Sur un iPhone plus ancien, touchez directement le bouton Partager : le carré avec une flèche vers le haut.", "Touchez la flèche **˅** pour afficher plus d'options, puis **Sur l'écran d'accueil**. Sur un iPhone plus ancien, faites défiler la liste pour le trouver.", "Si vous voyez l'option **app web**, laissez-la activée. Puis touchez **Ajouter**."],
    androidSteps: (host) => [`Ouvrez **${host}** dans **Chrome**.`, "Touchez **⋮** en haut à droite.", "Touchez **Ajouter à l'écran d'accueil** ou **Installer l'application**.", "Touchez **Installer** (ou **Ajouter**)."],
    installAfter: "L'icône Bright Minds est maintenant sur votre écran d'accueil, à côté de vos autres applications. Ouvrez-la depuis là. La première fois, tapez encore une fois votre code.",
    installDone: "Vous utilisez déjà Bright Minds depuis votre écran d'accueil.", installShare: "Envoyer ces étapes à quelqu'un",
    installCopy: "Copier le lien", installWa: "Envoyer sur WhatsApp", installWaText: (link) => `Pour mettre Bright Minds sur votre téléphone comme une application, suivez ces étapes : ${link}`,
    offline: "Bright Minds est inaccessible pour le moment. Vérifiez votre connexion internet, puis rouvrez la page.", opening: "Ouverture de Bright Minds...",
    seeClasses: "Nouvel élève ? Voir les cours et les prix", haveCode: "J'ai un code",
    joinTagline: "Cours d'anglais pour enfants et adultes, en présentiel et en ligne.", classesPrices: "Cours et prix",
    perMonth: "par mois", perClass: "par cours", perHour: "de l'heure", openGroups: "Groupes ouverts",
    spotsLeft: (n) => `${n} place${n > 1 ? "s" : ""} libre${n > 1 ? "s" : ""}`, full: "Complet",
    bookTrial: "Réserver un cours d'essai gratuit", trialMsg: "Bonjour ! Je voudrais réserver un cours d'essai gratuit avec Bright Minds.",
    trialHint: "WhatsApp s'ouvre avec un message prêt à envoyer.",
    yourLevel: (l) => `Votre niveau : ${l}`, changesTitle: "Changements", makeupLabel: "Rattrapage",
    cancelledOn: (d, t) => `${cap(d)} à ${t} : annulé`, makeupOn: (d, t) => `Cours de rattrapage le ${d} à ${t}`,
    trialBadge: "Essai gratuit", trialBanner: "Vous essayez Bright Minds gratuitement. Les élèves ont leurs propres leçons, devoirs et progrès.",
    trialBack: "Retour à l'application", trialPrices: "Cours et prix", trialWrite: "Écrire au professeur",
    trialWaMsg: "Bonjour ! J'ai essayé l'application Bright Minds et je voudrais en savoir plus sur les cours d'anglais.",
    sampleTag: "Exemple", sampleProgress: "Voici un exemple de ce que voit une famille : après chaque cours, le professeur coche ce que l'élève sait maintenant faire en anglais.",
    trialReplyLabel: "Exemple de réponse du professeur", trialReplyNote: "Très bien ! Prononce bien le r de « red ». À samedi !",
    trialTryRecord: "Essayer d'enregistrer ta réponse", trialVoiceHint: "Ici, tu t'écoutes seulement. Les élèves l'envoient à leur professeur, qui écoute et répond avec des étoiles et des conseils.",
    trialClassesTitle: "Vos cours", trialClasses: "Une fois inscrit, vos horaires, les changements et les cours qu'il vous reste s'affichent ici. Regardez les cours et les prix pour choisir un groupe.",
    trialPhrases: "Phrases de tous les jours", trialLessonTitle: "Bonjour et les couleurs",
    trialLessonNotes: "Nouveaux mots : red, blue, yellow, green\nPhrases clés : \"What's your name?\" \"My name is Awa.\" \"It's red.\"",
    trialLessonHw: "Regarde autour de toi et dis en anglais la couleur de 3 objets. Puis enregistre ta réponse.",
    tabProgress: "Progrès", cardsShort: "Cartes", listenGame: "Écouter", memoryGame: "Mémoire",
    sayIt: "Dites-le", sayItAria: (w) => `Dire « ${w} »`, hearIt: (w) => `Écouter « ${w} »`, listening: "J'écoute... touchez pour arrêter", speakNow: "Dites-le maintenant.",
    saidRight: (h) => `Bravo ! J'ai entendu « ${h} ».`, saidWrong: (h) => (h ? `J'ai entendu « ${h} ». Écoutez et réessayez.` : "Écoutez et réessayez."),
    micBlocked: "Le micro est bloqué. Autorisez-le pour ce site dans les réglages du téléphone, puis réessayez.", micNo: "Le micro ne marche pas ici sur ce téléphone.",
    micNothing: "Je n'ai rien entendu. Réessayez un peu plus fort.", recordMe: "M'enregistrer", recordAgain: "Recommencer", playMine: "Écouter le mien",
    hearModel: "Écouter le modèle", compareHint: "Écoutez les deux et comparez.",
    practiceTitle: (n) => `S'entraîner à les dire (${n})`, practiceHint: "Touchez le haut-parleur pour écouter, puis le micro pour le dire. Touchez deux fois pour écouter lentement.",
    practiceHintNoMic: "Touchez le haut-parleur pour écouter, puis dites-le à voix haute. Touchez deux fois pour écouter lentement.",
    listenTitle: "Écoute et touche", listenHow: "Écoute le mot, puis touche la bonne image.", listenHowRead: "Lis le mot, puis touche la bonne image.",
    startGame: "Commencer", hearAgain: "Réécouter", tapPicture: "Touche la bonne image", yesStar: "Oui ! Tu gagnes une étoile.", gotIt: "Oui, c'est ça !",
    starsN: (n) => `${n} étoile${n > 1 ? "s" : ""}`, starsOf: (s, n) => `${s} étoile${s > 1 ? "s" : ""} sur ${n} !`, playAgain: "Rejouer",
    pictureN: (k) => `Image ${k}`, cardN: (k) => `Carte ${k}`, pairsFound: (a, b) => `${a} paire${a > 1 ? "s" : ""} sur ${b}`, movesN: (n) => `${n} essai${n > 1 ? "s" : ""}`,
    allPairs: (n) => `Tu as trouvé toutes les paires en ${n} essais !`, memoryHow: "Trouve chaque image et son mot. Touche deux cartes.",
    recordAnswer: "Enregistrer ma réponse", recordAnother: "Enregistrer une autre réponse", recordHint: "Dites vos devoirs à voix haute. Vous pourrez écouter avant d'envoyer. 2 minutes au maximum.",
    startRec: "Commencer l'enregistrement", stopRec: "Arrêter", sendTeacher: "Envoyer au professeur", sending: "Envoi...", cancel: "Annuler",
    voiceSent: (d) => `Envoyé au professeur, ${d}`, voiceFail: "L'envoi n'a pas marché. Vérifiez votre connexion et réessayez.",
    voiceTooLong: "Cet enregistrement est trop long. Essayez en moins de 2 minutes.",
    voiceNotReady: "Les messages vocaux ne sont pas encore activés. Prévenez votre professeur, puis réessayez plus tard. Votre enregistrement est toujours là.",
    voiceSlow: "Ça prend du temps. Vérifiez votre connexion, puis touchez Envoyer à nouveau.", teacherReplied: "Votre professeur a écouté votre enregistrement",
    progressTitle: "Ce que je sais faire", skillsCount: (n) => (n > 1 ? "choses que je sais faire en anglais" : "chose que je sais faire en anglais"),
    starsFromTeacher: (n) => `${n} étoile${n > 1 ? "s" : ""} de mon professeur`, loadingProgress: "Ouverture de vos progrès...",
    noSkillsYet: "Après les cours, votre professeur coche ce que vous savez faire. Ça s'affichera ici.", comingNext: "Bientôt", canDoSince: (d) => `Depuis le ${d}`,
  },
};
const LangCtx = createContext("en");
function useT() {
  const lang = useContext(LangCtx);
  const t = (k, ...args) => { const table = STR[lang] || STR.en; const v = k in table ? table[k] : STR.en[k]; return typeof v === "function" ? v(...args) : v; };
  return { lang, t };
}

/* ---------- page data ---------- */
function normalize(d) {
  d = d || {};
  return { updated: d.updated || null, decks: arr(d.decks), lessons: arr(d.lessons), schedule: arr(d.schedule), pay: normPay(d.pay), notices: arr(d.notices), settings: normSettings(d.settings), changes: arr(d.changes), join: normJoin(d.join),
    groupCounts: d.groupCounts && typeof d.groupCounts === "object" ? d.groupCounts : {} };
}
function normJoin(j) {
  j = j && typeof j === "object" ? j : {};
  return { intro: String(j.intro || ""), contact: String(j.contact || ""), offers: arr(j.offers), groups: arr(j.groups) };
}
function normPay(p) {
  p = p && typeof p === "object" ? p : {};
  return { whatsapp: String(p.whatsapp || ""), accountName: String(p.accountName || ""), note: String(p.note || ""), methods: arr(p.methods) };
}
function normSettings(s) {
  s = s && typeof s === "object" ? s : {};
  return { showStatus: s.showStatus !== false };
}
/* WhatsApp wants the full international number as digits; Ivorian numbers are 10 digits locally. */
function waDigits(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = "225" + d;
  return d.length >= 8 ? d : "";
}
const waLink = (phone, text) => `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;

/* Student codes: 4 numbers, unique within the class list. */
function newCode(roster, exceptId) {
  const used = new Set(roster.filter((r) => r.id !== exceptId).map((r) => r.code));
  for (let i = 0; i < 500; i++) { const c = String(1000 + Math.floor(Math.random() * 9000)); if (!used.has(c)) return c; }
  return String(Date.now()).slice(-4);
}
/* ---------- the site's settings and Firebase (sign-in and database) ---------- */
const CONFIG = window.BM_CONFIG || {};
// The teacher is named in config.js by a SHA-256 fingerprint of their Google address (teacherKeys),
// so the address itself never appears on the public site. Plain teacherEmails still work too.
const TEACHERS = arr(CONFIG.teacherEmails).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
const TEACHER_KEYS = arr(CONFIG.teacherKeys).map((k) => String(k).trim().toLowerCase()).filter(Boolean);
const CONFIGURED = !!(CONFIG.firebase && CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
function startFirebase() {
  if (!CONFIGURED || !window.firebase) return null;
  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CONFIG.firebase);
    const db = app.firestore();
    try { db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { /* already set */ }
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) { /* no offline copy in this browser */ }
    return { auth: app.auth(), db };
  } catch (e) { return null; }
}
const FB = startFirebase();
const teacherSeen = {};
async function emailKey(email) {
  const bytes = new TextEncoder().encode(String(email || "").trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/* Works out once per account whether it is the teacher; isTeacherUser then answers from that. */
async function checkTeacher(u) {
  if (!u) return false;
  if (!(u.uid in teacherSeen)) {
    const email = String(u.email || "").trim().toLowerCase();
    let ok = !!email && TEACHERS.includes(email);
    if (!ok && email && TEACHER_KEYS.length) { try { ok = TEACHER_KEYS.includes(await emailKey(email)); } catch (e) { ok = false; } }
    teacherSeen[u.uid] = ok;
  }
  return teacherSeen[u.uid];
}
const isTeacherUser = (u) => !!u && teacherSeen[u.uid] === true;
async function teacherSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await FB.auth.signInWithPopup(provider); }
  catch (e) {
    const code = e && e.code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") { await FB.auth.signInWithRedirect(provider); return; }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw e;
  }
}

/* Files the teacher saves (invoices, certificates): an ordinary browser download. */
const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.rel = "noopener";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { status: "saved" };
  },
};

/* Compare values the same way whatever order the database returns their keys in. */
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

/* A student's own record: what they see after typing their code. The record's id is the code. */
function studentDoc(r) {
  const d = { id: r.id, name: r.name, group: r.group };
  if (r.level) d.level = r.level;
  if (r.due) d.due = r.due;
  if (r.st) d.st = r.st;
  return d;
}
const groupCountsOf = (roster) => { const c = {}; roster.forEach((r) => { if (r.group) c[r.group] = (c[r.group] || 0) + 1; }); return c; };

function saveRosterDocs(prev, next) {
  const db = FB.db;
  const batch = db.batch();
  const byId = new Map(prev.map((r) => [r.id, r]));
  const keep = new Set(next.map((r) => r.id));
  prev.forEach((r) => { if (!keep.has(r.id)) batch.delete(db.doc("students/" + r.code)); });
  next.forEach((r) => {
    const old = byId.get(r.id);
    if (old && old.code !== r.code) batch.delete(db.doc("students/" + old.code));
    if (!old || old.code !== r.code || stable(studentDoc(old)) !== stable(studentDoc(r))) batch.set(db.doc("students/" + r.code), studentDoc(r));
  });
  batch.set(db.doc("site/content"), { groupCounts: groupCountsOf(next), updated: new Date().toISOString() }, { mergeFields: ["groupCounts", "updated"] });
  return batch.commit();
}

/* Moving in: the backup file made from the Claude version. Running it twice is safe. */
const CONTENT_KEYS = ["decks", "lessons", "schedule", "pay", "notices", "settings", "changes", "join"];
const REL_PATH_RE = /^[A-Za-z0-9_.~-]+(\/[A-Za-z0-9_.~-]+\/[A-Za-z0-9_.~-]+)*$/;
async function importBackup(data, uid) {
  const db = FB.db;
  const writes = [];
  const content = { updated: new Date().toISOString(), groupCounts: groupCountsOf(arr(data.roster)) };
  CONTENT_KEYS.forEach((k) => { if (data.content && data.content[k] !== undefined) content[k] = data.content[k]; });
  writes.push([db.doc("site/content"), content]);
  arr(data.roster).forEach((r) => { if (r && r.code && r.id) writes.push([db.doc("students/" + r.code), studentDoc(r)]); });
  Object.keys(data.private || {}).forEach((rel) => {
    if (REL_PATH_RE.test(rel) && data.private[rel] && typeof data.private[rel] === "object") writes.push([db.doc("data/users/" + uid + "/" + rel), data.private[rel]]);
  });
  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    writes.slice(i, i + 400).forEach(([ref, body]) => b.set(ref, body));
    await b.commit();
  }
  return writes.length;
}

function ImportBackup() {
  const [file, setFile] = useState(null);
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    setState(""); setFile(null);
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.kind !== "bright-minds-backup") throw new Error("bad");
      setFile(data);
    } catch (err) { setState("That file isn't a Bright Minds backup. Choose the file Claude sent you."); }
  };
  const run = async () => {
    const u = FB && FB.auth.currentUser;
    if (!file || !u) return;
    setBusy(true); setState("Moving your data in...");
    try { await importBackup(file, u.uid); setState(`Done. ${arr(file.roster).length} students and all your records are here now.`); setFile(null); }
    catch (e) { setState("The move didn't finish. Check your connection and try again. Running it again is safe."); }
    setBusy(false);
  };
  return (
    <div className="pay-settings">
      <p className="sub-h">Move in from the Claude version</p>
      <p className="hint" style={{ marginTop: 0 }}>Choose the backup file Claude sent you. It brings in your students and their codes, classes, lessons, word lists, payments, class counts and schools. It replaces what's in the app now.</p>
      <input id="import-file" className="inp" type="file" accept=".json,application/json" aria-label="Backup file" onChange={pick} />
      {file && <p className="hint" style={{ margin: "8px 0 0" }}>{`Backup from ${file.made ? fmtDate(String(file.made).slice(0, 10)) : "the Claude version"}, with ${arr(file.roster).length} students.`}</p>}
      <div className="form-actions" style={{ marginTop: 10 }}>
        <button className="btn" onClick={run} disabled={!file || busy}>{busy ? "Moving..." : "Move my data in"}</button>
      </div>
      {state && <p className="hint" role="status" style={{ margin: "10px 0 0" }}>{state}</p>}
    </div>
  );
}

function makeQuiz(cards) {
  return shuffle(cards).slice(0, Math.min(10, cards.length)).map((c) => {
    const dir = Math.random() < 0.5 ? "en" : "fr";
    const answer = dir === "en" ? c.fr : c.en;
    const pool = [...new Set(cards.filter((x) => x.id !== c.id).map((x) => (dir === "en" ? x.fr : x.en)).filter((t) => t !== answer))];
    return { id: c.id, dir, en: c.en, pic: c.pic || "", prompt: dir === "en" ? c.en : c.fr, answer, options: shuffle([answer, ...shuffle(pool).slice(0, 3)]) };
  });
}

function parseBulk(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    if (i < 0) return null;
    const en = l.slice(0, i).trim();
    const rest = l.slice(i + 1);
    const [frPart, exPart = "", picPart = ""] = rest.split("|");
    const fr = frPart.trim();
    const ex = exPart.trim();
    const pic = picPart.trim().slice(0, 16);
    return en && fr ? (pic ? { id: uid(), en, fr, ex, pic } : { id: uid(), en, fr, ex }) : null;
  }).filter(Boolean);
}

function whenLabel(at, t, lang) {
  const now = new Date();
  if (at <= now) return t("now");
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d1 = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const diff = Math.round((d1 - d0) / 86400000);
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  if (diff === 0) return t("todayAt", time);
  if (diff === 1) return t("tomorrowAt", time);
  return t("dayAt", DAYS[lang][(at.getDay() + 6) % 7], time);
}

/* ---------- private records (teacher only) ---------- */
const writeChains = {};
function queuedSet(ref, body) {
  const run = (writeChains[ref.path] || Promise.resolve()).then(() => ref.set(body));
  writeChains[ref.path] = run.catch(() => {});
  return run;
}

function useMoney(db, userId, month) {
  const enabled = !!(db && userId);
  const [fees, setFees] = useState({});
  const [pays, setPays] = useState([]);
  const [feesOk, setFeesOk] = useState(false);
  const [paysOk, setPaysOk] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const feesPath = enabled ? "data/users/" + userId + "/money" : "";
  const monthPath = enabled ? feesPath + "/months/" + month : "";

  useEffect(() => {
    if (!feesPath) return undefined;
    let un = () => {};
    const timer = setTimeout(() => setSlow(true), 10000);
    try {
      un = db.doc(feesPath).onSnapshot((s) => {
        const d = s.exists ? s.data() : null;
        setFees(d && d.fees && typeof d.fees === "object" ? d.fees : {});
        setFeesOk(true);
        if (!s.metadata.fromCache) { clearTimeout(timer); setSlow(false); }
      }, () => { clearTimeout(timer); setFailed(true); });
    } catch (e) { clearTimeout(timer); setFailed(true); }
    return () => { clearTimeout(timer); un(); };
  }, [feesPath]);

  useEffect(() => {
    if (!monthPath) return undefined;
    setPaysOk(false); setPays([]);
    let un = () => {};
    try {
      un = db.doc(monthPath).onSnapshot((s) => {
        const d = s.exists ? s.data() : null;
        setPays(d && Array.isArray(d.payments) ? d.payments : []);
        setPaysOk(true);
      }, () => setFailed(true));
    } catch (e) { setFailed(true); }
    return () => un();
  }, [monthPath]);

  const saveFees = (next) => { setFees(next); return queuedSet(db.doc(feesPath), { fees: next }); };
  const savePays = (next) => { setPays(next); return queuedSet(db.doc(monthPath), { payments: next }); };
  return { enabled, fees, pays, ready: feesOk && paysOk, slow, failed, saveFees, savePays };
}

/* Classes taken, one private document per month:
   { taken: [{ id, studentId, date, slot?, place?, note? }], absent: [{ id, studentId, date, slot?, place? }] }
   A note is the teacher's own record of that class. Absences don't count as classes taken. */
function useAttendance(db, userId, month) {
  const path = db && userId ? "data/users/" + userId + "/money/attendance/" + month : "";
  const [taken, setTaken] = useState([]);
  const [absent, setAbsent] = useState([]);
  const [ready, setReady] = useState(false);
  const cur = useRef({ taken: [], absent: [] });
  useEffect(() => {
    if (!path) return undefined;
    setTaken([]); setAbsent([]); setReady(false); cur.current = { taken: [], absent: [] };
    let un = () => {};
    try {
      un = db.doc(path).onSnapshot((s) => {
        const d = s.exists ? s.data() : null;
        const t = d && Array.isArray(d.taken) ? d.taken : [];
        const ab = d && Array.isArray(d.absent) ? d.absent : [];
        cur.current = { taken: t, absent: ab };
        setTaken(t); setAbsent(ab); setReady(true);
      }, () => {});
    } catch (e) { /* attendance unavailable */ }
    return () => un();
  }, [path]);
  const save = (next, nextAbsent) => {
    const ab = nextAbsent === undefined ? cur.current.absent : nextAbsent;
    cur.current = { taken: next, absent: ab };
    setTaken(next); setAbsent(ab);
    return queuedSet(db.doc(path), { taken: next, absent: ab });
  };
  return { on: !!path, ready, taken, absent, month, save };
}

/* Where a class happened, and how much of the fee goes to that place. */
function placeOfTaken(x, schedule, changes) {
  if (typeof x.place === "string") return x.place;
  let s = schedule.find((y) => y.id === x.slot);
  if (!s) { const c = changes.find((y) => y.id === x.slot); if (c) s = schedule.find((y) => y.id === c.slot); }
  return placeName(s);
}
function shareSplit(r, takenList, ctx) {
  const map = {};
  arr(ctx && ctx.places).forEach((p) => { map[placeKey(p.name)] = Number(p.pct) || 0; });
  const schedule = arr(ctx && ctx.schedule), changes = arr(ctx && ctx.changes);
  const out = {};
  const add = (p, w) => { const v = ((map[placeKey(p)] || 0) * w) / 100; if (v > 0) out[p] = (out[p] || 0) + v; };
  if (takenList.length) takenList.forEach((x) => add(placeOfTaken(x, schedule, changes), 1 / takenList.length));
  else { const slots = schedule.filter((s) => s.group === r.group); slots.forEach((s) => add(placeName(s), 1 / slots.length)); }
  return out;
}
function isOnline(r, schedule) {
  const slots = schedule.filter((s) => s.group === r.group);
  return slots.length > 0 && slots.every((s) => s.link || ONLINE_RE.test(s.place || ""));
}

/* One student's month: fee, payments, classes, shares. Used by the Students tab, income and what students see. */
function studentMonth(r, fees, pays, taken, ctx) {
  const f = fees[r.id] || {};
  const fee = Number(f.fee) || 0;
  const legacyShare = Number(f.share) || 0;
  const myPays = pays.filter((p) => p.studentId === r.id).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const paid = myPays.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const status = fee > 0 ? (paid >= fee ? "paid" : paid > 0 ? "partial" : "unpaid") : paid > 0 ? "paid" : "none";
  const classesCustom = f.classes !== undefined && f.classes !== null && f.classes !== "";
  const classes = classesCustom ? Number(f.classes) || 0 : DEFAULT_CLASSES;
  const takenList = taken.filter((t) => t.studentId === r.id).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const split = shareSplit(r, takenList, ctx);
  if (!Object.keys(split).length && legacyShare) split.Venue = legacyShare / 100;
  const cutByPlace = {};
  let cut = 0;
  Object.keys(split).forEach((p) => { cutByPlace[p] = paid * split[p]; cut += cutByPlace[p]; });
  return { fee, share: legacyShare, pays: myPays, paid, status, classes, classesCustom, takenList, used: takenList.length, left: classes - takenList.length,
    phone: f.phone || "", lang: f.lang === "fr" ? "fr" : "en", cut, cutByPlace, online: isOnline(r, arr(ctx && ctx.schedule)) };
}
function computeStatuses(roster, fees, pays, taken, month) {
  const out = {};
  roster.forEach((r) => {
    const s = studentMonth(r, fees, pays, taken);
    out[r.id] = { m: month, left: s.left, total: s.classes, pay: s.fee > 0 ? s.status : "none" };
  });
  return out;
}

/* Messages the teacher sends on WhatsApp, in each family's language. */
const SITE_URL = (() => { try { return window.location.origin + window.location.pathname.replace(/index\.html$/, ""); } catch (e) { return ""; } })();
const SITE_HOST = (() => { try { return window.location.host || "brightmindsci.github.io"; } catch (e) { return "brightmindsci.github.io"; } })();
const codeText = (r, lang) => (lang === "fr"
  ? `Bonjour ${r.name} ! Votre code Bright Minds est ${r.code}. Ouvrez ${SITE_URL} et tapez ce code.\n\nPour la garder sur votre téléphone comme une application : ${SITE_URL}#install`
  : `Hi ${r.name}! Your Bright Minds code is ${r.code}. Open ${SITE_URL} and type it in.\n\nTo keep it on your phone like an app: ${SITE_URL}#install`);
function reminderText(r, month, pay) {
  const fr = r.lang === "fr";
  const m = monthLabel(month, r.lang);
  const rest = Math.max(0, r.fee - r.paid);
  const kinds = pay.methods.filter((x) => x.number || x.link).map((x) => x.kind);
  if (fr) {
    const how = kinds.length ? ` Vous pouvez payer par ${kinds.join(", ")}, les détails sont dans l'application, onglet Payer.` : "";
    return `Bonjour ${r.name}, petit rappel de Bright Minds : les frais de cours de ${m} sont de ${fcfa(r.fee)}${r.paid > 0 ? `, et il reste ${fcfa(rest)} à payer` : ""}.${how} Merci !`;
  }
  const how = kinds.length ? ` You can pay by ${kinds.join(", ")}. The details are in the class app, under Pay.` : "";
  return `Hello ${r.name}, a friendly reminder from Bright Minds: the class fee for ${m} is ${fcfa(r.fee)}${r.paid > 0 ? `, and ${fcfa(rest)} is still to pay` : ""}.${how} Thank you!`;
}
function reportText(r, month, lessons, decks, comment) {
  const fr = r.lang === "fr";
  const m = monthLabel(month, r.lang);
  const dates = r.takenList.map((x) => fmtShort(x.date, r.lang));
  const mine = lessons.filter((l) => (l.date || "").startsWith(month) && forGroup(lessonGroups(l), r.group)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const hw = mine.filter((l) => l.homework).length;
  const lists = decks.filter((d) => forGroup(d.group, r.group) && d.cards.length);
  const lines = [fr ? `Bright Minds : bilan de ${m} pour ${r.name}` : `Bright Minds: ${m} report for ${r.name}`, ""];
  const count = r.classes ? (fr ? `${r.used} sur ${r.classes}` : `${r.used} of ${r.classes}`) : String(r.used);
  lines.push((fr ? "Cours suivis : " : "Classes attended: ") + count + (dates.length ? ` (${dates.join(", ")})` : ""));
  if (mine.length) lines.push((fr ? "Leçons : " : "Lessons: ") + mine.map((l) => l.title).join("; "));
  if (hw) lines.push((fr ? "Devoirs donnés : " : "Homework given: ") + hw);
  if (lists.length) lines.push((fr ? "Vocabulaire à réviser dans l'application : " : "Words to practice in the app: ") + lists.map((d) => `${d.title} (${d.cards.length})`).join(", "));
  if (comment.trim()) lines.push("", comment.trim());
  lines.push("", fr ? "Merci pour votre confiance !" : "Thank you for your trust!");
  return lines.join("\n");
}

/* ---------- icons ---------- */
const ICONS = {
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  clipboard: <><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  volume: <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>,
  shuffle: <><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" /><path d="m18 2 4 4-4 4" /><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" /><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" /><path d="m18 14 4 4-4 4" /></>,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6M14 11v6" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  again: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  pencil: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>,
  megaphone: <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
  video: <><path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  spark: <path d="M9.9 15.5A2 2 0 0 0 8.5 14.1l-6.1-1.6a.5.5 0 0 1 0-1l6.1-1.6a2 2 0 0 0 1.4-1.4l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z" />,
  briefcase: <><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></>,
  star: <path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z" />,
  stop: <rect width="12" height="12" x="6" y="6" rx="2" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  award: <><circle cx="12" cy="8" r="6" /><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  report: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8M16 13H8M16 17H8" /></>,
};
function Icon({ name, size = 18, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : "true"} role={label ? "img" : undefined} aria-label={label} focusable="false">{ICONS[name]}</svg>
  );
}

/* ---------- small pieces ---------- */
function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function Empty({ text, children }) {
  return <div className="empty"><p>{text}</p>{children}</div>;
}
function ConfirmButton({ onConfirm, label = "Delete", iconOnly = false }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" className={"btn ghost sm danger" + (armed ? " armed" : "")} aria-label={iconOnly && !armed ? label : undefined}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? (iconOnly ? "Delete?" : "Tap again to delete") : <><Icon name="trash" size={15} />{!iconOnly && label}</>}
    </button>
  );
}
function CopyButton({ text, label, caption }) {
  const { t } = useT();
  const [state, setState] = useState("");
  const copy = () => {
    const show = (s) => { setState(s); setTimeout(() => setState(""), 2500); };
    try { navigator.clipboard.writeText(text).then(() => show(t("copied")), () => show(t("holdCopy"))); }
    catch (e) { show(t("holdCopy")); }
  };
  return <button type="button" className="btn ghost sm" onClick={copy} aria-label={label}>{state || caption || t("copy")}</button>;
}
function WaButton({ phone, text, children, ghost = false }) {
  return (
    <a className={"btn sm" + (ghost ? " ghost" : "")} href={waLink(phone, text)} target="_blank" rel="noopener noreferrer">
      <Icon name="chat" size={16} />{children}
    </a>
  );
}

/* ---------- welcome ---------- */
/* ---------- putting the site on the Home Screen, like an app ---------- */
const deviceKind = () => {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/i.test(ua) ? "android" : "other";
};
const isHomeScreenApp = () => {
  try { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; } catch (e) { return false; }
};
let installEvt = null; // Chrome on Android offers its own install prompt; keep it for our button
const installSubs = new Set();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; installSubs.forEach((f) => f()); });
window.addEventListener("appinstalled", () => { installEvt = null; installSubs.forEach((f) => f()); });
function useInstallPrompt() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); installSubs.add(f); return () => { installSubs.delete(f); }; }, []);
  const run = async () => {
    const e = installEvt;
    if (!e) return;
    installEvt = null;
    try { await e.prompt(); await e.userChoice; } catch (err) { /* the phone shows its own message */ }
    installSubs.forEach((f) => f());
  };
  return { can: !!installEvt, run };
}
const openInstall = () => { window.location.hash = "#install"; window.scrollTo(0, 0); };

function InstallGuide() {
  const { t } = useT();
  const [os, setOs] = useState(() => (deviceKind() === "android" ? "android" : "ios"));
  const ip = useInstallPrompt();
  const steps = t(os === "ios" ? "iosSteps" : "androidSteps", SITE_HOST);
  return (
    <>
      <p className="day-name">{t("installWhich")}</p>
      <div className="seg install-seg">
        <button aria-pressed={os === "ios"} onClick={() => setOs("ios")}>{t("installIphone")}</button>
        <button aria-pressed={os === "android"} onClick={() => setOs("android")}>{t("installAndroid")}</button>
      </div>
      {os === "android" && ip.can && (
        <div className="lib-use"><button className="btn" onClick={ip.run}>{t("installNow")}</button><p className="hint">{t("installOr")}</p></div>
      )}
      <ol className="install-steps">
        {steps.map((step, k) => <li key={os + k}><span className="step-n" aria-hidden="true">{k + 1}</span><span>{mdInline(step, os + k)}</span></li>)}
      </ol>
      <p className="note">{t("installAfter")}</p>
    </>
  );
}

function InstallPage({ onBack, onLang }) {
  const { t } = useT();
  const link = SITE_URL + "#install";
  return (
    <div className="welcome">
      <div className="welcome-lang between">
        <button className="link" onClick={onBack}>{t("back")}</button>
        <button className="link" onClick={onLang} aria-label={t("otherLangName")}>{t("otherLang")}</button>
      </div>
      <img src="icon-192.png" alt="" width="64" height="64" className="install-icon big" />
      <h1 className="install-h">{t("installTitle")}</h1>
      {isHomeScreenApp() ? <p className="note">{t("installDone")}</p> : <p className="hint">{t("installLead")}</p>}
      <InstallGuide />
      <div className="day-block">
        <p className="day-name">{t("installShare")}</p>
        <p className="install-link">{link}</p>
        <div className="pay-actions">
          <a className="btn sm" href={"https://wa.me/?text=" + encodeURIComponent(t("installWaText", link))} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} />{t("installWa")}</a>
          <CopyButton text={link} label={t("installCopy")} caption={t("installCopy")} />
        </div>
      </div>
    </div>
  );
}

function InstallCard({ onHide }) {
  const { t } = useT();
  const ip = useInstallPrompt();
  if (isHomeScreenApp()) return null;
  return (
    <div className="install-card">
      <img src="icon-192.png" alt="" width="44" height="44" className="install-icon" />
      <div className="install-text">
        <p className="install-card-title">{t("installTitle")}</p>
        <p className="hint">{t("installLead")}</p>
        <div className="pay-actions">
          {ip.can ? <button className="btn sm" onClick={ip.run}>{t("installNow")}</button> : <button className="btn sm" onClick={openInstall}>{t("installShow")}</button>}
          {ip.can && <button className="btn ghost sm" onClick={openInstall}>{t("installShow")}</button>}
          {onHide && <button className="btn ghost sm" onClick={onHide}>{t("installNotNow")}</button>}
        </div>
      </div>
    </div>
  );
}

function Welcome({ canTeach, signedIn, notTeacher, onStudent, onTeacher, onSignIn, onSignOut, onLang, onJoin }) {
  const { t } = useT();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (code.length < 4) { setErr(t("codeShort")); return; }
    setBusy(true); setErr("");
    try {
      const s = await FB.db.doc("students/" + code).get();
      if (s.exists && isStudentRecord(s.data())) onStudent({ ...s.data(), code });
      else setErr(t("codeWrong"));
    } catch (e) { setErr(t("codeOffline")); }
    setBusy(false);
  };
  return (
    <div className="welcome">
      <div className="welcome-lang"><button className="link" onClick={onLang} aria-label={t("otherLangName")}>{t("otherLang")}</button></div>
      <div className="panel rings welcome-page">
        <h1 className="welcome-title">Bright Minds</h1>
        <p className="welcome-sub">{t("tagline")}</p>
      </div>
      <h2 className="h">{t("enterCode")}</h2>
      <p className="hint">{t("codeHint")}</p>
      <div className="inline-add">
        <input id="my-code" className="inp code-inp" type="text" inputMode="numeric" autoComplete="off" maxLength={4} aria-label={t("yourCode")}
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && open()} />
        <button className="btn" onClick={open} disabled={!code || busy}>{t("open")}</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="stack" style={{ marginTop: 8 }}>
        <button className="btn ghost" onClick={onJoin}>{t("seeClasses")}</button>
        <button className="btn ghost" onClick={() => onStudent(null)}>{t("noCode")}</button>
        {canTeach && <button className="btn" onClick={onTeacher}>Open teacher view</button>}
      </div>
      <InstallCard />
      <div className="teacher-link">
        {notTeacher
          ? <p className="hint">{notTeacher} isn't the teacher account. <button className="link" onClick={onSignOut}>Sign out</button></p>
          : !signedIn && <button className="link small" onClick={onSignIn}>{t("teacherSignIn")}</button>}
      </div>
    </div>
  );
}

/* ---------- words: study ---------- */
/* ---------- saying it: the phone listens and checks ---------- */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
function normSay(s) {
  return String(s || "").toLowerCase().replace(/[’‘`]/g, "'")
    .replace(/\b(\w+)'m\b/g, "$1 am").replace(/\b(\w+)'re\b/g, "$1 are").replace(/\b(\w+)n't\b/g, "$1 not").replace(/\b(\w+)'ll\b/g, "$1 will")
    .replace(/\b(it|that|what|where|who|how|there|here|he|she)'s\b/g, "$1 is").replace(/\bcan not\b/g, "cannot")
    .replace(/\d+/g, (n) => (Number(n) <= 20 ? NUM_WORDS[Number(n)] : n))
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function sameSaid(heard, target) {
  const h = normSay(heard), w = normSay(target);
  if (!h || !w) return false;
  if (h === w || (" " + h + " ").includes(" " + w + " ")) return true;
  if (w.includes(" ") && w.includes(h) && h.length >= w.length * 0.7) return true;
  return editDistance(h, w) <= Math.max(1, Math.floor(w.length * 0.25));
}
const canSay = (text) => !!text && !/_{2,}/.test(text) && /[a-z]/i.test(text);

function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* Records from the microphone, up to maxSecs. */
function useRecorder(maxSecs) {
  const { t } = useT();
  const [state, setState] = useState("idle");
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const r = useRef({ mr: null, stream: null, timer: null, t0: 0, audio: null, url: "" });
  const setUrlSafe = (u) => { if (r.current.url) URL.revokeObjectURL(r.current.url); r.current.url = u; setUrl(u); };
  const release = () => { const x = r.current; clearInterval(x.timer); if (x.stream) x.stream.getTracks().forEach((tr) => tr.stop()); x.stream = null; };
  useEffect(() => () => {
    const x = r.current;
    if (x.mr && x.mr.state !== "inactive") { x.mr.onstop = null; try { x.mr.stop(); } catch (e) { /* already stopped */ } }
    release();
    if (x.url) URL.revokeObjectURL(x.url);
  }, []);
  const start = async () => {
    setError("");
    try { if (canSpeak) window.speechSynthesis.cancel(); } catch (e) { /* nothing playing */ }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { setError(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? t("micBlocked") : t("micNo")); return; }
    const mime = pickMime();
    let mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 }); }
    catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { stream.getTracks().forEach((x) => x.stop()); setError(t("micNo")); return; } }
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const took = Math.max(1, Math.round((Date.now() - r.current.t0) / 1000));
      release();
      const b = new Blob(chunks, { type: (mr.mimeType || mime || "audio/webm").split(";")[0] });
      if (!b.size) { setState("idle"); setError(t("micNothing")); return; }
      setBlob(b); setSecs(Math.min(took, maxSecs)); setUrlSafe(URL.createObjectURL(b)); setState("done");
    };
    r.current.mr = mr; r.current.stream = stream; r.current.t0 = Date.now();
    mr.start(1000);
    setBlob(null); setSecs(0); setState("recording");
    r.current.timer = setInterval(() => {
      const s = Math.floor((Date.now() - r.current.t0) / 1000);
      setSecs(s);
      if (s >= maxSecs && mr.state !== "inactive") { try { mr.stop(); } catch (e) { /* stopped */ } }
    }, 250);
  };
  const stop = () => { const mr = r.current.mr; if (mr && mr.state !== "inactive") { try { mr.stop(); } catch (e) { /* stopped */ } } };
  const play = () => {
    if (!r.current.url) return;
    try { if (!r.current.audio) r.current.audio = new Audio(); r.current.audio.src = r.current.url; r.current.audio.play().catch(() => {}); } catch (e) { /* can't play */ }
  };
  const reset = () => { setBlob(null); setUrlSafe(""); setState("idle"); setSecs(0); setError(""); };
  return { state, secs, blob, url, error, start, stop, play, reset };
}

/* Where the phone can't recognise speech: record yourself and compare. */
function RecordCompare({ text }) {
  const { t } = useT();
  const rec = useRecorder(8);
  if (!canRecord) return null;
  return (
    <div className="say-it">
      <div className="say-row">
        {rec.state === "recording"
          ? <button className="btn sm rec" onClick={rec.stop}><Icon name="stop" size={15} />{t("stopRec")} {mmss(rec.secs)}</button>
          : <button className="btn ghost sm" onClick={rec.start}><Icon name="mic" size={16} />{rec.url ? t("recordAgain") : t("recordMe")}</button>}
        {rec.url && rec.state !== "recording" && <button className="btn ghost sm" onClick={rec.play}><Icon name="play" size={15} />{t("playMine")}</button>}
        {rec.url && rec.state !== "recording" && canSpeak && <button className="btn ghost sm" onClick={() => speak(text)}><Icon name="volume" size={15} />{t("hearModel")}</button>}
      </div>
      {rec.error ? <p className="say-result error" role="alert">{rec.error}</p> : rec.url && <p className="hint">{t("compareHint")}</p>}
    </div>
  );
}

/* "Say it": listens once, then says whether it understood. */
function SayIt({ text, compact = false }) {
  const { t } = useT();
  const [state, setState] = useState("idle");
  const [heard, setHeard] = useState("");
  const [err, setErr] = useState("");
  const recRef = useRef(null);
  useEffect(() => () => { try { if (recRef.current) recRef.current.abort(); } catch (e) { /* stopped */ } }, []);
  useEffect(() => { setState("idle"); setHeard(""); setErr(""); }, [text]);
  if (!canSay(text)) return null;
  if (!SpeechRec) return compact ? null : <RecordCompare text={text} />;
  const start = () => {
    try { if (canSpeak) window.speechSynthesis.cancel(); } catch (e) { /* nothing playing */ }
    let r;
    try { r = new SpeechRec(); } catch (e) { setState("error"); setErr(t("micNo")); return; }
    recRef.current = r;
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 5; r.continuous = false;
    let got = false;
    r.onresult = (e) => {
      got = true;
      const alts = [];
      for (let i = 0; i < e.results.length; i++) for (let j = 0; j < e.results[i].length; j++) alts.push(e.results[i][j].transcript);
      const hit = alts.find((a) => sameSaid(a, text));
      setHeard(String(hit || alts[0] || "").trim());
      setState(hit ? "good" : "again");
    };
    r.onerror = (e) => {
      got = true; setState("error");
      setErr(e.error === "not-allowed" || e.error === "service-not-allowed" ? t("micBlocked") : e.error === "no-speech" ? t("micNothing") : t("micNo"));
    };
    r.onend = () => { if (!got) { setState("error"); setErr(t("micNothing")); } };
    setState("listening"); setHeard(""); setErr("");
    try { r.start(); } catch (e) { setState("error"); setErr(t("micNo")); }
  };
  const stop = () => { try { if (recRef.current) recRef.current.stop(); } catch (e) { /* stopped */ } };
  const listening = state === "listening";
  const msg = listening ? t("speakNow") : state === "good" ? t("saidRight", heard) : state === "again" ? t("saidWrong", heard) : state === "error" ? err : "";
  if (compact) {
    return (
      <span className="say-compact">
        <button className={"icon-btn" + (listening ? " listening" : "")} aria-label={listening ? t("listening") : t("sayItAria", text)} onClick={listening ? stop : start}><Icon name="mic" size={17} /></button>
        <span className={"say-mark " + state} role="status" aria-label={msg}>{state === "good" ? <Icon name="check" size={16} /> : state === "again" || state === "error" ? <Icon name="again" size={15} /> : null}</span>
      </span>
    );
  }
  return (
    <div className="say-it">
      <button className={"btn sm" + (listening ? " rec" : " ghost")} onClick={listening ? stop : start}><Icon name="mic" size={16} />{listening ? t("listening") : t("sayIt")}</button>
      {msg && <p className={"say-result " + state} role="status">{msg}</p>}
    </div>
  );
}

/* ---------- picture games for kids ---------- */
function ListenTap({ deck }) {
  const { t } = useT();
  const pool = deck.cards.filter((c) => c.pic);
  const rounds = Math.min(8, pool.length * 2);
  const makeRound = (prevId) => {
    const target = shuffle(pool.filter((c) => c.id !== prevId))[0] || pool[0];
    const seen = new Set([target.pic]);
    const others = shuffle(pool.filter((c) => c.id !== target.id)).filter((c) => (seen.has(c.pic) ? false : (seen.add(c.pic), true))).slice(0, 3);
    return { target, options: shuffle([target, ...others]) };
  };
  const [started, setStarted] = useState(false);
  const [n, setN] = useState(0);
  const [round, setRound] = useState(null);
  const [stars, setStars] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [right, setRight] = useState(false);
  const begin = () => { const r = makeRound(); setRound(r); setN(0); setStars(0); setWrong([]); setRight(false); setStarted(true); speak(r.target.en); };
  const next = () => {
    if (n + 1 >= rounds) { setN(rounds); return; }
    const r = makeRound(round.target.id);
    setRound(r); setN(n + 1); setWrong([]); setRight(false); speak(r.target.en);
  };
  const tap = (c) => {
    if (right) return;
    speak(c.en);
    if (c.id === round.target.id) { setRight(true); if (!wrong.length) setStars((s) => s + 1); }
    else setWrong((w) => [...w, c.id]);
  };
  if (!started) {
    return (
      <div className="panel game-start">
        <p className="game-title">{t("listenTitle")}</p>
        <p className="muted">{canSpeak ? t("listenHow") : t("listenHowRead")}</p>
        <button className="btn" onClick={begin}><Icon name="play" size={16} />{t("startGame")}</button>
      </div>
    );
  }
  if (n >= rounds) {
    return (
      <div>
        <div className="panel result">
          <p className="game-stars big" aria-hidden="true">{Array.from({ length: Math.max(1, Math.round((stars / rounds) * 3)) }, (_, k) => <Icon key={k} name="star" size={34} />)}</p>
          <p className="result-big">{t("starsOf", stars, rounds)}</p>
        </div>
        <button className="btn" onClick={begin}><Icon name="again" size={16} />{t("playAgain")}</button>
      </div>
    );
  }
  return (
    <div>
      <div className="game-bar">
        <span className="muted small">{t("xOfY", n + 1, rounds)}</span>
        <span className="game-stars" aria-label={t("starsN", stars)}>{Array.from({ length: stars }, (_, k) => <Icon key={k} name="star" size={16} />)}</span>
      </div>
      <div className="panel game-ask">
        {canSpeak
          ? <button className="btn ghost" onClick={() => speak(round.target.en)}><Icon name="volume" size={18} />{t("hearAgain")}</button>
          : <span className="face-word">{round.target.en}</span>}
        <span className="face-hint">{t("tapPicture")}</span>
      </div>
      <div className="pic-grid">
        {round.options.map((c, k) => {
          const isR = right && c.id === round.target.id;
          const isW = wrong.includes(c.id);
          return (
            <button key={c.id} className={"pic-opt" + (isR ? " right" : "") + (isW ? " wrong" : "")} onClick={() => tap(c)} disabled={isW || right}
              aria-label={isR || isW ? c.en : t("pictureN", k + 1)}>
              <span className="pic-big" aria-hidden="true">{c.pic}</span>
              {(isR || isW) && <span className="pic-word">{c.en}</span>}
            </button>
          );
        })}
      </div>
      {right && (
        <div className="feedback">
          <p className="verdict" role="status">{wrong.length ? t("gotIt") : t("yesStar")}</p>
          <button className="btn" onClick={next}>{n + 1 < rounds ? t("nextQ") : t("seeScore")}</button>
        </div>
      )}
    </div>
  );
}

function Memory({ deck }) {
  const { t } = useT();
  const pool = deck.cards.filter((c) => c.pic);
  const pairs = Math.min(6, pool.length);
  const deal = () => shuffle(shuffle(pool).slice(0, pairs).flatMap((c) => [{ key: c.id + "p", id: c.id, kind: "pic", c }, { key: c.id + "w", id: c.id, kind: "word", c }]));
  const [tiles, setTiles] = useState(deal);
  const [open, setOpen] = useState([]);
  const [found, setFound] = useState([]);
  const [moves, setMoves] = useState(0);
  const busy = useRef(false);
  const flip = (tile) => {
    if (busy.current || open.includes(tile.key) || found.includes(tile.id)) return;
    speak(tile.c.en);
    if (!open.length) { setOpen([tile.key]); return; }
    const first = tiles.find((x) => x.key === open[0]);
    setMoves((m) => m + 1);
    if (first && first.id === tile.id) { setFound((f) => [...f, tile.id]); setOpen([]); return; }
    setOpen([open[0], tile.key]);
    busy.current = true;
    setTimeout(() => { setOpen([]); busy.current = false; }, 1100);
  };
  const restart = () => { setTiles(deal()); setOpen([]); setFound([]); setMoves(0); };
  const won = found.length === pairs;
  const starsWon = moves <= pairs + 2 ? 3 : moves <= pairs * 2 ? 2 : 1;
  return (
    <div>
      <div className="game-bar">
        <span className="muted small">{t("pairsFound", found.length, pairs)}</span>
        <span className="muted small">{t("movesN", moves)}</span>
      </div>
      {won && (
        <div className="panel result">
          <p className="game-stars big" aria-hidden="true">{Array.from({ length: starsWon }, (_, k) => <Icon key={k} name="star" size={34} />)}</p>
          <p className="result-big" role="status">{t("allPairs", moves)}</p>
        </div>
      )}
      <div className="mem-grid">
        {tiles.map((x, k) => {
          const shown = open.includes(x.key) || found.includes(x.id);
          return (
            <button key={x.key} className={"mem-tile" + (shown ? " shown" : "") + (found.includes(x.id) ? " found" : "")} onClick={() => flip(x)}
              aria-label={shown ? x.c.en : t("cardN", k + 1)} aria-pressed={shown}>
              {shown ? (x.kind === "pic" ? <span className="pic-mid" aria-hidden="true">{x.c.pic}</span> : <span className="mem-word">{x.c.en}</span>) : <span className="mem-back" aria-hidden="true">?</span>}
            </button>
          );
        })}
      </div>
      {won ? <button className="btn" onClick={restart}><Icon name="again" size={16} />{t("playAgain")}</button> : <p className="hint">{t("memoryHow")}</p>}
    </div>
  );
}

function Flashcards({ cards }) {
  const { t } = useT();
  const [order, setOrder] = useState(() => cards.map((_, k) => k));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setOrder(cards.map((_, k) => k)); setI(0); setFlipped(false); }, [cards.length]);
  const card = cards[order[i]] || cards[0];
  if (!card) return null;
  const go = (d) => { setFlipped(false); setI((x) => (x + d + order.length) % order.length); };
  const mix = () => { setOrder(shuffle(cards.map((_, k) => k))); setI(0); setFlipped(false); };
  const sayExample = flipped && card.ex;
  return (
    <div>
      <div key={order[i]} className={"flip" + (flipped ? " is-flipped" : "")}>
        <button type="button" className="flip-inner" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? t("ariaBack", card.fr) : t("ariaFront", card.en)}>
          <span className="face panel face-front">
            {card.pic && <span className="face-pic" aria-hidden="true">{card.pic}</span>}
            <span className="face-word">{card.en}</span>
            <span className="face-hint">{t("tapMeaning")}</span>
          </span>
          <span className="face panel face-back">
            {card.pic && <span className="face-pic small" aria-hidden="true">{card.pic}</span>}
            <span className="face-word">{card.fr}</span>
            {card.ex && <span className="face-ex">{card.ex}</span>}
          </span>
        </button>
      </div>
      <div className="card-tools">
        <span className="muted small">{t("xOfY", i + 1, order.length)}</span>
        {canSpeak && (
          <button className="btn ghost sm" onClick={() => speak(sayExample ? card.ex : card.en)}>
            <Icon name="volume" size={16} />{sayExample ? t("hearSentence") : t("hearWord")}
          </button>
        )}
      </div>
      <SayIt text={card.en} />
      <div className="card-nav">
        <button className="btn ghost" onClick={() => go(-1)}><Icon name="left" />{t("back")}</button>
        <button className="btn ghost" onClick={mix}><Icon name="shuffle" size={16} />{t("mix")}</button>
        <button className="btn" onClick={() => go(1)}>{t("next")}<Icon name="right" /></button>
      </div>
    </div>
  );
}

function Quiz({ deck }) {
  const { t } = useT();
  const cards = deck.cards;
  const [qs, setQs] = useState(() => makeQuiz(cards));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => (ls.get("bm:best", {}) || {})[deck.id] || null);
  const [newBest, setNewBest] = useState(false);
  const restart = () => { setQs(makeQuiz(cards)); setIdx(0); setPicked(null); setScore(0); setNewBest(false); };

  if (cards.length < 4) return <Empty text={t("quizMin")} />;

  if (idx >= qs.length) {
    const total = qs.length;
    const msg = score === total ? t("perfect") : score / total >= 0.7 ? t("great") : t("practiceMore");
    return (
      <div>
        <div className="panel result">
          <p className="muted">{t("yourScore")}</p>
          <p className="result-big">{t("xOfY", score, total)}</p>
          <p>{msg}</p>
          {newBest ? <p className="new-best">{t("newBest")}</p> : best && <p className="muted small" style={{ marginTop: 4 }}>{t("best", best.score, best.total)}</p>}
        </div>
        <button className="btn" onClick={restart}><Icon name="again" size={16} />{t("tryAgain")}</button>
      </div>
    );
  }

  const q = qs[idx];
  const pick = (o) => { if (picked !== null) return; setPicked(o); if (o === q.answer) setScore((s) => s + 1); };
  const next = () => {
    const n = idx + 1;
    if (n >= qs.length && score > 0 && (!best || score / qs.length > best.score / best.total)) {
      const b = { score, total: qs.length };
      setBest(b); setNewBest(true);
      ls.set("bm:best", { ...(ls.get("bm:best", {}) || {}), [deck.id]: b });
    }
    setPicked(null); setIdx(n);
  };
  return (
    <div>
      <p className="muted small" style={{ marginBottom: 8 }}>{t("questionN", idx + 1, qs.length)}</p>
      <div className="panel q-prompt">
        <span className="face-hint">{q.dir === "en" ? t("whatMeans") : t("howSay")}</span>
        {q.pic && <span className="face-pic small" aria-hidden="true">{q.pic}</span>}
        <span className="face-word">{q.prompt}</span>
      </div>
      <div className="options">
        {q.options.map((o) => {
          const isRight = picked !== null && o === q.answer;
          const isWrong = picked !== null && o === picked && o !== q.answer;
          return (
            <button key={o} className={"opt" + (isRight ? " right" : "") + (isWrong ? " wrong" : "")} disabled={picked !== null} onClick={() => pick(o)}>
              <span>{o}</span>
              {isRight && <Icon name="check" size={20} label={t("correctAnswer")} />}
              {isWrong && <Icon name="x" size={20} label={t("yourAnswer")} />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="verdict" role="status">{picked === q.answer ? t("correct") : <>{t("notQuite")}<strong>{q.answer}</strong>.</>}</p>
      )}
      <div className="feedback">
        {canSpeak && (q.dir === "en" || picked !== null) && (
          <button className="btn ghost sm" onClick={() => speak(q.en)}><Icon name="volume" size={16} />{t("hearWord")}</button>
        )}
        {picked !== null && <button className="btn" onClick={next}>{idx + 1 < qs.length ? t("nextQ") : t("seeScore")}</button>}
      </div>
    </div>
  );
}

function Study({ deck, onBack, backLabel }) {
  const { t } = useT();
  const [mode, setMode] = useState("cards");
  const games = deck.cards.filter((c) => c.pic).length >= 4;
  return (
    <section>
      <button className="back-link" onClick={onBack}><Icon name="left" />{backLabel || t("allLists")}</button>
      <h2 className="h">{deck.title}</h2>
      <div className="seg">
        <button aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>{games ? t("cardsShort") : t("flashcards")}</button>
        <button aria-pressed={mode === "quiz"} onClick={() => setMode("quiz")}>{t("quiz")}</button>
        {games && <button aria-pressed={mode === "listen"} onClick={() => setMode("listen")}>{t("listenGame")}</button>}
        {games && <button aria-pressed={mode === "memory"} onClick={() => setMode("memory")}>{t("memoryGame")}</button>}
      </div>
      {deck.cards.length === 0 ? <Empty text={t("emptyList")} />
        : mode === "listen" && games ? <ListenTap key={deck.id} deck={deck} />
        : mode === "memory" && games ? <Memory key={deck.id} deck={deck} />
        : mode === "quiz" ? <Quiz deck={deck} /> : <Flashcards cards={deck.cards} />}
    </section>
  );
}

function WordsStudent({ decks, me }) {
  const { t, lang } = useT();
  const [openId, setOpenId] = useState(null);
  const visible = decks.filter((d) => forGroup(d.group, me.group));
  const deck = decks.find((d) => d.id === openId);
  if (deck) return <Study deck={deck} onBack={() => setOpenId(null)} />;
  return (
    <section>
      <h2 className="h">{t("words")}</h2>
      {me.level && <p className="level-chip">{t("yourLevel", levelName(me.level, lang))}</p>}
      {visible.length === 0 ? <Empty text={t("noLists")} /> : (
        <ul className="rows">
          {visible.map((d) => (
            <li key={d.id}>
              <button className="row-btn" onClick={() => setOpenId(d.id)}>
                <span className="row-main"><span className="row-title">{d.title}</span><span className="row-sub">{t("nWords", d.cards.length)}</span></span>
                <Icon name="right" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- words: teacher ---------- */
function DeckEditor({ deck, groups, onBack, onPractice, onChange, onDelete }) {
  const [title, setTitle] = useState(deck.title);
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [ex, setEx] = useState("");
  const [pic, setPic] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const enRef = useRef(null);
  const parsed = useMemo(() => parseBulk(bulk), [bulk]);
  const current = deck.group || EVERYONE;
  const opts = groups.includes(current) ? groups : [...groups, current];
  const saveTitle = () => { const t = title.trim(); if (t && t !== deck.title) onChange({ ...deck, title: t }); else setTitle(deck.title); };
  const addCard = () => {
    if (!en.trim() || !fr.trim()) return;
    const card = { id: uid(), en: en.trim(), fr: fr.trim(), ex: ex.trim() };
    if (pic.trim()) card.pic = pic.trim().slice(0, 16);
    onChange({ ...deck, cards: [...deck.cards, card] });
    setEn(""); setFr(""); setEx(""); setPic("");
    if (enRef.current) enRef.current.focus();
  };
  const addBulk = () => { if (!parsed.length) return; onChange({ ...deck, cards: [...deck.cards, ...parsed] }); setBulk(""); setShowBulk(false); };
  const enter = (e) => { if (e.key === "Enter") addCard(); };
  return (
    <section>
      <button className="back-link" onClick={onBack}><Icon name="left" />All lists</button>
      <Field label="List name"><input id="deck-title" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} /></Field>
      <Field label="Who sees it">
        <select id="deck-group" className="inp" value={current} onChange={(e) => onChange({ ...deck, group: e.target.value })}>
          {opts.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>
      <div className="form-actions" style={{ marginBottom: 20 }}>
        <button className="btn" onClick={onPractice} disabled={!deck.cards.length}>Practice this list</button>
        <ConfirmButton label="Delete list" onConfirm={onDelete} />
      </div>

      <div className="form">
        <p className="form-title">Add a word</p>
        <div className="grid2">
          <Field label="English"><input id="word-en" ref={enRef} className="inp" value={en} placeholder="window" onChange={(e) => setEn(e.target.value)} onKeyDown={enter} /></Field>
          <Field label="French"><input id="word-fr" className="inp" value={fr} placeholder="la fenêtre" onChange={(e) => setFr(e.target.value)} onKeyDown={enter} /></Field>
        </div>
        <Field label="Example sentence (optional)"><input id="word-ex" className="inp" value={ex} placeholder="Open the window, please." onChange={(e) => setEx(e.target.value)} onKeyDown={enter} /></Field>
        <Field label="Picture (optional): one emoji, like 🍎">
          <input id="word-pic" className="inp pic-inp" value={pic} placeholder="🪟" maxLength={16} onChange={(e) => setPic(e.target.value)} onKeyDown={enter} />
          <span className="hint">Use your phone's emoji keyboard. Lists with 4 or more pictures get the kids' games.</span>
        </Field>
        <div className="form-actions">
          <button className="btn" onClick={addCard} disabled={!en.trim() || !fr.trim()}><Icon name="plus" size={16} />Add word</button>
          <button className="btn ghost" onClick={() => setShowBulk((s) => !s)}>{showBulk ? "Hide paste box" : "Paste many words"}</button>
        </div>
        {showBulk && (
          <div style={{ marginTop: 16 }}>
            <Field label="One word per line: English = French | example | picture">
              <textarea id="word-bulk" className="inp" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)}
                placeholder={"pencil = le crayon | I write with a pencil. | ✏️\nruler = la règle"} />
            </Field>
            <button className="btn" onClick={addBulk} disabled={!parsed.length}>Add {parsed.length} {parsed.length === 1 ? "word" : "words"}</button>
          </div>
        )}
      </div>

      <p className="sub-h">{deck.cards.length} {deck.cards.length === 1 ? "word" : "words"}</p>
      {deck.cards.length === 0 ? <Empty text="Add your first word above." /> : (
        <ul>
          {deck.cards.map((c) => (
            <li key={c.id} className="word-row">
              {c.pic && <span className="row-pic" aria-hidden="true">{c.pic}</span>}
              <div className="row-main">
                <span className="row-title">{c.en}</span>
                <span className="row-sub">{c.fr}</span>
                {c.ex && <span className="row-sub ex">{c.ex}</span>}
              </div>
              {canSpeak && <button className="icon-btn" aria-label={`Hear ${c.en}`} onClick={() => speak(c.en)}><Icon name="volume" size={17} /></button>}
              <ConfirmButton iconOnly label={`Delete ${c.en}`} onConfirm={() => onChange({ ...deck, cards: deck.cards.filter((x) => x.id !== c.id) })} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WordsTeacher({ decks, groups, saveDecks, openId, setOpenId, sample, embedded = false }) {
  const [practice, setPractice] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const deck = decks.find((d) => d.id === openId);
  if (deck && practice) return <Study deck={deck} backLabel="Back to editing" onBack={() => setPractice(false)} />;
  if (deck) {
    return (
      <DeckEditor key={deck.id} deck={deck} groups={groups}
        onBack={() => setOpenId(null)} onPractice={() => setPractice(true)}
        onChange={(nd) => saveDecks(decks.map((d) => (d.id === nd.id ? nd : d)))}
        onDelete={() => { saveDecks(decks.filter((d) => d.id !== deck.id)); setOpenId(null); }} />
    );
  }
  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    const d = { id: uid(), title: t, group: EVERYONE, cards: [] };
    saveDecks([d, ...decks]); setNewTitle(""); setOpenId(d.id);
  };
  return (
    <section>
      {!embedded && <h2 className="h">Word lists</h2>}
      <div className="inline-add">
        <input id="new-list" className="inp" aria-label="New list name" placeholder="New list, e.g. Colors" value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn" onClick={add} disabled={!newTitle.trim()}><Icon name="plus" size={16} />Add list</button>
      </div>
      <AskClaude sample={sample} title="Make a list with Claude" label="What should the list be about?" placeholder="Food words for a 6-year-old" button="Make list"
        makePrompt={listPrompt}
        onResult={(data) => {
          const cards = arr(data && data.words).map((w) => ({ id: uid(), en: String((w && w.en) || "").trim(), fr: String((w && w.fr) || "").trim(), ex: String((w && w.ex) || "").trim() })).filter((w) => w.en && w.fr);
          if (!cards.length) return false;
          const d = { id: uid(), title: String((data && data.title) || "New list").trim().slice(0, 60), group: EVERYONE, cards };
          saveDecks([d, ...decks]); setPractice(false); setOpenId(d.id);
          return true;
        }} />
      {decks.length === 0 ? <Empty text="Make a word list and your students can practice it with flashcards and quizzes." /> : (
        <ul className="rows">
          {decks.map((d) => (
            <li key={d.id}>
              <button className="row-btn" onClick={() => { setPractice(false); setOpenId(d.id); }}>
                <span className="row-main">
                  <span className="row-title">{d.title}</span>
                  <span className="row-sub">{d.cards.length} words, for {d.group || EVERYONE}</span>
                </span>
                <Icon name="right" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- lessons & homework ---------- */
function LessonEntry({ lesson: l, teacher = false, isDone = false, onToggle, onEdit, onDelete, onSaveToLibrary, voice, hwCheck = null }) {
  const { t, lang } = useT();
  const [libLevel, setLibLevel] = useState(null);
  const d = l.date ? parseISO(l.date) : null;
  const pastDue = l.due && l.due < todayISO();
  return (
    <li>
      <div className="entry-date">
        {d && <><span className="d-day">{d.getDate()}</span><span className="d-mon">{d.toLocaleDateString(LOCALE[lang], { month: "short" })}</span></>}
      </div>
      <div className="entry-body">
        <h3>{l.title}{l.sample && <span className="sample-tag">{t("sampleTag")}</span>}</h3>
        {teacher && <p className="muted small">For {lessonGroups(l).join(", ")}</p>}
        {l.notes && <p className="notes">{l.notes}</p>}
        {!teacher && <PracticeSay items={practiceItems(l.notes)} />}
        {l.homework && (
          <div className="hw">
            <p className="hw-head">{t("homework")}{l.due && <span>{t("due", fmtDate(l.due, lang))}</span>}</p>
            <p className="hw-text">{l.homework}</p>
            {!teacher && onToggle && (
              <button className={"btn sm" + (isDone ? " done" : "")} onClick={onToggle} aria-pressed={isDone}>
                {isDone ? <><Icon name="check" size={16} />{t("done")}</> : t("markDone")}
              </button>
            )}
            {!teacher && !isDone && pastDue && <p className="late">{t("pastDue")}</p>}
            {!teacher && voice && (voice.trial ? <TrialVoice /> : <VoiceHomework lesson={l} me={voice.me} sent={voice.sent} reply={voice.reply} onSent={voice.onSent} />)}
            {teacher && hwCheck}
          </div>
        )}
        {teacher && (
          <div className="entry-actions">
            <button className="btn ghost sm" onClick={onEdit}><Icon name="pencil" size={15} />Edit</button>
            {onSaveToLibrary && libLevel === null && <button className="btn ghost sm" onClick={() => setLibLevel(AUDIENCES[0])}>Save to library</button>}
            <ConfirmButton onConfirm={onDelete} />
          </div>
        )}
        {teacher && libLevel !== null && (
          <div className="inline-add" style={{ marginTop: 10, marginBottom: 0 }}>
            <select className="inp" aria-label="Who it's for" value={libLevel} onChange={(e) => setLibLevel(e.target.value)}>{AUDIENCES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <button className="btn sm" onClick={() => { onSaveToLibrary(libLevel); setLibLevel(null); }}>Save</button>
            <button className="btn ghost sm" onClick={() => setLibLevel(null)}>Cancel</button>
          </div>
        )}
      </div>
    </li>
  );
}

function GroupPicker({ id, groups, value, onChange, roster = [] }) {
  const all = [...new Set([...groups, ...value])];
  const who = (g) => roster.filter((r) => r.group === g).map((r) => r.name);
  const toggle = (g) => {
    if (g === EVERYONE) { onChange(value.includes(EVERYONE) ? [] : [EVERYONE]); return; }
    const cur = value.filter((x) => x !== EVERYONE);
    onChange(cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]);
  };
  return (
    <div className="field">
      <span id={id + "-label"}>For</span>
      <div className="chip-pick" role="group" aria-labelledby={id + "-label"} id={id}>
        {all.map((g) => {
          const names = who(g);
          const sub = g === EVERYONE ? "all students" : names.length && !(names.length === 1 && names[0] === g) ? names.join(", ") : "";
          const on = value.includes(g);
          return (
            <button key={g} type="button" aria-pressed={on} onClick={() => toggle(g)}>
              {on && <Icon name="check" size={15} />}<span>{g}</span>{sub && <span className="chip-sub">{sub}</span>}
            </button>
          );
        })}
      </div>
      <span className="hint">{value.length ? "Tap every student or group that gets this." : "Pick at least one student or group."}</span>
    </div>
  );
}

function LessonsTeacher({ lessons, groups, saveLessons, flash, sample, db, userId, decks = [], saveDecks, roster = [], voiceNotes = {}, progressMap = {}, plansH, hw, people = roster, start = null, openDeck = null, setOpenDeck = () => {} }) {
  const [mode, setMode] = useState(() => (start && start.mode) || "lessons");
  const [form, setForm] = useState(null);
  const lib = useLibrary(db, userId);
  const voiceList = Object.values(voiceNotes);
  const newVoice = Object.values(voiceNotes).filter((v) => !v.heard).length;
  const pending = useRef(null);
  const [libKey, setLibKey] = useState(0); // tapping Library again goes back to its first page
  const blank = () => ({ id: null, date: todayISO(), groups: [groups[1] || EVERYONE], title: "", notes: "", homework: "", due: "" });
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => {
    const chosen = arr(form.groups).includes(EVERYONE) ? [EVERYONE] : arr(form.groups);
    if (!form.title.trim() || !chosen.length) return;
    const { groups: _old, ...rest } = form;
    const item = { ...rest, group: chosen[0], title: form.title.trim(), notes: form.notes.trim(), homework: form.homework.trim() };
    if (chosen.length > 1) item.groups = chosen;
    if (form.id) saveLessons(lessons.map((l) => (l.id === form.id ? item : l)));
    else saveLessons([{ ...item, id: uid() }, ...lessons]);
    const pend = pending.current;
    pending.current = null;
    if (pend && !form.id && plansH.on) {
      const list = arr(plansH.plans[pend.studentId]);
      if (list.some((x) => x.id === pend.planId)) plansH.save(pend.studentId, list.map((x) => (x.id === pend.planId ? { ...x, used: form.date || todayISO() } : x))).catch(() => {});
    }
    setForm(null); flash("Lesson saved. Students can see it now.");
  };
  const saveToLib = (l, level) => lib.save({ id: uid(), title: l.title, level, notes: l.notes || "", homework: l.homework || "" })
    .then(() => flash(`Saved to your library under ${level}.`), () => flash("That didn't save. Check your connection and try again."));
  const usePlan = (p, opt = {}) => {
    const b = blank();
    pending.current = opt.studentId && opt.planId ? { studentId: opt.studentId, planId: opt.planId } : null;
    setMode("lessons");
    setForm({ ...b, groups: opt.group ? [opt.group] : b.groups, title: p.title || "", notes: p.notes || "", homework: p.homework || "" });
    window.scrollTo(0, 0);
  };
  const sorted = [...lessons].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <section>
      <div className="h-row">
        <h2 className="h">Lessons</h2>
        {mode === "lessons" && !form && <button className="btn sm" onClick={() => setForm(blank())}><Icon name="plus" size={16} />New lesson</button>}
      </div>
      {lib.on && (
        <div className="seg seg-lessons">
          <button aria-pressed={mode === "lessons"} onClick={() => setMode("lessons")}>Lessons</button>
          <button aria-pressed={mode === "words"} onClick={() => { pending.current = null; setMode("words"); }}>Vocab</button>
          <button aria-pressed={mode === "library"} onClick={() => { pending.current = null; setMode("library"); setLibKey((k) => k + 1); }}>Library</button>
          <button aria-pressed={mode === "voice"} onClick={() => { pending.current = null; setMode("voice"); }}>Voice{newVoice ? <span className="seg-count" aria-label={`${newVoice} new`}>{newVoice}</span> : ""}</button>
        </div>
      )}
      {mode === "words" ? <WordsTeacher embedded decks={decks} groups={groups} saveDecks={saveDecks} openId={openDeck} setOpenId={setOpenDeck} sample={sample} />
        : mode === "voice" ? <VoiceInbox notes={voiceNotes} progressMap={progressMap} flash={flash} /> : mode === "library" ? (
        <CourseLibrary key={libKey} startNav={libKey === 0 && start ? start.nav : null} progressMap={progressMap} saved={lib.items} onUse={usePlan} decks={decks} saveDecks={saveDecks} groups={groups} flash={flash} roster={roster} plansH={plansH}
          onRemoveSaved={(id) => lib.remove(id).catch(() => flash("That didn't save. Check your connection and try again."))} />
      ) : (
        <>
          {form && (
            <div className="form">
              <AskClaude sample={sample} title="Draft with Claude" label="What's the lesson about?" placeholder="Present continuous for adult beginners" button="Draft"
                makePrompt={lessonPrompt}
                onResult={(d) => {
                  if (!d || !d.title) return false;
                  setForm((f) => ({ ...f, title: String(d.title), notes: String(d.notes || ""), homework: String(d.homework || "") }));
                  return true;
                }} />
              <Field label="Title"><input id="lesson-title" className="inp" value={form.title} placeholder="Telling the time" onChange={upd("title")} /></Field>
              <GroupPicker id="lesson-for" groups={groups} roster={roster} value={arr(form.groups)} onChange={(gs) => setForm({ ...form, groups: gs })} />
              <Field label="What we did"><textarea id="lesson-notes" className="inp" value={form.notes} placeholder="New words, a song, a short dialogue..." onChange={upd("notes")} /></Field>
              <Field label="Homework (optional)"><textarea id="lesson-hw" className="inp" value={form.homework} placeholder="Write 5 sentences with the new words." onChange={upd("homework")} /></Field>
              <div className="grid2">
                <Field label="Date"><input id="lesson-date" className="inp" type="date" value={form.date} onChange={upd("date")} /></Field>
                <Field label="Due date"><input id="lesson-due" className="inp" type="date" value={form.due} onChange={upd("due")} /></Field>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={submit} disabled={!form.title.trim() || !arr(form.groups).length}>Save lesson</button>
                <button className="btn ghost" onClick={() => { pending.current = null; setForm(null); }}>Cancel</button>
              </div>
            </div>
          )}
          {sorted.length === 0 ? (!form && <Empty text="Add your first lesson to give students their notes and homework, or open Library to use one of your lesson plans." />) : (
            <ol className="entries">
              {sorted.map((l) => (
                <LessonEntry key={l.id} lesson={l} teacher
                  onEdit={() => { setForm({ ...l, groups: lessonGroups(l) }); window.scrollTo(0, 0); }}
                  onDelete={() => saveLessons(lessons.filter((x) => x.id !== l.id))}
                  onSaveToLibrary={lib.on ? (level) => saveToLib(l, level) : null}
                  hwCheck={l.homework && hw && hw.on ? <HomeworkToggle lesson={l} people={people} hw={hw} voiceList={voiceList} flash={flash} /> : null} />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- voice notes: a student's recorded homework, kept in Firestore in parts ---------- */
const VOICE_PART = 700000;
const blobToBase64 = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
async function sendVoice(blob, secs, lesson, me) {
  const data = await blobToBase64(blob);
  const n = Math.ceil(data.length / VOICE_PART);
  if (!n || n > 6) throw new Error("too-long");
  const db = FB.db;
  const ref = db.collection("voice").doc(uid() + uid());
  const batch = db.batch();
  batch.set(ref, {
    sid: me.id, code: me.code, name: String(me.name || "").slice(0, 120), group: String(me.group || "").slice(0, 120),
    title: String(lesson.title || "").slice(0, 200), lessonId: String(lesson.id || "").slice(0, 60),
    mime: (blob.type || "audio/webm").slice(0, 40), secs: Math.round(secs), parts: n, at: new Date().toISOString(),
  });
  for (let k = 0; k < n; k++) batch.set(ref.collection("parts").doc(String(k)), { d: data.slice(k * VOICE_PART, (k + 1) * VOICE_PART) });
  await Promise.race([batch.commit(), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 60000))]);
  return ref.id;
}
async function loadVoice(v) {
  const parts = await Promise.all(Array.from({ length: v.parts || 0 }, (_, k) => FB.db.doc(`voice/${v.id}/parts/${k}`).get()));
  const b64 = parts.map((s) => (s.exists ? (s.data() || {}).d || "" : "")).join("");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: v.mime || "audio/mp4" }));
}
function deleteVoice(v) {
  const db = FB.db;
  const ref = db.doc("voice/" + v.id);
  const batch = db.batch();
  for (let k = 0; k < (v.parts || 0); k++) batch.delete(ref.collection("parts").doc(String(k)));
  batch.delete(ref);
  return batch.commit();
}

/* progress/{studentId}: skills the teacher ticked, and replies to voice notes. Students read their own. */
function useProgressDoc(sid) {
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    setDoc(null);
    if (!sid || !FB) return undefined;
    let un = () => {};
    try { un = FB.db.doc("progress/" + sid).onSnapshot((s) => setDoc(s.exists ? s.data() || {} : {}), () => setDoc({})); } catch (e) { setDoc({}); }
    return () => un();
  }, [sid]);
  return doc;
}
function useCollectionMap(path, on) {
  const [map, setMap] = useState({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!on || !FB) { setMap({}); setReady(false); return undefined; }
    let un = () => {};
    try {
      un = FB.db.collection(path).onSnapshot((qs) => {
        const next = {};
        qs.docs.forEach((d) => { next[d.id] = { ...(d.data() || {}), id: d.id }; });
        setMap(next); setReady(true);
      }, () => setReady(true));
    } catch (e) { setReady(true); }
    return () => un();
  }, [path, on]);
  return { map, ready };
}
const saveReply = (sid, vid, reply) => FB.db.doc("progress/" + sid).set({ replies: { [vid]: reply }, updated: new Date().toISOString() }, { merge: true });

function VoiceHomework({ lesson, me, sent = [], reply, onSent }) {
  const { t, lang } = useT();
  const rec = useRecorder(120);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!canRecord || !me || me.id === "guest" || !me.code) return null;
  const last = sent[sent.length - 1];
  const send = async () => {
    setBusy(true); setErr("");
    try {
      const id = await sendVoice(rec.blob, rec.secs, lesson, me);
      onSent({ id, at: new Date().toISOString(), secs: rec.secs });
      rec.reset(); setOpen(false);
    } catch (e) {
      const why = (e && (e.code || e.message)) || "";
      setErr(why === "too-long" ? t("voiceTooLong") : /permission/i.test(why) ? t("voiceNotReady") : why === "slow" ? t("voiceSlow") : t("voiceFail"));
    }
    setBusy(false);
  };
  return (
    <div className="voice-hw">
      {reply && (
        <div className="voice-reply">
          <p className="voice-stars" aria-label={t("starsN", reply.stars || 0)}>{Array.from({ length: reply.stars || 0 }, (_, k) => <Icon key={k} name="star" size={20} />)}</p>
          {reply.note && <p className="voice-note">“{reply.note}”</p>}
          <p className="muted small">{t("teacherReplied")}</p>
        </div>
      )}
      {last && !open && <p className="muted small voice-sent"><Icon name="check" size={14} />{t("voiceSent", fmtDate(last.at.slice(0, 10), lang))}</p>}
      {!open ? (
        <button className="btn ghost sm" onClick={() => setOpen(true)}><Icon name="mic" size={16} />{sent.length ? t("recordAnother") : t("recordAnswer")}</button>
      ) : (
        <div className="recorder">
          <p className="hint">{t("recordHint")}</p>
          {rec.state === "recording" ? (
            <button className="btn rec" onClick={rec.stop}><Icon name="stop" size={16} />{t("stopRec")} · {mmss(rec.secs)}</button>
          ) : rec.state === "done" ? (
            <>
              <audio controls src={rec.url} className="voice-audio" />
              <div className="pay-actions">
                <button className="btn" onClick={send} disabled={busy}>{busy ? t("sending") : t("sendTeacher")}</button>
                <button className="btn ghost sm" onClick={rec.reset} disabled={busy}>{t("recordAgain")}</button>
              </div>
            </>
          ) : (
            <div className="pay-actions">
              <button className="btn" onClick={rec.start}><Icon name="mic" size={16} />{t("startRec")}</button>
              <button className="btn ghost sm" onClick={() => { rec.reset(); setOpen(false); }}>{t("cancel")}</button>
            </div>
          )}
          {(rec.error || err) && <p className="say-result error" role="alert">{rec.error || err}</p>}
        </div>
      )}
    </div>
  );
}

/* Phrases worth saying out loud, taken from a lesson's notes: quoted phrases and the "New words" line. */
function practiceItems(text) {
  const out = [];
  const add = (s) => {
    const x = String(s || "").trim().replace(/^[“"']+|[”"']+$/g, "").trim();
    if (x && /[a-z]/i.test(x) && x.length <= 80 && !out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  };
  String(text || "").split("\n").forEach((line) => {
    const m = line.match(/^\s*(new words|words|vocabulary|nouveaux mots|mots|vocabulaire)\s*:\s*(.+)$/i);
    if (m) m[2].split(/[,;]/).forEach((w) => { const x = w.replace(/\(.*?\)/g, "").replace(/[.!]+$/, "").trim(); if (x && x.split(/\s+/).length <= 4) add(x); });
    (line.match(/[“"]([^“”"]{2,80})[”"]/g) || []).forEach((q) => add(q.slice(1, -1)));
  });
  return out.slice(0, 16);
}
function PracticeSay({ items }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!items.length || !canSpeak) return null;
  return (
    <div className="practice">
      <button className="btn ghost sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="volume" size={16} />{t("practiceTitle", items.length)}</button>
      {open && (
        <>
          <p className="hint">{SpeechRec ? t("practiceHint") : t("practiceHintNoMic")}</p>
          <ul className="practice-list">
            {items.map((x) => (
              <li key={x}>
                <span className="practice-text">{x}</span>
                <button className="icon-btn" aria-label={t("hearIt", x)} onClick={() => speak(x)}><Icon name="volume" size={17} /></button>
                {SpeechRec && (canSay(x) ? <SayIt text={x} compact /> : <span className="say-compact say-gap" aria-hidden="true" />)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function HomeworkStudent({ lessons, me, done, onToggle, prog, voiceSent = {}, onVoiceSent }) {
  const { t } = useT();
  const replies = Object.values((prog && prog.replies) || {});
  const replyFor = (id) => replies.filter((r) => r.lessonId === id).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))[0];
  const list = lessons.filter((l) => forGroup(lessonGroups(l), me.group)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <section>
      <h2 className="h">{t("homework")}</h2>
      {list.length === 0 ? <Empty text={t("noLessons")} /> : (
        <ol className="entries">
          {list.map((l) => (
            <LessonEntry key={l.id} lesson={l} isDone={!!done[l.id]} onToggle={() => onToggle(l.id)}
              voice={l.sample ? { trial: true } : me && me.id !== "guest" ? { me, sent: arr(voiceSent[l.id]), reply: replyFor(l.id), onSent: (x) => onVoiceSent(l.id, x) } : null} />
          ))}
        </ol>
      )}
    </section>
  );
}

/* ---------- announcements ---------- */
const activeNotice = (n, today) => !n.until || n.until >= today;

function StudentNotices({ notices, me }) {
  const { t } = useT();
  const today = todayISO();
  const list = notices.filter((n) => forGroup(n.group, me.group) && activeNotice(n, today));
  if (!list.length) return null;
  return (
    <div className="notices" role="region" aria-label={t("announcement")}>
      {list.map((n) => <p key={n.id} className="notice"><Icon name="megaphone" size={18} /><span>{n.text}</span></p>)}
    </div>
  );
}

function NoticesTeacher({ notices, groups, saveNotices, flash }) {
  const [form, setForm] = useState(null);
  const today = todayISO();
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => {
    const text = form.text.trim();
    if (!text) return;
    saveNotices([{ id: uid(), text, group: form.group, until: form.until }, ...notices]);
    setForm(null); flash("Announcement saved. Students see it now.");
  };
  return (
    <section className="notices-teacher">
      <div className="h-row">
        <h2 className="h">Announcements</h2>
        {!form && <button className="btn ghost sm" onClick={() => setForm({ text: "", group: EVERYONE, until: "" })}><Icon name="megaphone" size={16} />New</button>}
      </div>
      {form && (
        <div className="form">
          <Field label="Message"><textarea id="notice-text" className="inp" value={form.text} placeholder="No class on Wednesday. See you Saturday!" onChange={upd("text")} /></Field>
          <div className="grid2">
            <Field label="For"><select id="notice-group" className="inp" value={form.group} onChange={upd("group")}>{groups.map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>
            <Field label="Show until (optional)"><input id="notice-until" className="inp" type="date" min={today} value={form.until} onChange={upd("until")} /></Field>
          </div>
          <p className="hint">Students see it at the top of the app until that date, or until you delete it.</p>
          <div className="form-actions">
            <button className="btn" onClick={submit} disabled={!form.text.trim()}>Save announcement</button>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {notices.length === 0 ? (!form && <p className="hint" style={{ marginTop: 0 }}>Post a short message students see at the top of the app, like "No class Wednesday".</p>) : (
        <ul className="rows" style={{ marginBottom: 8 }}>
          {notices.map((n) => (
            <li key={n.id} className="notice-row">
              <div className="row-main">
                <span className="notes" style={{ marginTop: 0 }}>{n.text}</span>
                <span className="row-sub">For {n.group || EVERYONE}, {!n.until ? "until you delete it" : activeNotice(n, today) ? `until ${fmtDate(n.until)}` : "ended"}</span>
              </div>
              <ConfirmButton iconOnly label="Delete announcement" onConfirm={() => saveNotices(notices.filter((x) => x.id !== n.id))} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- classes ---------- */
function Classes({ schedule, changes = [], saveChanges, notices = [], saveNotices, isTeacher = false, me, groups = [EVERYONE], saveSchedule, flash, roster = [], att, st, updated, lessons = [] }) {
  const { t, lang } = useT();
  const [form, setForm] = useState(null);
  const [logFor, setLogFor] = useState(null);
  const [formErr, setFormErr] = useState("");
  const [changeFor, setChangeFor] = useState(null);
  const today = todayISO();
  const now = new Date();
  const ti = (now.getDay() + 6) % 7;
  const markable = isTeacher && att && att.on;
  const slots = isTeacher ? schedule : schedule.filter((s) => forGroup(s.group, me.group));
  const slotIds = new Set(slots.map((s) => s.id));
  const myChanges = changes.filter((c) => slotIds.has(c.slot));
  const next = upcomingClasses(slots, myChanges, now)[0];
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const placeOf = (s) => s.place || (s.link ? t("online") : t("placeNotSet"));
  const fail = () => flash("That didn't save. Check your connection and try again.");
  /* Each picked day keeps its own start time; a newly ticked day starts with the last time used. */
  const timeOf = (k) => (form.times && form.times[k]) || form.start;
  const toggleDay = (k) => {
    if (form.days.includes(k)) { setForm({ ...form, days: form.days.filter((d) => d !== k) }); return; }
    const last = form.days.length ? timeOf(form.days[form.days.length - 1]) : form.start;
    setForm({ ...form, days: [...form.days, k], times: { ...(form.times || {}), [k]: (form.times && form.times[k]) || last } });
  };
  const setTime = (k) => (e) => setForm({ ...form, start: e.target.value, times: { ...(form.times || {}), [k]: e.target.value } });
  /* Each picked day is saved as its own class, so one day can still be cancelled, moved or edited alone. */
  const submit = () => {
    const days = [...new Set(arr(form.days).map(Number))].sort((a, b) => a - b);
    if (!days.length) { setFormErr("Pick at least one day."); return; }
    const noTime = days.find((d) => !timeOf(d));
    if (noTime !== undefined) { setFormErr(`Add a start time for ${DAYS.en[noTime]}.`); return; }
    const link = form.link.trim();
    if (link && !isLink(link)) { setFormErr("An online link must start with https:// and have no spaces."); return; }
    const base = { group: form.group, minutes: Number(form.minutes) || 60, place: form.place.trim() };
    if (link) base.link = link;
    const slotFor = (d, id) => ({ id, ...base, day: d, start: timeOf(d) });
    let next = schedule;
    let rest = days;
    if (form.id) {
      const orig = schedule.find((x) => x.id === form.id);
      const keep = orig && days.includes(Number(orig.day)) ? Number(orig.day) : days[0];
      next = schedule.map((x) => (x.id === form.id ? slotFor(keep, form.id) : x));
      rest = days.filter((d) => d !== keep);
    }
    const already = (d) => next.some((x) => x.group === base.group && Number(x.day) === d && x.start === timeOf(d));
    const added = rest.filter((d) => !already(d)).map((d) => slotFor(d, uid()));
    if (!form.id && !added.length) { setFormErr("That class is already on the schedule."); return; }
    saveSchedule([...next, ...added]);
    const n = (form.id ? 1 : 0) + added.length;
    setForm(null); setFormErr(""); flash(n > 1 ? `${n} classes saved.` : "Class saved.");
  };
  /* Mark taught opens a short form: who came, notes, and a message for absent students' families. */
  const recOf = (key) => recordsOf(att, key, today);
  const taughtButton = (key, s, start) => {
    if (!markable || !roster.some((r) => forGroup(s.group, r.group))) return null;
    const rec = recOf(key);
    const logged = rec.taken.length + rec.absent.length > 0;
    return (
      <button className={"btn sm" + (logged ? " done" : " ghost")} aria-expanded={logFor === key} onClick={() => setLogFor(logFor === key ? null : key)}>
        {logged ? <><Icon name="check" size={16} />{logSummary(rec)}</> : "Mark taught"}
      </button>
    );
  };
  const logForm = (key, s, start) => (logFor === key && markable
    ? <ClassLog occ={{ s, key, date: today, start }} people={roster} att={att} lessons={lessons} flash={flash} onClose={() => setLogFor(null)} /> : null);
  const saveChange = (s, existing, v) => {
    const c = existing ? { ...existing, makeup: v.makeup } : { id: uid(), slot: s.id, date: v.date, note: v.note, makeup: v.makeup, resolved: false };
    saveChanges(existing ? changes.map((x) => (x.id === c.id ? c : x)) : [...changes, c]);
    const until = c.makeup && c.makeup.date > c.date ? c.makeup.date : c.date;
    saveNotices([{ id: uid(), text: changeNotice(c, s), group: s.group, until, change: c.id }, ...notices.filter((n) => n.change !== c.id)]);
    setChangeFor(null);
    flash(c.makeup ? "Class moved, and the group has an announcement." : "Class cancelled, and the group has an announcement.");
  };
  const undoChange = (c) => { saveChanges(changes.filter((x) => x.id !== c.id)); saveNotices(notices.filter((n) => n.change !== c.id)); flash("Change removed."); };
  const visibleChanges = myChanges.filter((c) => c.date >= today || (c.makeup && c.makeup.date >= today))
    .sort((a, b) => (a.makeup && a.makeup.date >= today ? a.makeup.date : a.date).localeCompare(b.makeup && b.makeup.date >= today ? b.makeup.date : b.date));
  const owed = isTeacher ? changes.filter((c) => !c.makeup && !c.resolved && slotIds.has(c.slot)) : [];
  const dayOrder = [0, 1, 2, 3, 4, 5, 6].map((k) => (ti + k) % 7);
  const thisMonth = monthKey(now);
  const showSt = !isTeacher && st && st.m === thisMonth && st.total > 0;
  const changeSlot = changeFor && schedule.find((s) => s.id === changeFor.slot);
  return (
    <section>
      <div className="h-row">
        <h2 className="h">{isTeacher ? "Classes" : t("myClasses")}</h2>
        {isTeacher && !form && !changeFor && (
          <button className="btn sm" onClick={() => { setFormErr(""); setForm({ id: null, group: groups[1] || EVERYONE, days: [ti], times: { [ti]: "16:00" }, start: "16:00", minutes: 60, place: "", link: "" }); }}>
            <Icon name="plus" size={16} />Add class
          </button>
        )}
      </div>
      {form && (
        <div className="form">
          <Field label="Group"><select id="class-group" className="inp" value={form.group} onChange={upd("group")}>{(groups.includes(form.group) ? groups : [...groups, form.group]).map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>
          <div className="field">
            <span id="class-days-label">Days</span>
            <div className="day-pick" role="group" aria-labelledby="class-days-label">
              {DAYS.en.map((d, k) => (
                <button key={d} type="button" aria-label={d} aria-pressed={form.days.includes(k)} onClick={() => toggleDay(k)}>{d.slice(0, 3)}</button>
              ))}
            </div>
            <span className="hint">{form.id ? "Tap another day to add this class on that day too, with its own start time." : "Tap every day this group meets. Each day can have its own start time, and each becomes its own class, so you can still cancel or move one day alone."}</span>
          </div>
          {form.days.length > 1 && (
            <div className="field">
              <span id="class-times-label">Start time for each day</span>
              <div className="day-times" role="group" aria-labelledby="class-times-label">
                {[...form.days].sort((a, b) => a - b).map((k) => (
                  <label key={k} className="day-time"><span>{DAYS.en[k]}</span><input id={"class-start-" + k} className="inp" type="time" value={timeOf(k)} onChange={setTime(k)} /></label>
                ))}
              </div>
            </div>
          )}
          <div className="grid2">
            {form.days.length <= 1 && <Field label="Starts at"><input id="class-start" className="inp" type="time" value={form.days.length ? timeOf(form.days[0]) : form.start} onChange={form.days.length ? setTime(form.days[0]) : upd("start")} /></Field>}
            <Field label="Minutes"><input id="class-min" className="inp" type="number" inputMode="numeric" min="15" step="15" value={form.minutes} onChange={upd("minutes")} /></Field>
          </div>
          <Field label="Where"><input id="class-place" className="inp" placeholder="School, home or online" value={form.place} onChange={upd("place")} /></Field>
          <Field label="Online class link (optional)"><input id="class-link" className="inp" type="url" inputMode="url" placeholder="https://meet.google.com/..." value={form.link} onChange={upd("link")} /></Field>
          <p className="hint">Paste a Google Meet or Zoom link and students get a Join button.</p>
          {formErr && <p className="err" role="alert">{formErr}</p>}
          <div className="form-actions">
            <button className="btn" onClick={submit}>{form.days.length > 1 ? `Save ${form.days.length} classes` : "Save class"}</button>
            <button className="btn ghost" onClick={() => { setForm(null); setFormErr(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {changeSlot && (
        <ChangeForm key={changeFor.slot + (changeFor.change ? changeFor.change.id : "")} slot={changeSlot} change={changeFor.change}
          onSave={(v) => saveChange(changeSlot, changeFor.change, v)} onCancel={() => setChangeFor(null)} />
      )}
      {showSt && (
        <div className="status-card">
          <strong className={st.left <= 0 ? "out" : ""}>{st.left >= 0 ? t("classesLeft", st.left, st.total, monthLabel(st.m, lang)) : t("extraClasses", -st.left, monthLabel(st.m, lang))}</strong>
          {updated && <span className="muted small">{t("updatedOn", fmtShort(updated.slice(0, 10), lang))}</span>}
        </div>
      )}
      {next ? (
        <div className="panel rings next">
          <p className="muted small">{isTeacher ? "Next class" : t("nextClass")}{next.makeup ? ` (${isTeacher ? "make-up" : t("makeupLabel").toLowerCase()})` : ""}</p>
          <p className="next-when">{whenLabel(next.at, t, lang)}</p>
          <p className="muted">{[isTeacher ? next.s.group : null, placeOf(next.s)].filter(Boolean).join(", ")}</p>
          {next.s.link && <a className="btn join" href={next.s.link} target="_blank" rel="noopener noreferrer"><Icon name="video" size={18} />{t("joinClass")}</a>}
        </div>
      ) : (!form && <Empty text={isTeacher ? "Add your weekly classes so you and your students always know what's next." : t("noClasses")} />)}
      {visibleChanges.length > 0 && (
        <div className="changes">
          <p className="sub-h">{isTeacher ? "Cancelled and moved classes" : t("changesTitle")}</p>
          <ul>
            {visibleChanges.map((c) => {
              const s = schedule.find((x) => x.id === c.slot);
              if (!s) return null;
              return (
                <li key={c.id}>
                  <div className="row-main">
                    {isTeacher && <span className="row-title">{s.group}</span>}
                    <span className={isTeacher ? "row-sub" : "change-line"}>{t("cancelledOn", fmtDate(c.date, lang), s.start)}</span>
                    {c.makeup && <span className={isTeacher ? "row-sub" : "change-line"}>{t("makeupOn", fmtDate(c.makeup.date, lang), c.makeup.start)}</span>}
                    {!isTeacher && c.note && <span className="row-sub">{c.note}</span>}
                  </div>
                  {isTeacher && (
                    <span className="slot-actions">
                      {c.makeup && c.makeup.date === today && taughtButton(c.id, s, c.makeup.start)}
                      <ConfirmButton iconOnly label="Undo this change" onConfirm={() => undoChange(c)} />
                    </span>
                  )}
                  {isTeacher && c.makeup && c.makeup.date === today && logForm(c.id, s, c.makeup.start)}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {owed.length > 0 && (
        <div className="changes">
          <p className="sub-h">Make-up classes you owe</p>
          <ul>
            {owed.map((c) => {
              const s = schedule.find((x) => x.id === c.slot);
              if (!s) return null;
              return (
                <li key={c.id}>
                  <div className="row-main"><span className="row-title">{s.group}</span><span className="row-sub">Cancelled {fmtDate(c.date)} at {s.start}</span></div>
                  <span className="slot-actions">
                    <button className="btn ghost sm" onClick={() => { setForm(null); setChangeFor({ slot: s.id, change: c }); window.scrollTo(0, 0); }}>Schedule make-up</button>
                    <button className="btn ghost sm" onClick={() => saveChanges(changes.map((x) => (x.id === c.id ? { ...x, resolved: true } : x)))}>Done</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {markable && slots.length > 0 && <p className="hint">Tap Mark taught after today's class to note who came and what you did. To log a class on another day, use Today or open the student in Students.</p>}
      {dayOrder.map((d) => {
        const list = slots.filter((s) => Number(s.day) === d).sort((a, b) => a.start.localeCompare(b.start));
        if (!list.length) return null;
        const dayName = isTeacher ? DAYS.en[d] : cap(DAYS[lang][d]);
        return (
          <div key={d} className="day-block">
            <p className={"day-name" + (d === ti ? " today" : "")}>{d === ti ? t("todayDay", isTeacher ? DAYS.en[d] : DAYS[lang][d]) : dayName}</p>
            {list.map((s) => {
              const cancelledToday = d === ti && changes.some((c) => c.slot === s.id && c.date === today);
              return (
                <React.Fragment key={s.id}>
                <div className="slot">
                  <span className="slot-time">{t("timeRange", s.start, addMin(s.start, s.minutes))}</span>
                  <span className="slot-main">
                    {isTeacher && <span className="row-title">{s.group}</span>}
                    <span className="row-sub">{placeOf(s)}</span>
                  </span>
                  <span className="slot-actions">
                    {s.link && <a className="btn ghost sm" href={s.link} target="_blank" rel="noopener noreferrer"><Icon name="video" size={16} />{t("join")}</a>}
                    {d === ti && !cancelledToday && taughtButton(s.id, s, s.start)}
                    {isTeacher && <button className="btn ghost sm" onClick={() => { setForm(null); setChangeFor({ slot: s.id, change: null }); window.scrollTo(0, 0); }}>Cancel or move</button>}
                    {isTeacher && <button className="icon-btn sm-icon" aria-label="Edit class" onClick={() => { setChangeFor(null); setFormErr(""); setForm({ id: s.id, group: s.group, days: [Number(s.day)], times: { [Number(s.day)]: s.start }, start: s.start, minutes: s.minutes, place: s.place || "", link: s.link || "" }); window.scrollTo(0, 0); }}><Icon name="pencil" size={15} /></button>}
                    {isTeacher && <ConfirmButton iconOnly label="Delete class" onConfirm={() => saveSchedule(schedule.filter((x) => x.id !== s.id))} />}
                  </span>
                </div>
                {d === ti && !cancelledToday && logForm(s.id, s, s.start)}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

/* ---------- paying the teacher ---------- */
const KINDS = ["Wave", "Orange Money", "MTN MoMo", "Moov Money", "Other"];

function PayStudent({ pay, me, st }) {
  const { t, lang } = useT();
  const methods = pay.methods.filter((m) => m.number || m.link);
  const guest = me.id === "guest";
  const [name, setName] = useState(guest ? "" : me.name);
  const [amount, setAmount] = useState(me.due ? String(me.due) : "");
  const [method, setMethod] = useState(methods[0] ? methods[0].kind : "cash");
  const wa = waDigits(pay.whatsapp);
  const thisMonth = monthKey(new Date());
  const month = monthLabel(thisMonth, lang);
  const methodName = method === "cash" ? t("cash") : method;
  const msg = t("payMsg", name.trim() || t("aStudent"), Number(amount) > 0 ? fcfa(amount) : t("myFee"), month, methodName);
  const showSt = st && st.m === thisMonth && st.pay && st.pay !== "none";
  return (
    <section>
      <h2 className="h">{t("payTitle")}</h2>
      {showSt && <p className={"pay-status " + st.pay}>{t(st.pay, month)}</p>}
      {me.due > 0 && (
        <div className="panel rings next">
          <p className="muted small">{t("yourFee")}</p>
          <p className="next-when">{fcfa(me.due)}</p>
          <p className="muted">{t("eachMonth")}</p>
        </div>
      )}
      {methods.length === 0 ? <Empty text={t("noPayDetails")} /> : (
        <>
          <p className="sub-h">{t("sendTo")}</p>
          <ul className="rows" style={{ marginBottom: 16 }}>
            {methods.map((m) => (
              <li key={m.id} className="pay-method">
                <div className="row-main">
                  <span className="row-title">{m.kind}</span>
                  {m.number && <span className="row-sub sel">{m.number}</span>}
                  {pay.accountName && <span className="row-sub">{t("name", pay.accountName)}</span>}
                </div>
                <div className="pay-actions">
                  {m.link && <a className="btn sm" href={m.link} target="_blank" rel="noopener noreferrer">{t("payWith", m.kind)}</a>}
                  {m.number && <CopyButton text={m.number} label={`${t("copy")} ${m.kind}`} />}
                </div>
              </li>
            ))}
          </ul>
          {pay.note && <p className="note">{pay.note}</p>}
        </>
      )}
      {wa ? (
        <div className="form">
          <p className="form-title">{t("afterPay")}</p>
          {guest && <Field label={t("yourName")}><input id="pay-me" className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          <div className="grid2">
            <Field label={t("amount")}><input id="pay-amount" className="inp" type="number" inputMode="numeric" min="0" step="500" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label={t("paidWith")}>
              <select id="pay-method" className="inp" value={method} onChange={(e) => setMethod(e.target.value)}>
                {[...new Set([...methods.map((m) => m.kind), "cash"])].map((k) => <option key={k} value={k}>{k === "cash" ? t("cash") : k}</option>)}
              </select>
            </Field>
          </div>
          <p className="msg sel">{msg}</p>
          <div className="form-actions">
            <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} />{t("sendWa")}</a>
            <CopyButton text={msg} label={t("copyMsg")} />
          </div>
          <p className="hint" style={{ margin: "10px 0 0" }}>{t("waFallback", pay.whatsapp)}</p>
        </div>
      ) : methods.length > 0 && <p className="hint">{t("screenshot")}</p>}
    </section>
  );
}

function PaySettings({ pay, savePay, flash }) {
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const methods = pay.methods.filter((m) => m.number || m.link);
  const start = () => {
    setErr("");
    setForm({ whatsapp: pay.whatsapp, accountName: pay.accountName, note: pay.note,
      methods: methods.length ? methods.map((m) => ({ ...m })) : [{ id: uid(), kind: "Wave", number: "", link: "" }] });
  };
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const updM = (id, k) => (e) => setForm({ ...form, methods: form.methods.map((m) => (m.id === id ? { ...m, [k]: e.target.value } : m)) });
  const save = () => {
    const list = form.methods.map((m) => ({ id: m.id, kind: m.kind, number: m.number.trim(), link: m.link.trim() })).filter((m) => m.number || m.link);
    if (list.some((m) => m.link && !isLink(m.link))) { setErr("A payment link must start with https:// and have no spaces."); return; }
    if (form.whatsapp.trim() && !waDigits(form.whatsapp)) { setErr("That WhatsApp number looks too short. Use the full number, like 07 00 00 00 00."); return; }
    savePay({ whatsapp: form.whatsapp.trim(), accountName: form.accountName.trim(), note: form.note.trim(), methods: list });
    setForm(null); flash("Payment details saved.");
  };
  return (
    <section className="pay-settings">
      <div className="h-row">
        <h2 className="h">How students pay</h2>
        {!form && <button className="btn ghost sm" onClick={start}><Icon name="pencil" size={15} />{methods.length || pay.whatsapp ? "Edit" : "Set up"}</button>}
      </div>
      <p className="hint">Students see these details on their Pay screen, and anyone with the app link can see them too. When a student tells you they've paid, record it above.</p>
      {!form && (methods.length || pay.whatsapp ? (
        <ul className="rows">
          {methods.map((m) => (
            <li key={m.id} className="pay-method"><div className="row-main"><span className="row-title">{m.kind}</span><span className="row-sub">{[m.number, m.link ? "Payment link added" : ""].filter(Boolean).join(", ")}</span></div></li>
          ))}
          {pay.whatsapp && <li className="pay-method"><div className="row-main"><span className="row-title">WhatsApp</span><span className="row-sub">{pay.whatsapp}</span></div></li>}
        </ul>
      ) : <Empty text="Add your Wave or mobile money number so students can pay you from the app." />)}
      {form && (
        <div className="form">
          {form.methods.map((m) => (
            <div key={m.id} className="method-edit">
              <div className="grid2">
                <Field label="Pay with">
                  <select id={"pm-kind-" + m.id} className="inp" value={m.kind} onChange={updM(m.id, "kind")}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
                </Field>
                <Field label="Number"><input id={"pm-num-" + m.id} className="inp" type="tel" inputMode="tel" placeholder="07 00 00 00 00" value={m.number} onChange={updM(m.id, "number")} /></Field>
              </div>
              <Field label="Payment link (optional)"><input id={"pm-link-" + m.id} className="inp" type="url" inputMode="url" placeholder="https://" value={m.link} onChange={updM(m.id, "link")} /></Field>
              {form.methods.length > 1 && <button className="btn ghost sm danger" onClick={() => setForm({ ...form, methods: form.methods.filter((x) => x.id !== m.id) })}><Icon name="trash" size={15} />Remove</button>}
            </div>
          ))}
          <button className="btn ghost sm" style={{ marginBottom: 16 }} onClick={() => setForm({ ...form, methods: [...form.methods, { id: uid(), kind: "Orange Money", number: "", link: "" }] })}><Icon name="plus" size={16} />Add another way to pay</button>
          <Field label="Name on the account"><input id="pay-name" className="inp" value={form.accountName} onChange={upd("accountName")} /></Field>
          <Field label="Your WhatsApp number"><input id="pay-wa" className="inp" type="tel" inputMode="tel" placeholder="+225 07 00 00 00 00" value={form.whatsapp} onChange={upd("whatsapp")} /></Field>
          <p className="hint">Students use it to tell you they've paid.</p>
          <Field label="Note for students (optional)"><textarea id="pay-note" className="inp" placeholder="Please pay before the 5th of each month." value={form.note} onChange={upd("note")} /></Field>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="form-actions">
            <button className="btn" onClick={save}>Save payment details</button>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- students & payments ---------- */
const STATUS = { paid: "Paid", partial: "Part paid", unpaid: "Not paid", none: "No fee" };

function StudentReport({ r, month, lessons, decks }) {
  const [comment, setComment] = useState("");
  const text = reportText(r, month, lessons, decks, comment);
  const myNotes = r.takenList.filter((x) => noteText(x));
  return (
    <div className="report">
      <p className="form-title">Report for {monthLabel(month)}{r.lang === "fr" ? ", in French" : ""}</p>
      {myNotes.length > 0 && (
        <div className="report-notes">
          <p className="muted small">Your class notes this month (only you see these)</p>
          <ul className="visit-list">{myNotes.map((x) => <li key={x.id}><span className="visit-date">{fmtShort(x.date)}</span><span className="visit-main">{noteText(x)}</span></li>)}</ul>
        </div>
      )}
      <Field label="Your comment (optional)"><textarea id={"report-note-" + r.id} className="inp" value={comment} placeholder={r.lang === "fr" ? "Très bons progrès ce mois-ci !" : "Great progress this month!"} onChange={(e) => setComment(e.target.value)} /></Field>
      <p className="msg sel pre">{text}</p>
      <div className="form-actions">
        {r.phone && <WaButton phone={r.phone} text={text}>Send on WhatsApp</WaButton>}
        <CopyButton text={text} label="Copy the report" caption="Copy report" />
      </div>
      {!r.phone && <p className="hint" style={{ margin: "10px 0 0" }}>Add their WhatsApp number with Edit student to send it in one tap.</p>}
    </div>
  );
}

function StudentDetail({ r, month, moneyOn, lessons, decks, placeOptions = [], defaultPlace = "", downloads, teacherName, onPay, onRemovePayment, onLogClass, onRemoveClass, onNewCode, onEdit, onRemove, onFile, absentList = [] }) {
  const [logPlace, setLogPlace] = useState(defaultPlace);
  const [showCert, setShowCert] = useState(false);
  const [min, max] = monthRange(month);
  const [logDate, setLogDate] = useState(() => { const t = todayISO(); return t >= min && t <= max ? t : min; });
  const logOk = logDate >= min && logDate <= max;
  const [armed, setArmed] = useState(false);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  const remaining = Math.max(0, r.fee - r.paid);
  const [amount, setAmount] = useState(remaining ? String(remaining) : "");
  const [date, setDate] = useState(todayISO());
  const valid = Number(amount) > 0;
  const save = () => { if (!valid) return; onPay(Number(amount), date); setAmount(""); };
  return (
    <div className="expand">
      {onFile && <button className="btn ghost sm file-open" onClick={onFile}><Icon name="users" size={15} />Open {r.name}'s page</button>}
      <div className="code-box">
        <div className="code-main"><span className="muted small">Code</span><span className="code-big sel">{r.code}</span></div>
        <div className="pay-actions">
          {r.phone && <WaButton phone={r.phone} text={codeText(r, r.lang)} ghost>Send code</WaButton>}
          <CopyButton text={codeText(r, r.lang)} label={`Copy a message with the code for ${r.name}`} caption="Copy message" />
          <button type="button" className="btn ghost sm" onClick={() => { if (armed) { setArmed(false); onNewCode(); } else setArmed(true); }}>{armed ? "Tap again for a new code" : "New code"}</button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>A new code signs them out on every phone straight away.</p>
      {moneyOn && (
        <>
          <div className="code-box">
            <div className="code-main">
              <span className="muted small">Classes in {monthLabel(month)}</span>
              <span className="count-big">{r.classes ? `${Math.max(r.left, 0)} left` : `${r.used} taken`}</span>
              {r.classes > 0 && <span className="muted small">{r.used} of {r.classes} taken{r.left < 0 ? `, ${-r.left} extra` : ""}</span>}
            </div>
            <div className="pay-actions">
              <input id={"log-date-" + r.id} className="inp log-date" type="date" min={min} max={max} aria-label="Class date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
              {placeOptions.length > 1 && <select id={"log-place-" + r.id} className="inp log-date" aria-label="Where" value={logPlace} onChange={(e) => setLogPlace(e.target.value)}>{placeOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select>}
              <button type="button" className="btn sm" disabled={!logOk} onClick={() => onLogClass(logDate, logPlace)}><Icon name="plus" size={16} />Log a class</button>
            </div>
            {r.takenList.length > 0 && (
              <ul className="pay-list taken-list" aria-label="Classes taken">
                {r.takenList.map((x) => (
                  <li key={x.id}>
                    <span>{fmtDate(x.date)}{noteText(x) && <span className="taken-note">{noteText(x)}</span>}</span>
                    <ConfirmButton iconOnly label={`Remove the class on ${fmtDate(x.date)}`} onConfirm={() => onRemoveClass(x.id)} />
                  </li>
                ))}
              </ul>
            )}
            {absentList.length > 0 && <p className="absent-line">Absent: {absentList.map((x) => fmtShort(x.date)).join(", ")}. Not counted.</p>}
          </div>
          {!r.classes && <p className="hint" style={{ marginTop: 0 }}>Classes per month is set to 0 for this student. Change it with Edit student to see how many are left.</p>}
          <p className="sub-h" style={{ marginTop: 14 }}>Payments in {monthLabel(month)}</p>
        </>
      )}
      {moneyOn && r.pays.length > 0 && (
        <ul className="pay-list">
          {r.pays.map((p) => (
            <li key={p.id}>
              <span>{fmtDate(p.date)}</span>
              <strong>{fcfa(p.amount)}</strong>
              {r.phone ? <WaButton phone={r.phone} text={receiptText(r, p, month)} ghost>Receipt</WaButton> : <CopyButton text={receiptText(r, p, month)} label="Copy the receipt" caption="Copy receipt" />}
              <ConfirmButton iconOnly label="Delete payment" onConfirm={() => onRemovePayment(p.id)} />
            </li>
          ))}
        </ul>
      )}
      {moneyOn && (
        <>
          <div className="grid2">
            <Field label="Amount (FCFA)"><input id={"pay-amt-" + r.id} className="inp" type="number" inputMode="numeric" min="0" step="500" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Date paid"><input id={"pay-date-" + r.id} className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <p className="hint">This payment counts toward {monthLabel(month)}.</p>
        </>
      )}
      <div className="form-actions">
        {moneyOn && <button className="btn" onClick={save} disabled={!valid}>Save payment</button>}
        {moneyOn && <button className="btn ghost sm" aria-expanded={showReport} onClick={() => setShowReport((s) => !s)}><Icon name="report" size={15} />{showReport ? "Hide report" : "Monthly report"}</button>}
        <button className="btn ghost sm" aria-expanded={showCert} onClick={() => setShowCert((s) => !s)}><Icon name="spark" size={15} />{showCert ? "Hide certificate" : "Certificate"}</button>
        <button className="btn ghost sm" onClick={onEdit}><Icon name="pencil" size={15} />Edit student</button>
        <ConfirmButton label="Remove student" onConfirm={onRemove} />
      </div>
      {moneyOn && showReport && <StudentReport r={r} month={month} lessons={lessons} decks={decks} />}
      {showCert && <CertificatePanel r={r} teacherName={teacherName} downloads={downloads} />}
    </div>
  );
}

function StudentsTeacher({ roster, saveRoster, pay, savePay, settings, saveSettings, lessons, decks, schedule = [], changes = [], places = [], downloads, teacherName, db, userId, flash, startOpen = null, onFile }) {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(startOpen);
  const money = useMoney(db, userId, month);
  const moneyOn = money.enabled && !money.failed;
  const att = useAttendance(moneyOn ? db : null, userId, month);
  const saveFailed = (e) => flash(e && e.code === "quota_exceeded" ? "Your private storage is full. Delete some old records, then try again." : "That didn't save. Check your connection and try again.");
  const groupNames = [...new Set(roster.map((r) => r.group).filter((g) => g && g !== EVERYONE))];
  const ctx = { schedule, changes, places };
  const rows = roster.map((s) => ({ ...s, ...studentMonth(s, money.fees, money.pays, att.taken, ctx) })).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const placeOptions = useMemo(() => {
    const m = new Map();
    [...schedule.map(placeName), ...places.map((p) => p.name), "Home"].forEach((n) => { if (n && !m.has(placeKey(n))) m.set(placeKey(n), n); });
    return [...m.values()];
  }, [schedule, places]);
  const defaultPlaceOf = (r) => placeName(schedule.find((s) => s.group === r.group)) || placeOptions[0] || "";
  const expected = rows.reduce((a, r) => a + r.fee, 0);
  const collected = rows.reduce((a, r) => a + r.paid, 0);
  const owed = rows.reduce((a, r) => a + Math.max(0, r.fee - r.paid), 0);
  const cutTotals = {};
  rows.forEach((r) => Object.keys(r.cutByPlace).forEach((p) => { cutTotals[p] = (cutTotals[p] || 0) + r.cutByPlace[p]; }));
  const totalCut = Object.values(cutTotals).reduce((a, v) => a + v, 0);
  const pct = expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const toPay = rows.filter((r) => r.fee > 0 && r.paid < r.fee);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    const name = form.name.trim();
    if (!name) return;
    if (form.phone.trim() && !waDigits(form.phone)) { flash("That WhatsApp number looks too short. Use the full number."); return; }
    const id = form.id || uid();
    const fee = Number(form.fee) || 0;
    const prev = roster.find((r) => r.id === id);
    const code = (prev && prev.code) || newCode(roster, id);
    const entry = { id, name, group: form.group.trim() || name, code };
    if (form.level) entry.level = form.level;
    if (form.show && fee > 0) entry.due = fee;
    saveRoster(form.id ? roster.map((r) => (r.id === id ? entry : r)) : [...roster, entry]);
    if (moneyOn) {
      const fees = { ...money.fees, [id]: {
        fee, share: (money.fees[id] && Number(money.fees[id].share)) || 0,
        classes: String(form.classes).trim() === "" ? null : Math.max(0, Math.round(Number(form.classes) || 0)),
        phone: form.phone.trim(), lang: form.lang,
      } };
      money.saveFees(fees).catch(saveFailed);
    }
    setForm(null); flash(prev ? "Student saved." : `Saved. ${name}'s code is ${code}.`);
  };
  const removeStudent = (id) => {
    saveRoster(roster.filter((r) => r.id !== id));
    if (moneyOn && money.fees[id]) { const fees = { ...money.fees }; delete fees[id]; money.saveFees(fees).catch(saveFailed); }
    setOpenId(null);
  };
  const addPayment = (studentId, amount, date) => {
    money.savePays([...money.pays, { id: uid(), studentId, amount, date }]).then(() => flash("Payment saved."), saveFailed);
  };
  const editStudent = (r) => {
    setForm({ id: r.id, name: r.name, group: r.group, fee: String(r.fee || r.due || ""), classes: r.classesCustom ? String(r.classes) : "", level: r.level || "", show: !!r.due, phone: r.phone, lang: r.lang });
    setOpenId(null); window.scrollTo(0, 0);
  };

  return (
    <section>
      <div className="h-row">
        <h2 className="h">Students</h2>
        {!form && <button className="btn sm" onClick={() => setForm({ id: null, name: "", group: "", fee: "", classes: "", level: "", show: true, phone: "", lang: "fr" })}><Icon name="plus" size={16} />Add student</button>}
      </div>
      {!moneyOn && (
        <p className="note">{money.enabled ? "Payments can't be loaded right now. Reload the page to try again." : "Sign in as the teacher to track fees and payments."}</p>
      )}
      {form && (
        <div className="form">
          <Field label="Name"><input id="st-name" className="inp" value={form.name} onChange={upd("name")} /></Field>
          <Field label="Group"><input id="st-group" className="inp" list="bm-groups" value={form.group} placeholder="Family class, Online group A..." onChange={upd("group")} /></Field>
          <datalist id="bm-groups">{groupNames.map((g) => <option key={g} value={g} />)}</datalist>
          <p className="hint">Leave it empty for one-on-one classes. The student gets a group of their own. Each student gets a 4-number code to open the app.</p>
          <div className="grid2">
            <Field label="Monthly fee (FCFA)"><input id="st-fee" className="inp" type="number" inputMode="numeric" min="0" step="500" placeholder="50000" value={form.fee} onChange={upd("fee")} /></Field>
            <Field label="Classes per month"><input id="st-classes" className="inp" type="number" inputMode="numeric" min="0" step="1" placeholder={String(DEFAULT_CLASSES)} value={form.classes} disabled={!moneyOn} onChange={upd("classes")} /></Field>
          </div>
          <p className="hint">Leave classes empty for {DEFAULT_CLASSES} a month (twice a week). Shares for places like the school are set in Business, then Settings.</p>
          <Field label="Level"><select id="st-level" className="inp" value={form.level} onChange={upd("level")}><option value="">Not set</option>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.en}</option>)}</select></Field>
          <div className="grid2">
            <Field label="WhatsApp number (private)"><input id="st-phone" className="inp" type="tel" inputMode="tel" placeholder="07 00 00 00 00" value={form.phone} disabled={!moneyOn} onChange={upd("phone")} /></Field>
            <Field label="Messages in">
              <select id="st-lang" className="inp" value={form.lang} disabled={!moneyOn} onChange={upd("lang")}><option value="fr">French</option><option value="en">English</option></select>
            </Field>
          </div>
          <p className="hint">For reminders, codes and monthly reports. Use the parent's number for children. Only you can see it.</p>
          <label className="check"><input id="st-show" type="checkbox" checked={form.show} onChange={(e) => setForm({ ...form, show: e.target.checked })} />Show this fee on their Pay screen</label>
          <p className="hint">The student sees their own fee. Anyone with the app link could find it in the page, so leave this off for fees you'd rather keep private.</p>
          <div className="form-actions">
            <button className="btn" onClick={submit} disabled={!form.name.trim()}>Save student</button>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {roster.length === 0 ? (!form && <Empty text="Add your students. Each one gets a code to open the app, and you track their payments here." />) : (
        <>
          {moneyOn && (
            <>
              <div className="month-nav">
                <button className="icon-btn" aria-label="Previous month" onClick={() => { setMonth((m) => shiftMonth(m, -1)); setOpenId(null); }}><Icon name="left" size={20} /></button>
                <strong>{monthLabel(month)}</strong>
                <button className="icon-btn" aria-label="Next month" onClick={() => { setMonth((m) => shiftMonth(m, 1)); setOpenId(null); }}><Icon name="right" size={20} /></button>
              </div>
              <div className="sum">
                <p className="muted small">Collected{money.ready ? "" : " (loading)"}</p>
                <p className="sum-big">{fcfa(collected)}</p>
                <p className="muted small">of {fcfa(expected)} expected</p>
                <div className="bar" role="img" aria-label={`${pct}% collected`}><i style={{ width: pct + "%" }} /></div>
                <div className="sum-line"><span>Still owed</span><strong>{fcfa(owed)}</strong></div>
                {Object.keys(cutTotals).map((p) => <div key={p} className="sum-line"><span>Share for {p}</span><strong>{fcfa(cutTotals[p])}</strong></div>)}
                {totalCut > 0 && <div className="sum-line"><span>Yours after shares</span><strong>{fcfa(collected - totalCut)}</strong></div>}
                {money.slow && <p className="hint" style={{ margin: "8px 0 0" }}>Payments can't be reached yet. What you see may be out of date.</p>}
              </div>
              {money.ready && toPay.length > 0 && (
                <div className="remind">
                  <p className="sub-h">Still to pay in {monthLabel(month)}</p>
                  <ul>
                    {toPay.map((r) => (
                      <li key={r.id}>
                        <span className="row-main"><span className="row-title">{r.name}</span><span className="row-sub">{fcfa(r.fee - r.paid)} left to pay</span></span>
                        {r.phone
                          ? <WaButton phone={r.phone} text={reminderText(r, month, pay)}>Remind</WaButton>
                          : <button className="btn ghost sm" onClick={() => editStudent(r)}>Add number</button>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <ul className="rows">
            {rows.map((r) => (
              <li key={r.id}>
                <button className="row-btn" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <span className="row-main">
                    <span className="row-title">{r.name}</span>
                    <span className="row-sub">{r.group}, code {r.code}</span>
                    {moneyOn && r.classes > 0 && (
                      <span className={"left-line" + (r.left <= 0 ? " out" : r.left <= 2 ? " low" : "")}>
                        {r.left >= 0 ? `${r.left} of ${r.classes} ${classWord(r.classes)} left` : `${-r.left} extra ${classWord(-r.left)} this month`}
                      </span>
                    )}
                  </span>
                  {moneyOn && (
                    <span className="amt">
                      <span className={"pill " + r.status}>{STATUS[r.status]}</span>
                      <span className="row-sub">{num(r.paid)}{r.fee ? ` of ${num(r.fee)}` : ""}</span>
                    </span>
                  )}
                </button>
                {openId === r.id && (
                  <StudentDetail key={r.id + month} r={r} month={month} moneyOn={moneyOn} lessons={lessons} decks={decks}
                    placeOptions={placeOptions} defaultPlace={defaultPlaceOf(r)} downloads={downloads} teacherName={teacherName}
                    onPay={(amount, date) => addPayment(r.id, amount, date)}
                    onRemovePayment={(pid) => money.savePays(money.pays.filter((p) => p.id !== pid)).catch(saveFailed)}
                    onLogClass={(date, place) => att.save([...att.taken, { id: uid(), studentId: r.id, date, place }]).then(() => flash("Class logged."), saveFailed)}
                    onRemoveClass={(tid) => att.save(att.taken.filter((x) => x.id !== tid)).catch(saveFailed)}
                    onNewCode={() => { const c = newCode(roster, r.id); saveRoster(roster.map((x) => (x.id === r.id ? { ...x, code: c } : x))); flash(`New code for ${r.name}: ${c}.`); }}
                    onEdit={() => editStudent(r)}
                    onRemove={() => removeStudent(r.id)}
                    onFile={onFile ? () => onFile(r.id) : null}
                    absentList={arr(att.absent).filter((x) => x.studentId === r.id)} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <section className="pay-settings">
        <h2 className="h">What students see</h2>
        <label className="check"><input id="show-status" type="checkbox" checked={settings.showStatus} onChange={(e) => saveSettings({ ...settings, showStatus: e.target.checked })} />Show students their classes left and whether they've paid</label>
        <p className="hint">They see it in Classes and Pay. It updates whenever you open the app, and anyone with a student's code can see that student's numbers.</p>
      </section>
      <PaySettings pay={pay} savePay={savePay} flash={flash} />
    </section>
  );
}

/* ---------- business records (private to the teacher) ---------- */
function useBiz(db, userId) {
  const path = db && userId ? "data/users/" + userId + "/biz" : "";
  const [biz, setBiz] = useState({ places: [], schools: [], teacher: { name: "", phone: "" } });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!path) return undefined;
    let un = () => {};
    try {
      un = db.doc(path).onSnapshot((s) => {
        const d = (s.exists && s.data()) || {};
        setBiz({ places: arr(d.places), schools: arr(d.schools), teacher: d.teacher && typeof d.teacher === "object" ? { name: d.teacher.name || "", phone: d.teacher.phone || "" } : { name: "", phone: "" } });
        setReady(true);
      }, () => setReady(true));
    } catch (e) { setReady(true); }
    return () => un();
  }, [path]);
  const save = (next) => { setBiz(next); return queuedSet(db.doc(path), next); };
  return { on: !!path, ready, biz, save };
}

function useVisits(db, userId, month) {
  const path = db && userId ? "data/users/" + userId + "/money/visits/" + month : "";
  const [data, setData] = useState({ visits: [], paid: [] });
  useEffect(() => {
    if (!path) return undefined;
    setData({ visits: [], paid: [] });
    let un = () => {};
    try {
      un = db.doc(path).onSnapshot((s) => {
        const d = (s.exists && s.data()) || {};
        setData({ visits: arr(d.visits), paid: arr(d.paid) });
      }, () => {});
    } catch (e) { /* unavailable */ }
    return () => un();
  }, [path]);
  const save = (next) => { setData(next); return queuedSet(db.doc(path), next); };
  return { on: !!path, data, save };
}

function useLibrary(db, userId) {
  const path = db && userId ? "data/users/" + userId + "/money" : "";
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!path) return undefined;
    let un = () => {};
    try {
      un = db.doc(path).collection("library").onSnapshot((qs) => setItems(qs.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    } catch (e) { /* unavailable */ }
    return () => un();
  }, [path]);
  const save = (plan) => db.doc(path).collection("library").doc(plan.id).set({ title: plan.title, level: plan.level, notes: plan.notes, homework: plan.homework, saved: todayISO() });
  const remove = (id) => db.doc(path).collection("library").doc(id).delete();
  return { on: !!path, items, save, remove };
}

/* ---------- Claude as a teaching helper (teacher only) ---------- */
const listPrompt = (topic) => `You help an English teacher in Côte d'Ivoire make vocabulary lists for French-speaking students.
Request: ${topic}
Make 12 useful English words or short phrases for this request, unless it asks for a different number (at most 25). For each, give the French meaning (with the article for nouns) and one short, simple English example sentence that suits these learners.
Reply with only JSON in this shape: {"title": "short list name in English", "words": [{"en": "kitchen", "fr": "la cuisine", "ex": "We cook in the kitchen."}]}`;
const lessonPrompt = (topic) => `You help an English teacher in Côte d'Ivoire plan a lesson of about one hour for French-speaking learners.
Request: ${topic}
Write a short lesson title; lesson notes the students will read after class (key words with their French meaning, two or three example sentences, and one short dialogue or activity), under 130 words; and a homework task that takes about 15 minutes. For a conversation lesson, make the notes a list of discussion questions with useful phrases.
Reply with only JSON in this shape: {"title": "...", "notes": "...", "homework": "..."}`;

function AskClaude({ sample, title, label, placeholder, button, makePrompt, onResult }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [gone, setGone] = useState(false);
  const ctl = useRef(null);
  if (!sample) return null;
  if (gone) return <p className="hint">Claude isn't available in this view. Reload the page to be asked again.</p>;
  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setMsg("Thinking. This can take up to a minute.");
    ctl.current = new AbortController();
    try {
      const data = await sample.json(makePrompt(text.trim()), { signal: ctl.current.signal, cache: false });
      if (onResult(data) === false) setMsg("Claude's answer didn't come out right. Try again, or change the request.");
      else { setMsg(""); setText(""); }
    } catch (e) {
      const code = e && e.code;
      if (code === "cancelled") setMsg("");
      else if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) setGone(true);
      else if (code === "rate_limited") setMsg("Claude is busy, or you've reached your usage limit. Try again later.");
      else if (["invalid_json", "empty_completion", "refused"].includes(code)) setMsg("Claude's answer didn't come out right. Try again, or change the request.");
      else setMsg("Something went wrong. Check your connection and try again.");
    } finally { setBusy(false); }
  };
  return (
    <div className="ask">
      <p className="form-title"><Icon name="spark" size={16} />{title}</p>
      <div className="inline-add" style={{ marginBottom: msg ? 8 : 0 }}>
        <input className="inp" aria-label={label} placeholder={placeholder} value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        {busy
          ? <button className="btn ghost" onClick={() => ctl.current && ctl.current.abort()}>Stop</button>
          : <button className="btn" onClick={run} disabled={!text.trim()}>{button}</button>}
      </div>
      {msg && <p className="hint" role="status" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

/* ---------- lesson library ---------- */
function Library({ items, onUse, onRemove }) {
  if (!items.length) return <Empty text="Your library is empty. Open a lesson and tap Save to library, then reuse it with any group." />;
  const levelOf = (p) => (AUDIENCES.includes(p.level) ? p.level : "Other");
  return (
    <>
      {[...AUDIENCES, "Other"].map((level) => {
        const list = items.filter((p) => levelOf(p) === level).sort((a, b) => String(a.title).localeCompare(String(b.title)));
        if (!list.length) return null;
        return (
          <div key={level} className="day-block">
            <p className="day-name">{level}</p>
            <ul className="rows">
              {list.map((p) => (
                <li key={p.id} className="lib-row">
                  <div className="row-main">
                    <span className="row-title">{p.title}</span>
                    {p.notes && <span className="row-sub clamp">{p.notes}</span>}
                  </div>
                  <div className="pay-actions">
                    <button className="btn sm" onClick={() => onUse(p)}>Use</button>
                    <ConfirmButton iconOnly label={`Delete ${p.title}`} onConfirm={() => onRemove(p.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/* ---------- lesson plans (courses.json at the site root, written from the teacher's Claude docs) ---------- */
let coursesCache = null;
function useCourses() {
  const [state, setState] = useState(() => (coursesCache ? { status: "ready", data: coursesCache } : { status: "loading", data: null }));
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (coursesCache) return undefined;
    let live = true;
    setState({ status: "loading", data: null });
    fetch(window.BM_COURSES || "courses.json")
      .then((r) => { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then((d) => {
        coursesCache = { courses: arr(d && d.courses).filter((c) => c && c.id), wordLists: arr(d && d.wordLists).filter((w) => w && w.id) };
        if (live) setState({ status: "ready", data: coursesCache });
      })
      .catch(() => { if (live) setState({ status: "error", data: null }); });
    return () => { live = false; };
  }, [tries]);
  return { ...state, retry: () => setTries((n) => n + 1) };
}

/* A small reader for the lesson text: ### headings, **bold**, _italic_, lists, nested lists and | tables |. */
const MD_INLINE = /\*\*([^*]+)\*\*|(^|[\s(“"'])_([^_\n]+)_(?=[\s.,;:!?)”"']|$)/g;
function mdInline(text, key) {
  const src = String(text || "");
  const out = [];
  let last = 0;
  let n = 0;
  let m;
  MD_INLINE.lastIndex = 0;
  while ((m = MD_INLINE.exec(src))) {
    if (m[1] !== undefined) { out.push(src.slice(last, m.index)); out.push(<strong key={key + "-" + n++}>{m[1]}</strong>); }
    else { out.push(src.slice(last, m.index) + m[2]); out.push(<em key={key + "-" + n++}>{m[3]}</em>); }
    last = MD_INLINE.lastIndex;
  }
  out.push(src.slice(last));
  return out;
}
function mdBlocks(text) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  const itemRe = /^(\d+\.|-|\[ \])\s+(.*)$/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ t: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim();
        if (!/^\|[\s:|-]+\|$/.test(r)) rows.push(r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
        i++;
      }
      if (rows.length) blocks.push({ t: "table", rows });
      continue;
    }
    const first = itemRe.exec(line);
    if (first) {
      const ordered = /^\d+\./.test(first[1]);
      const items = [];
      while (i < lines.length) {
        const raw = lines[i];
        const tr = raw.trim();
        if (!tr) break;
        const indent = raw.length - raw.replace(/^\s+/, "").length;
        const mm = itemRe.exec(tr);
        if (indent >= 2 && items.length) {
          const lastItem = items[items.length - 1];
          if (mm) lastItem.sub.push(mm[2]); else lastItem.text += " " + tr;
          i++; continue;
        }
        if (!mm || /^\d+\./.test(mm[1]) !== ordered) break;
        items.push({ text: mm[2], sub: [] });
        i++;
      }
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    blocks.push({ t: "p", text: line });
    i++;
  }
  return blocks;
}
function Md({ text }) {
  const blocks = useMemo(() => mdBlocks(text), [text]);
  return (
    <div className="md">
      {blocks.map((b, k) => {
        if (b.t === "h") return b.level <= 3 ? <h4 key={k}>{mdInline(b.text, k)}</h4> : <h5 key={k}>{mdInline(b.text, k)}</h5>;
        if (b.t === "p") return <p key={k}>{mdInline(b.text, k)}</p>;
        if (b.t === "table") {
          return (
            <div key={k} className="md-table">
              <table>
                <thead><tr>{b.rows[0].map((c, j) => <th key={j} scope="col">{mdInline(c, k + "h" + j)}</th>)}</tr></thead>
                <tbody>{b.rows.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{mdInline(c, k + "r" + ri + "c" + j)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        const List = b.t === "ol" ? "ol" : "ul";
        return (
          <List key={k}>
            {b.items.map((it, j) => (
              <li key={j}>
                {mdInline(it.text, k + "i" + j)}
                {it.sub.length > 0 && <ul>{it.sub.map((x, si) => <li key={si}>{mdInline(x, k + "i" + j + "s" + si)}</li>)}</ul>}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

function WordListOffers({ lists, decks, saveDecks, groups, flash }) {
  const [openId, setOpenId] = useState(null);
  const [group, setGroup] = useState(EVERYONE);
  const added = (w) => decks.some((d) => d.title === w.title);
  const add = (w) => {
    const cards = arr(w.cards).map((c) => { const x = { id: uid(), en: String(c.en || ""), fr: String(c.fr || ""), ex: String(c.ex || "") }; if (c.pic) x.pic = String(c.pic); return x; }).filter((c) => c.en && c.fr);
    saveDecks([{ id: uid(), title: w.title, group, cards }, ...decks]);
    setOpenId(null);
    flash(`${w.title} is in Lessons, Vocab now, for ${group}.`);
  };
  const parts = [["Picture lists for kids", lists.filter((w) => w.kids)], ["More word lists", lists.filter((w) => !w.kids)]].filter(([, l]) => l.length);
  return (
    <div className="day-block">
      <p className="day-name">Word lists</p>
      <p className="hint">Ready-made lists with the French. Add one and your students can practice it with flashcards and quizzes. Lists with pictures also get two games for kids: Listen and Memory.</p>
      {parts.map(([label, part]) => (
        <div key={label}>
          <p className="sub-h">{label}</p>
          <ul className="rows">
            {part.map((w) => (
              <li key={w.id} className="lib-row">
                <div className="row-main">
                  <span className="row-title">{w.kids && arr(w.cards)[0] && <span aria-hidden="true">{arr(w.cards)[0].pic} </span>}{w.title}</span>
                  <span className="row-sub">{arr(w.cards).length} words. {w.about}</span>
                </div>
                <div className="pay-actions">
                  {added(w) ? <span className="muted small"><Icon name="check" size={15} /> In Words</span>
                    : openId !== w.id && <button className="btn sm" onClick={() => { setGroup(groups[1] || EVERYONE); setOpenId(w.id); }}>Add to Vocab</button>}
                </div>
                {openId === w.id && (
                  <div className="inline-add lib-add">
                    <select className="inp" aria-label={`Who ${w.title} is for`} value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                    <button className="btn sm" onClick={() => add(w)}>Add</button>
                    <button className="btn ghost sm" onClick={() => setOpenId(null)}>Cancel</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* Each student's own list of lessons: data/users/{uid}/plans/{studentId} = { items: [{ id, course, item } | { id, custom: { title, notes, homework } }, used?] } */
/* Each student's lesson list: data/users/{uid}/money/plans/{studentId} (a collection needs an odd number of path parts). */
function usePlans(db, userId) {
  const path = db && userId ? "data/users/" + userId + "/money/plans" : "";
  const [plans, setPlans] = useState({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!path) return undefined;
    let un = () => {};
    try {
      un = db.collection(path).onSnapshot((qs) => {
        const next = {};
        qs.docs.forEach((d) => { next[d.id] = arr((d.data() || {}).items); });
        setPlans(next); setReady(true);
      }, () => setReady(true));
    } catch (e) { setReady(true); }
    return () => un();
  }, [path]);
  const save = (studentId, items) => {
    setPlans((cur) => ({ ...cur, [studentId]: items }));
    return queuedSet(db.collection(path).doc(studentId), { items, updated: new Date().toISOString() });
  };
  return { on: !!path, ready, plans, save };
}

const PLAN_SKIP = ["Start here", "Checklists", "Extras"];
const isLessonItem = (it) => !PLAN_SKIP.includes(it.section);
const lessonTopic = (title) => String(title || "").replace(/^(Lesson \d+|Bonus [A-Z]|Week \d+)\s*[–:-]\s*/, "");

function LessonPage({ backLabel, onBack, kicker, title, actions, body, prev, next, onPrev, onNext }) {
  return (
    <article className="lib-item">
      <button className="back-link" onClick={onBack}><Icon name="left" />{backLabel}</button>
      {kicker && <p className="muted small">{kicker}</p>}
      <h3 className="lib-title">{title}</h3>
      {actions && <div className="lib-use">{actions}</div>}
      <Md text={body} />
      <div className="lib-nav">
        {prev ? <button className="btn ghost sm" onClick={onPrev}><Icon name="left" size={16} />Previous</button> : <span />}
        {next && <button className="btn ghost sm" onClick={onNext}>Next<Icon name="right" size={16} /></button>}
      </div>
    </article>
  );
}

function AddToStudent({ roster, onAdd }) {
  const [open, setOpen] = useState(false);
  const [sid, setSid] = useState("");
  if (!roster.length) return null;
  if (!open) return <button className="btn ghost sm" onClick={() => { setSid(roster[0].id); setOpen(true); }}><Icon name="plus" size={15} />Add to a student's lessons</button>;
  return (
    <div className="inline-add lib-add">
      <select className="inp" aria-label="Which student" value={sid} onChange={(e) => setSid(e.target.value)}>{roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button className="btn sm" onClick={() => { onAdd(sid); setOpen(false); }}>Add</button>
      <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

function AddLessons({ student, courses, have, onAddItems, onAddCustom, onBack }) {
  const [openCourse, setOpenCourse] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [custom, setCustom] = useState({ title: "", notes: "", homework: "" });
  const toggle = (key) => setPicked((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const addPicked = () => {
    const list = [];
    courses.forEach((c) => arr(c.items).forEach((it) => { if (picked.has(c.id + "/" + it.id)) list.push({ course: c.id, item: it.id }); }));
    onAddItems(list);
  };
  const addBtn = picked.size > 0 && <button className="btn" onClick={addPicked}>Add {picked.size} {picked.size === 1 ? "lesson" : "lessons"}</button>;
  return (
    <section>
      <button className="back-link" onClick={onBack}><Icon name="left" />{student.name}'s lessons</button>
      <h3 className="lib-title">Add lessons for {student.name}</h3>
      <p className="hint">Add a whole course, or tap Pick lessons and tick the ones you want. They go on {student.name}'s list in course order.</p>
      {addBtn && <div className="lib-use">{addBtn}</div>}
      <ul className="rows">
        {courses.map((c) => {
          const lessons = arr(c.items).filter(isLessonItem);
          const fresh = lessons.filter((it) => !have.has(c.id + "/" + it.id));
          const isOpen = openCourse === c.id;
          return (
            <li key={c.id}>
              <div className="lib-row">
                <div className="row-main">
                  <span className="row-title">{c.title}</span>
                  <span className="row-sub">{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}{fresh.length < lessons.length ? `, ${lessons.length - fresh.length} already on the list` : ""}</span>
                </div>
                <div className="pay-actions">
                  {fresh.length > 0 && <button className="btn sm" onClick={() => onAddItems(fresh.map((it) => ({ course: c.id, item: it.id })))}>{fresh.length === 1 ? "Add it" : `Add all ${fresh.length}`}</button>}
                  <button className="btn ghost sm" aria-expanded={isOpen} onClick={() => setOpenCourse(isOpen ? null : c.id)}>{isOpen ? "Close" : "Pick lessons"}</button>
                </div>
              </div>
              {isOpen && (
                <div className="pick-list">
                  {lessons.map((it) => {
                    const key = c.id + "/" + it.id;
                    const already = have.has(key);
                    return (
                      <label key={it.id} className="check">
                        <input type="checkbox" checked={already || picked.has(key)} disabled={already} onChange={() => toggle(key)} />
                        <span>{it.title}{already && <span className="muted small"> (on the list)</span>}</span>
                      </label>
                    );
                  })}
                  {addBtn && <div className="lib-use">{addBtn}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="day-block">
        <p className="day-name">Or write a lesson just for {student.name}</p>
        <div className="form">
          <Field label="Title"><input id="own-title" className="inp" value={custom.title} placeholder="Talking about my weekend" onChange={(e) => setCustom({ ...custom, title: e.target.value })} /></Field>
          <Field label="The plan"><textarea id="own-notes" className="inp" value={custom.notes} placeholder="New words, phrases, what you'll do in class..." onChange={(e) => setCustom({ ...custom, notes: e.target.value })} /></Field>
          <Field label="Home practice (optional)"><textarea id="own-hw" className="inp" value={custom.homework} placeholder="Send me a voice note about your weekend." onChange={(e) => setCustom({ ...custom, homework: e.target.value })} /></Field>
          <div className="form-actions">
            <button className="btn" disabled={!custom.title.trim()} onClick={() => onAddCustom({ title: custom.title.trim(), notes: custom.notes.trim(), homework: custom.homework.trim() })}>Add to {student.name}'s lessons</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CourseLibrary({ saved, onUse, onRemoveSaved, decks, saveDecks, groups, flash, roster = [], plansH, progressMap = {}, startNav = null }) {
  const { status, data, retry } = useCourses();
  const [nav, setNav] = useState(() => startNav || { view: "home" });
  const [q, setQ] = useState("");
  const go = (n) => { setNav(n); window.scrollTo(0, 0); };
  const fail = () => flash("That didn't save. Check your connection and try again.");
  const savedBlock = saved.length > 0 && (
    <div className="day-block">
      <p className="day-name">Saved by you</p>
      <Library items={saved} onUse={onUse} onRemove={onRemoveSaved} />
    </div>
  );
  if (status === "loading") return <p className="muted">Opening your lesson plans...</p>;
  if (status === "error") {
    return (
      <>
        <Empty text="Your lesson plans didn't load. Check your connection and try again."><button className="btn sm" onClick={retry}>Try again</button></Empty>
        {savedBlock}
      </>
    );
  }
  const courses = data.courses;
  const students = [...roster].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const plansOn = !!(plansH && plansH.on);
  const planOf = (sid) => (plansOn ? arr(plansH.plans[sid]) : []);
  const findItem = (cid, iid) => {
    const c = courses.find((x) => x.id === cid);
    const it = c && arr(c.items).find((x) => x.id === iid);
    return c && it ? { c, it } : null;
  };
  const entriesOf = (sid) => planOf(sid).map((p) => {
    if (p.custom) {
      const cu = p.custom;
      return { p, title: cu.title, from: "Your own lesson", body: [cu.notes, cu.homework ? "**Home practice:** " + cu.homework : ""].filter(Boolean).join("\n\n") || "_No plan written yet._", send: { title: cu.title, notes: cu.notes || "", homework: cu.homework || "" } };
    }
    const f = findItem(p.course, p.item);
    if (!f) return { p, missing: true, title: "A lesson that's no longer in the library", from: "" };
    return { p, title: f.it.title, from: f.c.title, body: f.it.body, send: f.it.send || { title: lessonTopic(f.it.title), notes: "", homework: "" } };
  });
  const savePlan = (sid, items, msg) => plansH.save(sid, items).then(() => { if (msg) flash(msg); }, fail);
  const appendTo = (sid, list) => {
    const cur = planOf(sid);
    const have = new Set(cur.filter((x) => !x.custom).map((x) => x.course + "/" + x.item));
    const add = list.filter((x) => x.custom || !have.has(x.course + "/" + x.item)).map((x) => ({ id: uid(), ...x }));
    const who = (roster.find((r) => r.id === sid) || {}).name || "the student";
    if (!add.length) { flash(`That's already on ${who}'s list.`); return; }
    savePlan(sid, [...cur, ...add], add.length === 1 ? `Added to ${who}'s lessons.` : `Added ${add.length} lessons to ${who}'s list.`);
  };
  const studentLine = (r) => {
    const es = entriesOf(r.id);
    const done = es.filter((e) => e.p.used).length;
    const nextE = es.find((e) => !e.p.used && !e.missing);
    const grp = r.group && r.group !== r.name ? r.group + ". " : "";
    if (!es.length) return grp + "No lessons yet";
    return grp + `${done} of ${es.length} taught` + (nextE ? `. Next: ${nextE.title}` : ". All taught");
  };

  /* one student's list */
  if ((nav.view === "student" || nav.view === "add" || nav.view === "plan" || nav.view === "skills") && plansOn) {
    const r = roster.find((x) => x.id === nav.studentId);
    if (!r) { setTimeout(() => go({ view: "home" }), 0); return null; }
    const entries = entriesOf(r.id);
    if (nav.view === "skills") {
      const planCourseIds = [...new Set(planOf(r.id).filter((x) => !x.custom).map((x) => x.course))];
      return <SkillsEditor student={r} courses={courses} planCourseIds={planCourseIds} prog={progressMap[r.id]} flash={flash} onBack={() => go({ view: "student", studentId: r.id })} />;
    }
    if (nav.view === "add") {
      const have = new Set(planOf(r.id).filter((x) => !x.custom).map((x) => x.course + "/" + x.item));
      return (
        <AddLessons student={r} courses={courses} have={have} onBack={() => go({ view: "student", studentId: r.id })}
          onAddItems={(list) => { appendTo(r.id, list); go({ view: "student", studentId: r.id }); }}
          onAddCustom={(cu) => { appendTo(r.id, [{ custom: cu }]); go({ view: "student", studentId: r.id }); }} />
      );
    }
    if (nav.view === "plan") {
      const live = entries.filter((e) => !e.missing);
      const k = live.findIndex((e) => e.p.id === nav.planId);
      const e = live[k];
      if (!e) { setTimeout(() => go({ view: "student", studentId: r.id }), 0); return null; }
      const setUsed = (val) => savePlan(r.id, planOf(r.id).map((x) => (x.id === e.p.id ? { ...x, used: val || null } : x)), val ? "Marked as taught." : "Marked as not taught yet.");
      return (
        <LessonPage backLabel={`${r.name}'s lessons`} onBack={() => go({ view: "student", studentId: r.id })}
          kicker={e.from + (e.p.used ? `. Taught ${fmtDate(e.p.used)}` : "")} title={e.title} body={e.body}
          actions={(
            <>
              <button className="btn" onClick={() => onUse(e.send, { group: r.group, studentId: r.id, planId: e.p.id })}>{e.p.used ? `Use again for ${r.name}` : `Use for ${r.name}'s class`}</button>
              <p className="hint">Opens a new lesson for {r.group || r.name} with the words and home practice filled in. Saving it marks this lesson as taught.</p>
              <div className="pay-actions">
                {e.p.used ? <button className="btn ghost sm" onClick={() => setUsed(null)}>Mark as not taught</button>
                  : <button className="btn ghost sm" onClick={() => setUsed(todayISO())}><Icon name="check" size={15} />Mark as taught</button>}
                <ConfirmButton label={`Remove from ${r.name}'s lessons`} onConfirm={() => { savePlan(r.id, planOf(r.id).filter((x) => x.id !== e.p.id), "Removed from the list."); go({ view: "student", studentId: r.id }); }} />
              </div>
            </>
          )}
          prev={live[k - 1]} next={live[k + 1]}
          onPrev={() => go({ view: "plan", studentId: r.id, planId: live[k - 1].p.id })}
          onNext={() => go({ view: "plan", studentId: r.id, planId: live[k + 1].p.id })} />
      );
    }
    const done = entries.filter((e) => e.p.used).length;
    const nextIdx = entries.findIndex((e) => !e.p.used && !e.missing);
    return (
      <section>
        <button className="back-link" onClick={() => go({ view: "home" })}><Icon name="left" />Library</button>
        <h3 className="lib-title">{r.name}</h3>
        <p className="muted lib-about">
          {r.group && r.group !== r.name ? `Group: ${r.group}. ` : ""}
          {entries.length ? `${done} of ${entries.length} lessons taught.` : "No lessons on the list yet."}
        </p>
        <div className="lib-use pay-actions">
          <button className="btn" onClick={() => go({ view: "add", studentId: r.id })}><Icon name="plus" size={16} />Add lessons</button>
          <button className="btn ghost" onClick={() => go({ view: "skills", studentId: r.id })}><Icon name="award" size={16} />What {r.name} can do{(() => { const n = Object.keys(((progressMap[r.id] || {}).skills) || {}).length; return n ? ` (${n})` : ""; })()}</button>
        </div>
        {entries.length === 0 ? <Empty text={`Add a whole course for ${r.name}, pick single lessons, or write your own.`} /> : (
          <ul className="rows">
            {entries.map((e, k) => (
              <li key={e.p.id}>
                {e.missing ? (
                  <div className="lib-row">
                    <div className="row-main"><span className="row-sub">{e.title}</span></div>
                    <ConfirmButton iconOnly label="Remove it" onConfirm={() => savePlan(r.id, planOf(r.id).filter((x) => x.id !== e.p.id))} />
                  </div>
                ) : (
                  <button className="row-btn" onClick={() => go({ view: "plan", studentId: r.id, planId: e.p.id })}>
                    <span className={"plan-num" + (e.p.used ? " is-done" : k === nextIdx ? " is-next" : "")} aria-hidden="true">{e.p.used ? <Icon name="check" size={14} /> : k + 1}</span>
                    <span className="row-main">
                      <span className="row-title">{e.title}</span>
                      <span className="row-sub">{e.p.used ? `Taught ${fmtDate(e.p.used)}` : k === nextIdx ? `Next. ${e.from}` : e.from}</span>
                    </span>
                    <Icon name="right" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  /* a course and its lessons */
  const course = courses.find((c) => c.id === nav.courseId);
  const items = course ? arr(course.items) : [];
  if (nav.view === "item" && course) {
    const k = items.findIndex((x) => x.id === nav.itemId);
    const item = items[k];
    if (item) {
      return (
        <LessonPage backLabel={course.title} onBack={() => go({ view: "course", courseId: course.id })}
          kicker={item.section} title={item.title} body={item.body}
          actions={(
            <>
              {item.send && <button className="btn" onClick={() => onUse(item.send)}>Use for a class</button>}
              {item.send && <p className="hint">Opens a new lesson with the words and home practice filled in, ready to pick the group and save for your students.</p>}
              {plansOn && isLessonItem(item) && <AddToStudent roster={students} onAdd={(sid) => appendTo(sid, [{ course: course.id, item: item.id }])} />}
            </>
          )}
          prev={items[k - 1]} next={items[k + 1]}
          onPrev={() => go({ view: "item", courseId: course.id, itemId: items[k - 1].id })}
          onNext={() => go({ view: "item", courseId: course.id, itemId: items[k + 1].id })} />
      );
    }
  }
  if ((nav.view === "course" || nav.view === "item") && course) {
    const sections = [];
    items.forEach((it) => {
      let sec = sections.find((x) => x.name === it.section);
      if (!sec) { sec = { name: it.section || "", intro: "", list: [] }; sections.push(sec); }
      if (it.sectionIntro) sec.intro = it.sectionIntro;
      sec.list.push(it);
    });
    return (
      <section>
        <button className="back-link" onClick={() => go({ view: "home" })}><Icon name="left" />Library</button>
        <h3 className="lib-title">{course.title}</h3>
        {course.about && <p className="muted lib-about">{course.about}</p>}
        {sections.map((sec) => (
          <div key={sec.name} className="day-block">
            <p className="day-name">{sec.name}</p>
            {sec.intro && <p className="hint">{sec.intro}</p>}
            <ul className="rows">
              {sec.list.map((it) => (
                <li key={it.id}>
                  <button className="row-btn" onClick={() => go({ view: "item", courseId: course.id, itemId: it.id })}>
                    <span className="row-main">
                      <span className="row-title">{it.title}</span>
                      {it.send && it.send.notes && <span className="row-sub clamp">{it.send.notes.split("\n")[0]}</span>}
                    </span>
                    <Icon name="right" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    );
  }

  /* the Library's first page */
  const ql = q.trim().toLowerCase();
  const hits = ql.length >= 2
    ? courses.flatMap((c) => arr(c.items).filter((it) => (it.title + "\n" + it.body).toLowerCase().includes(ql)).map((it) => ({ c, it }))).slice(0, 40)
    : [];
  return (
    <>
      <input className="inp lib-search" type="search" aria-label="Search your lesson plans" placeholder="Search, e.g. colors or airport" value={q} onChange={(e) => setQ(e.target.value)} />
      {ql.length >= 2 ? (
        hits.length ? (
          <ul className="rows">
            {hits.map(({ c, it }) => (
              <li key={c.id + it.id}>
                <button className="row-btn" onClick={() => { setQ(""); go({ view: "item", courseId: c.id, itemId: it.id }); }}>
                  <span className="row-main"><span className="row-title">{it.title}</span><span className="row-sub">{c.title}</span></span>
                  <Icon name="right" />
                </button>
              </li>
            ))}
          </ul>
        ) : <Empty text={`Nothing in your lesson plans matches "${q.trim()}".`} />
      ) : (
        <>
          {plansOn && (
            <div className="day-block">
              <p className="day-name">Your students</p>
              {students.length === 0 ? <p className="hint">Add your students in the Students tab, and each one gets a list of lessons here.</p> : (
                <ul className="rows">
                  {students.map((r) => (
                    <li key={r.id}>
                      <button className="row-btn" onClick={() => go({ view: "student", studentId: r.id })}>
                        <span className="row-main"><span className="row-title">{r.name}</span><span className="row-sub">{studentLine(r)}</span></span>
                        <Icon name="right" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="day-block">
            <p className="day-name">All lesson plans</p>
            {courses.length === 0 ? <Empty text="No lesson plans yet." /> : (
              <ul className="rows">
                {courses.map((c) => (
                  <li key={c.id}>
                    <button className="row-btn" onClick={() => go({ view: "course", courseId: c.id })}>
                      <span className="row-main"><span className="row-title">{c.title}</span><span className="row-sub">{c.about}</span></span>
                      <Icon name="right" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {data.wordLists.length > 0 && <WordListOffers lists={data.wordLists} decks={decks} saveDecks={saveDecks} groups={groups} flash={flash} />}
          {savedBlock}
        </>
      )}
    </>
  );
}

/* ---------- "What I can do": skills from the lesson plans, ticked by the teacher ---------- */
function skillRows(courses, skills, extraIds = []) {
  const ticked = Object.keys(skills || {});
  const ids = new Set(extraIds);
  ticked.forEach((k) => ids.add(k.split("/")[0]));
  return courses.filter((c) => ids.has(c.id) && arr(c.skills).length);
}
function ProgressStudent({ me, prog, sample = false }) {
  const { t, lang } = useT();
  const { status, data } = useCourses();
  const skills = (prog && prog.skills) || {};
  const replies = Object.values((prog && prog.replies) || {});
  const stars = replies.reduce((s, r) => s + (Number(r.stars) || 0), 0);
  const done = Object.keys(skills).length;
  const courses = status === "ready" ? skillRows(data.courses, skills, arr(prog && prog.courses)) : [];
  return (
    <section>
      <h2 className="h">{t("progressTitle")}{sample && <span className="sample-tag">{t("sampleTag")}</span>}</h2>
      {sample && <p className="hint">{t("sampleProgress")}</p>}
      <div className="panel rings progress-sum">
        <p className="progress-big">{done}</p>
        <p>{t("skillsCount", done)}</p>
        {stars > 0 && <p className="progress-stars"><Icon name="star" size={18} />{t("starsFromTeacher", stars)}</p>}
      </div>
      {prog === null || status === "loading" ? <p className="muted">{t("loadingProgress")}</p>
        : courses.length === 0 ? <Empty text={t("noSkillsYet")} /> : courses.map((c) => {
          const units = [];
          arr(c.skills).forEach((s) => { let u = units.find((x) => x.name === s.unit); if (!u) { u = { name: s.unit, fr: s.unitFr || s.unit, list: [] }; units.push(u); } u.list.push(s); });
          return units.map((u) => (
            <div key={c.id + u.name} className="day-block">
              <p className="day-name">{lang === "fr" ? u.fr : u.name}</p>
              <ul className="skill-list">
                {u.list.map((s) => {
                  const when = skills[c.id + "/" + s.id];
                  return (
                    <li key={s.id} className={when ? "got" : ""}>
                      <span className="skill-mark" aria-hidden="true">{when ? <Icon name="check" size={15} /> : null}</span>
                      <span className="skill-text">{lang === "fr" ? s.fr : s.en}
                        <span className="muted small skill-when">{when ? t("canDoSince", fmtDate(when, lang)) : t("comingNext")}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ));
        })}
    </section>
  );
}

function SkillsEditor({ student, courses, planCourseIds, prog, onBack, flash }) {
  const skills = (prog && prog.skills) || {};
  const [extra, setExtra] = useState([]);
  const shownIds = [...new Set([...planCourseIds, ...arr(prog && prog.courses), ...extra])];
  const shown = skillRows(courses, skills, shownIds);
  const others = courses.filter((c) => arr(c.skills).length && !shown.some((x) => x.id === c.id));
  const save = (nextSkills, ids) => FB.db.doc("progress/" + student.id).set({ skills: nextSkills, courses: ids, updated: new Date().toISOString() }, { mergeFields: ["skills", "courses", "updated"] })
    .catch(() => flash("That didn't save. Check your connection and try again."));
  const toggle = (key) => {
    const next = { ...skills };
    if (next[key]) delete next[key]; else next[key] = todayISO();
    save(next, shown.map((c) => c.id));
  };
  const total = shown.reduce((n, c) => n + arr(c.skills).length, 0);
  const got = shown.reduce((n, c) => n + arr(c.skills).filter((s) => skills[c.id + "/" + s.id]).length, 0);
  return (
    <section>
      <button className="back-link" onClick={onBack}><Icon name="left" />{student.name}'s lessons</button>
      <h3 className="lib-title">What {student.name} can do</h3>
      <p className="hint">Tick a skill when {student.name} can do it without help. {student.name} and their family see the list, in English or French, in the Progress tab with their code.</p>
      {shown.length > 0 && <p className="muted lib-about">{got} of {total} ticked.</p>}
      {shown.length === 0 && <Empty text={`Add a course to ${student.name}'s lessons, or pick one below, to see its skills.`} />}
      {shown.map((c) => {
        const units = [];
        arr(c.skills).forEach((s) => { let u = units.find((x) => x.name === s.unit); if (!u) { u = { name: s.unit, list: [] }; units.push(u); } u.list.push(s); });
        return (
          <div key={c.id} className="day-block">
            <p className="day-name">{c.title}</p>
            {units.map((u) => (
              <div key={u.name} className="skill-unit">
                <p className="sub-h">{u.name}</p>
                {u.list.map((s) => {
                  const key = c.id + "/" + s.id;
                  return (
                    <label key={s.id} className="check skill-check">
                      <input type="checkbox" checked={!!skills[key]} onChange={() => toggle(key)} />
                      <span>{s.en}{skills[key] && <span className="muted small"> · {fmtDate(skills[key])}</span>}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
      {others.length > 0 && (
        <div className="inline-add">
          <select className="inp" aria-label="Show skills from another course" value="" onChange={(e) => { if (e.target.value) setExtra((x) => [...x, e.target.value]); }}>
            <option value="">Show skills from another course...</option>
            {others.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}
    </section>
  );
}

/* ---------- the teacher's voice-note inbox ---------- */
function VoiceNote({ v, reply, flash }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [stars, setStars] = useState(reply ? reply.stars || 0 : 0);
  const [note, setNote] = useState(reply ? reply.note || "" : "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    let made = "";
    loadVoice(v).then((u) => { made = u; if (live) setUrl(u); else URL.revokeObjectURL(u); }, () => { if (live) setFailed(true); });
    if (!v.heard) FB.db.doc("voice/" + v.id).set({ heard: true }, { merge: true }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [v.id]);
  const send = () => {
    setBusy(true);
    const r = { stars, note: note.trim(), title: v.title || "", lessonId: v.lessonId || "", at: todayISO() };
    Promise.all([saveReply(v.sid, v.id, r), FB.db.doc("voice/" + v.id).set({ heard: true, replied: true }, { merge: true })])
      .then(() => flash(`Reply sent. ${v.name} sees it under that homework.`), () => flash("That didn't save. Check your connection and try again."))
      .then(() => setBusy(false));
  };
  return (
    <div className="voice-open">
      {failed ? <p className="say-result error">This recording didn't load. Check your connection and try again.</p>
        : url ? <audio controls src={url} className="voice-audio" /> : <p className="muted small">Loading the recording...</p>}
      <p className="sub-h">Your reply</p>
      <div className="star-pick" role="group" aria-label="Stars">
        {[1, 2, 3].map((n) => (
          <button key={n} className={"star-btn" + (stars >= n ? " on" : "")} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} aria-pressed={stars === n} onClick={() => setStars(stars === n ? 0 : n)}>
            <Icon name="star" size={26} />
          </button>
        ))}
      </div>
      <Field label="A short note (optional)">
        <textarea className="inp" rows={2} value={note} placeholder="Great pronunciation! Next time, say 'three' with your tongue between your teeth." onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="pay-actions">
        <button className="btn" onClick={send} disabled={busy || (!stars && !note.trim())}>{reply ? "Update reply" : "Send reply"}</button>
        <ConfirmButton label="Delete recording" onConfirm={() => deleteVoice(v).then(() => flash("Recording deleted."), () => flash("That didn't delete. Try again."))} />
      </div>
    </div>
  );
}
function VoiceInbox({ notes, progressMap, flash }) {
  const [openId, setOpenId] = useState(null);
  const list = Object.values(notes).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  if (!list.length) return <Empty text="When students record their homework, their voice notes show up here." />;
  return (
    <ul className="rows voice-list">
      {list.map((v) => {
        const reply = ((progressMap[v.sid] || {}).replies || {})[v.id];
        const isOpen = openId === v.id;
        const d = v.at ? new Date(v.at) : null;
        const when = d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ", " + d.toTimeString().slice(0, 5) : "";
        return (
          <li key={v.id}>
            <button className="row-btn" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : v.id)}>
              <span className="row-main">
                <span className="row-title">{v.name}{!v.heard && <span className="new-chip">New</span>}</span>
                <span className="row-sub">{v.title ? v.title + ". " : ""}{when}. {mmss(v.secs || 0)}{reply ? `. Replied${reply.stars ? " " + "★".repeat(reply.stars) : ""}` : ""}</span>
              </span>
              <Icon name={isOpen ? "x" : "play"} size={16} />
            </button>
            {isOpen && <VoiceNote v={v} reply={reply} flash={flash} />}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- cancelling and moving a class ---------- */
function upcomingClasses(slots, changes, now, days = 14) {
  const out = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let k = 0; k < days; k++) {
    const d = new Date(start); d.setDate(start.getDate() + k);
    const iso = isoOf(d);
    const wd = (d.getDay() + 6) % 7;
    slots.forEach((s) => {
      if (Number(s.day) !== wd) return;
      if (changes.some((c) => c.slot === s.id && c.date === iso)) return;
      const [h, m] = (s.start || "00:00").split(":").map(Number);
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      if (at.getTime() + (Number(s.minutes) || 60) * 60000 <= now.getTime()) return;
      out.push({ s, at, date: iso, key: s.id });
    });
  }
  changes.forEach((c) => {
    if (!c.makeup) return;
    const s = slots.find((x) => x.id === c.slot);
    if (!s) return;
    const [h, m] = (c.makeup.start || "00:00").split(":").map(Number);
    const md = parseISO(c.makeup.date);
    const at = new Date(md.getFullYear(), md.getMonth(), md.getDate(), h, m);
    if (at.getTime() + (Number(s.minutes) || 60) * 60000 <= now.getTime()) return;
    out.push({ s, at, date: c.makeup.date, key: c.id, makeup: true });
  });
  return out.sort((a, b) => a.at - b.at);
}
function nextDatesOf(slot, count = 6) {
  const out = [];
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let k = 0; k < 60 && out.length < count; k++) {
    if ((d.getDay() + 6) % 7 === Number(slot.day)) out.push(isoOf(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function changeNotice(c, s) {
  const fr = `Cours du ${fmtDate(c.date, "fr")} à ${s.start} annulé.` + (c.makeup ? ` Rattrapage le ${fmtDate(c.makeup.date, "fr")} à ${c.makeup.start}.` : "");
  const en = `The class on ${fmtDate(c.date, "en")} at ${s.start} is cancelled.` + (c.makeup ? ` Make-up class on ${fmtDate(c.makeup.date, "en")} at ${c.makeup.start}.` : "");
  return fr + "\n" + en + (c.note ? "\n" + c.note : "");
}

function ChangeForm({ slot, change, onSave, onCancel }) {
  const dates = change ? [change.date] : nextDatesOf(slot);
  const [date, setDate] = useState(dates[0]);
  const [note, setNote] = useState(change ? change.note || "" : "");
  const [withMakeup, setWithMakeup] = useState(!!change);
  const [mDate, setMDate] = useState(change && change.makeup ? change.makeup.date : "");
  const [mStart, setMStart] = useState(change && change.makeup ? change.makeup.start : slot.start);
  const [err, setErr] = useState("");
  const save = () => {
    if (withMakeup && (!mDate || mDate < todayISO() || !mStart)) { setErr("Pick a make-up date from today on, and a start time."); return; }
    onSave({ date, note: note.trim(), makeup: withMakeup ? { date: mDate, start: mStart } : null });
  };
  return (
    <div className="form">
      <p className="form-title">{change ? "Schedule the make-up class" : "Cancel or move a class"}: {slot.group}, {DAYS.en[slot.day]} {slot.start}</p>
      {!change && (
        <Field label="Which class">
          <select id="chg-date" className="inp" value={date} onChange={(e) => setDate(e.target.value)}>{dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}</select>
        </Field>
      )}
      {!change && <Field label="Note for students (optional)"><input id="chg-note" className="inp" value={note} placeholder="Sorry, I have a football match." onChange={(e) => setNote(e.target.value)} /></Field>}
      {!change && <label className="check"><input id="chg-makeup" type="checkbox" checked={withMakeup} onChange={(e) => setWithMakeup(e.target.checked)} />Move it: schedule a make-up class now</label>}
      {withMakeup && (
        <div className="grid2">
          <Field label="Make-up date"><input id="chg-mdate" className="inp" type="date" min={todayISO()} value={mDate} onChange={(e) => setMDate(e.target.value)} /></Field>
          <Field label="Starts at"><input id="chg-mstart" className="inp" type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} /></Field>
        </div>
      )}
      {!change && !withMakeup && <p className="hint">The class goes on your list of make-ups you owe. Students won't be counted for it.</p>}
      <p className="hint">The group gets an announcement in French and English automatically.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn" onClick={save}>{change ? "Save make-up class" : withMakeup ? "Move class" : "Cancel class"}</button>
        <button className="btn ghost" onClick={onCancel}>Go back</button>
      </div>
    </div>
  );
}

/* ---------- receipts, school invoices, certificates ---------- */
function receiptText(r, p, month) {
  const fr = r.lang === "fr";
  const m = monthLabel(month, r.lang);
  const rest = Math.max(0, r.fee - r.paid);
  const no = `${month.replace("-", "")}-${String(p.id).slice(0, 4).toUpperCase()}`;
  if (fr) return [`Reçu Bright Minds N° ${no}`, `Élève : ${r.name}`, `Montant reçu : ${fcfa(p.amount)}`, `Pour : ${m}`, `Date : ${fmtDate(p.date, "fr")}`, r.fee ? (rest > 0 ? `Reste à payer : ${fcfa(rest)}` : `${cap(m)} réglé.`) : "", "Merci !"].filter(Boolean).join("\n");
  return [`Bright Minds receipt No. ${no}`, `Student: ${r.name}`, `Amount received: ${fcfa(p.amount)}`, `For: ${m}`, `Date: ${fmtDate(p.date, "en")}`, r.fee ? (rest > 0 ? `Still to pay: ${fcfa(rest)}` : `${cap(m)} is fully paid.`) : "", "Thank you!"].filter(Boolean).join("\n");
}
function schoolSummary(r, month) {
  const fr = r.lang !== "en";
  const m = monthLabel(month, fr ? "fr" : "en");
  const who = r.contact || r.name;
  const rest = Math.max(0, r.due - r.paid);
  if (fr) return `Bonjour ${who}, voici le récapitulatif des cours d'anglais Bright Minds pour ${m} : ${r.vs.length} séance${r.vs.length > 1 ? "s" : ""}, ${plainNum(r.hours, 2)} heure${r.hours > 1 ? "s" : ""}. Total : ${fcfa(r.due)}${r.paid > 0 ? `, déjà payé ${fcfa(r.paid)}, reste ${fcfa(rest)}` : ""}. Je vous envoie la facture N° ${r.number}. Merci !`;
  return `Hello ${who}, here is the Bright Minds English classes summary for ${m}: ${r.vs.length} visit${r.vs.length === 1 ? "" : "s"}, ${plainNum(r.hours, 2)} hours. Total: ${fcfa(r.due)}${r.paid > 0 ? `, already paid ${fcfa(r.paid)}, balance ${fcfa(rest)}` : ""}. I'm sending invoice No. ${r.number}. Thank you!`;
}
function winAnsi(s) {
  return Array.from(String(s)).map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 256) return ch;
    if (c === 0x2018 || c === 0x2019) return "'";
    if (c === 0x201c || c === 0x201d) return '"';
    if (c === 0x2013 || c === 0x2014) return "-";
    if (c === 0x2026) return "...";
    if (c === 0x202f || c === 0x2009) return " ";
    return "?";
  }).join("");
}
async function invoicePdf({ school, visits, hours, due, paid, month, number, teacher, pay }) {
  const PDFLib = await loadScript(PDF_LIB, "PDFLib");
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const L = school.lang === "en" ? "en" : "fr";
  const fr = L === "fr";
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(`${fr ? "Facture" : "Invoice"} ${number}`));
  const W = 595.28, H = 841.89;
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.16, 0.42), soft = rgb(0.35, 0.38, 0.55), red = rgb(0.86, 0.23, 0.33), rule = rgb(0.85, 0.86, 0.94), band = rgb(0.95, 0.96, 0.99);
  const text = (s, x, y, size = 11, f = font, color = ink) => page.drawText(winAnsi(s), { x, y, size, font: f, color });
  const right = (s, xr, y, size = 11, f = font, color = ink) => text(s, xr - f.widthOfTextAtSize(winAnsi(s), size), y, size, f, color);
  const wrap = (s, x, y, maxW, size = 10, f = font, color = ink) => {
    let line = "", yy = y;
    winAnsi(s).split(" ").forEach((w) => {
      const tryLine = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(tryLine, size) > maxW && line) { text(line, x, yy, size, f, color); yy -= size + 4; line = w; } else line = tryLine;
    });
    if (line) { text(line, x, yy, size, f, color); yy -= size + 4; }
    return yy;
  };
  const X = 78, R = W - 52;
  page.drawRectangle({ x: 58, y: 0, width: 1.5, height: H, color: red });
  let y = H - 64;
  text("Bright Minds", X, y, 24, bold);
  right(fr ? "FACTURE" : "INVOICE", R, y + 2, 18, bold);
  y -= 18;
  text(fr ? "Cours d'anglais" : "English classes", X, y, 11, font, soft);
  right(`${fr ? "N°" : "No."} ${number}`, R, y, 11);
  y -= 16;
  if (teacher.name) text(teacher.name, X, y);
  right(`Date : ${new Date().toLocaleDateString(LOCALE[L], { day: "numeric", month: "long", year: "numeric" })}`, R, y);
  y -= 14;
  if (teacher.phone) text(teacher.phone, X, y);
  y -= 42;
  text(fr ? "Facturé à" : "Billed to", X, y, 10, bold, soft);
  y -= 17; text(school.name, X, y, 13, bold);
  if (school.contact) { y -= 15; text(`${fr ? "À l'attention de" : "Attention:"} ${school.contact}`, X, y); }
  y -= 26;
  text(`${fr ? "Période :" : "Period:"} ${monthLabel(month, L)}`, X, y, 11, bold);
  y -= 34;
  page.drawRectangle({ x: X - 8, y: y - 7, width: R - X + 14, height: 24, color: band });
  text("Description", X, y, 10, bold);
  right(fr ? "Quantité" : "Quantity", 350, y, 10, bold);
  right(fr ? "Prix (FCFA)" : "Price (FCFA)", 445, y, 10, bold);
  right("Total (FCFA)", R, y, 10, bold);
  y -= 26;
  const row = (desc, qty, price, total) => {
    text(desc, X, y); right(qty, 350, y); right(price, 445, y); right(total, R, y);
    y -= 9; page.drawLine({ start: { x: X - 8, y }, end: { x: R + 6, y }, thickness: 0.6, color: rule }); y -= 17;
  };
  row(fr ? "Cours d'anglais (heures)" : "English classes (hours)", plainNum(hours, 2), plainNum(school.rate), plainNum(hours * school.rate));
  if (school.transport) row(fr ? "Transport (déplacements)" : "Transport (visits)", String(visits.length), plainNum(school.transport), plainNum(visits.length * school.transport));
  y -= 4;
  right(`TOTAL : ${plainNum(due)} FCFA`, R, y, 13, bold);
  if (paid > 0) {
    y -= 18; right(`${fr ? "Déjà payé :" : "Already paid:"} ${plainNum(paid)} FCFA`, R, y, 11, font, soft);
    y -= 16; right(`${fr ? "Reste à payer :" : "Balance due:"} ${plainNum(Math.max(0, due - paid))} FCFA`, R, y, 11, bold);
  }
  y -= 36;
  text(fr ? "Détail des séances" : "Sessions", X, y, 10, bold, soft);
  y -= 16;
  y = wrap(visits.map((x) => `${fmtShort(x.date, L)} (${plainNum(x.hours, 2)} h)`).join(", ") || "-", X, y, R - X);
  const methods = pay.methods.filter((m) => m.number);
  if (methods.length) {
    y -= 18; text(fr ? "Paiement" : "Payment", X, y, 10, bold, soft); y -= 16;
    methods.forEach((m) => { text(`${m.kind} : ${m.number}${pay.accountName ? ` (${fr ? "au nom de" : "name:"} ${pay.accountName})` : ""}`, X, y, 10); y -= 14; });
  }
  y -= 22;
  text(fr ? "Merci pour votre confiance." : "Thank you for your trust.", X, y, 11, font, soft);
  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

async function drawCertificate({ name, level, lang, teacher }) {
  const W = 1600, H = 1131;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const HEAD = '"Poppins", "DM Sans", sans-serif', BODY = '"DM Sans", sans-serif';
  try { await Promise.all([document.fonts.load('bold 64px "Poppins"'), document.fonts.load('bold 30px "DM Sans"'), document.fonts.load('34px "DM Sans"')]); } catch (e) { /* fallback fonts */ }
  const fr = lang === "fr";
  const ink = "#15233F", soft = "#56637B", accent = "#2A5AA6", flag = "#C2343F";
  g.fillStyle = "#F6F8FC"; g.fillRect(0, 0, W, H);
  /* wax-print rings in two corners */
  const rings = (x, y) => { [[150, "#E7EEF9"], [128, "#F6F8FC"], [112, "#E7EEF9"], [92, "#F6F8FC"], [80, "#E7EEF9"]].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }); };
  rings(W - 62, H - 62); rings(62, 62);
  /* frame */
  g.strokeStyle = ink; g.lineWidth = 12; g.strokeRect(34, 34, W - 68, H - 68);
  g.lineWidth = 2; g.strokeRect(62, 62, W - 124, H - 124);
  /* woven strips along the top and bottom, in the app's blue, white and red */
  const weave = [["#2A5AA6", 36], ["#FFFFFF", 10], ["#C2343F", 30], ["#FFFFFF", 10], ["#15233F", 14], ["#A9C2E6", 6], ["#15233F", 6], ["#FFFFFF", 10]];
  const strip = (y) => {
    let x = 64;
    for (let k = 0; x < W - 64; k++) { const [col, w] = weave[k % weave.length]; g.fillStyle = col; g.fillRect(x, y, Math.min(w, W - 64 - x), 18); x += w; }
    g.fillStyle = "rgba(0,0,0,.10)"; for (let yy = y; yy < y + 18; yy += 3) g.fillRect(64, yy, W - 128, 1);
  };
  strip(64); strip(H - 82);
  const cx = W / 2;
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillStyle = ink; g.font = "bold 64px " + HEAD;
  g.fillText(fr ? "Certificat de réussite" : "Certificate of Achievement", cx, 250);
  g.font = "bold 30px " + BODY;
  { const w = g.measureText("Bright Minds").width, bw = g.measureText("B").width; g.textAlign = "left";
    g.fillStyle = flag; g.fillText("B", cx - w / 2, 315); g.fillStyle = accent; g.fillText("right Minds", cx - w / 2 + bw, 315); g.textAlign = "center"; }
  g.fillStyle = soft; g.font = "34px " + BODY;
  g.fillText(fr ? "Nous certifions que" : "This certifies that", cx, 430);
  let size = 96;
  g.font = `bold ${size}px ${HEAD}`;
  while (g.measureText(name).width > W - 420 && size > 48) { size -= 4; g.font = `bold ${size}px ${HEAD}`; }
  const nw = g.measureText(name).width;
  g.fillStyle = "#D9E5F6"; g.fillRect(cx - nw / 2 - 16, 560 - size * 0.3, nw + 32, size * 0.36);
  g.fillStyle = ink; g.fillText(name, cx, 560);
  g.font = "38px " + BODY;
  g.fillText(fr ? `a terminé avec succès le niveau ${level} en anglais.` : `has successfully completed the ${level} level in English.`, cx, 670);
  g.textAlign = "left"; g.fillStyle = soft; g.font = "30px " + BODY;
  const dateText = new Date().toLocaleDateString(LOCALE[lang], { day: "numeric", month: "long", year: "numeric" });
  g.fillText(fr ? `Fait le ${dateText}` : `Date: ${dateText}`, 160, 930);
  g.textAlign = "center";
  g.fillStyle = ink; g.fillRect(1020, 900, 420, 2);
  g.font = "bold 32px " + BODY;
  if (teacher) g.fillText(teacher, 1230, 950);
  g.fillStyle = soft; g.font = "28px " + BODY;
  g.fillText(fr ? "Professeur d'anglais" : "English teacher", 1230, teacher ? 990 : 950);
  return c;
}

function CertificatePanel({ r, teacherName, downloads }) {
  const [level, setLevel] = useState(r.level || "beginner");
  const [lang, setLang] = useState(r.lang);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const canvas = useRef(null);
  const make = async () => {
    setBusy(true); setMsg("");
    try { const c = await drawCertificate({ name: r.name, level: levelName(level, lang), lang, teacher: teacherName }); canvas.current = c; setUrl(c.toDataURL("image/png")); }
    catch (e) { setMsg("The certificate couldn't be made. Try again."); }
    setBusy(false);
  };
  const save = () => {
    if (!canvas.current) return;
    if (!downloads) { setMsg("Saving files isn't available in this view. Press and hold the picture to save it."); return; }
    canvas.current.toBlob(async (blob) => {
      try { await downloads.save({ filename: `Certificate-${fileSafe(r.name)}.png`, data: blob }); setMsg("Saved. Send it to the family on WhatsApp."); }
      catch (e) { setMsg(e && e.code === "declined" ? "" : "The picture couldn't be saved. Try again."); }
    }, "image/png");
  };
  return (
    <div className="report">
      <p className="form-title">Certificate</p>
      <div className="grid2">
        <Field label="Level completed"><select id={"cert-level-" + r.id} className="inp" value={level} onChange={(e) => { setLevel(e.target.value); setUrl(""); }}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.en}</option>)}</select></Field>
        <Field label="Language"><select id={"cert-lang-" + r.id} className="inp" value={lang} onChange={(e) => { setLang(e.target.value); setUrl(""); }}><option value="fr">French</option><option value="en">English</option></select></Field>
      </div>
      {!teacherName && <p className="hint">Add your name in Business, then Settings, to sign the certificate.</p>}
      <div className="form-actions">
        <button className="btn" onClick={make} disabled={busy}>{busy ? "Making..." : url ? "Make it again" : "Make certificate"}</button>
        {url && <button className="btn ghost" onClick={save}>Save picture</button>}
      </div>
      {url && <img className="cert-img" src={url} alt={`Certificate for ${r.name}`} />}
      {msg && <p className="hint" role="status" style={{ margin: "10px 0 0" }}>{msg}</p>}
    </div>
  );
}

/* ---------- Business tab: schools ---------- */
function SchoolDetail({ r, month, v, teacher, pay, downloads, flash, fail, onEdit, onRemove }) {
  const [min, max] = monthRange(month);
  const [date, setDate] = useState(() => { const t = todayISO(); return t >= min && t <= max ? t : min; });
  const [hours, setHours] = useState("1.5");
  const rest = Math.max(0, r.due - r.paid);
  const [amountIn, setAmount] = useState(null);
  const amount = amountIn === null ? (rest ? String(rest) : "") : amountIn;
  const [busy, setBusy] = useState(false);
  const lang = r.lang === "en" ? "en" : "fr";
  const h = Number(String(hours).replace(",", "."));
  const logVisit = () => {
    if (!(h > 0) || date < min || date > max) return;
    v.save({ ...v.data, visits: [...v.data.visits, { id: uid(), schoolId: r.id, date, hours: h }] }).then(() => flash("Visit logged."), fail);
  };
  const recordPay = () => {
    const a = Number(amount);
    if (!(a > 0)) return;
    v.save({ ...v.data, paid: [...v.data.paid, { id: uid(), schoolId: r.id, amount: a, date: todayISO() }] }).then(() => { flash("Payment recorded."); setAmount(null); }, fail);
  };
  const invoice = async () => {
    if (!downloads) { flash("Saving files isn't available in this browser."); return; }
    setBusy(true);
    try {
      const blob = await invoicePdf({ school: r, visits: r.vs, hours: r.hours, due: r.due, paid: r.paid, month, number: r.number, teacher, pay });
      await downloads.save({ filename: `${lang === "fr" ? "Facture" : "Invoice"}-${fileSafe(r.name)}-${month}.pdf`, data: blob });
      flash("Invoice saved. Send it to the school on WhatsApp.");
    } catch (e) {
      if (!(e && e.code === "declined")) flash(e && e.message === "load failed" ? "The invoice maker couldn't load. Check your connection and try again." : "The invoice couldn't be made. Try again.");
    }
    setBusy(false);
  };
  const summary = schoolSummary(r, month);
  return (
    <div className="expand">
      <p className="hint" style={{ marginTop: 0 }}>{fcfa(r.rate)} an hour{r.transport ? `, plus ${fcfa(r.transport)} transport per visit` : ""}. Invoices in {lang === "fr" ? "French" : "English"}.</p>
      <div className="code-box">
        <div className="code-main">
          <span className="muted small">Visits in {monthLabel(month)}</span>
          <span className="count-big">{fcfa(r.due)}</span>
          <span className="muted small">{r.vs.length} {r.vs.length === 1 ? "visit" : "visits"}, {plainNum(r.hours, 2)} hours{r.paid ? `, ${fcfa(r.paid)} paid` : ""}</span>
        </div>
        <div className="pay-actions">
          <input id={"visit-date-" + r.id} className="inp log-date" type="date" min={min} max={max} aria-label="Visit date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input id={"visit-hours-" + r.id} className="inp log-date hours-inp" type="number" inputMode="decimal" min="0.5" step="0.5" aria-label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
          <button type="button" className="btn sm" disabled={!(h > 0)} onClick={logVisit}><Icon name="plus" size={16} />Log visit</button>
        </div>
        {r.vs.length > 0 && (
          <ul className="pay-list taken-list" aria-label="Visits">
            {r.vs.map((x) => (
              <li key={x.id}><span>{fmtDate(x.date)}</span><strong>{plainNum(x.hours, 2)} h</strong>
                <ConfirmButton iconOnly label={`Remove the visit on ${fmtDate(x.date)}`} onConfirm={() => v.save({ ...v.data, visits: v.data.visits.filter((y) => y.id !== x.id) }).catch(fail)} /></li>
            ))}
          </ul>
        )}
      </div>
      <div className="form-actions" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={invoice} disabled={busy || !r.vs.length}><Icon name="report" size={16} />{busy ? "Making invoice..." : "Invoice (PDF)"}</button>
        {r.phone ? <WaButton phone={r.phone} text={summary} ghost>Send summary</WaButton> : <CopyButton text={summary} label="Copy the summary" caption="Copy summary" />}
      </div>
      <p className="sub-h">Payments from the school</p>
      {r.pays.length > 0 && (
        <ul className="pay-list">
          {r.pays.map((p) => (
            <li key={p.id}><span>{fmtDate(p.date)}</span><strong>{fcfa(p.amount)}</strong>
              <ConfirmButton iconOnly label="Delete payment" onConfirm={() => v.save({ ...v.data, paid: v.data.paid.filter((y) => y.id !== p.id) }).catch(fail)} /></li>
          ))}
        </ul>
      )}
      <div className="inline-add">
        <input id={"school-pay-" + r.id} className="inp" type="number" inputMode="numeric" min="0" step="500" aria-label="Amount paid (FCFA)" placeholder="Amount (FCFA)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn" onClick={recordPay} disabled={!(Number(amount) > 0)}>Record payment</button>
      </div>
      <div className="form-actions">
        <button className="btn ghost sm" onClick={onEdit}><Icon name="pencil" size={15} />Edit school</button>
        <ConfirmButton label="Remove school" onConfirm={onRemove} />
      </div>
    </div>
  );
}

function SchoolsSection({ biz, saveBiz, db, userId, flash, pay, downloads }) {
  const [month, setMonth] = useState(monthKey(new Date()));
  const v = useVisits(db, userId, month);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);
  const fail = () => flash("That didn't save. Check your connection and try again.");
  const teacher = { name: biz.teacher.name || pay.accountName, phone: biz.teacher.phone || pay.whatsapp };
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => {
    const name = form.name.trim();
    if (!name) { setErr("Add the school's name."); return; }
    if (!(Number(form.rate) > 0)) { setErr("Add the hourly rate in FCFA."); return; }
    if (form.phone.trim() && !waDigits(form.phone)) { setErr("That WhatsApp number looks too short. Use the full number."); return; }
    const s = { id: form.id || uid(), name, contact: form.contact.trim(), phone: form.phone.trim(), rate: Number(form.rate), transport: Number(form.transport) || 0, lang: form.lang };
    saveBiz({ ...biz, schools: form.id ? biz.schools.map((x) => (x.id === s.id ? s : x)) : [...biz.schools, s] }).then(() => flash("School saved."), fail);
    setForm(null); setErr("");
  };
  const rows = biz.schools.map((s, i) => {
    const vs = v.data.visits.filter((x) => x.schoolId === s.id).sort((a, b) => a.date.localeCompare(b.date));
    const hours = vs.reduce((a, x) => a + (Number(x.hours) || 0), 0);
    const due = hours * s.rate + vs.length * (s.transport || 0);
    const pays = v.data.paid.filter((x) => x.schoolId === s.id);
    const paid = pays.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    return { ...s, vs, hours, due, paid, pays, number: `BM-${month.replace("-", "")}-${pad(i + 1)}` };
  });
  const totalDue = rows.reduce((a, r) => a + r.due, 0);
  const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
  return (
    <div>
      <div className="h-row">
        <p className="sub-h" style={{ margin: 0 }}>Schools you visit</p>
        {!form && <button className="btn sm" onClick={() => { setErr(""); setForm({ id: null, name: "", contact: "", phone: "", rate: "", transport: "", lang: "fr" }); }}><Icon name="plus" size={16} />Add school</button>}
      </div>
      {form && (
        <div className="form">
          <Field label="School name"><input id="sc-name" className="inp" value={form.name} onChange={upd("name")} /></Field>
          <div className="grid2">
            <Field label="Contact person"><input id="sc-contact" className="inp" value={form.contact} placeholder="The director" onChange={upd("contact")} /></Field>
            <Field label="Their WhatsApp"><input id="sc-phone" className="inp" type="tel" inputMode="tel" placeholder="07 00 00 00 00" value={form.phone} onChange={upd("phone")} /></Field>
            <Field label="Rate per hour (FCFA)"><input id="sc-rate" className="inp" type="number" inputMode="numeric" min="0" step="500" placeholder="12500" value={form.rate} onChange={upd("rate")} /></Field>
            <Field label="Transport per visit (FCFA)"><input id="sc-transport" className="inp" type="number" inputMode="numeric" min="0" step="500" placeholder="0" value={form.transport} onChange={upd("transport")} /></Field>
          </div>
          <Field label="Invoice language"><select id="sc-lang" className="inp" value={form.lang} onChange={upd("lang")}><option value="fr">French</option><option value="en">English</option></select></Field>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="form-actions">
            <button className="btn" onClick={submit}>Save school</button>
            <button className="btn ghost" onClick={() => { setForm(null); setErr(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {rows.length === 0 ? (!form && <Empty text="Add a school you teach at. Log each visit, and the app makes the monthly invoice for you." />) : (
        <>
          <div className="month-nav">
            <button className="icon-btn" aria-label="Previous month" onClick={() => { setMonth((m) => shiftMonth(m, -1)); setOpenId(null); }}><Icon name="left" size={20} /></button>
            <strong>{monthLabel(month)}</strong>
            <button className="icon-btn" aria-label="Next month" onClick={() => { setMonth((m) => shiftMonth(m, 1)); setOpenId(null); }}><Icon name="right" size={20} /></button>
          </div>
          <div className="sum">
            <p className="muted small">Due from schools</p>
            <p className="sum-big">{fcfa(totalDue)}</p>
            <div className="sum-line"><span>Paid so far</span><strong>{fcfa(totalPaid)}</strong></div>
          </div>
          <ul className="rows">
            {rows.map((r) => (
              <li key={r.id}>
                <button className="row-btn" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <span className="row-main"><span className="row-title">{r.name}</span><span className="row-sub">{r.vs.length} {r.vs.length === 1 ? "visit" : "visits"}, {plainNum(r.hours, 2)} hours</span></span>
                  <span className="amt">
                    <span className={"pill " + (r.due === 0 ? "none" : r.paid >= r.due ? "paid" : r.paid > 0 ? "partial" : "unpaid")}>{r.due === 0 ? "No visits" : r.paid >= r.due ? "Paid" : r.paid > 0 ? "Part paid" : "Not paid"}</span>
                    <span className="row-sub">{num(r.due)} FCFA</span>
                  </span>
                </button>
                {openId === r.id && (
                  <SchoolDetail key={r.id + month} r={r} month={month} v={v} teacher={teacher} pay={pay} downloads={downloads} flash={flash} fail={fail}
                    onEdit={() => { setErr(""); setForm({ id: r.id, name: r.name, contact: r.contact || "", phone: r.phone || "", rate: String(r.rate), transport: r.transport ? String(r.transport) : "", lang: r.lang || "fr" }); setOpenId(null); window.scrollTo(0, 0); }}
                    onRemove={() => { saveBiz({ ...biz, schools: biz.schools.filter((x) => x.id !== r.id) }).catch(fail); setOpenId(null); }} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- Business tab: income ---------- */
const SERIES = [{ k: "priv", label: "Private classes", cls: "c1" }, { k: "online", label: "Online groups", cls: "c2" }, { k: "schools", label: "Schools", cls: "c3" }];
const shortMoney = (v) => (v >= 1e6 ? `${plainNum(v / 1e6, 1)} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(Math.round(v)));
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1)))); const n = x / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

function IncomeChart({ months }) {
  const [hover, setHover] = useState(months.length - 1);
  const W = 520, H = 230, padL = 46, padR = 8, padT = 12, padB = 30;
  const max = Math.max(1, ...months.map((m) => m.total));
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1; v += step) ticks.push(v);
  const bw = (W - padL - padR) / months.length;
  const barW = Math.min(46, bw * 0.56);
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  const h = months[hover];
  return (
    <div className="chart">
      <div className="legend">{SERIES.map((s) => <span key={s.k}><i className={"sw " + s.cls} />{s.label}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Money collected each month for the last 6 months, by type of class">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="grid" />
            <text x={padL - 8} y={y(v) + 4} className="tick" textAnchor="end">{shortMoney(v)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = padL + bw * i + bw / 2;
          let acc = 0;
          const segs = SERIES.map((s) => { const val = m[s.k]; const y0 = y(acc); acc += val; return val > 0 ? { s, y0, y1: y(acc) } : null; }).filter(Boolean);
          return (
            <g key={m.m} className={"col" + (hover === i ? " on" : "")} tabIndex={0} role="button" aria-label={`${monthLabel(m.m)}: ${fcfa(m.total)} collected`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={padL + bw * i} y={padT} width={bw} height={H - padT - padB} className="hit" />
              {segs.map((g, j) => (
                <rect key={g.s.k} x={cx - barW / 2} y={g.y1} width={barW} height={Math.max(1, g.y0 - g.y1 - (j > 0 ? 2 : 0))} rx={j === segs.length - 1 ? 4 : 0} className={"seg-bar " + g.s.cls} />
              ))}
              <text x={cx} y={H - 10} textAnchor="middle" className={"tick" + (hover === i ? " strong" : "")}>{parseISO(m.m + "-01").toLocaleDateString("en-US", { month: "short" })}</text>
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="chart-detail" role="status">
          <strong>{monthLabel(h.m)}</strong>
          {SERIES.map((s) => <span key={s.k}><i className={"sw " + s.cls} />{s.label}: {fcfa(h[s.k])}</span>)}
          <span>Total {fcfa(h.total)}, yours after shares {fcfa(h.yours)}</span>
        </div>
      )}
    </div>
  );
}

function IncomeSection({ db, userId, roster, schedule, changes, places }) {
  const [state, setState] = useState({ loading: true, slow: false, months: [] });
  useEffect(() => {
    if (!db || !userId) return undefined;
    let alive = true;
    const slowTimer = setTimeout(() => alive && setState((s) => ({ ...s, slow: true })), 10000);
    const base = "data/users/" + userId + "/money";
    const keys = [5, 4, 3, 2, 1, 0].map((k) => shiftMonth(monthKey(new Date()), -k));
    const get = (p) => db.doc(p).get().then((s) => (s.exists && s.data()) || {}).catch(() => ({}));
    Promise.all([get(base), ...keys.flatMap((m) => [get(base + "/months/" + m), get(base + "/attendance/" + m), get(base + "/visits/" + m)])]).then(([feesDoc, ...rest]) => {
      if (!alive) return;
      clearTimeout(slowTimer);
      const fees = feesDoc.fees || {};
      const ctx = { schedule, changes, places };
      const months = keys.map((m, i) => {
        const pays = arr(rest[i * 3].payments), taken = arr(rest[i * 3 + 1].taken), visits = rest[i * 3 + 2];
        let priv = 0, online = 0, cut = 0;
        const seen = new Set();
        roster.forEach((r) => {
          const sm = studentMonth(r, fees, pays, taken, ctx);
          seen.add(r.id);
          if (sm.online) online += sm.paid; else priv += sm.paid;
          cut += sm.cut;
        });
        pays.forEach((p) => { if (!seen.has(p.studentId)) priv += Number(p.amount) || 0; });
        const schools = arr(visits.paid).reduce((a, p) => a + (Number(p.amount) || 0), 0);
        const total = priv + online + schools;
        return { m, priv, online, schools, total, cut, yours: total - cut };
      });
      setState({ loading: false, slow: false, months });
    });
    return () => { alive = false; clearTimeout(slowTimer); };
  }, [db, userId]);
  if (state.loading) return <p className="empty" role="status">{state.slow ? "Your records can't be reached yet. Check your connection." : "Adding up your last 6 months..."}</p>;
  const sum = state.months.reduce((a, m) => a + m.yours, 0);
  return (
    <div>
      <div className="sum">
        <p className="muted small">Yours after shares, last 6 months</p>
        <p className="sum-big">{fcfa(sum)}</p>
        <p className="muted small">About {fcfa(sum / 6)} a month</p>
      </div>
      <IncomeChart months={state.months} />
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th scope="col">Month</th><th scope="col">Collected</th><th scope="col">Shares</th><th scope="col">Yours</th></tr></thead>
          <tbody>
            {[...state.months].reverse().map((m) => (
              <tr key={m.m}><th scope="row">{monthLabel(m.m)}</th><td>{num(m.total)}</td><td>{num(m.cut)}</td><td><strong>{num(m.yours)}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Amounts in FCFA, from the payments you record. Online groups are students whose classes have an online link or take place online.</p>
    </div>
  );
}

/* ---------- Business tab: settings ---------- */
function BizSettings({ biz, saveBiz, schedule, pay, flash }) {
  const names = useMemo(() => {
    const seen = new Map();
    [...schedule.map((s) => placeName(s)), ...biz.places.map((p) => p.name), "Home"].forEach((n) => { if (n && !seen.has(placeKey(n))) seen.set(placeKey(n), n); });
    return [...seen.values()];
  }, [schedule, biz.places]);
  const [name, setName] = useState(biz.teacher.name || pay.accountName || "");
  const [phone, setPhone] = useState(biz.teacher.phone || pay.whatsapp || "");
  const [pcts, setPcts] = useState(() => {
    const o = {};
    names.forEach((n) => {
      const p = biz.places.find((x) => placeKey(x.name) === placeKey(n));
      o[n] = p ? String(p.pct) : !biz.places.length && placeKey(n) === "school" ? "40" : "";
    });
    return o;
  });
  const save = () => {
    const places = names.map((n) => ({ name: n, pct: Math.min(100, Math.max(0, Number(pcts[n]) || 0)) })).filter((p) => p.pct > 0);
    saveBiz({ ...biz, teacher: { name: name.trim(), phone: phone.trim() }, places }).then(() => flash("Settings saved."), () => flash("That didn't save. Check your connection and try again."));
  };
  return (
    <div>
      <p className="sub-h">Your details</p>
      <p className="hint" style={{ marginTop: 0 }}>Shown on invoices and certificates.</p>
      <div className="grid2">
        <Field label="Your name"><input id="me-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Your phone"><input id="me-phone" className="inp" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <p className="sub-h" style={{ marginTop: 14 }}>Shares by place</p>
      <p className="hint" style={{ marginTop: 0 }}>The part of a student's fee that goes to the place where the class happens. The app works it out from where each class was actually taught.</p>
      <ul className="rows" style={{ marginBottom: 16 }}>
        {names.map((n) => (
          <li key={n} className="place-row">
            <span className="row-title">{n}</span>
            <span className="pct"><input id={"pct-" + placeKey(n).replace(/[^a-z0-9]+/g, "-")} className="inp" type="number" inputMode="numeric" min="0" max="100" aria-label={`Share for ${n} (%)`} placeholder="0" value={pcts[n] || ""} onChange={(e) => setPcts({ ...pcts, [n]: e.target.value })} />%</span>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={save}>Save settings</button>
      <ImportBackup />
    </div>
  );
}

/* ---------- join page ---------- */
const DEFAULT_OFFERS = [
  { title: "Cours particuliers", price: 50000, per: "month", note: "2 cours par semaine, 1 heure, à domicile ou à l'école" },
  { title: "Groupe en ligne (3 à 4 personnes)", price: 30000, per: "month", note: "2 cours par semaine, par personne" },
  { title: "Cours individuel en ligne", price: 40000, per: "month", note: "2 cours par semaine" },
];
function JoinSettings({ join, saveJoin, groups, roster, pay, flash }) {
  const [form, setForm] = useState(() => ({
    intro: join.intro, contact: join.contact,
    offers: (join.offers.length ? join.offers : DEFAULT_OFFERS).map((o) => ({ id: o.id || uid(), title: o.title, price: String(o.price || ""), per: o.per || "month", note: o.note || "" })),
    groups: groups.filter((g) => g !== EVERYONE).map((g) => { const j = join.groups.find((x) => x.group === g); return { group: g, show: !!j, capacity: j ? String(j.capacity) : "4" }; }),
  }));
  const [err, setErr] = useState("");
  const updO = (id, k) => (e) => setForm({ ...form, offers: form.offers.map((o) => (o.id === id ? { ...o, [k]: e.target.value } : o)) });
  const updG = (g, k, val) => setForm({ ...form, groups: form.groups.map((x) => (x.group === g ? { ...x, [k]: val } : x)) });
  const save = () => {
    if (form.contact.trim() && !waDigits(form.contact)) { setErr("That WhatsApp number looks too short. Use the full number."); return; }
    setErr("");
    saveJoin({
      intro: form.intro.trim(), contact: form.contact.trim(),
      offers: form.offers.filter((o) => o.title.trim()).map((o) => ({ id: o.id, title: o.title.trim(), price: Number(o.price) || 0, per: o.per, note: o.note.trim() })),
      groups: form.groups.filter((g) => g.show).map((g) => ({ group: g.group, capacity: Math.max(1, Number(g.capacity) || 1) })),
    });
    flash("Join page saved.");
  };
  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>A page for new families: your classes, prices, open spots and a button to book a free trial on WhatsApp. Anyone with your app link can open it from the first screen with "New student? See classes and prices". You can also add #join to the end of the link to open it directly.</p>
      <Field label="Welcome message"><textarea id="join-intro" className="inp" value={form.intro} placeholder={STR.fr.joinTagline} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></Field>
      <Field label="WhatsApp for trial bookings"><input id="join-contact" className="inp" type="tel" inputMode="tel" placeholder={pay.whatsapp || "07 00 00 00 00"} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
      <p className="hint">Leave it empty to use the number from How students pay.</p>
      <p className="sub-h" style={{ marginTop: 14 }}>Classes and prices</p>
      {form.offers.map((o) => (
        <div key={o.id} className="method-edit">
          <Field label="Class"><input id={"of-title-" + o.id} className="inp" value={o.title} onChange={updO(o.id, "title")} /></Field>
          <div className="grid2">
            <Field label="Price (FCFA)"><input id={"of-price-" + o.id} className="inp" type="number" inputMode="numeric" min="0" step="500" value={o.price} onChange={updO(o.id, "price")} /></Field>
            <Field label="Per"><select id={"of-per-" + o.id} className="inp" value={o.per} onChange={updO(o.id, "per")}><option value="month">Month</option><option value="class">Class</option><option value="hour">Hour</option></select></Field>
          </div>
          <Field label="Details (optional)"><input id={"of-note-" + o.id} className="inp" value={o.note} onChange={updO(o.id, "note")} /></Field>
          <button className="btn ghost sm danger" onClick={() => setForm({ ...form, offers: form.offers.filter((x) => x.id !== o.id) })}><Icon name="trash" size={15} />Remove</button>
        </div>
      ))}
      <button className="btn ghost sm" style={{ marginBottom: 16 }} onClick={() => setForm({ ...form, offers: [...form.offers, { id: uid(), title: "", price: "", per: "month", note: "" }] })}><Icon name="plus" size={16} />Add a class type</button>
      <p className="sub-h">Groups with open spots</p>
      {form.groups.length === 0 ? <p className="hint" style={{ marginTop: 0 }}>Add students with a group name, and the groups show up here.</p> : (
        <ul className="rows" style={{ marginBottom: 16 }}>
          {form.groups.map((g) => {
            const count = roster.filter((r) => r.group === g.group).length;
            return (
              <li key={g.group} className="place-row">
                <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={g.show} onChange={(e) => updG(g.group, "show", e.target.checked)} />{g.group}<span className="muted small">{count} now</span></label>
                <span className="pct"><input className="inp" type="number" inputMode="numeric" min="1" aria-label={`Places in ${g.group}`} value={g.capacity} disabled={!g.show} onChange={(e) => updG(g.group, "capacity", e.target.value)} />places</span>
              </li>
            );
          })}
        </ul>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" onClick={save}>Save join page</button>
    </div>
  );
}

function JoinPage({ join, pay, schedule, counts = {}, onBack, onLang, backLabel }) {
  const { t, lang } = useT();
  const contact = join.contact || pay.whatsapp;
  const per = { month: t("perMonth"), class: t("perClass"), hour: t("perHour") };
  const groups = join.groups.map((g) => {
    const slots = schedule.filter((s) => s.group === g.group).sort((a, b) => a.day - b.day);
    const left = Math.max(0, (Number(g.capacity) || 0) - (Number(counts[g.group]) || 0));
    return { ...g, slots, left };
  });
  return (
    <div className="welcome">
      <div className="welcome-lang between">
        <button className="link" onClick={onBack}>{backLabel || t("haveCode")}</button>
        <button className="link" onClick={onLang} aria-label={t("otherLangName")}>{t("otherLang")}</button>
      </div>
      <div className="panel rings welcome-page">
        <h1 className="welcome-title">Bright Minds</h1>
        <p className="welcome-sub">{join.intro || t("joinTagline")}</p>
      </div>
      {join.offers.length > 0 && (
        <>
          <h2 className="h">{t("classesPrices")}</h2>
          <ul className="rows" style={{ marginBottom: 20 }}>
            {join.offers.map((o) => (
              <li key={o.id} className="offer">
                <div className="row-main"><span className="row-title">{o.title}</span>{o.note && <span className="row-sub">{o.note}</span>}</div>
                <span className="offer-price"><strong>{fcfa(o.price)}</strong><span className="muted small">{per[o.per] || ""}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
      {groups.length > 0 && (
        <>
          <h2 className="h">{t("openGroups")}</h2>
          <ul className="rows" style={{ marginBottom: 20 }}>
            {groups.map((g) => (
              <li key={g.group} className="offer">
                <div className="row-main"><span className="row-title">{g.group}</span><span className="row-sub">{g.slots.map((s) => `${cap(DAYS[lang][s.day])} ${s.start}`).join(", ")}</span></div>
                <span className={"pill " + (g.left > 0 ? "paid" : "unpaid")}>{g.left > 0 ? t("spotsLeft", g.left) : t("full")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {contact && (
        <div className="join-cta">
          <a className="btn" href={waLink(contact, t("trialMsg"))} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={18} />{t("bookTrial")}</a>
          <p className="hint" style={{ margin: "8px 0 0" }}>{t("trialHint")}</p>
        </div>
      )}
    </div>
  );
}

function BusinessTeacher({ bizH, db, userId, flash, pay, downloads, roster, schedule, changes, join, saveJoin, groups, onBack }) {
  const [mode, setMode] = useState("schools");
  const modes = [["schools", "Schools"], ["income", "Income"], ["join", "Join page"], ["settings", "Settings"]];
  const placesNeedDb = mode !== "join" && !bizH.on;
  return (
    <section>
      {onBack && <button className="back-link" onClick={onBack}><Icon name="left" />Back</button>}
      <h2 className="h">Business</h2>
      <div className="seg seg-lessons">
        {modes.map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}
      </div>
      {placesNeedDb ? <p className="note">Sign in as the teacher to use this.</p>
        : !bizH.ready && mode !== "join" ? <p className="empty" role="status">Loading...</p>
        : mode === "schools" ? <SchoolsSection biz={bizH.biz} saveBiz={bizH.save} db={db} userId={userId} flash={flash} pay={pay} downloads={downloads} />
        : mode === "income" ? <IncomeSection db={db} userId={userId} roster={roster} schedule={schedule} changes={changes} places={bizH.biz.places} />
        : mode === "join" ? <JoinSettings join={join} saveJoin={saveJoin} groups={groups} roster={roster} pay={pay} flash={flash} />
        : <BizSettings biz={bizH.biz} saveBiz={bizH.save} schedule={schedule} pay={pay} flash={flash} />}
    </section>
  );
}

/* The teacher's header: Business opens as its own section; Student view and Sign out sit in a small menu. */
function TeacherHeaderActions({ bizOpen, onBusiness, onStudentView, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="head-actions" ref={ref}>
      <button className="btn ghost sm biz-btn" aria-pressed={bizOpen} onClick={() => { setOpen(false); onBusiness(); }}><Icon name="briefcase" size={16} />Business</button>
      <button className="icon-btn sm-icon" aria-label="More" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}><Icon name="more" size={20} /></button>
      {open && (
        <div className="head-menu" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onStudentView(); }}><Icon name="users" size={16} />Student view</button>
          <button role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}><Icon name="left" size={16} />Sign out</button>
        </div>
      )}
    </div>
  );
}

/* ---------- live data from the database ---------- */

/* ---------- free trial: what visitors without a code see. Sample content only, kept on the phone: nothing is saved to the database. ---------- */
const TRIAL_LISTS = [["wl-pic-colors", "Colors", "Les couleurs"], ["wl-pic-animals", "Animals", "Les animaux"], ["wl-pic-numbers", "Numbers 1–10", "Les nombres 1–10"], ["wl-pic-food", "Food and drinks", "À manger et à boire"]];
/* A built-in sample list stays hidden when the teacher already shares a list on the same topic with everyone, so it doesn't show twice. */
const TRIAL_TOPIC = { "wl-pic-colors": /colou?rs?|couleurs?/i, "wl-pic-animals": /animals?|animaux/i, "wl-pic-numbers": /numbers?|nombres?|chiffres?/i, "wl-pic-food": /food|drinks?|manger|boire|nourriture/i };
const TRIAL_PHRASES = [["Hello! How are you?", "Bonjour ! Comment ça va ?"], ["I'm fine, thank you.", "Je vais bien, merci."], ["My name is Awa.", "Je m'appelle Awa."],
  ["Nice to meet you.", "Enchanté."], ["Where are you from?", "Tu viens d'où ?"], ["How much is it?", "C'est combien ?"], ["Thank you very much.", "Merci beaucoup."], ["See you tomorrow!", "À demain !"]];
function trialDecks(wordLists, lang) {
  const fr = lang === "fr";
  const pics = TRIAL_LISTS.map(([id, en, frT]) => {
    const w = arr(wordLists).find((x) => x.id === id);
    return w ? { id: "trial-" + id, title: fr ? frT : en, group: EVERYONE, cards: arr(w.cards).map((c, k) => ({ id: id + k, en: c.en, fr: c.fr, ex: c.ex || "", pic: c.pic || "" })) } : null;
  }).filter(Boolean);
  const phrases = { id: "trial-phrases", title: STR[lang].trialPhrases, group: EVERYONE, cards: TRIAL_PHRASES.map(([en, f], k) => ({ id: "tp" + k, en, fr: f, ex: "" })) };
  return [...pics, phrases];
}
function trialLesson(lang) {
  const s = STR[lang];
  const today = todayISO();
  return { id: "trial-lesson", sample: true, date: today, due: addDays(today, 3), group: EVERYONE, title: s.trialLessonTitle, notes: s.trialLessonNotes, homework: s.trialLessonHw };
}
const trialProgress = () => {
  const today = todayISO();
  return { skills: { "kids-20/u1-1": addDays(today, -12), "kids-20/u1-2": addDays(today, -8), "kids-20/u1-3": addDays(today, -3) }, courses: ["kids-20"], replies: { a: { stars: 3 }, b: { stars: 2 } } };
};
/* Vocab with sample picture lists from the lesson plans, plus any list the teacher shares with everyone. */
function TrialWords({ decks, me }) {
  const { lang } = useT();
  const { data } = useCourses();
  const shared = decks.filter((d) => forGroup(d.group, EVERYONE));
  const builtIn = trialDecks(data ? data.wordLists : [], lang).filter((d) => {
    const re = TRIAL_TOPIC[d.id.replace(/^trial-/, "")];
    return !re || !shared.some((x) => re.test(String(x.title || "")));
  });
  const all = [...shared, ...builtIn];
  return <WordsStudent decks={all} me={me} />;
}
/* Recording works, but stays on the phone. A sample reply shows what the teacher sends back. */
function TrialVoice() {
  const { t } = useT();
  const rec = useRecorder(60);
  const [open, setOpen] = useState(false);
  return (
    <div className="voice-hw">
      <div className="voice-reply trial-reply">
        <p className="muted small">{t("trialReplyLabel")}</p>
        <p className="voice-stars" aria-label={t("starsN", 3)}>{[0, 1, 2].map((k) => <Icon key={k} name="star" size={20} />)}</p>
        <p className="voice-note">“{t("trialReplyNote")}”</p>
      </div>
      {canRecord && (!open ? (
        <button className="btn ghost sm" onClick={() => setOpen(true)}><Icon name="mic" size={16} />{t("trialTryRecord")}</button>
      ) : (
        <div className="recorder">
          <p className="hint">{t("trialVoiceHint")}</p>
          {rec.state === "recording" ? (
            <button className="btn rec" onClick={rec.stop}><Icon name="stop" size={16} />{t("stopRec")} · {mmss(rec.secs)}</button>
          ) : rec.state === "done" ? (
            <>
              <audio controls src={rec.url} className="voice-audio" />
              <div className="pay-actions"><button className="btn ghost sm" onClick={rec.reset}>{t("recordAgain")}</button></div>
            </>
          ) : (
            <div className="pay-actions">
              <button className="btn" onClick={rec.start}><Icon name="mic" size={16} />{t("startRec")}</button>
              <button className="btn ghost sm" onClick={() => { rec.reset(); setOpen(false); }}>{t("cancel")}</button>
            </div>
          )}
          {rec.error && <p className="say-result error" role="alert">{rec.error}</p>}
        </div>
      ))}
    </div>
  );
}
function TrialBanner({ contact, onJoin }) {
  const { t } = useT();
  return (
    <div className="trial-banner" role="region" aria-label={t("trialBadge")}>
      <p><strong>{t("trialBadge")}.</strong> {t("trialBanner")}</p>
      <div className="trial-actions">
        <button className="btn sm" onClick={onJoin}>{t("trialPrices")}</button>
        {contact && <a className="btn ghost sm" href={waLink(contact, t("trialWaMsg"))} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} />{t("trialWrite")}</a>}
      </div>
    </div>
  );
}
function TrialClasses({ onJoin }) {
  const { t } = useT();
  return (
    <section>
      <h2 className="h">{t("trialClassesTitle")}</h2>
      <div className="panel rings next">
        <p>{t("trialClasses")}</p>
        <button className="btn join" onClick={onJoin}>{t("trialPrices")}</button>
      </div>
    </section>
  );
}

/* ---------- the teacher's day: Today, class logs, homework checks, messages, student pages, to-do ---------- */
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const longDate = (iso, lang = "en") => parseISO(iso).toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long" });
const studentsIn = (group, people) => people.filter((r) => forGroup(group, r.group));
const noteText = (x) => [x.note, x.own].filter(Boolean).join(" — ");

/* Every class on one date: weekly classes not cancelled that day, plus make-up classes moved to it. */
function classesOn(iso, schedule, changes) {
  const wd = (parseISO(iso).getDay() + 6) % 7;
  const out = [];
  schedule.forEach((s) => {
    if (Number(s.day) === wd && !changes.some((c) => c.slot === s.id && c.date === iso)) out.push({ s, key: s.id, date: iso, start: s.start });
  });
  changes.forEach((c) => {
    if (!c.makeup || c.makeup.date !== iso) return;
    const s = schedule.find((x) => x.id === c.slot);
    if (s) out.push({ s, key: c.id, date: iso, start: c.makeup.start, makeup: true });
  });
  return out.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
const recordsOf = (att, key, date) => ({
  taken: att.taken.filter((x) => x.slot === key && x.date === date),
  absent: arr(att.absent).filter((x) => x.slot === key && x.date === date),
});
const logSummary = (rec) => {
  if (!rec.absent.length) return "Taught";
  return `${rec.taken.length} came, ${rec.absent.length} absent`;
};

/* A student's lesson list from the Library, with titles and plan text. */
function planEntries(items, courses) {
  return arr(items).map((p) => {
    if (p.custom) return { p, key: "own/" + p.id, title: p.custom.title, from: "Your own lesson", body: p.custom.notes || "" };
    const c = courses.find((x) => x.id === p.course);
    const it = c && arr(c.items).find((x) => x.id === p.item);
    if (!it) return { p, missing: true, title: "" };
    return { p, key: c.id + "/" + it.id, title: it.title, from: c.title, body: it.body || "" };
  });
}
const nextPlanEntry = (items, courses) => planEntries(items, courses).find((e) => !e.p.used && !e.missing) || null;

/* "Materials:" and "Print before class:" lines from a lesson plan. */
const PREP_RE = /^\s*(?:[-*]\s+)?\*\*((?:Materials|Print before class|Not printable|Before the lesson|Bring|You need)[^*]*?):?\*\*:?\s*(.+)$/i;
const prepLines = (body) => String(body || "").split("\n").map((l) => l.match(PREP_RE)).filter(Boolean).map((m) => ({ label: m[1].trim(), text: m[2].trim() }));

/* Messages for families, in each family's language. */
function absentText(r, date, lessonTitle) {
  const fr = r.lang === "fr";
  const when = date === todayISO() ? (fr ? "aujourd'hui" : "today") : fr ? "le " + longDate(date, "fr") : "on " + longDate(date, "en");
  if (fr) return `Bonjour ! ${r.name} n'était pas au cours d'anglais ${when}.` + (lessonTitle ? ` Nous avons travaillé sur : ${lessonTitle}.` : "") + " Les notes et les devoirs sont dans l'application Bright Minds, onglet Devoirs. À bientôt !";
  return `Hello! ${r.name} missed English class ${when}.` + (lessonTitle ? ` We worked on: ${lessonTitle}.` : "") + " The notes and homework are in the Bright Minds app, under Homework. See you soon!";
}
function hwReminderText(r, l) {
  const fr = r.lang === "fr";
  const due = l.due ? (fr ? ` pour ${longDate(l.due, "fr")}` : ` for ${longDate(l.due, "en")}`) : "";
  return fr
    ? `Bonjour ! Petit rappel pour ${r.name} : les devoirs d'anglais « ${l.title} »${due}.\n${l.homework}\nOn peut aussi envoyer un message vocal dans l'application Bright Minds, onglet Devoirs. Merci !`
    : `Hello! A quick reminder for ${r.name}: the English homework "${l.title}"${due}.\n${l.homework}\nYou can also send a voice note in the Bright Minds app, under Homework. Thank you!`;
}
function classWhen(o, lang) {
  const fr = lang === "fr";
  const today = todayISO();
  const start = o.start || (o.at ? `${pad(o.at.getHours())}:${pad(o.at.getMinutes())}` : "");
  const day = o.date === today ? (fr ? "aujourd'hui" : "today") : o.date === addDays(today, 1) ? (fr ? "demain" : "tomorrow") : fr ? longDate(o.date, "fr") : "on " + longDate(o.date, "en");
  return `${day} ${fr ? "à" : "at"} ${start}`;
}

/* ---------- logging a class: who came, notes, and a message for absent students' families ---------- */
function ClassLog({ occ, people, att, lessons = [], flash, onClose }) {
  const who = studentsIn(occ.s.group, people);
  const rec = recordsOf(att, occ.key, occ.date);
  const logged = rec.taken.length + rec.absent.length > 0;
  const [here, setHere] = useState(() => new Set(logged ? rec.taken.map((x) => x.studentId) : who.map((r) => r.id)));
  const [note, setNote] = useState(() => (rec.taken.find((x) => x.note) || {}).note || "");
  const [own, setOwn] = useState(() => { const o = {}; rec.taken.forEach((x) => { if (x.own) o[x.studentId] = x.own; }); return o; });
  const [missed, setMissed] = useState(null);
  const fail = () => flash("That didn't save. Check your connection and try again.");
  const toggle = (id) => setHere((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const others = (list) => list.filter((x) => !(x.slot === occ.key && x.date === occ.date));
  const place = placeName(occ.s);
  const save = () => {
    const came = who.filter((r) => here.has(r.id));
    const away = who.filter((r) => !here.has(r.id));
    const t = came.map((r) => {
      const x = { id: uid(), studentId: r.id, date: occ.date, slot: occ.key, place };
      if (note.trim()) x.note = note.trim();
      if ((own[r.id] || "").trim()) x.own = own[r.id].trim();
      return x;
    });
    const ab = away.map((r) => ({ id: uid(), studentId: r.id, date: occ.date, slot: occ.key, place }));
    att.save([...others(att.taken), ...t], [...others(arr(att.absent)), ...ab]).then(() => {
      flash(came.length ? `Saved: ${came.length} came${away.length ? `, ${away.length} absent` : ""}.` : "Saved: nobody came.");
      if (away.length) setMissed(away); else onClose();
    }, fail);
  };
  const unmark = () => att.save(others(att.taken), others(arr(att.absent))).then(() => { flash("Class unmarked."); onClose(); }, fail);
  if (missed) {
    return (
      <div className="form log-form">
        <p className="form-title">Let the families know</p>
        <p className="hint">A short message in their language, with what the class worked on.</p>
        <ul className="msg-rows">
          {missed.map((r) => {
            const l = lessons.find((x) => x.date === occ.date && forGroup(lessonGroups(x), r.group));
            const text = absentText(r, occ.date, l ? l.title : "");
            return (
              <li key={r.id}>
                <div className="row-main"><span className="row-title">{r.name}</span><span className="row-sub">{text}</span></div>
                {r.phone ? <WaButton phone={r.phone} text={text}>Send</WaButton> : <CopyButton text={text} label={`Copy the message for ${r.name}`} caption="Copy" />}
              </li>
            );
          })}
        </ul>
        <div className="form-actions"><button className="btn" onClick={onClose}>Done</button></div>
      </div>
    );
  }
  const present = who.filter((r) => here.has(r.id));
  return (
    <div className="form log-form">
      <p className="form-title">{occ.s.group}, {fmtDate(occ.date)} at {occ.start}</p>
      <div className="field">
        <span id={"came-" + occ.key}>Who came?</span>
        <div className="chip-pick came-pick" role="group" aria-labelledby={"came-" + occ.key}>
          {who.map((r) => (
            <button key={r.id} type="button" aria-pressed={here.has(r.id)} onClick={() => toggle(r.id)}>
              <Icon name={here.has(r.id) ? "check" : "x"} size={15} /><span>{r.name}</span>
            </button>
          ))}
        </div>
        <span className="hint">{who.length > 1 ? "Tap anyone who was absent. An absent student doesn't use up a class." : "Tap the name if they were absent. An absent class isn't counted."}</span>
      </div>
      <Field label={who.length > 1 ? "Class notes (only you see these)" : "Notes (only you see these)"}>
        <textarea id={"log-note-" + occ.key} className="inp" value={note} placeholder="What you did, what to review next time..." onChange={(e) => setNote(e.target.value)} />
      </Field>
      {who.length > 1 && present.map((r) => (
        <Field key={r.id} label={`Just for ${r.name} (optional)`}>
          <input id={"log-own-" + r.id} className="inp" value={own[r.id] || ""} placeholder="Mixes up 12 and 20" onChange={(e) => setOwn({ ...own, [r.id]: e.target.value })} />
        </Field>
      ))}
      <div className="form-actions">
        <button className="btn" onClick={save}>{logged ? "Save changes" : "Save"}</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        {logged && <ConfirmButton label="Unmark this class" onConfirm={unmark} />}
      </div>
    </div>
  );
}

/* ---------- homework: who did it ---------- */
function useHomeworkChecks(db, userId) {
  const path = db && userId ? "data/users/" + userId + "/homework" : "";
  const [checks, setChecks] = useState({});
  const cur = useRef({});
  useEffect(() => {
    if (!path) return undefined;
    let un = () => {};
    try {
      un = db.doc(path).onSnapshot((s) => {
        const d = s.exists ? s.data() : null;
        const c = d && d.checks && typeof d.checks === "object" ? d.checks : {};
        cur.current = c; setChecks(c);
      }, () => {});
    } catch (e) { /* unavailable */ }
    return () => un();
  }, [path]);
  /* value: "done", "missing", or null to clear */
  const set = (lessonId, studentId, value) => {
    const forLesson = { ...(cur.current[lessonId] || {}) };
    if (value) forLesson[studentId] = value; else delete forLesson[studentId];
    const next = { ...cur.current, [lessonId]: forLesson };
    if (!Object.keys(forLesson).length) delete next[lessonId];
    cur.current = next; setChecks(next);
    return queuedSet(db.doc(path), { checks: next });
  };
  return { on: !!path, checks, set };
}
const HW_STATE = { done: "Done", missing: "Not done", voice: "Sent a voice note", "": "Not checked yet" };
function hwStatus(l, r, checks, voiceList) {
  const c = (checks[l.id] || {})[r.id];
  if (c) return c;
  return voiceList.some((v) => v.lessonId === l.id && v.sid === r.id) ? "voice" : "";
}
function hwTally(l, people, checks, voiceList) {
  const who = studentsIn(lessonGroups(l), people);
  const st = who.map((r) => hwStatus(l, r, checks, voiceList));
  return { total: who.length, open: st.filter((x) => !x).length, done: st.filter((x) => x === "done" || x === "voice").length, missing: st.filter((x) => x === "missing").length };
}
function HomeworkCheck({ lesson, people, hw, voiceList, flash }) {
  const who = studentsIn(lessonGroups(lesson), people);
  if (!who.length) return <p className="hint">No students in {lessonGroups(lesson).join(", ")} yet.</p>;
  const mine = hw.checks[lesson.id] || {};
  const set = (sid, v) => hw.set(lesson.id, sid, v).catch(() => flash("That didn't save. Check your connection and try again."));
  return (
    <ul className="hw-check">
      {who.map((r) => {
        const st = hwStatus(lesson, r, hw.checks, voiceList);
        const c = mine[r.id] || "";
        return (
          <li key={r.id}>
            <div className="row-main">
              <span className="row-title">{r.name}</span>
              <span className={"row-sub hw-st " + (st || "open")}>{HW_STATE[st]}</span>
            </div>
            <div className="hw-btns">
              <button type="button" className="btn sm ghost yes" aria-pressed={c === "done"} aria-label={`${r.name} did it`} onClick={() => set(r.id, c === "done" ? null : "done")}><Icon name="check" size={15} />Done</button>
              <button type="button" className="btn sm ghost no" aria-pressed={c === "missing"} aria-label={`${r.name} didn't do it`} onClick={() => set(r.id, c === "missing" ? null : "missing")}>Not done</button>
              {st !== "done" && st !== "voice" && r.phone && <WaButton phone={r.phone} text={hwReminderText(r, lesson)} ghost>Remind</WaButton>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
function HomeworkToggle({ lesson, people, hw, voiceList, flash }) {
  const [open, setOpen] = useState(false);
  const t = hwTally(lesson, people, hw.checks, voiceList);
  if (!t.total) return null;
  const label = t.open === t.total ? `Check homework (${t.total})` : `Homework: ${t.done} of ${t.total} done${t.missing ? `, ${t.missing} not done` : ""}`;
  return (
    <div className="hw-toggle">
      <button className="btn ghost sm" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="clipboard" size={15} />{open ? "Close" : label}</button>
      {open && <HomeworkCheck lesson={lesson} people={people} hw={hw} voiceList={voiceList} flash={flash} />}
    </div>
  );
}

/* ---------- getting ready: what to print and bring for the next classes ---------- */
function GetReady({ occs, people, plans, courses }) {
  const [ticks, setTicks] = useState(() => ls.get("bm:ready", {}) || {});
  const groupsSeen = new Map();
  occs.forEach((o) => {
    studentsIn(o.s.group, people).forEach((r) => {
      const e = nextPlanEntry(plans[r.id], courses);
      if (!e) return;
      const lines = prepLines(e.body);
      if (!lines.length) return;
      const g = groupsSeen.get(e.key) || { e, names: [], when: o, lines };
      if (!g.names.includes(r.name)) g.names.push(r.name);
      groupsSeen.set(e.key, g);
    });
  });
  const list = [...groupsSeen.values()];
  if (!list.length) return null;
  const toggle = (k) => {
    const next = { ...ticks, [k]: ticks[k] ? null : todayISO() };
    Object.keys(next).forEach((x) => { if (!next[x] || next[x] < addDays(todayISO(), -14)) delete next[x]; });
    setTicks(next); ls.set("bm:ready", next);
  };
  return (
    <div className="today-block">
      <h3 className="today-h">Get ready</h3>
      <p className="hint">From the next lesson on each student's list. Tick things off as you pack.</p>
      {list.map(({ e, names, when, lines }) => (
        <div key={e.key} className="ready-card">
          <p className="ready-title">{e.title}</p>
          <p className="row-sub">{names.join(", ")}. {when.date === todayISO() ? "Today" : "Tomorrow"} at {when.start}</p>
          <ul className="todo-list">
            {lines.map((x, k) => {
              const id = e.key + "#" + k;
              return (
                <li key={id} className={ticks[id] ? "is-done" : ""}>
                  <label className="check"><input type="checkbox" checked={!!ticks[id]} onChange={() => toggle(id)} /><span><strong>{x.label}:</strong> {mdInline(x.text, id)}</span></label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------- one-tap messages to families ---------- */
const MSG_KINDS = [["reminder", "Class reminder"], ["cancel", "Class cancelled"], ["homework", "Homework reminder"], ["own", "Your own message"]];
function familyText(kind, fam, ctx) {
  const fr = fam.lang === "fr";
  const names = fam.people.map((r) => r.name).join(fr ? " et " : " and ");
  const extra = ctx.extra.trim();
  const end = extra ? "\n" + extra : "";
  if (kind === "own") return extra;
  if (kind === "reminder" || kind === "cancel") {
    const o = ctx.nextOf(fam.group);
    if (!o) return "";
    const where = o.s.link ? (fr ? "en ligne" : "online") : placeName(o.s);
    if (kind === "reminder") {
      return fr ? `Bonjour ! Petit rappel pour ${names} : cours d'anglais ${classWhen(o, "fr")}${where ? ` (${where})` : ""}. À bientôt !${end}\nBright Minds`
        : `Hello! A quick reminder for ${names}: English class ${classWhen(o, "en")}${where ? ` (${where})` : ""}. See you soon!${end}\nBright Minds`;
    }
    return fr ? `Bonjour ! Le cours d'anglais de ${names} ${classWhen(o, "fr")} est annulé. Je vous dirai bientôt quand nous le rattrapons. Désolé pour le changement.${end}\nBright Minds`
      : `Hello! ${names}'s English class ${classWhen(o, "en")} is cancelled. I'll let you know soon when we'll make it up. Sorry for the change.${end}\nBright Minds`;
  }
  const l = ctx.homeworkOf(fam.group);
  if (!l) return "";
  const due = l.due ? (fr ? ` pour ${longDate(l.due, "fr")}` : ` for ${longDate(l.due, "en")}`) : "";
  return fr ? `Bonjour ! Petit rappel pour ${names} : les devoirs d'anglais « ${l.title} »${due}.\n${l.homework}\nOn peut aussi envoyer un message vocal dans l'application Bright Minds, onglet Devoirs. Merci !${end}`
    : `Hello! A quick reminder for ${names}: the English homework "${l.title}"${due}.\n${l.homework}\nYou can also send a voice note in the Bright Minds app, under Homework. Thank you!${end}`;
}
/* Students who share one WhatsApp number (brothers and sisters) get one message. */
function familiesOf(list) {
  const out = [];
  list.forEach((r) => {
    const d = r.phone ? waDigits(r.phone) : "";
    const key = d ? "p" + d : "s" + r.id;
    let f = out.find((x) => x.key === key);
    if (!f) { f = { key, phone: r.phone, lang: r.lang, group: r.group, people: [] }; out.push(f); }
    f.people.push(r);
  });
  return out;
}
function FamilyMessages({ people, groups, schedule, changes, lessons, hw, voiceList = [], onBack }) {
  const [kind, setKind] = useState("reminder");
  const [chosen, setChosen] = useState([EVERYONE]);
  const [extra, setExtra] = useState("");
  const [sent, setSent] = useState({});
  const now = new Date();
  const today = todayISO();
  const ctx = {
    extra,
    nextOf: (g) => upcomingClasses(schedule.filter((s) => s.group === g || s.group === EVERYONE), changes, now, 14)[0] || null,
    homeworkOf: (g) => [...lessons].filter((l) => l.homework && forGroup(lessonGroups(l), g) && ((l.due && l.due >= today) || String(l.date || "") >= addDays(today, -14)))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null,
  };
  /* a homework reminder skips students who did it or sent a voice note */
  const didIt = (r) => {
    if (kind !== "homework" || !hw) return false;
    const l = ctx.homeworkOf(r.group);
    if (!l) return false;
    const st = hwStatus(l, r, hw.checks, voiceList);
    return st === "done" || st === "voice";
  };
  const who = people.filter((r) => forGroup(chosen, r.group));
  const already = who.filter(didIt);
  const fams = familiesOf(who.filter((r) => !didIt(r)));
  const rows = fams.map((f) => ({ f, text: familyText(kind, f, ctx) }));
  const skipped = rows.filter((x) => !x.text);
  return (
    <section>
      <button className="back-link" onClick={onBack}><Icon name="left" />Today</button>
      <h2 className="h">Message families</h2>
      <div className="field">
        <span id="msg-kind-label">Message</span>
        <div className="chip-pick" role="group" aria-labelledby="msg-kind-label">
          {MSG_KINDS.map(([k, label]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setSent({}); }}>{label}</button>)}
        </div>
      </div>
      <GroupPicker id="msg-for" groups={groups} roster={people} value={chosen} onChange={(v) => { setChosen(v); setSent({}); }} />
      <Field label={kind === "own" ? "Your message" : "Add a line (optional)"}>
        <textarea id="msg-extra" className="inp" value={extra} placeholder={kind === "own" ? "Bonjour ! ..." : "Bring your colored pencils."} onChange={(e) => setExtra(e.target.value)} />
      </Field>
      {kind !== "own" && <p className="hint">Each family gets it in their own language, with their own class time. Brothers and sisters on one number get one message.</p>}
      {kind === "own" && <p className="hint">Sent as you write it. Write it in the language the family reads.</p>}
      {rows.filter((x) => x.text).length > 0 && (
        <ul className="msg-rows">
          {rows.filter((x) => x.text).map(({ f, text }) => (
            <li key={f.key} className={sent[f.key] ? "is-sent" : ""}>
              <div className="row-main">
                <span className="row-title">{f.people.map((r) => r.name).join(", ")}{sent[f.key] && <span className="sent-chip"><Icon name="check" size={13} />Opened</span>}</span>
                <span className="row-sub msg-preview">{text}</span>
              </div>
              {f.phone
                ? <a className="btn sm" href={waLink(f.phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => setSent({ ...sent, [f.key]: true })}><Icon name="chat" size={16} />Send</a>
                : <CopyButton text={text} label={`Copy the message for ${f.people.map((r) => r.name).join(", ")}`} caption="Copy" />}
            </li>
          ))}
        </ul>
      )}
      {!who.length && <Empty text="Pick who the message is for." />}
      {already.length > 0 && <p className="hint">Already done, so no reminder: {already.map((r) => r.name).join(", ")}.</p>}
      {fams.length > 0 && kind === "own" && !extra.trim() && <p className="hint">Write your message above, then send it to each family.</p>}
      {skipped.length > 0 && kind !== "own" && (
        <p className="hint">{skipped.map((x) => x.f.people.map((r) => r.name).join(", ")).join("; ")}: {kind === "homework" ? "no homework waiting" : "no class in the next two weeks"}, so nothing to send.</p>
      )}
      {fams.some((f) => !f.phone) && <p className="hint">Families without a WhatsApp number get a Copy button. Add numbers with Edit student in Students.</p>}
    </section>
  );
}

/* ---------- one page per student ---------- */
function StudentFile({ r, schedule, changes, lessons, plans, progress, voiceList, hw, money, attNow, attPrev, flash, onBack, onGo }) {
  const { data } = useCourses();
  const courses = data ? data.courses : [];
  const now = new Date();
  const thisMonth = monthKey(now);
  const next = upcomingClasses(schedule.filter((s) => forGroup(s.group, r.group)), changes, now, 21)[0];
  const entries = planEntries(plans[r.id], courses);
  const done = entries.filter((e) => e.p.used).length;
  const nextE = entries.find((e) => !e.p.used && !e.missing);
  const skills = Object.keys((progress && progress.skills) || {}).length;
  const m = money && money.ready ? studentMonth(r, money.fees, money.pays, attNow.taken) : null;
  const visits = [...attNow.taken, ...attPrev.taken].filter((x) => x.studentId === r.id).map((x) => ({ ...x, kind: "came" }))
    .concat([...arr(attNow.absent), ...arr(attPrev.absent)].filter((x) => x.studentId === r.id).map((x) => ({ ...x, kind: "absent" })))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const hwLessons = lessons.filter((l) => l.homework && forGroup(lessonGroups(l), r.group))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 6);
  const voices = voiceList.filter((v) => v.sid === r.id).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const replies = (progress && progress.replies) || {};
  const setHw = (lid, v) => hw.set(lid, r.id, v).catch(() => flash("That didn't save. Check your connection and try again."));
  return (
    <section>
      <button className="back-link" onClick={onBack}><Icon name="left" />Back</button>
      <h2 className="h file-name">{r.name}</h2>
      <p className="muted file-sub">{[r.group && r.group !== r.name ? r.group : null, "code " + r.code, r.level ? levelName(r.level) : null].filter(Boolean).join(", ")}</p>
      <div className="file-grid">
        <div className="file-card">
          <span className="muted small">Next class</span>
          <strong>{next ? `${next.date === todayISO() ? "Today" : next.date === addDays(todayISO(), 1) ? "Tomorrow" : DAYS.en[(next.at.getDay() + 6) % 7]} at ${pad(next.at.getHours())}:${pad(next.at.getMinutes())}` : "None planned"}</strong>
          {next && <span className="row-sub">{fmtDate(next.date)}{placeName(next.s) ? `, ${placeName(next.s)}` : ""}</span>}
        </div>
        {m && (
          <div className="file-card">
            <span className="muted small">{monthLabel(thisMonth)}</span>
            <strong>{m.classes ? `${Math.max(m.left, 0)} of ${m.classes} classes left` : `${m.used} classes`}</strong>
            <span className={"row-sub pay-" + m.status}>{m.fee ? (m.status === "paid" ? "Paid" : `${fcfa(m.fee - m.paid)} to pay`) : "No fee set"}</span>
          </div>
        )}
      </div>
      <div className="file-sec">
        <div className="h-row"><h3 className="today-h">Lessons</h3><button className="btn ghost sm" onClick={() => onGo("lessons", { lessons: { mode: "library", nav: { view: "student", studentId: r.id } } })}>Open list</button></div>
        <p>{entries.length ? `${done} of ${entries.length} taught.` : "No lessons on the list yet."}{nextE ? ` Next: ${nextE.title}.` : ""}</p>
      </div>
      <div className="file-sec">
        <div className="h-row"><h3 className="today-h">What {r.name} can do</h3><button className="btn ghost sm" onClick={() => onGo("lessons", { lessons: { mode: "library", nav: { view: "skills", studentId: r.id } } })}>Update</button></div>
        <p>{skills ? `${skills} ${skills === 1 ? "thing" : "things"} ticked so far.` : "Nothing ticked yet."}</p>
      </div>
      <div className="file-sec">
        <h3 className="today-h">Classes and notes</h3>
        {visits.length === 0 ? <p className="hint">No classes logged in {monthLabel(shiftMonth(thisMonth, -1))} or {monthLabel(thisMonth)}.</p> : (
          <ul className="visit-list">
            {visits.map((x) => (
              <li key={x.id} className={x.kind === "absent" ? "is-absent" : ""}>
                <span className="visit-date">{fmtShort(x.date)}</span>
                <span className="visit-main">
                  {x.kind === "absent" ? <span className="absent-tag">Absent</span> : noteText(x) ? <span>{noteText(x)}</span> : <span className="muted">Came. No notes.</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="file-sec">
        <h3 className="today-h">Homework</h3>
        {hwLessons.length === 0 ? <p className="hint">No homework given yet.</p> : (
          <ul className="hw-check">
            {hwLessons.map((l) => {
              const st = hwStatus(l, r, hw.checks, voiceList);
              const c = (hw.checks[l.id] || {})[r.id] || "";
              return (
                <li key={l.id}>
                  <div className="row-main">
                    <span className="row-title">{l.title}</span>
                    <span className={"row-sub hw-st " + (st || "open")}>{HW_STATE[st]}{l.due ? `. Due ${fmtShort(l.due)}` : ""}</span>
                  </div>
                  <div className="hw-btns">
                    <button type="button" className="btn sm ghost yes" aria-pressed={c === "done"} aria-label={`Done: ${l.title}`} onClick={() => setHw(l.id, c === "done" ? null : "done")}><Icon name="check" size={15} />Done</button>
                    <button type="button" className="btn sm ghost no" aria-pressed={c === "missing"} aria-label={`Not done: ${l.title}`} onClick={() => setHw(l.id, c === "missing" ? null : "missing")}>Not done</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="file-sec">
        <div className="h-row"><h3 className="today-h">Voice notes</h3>{voices.length > 0 && <button className="btn ghost sm" onClick={() => onGo("lessons", { lessons: { mode: "voice" } })}>Listen</button>}</div>
        {voices.length === 0 ? <p className="hint">No voice notes yet.</p> : (
          <ul className="visit-list">
            {voices.slice(0, 6).map((v) => {
              const rep = replies[v.id];
              return (
                <li key={v.id}>
                  <span className="visit-date">{v.at ? fmtShort(String(v.at).slice(0, 10)) : ""}</span>
                  <span className="visit-main">{v.title || "Voice note"}. {mmss(v.secs || 0)}{!v.heard ? <span className="new-chip">New</span> : rep ? ` Replied ${"★".repeat(rep.stars || 0)}` : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="file-sec">
        <button className="btn ghost sm" onClick={() => onGo("students", { openId: r.id })}><Icon name="wallet" size={15} />Payments, code and report</button>
      </div>
    </section>
  );
}

/* ---------- Today: the teacher's home screen ---------- */
function TodayTeacher({ people, groups, view, att, attPrev, plansH, hw, voiceList, money, pay, db, userId, flash, onFile, onGo }) {
  const [logFor, setLogFor] = useState(null);
  const [mode, setMode] = useState("home");
  const [hwOpen, setHwOpen] = useState(null);
  const [skipped, setSkipped] = useState(() => ls.get("bm:skipLog", []) || []);
  const { data } = useCourses();
  const courses = data ? data.courses : [];
  const plans = plansH.on ? plansH.plans : {};
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const { schedule, changes, lessons } = view;
  const attFor = (date) => (date.slice(0, 7) === att.month ? att : attPrev);
  const todays = classesOn(today, schedule, changes);
  const tomorrows = classesOn(tomorrow, schedule, changes);
  const allTaken = [...att.taken, ...attPrev.taken];
  const lastNote = (sid, before) => allTaken.filter((x) => x.studentId === sid && x.date < before && noteText(x)).sort((a, b) => b.date.localeCompare(a.date))[0];
  /* classes from the last 3 days that were never logged */
  const unlogged = [1, 2, 3].flatMap((k) => classesOn(addDays(today, -k), schedule, changes))
    .filter((o) => studentsIn(o.s.group, people).length && !skipped.includes(o.key + "|" + o.date))
    .filter((o) => { const rec = recordsOf(attFor(o.date), o.key, o.date); return !rec.taken.length && !rec.absent.length && attFor(o.date).ready; });
  const skip = (o) => { const next = [...skipped, o.key + "|" + o.date].slice(-40); setSkipped(next); ls.set("bm:skipLog", next); };
  const newVoice = voiceList.filter((v) => !v.heard).length;
  const hwWaiting = lessons.filter((l) => l.homework && l.date && l.date <= today && l.date >= addDays(today, -21))
    .map((l) => ({ l, t: hwTally(l, people, hw.checks, voiceList) })).filter((x) => x.t.total && x.t.open)
    .sort((a, b) => String(a.l.due || a.l.date).localeCompare(String(b.l.due || b.l.date)));
  const rows = money.ready ? people.map((r) => ({ ...r, ...studentMonth(r, money.fees, money.pays, att.taken) })) : [];
  const toPay = rows.filter((r) => r.fee > 0 && r.paid < r.fee).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const thisMonth = monthKey(new Date());

  if (mode === "messages") return <FamilyMessages people={people} groups={groups} schedule={schedule} changes={changes} lessons={lessons} hw={hw} voiceList={voiceList} onBack={() => { setMode("home"); window.scrollTo(0, 0); }} />;

  const classCard = (o) => {
    const who = studentsIn(o.s.group, people);
    const a = attFor(o.date);
    const rec = recordsOf(a, o.key, o.date);
    const logged = rec.taken.length + rec.absent.length > 0;
    const nexts = new Map();
    who.forEach((r) => {
      const e = nextPlanEntry(plans[r.id], courses);
      if (!e) return;
      const g = nexts.get(e.key) || { e, names: [], r };
      g.names.push(r.name); nexts.set(e.key, g);
    });
    const notes = who.map((r) => ({ r, x: lastNote(r.id, o.date) })).filter((n) => n.x);
    const id = o.key + "|" + o.date;
    return (
      <div key={id} className={"class-card" + (logged ? " is-logged" : "")}>
        <div className="class-top">
          <span className="class-time">{o.start}</span>
          <span className="class-main">
            <span className="row-title">{o.s.group}{o.makeup ? " (make-up)" : ""}</span>
            <span className="row-sub">{[placeName(o.s), `${o.s.minutes || 60} min`].filter(Boolean).join(", ")}</span>
          </span>
          {o.s.link && <a className="btn ghost sm" href={o.s.link} target="_blank" rel="noopener noreferrer"><Icon name="video" size={16} />Join</a>}
        </div>
        {who.length > 0 && (
          <div className="class-who">
            {who.map((r) => <button key={r.id} className="name-chip" onClick={() => onFile(r.id)}>{r.name}</button>)}
          </div>
        )}
        {[...nexts.values()].map(({ e, names, r }) => (
          <div key={e.key} className="class-line">
            <span className="muted small">Next lesson{nexts.size > 1 || (who.length > 1 && names.length < who.length) ? ` for ${names.join(", ")}` : ""}</span>
            <button className="link-row" onClick={() => onGo("lessons", { lessons: { mode: "library", nav: { view: "plan", studentId: r.id, planId: e.p.id } } })}>
              <span>{e.title}</span><Icon name="right" size={16} />
            </button>
          </div>
        ))}
        {who.length > 0 && !nexts.size && plansH.on && (
          <p className="hint class-hint">No lesson list yet. <button className="link" onClick={() => onGo("lessons", { lessons: { mode: "library", nav: who.length === 1 ? { view: "student", studentId: who[0].id } : { view: "home" } } })}>Add lessons in the Library</button></p>
        )}
        {notes.map(({ r, x }) => (
          <p key={r.id} className="last-note"><span className="muted small">Last time{who.length > 1 ? `, ${r.name}` : ""} ({fmtShort(x.date)})</span>{noteText(x)}</p>
        ))}
        {who.length > 0 && a.on && o.date <= today && logFor !== id && (
          <div className="class-actions">
            {logged
              ? <button className="btn done sm" onClick={() => setLogFor(id)}><Icon name="check" size={16} />{logSummary(rec)}</button>
              : <button className="btn sm" onClick={() => setLogFor(id)}>Mark taught</button>}
          </div>
        )}
        {logFor === id && <ClassLog occ={o} people={people} att={a} lessons={lessons} flash={flash} onClose={() => setLogFor(null)} />}
      </div>
    );
  };

  return (
    <section>
      <div className="h-row">
        <div>
          <h2 className="h today-title">Today</h2>
          <p className="muted today-date">{longDate(today)}</p>
        </div>
        <button className="btn sm" onClick={() => { setMode("messages"); window.scrollTo(0, 0); }}><Icon name="chat" size={16} />Message families</button>
      </div>

      {unlogged.length > 0 && (
        <div className="today-block">
          <h3 className="today-h">Not logged yet</h3>
          {unlogged.map((o) => {
            const id = o.key + "|" + o.date;
            return (
              <div key={id} className="class-card">
                <div className="class-top">
                  <span className="class-time">{o.start}</span>
                  <span className="class-main"><span className="row-title">{o.s.group}</span><span className="row-sub">{longDate(o.date)}</span></span>
                </div>
                {logFor !== id && (
                  <div className="class-actions">
                    <button className="btn sm" onClick={() => setLogFor(id)}>Mark taught</button>
                    <button className="btn ghost sm" onClick={() => skip(o)}>There was no class</button>
                  </div>
                )}
                {logFor === id && <ClassLog occ={o} people={people} att={attFor(o.date)} lessons={lessons} flash={flash} onClose={() => setLogFor(null)} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="today-block">
        <h3 className="today-h">Classes today</h3>
        {todays.length ? todays.map(classCard) : <p className="hint">No classes today.</p>}
      </div>

      {tomorrows.length > 0 && (
        <div className="today-block">
          <h3 className="today-h">Tomorrow</h3>
          {tomorrows.map(classCard)}
        </div>
      )}
      {!todays.length && !tomorrows.length && (() => {
        const nx = upcomingClasses(schedule, changes, new Date(), 14)[0];
        return nx ? <p className="hint">Next class: {nx.s.group}, {longDate(nx.date)} at {pad(nx.at.getHours())}:{pad(nx.at.getMinutes())}.</p> : null;
      })()}

      {(newVoice > 0 || hwWaiting.length > 0) && (
        <div className="today-block">
          <h3 className="today-h">Waiting for you</h3>
          {newVoice > 0 && (
            <div className="wait-row">
              <span className="row-main"><span className="row-title">{newVoice} new voice {newVoice === 1 ? "note" : "notes"}</span><span className="row-sub">Homework recorded by your students</span></span>
              <button className="btn sm" onClick={() => onGo("lessons", { lessons: { mode: "voice" } })}><Icon name="play" size={15} />Listen</button>
            </div>
          )}
          {hwWaiting.map(({ l, t }) => (
            <div key={l.id} className="wait-block">
              <div className="wait-row">
                <span className="row-main">
                  <span className="row-title">{l.title}</span>
                  <span className="row-sub">{t.open} of {t.total} to check{l.due ? `. Due ${fmtShort(l.due)}` : ""}. For {lessonGroups(l).join(", ")}</span>
                </span>
                <button className="btn ghost sm" aria-expanded={hwOpen === l.id} onClick={() => setHwOpen(hwOpen === l.id ? null : l.id)}>{hwOpen === l.id ? "Close" : "Check"}</button>
              </div>
              {hwOpen === l.id && <HomeworkCheck lesson={l} people={people} hw={hw} voiceList={voiceList} flash={flash} />}
            </div>
          ))}
        </div>
      )}

      <GetReady occs={[...todays.filter((o) => !recordsOf(attFor(o.date), o.key, o.date).taken.length), ...tomorrows]} people={people} plans={plans} courses={courses} />

      {money.ready && toPay.length > 0 && (
        <div className="today-block">
          <h3 className="today-h">Still to pay in {monthLabel(thisMonth)}</h3>
          <ul className="msg-rows">
            {toPay.map((r) => (
              <li key={r.id}>
                <button className="row-main link-like" onClick={() => onFile(r.id)}><span className="row-title">{r.name}</span><span className="row-sub">{fcfa(r.fee - r.paid)} left to pay</span></button>
                {r.phone ? <WaButton phone={r.phone} text={reminderText(r, thisMonth, pay)} ghost>Remind</WaButton> : <CopyButton text={reminderText(r, thisMonth, pay)} label={`Copy a reminder for ${r.name}`} caption="Copy" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function useContent(on) {
  const [state, setState] = useState({ content: null, error: false });
  useEffect(() => {
    if (!on) return undefined;
    let un = () => {};
    try {
      un = FB.db.doc("site/content").onSnapshot(
        (s) => setState({ content: normalize(s.exists ? s.data() : {}), error: false }),
        () => setState((x) => ({ ...x, error: true })));
    } catch (e) { setState((x) => ({ ...x, error: true })); }
    return () => un();
  }, [on]);
  return state;
}
/* A real student record always has an id and a name. A record with neither is a leftover (only "classes left / paid"),
   from a status written just as a student was removed or given a new code: it is kept out of the list and cleaned up. */
const isStudentRecord = (d) => !!d && typeof d.id === "string" && !!d.id && typeof d.name === "string";
function useRoster(on) {
  const [state, setState] = useState({ roster: [], leftovers: [], ready: false });
  useEffect(() => {
    if (!on) { setState({ roster: [], leftovers: [], ready: false }); return undefined; }
    let un = () => {};
    try {
      un = FB.db.collection("students").onSnapshot(
        (qs) => {
          const all = qs.docs.map((d) => ({ ...d.data(), code: d.id }));
          setState({ roster: all.filter(isStudentRecord), leftovers: all.filter((x) => !isStudentRecord(x) && !x.id && !x.name).map((x) => x.code), ready: true });
        },
        () => setState((x) => ({ ...x, ready: true })));
    } catch (e) { setState((x) => ({ ...x, ready: true })); }
    return () => un();
  }, [on]);
  return state;
}
function useStudentDoc(code) {
  const [state, setState] = useState({ code: null, doc: undefined });
  useEffect(() => {
    if (!code || !FB) { setState({ code, doc: null }); return undefined; }
    setState({ code, doc: undefined });
    let un = () => {};
    try {
      un = FB.db.doc("students/" + code).onSnapshot(
        (s) => setState({ code, doc: s.exists && isStudentRecord(s.data()) ? { ...s.data(), code } : null }),
        () => setState({ code, doc: null }));
    } catch (e) { setState({ code, doc: null }); }
    return () => un();
  }, [code]);
  return state.code === code ? state.doc : undefined;
}

function Notice({ text }) {
  return (
    <div className="welcome">
      <div className="panel rings welcome-page">
        <h1 className="welcome-title">Bright Minds</h1>
        <p className="welcome-sub">{text}</p>
      </div>
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const [role, setRole] = useState(() => ls.get("bm:role"));
  const [me, setMe] = useState(() => ls.get("bm:me"));
  const [done, setDone] = useState(() => ls.get("bm:done", {}) || {});
  const [lang, setLang] = useState(() => ls.get("bm:lang") || (/^fr/i.test(navigator.language || "") ? "fr" : "en"));
  const [user, setUser] = useState(undefined);
  const [joinView, setJoinView] = useState(() => (window.location.hash || "") === "#join");
  const [installView, setInstallView] = useState(() => (window.location.hash || "") === "#install");
  const [installHidden, setInstallHidden] = useState(() => !!ls.get("bm:installHidden"));
  const [tab, setTab] = useState(null);
  const [jump, setJump] = useState(null); // where a link from Today or a student's page opens another tab
  const [fileOf, setFileOf] = useState(null); // the student whose page is open
  const [bizOpen, setBizOpen] = useState(false); // Business is its own section, opened from the header
  const [openDeck, setOpenDeck] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const canTeach = isTeacherUser(user);
  const isTeacher = role === "teacher" && canTeach;
  const db = canTeach ? FB.db : null;
  const userId = canTeach ? user.uid : null;
  const thisMonth = monthKey(new Date());
  const { content, error } = useContent(!!FB);
  const rosterH = useRoster(isTeacher);
  const studentRec = useStudentDoc(!isTeacher && me && me.id !== "guest" ? me.code : null);
  const attToday = useAttendance(isTeacher ? db : null, userId, thisMonth);
  const attPrev = useAttendance(isTeacher ? db : null, userId, shiftMonth(thisMonth, -1));
  const plansH = usePlans(isTeacher ? db : null, userId);
  const hwChecks = useHomeworkChecks(isTeacher ? db : null, userId);
  const moneyNow = useMoney(isTeacher ? db : null, userId, thisMonth);
  const bizH = useBiz(isTeacher ? db : null, userId);
  const progressAll = useCollectionMap("progress", isTeacher);
  const voiceAll = useCollectionMap("voice", isTeacher);
  const [voiceSent, setVoiceSent] = useState(() => ls.get("bm:voice", {}) || {});

  const flash = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3200); };
  const saveFail = () => flash("That didn't save. Check your connection and try again.");

  useEffect(() => {
    if (!FB) { setUser(null); return undefined; }
    FB.auth.getRedirectResult().catch(() => {});
    return FB.auth.onAuthStateChanged((u) => { checkTeacher(u).then(() => setUser(u || null), () => setUser(u || null)); });
  }, []);

  /* brightmindsci.github.io/#essai (or #try) opens the free trial straight away, for links in ads.
     A student who already has a code, or the teacher, keeps their own view. */
  const openTrialFromLink = () => {
    const h = (window.location.hash || "").toLowerCase();
    if (h !== "#essai" && h !== "#try") return;
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* ignore */ }
    if (ls.get("bm:role") === "teacher") return;
    const cur = ls.get("bm:me");
    if (cur && cur.id !== "guest") return;
    setMe(GUEST); ls.set("bm:me", GUEST); setRole("student"); ls.set("bm:role", "student"); setTab("words");
  };
  useEffect(() => { openTrialFromLink(); }, []);
  useEffect(() => {
    const onHash = () => { openTrialFromLink(); const h = window.location.hash || ""; setJoinView(h === "#join"); setInstallView(h === "#install"); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (canTeach && role == null) { setRole("teacher"); ls.set("bm:role", "teacher"); }
    if (!canTeach && role === "teacher") { setRole(null); ls.del("bm:role"); }
  }, [user, role]);

  // Keep each student's "classes left" and "paid" up to date from your private records.
  const showStatus = content ? content.settings.showStatus : true;
  const wanted = useMemo(() => (
    isTeacher && rosterH.ready && moneyNow.ready && attToday.ready && !moneyNow.failed
      ? (showStatus ? computeStatuses(rosterH.roster, moneyNow.fees, moneyNow.pays, attToday.taken, thisMonth) : {}) : null
  ), [isTeacher, showStatus, rosterH.ready, rosterH.roster, moneyNow.ready, moneyNow.failed, moneyNow.fees, moneyNow.pays, attToday.ready, attToday.taken, thisMonth]);
  useEffect(() => {
    if (!wanted) return;
    rosterH.roster.forEach((r) => {
      const w = wanted[r.id] || null;
      const cur = r.st ? { m: r.st.m, left: r.st.left, total: r.st.total, pay: r.st.pay } : null;
      if (stable(cur) === stable(w)) return;
      /* update, not set: if the student was just removed or got a new code, this fails quietly instead of bringing back an empty record */
      FB.db.doc("students/" + r.code).update({ st: w ? { ...w, at: todayISO() } : null }).catch(() => {});
    });
  }, [wanted]);
  /* clear away leftover records from before this fix */
  useEffect(() => {
    if (!isTeacher || !rosterH.leftovers.length) return;
    const batch = FB.db.batch();
    rosterH.leftovers.forEach((code) => batch.delete(FB.db.doc("students/" + code)));
    batch.commit().catch(() => {});
  }, [isTeacher, rosterH.leftovers.join(",")]);

  const saveContent = (key) => (value) => {
    FB.db.doc("site/content").set({ [key]: value, updated: new Date().toISOString() }, { mergeFields: [key, "updated"] }).catch(saveFail);
  };
  const saveRoster = (next) => { saveRosterDocs(rosterH.roster, next).catch(saveFail); };
  const roster = rosterH.roster;
  const groups = useMemo(() => {
    const s = [...new Set(roster.map((r) => r.group).filter((g) => g && g !== EVERYONE))].sort();
    return [EVERYONE, ...s];
  }, [roster]);
  /* students with their private WhatsApp number and message language, for the teacher's messages */
  const people = useMemo(() => roster.map((r) => {
    const f = moneyNow.fees[r.id] || {};
    return { ...r, phone: f.phone || "", lang: f.lang === "fr" ? "fr" : "en" };
  }).sort((x, y) => String(x.name).localeCompare(String(y.name))), [roster, moneyNow.fees]);
  const goTab = (id, extra = null) => { setFileOf(null); setBizOpen(false); setJump(extra); setTab(id); window.scrollTo(0, 0); };
  const openFile = (id) => { setBizOpen(false); setFileOf(id); window.scrollTo(0, 0); };
  const openBusiness = () => { setFileOf(null); setBizOpen(true); window.scrollTo(0, 0); };

  const meR = !me ? null : me.id === "guest" ? GUEST : studentRec || null;
  const progDoc = useProgressDoc(!isTeacher && meR && meR.id !== "guest" ? meR.id : null);
  const addVoiceSent = (lessonId, x) => {
    const next = { ...voiceSent, [lessonId]: [...arr(voiceSent[lessonId]), x].slice(-5) };
    setVoiceSent(next); ls.set("bm:voice", next);
  };

  const toggleLang = () => { const next = lang === "fr" ? "en" : "fr"; setLang(next); ls.set("bm:lang", next); };
  const toggleDone = (lessonId) => {
    const next = { ...done };
    if (next[lessonId]) delete next[lessonId]; else next[lessonId] = todayISO();
    setDone(next); ls.set("bm:done", next);
  };
  const chooseStudent = (s) => {
    const m = s ? { id: s.id, name: s.name, group: s.group, code: s.code } : GUEST;
    setMe(m); ls.set("bm:me", m); setRole("student"); ls.set("bm:role", "student"); setTab("words");
  };
  const toTeacher = () => { setRole("teacher"); ls.set("bm:role", "teacher"); setTab("today"); setFileOf(null); setJump(null); window.scrollTo(0, 0); };
  const toStudentView = () => { setRole("student"); ls.set("bm:role", "student"); setTab(null); };
  const switchStudent = () => { setMe(null); ls.del("bm:me"); setTab(null); };
  const signIn = async () => {
    try {
      await teacherSignIn();
      if (await checkTeacher(FB.auth.currentUser)) toTeacher();
    } catch (e) { flash("Sign-in didn't work. Check your connection and try again."); }
  };
  const signOut = () => { FB.auth.signOut().catch(() => {}); setRole(null); ls.del("bm:role"); setTab(null); };

  const uiLang = isTeacher ? "en" : lang;
  const T = (k) => STR[uiLang][k];
  const tabs = isTeacher
    ? [{ id: "today", label: "Today", icon: "sun" }, { id: "classes", label: "Classes", icon: "calendar" }, { id: "lessons", label: "Lessons", icon: "clipboard" }, { id: "students", label: "Students", icon: "users" }]
    : [{ id: "words", label: T("tabWords"), icon: "book" }, { id: "homework", label: T("tabHomework"), icon: "clipboard" },
      { id: "progress", label: T("tabProgress"), icon: "award" },
      { id: "classes", label: T("tabClasses"), icon: "calendar" },
      ...(me && me.id === "guest" ? [] : [{ id: "pay", label: T("tabPay"), icon: "wallet" }])];
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  if (!FB) return <Notice text={CONFIGURED ? "Bright Minds could not load. Check your internet connection, then open the page again." : "This app isn't connected to its database yet."} />;
  if (role === "teacher" && user === undefined) return <p className="boot" role="status">Opening Bright Minds...</p>;
  if (installView) {
    const closeInstall = () => {
      setInstallView(false);
      try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { window.location.hash = ""; }
      window.scrollTo(0, 0);
    };
    return <LangCtx.Provider value={lang}><InstallPage onBack={closeInstall} onLang={toggleLang} /></LangCtx.Provider>;
  }
  if (!content) return error ? <Notice text={STR[lang].offline} /> : <p className="boot" role="status">{STR[lang].opening}</p>;
  if (!isTeacher && me && me.id !== "guest" && studentRec === undefined) return <p className="boot" role="status">{STR[lang].opening}</p>;

  const view = content;
  const trialOn = !isTeacher && !!meR && meR.id === "guest";
  const openJoin = () => { setJoinView(true); window.scrollTo(0, 0); };
  if (!isTeacher && (!meR || joinView)) {
    return (
      <LangCtx.Provider value={lang}>
        {joinView
          ? <JoinPage backLabel={trialOn ? STR[lang].trialBack : ""} join={view.join} pay={view.pay} schedule={view.schedule} counts={view.groupCounts} onBack={() => { setJoinView(false); if (window.location.hash === "#join") { try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* ignore */ } } }} onLang={toggleLang} />
          : <Welcome canTeach={canTeach} signedIn={!!user} notTeacher={user && !canTeach ? user.email || "This account" : ""} onStudent={chooseStudent} onTeacher={toTeacher}
              onSignIn={signIn} onSignOut={signOut} onLang={toggleLang} onJoin={() => { setJoinView(true); window.scrollTo(0, 0); }} />}
        {toast && <div className="dock"><div className="toast" role="status">{toast}</div></div>}
      </LangCtx.Provider>
    );
  }

  let screen;
  const fileR = isTeacher && fileOf ? people.find((r) => r.id === fileOf) : null;
  const bizOn = isTeacher && bizOpen && !fileR;
  if (bizOn) {
    screen = (
      <BusinessTeacher bizH={bizH} db={db} userId={userId} flash={flash} pay={view.pay} downloads={downloads} onBack={() => { setBizOpen(false); window.scrollTo(0, 0); }}
        roster={roster} schedule={view.schedule} changes={view.changes} join={view.join} saveJoin={saveContent("join")} groups={groups} />
    );
  } else if (fileR) {
    screen = (
      <StudentFile r={fileR} schedule={view.schedule} changes={view.changes} lessons={view.lessons} plans={plansH.on ? plansH.plans : {}}
        progress={progressAll.map[fileR.id]} voiceList={Object.values(voiceAll.map)} hw={hwChecks}
        money={moneyNow} attNow={attToday} attPrev={attPrev} flash={flash} onBack={() => { setFileOf(null); window.scrollTo(0, 0); }} onGo={goTab} />
    );
  } else if (isTeacher) {
    if (current === "today") screen = (
      <TodayTeacher people={people} groups={groups} view={view} att={attToday} attPrev={attPrev} plansH={plansH} hw={hwChecks}
        voiceList={Object.values(voiceAll.map)} money={moneyNow} pay={view.pay} db={db} userId={userId} flash={flash} onFile={openFile} onGo={goTab} />
    );
    else if (current === "classes") screen = (
      <>
        <NoticesTeacher notices={view.notices} groups={groups} saveNotices={saveContent("notices")} flash={flash} />
        <Classes schedule={view.schedule} changes={view.changes} saveChanges={saveContent("changes")} notices={view.notices} saveNotices={saveContent("notices")}
          isTeacher groups={groups} saveSchedule={saveContent("schedule")} flash={flash} roster={people} att={attToday} lessons={view.lessons} />
      </>
    );
    else if (current === "lessons") screen = <LessonsTeacher key={jump ? JSON.stringify(jump) : "lessons"} start={jump && jump.lessons} lessons={view.lessons} groups={groups} saveLessons={saveContent("lessons")} flash={flash} sample={null} db={db} userId={userId} decks={view.decks} saveDecks={saveContent("decks")} roster={roster} people={people} voiceNotes={voiceAll.map} progressMap={progressAll.map} plansH={plansH} hw={hwChecks} openDeck={openDeck} setOpenDeck={setOpenDeck} />;
    else screen = (
      <StudentsTeacher roster={roster} saveRoster={saveRoster} pay={view.pay} savePay={saveContent("pay")}
        settings={view.settings} saveSettings={saveContent("settings")} lessons={view.lessons} decks={view.decks}
        schedule={view.schedule} changes={view.changes} places={bizH.biz.places} downloads={downloads} teacherName={bizH.biz.teacher.name || view.pay.accountName}
        db={db} userId={userId} flash={flash} startOpen={jump && jump.openId} onFile={openFile} key={jump && jump.openId ? "open-" + jump.openId : "students"} />
    );
  } else {
    const st = view.settings.showStatus ? meR.st : null;
    if (trialOn) {
      if (current === "words") screen = <TrialWords decks={view.decks} me={meR} />;
      else if (current === "homework") screen = <HomeworkStudent lessons={[trialLesson(lang), ...view.lessons]} me={meR} done={done} onToggle={toggleDone} prog={null} />;
      else if (current === "progress") screen = <ProgressStudent me={meR} prog={trialProgress()} sample />;
      else screen = <TrialClasses onJoin={openJoin} />;
    }
    else if (current === "words") screen = <WordsStudent decks={view.decks} me={meR} />;
    else if (current === "homework") screen = <HomeworkStudent lessons={view.lessons} me={meR} done={done} onToggle={toggleDone} prog={progDoc} voiceSent={voiceSent} onVoiceSent={addVoiceSent} />;
    else if (current === "progress") screen = <ProgressStudent me={meR} prog={progDoc} />;
    else if (current === "pay") screen = <PayStudent pay={view.pay} me={meR} st={st} />;
    else screen = <Classes schedule={view.schedule} changes={view.changes} me={meR} st={st} updated={st && st.at ? st.at : null} />;
  }

  const today = todayISO();
  const voiceNew = isTeacher ? Object.values(voiceAll.map).filter((v) => !v.heard).length : 0;
  const hwCount = isTeacher ? 0 : (trialOn ? [trialLesson(lang), ...view.lessons] : view.lessons).filter((l) => l.homework && forGroup(lessonGroups(l), meR.group) && !done[l.id] && (!l.due || l.due >= today)).length;
  const fresh = isTeacher && rosterH.ready && roster.length === 0 && !view.lessons.length && !view.schedule.length;

  return (
    <LangCtx.Provider value={uiLang}>
      <div className="shell">
        <header className="top">
          <span className="brand">Bright Minds</span>
          <div className="who">
            {isTeacher ? (
              <TeacherHeaderActions bizOpen={bizOn} onBusiness={openBusiness} onStudentView={() => { setBizOpen(false); setFileOf(null); toStudentView(); }} onSignOut={() => { setBizOpen(false); setFileOf(null); signOut(); }} />
            ) : (
              <>
                {meR.id === "guest" ? <span className="trial-chip">{STR[lang].trialBadge}</span> : <span>{meR.name}</span>}
                <button className="link" onClick={toggleLang} aria-label={STR[lang].otherLangName}>{STR[lang].otherLang}</button>
                <button className="link" onClick={switchStudent}>{STR[lang].switchUser}</button>
                {canTeach && <button className="link" onClick={toTeacher}>Teacher view</button>}
              </>
            )}
          </div>
        </header>
        <main>
          {fresh && <p className="note">Welcome to your own Bright Minds. To bring in everything from the Claude version, tap Business at the top, then Settings, and use Move in.</p>}
          {trialOn && <TrialBanner contact={view.join.contact || view.pay.whatsapp} onJoin={openJoin} />}
          {!isTeacher && !trialOn && !installHidden && current === tabs[0].id && <InstallCard onHide={() => { setInstallHidden(true); ls.set("bm:installHidden", true); }} />}
          {!isTeacher && <StudentNotices notices={view.notices} me={meR} />}
          {screen}
        </main>
      </div>
      <div className="dock">
        {toast && <div className="toast" role="status">{toast}</div>}
        <nav className="tabbar" aria-label="Sections">
          <div className="dock-in">
            {tabs.map((t) => (
              <button key={t.id} className="tab" aria-current={current === t.id && !fileR && !bizOn ? "page" : undefined} onClick={() => goTab(t.id)}>
                <Icon name={t.icon} size={22} />
                <span className="tab-label">{t.label}</span>
                {t.id === "homework" && hwCount > 0 && <span className="badge" aria-label={`${hwCount}`}>{hwCount}</span>}
                {t.id === "lessons" && voiceNew > 0 && <span className="badge" aria-label={`${voiceNew} new voice notes`}>{voiceNew}</span>}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </LangCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
