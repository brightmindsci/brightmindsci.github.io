"use strict";
(function () {
    if (!window.React || !window.ReactDOM) {
        var rootEl = document.getElementById("root");
        if (rootEl)
            rootEl.innerHTML = '<p class="boot">Bright Minds could not load. Check your internet connection, then open the page again.</p>';
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
    const forGroup = (g, mine) => !g || g === EVERYONE || g === mine;
    const shuffle = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    } return a; };
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
        if (window[globalName])
            return Promise.resolve(window[globalName]);
        if (!scriptLoads[src]) {
            scriptLoads[src] = new Promise((resolve, reject) => {
                const el = document.createElement("script");
                el.src = src;
                el.async = true;
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
            get(k, d = null) { try {
                const v = s().getItem(k);
                return v == null ? d : JSON.parse(v);
            }
            catch (e) {
                return d;
            } },
            set(k, v) { try {
                s().setItem(k, JSON.stringify(v));
            }
            catch (e) { /* storage unavailable */ } },
            del(k) { try {
                s().removeItem(k);
            }
            catch (e) { /* storage unavailable */ } },
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
        }
        catch (e) {
            enVoice = null;
        }
    }
    if (canSpeak) {
        pickVoice();
        try {
            window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
        }
        catch (e) { /* older browser */ }
    }
    let lastSaid = { text: "", at: 0 };
    /* Saying the same thing again within a few seconds says it slowly. */
    function speak(text) {
        if (!canSpeak || !text)
            return;
        try {
            const clean = String(text).replace(/_{2,}/g, "…").replace(/→/g, ",");
            const now = Date.now();
            const again = lastSaid.text === clean && now - lastSaid.at < 5000;
            lastSaid = { text: clean, at: now };
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = enVoice ? enVoice.lang : "en-US";
            if (enVoice)
                u.voice = enVoice;
            u.rate = again ? 0.6 : 0.85;
            window.speechSynthesis.speak(u);
        }
        catch (e) { /* no voice */ }
    }
    /* ---------- words on the student side, in English and French ---------- */
    const STR = {
        en: {
            tagline: "English words, homework and class times in one place.",
            enterCode: "Enter your code", codeHint: "Your teacher sent you a code with 4 numbers.", yourCode: "Your code", open: "Open",
            codeShort: "Your code has 4 numbers.", codeWrong: "That code doesn't match. Check it with your teacher.", noCode: "Practice words without a code",
            switchUser: "Switch", otherLang: "Français", otherLangName: "Lire en français",
            tabWords: "Words", tabHomework: "Homework", tabClasses: "Classes", tabPay: "Pay",
            words: "Words", noLists: "Your teacher hasn't added any word lists yet.", nWords: (n) => `${n} ${n === 1 ? "word" : "words"}`,
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
            codeShort: "Le code a 4 chiffres.", codeWrong: "Ce code ne correspond pas. Vérifiez-le avec votre professeur.", noCode: "Réviser le vocabulaire sans code",
            switchUser: "Changer", otherLang: "English", otherLangName: "Read in English",
            tabWords: "Vocabulaire", tabHomework: "Devoirs", tabClasses: "Cours", tabPay: "Payer",
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
        if (d.startsWith("00"))
            d = d.slice(2);
        if (d.length === 10)
            d = "225" + d;
        return d.length >= 8 ? d : "";
    }
    const waLink = (phone, text) => `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;
    /* Student codes: 4 numbers, unique within the class list. */
    function newCode(roster, exceptId) {
        const used = new Set(roster.filter((r) => r.id !== exceptId).map((r) => r.code));
        for (let i = 0; i < 500; i++) {
            const c = String(1000 + Math.floor(Math.random() * 9000));
            if (!used.has(c))
                return c;
        }
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
        if (!CONFIGURED || !window.firebase)
            return null;
        try {
            const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CONFIG.firebase);
            const db = app.firestore();
            try {
                db.settings({ ignoreUndefinedProperties: true, merge: true });
            }
            catch (e) { /* already set */ }
            try {
                db.enablePersistence({ synchronizeTabs: true }).catch(() => { });
            }
            catch (e) { /* no offline copy in this browser */ }
            return { auth: app.auth(), db };
        }
        catch (e) {
            return null;
        }
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
        if (!u)
            return false;
        if (!(u.uid in teacherSeen)) {
            const email = String(u.email || "").trim().toLowerCase();
            let ok = !!email && TEACHERS.includes(email);
            if (!ok && email && TEACHER_KEYS.length) {
                try {
                    ok = TEACHER_KEYS.includes(await emailKey(email));
                }
                catch (e) {
                    ok = false;
                }
            }
            teacherSeen[u.uid] = ok;
        }
        return teacherSeen[u.uid];
    }
    const isTeacherUser = (u) => !!u && teacherSeen[u.uid] === true;
    async function teacherSignIn() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        try {
            await FB.auth.signInWithPopup(provider);
        }
        catch (e) {
            const code = e && e.code;
            if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
                await FB.auth.signInWithRedirect(provider);
                return;
            }
            if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
                return;
            throw e;
        }
    }
    /* Files the teacher saves (invoices, certificates): an ordinary browser download. */
    const downloads = {
        async save({ filename, data }) {
            const blob = data instanceof Blob ? data : new Blob([data]);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            return { status: "saved" };
        },
    };
    /* Compare values the same way whatever order the database returns their keys in. */
    function stable(v) {
        if (Array.isArray(v))
            return "[" + v.map(stable).join(",") + "]";
        if (v && typeof v === "object")
            return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
        return JSON.stringify(v === undefined ? null : v);
    }
    /* A student's own record: what they see after typing their code. The record's id is the code. */
    function studentDoc(r) {
        const d = { id: r.id, name: r.name, group: r.group };
        if (r.level)
            d.level = r.level;
        if (r.due)
            d.due = r.due;
        if (r.st)
            d.st = r.st;
        return d;
    }
    const groupCountsOf = (roster) => { const c = {}; roster.forEach((r) => { if (r.group)
        c[r.group] = (c[r.group] || 0) + 1; }); return c; };
    function saveRosterDocs(prev, next) {
        const db = FB.db;
        const batch = db.batch();
        const byId = new Map(prev.map((r) => [r.id, r]));
        const keep = new Set(next.map((r) => r.id));
        prev.forEach((r) => { if (!keep.has(r.id))
            batch.delete(db.doc("students/" + r.code)); });
        next.forEach((r) => {
            const old = byId.get(r.id);
            if (old && old.code !== r.code)
                batch.delete(db.doc("students/" + old.code));
            if (!old || old.code !== r.code || stable(studentDoc(old)) !== stable(studentDoc(r)))
                batch.set(db.doc("students/" + r.code), studentDoc(r));
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
        CONTENT_KEYS.forEach((k) => { if (data.content && data.content[k] !== undefined)
            content[k] = data.content[k]; });
        writes.push([db.doc("site/content"), content]);
        arr(data.roster).forEach((r) => { if (r && r.code && r.id)
            writes.push([db.doc("students/" + r.code), studentDoc(r)]); });
        Object.keys(data.private || {}).forEach((rel) => {
            if (REL_PATH_RE.test(rel) && data.private[rel] && typeof data.private[rel] === "object")
                writes.push([db.doc("data/users/" + uid + "/" + rel), data.private[rel]]);
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
            setState("");
            setFile(null);
            if (!f)
                return;
            try {
                const data = JSON.parse(await f.text());
                if (!data || data.kind !== "bright-minds-backup")
                    throw new Error("bad");
                setFile(data);
            }
            catch (err) {
                setState("That file isn't a Bright Minds backup. Choose the file Claude sent you.");
            }
        };
        const run = async () => {
            const u = FB && FB.auth.currentUser;
            if (!file || !u)
                return;
            setBusy(true);
            setState("Moving your data in...");
            try {
                await importBackup(file, u.uid);
                setState(`Done. ${arr(file.roster).length} students and all your records are here now.`);
                setFile(null);
            }
            catch (e) {
                setState("The move didn't finish. Check your connection and try again. Running it again is safe.");
            }
            setBusy(false);
        };
        return (React.createElement("div", { className: "pay-settings" },
            React.createElement("p", { className: "sub-h" }, "Move in from the Claude version"),
            React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "Choose the backup file Claude sent you. It brings in your students and their codes, classes, lessons, word lists, payments, class counts and schools. It replaces what's in the app now."),
            React.createElement("input", { id: "import-file", className: "inp", type: "file", accept: ".json,application/json", "aria-label": "Backup file", onChange: pick }),
            file && React.createElement("p", { className: "hint", style: { margin: "8px 0 0" } }, `Backup from ${file.made ? fmtDate(String(file.made).slice(0, 10)) : "the Claude version"}, with ${arr(file.roster).length} students.`),
            React.createElement("div", { className: "form-actions", style: { marginTop: 10 } },
                React.createElement("button", { className: "btn", onClick: run, disabled: !file || busy }, busy ? "Moving..." : "Move my data in")),
            state && React.createElement("p", { className: "hint", role: "status", style: { margin: "10px 0 0" } }, state)));
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
            if (i < 0)
                return null;
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
        if (at <= now)
            return t("now");
        const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d1 = new Date(at.getFullYear(), at.getMonth(), at.getDate());
        const diff = Math.round((d1 - d0) / 86400000);
        const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
        if (diff === 0)
            return t("todayAt", time);
        if (diff === 1)
            return t("tomorrowAt", time);
        return t("dayAt", DAYS[lang][(at.getDay() + 6) % 7], time);
    }
    /* ---------- private records (teacher only) ---------- */
    const writeChains = {};
    function queuedSet(ref, body) {
        const run = (writeChains[ref.path] || Promise.resolve()).then(() => ref.set(body));
        writeChains[ref.path] = run.catch(() => { });
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
            if (!feesPath)
                return undefined;
            let un = () => { };
            const timer = setTimeout(() => setSlow(true), 10000);
            try {
                un = db.doc(feesPath).onSnapshot((s) => {
                    const d = s.exists ? s.data() : null;
                    setFees(d && d.fees && typeof d.fees === "object" ? d.fees : {});
                    setFeesOk(true);
                    if (!s.metadata.fromCache) {
                        clearTimeout(timer);
                        setSlow(false);
                    }
                }, () => { clearTimeout(timer); setFailed(true); });
            }
            catch (e) {
                clearTimeout(timer);
                setFailed(true);
            }
            return () => { clearTimeout(timer); un(); };
        }, [feesPath]);
        useEffect(() => {
            if (!monthPath)
                return undefined;
            setPaysOk(false);
            setPays([]);
            let un = () => { };
            try {
                un = db.doc(monthPath).onSnapshot((s) => {
                    const d = s.exists ? s.data() : null;
                    setPays(d && Array.isArray(d.payments) ? d.payments : []);
                    setPaysOk(true);
                }, () => setFailed(true));
            }
            catch (e) {
                setFailed(true);
            }
            return () => un();
        }, [monthPath]);
        const saveFees = (next) => { setFees(next); return queuedSet(db.doc(feesPath), { fees: next }); };
        const savePays = (next) => { setPays(next); return queuedSet(db.doc(monthPath), { payments: next }); };
        return { enabled, fees, pays, ready: feesOk && paysOk, slow, failed, saveFees, savePays };
    }
    /* Classes taken, one private document per month: { taken: [{ id, studentId, date, slot? }] } */
    function useAttendance(db, userId, month) {
        const path = db && userId ? "data/users/" + userId + "/money/attendance/" + month : "";
        const [taken, setTaken] = useState([]);
        const [ready, setReady] = useState(false);
        useEffect(() => {
            if (!path)
                return undefined;
            setTaken([]);
            setReady(false);
            let un = () => { };
            try {
                un = db.doc(path).onSnapshot((s) => {
                    const d = s.exists ? s.data() : null;
                    setTaken(d && Array.isArray(d.taken) ? d.taken : []);
                    setReady(true);
                }, () => { });
            }
            catch (e) { /* attendance unavailable */ }
            return () => un();
        }, [path]);
        const save = (next) => { setTaken(next); return queuedSet(db.doc(path), { taken: next }); };
        return { on: !!path, ready, taken, save };
    }
    /* Where a class happened, and how much of the fee goes to that place. */
    function placeOfTaken(x, schedule, changes) {
        if (typeof x.place === "string")
            return x.place;
        let s = schedule.find((y) => y.id === x.slot);
        if (!s) {
            const c = changes.find((y) => y.id === x.slot);
            if (c)
                s = schedule.find((y) => y.id === c.slot);
        }
        return placeName(s);
    }
    function shareSplit(r, takenList, ctx) {
        const map = {};
        arr(ctx && ctx.places).forEach((p) => { map[placeKey(p.name)] = Number(p.pct) || 0; });
        const schedule = arr(ctx && ctx.schedule), changes = arr(ctx && ctx.changes);
        const out = {};
        const add = (p, w) => { const v = ((map[placeKey(p)] || 0) * w) / 100; if (v > 0)
            out[p] = (out[p] || 0) + v; };
        if (takenList.length)
            takenList.forEach((x) => add(placeOfTaken(x, schedule, changes), 1 / takenList.length));
        else {
            const slots = schedule.filter((s) => s.group === r.group);
            slots.forEach((s) => add(placeName(s), 1 / slots.length));
        }
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
        if (!Object.keys(split).length && legacyShare)
            split.Venue = legacyShare / 100;
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
    const SITE_URL = (() => { try {
        return window.location.origin + window.location.pathname.replace(/index\.html$/, "");
    }
    catch (e) {
        return "";
    } })();
    const SITE_HOST = (() => { try {
        return window.location.host || "brightmindsci.github.io";
    }
    catch (e) {
        return "brightmindsci.github.io";
    } })();
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
        const mine = lessons.filter((l) => (l.date || "").startsWith(month) && forGroup(l.group, r.group)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const hw = mine.filter((l) => l.homework).length;
        const lists = decks.filter((d) => forGroup(d.group, r.group) && d.cards.length);
        const lines = [fr ? `Bright Minds : bilan de ${m} pour ${r.name}` : `Bright Minds: ${m} report for ${r.name}`, ""];
        const count = r.classes ? (fr ? `${r.used} sur ${r.classes}` : `${r.used} of ${r.classes}`) : String(r.used);
        lines.push((fr ? "Cours suivis : " : "Classes attended: ") + count + (dates.length ? ` (${dates.join(", ")})` : ""));
        if (mine.length)
            lines.push((fr ? "Leçons : " : "Lessons: ") + mine.map((l) => l.title).join("; "));
        if (hw)
            lines.push((fr ? "Devoirs donnés : " : "Homework given: ") + hw);
        if (lists.length)
            lines.push((fr ? "Vocabulaire à réviser dans l'application : " : "Words to practice in the app: ") + lists.map((d) => `${d.title} (${d.cards.length})`).join(", "));
        if (comment.trim())
            lines.push("", comment.trim());
        lines.push("", fr ? "Merci pour votre confiance !" : "Thank you for your trust!");
        return lines.join("\n");
    }
    /* ---------- icons ---------- */
    const ICONS = {
        book: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" }),
            React.createElement("path", { d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" })),
        clipboard: React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "8", height: "4", x: "8", y: "2", rx: "1" }),
            React.createElement("path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }),
            React.createElement("path", { d: "m9 14 2 2 4-4" })),
        calendar: React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }),
            React.createElement("path", { d: "M16 2v4" }),
            React.createElement("path", { d: "M8 2v4" }),
            React.createElement("path", { d: "M3 10h18" }),
            React.createElement("path", { d: "M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" })),
        users: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
            React.createElement("circle", { cx: "9", cy: "7", r: "4" }),
            React.createElement("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }),
            React.createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })),
        volume: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M11 5 6 9H2v6h4l5 4z" }),
            React.createElement("path", { d: "M15.54 8.46a5 5 0 0 1 0 7.07" }),
            React.createElement("path", { d: "M19.07 4.93a10 10 0 0 1 0 14.14" })),
        shuffle: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" }),
            React.createElement("path", { d: "m18 2 4 4-4 4" }),
            React.createElement("path", { d: "M2 6h1.9c1.5 0 2.9.9 3.6 2.2" }),
            React.createElement("path", { d: "M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" }),
            React.createElement("path", { d: "m18 14 4 4-4 4" })),
        left: React.createElement("path", { d: "m15 18-6-6 6-6" }),
        right: React.createElement("path", { d: "m9 18 6-6-6-6" }),
        plus: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M5 12h14" }),
            React.createElement("path", { d: "M12 5v14" })),
        trash: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M3 6h18" }),
            React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }),
            React.createElement("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
            React.createElement("path", { d: "M10 11v6M14 11v6" })),
        check: React.createElement("path", { d: "M20 6 9 17l-5-5" }),
        x: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M18 6 6 18" }),
            React.createElement("path", { d: "m6 6 12 12" })),
        again: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }),
            React.createElement("path", { d: "M3 3v5h5" })),
        wallet: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" }),
            React.createElement("path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" })),
        pencil: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }),
            React.createElement("path", { d: "m15 5 4 4" })),
        megaphone: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "m3 11 18-5v12L3 14v-3z" }),
            React.createElement("path", { d: "M11.6 16.8a3 3 0 1 1-5.8-1.6" })),
        video: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 10.5" }),
            React.createElement("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" })),
        chat: React.createElement("path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }),
        spark: React.createElement("path", { d: "M9.9 15.5A2 2 0 0 0 8.5 14.1l-6.1-1.6a.5.5 0 0 1 0-1l6.1-1.6a2 2 0 0 0 1.4-1.4l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z" }),
        briefcase: React.createElement(React.Fragment, null,
            React.createElement("rect", { width: "20", height: "14", x: "2", y: "7", rx: "2" }),
            React.createElement("path", { d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" })),
        mic: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }),
            React.createElement("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
            React.createElement("path", { d: "M12 19v3" })),
        star: React.createElement("path", { d: "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z" }),
        stop: React.createElement("rect", { width: "12", height: "12", x: "6", y: "6", rx: "2" }),
        play: React.createElement("path", { d: "M7 4.5v15l12-7.5z" }),
        award: React.createElement(React.Fragment, null,
            React.createElement("circle", { cx: "12", cy: "8", r: "6" }),
            React.createElement("path", { d: "M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" })),
        report: React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }),
            React.createElement("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }),
            React.createElement("path", { d: "M10 9H8M16 13H8M16 17H8" })),
    };
    function Icon({ name, size = 18, label }) {
        return (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": label ? undefined : "true", role: label ? "img" : undefined, "aria-label": label, focusable: "false" }, ICONS[name]));
    }
    /* ---------- small pieces ---------- */
    function Field({ label, children }) {
        return React.createElement("label", { className: "field" },
            React.createElement("span", null, label),
            children);
    }
    function Empty({ text, children }) {
        return React.createElement("div", { className: "empty" },
            React.createElement("p", null, text),
            children);
    }
    function ConfirmButton({ onConfirm, label = "Delete", iconOnly = false }) {
        const [armed, setArmed] = useState(false);
        useEffect(() => { if (!armed)
            return undefined; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
        return (React.createElement("button", { type: "button", className: "btn ghost sm danger" + (armed ? " armed" : ""), "aria-label": iconOnly && !armed ? label : undefined, onClick: () => { if (armed) {
                setArmed(false);
                onConfirm();
            }
            else
                setArmed(true); } }, armed ? (iconOnly ? "Delete?" : "Tap again to delete") : React.createElement(React.Fragment, null,
            React.createElement(Icon, { name: "trash", size: 15 }),
            !iconOnly && label)));
    }
    function CopyButton({ text, label, caption }) {
        const { t } = useT();
        const [state, setState] = useState("");
        const copy = () => {
            const show = (s) => { setState(s); setTimeout(() => setState(""), 2500); };
            try {
                navigator.clipboard.writeText(text).then(() => show(t("copied")), () => show(t("holdCopy")));
            }
            catch (e) {
                show(t("holdCopy"));
            }
        };
        return React.createElement("button", { type: "button", className: "btn ghost sm", onClick: copy, "aria-label": label }, state || caption || t("copy"));
    }
    function WaButton({ phone, text, children, ghost = false }) {
        return (React.createElement("a", { className: "btn sm" + (ghost ? " ghost" : ""), href: waLink(phone, text), target: "_blank", rel: "noopener noreferrer" },
            React.createElement(Icon, { name: "chat", size: 16 }),
            children));
    }
    /* ---------- welcome ---------- */
    /* ---------- putting the site on the Home Screen, like an app ---------- */
    const deviceKind = () => {
        const ua = navigator.userAgent || "";
        if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
            return "ios";
        return /Android/i.test(ua) ? "android" : "other";
    };
    const isHomeScreenApp = () => {
        try {
            return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
        }
        catch (e) {
            return false;
        }
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
            if (!e)
                return;
            installEvt = null;
            try {
                await e.prompt();
                await e.userChoice;
            }
            catch (err) { /* the phone shows its own message */ }
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
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "day-name" }, t("installWhich")),
            React.createElement("div", { className: "seg install-seg" },
                React.createElement("button", { "aria-pressed": os === "ios", onClick: () => setOs("ios") }, t("installIphone")),
                React.createElement("button", { "aria-pressed": os === "android", onClick: () => setOs("android") }, t("installAndroid"))),
            os === "android" && ip.can && (React.createElement("div", { className: "lib-use" },
                React.createElement("button", { className: "btn", onClick: ip.run }, t("installNow")),
                React.createElement("p", { className: "hint" }, t("installOr")))),
            React.createElement("ol", { className: "install-steps" }, steps.map((step, k) => React.createElement("li", { key: os + k },
                React.createElement("span", { className: "step-n", "aria-hidden": "true" }, k + 1),
                React.createElement("span", null, mdInline(step, os + k))))),
            React.createElement("p", { className: "note" }, t("installAfter"))));
    }
    function InstallPage({ onBack, onLang }) {
        const { t } = useT();
        const link = SITE_URL + "#install";
        return (React.createElement("div", { className: "welcome" },
            React.createElement("div", { className: "welcome-lang between" },
                React.createElement("button", { className: "link", onClick: onBack }, t("back")),
                React.createElement("button", { className: "link", onClick: onLang, "aria-label": t("otherLangName") }, t("otherLang"))),
            React.createElement("img", { src: "icon-192.png", alt: "", width: "64", height: "64", className: "install-icon big" }),
            React.createElement("h1", { className: "install-h" }, t("installTitle")),
            isHomeScreenApp() ? React.createElement("p", { className: "note" }, t("installDone")) : React.createElement("p", { className: "hint" }, t("installLead")),
            React.createElement(InstallGuide, null),
            React.createElement("div", { className: "day-block" },
                React.createElement("p", { className: "day-name" }, t("installShare")),
                React.createElement("p", { className: "install-link" }, link),
                React.createElement("div", { className: "pay-actions" },
                    React.createElement("a", { className: "btn sm", href: "https://wa.me/?text=" + encodeURIComponent(t("installWaText", link)), target: "_blank", rel: "noopener noreferrer" },
                        React.createElement(Icon, { name: "chat", size: 16 }),
                        t("installWa")),
                    React.createElement(CopyButton, { text: link, label: t("installCopy"), caption: t("installCopy") })))));
    }
    function InstallCard({ onHide }) {
        const { t } = useT();
        const ip = useInstallPrompt();
        if (isHomeScreenApp())
            return null;
        return (React.createElement("div", { className: "install-card" },
            React.createElement("img", { src: "icon-192.png", alt: "", width: "44", height: "44", className: "install-icon" }),
            React.createElement("div", { className: "install-text" },
                React.createElement("p", { className: "install-card-title" }, t("installTitle")),
                React.createElement("p", { className: "hint" }, t("installLead")),
                React.createElement("div", { className: "pay-actions" },
                    ip.can ? React.createElement("button", { className: "btn sm", onClick: ip.run }, t("installNow")) : React.createElement("button", { className: "btn sm", onClick: openInstall }, t("installShow")),
                    ip.can && React.createElement("button", { className: "btn ghost sm", onClick: openInstall }, t("installShow")),
                    onHide && React.createElement("button", { className: "btn ghost sm", onClick: onHide }, t("installNotNow"))))));
    }
    function Welcome({ canTeach, signedIn, notTeacher, onStudent, onTeacher, onSignIn, onSignOut, onLang, onJoin }) {
        const { t } = useT();
        const [code, setCode] = useState("");
        const [err, setErr] = useState("");
        const [busy, setBusy] = useState(false);
        const open = async () => {
            if (code.length < 4) {
                setErr(t("codeShort"));
                return;
            }
            setBusy(true);
            setErr("");
            try {
                const s = await FB.db.doc("students/" + code).get();
                if (s.exists)
                    onStudent(Object.assign(Object.assign({}, s.data()), { code }));
                else
                    setErr(t("codeWrong"));
            }
            catch (e) {
                setErr(t("codeOffline"));
            }
            setBusy(false);
        };
        return (React.createElement("div", { className: "welcome" },
            React.createElement("div", { className: "welcome-lang" },
                React.createElement("button", { className: "link", onClick: onLang, "aria-label": t("otherLangName") }, t("otherLang"))),
            React.createElement("div", { className: "seyes welcome-page" },
                React.createElement("h1", { className: "welcome-title" }, "Bright Minds"),
                React.createElement("p", { className: "welcome-sub" }, t("tagline"))),
            React.createElement("h2", { className: "h" }, t("enterCode")),
            React.createElement("p", { className: "hint" }, t("codeHint")),
            React.createElement("div", { className: "inline-add" },
                React.createElement("input", { id: "my-code", className: "inp code-inp", type: "text", inputMode: "numeric", autoComplete: "off", maxLength: 4, "aria-label": t("yourCode"), value: code, onChange: (e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }, onKeyDown: (e) => e.key === "Enter" && open() }),
                React.createElement("button", { className: "btn", onClick: open, disabled: !code || busy }, t("open"))),
            err && React.createElement("p", { className: "err", role: "alert" }, err),
            React.createElement("div", { className: "stack", style: { marginTop: 8 } },
                React.createElement("button", { className: "btn ghost", onClick: onJoin }, t("seeClasses")),
                React.createElement("button", { className: "btn ghost", onClick: () => onStudent(null) }, t("noCode")),
                canTeach && React.createElement("button", { className: "btn", onClick: onTeacher }, "Open teacher view")),
            React.createElement(InstallCard, null),
            React.createElement("div", { className: "teacher-link" }, notTeacher
                ? React.createElement("p", { className: "hint" },
                    notTeacher,
                    " isn't the teacher account. ",
                    React.createElement("button", { className: "link", onClick: onSignOut }, "Sign out"))
                : !signedIn && React.createElement("button", { className: "link small", onClick: onSignIn }, t("teacherSignIn")))));
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
            for (let j = 1; j <= n; j++)
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = cur;
        }
        return prev[n];
    }
    function sameSaid(heard, target) {
        const h = normSay(heard), w = normSay(target);
        if (!h || !w)
            return false;
        if (h === w || (" " + h + " ").includes(" " + w + " "))
            return true;
        if (w.includes(" ") && w.includes(h) && h.length >= w.length * 0.7)
            return true;
        return editDistance(h, w) <= Math.max(1, Math.floor(w.length * 0.25));
    }
    const canSay = (text) => !!text && !/_{2,}/.test(text) && /[a-z]/i.test(text);
    function pickMime() {
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported)
            return "";
        return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((m) => { try {
            return MediaRecorder.isTypeSupported(m);
        }
        catch (e) {
            return false;
        } }) || "";
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
        const setUrlSafe = (u) => { if (r.current.url)
            URL.revokeObjectURL(r.current.url); r.current.url = u; setUrl(u); };
        const release = () => { const x = r.current; clearInterval(x.timer); if (x.stream)
            x.stream.getTracks().forEach((tr) => tr.stop()); x.stream = null; };
        useEffect(() => () => {
            const x = r.current;
            if (x.mr && x.mr.state !== "inactive") {
                x.mr.onstop = null;
                try {
                    x.mr.stop();
                }
                catch (e) { /* already stopped */ }
            }
            release();
            if (x.url)
                URL.revokeObjectURL(x.url);
        }, []);
        const start = async () => {
            setError("");
            try {
                if (canSpeak)
                    window.speechSynthesis.cancel();
            }
            catch (e) { /* nothing playing */ }
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            catch (e) {
                setError(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? t("micBlocked") : t("micNo"));
                return;
            }
            const mime = pickMime();
            let mr;
            try {
                mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
            }
            catch (e) {
                try {
                    mr = new MediaRecorder(stream);
                }
                catch (e2) {
                    stream.getTracks().forEach((x) => x.stop());
                    setError(t("micNo"));
                    return;
                }
            }
            const chunks = [];
            mr.ondataavailable = (e) => { if (e.data && e.data.size)
                chunks.push(e.data); };
            mr.onstop = () => {
                const took = Math.max(1, Math.round((Date.now() - r.current.t0) / 1000));
                release();
                const b = new Blob(chunks, { type: (mr.mimeType || mime || "audio/webm").split(";")[0] });
                if (!b.size) {
                    setState("idle");
                    setError(t("micNothing"));
                    return;
                }
                setBlob(b);
                setSecs(Math.min(took, maxSecs));
                setUrlSafe(URL.createObjectURL(b));
                setState("done");
            };
            r.current.mr = mr;
            r.current.stream = stream;
            r.current.t0 = Date.now();
            mr.start(1000);
            setBlob(null);
            setSecs(0);
            setState("recording");
            r.current.timer = setInterval(() => {
                const s = Math.floor((Date.now() - r.current.t0) / 1000);
                setSecs(s);
                if (s >= maxSecs && mr.state !== "inactive") {
                    try {
                        mr.stop();
                    }
                    catch (e) { /* stopped */ }
                }
            }, 250);
        };
        const stop = () => { const mr = r.current.mr; if (mr && mr.state !== "inactive") {
            try {
                mr.stop();
            }
            catch (e) { /* stopped */ }
        } };
        const play = () => {
            if (!r.current.url)
                return;
            try {
                if (!r.current.audio)
                    r.current.audio = new Audio();
                r.current.audio.src = r.current.url;
                r.current.audio.play().catch(() => { });
            }
            catch (e) { /* can't play */ }
        };
        const reset = () => { setBlob(null); setUrlSafe(""); setState("idle"); setSecs(0); setError(""); };
        return { state, secs, blob, url, error, start, stop, play, reset };
    }
    /* Where the phone can't recognise speech: record yourself and compare. */
    function RecordCompare({ text }) {
        const { t } = useT();
        const rec = useRecorder(8);
        if (!canRecord)
            return null;
        return (React.createElement("div", { className: "say-it" },
            React.createElement("div", { className: "say-row" },
                rec.state === "recording"
                    ? React.createElement("button", { className: "btn sm rec", onClick: rec.stop },
                        React.createElement(Icon, { name: "stop", size: 15 }),
                        t("stopRec"),
                        " ",
                        mmss(rec.secs))
                    : React.createElement("button", { className: "btn ghost sm", onClick: rec.start },
                        React.createElement(Icon, { name: "mic", size: 16 }),
                        rec.url ? t("recordAgain") : t("recordMe")),
                rec.url && rec.state !== "recording" && React.createElement("button", { className: "btn ghost sm", onClick: rec.play },
                    React.createElement(Icon, { name: "play", size: 15 }),
                    t("playMine")),
                rec.url && rec.state !== "recording" && canSpeak && React.createElement("button", { className: "btn ghost sm", onClick: () => speak(text) },
                    React.createElement(Icon, { name: "volume", size: 15 }),
                    t("hearModel"))),
            rec.error ? React.createElement("p", { className: "say-result error", role: "alert" }, rec.error) : rec.url && React.createElement("p", { className: "hint" }, t("compareHint"))));
    }
    /* "Say it": listens once, then says whether it understood. */
    function SayIt({ text, compact = false }) {
        const { t } = useT();
        const [state, setState] = useState("idle");
        const [heard, setHeard] = useState("");
        const [err, setErr] = useState("");
        const recRef = useRef(null);
        useEffect(() => () => { try {
            if (recRef.current)
                recRef.current.abort();
        }
        catch (e) { /* stopped */ } }, []);
        useEffect(() => { setState("idle"); setHeard(""); setErr(""); }, [text]);
        if (!canSay(text))
            return null;
        if (!SpeechRec)
            return compact ? null : React.createElement(RecordCompare, { text: text });
        const start = () => {
            try {
                if (canSpeak)
                    window.speechSynthesis.cancel();
            }
            catch (e) { /* nothing playing */ }
            let r;
            try {
                r = new SpeechRec();
            }
            catch (e) {
                setState("error");
                setErr(t("micNo"));
                return;
            }
            recRef.current = r;
            r.lang = "en-US";
            r.interimResults = false;
            r.maxAlternatives = 5;
            r.continuous = false;
            let got = false;
            r.onresult = (e) => {
                got = true;
                const alts = [];
                for (let i = 0; i < e.results.length; i++)
                    for (let j = 0; j < e.results[i].length; j++)
                        alts.push(e.results[i][j].transcript);
                const hit = alts.find((a) => sameSaid(a, text));
                setHeard(String(hit || alts[0] || "").trim());
                setState(hit ? "good" : "again");
            };
            r.onerror = (e) => {
                got = true;
                setState("error");
                setErr(e.error === "not-allowed" || e.error === "service-not-allowed" ? t("micBlocked") : e.error === "no-speech" ? t("micNothing") : t("micNo"));
            };
            r.onend = () => { if (!got) {
                setState("error");
                setErr(t("micNothing"));
            } };
            setState("listening");
            setHeard("");
            setErr("");
            try {
                r.start();
            }
            catch (e) {
                setState("error");
                setErr(t("micNo"));
            }
        };
        const stop = () => { try {
            if (recRef.current)
                recRef.current.stop();
        }
        catch (e) { /* stopped */ } };
        const listening = state === "listening";
        const msg = listening ? t("speakNow") : state === "good" ? t("saidRight", heard) : state === "again" ? t("saidWrong", heard) : state === "error" ? err : "";
        if (compact) {
            return (React.createElement("span", { className: "say-compact" },
                React.createElement("button", { className: "icon-btn" + (listening ? " listening" : ""), "aria-label": listening ? t("listening") : t("sayItAria", text), onClick: listening ? stop : start },
                    React.createElement(Icon, { name: "mic", size: 17 })),
                React.createElement("span", { className: "say-mark " + state, role: "status", "aria-label": msg }, state === "good" ? React.createElement(Icon, { name: "check", size: 16 }) : state === "again" || state === "error" ? React.createElement(Icon, { name: "again", size: 15 }) : null)));
        }
        return (React.createElement("div", { className: "say-it" },
            React.createElement("button", { className: "btn sm" + (listening ? " rec" : " ghost"), onClick: listening ? stop : start },
                React.createElement(Icon, { name: "mic", size: 16 }),
                listening ? t("listening") : t("sayIt")),
            msg && React.createElement("p", { className: "say-result " + state, role: "status" }, msg)));
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
            if (n + 1 >= rounds) {
                setN(rounds);
                return;
            }
            const r = makeRound(round.target.id);
            setRound(r);
            setN(n + 1);
            setWrong([]);
            setRight(false);
            speak(r.target.en);
        };
        const tap = (c) => {
            if (right)
                return;
            speak(c.en);
            if (c.id === round.target.id) {
                setRight(true);
                if (!wrong.length)
                    setStars((s) => s + 1);
            }
            else
                setWrong((w) => [...w, c.id]);
        };
        if (!started) {
            return (React.createElement("div", { className: "seyes game-start" },
                React.createElement("p", { className: "game-title" }, t("listenTitle")),
                React.createElement("p", { className: "muted" }, canSpeak ? t("listenHow") : t("listenHowRead")),
                React.createElement("button", { className: "btn", onClick: begin },
                    React.createElement(Icon, { name: "play", size: 16 }),
                    t("startGame"))));
        }
        if (n >= rounds) {
            return (React.createElement("div", null,
                React.createElement("div", { className: "seyes result" },
                    React.createElement("p", { className: "game-stars big", "aria-hidden": "true" }, Array.from({ length: Math.max(1, Math.round((stars / rounds) * 3)) }, (_, k) => React.createElement(Icon, { key: k, name: "star", size: 34 }))),
                    React.createElement("p", { className: "result-big" }, t("starsOf", stars, rounds))),
                React.createElement("button", { className: "btn", onClick: begin },
                    React.createElement(Icon, { name: "again", size: 16 }),
                    t("playAgain"))));
        }
        return (React.createElement("div", null,
            React.createElement("div", { className: "game-bar" },
                React.createElement("span", { className: "muted small" }, t("xOfY", n + 1, rounds)),
                React.createElement("span", { className: "game-stars", "aria-label": t("starsN", stars) }, Array.from({ length: stars }, (_, k) => React.createElement(Icon, { key: k, name: "star", size: 16 })))),
            React.createElement("div", { className: "seyes game-ask" },
                canSpeak
                    ? React.createElement("button", { className: "btn ghost", onClick: () => speak(round.target.en) },
                        React.createElement(Icon, { name: "volume", size: 18 }),
                        t("hearAgain"))
                    : React.createElement("span", { className: "face-word" }, round.target.en),
                React.createElement("span", { className: "face-hint" }, t("tapPicture"))),
            React.createElement("div", { className: "pic-grid" }, round.options.map((c, k) => {
                const isR = right && c.id === round.target.id;
                const isW = wrong.includes(c.id);
                return (React.createElement("button", { key: c.id, className: "pic-opt" + (isR ? " right" : "") + (isW ? " wrong" : ""), onClick: () => tap(c), disabled: isW || right, "aria-label": isR || isW ? c.en : t("pictureN", k + 1) },
                    React.createElement("span", { className: "pic-big", "aria-hidden": "true" }, c.pic),
                    (isR || isW) && React.createElement("span", { className: "pic-word" }, c.en)));
            })),
            right && (React.createElement("div", { className: "feedback" },
                React.createElement("p", { className: "verdict", role: "status" }, wrong.length ? t("gotIt") : t("yesStar")),
                React.createElement("button", { className: "btn", onClick: next }, n + 1 < rounds ? t("nextQ") : t("seeScore"))))));
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
            if (busy.current || open.includes(tile.key) || found.includes(tile.id))
                return;
            speak(tile.c.en);
            if (!open.length) {
                setOpen([tile.key]);
                return;
            }
            const first = tiles.find((x) => x.key === open[0]);
            setMoves((m) => m + 1);
            if (first && first.id === tile.id) {
                setFound((f) => [...f, tile.id]);
                setOpen([]);
                return;
            }
            setOpen([open[0], tile.key]);
            busy.current = true;
            setTimeout(() => { setOpen([]); busy.current = false; }, 1100);
        };
        const restart = () => { setTiles(deal()); setOpen([]); setFound([]); setMoves(0); };
        const won = found.length === pairs;
        const starsWon = moves <= pairs + 2 ? 3 : moves <= pairs * 2 ? 2 : 1;
        return (React.createElement("div", null,
            React.createElement("div", { className: "game-bar" },
                React.createElement("span", { className: "muted small" }, t("pairsFound", found.length, pairs)),
                React.createElement("span", { className: "muted small" }, t("movesN", moves))),
            won && (React.createElement("div", { className: "seyes result" },
                React.createElement("p", { className: "game-stars big", "aria-hidden": "true" }, Array.from({ length: starsWon }, (_, k) => React.createElement(Icon, { key: k, name: "star", size: 34 }))),
                React.createElement("p", { className: "result-big", role: "status" }, t("allPairs", moves)))),
            React.createElement("div", { className: "mem-grid" }, tiles.map((x, k) => {
                const shown = open.includes(x.key) || found.includes(x.id);
                return (React.createElement("button", { key: x.key, className: "mem-tile" + (shown ? " shown" : "") + (found.includes(x.id) ? " found" : ""), onClick: () => flip(x), "aria-label": shown ? x.c.en : t("cardN", k + 1), "aria-pressed": shown }, shown ? (x.kind === "pic" ? React.createElement("span", { className: "pic-mid", "aria-hidden": "true" }, x.c.pic) : React.createElement("span", { className: "mem-word" }, x.c.en)) : React.createElement("span", { className: "mem-back", "aria-hidden": "true" }, "?")));
            })),
            won ? React.createElement("button", { className: "btn", onClick: restart },
                React.createElement(Icon, { name: "again", size: 16 }),
                t("playAgain")) : React.createElement("p", { className: "hint" }, t("memoryHow"))));
    }
    function Flashcards({ cards }) {
        const { t } = useT();
        const [order, setOrder] = useState(() => cards.map((_, k) => k));
        const [i, setI] = useState(0);
        const [flipped, setFlipped] = useState(false);
        useEffect(() => { setOrder(cards.map((_, k) => k)); setI(0); setFlipped(false); }, [cards.length]);
        const card = cards[order[i]] || cards[0];
        if (!card)
            return null;
        const go = (d) => { setFlipped(false); setI((x) => (x + d + order.length) % order.length); };
        const mix = () => { setOrder(shuffle(cards.map((_, k) => k))); setI(0); setFlipped(false); };
        const sayExample = flipped && card.ex;
        return (React.createElement("div", null,
            React.createElement("div", { key: order[i], className: "flip" + (flipped ? " is-flipped" : "") },
                React.createElement("button", { type: "button", className: "flip-inner", onClick: () => setFlipped((f) => !f), "aria-label": flipped ? t("ariaBack", card.fr) : t("ariaFront", card.en) },
                    React.createElement("span", { className: "face seyes face-front" },
                        card.pic && React.createElement("span", { className: "face-pic", "aria-hidden": "true" }, card.pic),
                        React.createElement("span", { className: "face-word" }, card.en),
                        React.createElement("span", { className: "face-hint" }, t("tapMeaning"))),
                    React.createElement("span", { className: "face seyes face-back" },
                        card.pic && React.createElement("span", { className: "face-pic small", "aria-hidden": "true" }, card.pic),
                        React.createElement("span", { className: "face-word" }, card.fr),
                        card.ex && React.createElement("span", { className: "face-ex" }, card.ex)))),
            React.createElement("div", { className: "card-tools" },
                React.createElement("span", { className: "muted small" }, t("xOfY", i + 1, order.length)),
                canSpeak && (React.createElement("button", { className: "btn ghost sm", onClick: () => speak(sayExample ? card.ex : card.en) },
                    React.createElement(Icon, { name: "volume", size: 16 }),
                    sayExample ? t("hearSentence") : t("hearWord")))),
            React.createElement(SayIt, { text: card.en }),
            React.createElement("div", { className: "card-nav" },
                React.createElement("button", { className: "btn ghost", onClick: () => go(-1) },
                    React.createElement(Icon, { name: "left" }),
                    t("back")),
                React.createElement("button", { className: "btn ghost", onClick: mix },
                    React.createElement(Icon, { name: "shuffle", size: 16 }),
                    t("mix")),
                React.createElement("button", { className: "btn", onClick: () => go(1) },
                    t("next"),
                    React.createElement(Icon, { name: "right" })))));
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
        if (cards.length < 4)
            return React.createElement(Empty, { text: t("quizMin") });
        if (idx >= qs.length) {
            const total = qs.length;
            const msg = score === total ? t("perfect") : score / total >= 0.7 ? t("great") : t("practiceMore");
            return (React.createElement("div", null,
                React.createElement("div", { className: "seyes result" },
                    React.createElement("p", { className: "muted" }, t("yourScore")),
                    React.createElement("p", { className: "result-big" }, t("xOfY", score, total)),
                    React.createElement("p", null, msg),
                    newBest ? React.createElement("p", { className: "new-best" }, t("newBest")) : best && React.createElement("p", { className: "muted small", style: { marginTop: 4 } }, t("best", best.score, best.total))),
                React.createElement("button", { className: "btn", onClick: restart },
                    React.createElement(Icon, { name: "again", size: 16 }),
                    t("tryAgain"))));
        }
        const q = qs[idx];
        const pick = (o) => { if (picked !== null)
            return; setPicked(o); if (o === q.answer)
            setScore((s) => s + 1); };
        const next = () => {
            const n = idx + 1;
            if (n >= qs.length && score > 0 && (!best || score / qs.length > best.score / best.total)) {
                const b = { score, total: qs.length };
                setBest(b);
                setNewBest(true);
                ls.set("bm:best", Object.assign(Object.assign({}, (ls.get("bm:best", {}) || {})), { [deck.id]: b }));
            }
            setPicked(null);
            setIdx(n);
        };
        return (React.createElement("div", null,
            React.createElement("p", { className: "muted small", style: { marginBottom: 8 } }, t("questionN", idx + 1, qs.length)),
            React.createElement("div", { className: "seyes q-prompt" },
                React.createElement("span", { className: "face-hint" }, q.dir === "en" ? t("whatMeans") : t("howSay")),
                q.pic && React.createElement("span", { className: "face-pic small", "aria-hidden": "true" }, q.pic),
                React.createElement("span", { className: "face-word" }, q.prompt)),
            React.createElement("div", { className: "options" }, q.options.map((o) => {
                const isRight = picked !== null && o === q.answer;
                const isWrong = picked !== null && o === picked && o !== q.answer;
                return (React.createElement("button", { key: o, className: "opt" + (isRight ? " right" : "") + (isWrong ? " wrong" : ""), disabled: picked !== null, onClick: () => pick(o) },
                    React.createElement("span", null, o),
                    isRight && React.createElement(Icon, { name: "check", size: 20, label: t("correctAnswer") }),
                    isWrong && React.createElement(Icon, { name: "x", size: 20, label: t("yourAnswer") })));
            })),
            picked !== null && (React.createElement("p", { className: "verdict", role: "status" }, picked === q.answer ? t("correct") : React.createElement(React.Fragment, null,
                t("notQuite"),
                React.createElement("strong", null, q.answer),
                "."))),
            React.createElement("div", { className: "feedback" },
                canSpeak && (q.dir === "en" || picked !== null) && (React.createElement("button", { className: "btn ghost sm", onClick: () => speak(q.en) },
                    React.createElement(Icon, { name: "volume", size: 16 }),
                    t("hearWord"))),
                picked !== null && React.createElement("button", { className: "btn", onClick: next }, idx + 1 < qs.length ? t("nextQ") : t("seeScore")))));
    }
    function Study({ deck, onBack, backLabel }) {
        const { t } = useT();
        const [mode, setMode] = useState("cards");
        const games = deck.cards.filter((c) => c.pic).length >= 4;
        return (React.createElement("section", null,
            React.createElement("button", { className: "back-link", onClick: onBack },
                React.createElement(Icon, { name: "left" }),
                backLabel || t("allLists")),
            React.createElement("h2", { className: "h" }, deck.title),
            React.createElement("div", { className: "seg" },
                React.createElement("button", { "aria-pressed": mode === "cards", onClick: () => setMode("cards") }, games ? t("cardsShort") : t("flashcards")),
                React.createElement("button", { "aria-pressed": mode === "quiz", onClick: () => setMode("quiz") }, t("quiz")),
                games && React.createElement("button", { "aria-pressed": mode === "listen", onClick: () => setMode("listen") }, t("listenGame")),
                games && React.createElement("button", { "aria-pressed": mode === "memory", onClick: () => setMode("memory") }, t("memoryGame"))),
            deck.cards.length === 0 ? React.createElement(Empty, { text: t("emptyList") })
                : mode === "listen" && games ? React.createElement(ListenTap, { key: deck.id, deck: deck })
                    : mode === "memory" && games ? React.createElement(Memory, { key: deck.id, deck: deck })
                        : mode === "quiz" ? React.createElement(Quiz, { deck: deck }) : React.createElement(Flashcards, { cards: deck.cards })));
    }
    function WordsStudent({ decks, me }) {
        const { t, lang } = useT();
        const [openId, setOpenId] = useState(null);
        const visible = decks.filter((d) => forGroup(d.group, me.group));
        const deck = decks.find((d) => d.id === openId);
        if (deck)
            return React.createElement(Study, { deck: deck, onBack: () => setOpenId(null) });
        return (React.createElement("section", null,
            React.createElement("h2", { className: "h" }, t("words")),
            me.level && React.createElement("p", { className: "level-chip" }, t("yourLevel", levelName(me.level, lang))),
            visible.length === 0 ? React.createElement(Empty, { text: t("noLists") }) : (React.createElement("ul", { className: "rows" }, visible.map((d) => (React.createElement("li", { key: d.id },
                React.createElement("button", { className: "row-btn", onClick: () => setOpenId(d.id) },
                    React.createElement("span", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, d.title),
                        React.createElement("span", { className: "row-sub" }, t("nWords", d.cards.length))),
                    React.createElement(Icon, { name: "right" })))))))));
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
        const saveTitle = () => { const t = title.trim(); if (t && t !== deck.title)
            onChange(Object.assign(Object.assign({}, deck), { title: t }));
        else
            setTitle(deck.title); };
        const addCard = () => {
            if (!en.trim() || !fr.trim())
                return;
            const card = { id: uid(), en: en.trim(), fr: fr.trim(), ex: ex.trim() };
            if (pic.trim())
                card.pic = pic.trim().slice(0, 16);
            onChange(Object.assign(Object.assign({}, deck), { cards: [...deck.cards, card] }));
            setEn("");
            setFr("");
            setEx("");
            setPic("");
            if (enRef.current)
                enRef.current.focus();
        };
        const addBulk = () => { if (!parsed.length)
            return; onChange(Object.assign(Object.assign({}, deck), { cards: [...deck.cards, ...parsed] })); setBulk(""); setShowBulk(false); };
        const enter = (e) => { if (e.key === "Enter")
            addCard(); };
        return (React.createElement("section", null,
            React.createElement("button", { className: "back-link", onClick: onBack },
                React.createElement(Icon, { name: "left" }),
                "All lists"),
            React.createElement(Field, { label: "List name" },
                React.createElement("input", { id: "deck-title", className: "inp", value: title, onChange: (e) => setTitle(e.target.value), onBlur: saveTitle })),
            React.createElement(Field, { label: "Who sees it" },
                React.createElement("select", { id: "deck-group", className: "inp", value: current, onChange: (e) => onChange(Object.assign(Object.assign({}, deck), { group: e.target.value })) }, opts.map((g) => React.createElement("option", { key: g, value: g }, g)))),
            React.createElement("div", { className: "form-actions", style: { marginBottom: 20 } },
                React.createElement("button", { className: "btn", onClick: onPractice, disabled: !deck.cards.length }, "Practice this list"),
                React.createElement(ConfirmButton, { label: "Delete list", onConfirm: onDelete })),
            React.createElement("div", { className: "form" },
                React.createElement("p", { className: "form-title" }, "Add a word"),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "English" },
                        React.createElement("input", { id: "word-en", ref: enRef, className: "inp", value: en, placeholder: "window", onChange: (e) => setEn(e.target.value), onKeyDown: enter })),
                    React.createElement(Field, { label: "French" },
                        React.createElement("input", { id: "word-fr", className: "inp", value: fr, placeholder: "la fen\u00EAtre", onChange: (e) => setFr(e.target.value), onKeyDown: enter }))),
                React.createElement(Field, { label: "Example sentence (optional)" },
                    React.createElement("input", { id: "word-ex", className: "inp", value: ex, placeholder: "Open the window, please.", onChange: (e) => setEx(e.target.value), onKeyDown: enter })),
                React.createElement(Field, { label: "Picture (optional): one emoji, like \uD83C\uDF4E" },
                    React.createElement("input", { id: "word-pic", className: "inp pic-inp", value: pic, placeholder: "\uD83E\uDE9F", maxLength: 16, onChange: (e) => setPic(e.target.value), onKeyDown: enter }),
                    React.createElement("span", { className: "hint" }, "Use your phone's emoji keyboard. Lists with 4 or more pictures get the kids' games.")),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn", onClick: addCard, disabled: !en.trim() || !fr.trim() },
                        React.createElement(Icon, { name: "plus", size: 16 }),
                        "Add word"),
                    React.createElement("button", { className: "btn ghost", onClick: () => setShowBulk((s) => !s) }, showBulk ? "Hide paste box" : "Paste many words")),
                showBulk && (React.createElement("div", { style: { marginTop: 16 } },
                    React.createElement(Field, { label: "One word per line: English = French | example | picture" },
                        React.createElement("textarea", { id: "word-bulk", className: "inp", rows: 5, value: bulk, onChange: (e) => setBulk(e.target.value), placeholder: "pencil = le crayon | I write with a pencil. | ✏️\nruler = la règle" })),
                    React.createElement("button", { className: "btn", onClick: addBulk, disabled: !parsed.length },
                        "Add ",
                        parsed.length,
                        " ",
                        parsed.length === 1 ? "word" : "words")))),
            React.createElement("p", { className: "sub-h" },
                deck.cards.length,
                " ",
                deck.cards.length === 1 ? "word" : "words"),
            deck.cards.length === 0 ? React.createElement(Empty, { text: "Add your first word above." }) : (React.createElement("ul", null, deck.cards.map((c) => (React.createElement("li", { key: c.id, className: "word-row" },
                c.pic && React.createElement("span", { className: "row-pic", "aria-hidden": "true" }, c.pic),
                React.createElement("div", { className: "row-main" },
                    React.createElement("span", { className: "row-title" }, c.en),
                    React.createElement("span", { className: "row-sub" }, c.fr),
                    c.ex && React.createElement("span", { className: "row-sub ex" }, c.ex)),
                canSpeak && React.createElement("button", { className: "icon-btn", "aria-label": `Hear ${c.en}`, onClick: () => speak(c.en) },
                    React.createElement(Icon, { name: "volume", size: 17 })),
                React.createElement(ConfirmButton, { iconOnly: true, label: `Delete ${c.en}`, onConfirm: () => onChange(Object.assign(Object.assign({}, deck), { cards: deck.cards.filter((x) => x.id !== c.id) })) }))))))));
    }
    function WordsTeacher({ decks, groups, saveDecks, openId, setOpenId, sample }) {
        const [practice, setPractice] = useState(false);
        const [newTitle, setNewTitle] = useState("");
        const deck = decks.find((d) => d.id === openId);
        if (deck && practice)
            return React.createElement(Study, { deck: deck, backLabel: "Back to editing", onBack: () => setPractice(false) });
        if (deck) {
            return (React.createElement(DeckEditor, { key: deck.id, deck: deck, groups: groups, onBack: () => setOpenId(null), onPractice: () => setPractice(true), onChange: (nd) => saveDecks(decks.map((d) => (d.id === nd.id ? nd : d))), onDelete: () => { saveDecks(decks.filter((d) => d.id !== deck.id)); setOpenId(null); } }));
        }
        const add = () => {
            const t = newTitle.trim();
            if (!t)
                return;
            const d = { id: uid(), title: t, group: EVERYONE, cards: [] };
            saveDecks([d, ...decks]);
            setNewTitle("");
            setOpenId(d.id);
        };
        return (React.createElement("section", null,
            React.createElement("h2", { className: "h" }, "Word lists"),
            React.createElement("div", { className: "inline-add" },
                React.createElement("input", { id: "new-list", className: "inp", "aria-label": "New list name", placeholder: "New list, e.g. Colors", value: newTitle, onChange: (e) => setNewTitle(e.target.value), onKeyDown: (e) => e.key === "Enter" && add() }),
                React.createElement("button", { className: "btn", onClick: add, disabled: !newTitle.trim() },
                    React.createElement(Icon, { name: "plus", size: 16 }),
                    "Add list")),
            React.createElement(AskClaude, { sample: sample, title: "Make a list with Claude", label: "What should the list be about?", placeholder: "Food words for a 6-year-old", button: "Make list", makePrompt: listPrompt, onResult: (data) => {
                    const cards = arr(data && data.words).map((w) => ({ id: uid(), en: String((w && w.en) || "").trim(), fr: String((w && w.fr) || "").trim(), ex: String((w && w.ex) || "").trim() })).filter((w) => w.en && w.fr);
                    if (!cards.length)
                        return false;
                    const d = { id: uid(), title: String((data && data.title) || "New list").trim().slice(0, 60), group: EVERYONE, cards };
                    saveDecks([d, ...decks]);
                    setPractice(false);
                    setOpenId(d.id);
                    return true;
                } }),
            decks.length === 0 ? React.createElement(Empty, { text: "Make a word list and your students can practice it with flashcards and quizzes." }) : (React.createElement("ul", { className: "rows" }, decks.map((d) => (React.createElement("li", { key: d.id },
                React.createElement("button", { className: "row-btn", onClick: () => { setPractice(false); setOpenId(d.id); } },
                    React.createElement("span", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, d.title),
                        React.createElement("span", { className: "row-sub" },
                            d.cards.length,
                            " words, for ",
                            d.group || EVERYONE)),
                    React.createElement(Icon, { name: "right" })))))))));
    }
    /* ---------- lessons & homework ---------- */
    function LessonEntry({ lesson: l, teacher = false, isDone = false, onToggle, onEdit, onDelete, onSaveToLibrary, voice }) {
        const { t, lang } = useT();
        const [libLevel, setLibLevel] = useState(null);
        const d = l.date ? parseISO(l.date) : null;
        const pastDue = l.due && l.due < todayISO();
        return (React.createElement("li", null,
            React.createElement("div", { className: "entry-date" }, d && React.createElement(React.Fragment, null,
                React.createElement("span", { className: "d-day" }, d.getDate()),
                React.createElement("span", { className: "d-mon" }, d.toLocaleDateString(LOCALE[lang], { month: "short" })))),
            React.createElement("div", { className: "entry-body" },
                React.createElement("h3", null, l.title),
                teacher && React.createElement("p", { className: "muted small" },
                    "For ",
                    l.group || EVERYONE),
                l.notes && React.createElement("p", { className: "notes" }, l.notes),
                !teacher && React.createElement(PracticeSay, { items: practiceItems(l.notes) }),
                l.homework && (React.createElement("div", { className: "hw" },
                    React.createElement("p", { className: "hw-head" },
                        t("homework"),
                        l.due && React.createElement("span", null, t("due", fmtDate(l.due, lang)))),
                    React.createElement("p", { className: "hw-text" }, l.homework),
                    !teacher && onToggle && (React.createElement("button", { className: "btn sm" + (isDone ? " done" : ""), onClick: onToggle, "aria-pressed": isDone }, isDone ? React.createElement(React.Fragment, null,
                        React.createElement(Icon, { name: "check", size: 16 }),
                        t("done")) : t("markDone"))),
                    !teacher && !isDone && pastDue && React.createElement("p", { className: "late" }, t("pastDue")),
                    !teacher && voice && React.createElement(VoiceHomework, { lesson: l, me: voice.me, sent: voice.sent, reply: voice.reply, onSent: voice.onSent }))),
                teacher && (React.createElement("div", { className: "entry-actions" },
                    React.createElement("button", { className: "btn ghost sm", onClick: onEdit },
                        React.createElement(Icon, { name: "pencil", size: 15 }),
                        "Edit"),
                    onSaveToLibrary && libLevel === null && React.createElement("button", { className: "btn ghost sm", onClick: () => setLibLevel(AUDIENCES[0]) }, "Save to library"),
                    React.createElement(ConfirmButton, { onConfirm: onDelete }))),
                teacher && libLevel !== null && (React.createElement("div", { className: "inline-add", style: { marginTop: 10, marginBottom: 0 } },
                    React.createElement("select", { className: "inp", "aria-label": "Who it's for", value: libLevel, onChange: (e) => setLibLevel(e.target.value) }, AUDIENCES.map((x) => React.createElement("option", { key: x, value: x }, x))),
                    React.createElement("button", { className: "btn sm", onClick: () => { onSaveToLibrary(libLevel); setLibLevel(null); } }, "Save"),
                    React.createElement("button", { className: "btn ghost sm", onClick: () => setLibLevel(null) }, "Cancel"))))));
    }
    function LessonsTeacher({ lessons, groups, saveLessons, flash, sample, db, userId, decks = [], saveDecks, roster = [], voiceNotes = {}, progressMap = {} }) {
        const [mode, setMode] = useState("lessons");
        const [form, setForm] = useState(null);
        const lib = useLibrary(db, userId);
        const plansH = usePlans(db, userId);
        const newVoice = Object.values(voiceNotes).filter((v) => !v.heard).length;
        const pending = useRef(null);
        const [libKey, setLibKey] = useState(0); // tapping Library again goes back to its first page
        const blank = () => ({ id: null, date: todayISO(), group: groups[1] || EVERYONE, title: "", notes: "", homework: "", due: "" });
        const upd = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { [k]: e.target.value }));
        const submit = () => {
            if (!form.title.trim())
                return;
            const item = Object.assign(Object.assign({}, form), { title: form.title.trim(), notes: form.notes.trim(), homework: form.homework.trim() });
            if (form.id)
                saveLessons(lessons.map((l) => (l.id === form.id ? item : l)));
            else
                saveLessons([Object.assign(Object.assign({}, item), { id: uid() }), ...lessons]);
            const pend = pending.current;
            pending.current = null;
            if (pend && !form.id && plansH.on) {
                const list = arr(plansH.plans[pend.studentId]);
                if (list.some((x) => x.id === pend.planId))
                    plansH.save(pend.studentId, list.map((x) => (x.id === pend.planId ? Object.assign(Object.assign({}, x), { used: form.date || todayISO() }) : x))).catch(() => { });
            }
            setForm(null);
            flash("Lesson saved. Students can see it now.");
        };
        const saveToLib = (l, level) => lib.save({ id: uid(), title: l.title, level, notes: l.notes || "", homework: l.homework || "" })
            .then(() => flash(`Saved to your library under ${level}.`), () => flash("That didn't save. Check your connection and try again."));
        const usePlan = (p, opt = {}) => {
            const b = blank();
            pending.current = opt.studentId && opt.planId ? { studentId: opt.studentId, planId: opt.planId } : null;
            setMode("lessons");
            setForm(Object.assign(Object.assign({}, b), { group: opt.group || b.group, title: p.title || "", notes: p.notes || "", homework: p.homework || "" }));
            window.scrollTo(0, 0);
        };
        const opts = form && !groups.includes(form.group) ? [...groups, form.group] : groups;
        const sorted = [...lessons].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        return (React.createElement("section", null,
            React.createElement("div", { className: "h-row" },
                React.createElement("h2", { className: "h" }, "Lessons"),
                mode === "lessons" && !form && React.createElement("button", { className: "btn sm", onClick: () => setForm(blank()) },
                    React.createElement(Icon, { name: "plus", size: 16 }),
                    "New lesson")),
            lib.on && (React.createElement("div", { className: "seg" },
                React.createElement("button", { "aria-pressed": mode === "lessons", onClick: () => setMode("lessons") }, "Lessons"),
                React.createElement("button", { "aria-pressed": mode === "library", onClick: () => { pending.current = null; setMode("library"); setLibKey((k) => k + 1); } }, "Library"),
                React.createElement("button", { "aria-pressed": mode === "voice", onClick: () => { pending.current = null; setMode("voice"); } },
                    "Voice notes",
                    newVoice ? ` (${newVoice})` : ""))),
            mode === "voice" ? React.createElement(VoiceInbox, { notes: voiceNotes, progressMap: progressMap, flash: flash }) : mode === "library" ? (React.createElement(CourseLibrary, { key: libKey, progressMap: progressMap, saved: lib.items, onUse: usePlan, decks: decks, saveDecks: saveDecks, groups: groups, flash: flash, roster: roster, plansH: plansH, onRemoveSaved: (id) => lib.remove(id).catch(() => flash("That didn't save. Check your connection and try again.")) })) : (React.createElement(React.Fragment, null,
                form && (React.createElement("div", { className: "form" },
                    React.createElement(AskClaude, { sample: sample, title: "Draft with Claude", label: "What's the lesson about?", placeholder: "Present continuous for adult beginners", button: "Draft", makePrompt: lessonPrompt, onResult: (d) => {
                            if (!d || !d.title)
                                return false;
                            setForm((f) => (Object.assign(Object.assign({}, f), { title: String(d.title), notes: String(d.notes || ""), homework: String(d.homework || "") })));
                            return true;
                        } }),
                    React.createElement(Field, { label: "Title" },
                        React.createElement("input", { id: "lesson-title", className: "inp", value: form.title, placeholder: "Telling the time", onChange: upd("title") })),
                    React.createElement("div", { className: "grid2" },
                        React.createElement(Field, { label: "Date" },
                            React.createElement("input", { id: "lesson-date", className: "inp", type: "date", value: form.date, onChange: upd("date") })),
                        React.createElement(Field, { label: "For" },
                            React.createElement("select", { id: "lesson-group", className: "inp", value: form.group, onChange: upd("group") }, opts.map((g) => React.createElement("option", { key: g, value: g }, g))))),
                    React.createElement(Field, { label: "What we did" },
                        React.createElement("textarea", { id: "lesson-notes", className: "inp", value: form.notes, placeholder: "New words, a song, a short dialogue...", onChange: upd("notes") })),
                    React.createElement(Field, { label: "Homework (optional)" },
                        React.createElement("textarea", { id: "lesson-hw", className: "inp", value: form.homework, placeholder: "Write 5 sentences with the new words.", onChange: upd("homework") })),
                    React.createElement(Field, { label: "Homework due (optional)" },
                        React.createElement("input", { id: "lesson-due", className: "inp", type: "date", value: form.due, onChange: upd("due") })),
                    React.createElement("div", { className: "form-actions" },
                        React.createElement("button", { className: "btn", onClick: submit, disabled: !form.title.trim() }, "Save lesson"),
                        React.createElement("button", { className: "btn ghost", onClick: () => { pending.current = null; setForm(null); } }, "Cancel")))),
                sorted.length === 0 ? (!form && React.createElement(Empty, { text: "Add your first lesson to give students their notes and homework, or open Library to use one of your lesson plans." })) : (React.createElement("ol", { className: "entries" }, sorted.map((l) => (React.createElement(LessonEntry, { key: l.id, lesson: l, teacher: true, onEdit: () => { setForm(Object.assign({}, l)); window.scrollTo(0, 0); }, onDelete: () => saveLessons(lessons.filter((x) => x.id !== l.id)), onSaveToLibrary: lib.on ? (level) => saveToLib(l, level) : null })))))))));
    }
    /* ---------- voice notes: a student's recorded homework, kept in Firestore in parts ---------- */
    const VOICE_PART = 700000;
    const blobToBase64 = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
    async function sendVoice(blob, secs, lesson, me) {
        const data = await blobToBase64(blob);
        const n = Math.ceil(data.length / VOICE_PART);
        if (!n || n > 6)
            throw new Error("too-long");
        const db = FB.db;
        const ref = db.collection("voice").doc(uid() + uid());
        const batch = db.batch();
        batch.set(ref, {
            sid: me.id, code: me.code, name: String(me.name || "").slice(0, 120), group: String(me.group || "").slice(0, 120),
            title: String(lesson.title || "").slice(0, 200), lessonId: String(lesson.id || "").slice(0, 60),
            mime: (blob.type || "audio/webm").slice(0, 40), secs: Math.round(secs), parts: n, at: new Date().toISOString(),
        });
        for (let k = 0; k < n; k++)
            batch.set(ref.collection("parts").doc(String(k)), { d: data.slice(k * VOICE_PART, (k + 1) * VOICE_PART) });
        await Promise.race([batch.commit(), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 60000))]);
        return ref.id;
    }
    async function loadVoice(v) {
        const parts = await Promise.all(Array.from({ length: v.parts || 0 }, (_, k) => FB.db.doc(`voice/${v.id}/parts/${k}`).get()));
        const b64 = parts.map((s) => (s.exists ? (s.data() || {}).d || "" : "")).join("");
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++)
            bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: v.mime || "audio/mp4" }));
    }
    function deleteVoice(v) {
        const db = FB.db;
        const ref = db.doc("voice/" + v.id);
        const batch = db.batch();
        for (let k = 0; k < (v.parts || 0); k++)
            batch.delete(ref.collection("parts").doc(String(k)));
        batch.delete(ref);
        return batch.commit();
    }
    /* progress/{studentId}: skills the teacher ticked, and replies to voice notes. Students read their own. */
    function useProgressDoc(sid) {
        const [doc, setDoc] = useState(null);
        useEffect(() => {
            setDoc(null);
            if (!sid || !FB)
                return undefined;
            let un = () => { };
            try {
                un = FB.db.doc("progress/" + sid).onSnapshot((s) => setDoc(s.exists ? s.data() || {} : {}), () => setDoc({}));
            }
            catch (e) {
                setDoc({});
            }
            return () => un();
        }, [sid]);
        return doc;
    }
    function useCollectionMap(path, on) {
        const [map, setMap] = useState({});
        const [ready, setReady] = useState(false);
        useEffect(() => {
            if (!on || !FB) {
                setMap({});
                setReady(false);
                return undefined;
            }
            let un = () => { };
            try {
                un = FB.db.collection(path).onSnapshot((qs) => {
                    const next = {};
                    qs.docs.forEach((d) => { next[d.id] = Object.assign(Object.assign({}, (d.data() || {})), { id: d.id }); });
                    setMap(next);
                    setReady(true);
                }, () => setReady(true));
            }
            catch (e) {
                setReady(true);
            }
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
        if (!canRecord || !me || me.id === "guest" || !me.code)
            return null;
        const last = sent[sent.length - 1];
        const send = async () => {
            setBusy(true);
            setErr("");
            try {
                const id = await sendVoice(rec.blob, rec.secs, lesson, me);
                onSent({ id, at: new Date().toISOString(), secs: rec.secs });
                rec.reset();
                setOpen(false);
            }
            catch (e) {
                const why = (e && (e.code || e.message)) || "";
                setErr(why === "too-long" ? t("voiceTooLong") : /permission/i.test(why) ? t("voiceNotReady") : why === "slow" ? t("voiceSlow") : t("voiceFail"));
            }
            setBusy(false);
        };
        return (React.createElement("div", { className: "voice-hw" },
            reply && (React.createElement("div", { className: "voice-reply" },
                React.createElement("p", { className: "voice-stars", "aria-label": t("starsN", reply.stars || 0) }, Array.from({ length: reply.stars || 0 }, (_, k) => React.createElement(Icon, { key: k, name: "star", size: 20 }))),
                reply.note && React.createElement("p", { className: "voice-note" },
                    "\u201C",
                    reply.note,
                    "\u201D"),
                React.createElement("p", { className: "muted small" }, t("teacherReplied")))),
            last && !open && React.createElement("p", { className: "muted small voice-sent" },
                React.createElement(Icon, { name: "check", size: 14 }),
                t("voiceSent", fmtDate(last.at.slice(0, 10), lang))),
            !open ? (React.createElement("button", { className: "btn ghost sm", onClick: () => setOpen(true) },
                React.createElement(Icon, { name: "mic", size: 16 }),
                sent.length ? t("recordAnother") : t("recordAnswer"))) : (React.createElement("div", { className: "recorder" },
                React.createElement("p", { className: "hint" }, t("recordHint")),
                rec.state === "recording" ? (React.createElement("button", { className: "btn rec", onClick: rec.stop },
                    React.createElement(Icon, { name: "stop", size: 16 }),
                    t("stopRec"),
                    " \u00B7 ",
                    mmss(rec.secs))) : rec.state === "done" ? (React.createElement(React.Fragment, null,
                    React.createElement("audio", { controls: true, src: rec.url, className: "voice-audio" }),
                    React.createElement("div", { className: "pay-actions" },
                        React.createElement("button", { className: "btn", onClick: send, disabled: busy }, busy ? t("sending") : t("sendTeacher")),
                        React.createElement("button", { className: "btn ghost sm", onClick: rec.reset, disabled: busy }, t("recordAgain"))))) : (React.createElement("div", { className: "pay-actions" },
                    React.createElement("button", { className: "btn", onClick: rec.start },
                        React.createElement(Icon, { name: "mic", size: 16 }),
                        t("startRec")),
                    React.createElement("button", { className: "btn ghost sm", onClick: () => { rec.reset(); setOpen(false); } }, t("cancel")))),
                (rec.error || err) && React.createElement("p", { className: "say-result error", role: "alert" }, rec.error || err)))));
    }
    /* Phrases worth saying out loud, taken from a lesson's notes: quoted phrases and the "New words" line. */
    function practiceItems(text) {
        const out = [];
        const add = (s) => {
            const x = String(s || "").trim().replace(/^[“"']+|[”"']+$/g, "").trim();
            if (x && /[a-z]/i.test(x) && x.length <= 80 && !out.some((y) => y.toLowerCase() === x.toLowerCase()))
                out.push(x);
        };
        String(text || "").split("\n").forEach((line) => {
            const m = line.match(/^\s*(new words|words|vocabulary)\s*:\s*(.+)$/i);
            if (m)
                m[2].split(/[,;]/).forEach((w) => { const x = w.replace(/\(.*?\)/g, "").replace(/[.!]+$/, "").trim(); if (x && x.split(/\s+/).length <= 4)
                    add(x); });
            (line.match(/[“"]([^“”"]{2,80})[”"]/g) || []).forEach((q) => add(q.slice(1, -1)));
        });
        return out.slice(0, 16);
    }
    function PracticeSay({ items }) {
        const { t } = useT();
        const [open, setOpen] = useState(false);
        if (!items.length || !canSpeak)
            return null;
        return (React.createElement("div", { className: "practice" },
            React.createElement("button", { className: "btn ghost sm", "aria-expanded": open, onClick: () => setOpen((o) => !o) },
                React.createElement(Icon, { name: "volume", size: 16 }),
                t("practiceTitle", items.length)),
            open && (React.createElement(React.Fragment, null,
                React.createElement("p", { className: "hint" }, SpeechRec ? t("practiceHint") : t("practiceHintNoMic")),
                React.createElement("ul", { className: "practice-list" }, items.map((x) => (React.createElement("li", { key: x },
                    React.createElement("span", { className: "practice-text" }, x),
                    React.createElement("button", { className: "icon-btn", "aria-label": t("hearIt", x), onClick: () => speak(x) },
                        React.createElement(Icon, { name: "volume", size: 17 })),
                    SpeechRec && (canSay(x) ? React.createElement(SayIt, { text: x, compact: true }) : React.createElement("span", { className: "say-compact say-gap", "aria-hidden": "true" }))))))))));
    }
    function HomeworkStudent({ lessons, me, done, onToggle, prog, voiceSent = {}, onVoiceSent }) {
        const { t } = useT();
        const replies = Object.values((prog && prog.replies) || {});
        const replyFor = (id) => replies.filter((r) => r.lessonId === id).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))[0];
        const list = lessons.filter((l) => forGroup(l.group, me.group)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        return (React.createElement("section", null,
            React.createElement("h2", { className: "h" }, t("homework")),
            list.length === 0 ? React.createElement(Empty, { text: t("noLessons") }) : (React.createElement("ol", { className: "entries" }, list.map((l) => (React.createElement(LessonEntry, { key: l.id, lesson: l, isDone: !!done[l.id], onToggle: () => onToggle(l.id), voice: me && me.id !== "guest" ? { me, sent: arr(voiceSent[l.id]), reply: replyFor(l.id), onSent: (x) => onVoiceSent(l.id, x) } : null })))))));
    }
    /* ---------- announcements ---------- */
    const activeNotice = (n, today) => !n.until || n.until >= today;
    function StudentNotices({ notices, me }) {
        const { t } = useT();
        const today = todayISO();
        const list = notices.filter((n) => forGroup(n.group, me.group) && activeNotice(n, today));
        if (!list.length)
            return null;
        return (React.createElement("div", { className: "notices", role: "region", "aria-label": t("announcement") }, list.map((n) => React.createElement("p", { key: n.id, className: "notice" },
            React.createElement(Icon, { name: "megaphone", size: 18 }),
            React.createElement("span", null, n.text)))));
    }
    function NoticesTeacher({ notices, groups, saveNotices, flash }) {
        const [form, setForm] = useState(null);
        const today = todayISO();
        const upd = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { [k]: e.target.value }));
        const submit = () => {
            const text = form.text.trim();
            if (!text)
                return;
            saveNotices([{ id: uid(), text, group: form.group, until: form.until }, ...notices]);
            setForm(null);
            flash("Announcement saved. Students see it now.");
        };
        return (React.createElement("section", { className: "notices-teacher" },
            React.createElement("div", { className: "h-row" },
                React.createElement("h2", { className: "h" }, "Announcements"),
                !form && React.createElement("button", { className: "btn ghost sm", onClick: () => setForm({ text: "", group: EVERYONE, until: "" }) },
                    React.createElement(Icon, { name: "megaphone", size: 16 }),
                    "New")),
            form && (React.createElement("div", { className: "form" },
                React.createElement(Field, { label: "Message" },
                    React.createElement("textarea", { id: "notice-text", className: "inp", value: form.text, placeholder: "No class on Wednesday. See you Saturday!", onChange: upd("text") })),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "For" },
                        React.createElement("select", { id: "notice-group", className: "inp", value: form.group, onChange: upd("group") }, groups.map((g) => React.createElement("option", { key: g, value: g }, g)))),
                    React.createElement(Field, { label: "Show until (optional)" },
                        React.createElement("input", { id: "notice-until", className: "inp", type: "date", min: today, value: form.until, onChange: upd("until") }))),
                React.createElement("p", { className: "hint" }, "Students see it at the top of the app until that date, or until you delete it."),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn", onClick: submit, disabled: !form.text.trim() }, "Save announcement"),
                    React.createElement("button", { className: "btn ghost", onClick: () => setForm(null) }, "Cancel")))),
            notices.length === 0 ? (!form && React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "Post a short message students see at the top of the app, like \"No class Wednesday\".")) : (React.createElement("ul", { className: "rows", style: { marginBottom: 8 } }, notices.map((n) => (React.createElement("li", { key: n.id, className: "notice-row" },
                React.createElement("div", { className: "row-main" },
                    React.createElement("span", { className: "notes", style: { marginTop: 0 } }, n.text),
                    React.createElement("span", { className: "row-sub" },
                        "For ",
                        n.group || EVERYONE,
                        ", ",
                        !n.until ? "until you delete it" : activeNotice(n, today) ? `until ${fmtDate(n.until)}` : "ended")),
                React.createElement(ConfirmButton, { iconOnly: true, label: "Delete announcement", onConfirm: () => saveNotices(notices.filter((x) => x.id !== n.id)) }))))))));
    }
    /* ---------- classes ---------- */
    function Classes({ schedule, changes = [], saveChanges, notices = [], saveNotices, isTeacher = false, me, groups = [EVERYONE], saveSchedule, flash, roster = [], att, st, updated }) {
        const { t, lang } = useT();
        const [form, setForm] = useState(null);
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
        const upd = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { [k]: e.target.value }));
        const placeOf = (s) => s.place || (s.link ? t("online") : t("placeNotSet"));
        const fail = () => flash("That didn't save. Check your connection and try again.");
        /* Each picked day keeps its own start time; a newly ticked day starts with the last time used. */
        const timeOf = (k) => (form.times && form.times[k]) || form.start;
        const toggleDay = (k) => {
            if (form.days.includes(k)) {
                setForm(Object.assign(Object.assign({}, form), { days: form.days.filter((d) => d !== k) }));
                return;
            }
            const last = form.days.length ? timeOf(form.days[form.days.length - 1]) : form.start;
            setForm(Object.assign(Object.assign({}, form), { days: [...form.days, k], times: Object.assign(Object.assign({}, (form.times || {})), { [k]: (form.times && form.times[k]) || last }) }));
        };
        const setTime = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { start: e.target.value, times: Object.assign(Object.assign({}, (form.times || {})), { [k]: e.target.value }) }));
        /* Each picked day is saved as its own class, so one day can still be cancelled, moved or edited alone. */
        const submit = () => {
            const days = [...new Set(arr(form.days).map(Number))].sort((a, b) => a - b);
            if (!days.length) {
                setFormErr("Pick at least one day.");
                return;
            }
            const noTime = days.find((d) => !timeOf(d));
            if (noTime !== undefined) {
                setFormErr(`Add a start time for ${DAYS.en[noTime]}.`);
                return;
            }
            const link = form.link.trim();
            if (link && !isLink(link)) {
                setFormErr("An online link must start with https:// and have no spaces.");
                return;
            }
            const base = { group: form.group, minutes: Number(form.minutes) || 60, place: form.place.trim() };
            if (link)
                base.link = link;
            const slotFor = (d, id) => (Object.assign(Object.assign({ id }, base), { day: d, start: timeOf(d) }));
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
            if (!form.id && !added.length) {
                setFormErr("That class is already on the schedule.");
                return;
            }
            saveSchedule([...next, ...added]);
            const n = (form.id ? 1 : 0) + added.length;
            setForm(null);
            setFormErr("");
            flash(n > 1 ? `${n} classes saved.` : "Class saved.");
        };
        const isTaught = (key) => markable && att.taken.some((x) => x.slot === key && x.date === today);
        const toggleTaught = (key, group, place) => {
            if (isTaught(key)) {
                att.save(att.taken.filter((x) => !(x.slot === key && x.date === today))).then(() => flash("Class unmarked."), fail);
                return;
            }
            const who = roster.filter((r) => forGroup(group, r.group));
            att.save([...att.taken, ...who.map((r) => ({ id: uid(), studentId: r.id, date: today, slot: key, place }))])
                .then(() => flash(`Logged a class for ${who.length} ${who.length === 1 ? "student" : "students"}.`), fail);
        };
        const taughtButton = (key, group, place) => (markable && roster.some((r) => forGroup(group, r.group)) ? (React.createElement("button", { className: "btn sm" + (isTaught(key) ? " done" : " ghost"), "aria-pressed": isTaught(key), onClick: () => toggleTaught(key, group, place) }, isTaught(key) ? React.createElement(React.Fragment, null,
            React.createElement(Icon, { name: "check", size: 16 }),
            "Taught") : "Mark taught")) : null);
        const saveChange = (s, existing, v) => {
            const c = existing ? Object.assign(Object.assign({}, existing), { makeup: v.makeup }) : { id: uid(), slot: s.id, date: v.date, note: v.note, makeup: v.makeup, resolved: false };
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
        return (React.createElement("section", null,
            React.createElement("div", { className: "h-row" },
                React.createElement("h2", { className: "h" }, isTeacher ? "Classes" : t("myClasses")),
                isTeacher && !form && !changeFor && (React.createElement("button", { className: "btn sm", onClick: () => { setFormErr(""); setForm({ id: null, group: groups[1] || EVERYONE, days: [ti], times: { [ti]: "16:00" }, start: "16:00", minutes: 60, place: "", link: "" }); } },
                    React.createElement(Icon, { name: "plus", size: 16 }),
                    "Add class"))),
            form && (React.createElement("div", { className: "form" },
                React.createElement(Field, { label: "Group" },
                    React.createElement("select", { id: "class-group", className: "inp", value: form.group, onChange: upd("group") }, (groups.includes(form.group) ? groups : [...groups, form.group]).map((g) => React.createElement("option", { key: g, value: g }, g)))),
                React.createElement("div", { className: "field" },
                    React.createElement("span", { id: "class-days-label" }, "Days"),
                    React.createElement("div", { className: "day-pick", role: "group", "aria-labelledby": "class-days-label" }, DAYS.en.map((d, k) => (React.createElement("button", { key: d, type: "button", "aria-label": d, "aria-pressed": form.days.includes(k), onClick: () => toggleDay(k) }, d.slice(0, 3))))),
                    React.createElement("span", { className: "hint" }, form.id ? "Tap another day to add this class on that day too, with its own start time." : "Tap every day this group meets. Each day can have its own start time, and each becomes its own class, so you can still cancel or move one day alone.")),
                form.days.length > 1 && (React.createElement("div", { className: "field" },
                    React.createElement("span", { id: "class-times-label" }, "Start time for each day"),
                    React.createElement("div", { className: "day-times", role: "group", "aria-labelledby": "class-times-label" }, [...form.days].sort((a, b) => a - b).map((k) => (React.createElement("label", { key: k, className: "day-time" },
                        React.createElement("span", null, DAYS.en[k]),
                        React.createElement("input", { id: "class-start-" + k, className: "inp", type: "time", value: timeOf(k), onChange: setTime(k) }))))))),
                React.createElement("div", { className: "grid2" },
                    form.days.length <= 1 && React.createElement(Field, { label: "Starts at" },
                        React.createElement("input", { id: "class-start", className: "inp", type: "time", value: form.days.length ? timeOf(form.days[0]) : form.start, onChange: form.days.length ? setTime(form.days[0]) : upd("start") })),
                    React.createElement(Field, { label: "Minutes" },
                        React.createElement("input", { id: "class-min", className: "inp", type: "number", inputMode: "numeric", min: "15", step: "15", value: form.minutes, onChange: upd("minutes") }))),
                React.createElement(Field, { label: "Where" },
                    React.createElement("input", { id: "class-place", className: "inp", placeholder: "School, home or online", value: form.place, onChange: upd("place") })),
                React.createElement(Field, { label: "Online class link (optional)" },
                    React.createElement("input", { id: "class-link", className: "inp", type: "url", inputMode: "url", placeholder: "https://meet.google.com/...", value: form.link, onChange: upd("link") })),
                React.createElement("p", { className: "hint" }, "Paste a Google Meet or Zoom link and students get a Join button."),
                formErr && React.createElement("p", { className: "err", role: "alert" }, formErr),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn", onClick: submit }, form.days.length > 1 ? `Save ${form.days.length} classes` : "Save class"),
                    React.createElement("button", { className: "btn ghost", onClick: () => { setForm(null); setFormErr(""); } }, "Cancel")))),
            changeSlot && (React.createElement(ChangeForm, { key: changeFor.slot + (changeFor.change ? changeFor.change.id : ""), slot: changeSlot, change: changeFor.change, onSave: (v) => saveChange(changeSlot, changeFor.change, v), onCancel: () => setChangeFor(null) })),
            showSt && (React.createElement("div", { className: "status-card" },
                React.createElement("strong", { className: st.left <= 0 ? "out" : "" }, st.left >= 0 ? t("classesLeft", st.left, st.total, monthLabel(st.m, lang)) : t("extraClasses", -st.left, monthLabel(st.m, lang))),
                updated && React.createElement("span", { className: "muted small" }, t("updatedOn", fmtShort(updated.slice(0, 10), lang))))),
            next ? (React.createElement("div", { className: "seyes next" },
                React.createElement("p", { className: "muted small" },
                    isTeacher ? "Next class" : t("nextClass"),
                    next.makeup ? ` (${isTeacher ? "make-up" : t("makeupLabel").toLowerCase()})` : ""),
                React.createElement("p", { className: "next-when" }, whenLabel(next.at, t, lang)),
                React.createElement("p", { className: "muted" }, [isTeacher ? next.s.group : null, placeOf(next.s)].filter(Boolean).join(", ")),
                next.s.link && React.createElement("a", { className: "btn join", href: next.s.link, target: "_blank", rel: "noopener noreferrer" },
                    React.createElement(Icon, { name: "video", size: 18 }),
                    t("joinClass")))) : (!form && React.createElement(Empty, { text: isTeacher ? "Add your weekly classes so you and your students always know what's next." : t("noClasses") })),
            visibleChanges.length > 0 && (React.createElement("div", { className: "changes" },
                React.createElement("p", { className: "sub-h" }, isTeacher ? "Cancelled and moved classes" : t("changesTitle")),
                React.createElement("ul", null, visibleChanges.map((c) => {
                    const s = schedule.find((x) => x.id === c.slot);
                    if (!s)
                        return null;
                    return (React.createElement("li", { key: c.id },
                        React.createElement("div", { className: "row-main" },
                            isTeacher && React.createElement("span", { className: "row-title" }, s.group),
                            React.createElement("span", { className: isTeacher ? "row-sub" : "change-line" }, t("cancelledOn", fmtDate(c.date, lang), s.start)),
                            c.makeup && React.createElement("span", { className: isTeacher ? "row-sub" : "change-line" }, t("makeupOn", fmtDate(c.makeup.date, lang), c.makeup.start)),
                            !isTeacher && c.note && React.createElement("span", { className: "row-sub" }, c.note)),
                        isTeacher && (React.createElement("span", { className: "slot-actions" },
                            c.makeup && c.makeup.date === today && taughtButton(c.id, s.group, placeName(s)),
                            React.createElement(ConfirmButton, { iconOnly: true, label: "Undo this change", onConfirm: () => undoChange(c) })))));
                })))),
            owed.length > 0 && (React.createElement("div", { className: "changes" },
                React.createElement("p", { className: "sub-h" }, "Make-up classes you owe"),
                React.createElement("ul", null, owed.map((c) => {
                    const s = schedule.find((x) => x.id === c.slot);
                    if (!s)
                        return null;
                    return (React.createElement("li", { key: c.id },
                        React.createElement("div", { className: "row-main" },
                            React.createElement("span", { className: "row-title" }, s.group),
                            React.createElement("span", { className: "row-sub" },
                                "Cancelled ",
                                fmtDate(c.date),
                                " at ",
                                s.start)),
                        React.createElement("span", { className: "slot-actions" },
                            React.createElement("button", { className: "btn ghost sm", onClick: () => { setForm(null); setChangeFor({ slot: s.id, change: c }); window.scrollTo(0, 0); } }, "Schedule make-up"),
                            React.createElement("button", { className: "btn ghost sm", onClick: () => saveChanges(changes.map((x) => (x.id === c.id ? Object.assign(Object.assign({}, x), { resolved: true }) : x))) }, "Done"))));
                })))),
            markable && slots.length > 0 && React.createElement("p", { className: "hint" }, "Tap Mark taught after today's class to count it for everyone in that group. To log a class on another day, open the student in Students."),
            dayOrder.map((d) => {
                const list = slots.filter((s) => Number(s.day) === d).sort((a, b) => a.start.localeCompare(b.start));
                if (!list.length)
                    return null;
                const dayName = isTeacher ? DAYS.en[d] : cap(DAYS[lang][d]);
                return (React.createElement("div", { key: d, className: "day-block" },
                    React.createElement("p", { className: "day-name" + (d === ti ? " today" : "") }, d === ti ? t("todayDay", isTeacher ? DAYS.en[d] : DAYS[lang][d]) : dayName),
                    list.map((s) => {
                        const cancelledToday = d === ti && changes.some((c) => c.slot === s.id && c.date === today);
                        return (React.createElement("div", { key: s.id, className: "slot" },
                            React.createElement("span", { className: "slot-time" }, t("timeRange", s.start, addMin(s.start, s.minutes))),
                            React.createElement("span", { className: "slot-main" },
                                isTeacher && React.createElement("span", { className: "row-title" }, s.group),
                                React.createElement("span", { className: "row-sub" }, placeOf(s))),
                            React.createElement("span", { className: "slot-actions" },
                                s.link && React.createElement("a", { className: "btn ghost sm", href: s.link, target: "_blank", rel: "noopener noreferrer" },
                                    React.createElement(Icon, { name: "video", size: 16 }),
                                    t("join")),
                                d === ti && !cancelledToday && taughtButton(s.id, s.group, placeName(s)),
                                isTeacher && React.createElement("button", { className: "btn ghost sm", onClick: () => { setForm(null); setChangeFor({ slot: s.id, change: null }); window.scrollTo(0, 0); } }, "Cancel or move"),
                                isTeacher && React.createElement("button", { className: "icon-btn sm-icon", "aria-label": "Edit class", onClick: () => { setChangeFor(null); setFormErr(""); setForm({ id: s.id, group: s.group, days: [Number(s.day)], times: { [Number(s.day)]: s.start }, start: s.start, minutes: s.minutes, place: s.place || "", link: s.link || "" }); window.scrollTo(0, 0); } },
                                    React.createElement(Icon, { name: "pencil", size: 15 })),
                                isTeacher && React.createElement(ConfirmButton, { iconOnly: true, label: "Delete class", onConfirm: () => saveSchedule(schedule.filter((x) => x.id !== s.id)) }))));
                    })));
            })));
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
        return (React.createElement("section", null,
            React.createElement("h2", { className: "h" }, t("payTitle")),
            showSt && React.createElement("p", { className: "pay-status " + st.pay }, t(st.pay, month)),
            me.due > 0 && (React.createElement("div", { className: "seyes next" },
                React.createElement("p", { className: "muted small" }, t("yourFee")),
                React.createElement("p", { className: "next-when" }, fcfa(me.due)),
                React.createElement("p", { className: "muted" }, t("eachMonth")))),
            methods.length === 0 ? React.createElement(Empty, { text: t("noPayDetails") }) : (React.createElement(React.Fragment, null,
                React.createElement("p", { className: "sub-h" }, t("sendTo")),
                React.createElement("ul", { className: "rows", style: { marginBottom: 16 } }, methods.map((m) => (React.createElement("li", { key: m.id, className: "pay-method" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, m.kind),
                        m.number && React.createElement("span", { className: "row-sub sel" }, m.number),
                        pay.accountName && React.createElement("span", { className: "row-sub" }, t("name", pay.accountName))),
                    React.createElement("div", { className: "pay-actions" },
                        m.link && React.createElement("a", { className: "btn sm", href: m.link, target: "_blank", rel: "noopener noreferrer" }, t("payWith", m.kind)),
                        m.number && React.createElement(CopyButton, { text: m.number, label: `${t("copy")} ${m.kind}` })))))),
                pay.note && React.createElement("p", { className: "note" }, pay.note))),
            wa ? (React.createElement("div", { className: "form" },
                React.createElement("p", { className: "form-title" }, t("afterPay")),
                guest && React.createElement(Field, { label: t("yourName") },
                    React.createElement("input", { id: "pay-me", className: "inp", value: name, onChange: (e) => setName(e.target.value) })),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: t("amount") },
                        React.createElement("input", { id: "pay-amount", className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", value: amount, onChange: (e) => setAmount(e.target.value) })),
                    React.createElement(Field, { label: t("paidWith") },
                        React.createElement("select", { id: "pay-method", className: "inp", value: method, onChange: (e) => setMethod(e.target.value) }, [...new Set([...methods.map((m) => m.kind), "cash"])].map((k) => React.createElement("option", { key: k, value: k }, k === "cash" ? t("cash") : k))))),
                React.createElement("p", { className: "msg sel" }, msg),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("a", { className: "btn", href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: "_blank", rel: "noopener noreferrer" },
                        React.createElement(Icon, { name: "chat", size: 16 }),
                        t("sendWa")),
                    React.createElement(CopyButton, { text: msg, label: t("copyMsg") })),
                React.createElement("p", { className: "hint", style: { margin: "10px 0 0" } }, t("waFallback", pay.whatsapp)))) : methods.length > 0 && React.createElement("p", { className: "hint" }, t("screenshot"))));
    }
    function PaySettings({ pay, savePay, flash }) {
        const [form, setForm] = useState(null);
        const [err, setErr] = useState("");
        const methods = pay.methods.filter((m) => m.number || m.link);
        const start = () => {
            setErr("");
            setForm({ whatsapp: pay.whatsapp, accountName: pay.accountName, note: pay.note,
                methods: methods.length ? methods.map((m) => (Object.assign({}, m))) : [{ id: uid(), kind: "Wave", number: "", link: "" }] });
        };
        const upd = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { [k]: e.target.value }));
        const updM = (id, k) => (e) => setForm(Object.assign(Object.assign({}, form), { methods: form.methods.map((m) => (m.id === id ? Object.assign(Object.assign({}, m), { [k]: e.target.value }) : m)) }));
        const save = () => {
            const list = form.methods.map((m) => ({ id: m.id, kind: m.kind, number: m.number.trim(), link: m.link.trim() })).filter((m) => m.number || m.link);
            if (list.some((m) => m.link && !isLink(m.link))) {
                setErr("A payment link must start with https:// and have no spaces.");
                return;
            }
            if (form.whatsapp.trim() && !waDigits(form.whatsapp)) {
                setErr("That WhatsApp number looks too short. Use the full number, like 07 00 00 00 00.");
                return;
            }
            savePay({ whatsapp: form.whatsapp.trim(), accountName: form.accountName.trim(), note: form.note.trim(), methods: list });
            setForm(null);
            flash("Payment details saved.");
        };
        return (React.createElement("section", { className: "pay-settings" },
            React.createElement("div", { className: "h-row" },
                React.createElement("h2", { className: "h" }, "How students pay"),
                !form && React.createElement("button", { className: "btn ghost sm", onClick: start },
                    React.createElement(Icon, { name: "pencil", size: 15 }),
                    methods.length || pay.whatsapp ? "Edit" : "Set up")),
            React.createElement("p", { className: "hint" }, "Students see these details on their Pay screen, and anyone with the app link can see them too. When a student tells you they've paid, record it above."),
            !form && (methods.length || pay.whatsapp ? (React.createElement("ul", { className: "rows" },
                methods.map((m) => (React.createElement("li", { key: m.id, className: "pay-method" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, m.kind),
                        React.createElement("span", { className: "row-sub" }, [m.number, m.link ? "Payment link added" : ""].filter(Boolean).join(", ")))))),
                pay.whatsapp && React.createElement("li", { className: "pay-method" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, "WhatsApp"),
                        React.createElement("span", { className: "row-sub" }, pay.whatsapp))))) : React.createElement(Empty, { text: "Add your Wave or mobile money number so students can pay you from the app." })),
            form && (React.createElement("div", { className: "form" },
                form.methods.map((m) => (React.createElement("div", { key: m.id, className: "method-edit" },
                    React.createElement("div", { className: "grid2" },
                        React.createElement(Field, { label: "Pay with" },
                            React.createElement("select", { id: "pm-kind-" + m.id, className: "inp", value: m.kind, onChange: updM(m.id, "kind") }, KINDS.map((k) => React.createElement("option", { key: k, value: k }, k)))),
                        React.createElement(Field, { label: "Number" },
                            React.createElement("input", { id: "pm-num-" + m.id, className: "inp", type: "tel", inputMode: "tel", placeholder: "07 00 00 00 00", value: m.number, onChange: updM(m.id, "number") }))),
                    React.createElement(Field, { label: "Payment link (optional)" },
                        React.createElement("input", { id: "pm-link-" + m.id, className: "inp", type: "url", inputMode: "url", placeholder: "https://", value: m.link, onChange: updM(m.id, "link") })),
                    form.methods.length > 1 && React.createElement("button", { className: "btn ghost sm danger", onClick: () => setForm(Object.assign(Object.assign({}, form), { methods: form.methods.filter((x) => x.id !== m.id) })) },
                        React.createElement(Icon, { name: "trash", size: 15 }),
                        "Remove")))),
                React.createElement("button", { className: "btn ghost sm", style: { marginBottom: 16 }, onClick: () => setForm(Object.assign(Object.assign({}, form), { methods: [...form.methods, { id: uid(), kind: "Orange Money", number: "", link: "" }] })) },
                    React.createElement(Icon, { name: "plus", size: 16 }),
                    "Add another way to pay"),
                React.createElement(Field, { label: "Name on the account" },
                    React.createElement("input", { id: "pay-name", className: "inp", value: form.accountName, onChange: upd("accountName") })),
                React.createElement(Field, { label: "Your WhatsApp number" },
                    React.createElement("input", { id: "pay-wa", className: "inp", type: "tel", inputMode: "tel", placeholder: "+225 07 00 00 00 00", value: form.whatsapp, onChange: upd("whatsapp") })),
                React.createElement("p", { className: "hint" }, "Students use it to tell you they've paid."),
                React.createElement(Field, { label: "Note for students (optional)" },
                    React.createElement("textarea", { id: "pay-note", className: "inp", placeholder: "Please pay before the 5th of each month.", value: form.note, onChange: upd("note") })),
                err && React.createElement("p", { className: "err", role: "alert" }, err),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn", onClick: save }, "Save payment details"),
                    React.createElement("button", { className: "btn ghost", onClick: () => setForm(null) }, "Cancel"))))));
    }
    /* ---------- students & payments ---------- */
    const STATUS = { paid: "Paid", partial: "Part paid", unpaid: "Not paid", none: "No fee" };
    function StudentReport({ r, month, lessons, decks }) {
        const [comment, setComment] = useState("");
        const text = reportText(r, month, lessons, decks, comment);
        return (React.createElement("div", { className: "report" },
            React.createElement("p", { className: "form-title" },
                "Report for ",
                monthLabel(month),
                r.lang === "fr" ? ", in French" : ""),
            React.createElement(Field, { label: "Your comment (optional)" },
                React.createElement("textarea", { id: "report-note-" + r.id, className: "inp", value: comment, placeholder: r.lang === "fr" ? "Très bons progrès ce mois-ci !" : "Great progress this month!", onChange: (e) => setComment(e.target.value) })),
            React.createElement("p", { className: "msg sel pre" }, text),
            React.createElement("div", { className: "form-actions" },
                r.phone && React.createElement(WaButton, { phone: r.phone, text: text }, "Send on WhatsApp"),
                React.createElement(CopyButton, { text: text, label: "Copy the report", caption: "Copy report" })),
            !r.phone && React.createElement("p", { className: "hint", style: { margin: "10px 0 0" } }, "Add their WhatsApp number with Edit student to send it in one tap.")));
    }
    function StudentDetail({ r, month, moneyOn, lessons, decks, placeOptions = [], defaultPlace = "", downloads, teacherName, onPay, onRemovePayment, onLogClass, onRemoveClass, onNewCode, onEdit, onRemove }) {
        const [logPlace, setLogPlace] = useState(defaultPlace);
        const [showCert, setShowCert] = useState(false);
        const [min, max] = monthRange(month);
        const [logDate, setLogDate] = useState(() => { const t = todayISO(); return t >= min && t <= max ? t : min; });
        const logOk = logDate >= min && logDate <= max;
        const [armed, setArmed] = useState(false);
        const [showReport, setShowReport] = useState(false);
        useEffect(() => { if (!armed)
            return undefined; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
        const remaining = Math.max(0, r.fee - r.paid);
        const [amount, setAmount] = useState(remaining ? String(remaining) : "");
        const [date, setDate] = useState(todayISO());
        const valid = Number(amount) > 0;
        const save = () => { if (!valid)
            return; onPay(Number(amount), date); setAmount(""); };
        return (React.createElement("div", { className: "expand" },
            React.createElement("div", { className: "code-box" },
                React.createElement("div", { className: "code-main" },
                    React.createElement("span", { className: "muted small" }, "Code"),
                    React.createElement("span", { className: "code-big sel" }, r.code)),
                React.createElement("div", { className: "pay-actions" },
                    r.phone && React.createElement(WaButton, { phone: r.phone, text: codeText(r, r.lang), ghost: true }, "Send code"),
                    React.createElement(CopyButton, { text: codeText(r, r.lang), label: `Copy a message with the code for ${r.name}`, caption: "Copy message" }),
                    React.createElement("button", { type: "button", className: "btn ghost sm", onClick: () => { if (armed) {
                            setArmed(false);
                            onNewCode();
                        }
                        else
                            setArmed(true); } }, armed ? "Tap again for a new code" : "New code"))),
            React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "A new code signs them out on every phone straight away."),
            moneyOn && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "code-box" },
                    React.createElement("div", { className: "code-main" },
                        React.createElement("span", { className: "muted small" },
                            "Classes in ",
                            monthLabel(month)),
                        React.createElement("span", { className: "count-big" }, r.classes ? `${Math.max(r.left, 0)} left` : `${r.used} taken`),
                        r.classes > 0 && React.createElement("span", { className: "muted small" },
                            r.used,
                            " of ",
                            r.classes,
                            " taken",
                            r.left < 0 ? `, ${-r.left} extra` : "")),
                    React.createElement("div", { className: "pay-actions" },
                        React.createElement("input", { id: "log-date-" + r.id, className: "inp log-date", type: "date", min: min, max: max, "aria-label": "Class date", value: logDate, onChange: (e) => setLogDate(e.target.value) }),
                        placeOptions.length > 1 && React.createElement("select", { id: "log-place-" + r.id, className: "inp log-date", "aria-label": "Where", value: logPlace, onChange: (e) => setLogPlace(e.target.value) }, placeOptions.map((p) => React.createElement("option", { key: p, value: p }, p))),
                        React.createElement("button", { type: "button", className: "btn sm", disabled: !logOk, onClick: () => onLogClass(logDate, logPlace) },
                            React.createElement(Icon, { name: "plus", size: 16 }),
                            "Log a class")),
                    r.takenList.length > 0 && (React.createElement("ul", { className: "pay-list taken-list", "aria-label": "Classes taken" }, r.takenList.map((x) => (React.createElement("li", { key: x.id },
                        React.createElement("span", null, fmtDate(x.date)),
                        React.createElement(ConfirmButton, { iconOnly: true, label: `Remove the class on ${fmtDate(x.date)}`, onConfirm: () => onRemoveClass(x.id) }))))))),
                !r.classes && React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "Classes per month is set to 0 for this student. Change it with Edit student to see how many are left."),
                React.createElement("p", { className: "sub-h", style: { marginTop: 14 } },
                    "Payments in ",
                    monthLabel(month)))),
            moneyOn && r.pays.length > 0 && (React.createElement("ul", { className: "pay-list" }, r.pays.map((p) => (React.createElement("li", { key: p.id },
                React.createElement("span", null, fmtDate(p.date)),
                React.createElement("strong", null, fcfa(p.amount)),
                r.phone ? React.createElement(WaButton, { phone: r.phone, text: receiptText(r, p, month), ghost: true }, "Receipt") : React.createElement(CopyButton, { text: receiptText(r, p, month), label: "Copy the receipt", caption: "Copy receipt" }),
                React.createElement(ConfirmButton, { iconOnly: true, label: "Delete payment", onConfirm: () => onRemovePayment(p.id) })))))),
            moneyOn && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "Amount (FCFA)" },
                        React.createElement("input", { id: "pay-amt-" + r.id, className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", value: amount, onChange: (e) => setAmount(e.target.value) })),
                    React.createElement(Field, { label: "Date paid" },
                        React.createElement("input", { id: "pay-date-" + r.id, className: "inp", type: "date", value: date, onChange: (e) => setDate(e.target.value) }))),
                React.createElement("p", { className: "hint" },
                    "This payment counts toward ",
                    monthLabel(month),
                    "."))),
            React.createElement("div", { className: "form-actions" },
                moneyOn && React.createElement("button", { className: "btn", onClick: save, disabled: !valid }, "Save payment"),
                moneyOn && React.createElement("button", { className: "btn ghost sm", "aria-expanded": showReport, onClick: () => setShowReport((s) => !s) },
                    React.createElement(Icon, { name: "report", size: 15 }),
                    showReport ? "Hide report" : "Monthly report"),
                React.createElement("button", { className: "btn ghost sm", "aria-expanded": showCert, onClick: () => setShowCert((s) => !s) },
                    React.createElement(Icon, { name: "spark", size: 15 }),
                    showCert ? "Hide certificate" : "Certificate"),
                React.createElement("button", { className: "btn ghost sm", onClick: onEdit },
                    React.createElement(Icon, { name: "pencil", size: 15 }),
                    "Edit student"),
                React.createElement(ConfirmButton, { label: "Remove student", onConfirm: onRemove })),
            moneyOn && showReport && React.createElement(StudentReport, { r: r, month: month, lessons: lessons, decks: decks }),
            showCert && React.createElement(CertificatePanel, { r: r, teacherName: teacherName, downloads: downloads })));
    }
    function StudentsTeacher({ roster, saveRoster, pay, savePay, settings, saveSettings, lessons, decks, schedule = [], changes = [], places = [], downloads, teacherName, db, userId, flash }) {
        const [month, setMonth] = useState(monthKey(new Date()));
        const [form, setForm] = useState(null);
        const [openId, setOpenId] = useState(null);
        const money = useMoney(db, userId, month);
        const moneyOn = money.enabled && !money.failed;
        const att = useAttendance(moneyOn ? db : null, userId, month);
        const saveFailed = (e) => flash(e && e.code === "quota_exceeded" ? "Your private storage is full. Delete some old records, then try again." : "That didn't save. Check your connection and try again.");
        const groupNames = [...new Set(roster.map((r) => r.group).filter((g) => g && g !== EVERYONE))];
        const ctx = { schedule, changes, places };
        const rows = roster.map((s) => (Object.assign(Object.assign({}, s), studentMonth(s, money.fees, money.pays, att.taken, ctx)))).sort((a, b) => a.name.localeCompare(b.name));
        const placeOptions = useMemo(() => {
            const m = new Map();
            [...schedule.map(placeName), ...places.map((p) => p.name), "Home"].forEach((n) => { if (n && !m.has(placeKey(n)))
                m.set(placeKey(n), n); });
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
        const upd = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { [k]: e.target.value }));
        const submit = () => {
            const name = form.name.trim();
            if (!name)
                return;
            if (form.phone.trim() && !waDigits(form.phone)) {
                flash("That WhatsApp number looks too short. Use the full number.");
                return;
            }
            const id = form.id || uid();
            const fee = Number(form.fee) || 0;
            const prev = roster.find((r) => r.id === id);
            const code = (prev && prev.code) || newCode(roster, id);
            const entry = { id, name, group: form.group.trim() || name, code };
            if (form.level)
                entry.level = form.level;
            if (form.show && fee > 0)
                entry.due = fee;
            saveRoster(form.id ? roster.map((r) => (r.id === id ? entry : r)) : [...roster, entry]);
            if (moneyOn) {
                const fees = Object.assign(Object.assign({}, money.fees), { [id]: {
                        fee, share: (money.fees[id] && Number(money.fees[id].share)) || 0,
                        classes: String(form.classes).trim() === "" ? null : Math.max(0, Math.round(Number(form.classes) || 0)),
                        phone: form.phone.trim(), lang: form.lang,
                    } });
                money.saveFees(fees).catch(saveFailed);
            }
            setForm(null);
            flash(prev ? "Student saved." : `Saved. ${name}'s code is ${code}.`);
        };
        const removeStudent = (id) => {
            saveRoster(roster.filter((r) => r.id !== id));
            if (moneyOn && money.fees[id]) {
                const fees = Object.assign({}, money.fees);
                delete fees[id];
                money.saveFees(fees).catch(saveFailed);
            }
            setOpenId(null);
        };
        const addPayment = (studentId, amount, date) => {
            money.savePays([...money.pays, { id: uid(), studentId, amount, date }]).then(() => flash("Payment saved."), saveFailed);
        };
        const editStudent = (r) => {
            setForm({ id: r.id, name: r.name, group: r.group, fee: String(r.fee || r.due || ""), classes: r.classesCustom ? String(r.classes) : "", level: r.level || "", show: !!r.due, phone: r.phone, lang: r.lang });
            setOpenId(null);
            window.scrollTo(0, 0);
        };
        return (React.createElement("section", null,
            React.createElement("div", { className: "h-row" },
                React.createElement("h2", { className: "h" }, "Students"),
                !form && React.createElement("button", { className: "btn sm", onClick: () => setForm({ id: null, name: "", group: "", fee: "", classes: "", level: "", show: true, phone: "", lang: "fr" }) },
                    React.createElement(Icon, { name: "plus", size: 16 }),
                    "Add student")),
            !moneyOn && (React.createElement("p", { className: "note" }, money.enabled ? "Payments can't be loaded right now. Reload the page to try again." : "Sign in as the teacher to track fees and payments.")),
            form && (React.createElement("div", { className: "form" },
                React.createElement(Field, { label: "Name" },
                    React.createElement("input", { id: "st-name", className: "inp", value: form.name, onChange: upd("name") })),
                React.createElement(Field, { label: "Group" },
                    React.createElement("input", { id: "st-group", className: "inp", list: "bm-groups", value: form.group, placeholder: "Family class, Online group A...", onChange: upd("group") })),
                React.createElement("datalist", { id: "bm-groups" }, groupNames.map((g) => React.createElement("option", { key: g, value: g }))),
                React.createElement("p", { className: "hint" }, "Leave it empty for one-on-one classes. The student gets a group of their own. Each student gets a 4-number code to open the app."),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "Monthly fee (FCFA)" },
                        React.createElement("input", { id: "st-fee", className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", placeholder: "50000", value: form.fee, onChange: upd("fee") })),
                    React.createElement(Field, { label: "Classes per month" },
                        React.createElement("input", { id: "st-classes", className: "inp", type: "number", inputMode: "numeric", min: "0", step: "1", placeholder: String(DEFAULT_CLASSES), value: form.classes, disabled: !moneyOn, onChange: upd("classes") }))),
                React.createElement("p", { className: "hint" },
                    "Leave classes empty for ",
                    DEFAULT_CLASSES,
                    " a month (twice a week). Shares for places like the school are set in Business, then Settings."),
                React.createElement(Field, { label: "Level" },
                    React.createElement("select", { id: "st-level", className: "inp", value: form.level, onChange: upd("level") },
                        React.createElement("option", { value: "" }, "Not set"),
                        LEVELS.map((l) => React.createElement("option", { key: l.id, value: l.id }, l.en)))),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "WhatsApp number (private)" },
                        React.createElement("input", { id: "st-phone", className: "inp", type: "tel", inputMode: "tel", placeholder: "07 00 00 00 00", value: form.phone, disabled: !moneyOn, onChange: upd("phone") })),
                    React.createElement(Field, { label: "Messages in" },
                        React.createElement("select", { id: "st-lang", className: "inp", value: form.lang, disabled: !moneyOn, onChange: upd("lang") },
                            React.createElement("option", { value: "fr" }, "French"),
                            React.createElement("option", { value: "en" }, "English")))),
                React.createElement("p", { className: "hint" }, "For reminders, codes and monthly reports. Use the parent's number for children. Only you can see it."),
                React.createElement("label", { className: "check" },
                    React.createElement("input", { id: "st-show", type: "checkbox", checked: form.show, onChange: (e) => setForm(Object.assign(Object.assign({}, form), { show: e.target.checked })) }),
                    "Show this fee on their Pay screen"),
                React.createElement("p", { className: "hint" }, "The student sees their own fee. Anyone with the app link could find it in the page, so leave this off for fees you'd rather keep private."),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn", onClick: submit, disabled: !form.name.trim() }, "Save student"),
                    React.createElement("button", { className: "btn ghost", onClick: () => setForm(null) }, "Cancel")))),
            roster.length === 0 ? (!form && React.createElement(Empty, { text: "Add your students. Each one gets a code to open the app, and you track their payments here." })) : (React.createElement(React.Fragment, null,
                moneyOn && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "month-nav" },
                        React.createElement("button", { className: "icon-btn", "aria-label": "Previous month", onClick: () => { setMonth((m) => shiftMonth(m, -1)); setOpenId(null); } },
                            React.createElement(Icon, { name: "left", size: 20 })),
                        React.createElement("strong", null, monthLabel(month)),
                        React.createElement("button", { className: "icon-btn", "aria-label": "Next month", onClick: () => { setMonth((m) => shiftMonth(m, 1)); setOpenId(null); } },
                            React.createElement(Icon, { name: "right", size: 20 }))),
                    React.createElement("div", { className: "sum" },
                        React.createElement("p", { className: "muted small" },
                            "Collected",
                            money.ready ? "" : " (loading)"),
                        React.createElement("p", { className: "sum-big" }, fcfa(collected)),
                        React.createElement("p", { className: "muted small" },
                            "of ",
                            fcfa(expected),
                            " expected"),
                        React.createElement("div", { className: "bar", role: "img", "aria-label": `${pct}% collected` },
                            React.createElement("i", { style: { width: pct + "%" } })),
                        React.createElement("div", { className: "sum-line" },
                            React.createElement("span", null, "Still owed"),
                            React.createElement("strong", null, fcfa(owed))),
                        Object.keys(cutTotals).map((p) => React.createElement("div", { key: p, className: "sum-line" },
                            React.createElement("span", null,
                                "Share for ",
                                p),
                            React.createElement("strong", null, fcfa(cutTotals[p])))),
                        totalCut > 0 && React.createElement("div", { className: "sum-line" },
                            React.createElement("span", null, "Yours after shares"),
                            React.createElement("strong", null, fcfa(collected - totalCut))),
                        money.slow && React.createElement("p", { className: "hint", style: { margin: "8px 0 0" } }, "Payments can't be reached yet. What you see may be out of date.")),
                    money.ready && toPay.length > 0 && (React.createElement("div", { className: "remind" },
                        React.createElement("p", { className: "sub-h" },
                            "Still to pay in ",
                            monthLabel(month)),
                        React.createElement("ul", null, toPay.map((r) => (React.createElement("li", { key: r.id },
                            React.createElement("span", { className: "row-main" },
                                React.createElement("span", { className: "row-title" }, r.name),
                                React.createElement("span", { className: "row-sub" },
                                    fcfa(r.fee - r.paid),
                                    " left to pay")),
                            r.phone
                                ? React.createElement(WaButton, { phone: r.phone, text: reminderText(r, month, pay) }, "Remind")
                                : React.createElement("button", { className: "btn ghost sm", onClick: () => editStudent(r) }, "Add number"))))))))),
                React.createElement("ul", { className: "rows" }, rows.map((r) => (React.createElement("li", { key: r.id },
                    React.createElement("button", { className: "row-btn", "aria-expanded": openId === r.id, onClick: () => setOpenId(openId === r.id ? null : r.id) },
                        React.createElement("span", { className: "row-main" },
                            React.createElement("span", { className: "row-title" }, r.name),
                            React.createElement("span", { className: "row-sub" },
                                r.group,
                                ", code ",
                                r.code),
                            moneyOn && r.classes > 0 && (React.createElement("span", { className: "left-line" + (r.left <= 0 ? " out" : r.left <= 2 ? " low" : "") }, r.left >= 0 ? `${r.left} of ${r.classes} ${classWord(r.classes)} left` : `${-r.left} extra ${classWord(-r.left)} this month`))),
                        moneyOn && (React.createElement("span", { className: "amt" },
                            React.createElement("span", { className: "pill " + r.status }, STATUS[r.status]),
                            React.createElement("span", { className: "row-sub" },
                                num(r.paid),
                                r.fee ? ` of ${num(r.fee)}` : "")))),
                    openId === r.id && (React.createElement(StudentDetail, { key: r.id + month, r: r, month: month, moneyOn: moneyOn, lessons: lessons, decks: decks, placeOptions: placeOptions, defaultPlace: defaultPlaceOf(r), downloads: downloads, teacherName: teacherName, onPay: (amount, date) => addPayment(r.id, amount, date), onRemovePayment: (pid) => money.savePays(money.pays.filter((p) => p.id !== pid)).catch(saveFailed), onLogClass: (date, place) => att.save([...att.taken, { id: uid(), studentId: r.id, date, place }]).then(() => flash("Class logged."), saveFailed), onRemoveClass: (tid) => att.save(att.taken.filter((x) => x.id !== tid)).catch(saveFailed), onNewCode: () => { const c = newCode(roster, r.id); saveRoster(roster.map((x) => (x.id === r.id ? Object.assign(Object.assign({}, x), { code: c }) : x))); flash(`New code for ${r.name}: ${c}.`); }, onEdit: () => editStudent(r), onRemove: () => removeStudent(r.id) })))))))),
            React.createElement("section", { className: "pay-settings" },
                React.createElement("h2", { className: "h" }, "What students see"),
                React.createElement("label", { className: "check" },
                    React.createElement("input", { id: "show-status", type: "checkbox", checked: settings.showStatus, onChange: (e) => saveSettings(Object.assign(Object.assign({}, settings), { showStatus: e.target.checked })) }),
                    "Show students their classes left and whether they've paid"),
                React.createElement("p", { className: "hint" }, "They see it in Classes and Pay. It updates whenever you open the app, and anyone with a student's code can see that student's numbers.")),
            React.createElement(PaySettings, { pay: pay, savePay: savePay, flash: flash })));
    }
    /* ---------- business records (private to the teacher) ---------- */
    function useBiz(db, userId) {
        const path = db && userId ? "data/users/" + userId + "/biz" : "";
        const [biz, setBiz] = useState({ places: [], schools: [], teacher: { name: "", phone: "" } });
        const [ready, setReady] = useState(false);
        useEffect(() => {
            if (!path)
                return undefined;
            let un = () => { };
            try {
                un = db.doc(path).onSnapshot((s) => {
                    const d = (s.exists && s.data()) || {};
                    setBiz({ places: arr(d.places), schools: arr(d.schools), teacher: d.teacher && typeof d.teacher === "object" ? { name: d.teacher.name || "", phone: d.teacher.phone || "" } : { name: "", phone: "" } });
                    setReady(true);
                }, () => setReady(true));
            }
            catch (e) {
                setReady(true);
            }
            return () => un();
        }, [path]);
        const save = (next) => { setBiz(next); return queuedSet(db.doc(path), next); };
        return { on: !!path, ready, biz, save };
    }
    function useVisits(db, userId, month) {
        const path = db && userId ? "data/users/" + userId + "/money/visits/" + month : "";
        const [data, setData] = useState({ visits: [], paid: [] });
        useEffect(() => {
            if (!path)
                return undefined;
            setData({ visits: [], paid: [] });
            let un = () => { };
            try {
                un = db.doc(path).onSnapshot((s) => {
                    const d = (s.exists && s.data()) || {};
                    setData({ visits: arr(d.visits), paid: arr(d.paid) });
                }, () => { });
            }
            catch (e) { /* unavailable */ }
            return () => un();
        }, [path]);
        const save = (next) => { setData(next); return queuedSet(db.doc(path), next); };
        return { on: !!path, data, save };
    }
    function useLibrary(db, userId) {
        const path = db && userId ? "data/users/" + userId + "/money" : "";
        const [items, setItems] = useState([]);
        useEffect(() => {
            if (!path)
                return undefined;
            let un = () => { };
            try {
                un = db.doc(path).collection("library").onSnapshot((qs) => setItems(qs.docs.map((d) => (Object.assign({ id: d.id }, d.data())))), () => { });
            }
            catch (e) { /* unavailable */ }
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
        if (!sample)
            return null;
        if (gone)
            return React.createElement("p", { className: "hint" }, "Claude isn't available in this view. Reload the page to be asked again.");
        const run = async () => {
            if (!text.trim() || busy)
                return;
            setBusy(true);
            setMsg("Thinking. This can take up to a minute.");
            ctl.current = new AbortController();
            try {
                const data = await sample.json(makePrompt(text.trim()), { signal: ctl.current.signal, cache: false });
                if (onResult(data) === false)
                    setMsg("Claude's answer didn't come out right. Try again, or change the request.");
                else {
                    setMsg("");
                    setText("");
                }
            }
            catch (e) {
                const code = e && e.code;
                if (code === "cancelled")
                    setMsg("");
                else if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code))
                    setGone(true);
                else if (code === "rate_limited")
                    setMsg("Claude is busy, or you've reached your usage limit. Try again later.");
                else if (["invalid_json", "empty_completion", "refused"].includes(code))
                    setMsg("Claude's answer didn't come out right. Try again, or change the request.");
                else
                    setMsg("Something went wrong. Check your connection and try again.");
            }
            finally {
                setBusy(false);
            }
        };
        return (React.createElement("div", { className: "ask" },
            React.createElement("p", { className: "form-title" },
                React.createElement(Icon, { name: "spark", size: 16 }),
                title),
            React.createElement("div", { className: "inline-add", style: { marginBottom: msg ? 8 : 0 } },
                React.createElement("input", { className: "inp", "aria-label": label, placeholder: placeholder, value: text, disabled: busy, onChange: (e) => setText(e.target.value), onKeyDown: (e) => e.key === "Enter" && run() }),
                busy
                    ? React.createElement("button", { className: "btn ghost", onClick: () => ctl.current && ctl.current.abort() }, "Stop")
                    : React.createElement("button", { className: "btn", onClick: run, disabled: !text.trim() }, button)),
            msg && React.createElement("p", { className: "hint", role: "status", style: { margin: 0 } }, msg)));
    }
    /* ---------- lesson library ---------- */
    function Library({ items, onUse, onRemove }) {
        if (!items.length)
            return React.createElement(Empty, { text: "Your library is empty. Open a lesson and tap Save to library, then reuse it with any group." });
        const levelOf = (p) => (AUDIENCES.includes(p.level) ? p.level : "Other");
        return (React.createElement(React.Fragment, null, [...AUDIENCES, "Other"].map((level) => {
            const list = items.filter((p) => levelOf(p) === level).sort((a, b) => String(a.title).localeCompare(String(b.title)));
            if (!list.length)
                return null;
            return (React.createElement("div", { key: level, className: "day-block" },
                React.createElement("p", { className: "day-name" }, level),
                React.createElement("ul", { className: "rows" }, list.map((p) => (React.createElement("li", { key: p.id, className: "lib-row" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, p.title),
                        p.notes && React.createElement("span", { className: "row-sub clamp" }, p.notes)),
                    React.createElement("div", { className: "pay-actions" },
                        React.createElement("button", { className: "btn sm", onClick: () => onUse(p) }, "Use"),
                        React.createElement(ConfirmButton, { iconOnly: true, label: `Delete ${p.title}`, onConfirm: () => onRemove(p.id) }))))))));
        })));
    }
    /* ---------- lesson plans (courses.json at the site root, written from the teacher's Claude docs) ---------- */
    let coursesCache = null;
    function useCourses() {
        const [state, setState] = useState(() => (coursesCache ? { status: "ready", data: coursesCache } : { status: "loading", data: null }));
        const [tries, setTries] = useState(0);
        useEffect(() => {
            if (coursesCache)
                return undefined;
            let live = true;
            setState({ status: "loading", data: null });
            fetch(window.BM_COURSES || "courses.json")
                .then((r) => { if (!r.ok)
                throw new Error("http " + r.status); return r.json(); })
                .then((d) => {
                coursesCache = { courses: arr(d && d.courses).filter((c) => c && c.id), wordLists: arr(d && d.wordLists).filter((w) => w && w.id) };
                if (live)
                    setState({ status: "ready", data: coursesCache });
            })
                .catch(() => { if (live)
                setState({ status: "error", data: null }); });
            return () => { live = false; };
        }, [tries]);
        return Object.assign(Object.assign({}, state), { retry: () => setTries((n) => n + 1) });
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
            if (m[1] !== undefined) {
                out.push(src.slice(last, m.index));
                out.push(React.createElement("strong", { key: key + "-" + n++ }, m[1]));
            }
            else {
                out.push(src.slice(last, m.index) + m[2]);
                out.push(React.createElement("em", { key: key + "-" + n++ }, m[3]));
            }
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
            if (!line) {
                i++;
                continue;
            }
            const h = /^(#{2,4})\s+(.*)$/.exec(line);
            if (h) {
                blocks.push({ t: "h", level: h[1].length, text: h[2] });
                i++;
                continue;
            }
            if (line.startsWith("|")) {
                const rows = [];
                while (i < lines.length && lines[i].trim().startsWith("|")) {
                    const r = lines[i].trim();
                    if (!/^\|[\s:|-]+\|$/.test(r))
                        rows.push(r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
                    i++;
                }
                if (rows.length)
                    blocks.push({ t: "table", rows });
                continue;
            }
            const first = itemRe.exec(line);
            if (first) {
                const ordered = /^\d+\./.test(first[1]);
                const items = [];
                while (i < lines.length) {
                    const raw = lines[i];
                    const tr = raw.trim();
                    if (!tr)
                        break;
                    const indent = raw.length - raw.replace(/^\s+/, "").length;
                    const mm = itemRe.exec(tr);
                    if (indent >= 2 && items.length) {
                        const lastItem = items[items.length - 1];
                        if (mm)
                            lastItem.sub.push(mm[2]);
                        else
                            lastItem.text += " " + tr;
                        i++;
                        continue;
                    }
                    if (!mm || /^\d+\./.test(mm[1]) !== ordered)
                        break;
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
        return (React.createElement("div", { className: "md" }, blocks.map((b, k) => {
            if (b.t === "h")
                return b.level <= 3 ? React.createElement("h4", { key: k }, mdInline(b.text, k)) : React.createElement("h5", { key: k }, mdInline(b.text, k));
            if (b.t === "p")
                return React.createElement("p", { key: k }, mdInline(b.text, k));
            if (b.t === "table") {
                return (React.createElement("div", { key: k, className: "md-table" },
                    React.createElement("table", null,
                        React.createElement("thead", null,
                            React.createElement("tr", null, b.rows[0].map((c, j) => React.createElement("th", { key: j, scope: "col" }, mdInline(c, k + "h" + j))))),
                        React.createElement("tbody", null, b.rows.slice(1).map((r, ri) => React.createElement("tr", { key: ri }, r.map((c, j) => React.createElement("td", { key: j }, mdInline(c, k + "r" + ri + "c" + j)))))))));
            }
            const List = b.t === "ol" ? "ol" : "ul";
            return (React.createElement(List, { key: k }, b.items.map((it, j) => (React.createElement("li", { key: j },
                mdInline(it.text, k + "i" + j),
                it.sub.length > 0 && React.createElement("ul", null, it.sub.map((x, si) => React.createElement("li", { key: si }, mdInline(x, k + "i" + j + "s" + si)))))))));
        })));
    }
    function WordListOffers({ lists, decks, saveDecks, groups, flash }) {
        const [openId, setOpenId] = useState(null);
        const [group, setGroup] = useState(EVERYONE);
        const added = (w) => decks.some((d) => d.title === w.title);
        const add = (w) => {
            const cards = arr(w.cards).map((c) => { const x = { id: uid(), en: String(c.en || ""), fr: String(c.fr || ""), ex: String(c.ex || "") }; if (c.pic)
                x.pic = String(c.pic); return x; }).filter((c) => c.en && c.fr);
            saveDecks([{ id: uid(), title: w.title, group, cards }, ...decks]);
            setOpenId(null);
            flash(`${w.title} is in Words now, for ${group}.`);
        };
        const parts = [["Picture lists for kids", lists.filter((w) => w.kids)], ["More word lists", lists.filter((w) => !w.kids)]].filter(([, l]) => l.length);
        return (React.createElement("div", { className: "day-block" },
            React.createElement("p", { className: "day-name" }, "Word lists"),
            React.createElement("p", { className: "hint" }, "Ready-made lists with the French. Add one and your students can practice it with flashcards and quizzes. Lists with pictures also get two games for kids: Listen and Memory."),
            parts.map(([label, part]) => (React.createElement("div", { key: label },
                React.createElement("p", { className: "sub-h" }, label),
                React.createElement("ul", { className: "rows" }, part.map((w) => (React.createElement("li", { key: w.id, className: "lib-row" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" },
                            w.kids && arr(w.cards)[0] && React.createElement("span", { "aria-hidden": "true" },
                                arr(w.cards)[0].pic,
                                " "),
                            w.title),
                        React.createElement("span", { className: "row-sub" },
                            arr(w.cards).length,
                            " words. ",
                            w.about)),
                    React.createElement("div", { className: "pay-actions" }, added(w) ? React.createElement("span", { className: "muted small" },
                        React.createElement(Icon, { name: "check", size: 15 }),
                        " In Words")
                        : openId !== w.id && React.createElement("button", { className: "btn sm", onClick: () => { setGroup(groups[1] || EVERYONE); setOpenId(w.id); } }, "Add to Words")),
                    openId === w.id && (React.createElement("div", { className: "inline-add lib-add" },
                        React.createElement("select", { className: "inp", "aria-label": `Who ${w.title} is for`, value: group, onChange: (e) => setGroup(e.target.value) }, groups.map((g) => React.createElement("option", { key: g, value: g }, g))),
                        React.createElement("button", { className: "btn sm", onClick: () => add(w) }, "Add"),
                        React.createElement("button", { className: "btn ghost sm", onClick: () => setOpenId(null) }, "Cancel"))))))))))));
    }
    /* Each student's own list of lessons: data/users/{uid}/plans/{studentId} = { items: [{ id, course, item } | { id, custom: { title, notes, homework } }, used?] } */
    function usePlans(db, userId) {
        const path = db && userId ? "data/users/" + userId + "/plans" : "";
        const [plans, setPlans] = useState({});
        const [ready, setReady] = useState(false);
        useEffect(() => {
            if (!path)
                return undefined;
            let un = () => { };
            try {
                un = db.collection(path).onSnapshot((qs) => {
                    const next = {};
                    qs.docs.forEach((d) => { next[d.id] = arr((d.data() || {}).items); });
                    setPlans(next);
                    setReady(true);
                }, () => setReady(true));
            }
            catch (e) {
                setReady(true);
            }
            return () => un();
        }, [path]);
        const save = (studentId, items) => {
            setPlans((cur) => (Object.assign(Object.assign({}, cur), { [studentId]: items })));
            return queuedSet(db.collection(path).doc(studentId), { items, updated: new Date().toISOString() });
        };
        return { on: !!path, ready, plans, save };
    }
    const PLAN_SKIP = ["Start here", "Checklists", "Extras"];
    const isLessonItem = (it) => !PLAN_SKIP.includes(it.section);
    const lessonTopic = (title) => String(title || "").replace(/^(Lesson \d+|Bonus [A-Z]|Week \d+)\s*[–:-]\s*/, "");
    function LessonPage({ backLabel, onBack, kicker, title, actions, body, prev, next, onPrev, onNext }) {
        return (React.createElement("article", { className: "lib-item" },
            React.createElement("button", { className: "back-link", onClick: onBack },
                React.createElement(Icon, { name: "left" }),
                backLabel),
            kicker && React.createElement("p", { className: "muted small" }, kicker),
            React.createElement("h3", { className: "lib-title" }, title),
            actions && React.createElement("div", { className: "lib-use" }, actions),
            React.createElement(Md, { text: body }),
            React.createElement("div", { className: "lib-nav" },
                prev ? React.createElement("button", { className: "btn ghost sm", onClick: onPrev },
                    React.createElement(Icon, { name: "left", size: 16 }),
                    "Previous") : React.createElement("span", null),
                next && React.createElement("button", { className: "btn ghost sm", onClick: onNext },
                    "Next",
                    React.createElement(Icon, { name: "right", size: 16 })))));
    }
    function AddToStudent({ roster, onAdd }) {
        const [open, setOpen] = useState(false);
        const [sid, setSid] = useState("");
        if (!roster.length)
            return null;
        if (!open)
            return React.createElement("button", { className: "btn ghost sm", onClick: () => { setSid(roster[0].id); setOpen(true); } },
                React.createElement(Icon, { name: "plus", size: 15 }),
                "Add to a student's lessons");
        return (React.createElement("div", { className: "inline-add lib-add" },
            React.createElement("select", { className: "inp", "aria-label": "Which student", value: sid, onChange: (e) => setSid(e.target.value) }, roster.map((r) => React.createElement("option", { key: r.id, value: r.id }, r.name))),
            React.createElement("button", { className: "btn sm", onClick: () => { onAdd(sid); setOpen(false); } }, "Add"),
            React.createElement("button", { className: "btn ghost sm", onClick: () => setOpen(false) }, "Cancel")));
    }
    function AddLessons({ student, courses, have, onAddItems, onAddCustom, onBack }) {
        const [openCourse, setOpenCourse] = useState(null);
        const [picked, setPicked] = useState(() => new Set());
        const [custom, setCustom] = useState({ title: "", notes: "", homework: "" });
        const toggle = (key) => setPicked((cur) => { const n = new Set(cur); if (n.has(key))
            n.delete(key);
        else
            n.add(key); return n; });
        const addPicked = () => {
            const list = [];
            courses.forEach((c) => arr(c.items).forEach((it) => { if (picked.has(c.id + "/" + it.id))
                list.push({ course: c.id, item: it.id }); }));
            onAddItems(list);
        };
        const addBtn = picked.size > 0 && React.createElement("button", { className: "btn", onClick: addPicked },
            "Add ",
            picked.size,
            " ",
            picked.size === 1 ? "lesson" : "lessons");
        return (React.createElement("section", null,
            React.createElement("button", { className: "back-link", onClick: onBack },
                React.createElement(Icon, { name: "left" }),
                student.name,
                "'s lessons"),
            React.createElement("h3", { className: "lib-title" },
                "Add lessons for ",
                student.name),
            React.createElement("p", { className: "hint" },
                "Add a whole course, or tap Pick lessons and tick the ones you want. They go on ",
                student.name,
                "'s list in course order."),
            addBtn && React.createElement("div", { className: "lib-use" }, addBtn),
            React.createElement("ul", { className: "rows" }, courses.map((c) => {
                const lessons = arr(c.items).filter(isLessonItem);
                const fresh = lessons.filter((it) => !have.has(c.id + "/" + it.id));
                const isOpen = openCourse === c.id;
                return (React.createElement("li", { key: c.id },
                    React.createElement("div", { className: "lib-row" },
                        React.createElement("div", { className: "row-main" },
                            React.createElement("span", { className: "row-title" }, c.title),
                            React.createElement("span", { className: "row-sub" },
                                lessons.length,
                                " ",
                                lessons.length === 1 ? "lesson" : "lessons",
                                fresh.length < lessons.length ? `, ${lessons.length - fresh.length} already on the list` : "")),
                        React.createElement("div", { className: "pay-actions" },
                            fresh.length > 0 && React.createElement("button", { className: "btn sm", onClick: () => onAddItems(fresh.map((it) => ({ course: c.id, item: it.id }))) }, fresh.length === 1 ? "Add it" : `Add all ${fresh.length}`),
                            React.createElement("button", { className: "btn ghost sm", "aria-expanded": isOpen, onClick: () => setOpenCourse(isOpen ? null : c.id) }, isOpen ? "Close" : "Pick lessons"))),
                    isOpen && (React.createElement("div", { className: "pick-list" },
                        lessons.map((it) => {
                            const key = c.id + "/" + it.id;
                            const already = have.has(key);
                            return (React.createElement("label", { key: it.id, className: "check" },
                                React.createElement("input", { type: "checkbox", checked: already || picked.has(key), disabled: already, onChange: () => toggle(key) }),
                                React.createElement("span", null,
                                    it.title,
                                    already && React.createElement("span", { className: "muted small" }, " (on the list)"))));
                        }),
                        addBtn && React.createElement("div", { className: "lib-use" }, addBtn)))));
            })),
            React.createElement("div", { className: "day-block" },
                React.createElement("p", { className: "day-name" },
                    "Or write a lesson just for ",
                    student.name),
                React.createElement("div", { className: "form" },
                    React.createElement(Field, { label: "Title" },
                        React.createElement("input", { id: "own-title", className: "inp", value: custom.title, placeholder: "Talking about my weekend", onChange: (e) => setCustom(Object.assign(Object.assign({}, custom), { title: e.target.value })) })),
                    React.createElement(Field, { label: "The plan" },
                        React.createElement("textarea", { id: "own-notes", className: "inp", value: custom.notes, placeholder: "New words, phrases, what you'll do in class...", onChange: (e) => setCustom(Object.assign(Object.assign({}, custom), { notes: e.target.value })) })),
                    React.createElement(Field, { label: "Home practice (optional)" },
                        React.createElement("textarea", { id: "own-hw", className: "inp", value: custom.homework, placeholder: "Send me a voice note about your weekend.", onChange: (e) => setCustom(Object.assign(Object.assign({}, custom), { homework: e.target.value })) })),
                    React.createElement("div", { className: "form-actions" },
                        React.createElement("button", { className: "btn", disabled: !custom.title.trim(), onClick: () => onAddCustom({ title: custom.title.trim(), notes: custom.notes.trim(), homework: custom.homework.trim() }) },
                            "Add to ",
                            student.name,
                            "'s lessons"))))));
    }
    function CourseLibrary({ saved, onUse, onRemoveSaved, decks, saveDecks, groups, flash, roster = [], plansH, progressMap = {} }) {
        const { status, data, retry } = useCourses();
        const [nav, setNav] = useState({ view: "home" });
        const [q, setQ] = useState("");
        const go = (n) => { setNav(n); window.scrollTo(0, 0); };
        const fail = () => flash("That didn't save. Check your connection and try again.");
        const savedBlock = saved.length > 0 && (React.createElement("div", { className: "day-block" },
            React.createElement("p", { className: "day-name" }, "Saved by you"),
            React.createElement(Library, { items: saved, onUse: onUse, onRemove: onRemoveSaved })));
        if (status === "loading")
            return React.createElement("p", { className: "muted" }, "Opening your lesson plans...");
        if (status === "error") {
            return (React.createElement(React.Fragment, null,
                React.createElement(Empty, { text: "Your lesson plans didn't load. Check your connection and try again." },
                    React.createElement("button", { className: "btn sm", onClick: retry }, "Try again")),
                savedBlock));
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
            if (!f)
                return { p, missing: true, title: "A lesson that's no longer in the library", from: "" };
            return { p, title: f.it.title, from: f.c.title, body: f.it.body, send: f.it.send || { title: lessonTopic(f.it.title), notes: "", homework: "" } };
        });
        const savePlan = (sid, items, msg) => plansH.save(sid, items).then(() => { if (msg)
            flash(msg); }, fail);
        const appendTo = (sid, list) => {
            const cur = planOf(sid);
            const have = new Set(cur.filter((x) => !x.custom).map((x) => x.course + "/" + x.item));
            const add = list.filter((x) => x.custom || !have.has(x.course + "/" + x.item)).map((x) => (Object.assign({ id: uid() }, x)));
            const who = (roster.find((r) => r.id === sid) || {}).name || "the student";
            if (!add.length) {
                flash(`That's already on ${who}'s list.`);
                return;
            }
            savePlan(sid, [...cur, ...add], add.length === 1 ? `Added to ${who}'s lessons.` : `Added ${add.length} lessons to ${who}'s list.`);
        };
        const studentLine = (r) => {
            const es = entriesOf(r.id);
            const done = es.filter((e) => e.p.used).length;
            const nextE = es.find((e) => !e.p.used && !e.missing);
            const grp = r.group && r.group !== r.name ? r.group + ". " : "";
            if (!es.length)
                return grp + "No lessons yet";
            return grp + `${done} of ${es.length} taught` + (nextE ? `. Next: ${nextE.title}` : ". All taught");
        };
        /* one student's list */
        if ((nav.view === "student" || nav.view === "add" || nav.view === "plan" || nav.view === "skills") && plansOn) {
            const r = roster.find((x) => x.id === nav.studentId);
            if (!r) {
                setTimeout(() => go({ view: "home" }), 0);
                return null;
            }
            const entries = entriesOf(r.id);
            if (nav.view === "skills") {
                const planCourseIds = [...new Set(planOf(r.id).filter((x) => !x.custom).map((x) => x.course))];
                return React.createElement(SkillsEditor, { student: r, courses: courses, planCourseIds: planCourseIds, prog: progressMap[r.id], flash: flash, onBack: () => go({ view: "student", studentId: r.id }) });
            }
            if (nav.view === "add") {
                const have = new Set(planOf(r.id).filter((x) => !x.custom).map((x) => x.course + "/" + x.item));
                return (React.createElement(AddLessons, { student: r, courses: courses, have: have, onBack: () => go({ view: "student", studentId: r.id }), onAddItems: (list) => { appendTo(r.id, list); go({ view: "student", studentId: r.id }); }, onAddCustom: (cu) => { appendTo(r.id, [{ custom: cu }]); go({ view: "student", studentId: r.id }); } }));
            }
            if (nav.view === "plan") {
                const live = entries.filter((e) => !e.missing);
                const k = live.findIndex((e) => e.p.id === nav.planId);
                const e = live[k];
                if (!e) {
                    setTimeout(() => go({ view: "student", studentId: r.id }), 0);
                    return null;
                }
                const setUsed = (val) => savePlan(r.id, planOf(r.id).map((x) => (x.id === e.p.id ? Object.assign(Object.assign({}, x), { used: val || null }) : x)), val ? "Marked as taught." : "Marked as not taught yet.");
                return (React.createElement(LessonPage, { backLabel: `${r.name}'s lessons`, onBack: () => go({ view: "student", studentId: r.id }), kicker: e.from + (e.p.used ? `. Taught ${fmtDate(e.p.used)}` : ""), title: e.title, body: e.body, actions: (React.createElement(React.Fragment, null,
                        React.createElement("button", { className: "btn", onClick: () => onUse(e.send, { group: r.group, studentId: r.id, planId: e.p.id }) }, e.p.used ? `Use again for ${r.name}` : `Use for ${r.name}'s class`),
                        React.createElement("p", { className: "hint" },
                            "Opens a new lesson for ",
                            r.group || r.name,
                            " with the words and home practice filled in. Saving it marks this lesson as taught."),
                        React.createElement("div", { className: "pay-actions" },
                            e.p.used ? React.createElement("button", { className: "btn ghost sm", onClick: () => setUsed(null) }, "Mark as not taught")
                                : React.createElement("button", { className: "btn ghost sm", onClick: () => setUsed(todayISO()) },
                                    React.createElement(Icon, { name: "check", size: 15 }),
                                    "Mark as taught"),
                            React.createElement(ConfirmButton, { label: `Remove from ${r.name}'s lessons`, onConfirm: () => { savePlan(r.id, planOf(r.id).filter((x) => x.id !== e.p.id), "Removed from the list."); go({ view: "student", studentId: r.id }); } })))), prev: live[k - 1], next: live[k + 1], onPrev: () => go({ view: "plan", studentId: r.id, planId: live[k - 1].p.id }), onNext: () => go({ view: "plan", studentId: r.id, planId: live[k + 1].p.id }) }));
            }
            const done = entries.filter((e) => e.p.used).length;
            const nextIdx = entries.findIndex((e) => !e.p.used && !e.missing);
            return (React.createElement("section", null,
                React.createElement("button", { className: "back-link", onClick: () => go({ view: "home" }) },
                    React.createElement(Icon, { name: "left" }),
                    "Library"),
                React.createElement("h3", { className: "lib-title" }, r.name),
                React.createElement("p", { className: "muted lib-about" },
                    r.group && r.group !== r.name ? `Group: ${r.group}. ` : "",
                    entries.length ? `${done} of ${entries.length} lessons taught.` : "No lessons on the list yet."),
                React.createElement("div", { className: "lib-use pay-actions" },
                    React.createElement("button", { className: "btn", onClick: () => go({ view: "add", studentId: r.id }) },
                        React.createElement(Icon, { name: "plus", size: 16 }),
                        "Add lessons"),
                    React.createElement("button", { className: "btn ghost", onClick: () => go({ view: "skills", studentId: r.id }) },
                        React.createElement(Icon, { name: "award", size: 16 }),
                        "What ",
                        r.name,
                        " can do",
                        (() => { const n = Object.keys(((progressMap[r.id] || {}).skills) || {}).length; return n ? ` (${n})` : ""; })())),
                entries.length === 0 ? React.createElement(Empty, { text: `Add a whole course for ${r.name}, pick single lessons, or write your own.` }) : (React.createElement("ul", { className: "rows" }, entries.map((e, k) => (React.createElement("li", { key: e.p.id }, e.missing ? (React.createElement("div", { className: "lib-row" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-sub" }, e.title)),
                    React.createElement(ConfirmButton, { iconOnly: true, label: "Remove it", onConfirm: () => savePlan(r.id, planOf(r.id).filter((x) => x.id !== e.p.id)) }))) : (React.createElement("button", { className: "row-btn", onClick: () => go({ view: "plan", studentId: r.id, planId: e.p.id }) },
                    React.createElement("span", { className: "plan-num" + (e.p.used ? " is-done" : k === nextIdx ? " is-next" : ""), "aria-hidden": "true" }, e.p.used ? React.createElement(Icon, { name: "check", size: 14 }) : k + 1),
                    React.createElement("span", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, e.title),
                        React.createElement("span", { className: "row-sub" }, e.p.used ? `Taught ${fmtDate(e.p.used)}` : k === nextIdx ? `Next. ${e.from}` : e.from)),
                    React.createElement(Icon, { name: "right" }))))))))));
        }
        /* a course and its lessons */
        const course = courses.find((c) => c.id === nav.courseId);
        const items = course ? arr(course.items) : [];
        if (nav.view === "item" && course) {
            const k = items.findIndex((x) => x.id === nav.itemId);
            const item = items[k];
            if (item) {
                return (React.createElement(LessonPage, { backLabel: course.title, onBack: () => go({ view: "course", courseId: course.id }), kicker: item.section, title: item.title, body: item.body, actions: (React.createElement(React.Fragment, null,
                        item.send && React.createElement("button", { className: "btn", onClick: () => onUse(item.send) }, "Use for a class"),
                        item.send && React.createElement("p", { className: "hint" }, "Opens a new lesson with the words and home practice filled in, ready to pick the group and save for your students."),
                        plansOn && isLessonItem(item) && React.createElement(AddToStudent, { roster: students, onAdd: (sid) => appendTo(sid, [{ course: course.id, item: item.id }]) }))), prev: items[k - 1], next: items[k + 1], onPrev: () => go({ view: "item", courseId: course.id, itemId: items[k - 1].id }), onNext: () => go({ view: "item", courseId: course.id, itemId: items[k + 1].id }) }));
            }
        }
        if ((nav.view === "course" || nav.view === "item") && course) {
            const sections = [];
            items.forEach((it) => {
                let sec = sections.find((x) => x.name === it.section);
                if (!sec) {
                    sec = { name: it.section || "", intro: "", list: [] };
                    sections.push(sec);
                }
                if (it.sectionIntro)
                    sec.intro = it.sectionIntro;
                sec.list.push(it);
            });
            return (React.createElement("section", null,
                React.createElement("button", { className: "back-link", onClick: () => go({ view: "home" }) },
                    React.createElement(Icon, { name: "left" }),
                    "Library"),
                React.createElement("h3", { className: "lib-title" }, course.title),
                course.about && React.createElement("p", { className: "muted lib-about" }, course.about),
                sections.map((sec) => (React.createElement("div", { key: sec.name, className: "day-block" },
                    React.createElement("p", { className: "day-name" }, sec.name),
                    sec.intro && React.createElement("p", { className: "hint" }, sec.intro),
                    React.createElement("ul", { className: "rows" }, sec.list.map((it) => (React.createElement("li", { key: it.id },
                        React.createElement("button", { className: "row-btn", onClick: () => go({ view: "item", courseId: course.id, itemId: it.id }) },
                            React.createElement("span", { className: "row-main" },
                                React.createElement("span", { className: "row-title" }, it.title),
                                it.send && it.send.notes && React.createElement("span", { className: "row-sub clamp" }, it.send.notes.split("\n")[0])),
                            React.createElement(Icon, { name: "right" })))))))))));
        }
        /* the Library's first page */
        const ql = q.trim().toLowerCase();
        const hits = ql.length >= 2
            ? courses.flatMap((c) => arr(c.items).filter((it) => (it.title + "\n" + it.body).toLowerCase().includes(ql)).map((it) => ({ c, it }))).slice(0, 40)
            : [];
        return (React.createElement(React.Fragment, null,
            React.createElement("input", { className: "inp lib-search", type: "search", "aria-label": "Search your lesson plans", placeholder: "Search, e.g. colors or airport", value: q, onChange: (e) => setQ(e.target.value) }),
            ql.length >= 2 ? (hits.length ? (React.createElement("ul", { className: "rows" }, hits.map(({ c, it }) => (React.createElement("li", { key: c.id + it.id },
                React.createElement("button", { className: "row-btn", onClick: () => { setQ(""); go({ view: "item", courseId: c.id, itemId: it.id }); } },
                    React.createElement("span", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, it.title),
                        React.createElement("span", { className: "row-sub" }, c.title)),
                    React.createElement(Icon, { name: "right" }))))))) : React.createElement(Empty, { text: `Nothing in your lesson plans matches "${q.trim()}".` })) : (React.createElement(React.Fragment, null,
                plansOn && (React.createElement("div", { className: "day-block" },
                    React.createElement("p", { className: "day-name" }, "Your students"),
                    students.length === 0 ? React.createElement("p", { className: "hint" }, "Add your students in the Students tab, and each one gets a list of lessons here.") : (React.createElement("ul", { className: "rows" }, students.map((r) => (React.createElement("li", { key: r.id },
                        React.createElement("button", { className: "row-btn", onClick: () => go({ view: "student", studentId: r.id }) },
                            React.createElement("span", { className: "row-main" },
                                React.createElement("span", { className: "row-title" }, r.name),
                                React.createElement("span", { className: "row-sub" }, studentLine(r))),
                            React.createElement(Icon, { name: "right" }))))))))),
                React.createElement("div", { className: "day-block" },
                    React.createElement("p", { className: "day-name" }, "All lesson plans"),
                    courses.length === 0 ? React.createElement(Empty, { text: "No lesson plans yet." }) : (React.createElement("ul", { className: "rows" }, courses.map((c) => (React.createElement("li", { key: c.id },
                        React.createElement("button", { className: "row-btn", onClick: () => go({ view: "course", courseId: c.id }) },
                            React.createElement("span", { className: "row-main" },
                                React.createElement("span", { className: "row-title" }, c.title),
                                React.createElement("span", { className: "row-sub" }, c.about)),
                            React.createElement(Icon, { name: "right" })))))))),
                data.wordLists.length > 0 && React.createElement(WordListOffers, { lists: data.wordLists, decks: decks, saveDecks: saveDecks, groups: groups, flash: flash }),
                savedBlock))));
    }
    /* ---------- "What I can do": skills from the lesson plans, ticked by the teacher ---------- */
    function skillRows(courses, skills, extraIds = []) {
        const ticked = Object.keys(skills || {});
        const ids = new Set(extraIds);
        ticked.forEach((k) => ids.add(k.split("/")[0]));
        return courses.filter((c) => ids.has(c.id) && arr(c.skills).length);
    }
    function ProgressStudent({ me, prog }) {
        const { t, lang } = useT();
        const { status, data } = useCourses();
        const skills = (prog && prog.skills) || {};
        const replies = Object.values((prog && prog.replies) || {});
        const stars = replies.reduce((s, r) => s + (Number(r.stars) || 0), 0);
        const done = Object.keys(skills).length;
        const courses = status === "ready" ? skillRows(data.courses, skills, arr(prog && prog.courses)) : [];
        return (React.createElement("section", null,
            React.createElement("h2", { className: "h" }, t("progressTitle")),
            React.createElement("div", { className: "seyes progress-sum" },
                React.createElement("p", { className: "progress-big" }, done),
                React.createElement("p", null, t("skillsCount", done)),
                stars > 0 && React.createElement("p", { className: "progress-stars" },
                    React.createElement(Icon, { name: "star", size: 18 }),
                    t("starsFromTeacher", stars))),
            prog === null || status === "loading" ? React.createElement("p", { className: "muted" }, t("loadingProgress"))
                : courses.length === 0 ? React.createElement(Empty, { text: t("noSkillsYet") }) : courses.map((c) => {
                    const units = [];
                    arr(c.skills).forEach((s) => { let u = units.find((x) => x.name === s.unit); if (!u) {
                        u = { name: s.unit, fr: s.unitFr || s.unit, list: [] };
                        units.push(u);
                    } u.list.push(s); });
                    return units.map((u) => (React.createElement("div", { key: c.id + u.name, className: "day-block" },
                        React.createElement("p", { className: "day-name" }, lang === "fr" ? u.fr : u.name),
                        React.createElement("ul", { className: "skill-list" }, u.list.map((s) => {
                            const when = skills[c.id + "/" + s.id];
                            return (React.createElement("li", { key: s.id, className: when ? "got" : "" },
                                React.createElement("span", { className: "skill-mark", "aria-hidden": "true" }, when ? React.createElement(Icon, { name: "check", size: 15 }) : null),
                                React.createElement("span", { className: "skill-text" },
                                    lang === "fr" ? s.fr : s.en,
                                    React.createElement("span", { className: "muted small skill-when" }, when ? t("canDoSince", fmtDate(when, lang)) : t("comingNext")))));
                        })))));
                })));
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
            const next = Object.assign({}, skills);
            if (next[key])
                delete next[key];
            else
                next[key] = todayISO();
            save(next, shown.map((c) => c.id));
        };
        const total = shown.reduce((n, c) => n + arr(c.skills).length, 0);
        const got = shown.reduce((n, c) => n + arr(c.skills).filter((s) => skills[c.id + "/" + s.id]).length, 0);
        return (React.createElement("section", null,
            React.createElement("button", { className: "back-link", onClick: onBack },
                React.createElement(Icon, { name: "left" }),
                student.name,
                "'s lessons"),
            React.createElement("h3", { className: "lib-title" },
                "What ",
                student.name,
                " can do"),
            React.createElement("p", { className: "hint" },
                "Tick a skill when ",
                student.name,
                " can do it without help. ",
                student.name,
                " and their family see the list, in English or French, in the Progress tab with their code."),
            shown.length > 0 && React.createElement("p", { className: "muted lib-about" },
                got,
                " of ",
                total,
                " ticked."),
            shown.length === 0 && React.createElement(Empty, { text: `Add a course to ${student.name}'s lessons, or pick one below, to see its skills.` }),
            shown.map((c) => {
                const units = [];
                arr(c.skills).forEach((s) => { let u = units.find((x) => x.name === s.unit); if (!u) {
                    u = { name: s.unit, list: [] };
                    units.push(u);
                } u.list.push(s); });
                return (React.createElement("div", { key: c.id, className: "day-block" },
                    React.createElement("p", { className: "day-name" }, c.title),
                    units.map((u) => (React.createElement("div", { key: u.name, className: "skill-unit" },
                        React.createElement("p", { className: "sub-h" }, u.name),
                        u.list.map((s) => {
                            const key = c.id + "/" + s.id;
                            return (React.createElement("label", { key: s.id, className: "check skill-check" },
                                React.createElement("input", { type: "checkbox", checked: !!skills[key], onChange: () => toggle(key) }),
                                React.createElement("span", null,
                                    s.en,
                                    skills[key] && React.createElement("span", { className: "muted small" },
                                        " \u00B7 ",
                                        fmtDate(skills[key])))));
                        }))))));
            }),
            others.length > 0 && (React.createElement("div", { className: "inline-add" },
                React.createElement("select", { className: "inp", "aria-label": "Show skills from another course", value: "", onChange: (e) => { if (e.target.value)
                        setExtra((x) => [...x, e.target.value]); } },
                    React.createElement("option", { value: "" }, "Show skills from another course..."),
                    others.map((c) => React.createElement("option", { key: c.id, value: c.id }, c.title)))))));
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
            loadVoice(v).then((u) => { made = u; if (live)
                setUrl(u);
            else
                URL.revokeObjectURL(u); }, () => { if (live)
                setFailed(true); });
            if (!v.heard)
                FB.db.doc("voice/" + v.id).set({ heard: true }, { merge: true }).catch(() => { });
            return () => { live = false; if (made)
                URL.revokeObjectURL(made); };
        }, [v.id]);
        const send = () => {
            setBusy(true);
            const r = { stars, note: note.trim(), title: v.title || "", lessonId: v.lessonId || "", at: todayISO() };
            Promise.all([saveReply(v.sid, v.id, r), FB.db.doc("voice/" + v.id).set({ heard: true, replied: true }, { merge: true })])
                .then(() => flash(`Reply sent. ${v.name} sees it under that homework.`), () => flash("That didn't save. Check your connection and try again."))
                .then(() => setBusy(false));
        };
        return (React.createElement("div", { className: "voice-open" },
            failed ? React.createElement("p", { className: "say-result error" }, "This recording didn't load. Check your connection and try again.")
                : url ? React.createElement("audio", { controls: true, src: url, className: "voice-audio" }) : React.createElement("p", { className: "muted small" }, "Loading the recording..."),
            React.createElement("p", { className: "sub-h" }, "Your reply"),
            React.createElement("div", { className: "star-pick", role: "group", "aria-label": "Stars" }, [1, 2, 3].map((n) => (React.createElement("button", { key: n, className: "star-btn" + (stars >= n ? " on" : ""), "aria-label": `${n} ${n === 1 ? "star" : "stars"}`, "aria-pressed": stars === n, onClick: () => setStars(stars === n ? 0 : n) },
                React.createElement(Icon, { name: "star", size: 26 }))))),
            React.createElement(Field, { label: "A short note (optional)" },
                React.createElement("textarea", { className: "inp", rows: 2, value: note, placeholder: "Great pronunciation! Next time, say 'three' with your tongue between your teeth.", onChange: (e) => setNote(e.target.value) })),
            React.createElement("div", { className: "pay-actions" },
                React.createElement("button", { className: "btn", onClick: send, disabled: busy || (!stars && !note.trim()) }, reply ? "Update reply" : "Send reply"),
                React.createElement(ConfirmButton, { label: "Delete recording", onConfirm: () => deleteVoice(v).then(() => flash("Recording deleted."), () => flash("That didn't delete. Try again.")) }))));
    }
    function VoiceInbox({ notes, progressMap, flash }) {
        const [openId, setOpenId] = useState(null);
        const list = Object.values(notes).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
        if (!list.length)
            return React.createElement(Empty, { text: "When students record their homework, their voice notes show up here." });
        return (React.createElement("ul", { className: "rows voice-list" }, list.map((v) => {
            const reply = ((progressMap[v.sid] || {}).replies || {})[v.id];
            const isOpen = openId === v.id;
            const d = v.at ? new Date(v.at) : null;
            const when = d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ", " + d.toTimeString().slice(0, 5) : "";
            return (React.createElement("li", { key: v.id },
                React.createElement("button", { className: "row-btn", "aria-expanded": isOpen, onClick: () => setOpenId(isOpen ? null : v.id) },
                    React.createElement("span", { className: "row-main" },
                        React.createElement("span", { className: "row-title" },
                            v.name,
                            !v.heard && React.createElement("span", { className: "new-chip" }, "New")),
                        React.createElement("span", { className: "row-sub" },
                            v.title ? v.title + ". " : "",
                            when,
                            ". ",
                            mmss(v.secs || 0),
                            reply ? `. Replied${reply.stars ? " " + "★".repeat(reply.stars) : ""}` : "")),
                    React.createElement(Icon, { name: isOpen ? "x" : "play", size: 16 })),
                isOpen && React.createElement(VoiceNote, { v: v, reply: reply, flash: flash })));
        })));
    }
    /* ---------- cancelling and moving a class ---------- */
    function upcomingClasses(slots, changes, now, days = 14) {
        const out = [];
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (let k = 0; k < days; k++) {
            const d = new Date(start);
            d.setDate(start.getDate() + k);
            const iso = isoOf(d);
            const wd = (d.getDay() + 6) % 7;
            slots.forEach((s) => {
                if (Number(s.day) !== wd)
                    return;
                if (changes.some((c) => c.slot === s.id && c.date === iso))
                    return;
                const [h, m] = (s.start || "00:00").split(":").map(Number);
                const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
                if (at.getTime() + (Number(s.minutes) || 60) * 60000 <= now.getTime())
                    return;
                out.push({ s, at, date: iso, key: s.id });
            });
        }
        changes.forEach((c) => {
            if (!c.makeup)
                return;
            const s = slots.find((x) => x.id === c.slot);
            if (!s)
                return;
            const [h, m] = (c.makeup.start || "00:00").split(":").map(Number);
            const md = parseISO(c.makeup.date);
            const at = new Date(md.getFullYear(), md.getMonth(), md.getDate(), h, m);
            if (at.getTime() + (Number(s.minutes) || 60) * 60000 <= now.getTime())
                return;
            out.push({ s, at, date: c.makeup.date, key: c.id, makeup: true });
        });
        return out.sort((a, b) => a.at - b.at);
    }
    function nextDatesOf(slot, count = 6) {
        const out = [];
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (let k = 0; k < 60 && out.length < count; k++) {
            if ((d.getDay() + 6) % 7 === Number(slot.day))
                out.push(isoOf(d));
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
            if (withMakeup && (!mDate || mDate < todayISO() || !mStart)) {
                setErr("Pick a make-up date from today on, and a start time.");
                return;
            }
            onSave({ date, note: note.trim(), makeup: withMakeup ? { date: mDate, start: mStart } : null });
        };
        return (React.createElement("div", { className: "form" },
            React.createElement("p", { className: "form-title" },
                change ? "Schedule the make-up class" : "Cancel or move a class",
                ": ",
                slot.group,
                ", ",
                DAYS.en[slot.day],
                " ",
                slot.start),
            !change && (React.createElement(Field, { label: "Which class" },
                React.createElement("select", { id: "chg-date", className: "inp", value: date, onChange: (e) => setDate(e.target.value) }, dates.map((d) => React.createElement("option", { key: d, value: d }, fmtDate(d)))))),
            !change && React.createElement(Field, { label: "Note for students (optional)" },
                React.createElement("input", { id: "chg-note", className: "inp", value: note, placeholder: "Sorry, I have a football match.", onChange: (e) => setNote(e.target.value) })),
            !change && React.createElement("label", { className: "check" },
                React.createElement("input", { id: "chg-makeup", type: "checkbox", checked: withMakeup, onChange: (e) => setWithMakeup(e.target.checked) }),
                "Move it: schedule a make-up class now"),
            withMakeup && (React.createElement("div", { className: "grid2" },
                React.createElement(Field, { label: "Make-up date" },
                    React.createElement("input", { id: "chg-mdate", className: "inp", type: "date", min: todayISO(), value: mDate, onChange: (e) => setMDate(e.target.value) })),
                React.createElement(Field, { label: "Starts at" },
                    React.createElement("input", { id: "chg-mstart", className: "inp", type: "time", value: mStart, onChange: (e) => setMStart(e.target.value) })))),
            !change && !withMakeup && React.createElement("p", { className: "hint" }, "The class goes on your list of make-ups you owe. Students won't be counted for it."),
            React.createElement("p", { className: "hint" }, "The group gets an announcement in French and English automatically."),
            err && React.createElement("p", { className: "err", role: "alert" }, err),
            React.createElement("div", { className: "form-actions" },
                React.createElement("button", { className: "btn", onClick: save }, change ? "Save make-up class" : withMakeup ? "Move class" : "Cancel class"),
                React.createElement("button", { className: "btn ghost", onClick: onCancel }, "Go back"))));
    }
    /* ---------- receipts, school invoices, certificates ---------- */
    function receiptText(r, p, month) {
        const fr = r.lang === "fr";
        const m = monthLabel(month, r.lang);
        const rest = Math.max(0, r.fee - r.paid);
        const no = `${month.replace("-", "")}-${String(p.id).slice(0, 4).toUpperCase()}`;
        if (fr)
            return [`Reçu Bright Minds N° ${no}`, `Élève : ${r.name}`, `Montant reçu : ${fcfa(p.amount)}`, `Pour : ${m}`, `Date : ${fmtDate(p.date, "fr")}`, r.fee ? (rest > 0 ? `Reste à payer : ${fcfa(rest)}` : `${cap(m)} réglé.`) : "", "Merci !"].filter(Boolean).join("\n");
        return [`Bright Minds receipt No. ${no}`, `Student: ${r.name}`, `Amount received: ${fcfa(p.amount)}`, `For: ${m}`, `Date: ${fmtDate(p.date, "en")}`, r.fee ? (rest > 0 ? `Still to pay: ${fcfa(rest)}` : `${cap(m)} is fully paid.`) : "", "Thank you!"].filter(Boolean).join("\n");
    }
    function schoolSummary(r, month) {
        const fr = r.lang !== "en";
        const m = monthLabel(month, fr ? "fr" : "en");
        const who = r.contact || r.name;
        const rest = Math.max(0, r.due - r.paid);
        if (fr)
            return `Bonjour ${who}, voici le récapitulatif des cours d'anglais Bright Minds pour ${m} : ${r.vs.length} séance${r.vs.length > 1 ? "s" : ""}, ${plainNum(r.hours, 2)} heure${r.hours > 1 ? "s" : ""}. Total : ${fcfa(r.due)}${r.paid > 0 ? `, déjà payé ${fcfa(r.paid)}, reste ${fcfa(rest)}` : ""}. Je vous envoie la facture N° ${r.number}. Merci !`;
        return `Hello ${who}, here is the Bright Minds English classes summary for ${m}: ${r.vs.length} visit${r.vs.length === 1 ? "" : "s"}, ${plainNum(r.hours, 2)} hours. Total: ${fcfa(r.due)}${r.paid > 0 ? `, already paid ${fcfa(r.paid)}, balance ${fcfa(rest)}` : ""}. I'm sending invoice No. ${r.number}. Thank you!`;
    }
    function winAnsi(s) {
        return Array.from(String(s)).map((ch) => {
            const c = ch.charCodeAt(0);
            if (c < 256)
                return ch;
            if (c === 0x2018 || c === 0x2019)
                return "'";
            if (c === 0x201c || c === 0x201d)
                return '"';
            if (c === 0x2013 || c === 0x2014)
                return "-";
            if (c === 0x2026)
                return "...";
            if (c === 0x202f || c === 0x2009)
                return " ";
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
                if (f.widthOfTextAtSize(tryLine, size) > maxW && line) {
                    text(line, x, yy, size, f, color);
                    yy -= size + 4;
                    line = w;
                }
                else
                    line = tryLine;
            });
            if (line) {
                text(line, x, yy, size, f, color);
                yy -= size + 4;
            }
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
        if (teacher.name)
            text(teacher.name, X, y);
        right(`Date : ${new Date().toLocaleDateString(LOCALE[L], { day: "numeric", month: "long", year: "numeric" })}`, R, y);
        y -= 14;
        if (teacher.phone)
            text(teacher.phone, X, y);
        y -= 42;
        text(fr ? "Facturé à" : "Billed to", X, y, 10, bold, soft);
        y -= 17;
        text(school.name, X, y, 13, bold);
        if (school.contact) {
            y -= 15;
            text(`${fr ? "À l'attention de" : "Attention:"} ${school.contact}`, X, y);
        }
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
            text(desc, X, y);
            right(qty, 350, y);
            right(price, 445, y);
            right(total, R, y);
            y -= 9;
            page.drawLine({ start: { x: X - 8, y }, end: { x: R + 6, y }, thickness: 0.6, color: rule });
            y -= 17;
        };
        row(fr ? "Cours d'anglais (heures)" : "English classes (hours)", plainNum(hours, 2), plainNum(school.rate), plainNum(hours * school.rate));
        if (school.transport)
            row(fr ? "Transport (déplacements)" : "Transport (visits)", String(visits.length), plainNum(school.transport), plainNum(visits.length * school.transport));
        y -= 4;
        right(`TOTAL : ${plainNum(due)} FCFA`, R, y, 13, bold);
        if (paid > 0) {
            y -= 18;
            right(`${fr ? "Déjà payé :" : "Already paid:"} ${plainNum(paid)} FCFA`, R, y, 11, font, soft);
            y -= 16;
            right(`${fr ? "Reste à payer :" : "Balance due:"} ${plainNum(Math.max(0, due - paid))} FCFA`, R, y, 11, bold);
        }
        y -= 36;
        text(fr ? "Détail des séances" : "Sessions", X, y, 10, bold, soft);
        y -= 16;
        y = wrap(visits.map((x) => `${fmtShort(x.date, L)} (${plainNum(x.hours, 2)} h)`).join(", ") || "-", X, y, R - X);
        const methods = pay.methods.filter((m) => m.number);
        if (methods.length) {
            y -= 18;
            text(fr ? "Paiement" : "Payment", X, y, 10, bold, soft);
            y -= 16;
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
        c.width = W;
        c.height = H;
        const g = c.getContext("2d");
        try {
            await Promise.all([document.fonts.load('60px "Playwrite FR Moderne"'), document.fonts.load('bold 90px "Atkinson Hyperlegible"'), document.fonts.load('34px "Atkinson Hyperlegible"')]);
        }
        catch (e) { /* fallback fonts */ }
        const fr = lang === "fr";
        const ink = "#1C2A6B", soft = "#59628C";
        g.fillStyle = "#FBFBFE";
        g.fillRect(0, 0, W, H);
        for (let y = 70; y < H - 60; y += 16) {
            g.fillStyle = (y - 70) % 64 === 0 ? "#CDD0F0" : "#E7E9F8";
            g.fillRect(70, y, W - 140, 1.5);
        }
        g.fillStyle = "#DB3B55";
        g.fillRect(200, 62, 4, H - 124);
        g.strokeStyle = ink;
        g.lineWidth = 12;
        g.strokeRect(34, 34, W - 68, H - 68);
        g.lineWidth = 2;
        g.strokeRect(62, 62, W - 124, H - 124);
        const cx = (W + 204) / 2;
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillStyle = ink;
        g.font = '62px "Playwrite FR Moderne", "Segoe Script", cursive';
        g.fillText(fr ? "Certificat de réussite" : "Certificate of Achievement", cx, 260);
        g.fillStyle = soft;
        g.font = 'bold 30px "Atkinson Hyperlegible", sans-serif';
        g.fillText("Bright Minds", cx, 330);
        g.font = '34px "Atkinson Hyperlegible", sans-serif';
        g.fillText(fr ? "Nous certifions que" : "This certifies that", cx, 430);
        let size = 100;
        g.font = `bold ${size}px "Atkinson Hyperlegible", sans-serif`;
        while (g.measureText(name).width > W - 520 && size > 48) {
            size -= 4;
            g.font = `bold ${size}px "Atkinson Hyperlegible", sans-serif`;
        }
        const nw = g.measureText(name).width;
        g.fillStyle = "#FFE45C";
        g.fillRect(cx - nw / 2 - 16, 560 - size * 0.34, nw + 32, size * 0.4);
        g.fillStyle = ink;
        g.fillText(name, cx, 560);
        g.font = '38px "Atkinson Hyperlegible", sans-serif';
        g.fillText(fr ? `a terminé avec succès le niveau ${level} en anglais.` : `has successfully completed the ${level} level in English.`, cx, 660);
        g.textAlign = "left";
        g.fillStyle = soft;
        g.font = '30px "Atkinson Hyperlegible", sans-serif';
        const dateText = new Date().toLocaleDateString(LOCALE[lang], { day: "numeric", month: "long", year: "numeric" });
        g.fillText(fr ? `Fait le ${dateText}` : `Date: ${dateText}`, 260, 930);
        g.textAlign = "center";
        g.fillStyle = ink;
        g.fillRect(1020, 900, 420, 2);
        g.font = 'bold 32px "Atkinson Hyperlegible", sans-serif';
        if (teacher)
            g.fillText(teacher, 1230, 950);
        g.fillStyle = soft;
        g.font = '28px "Atkinson Hyperlegible", sans-serif';
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
            setBusy(true);
            setMsg("");
            try {
                const c = await drawCertificate({ name: r.name, level: levelName(level, lang), lang, teacher: teacherName });
                canvas.current = c;
                setUrl(c.toDataURL("image/png"));
            }
            catch (e) {
                setMsg("The certificate couldn't be made. Try again.");
            }
            setBusy(false);
        };
        const save = () => {
            if (!canvas.current)
                return;
            if (!downloads) {
                setMsg("Saving files isn't available in this view. Press and hold the picture to save it.");
                return;
            }
            canvas.current.toBlob(async (blob) => {
                try {
                    await downloads.save({ filename: `Certificate-${fileSafe(r.name)}.png`, data: blob });
                    setMsg("Saved. Send it to the family on WhatsApp.");
                }
                catch (e) {
                    setMsg(e && e.code === "declined" ? "" : "The picture couldn't be saved. Try again.");
                }
            }, "image/png");
        };
        return (React.createElement("div", { className: "report" },
            React.createElement("p", { className: "form-title" }, "Certificate"),
            React.createElement("div", { className: "grid2" },
                React.createElement(Field, { label: "Level completed" },
                    React.createElement("select", { id: "cert-level-" + r.id, className: "inp", value: level, onChange: (e) => { setLevel(e.target.value); setUrl(""); } }, LEVELS.map((l) => React.createElement("option", { key: l.id, value: l.id }, l.en)))),
                React.createElement(Field, { label: "Language" },
                    React.createElement("select", { id: "cert-lang-" + r.id, className: "inp", value: lang, onChange: (e) => { setLang(e.target.value); setUrl(""); } },
                        React.createElement("option", { value: "fr" }, "French"),
                        React.createElement("option", { value: "en" }, "English")))),
            !teacherName && React.createElement("p", { className: "hint" }, "Add your name in Business, then Settings, to sign the certificate."),
            React.createElement("div", { className: "form-actions" },
                React.createElement("button", { className: "btn", onClick: make, disabled: busy }, busy ? "Making..." : url ? "Make it again" : "Make certificate"),
                url && React.createElement("button", { className: "btn ghost", onClick: save }, "Save picture")),
            url && React.createElement("img", { className: "cert-img", src: url, alt: `Certificate for ${r.name}` }),
            msg && React.createElement("p", { className: "hint", role: "status", style: { margin: "10px 0 0" } }, msg)));
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
            if (!(h > 0) || date < min || date > max)
                return;
            v.save(Object.assign(Object.assign({}, v.data), { visits: [...v.data.visits, { id: uid(), schoolId: r.id, date, hours: h }] })).then(() => flash("Visit logged."), fail);
        };
        const recordPay = () => {
            const a = Number(amount);
            if (!(a > 0))
                return;
            v.save(Object.assign(Object.assign({}, v.data), { paid: [...v.data.paid, { id: uid(), schoolId: r.id, amount: a, date: todayISO() }] })).then(() => { flash("Payment recorded."); setAmount(null); }, fail);
        };
        const invoice = async () => {
            if (!downloads) {
                flash("Saving files isn't available in this browser.");
                return;
            }
            setBusy(true);
            try {
                const blob = await invoicePdf({ school: r, visits: r.vs, hours: r.hours, due: r.due, paid: r.paid, month, number: r.number, teacher, pay });
                await downloads.save({ filename: `${lang === "fr" ? "Facture" : "Invoice"}-${fileSafe(r.name)}-${month}.pdf`, data: blob });
                flash("Invoice saved. Send it to the school on WhatsApp.");
            }
            catch (e) {
                if (!(e && e.code === "declined"))
                    flash(e && e.message === "load failed" ? "The invoice maker couldn't load. Check your connection and try again." : "The invoice couldn't be made. Try again.");
            }
            setBusy(false);
        };
        const summary = schoolSummary(r, month);
        return (React.createElement("div", { className: "expand" },
            React.createElement("p", { className: "hint", style: { marginTop: 0 } },
                fcfa(r.rate),
                " an hour",
                r.transport ? `, plus ${fcfa(r.transport)} transport per visit` : "",
                ". Invoices in ",
                lang === "fr" ? "French" : "English",
                "."),
            React.createElement("div", { className: "code-box" },
                React.createElement("div", { className: "code-main" },
                    React.createElement("span", { className: "muted small" },
                        "Visits in ",
                        monthLabel(month)),
                    React.createElement("span", { className: "count-big" }, fcfa(r.due)),
                    React.createElement("span", { className: "muted small" },
                        r.vs.length,
                        " ",
                        r.vs.length === 1 ? "visit" : "visits",
                        ", ",
                        plainNum(r.hours, 2),
                        " hours",
                        r.paid ? `, ${fcfa(r.paid)} paid` : "")),
                React.createElement("div", { className: "pay-actions" },
                    React.createElement("input", { id: "visit-date-" + r.id, className: "inp log-date", type: "date", min: min, max: max, "aria-label": "Visit date", value: date, onChange: (e) => setDate(e.target.value) }),
                    React.createElement("input", { id: "visit-hours-" + r.id, className: "inp log-date hours-inp", type: "number", inputMode: "decimal", min: "0.5", step: "0.5", "aria-label": "Hours", value: hours, onChange: (e) => setHours(e.target.value) }),
                    React.createElement("button", { type: "button", className: "btn sm", disabled: !(h > 0), onClick: logVisit },
                        React.createElement(Icon, { name: "plus", size: 16 }),
                        "Log visit")),
                r.vs.length > 0 && (React.createElement("ul", { className: "pay-list taken-list", "aria-label": "Visits" }, r.vs.map((x) => (React.createElement("li", { key: x.id },
                    React.createElement("span", null, fmtDate(x.date)),
                    React.createElement("strong", null,
                        plainNum(x.hours, 2),
                        " h"),
                    React.createElement(ConfirmButton, { iconOnly: true, label: `Remove the visit on ${fmtDate(x.date)}`, onConfirm: () => v.save(Object.assign(Object.assign({}, v.data), { visits: v.data.visits.filter((y) => y.id !== x.id) })).catch(fail) }))))))),
            React.createElement("div", { className: "form-actions", style: { marginBottom: 14 } },
                React.createElement("button", { className: "btn", onClick: invoice, disabled: busy || !r.vs.length },
                    React.createElement(Icon, { name: "report", size: 16 }),
                    busy ? "Making invoice..." : "Invoice (PDF)"),
                r.phone ? React.createElement(WaButton, { phone: r.phone, text: summary, ghost: true }, "Send summary") : React.createElement(CopyButton, { text: summary, label: "Copy the summary", caption: "Copy summary" })),
            React.createElement("p", { className: "sub-h" }, "Payments from the school"),
            r.pays.length > 0 && (React.createElement("ul", { className: "pay-list" }, r.pays.map((p) => (React.createElement("li", { key: p.id },
                React.createElement("span", null, fmtDate(p.date)),
                React.createElement("strong", null, fcfa(p.amount)),
                React.createElement(ConfirmButton, { iconOnly: true, label: "Delete payment", onConfirm: () => v.save(Object.assign(Object.assign({}, v.data), { paid: v.data.paid.filter((y) => y.id !== p.id) })).catch(fail) })))))),
            React.createElement("div", { className: "inline-add" },
                React.createElement("input", { id: "school-pay-" + r.id, className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", "aria-label": "Amount paid (FCFA)", placeholder: "Amount (FCFA)", value: amount, onChange: (e) => setAmount(e.target.value) }),
                React.createElement("button", { className: "btn", onClick: recordPay, disabled: !(Number(amount) > 0) }, "Record payment")),
            React.createElement("div", { className: "form-actions" },
                React.createElement("button", { className: "btn ghost sm", onClick: onEdit },
                    React.createElement(Icon, { name: "pencil", size: 15 }),
                    "Edit school"),
                React.createElement(ConfirmButton, { label: "Remove school", onConfirm: onRemove }))));
    }
    function SchoolsSection({ biz, saveBiz, db, userId, flash, pay, downloads }) {
        const [month, setMonth] = useState(monthKey(new Date()));
        const v = useVisits(db, userId, month);
        const [form, setForm] = useState(null);
        const [err, setErr] = useState("");
        const [openId, setOpenId] = useState(null);
        const fail = () => flash("That didn't save. Check your connection and try again.");
        const teacher = { name: biz.teacher.name || pay.accountName, phone: biz.teacher.phone || pay.whatsapp };
        const upd = (k) => (e) => setForm(Object.assign(Object.assign({}, form), { [k]: e.target.value }));
        const submit = () => {
            const name = form.name.trim();
            if (!name) {
                setErr("Add the school's name.");
                return;
            }
            if (!(Number(form.rate) > 0)) {
                setErr("Add the hourly rate in FCFA.");
                return;
            }
            if (form.phone.trim() && !waDigits(form.phone)) {
                setErr("That WhatsApp number looks too short. Use the full number.");
                return;
            }
            const s = { id: form.id || uid(), name, contact: form.contact.trim(), phone: form.phone.trim(), rate: Number(form.rate), transport: Number(form.transport) || 0, lang: form.lang };
            saveBiz(Object.assign(Object.assign({}, biz), { schools: form.id ? biz.schools.map((x) => (x.id === s.id ? s : x)) : [...biz.schools, s] })).then(() => flash("School saved."), fail);
            setForm(null);
            setErr("");
        };
        const rows = biz.schools.map((s, i) => {
            const vs = v.data.visits.filter((x) => x.schoolId === s.id).sort((a, b) => a.date.localeCompare(b.date));
            const hours = vs.reduce((a, x) => a + (Number(x.hours) || 0), 0);
            const due = hours * s.rate + vs.length * (s.transport || 0);
            const pays = v.data.paid.filter((x) => x.schoolId === s.id);
            const paid = pays.reduce((a, x) => a + (Number(x.amount) || 0), 0);
            return Object.assign(Object.assign({}, s), { vs, hours, due, paid, pays, number: `BM-${month.replace("-", "")}-${pad(i + 1)}` });
        });
        const totalDue = rows.reduce((a, r) => a + r.due, 0);
        const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
        return (React.createElement("div", null,
            React.createElement("div", { className: "h-row" },
                React.createElement("p", { className: "sub-h", style: { margin: 0 } }, "Schools you visit"),
                !form && React.createElement("button", { className: "btn sm", onClick: () => { setErr(""); setForm({ id: null, name: "", contact: "", phone: "", rate: "", transport: "", lang: "fr" }); } },
                    React.createElement(Icon, { name: "plus", size: 16 }),
                    "Add school")),
            form && (React.createElement("div", { className: "form" },
                React.createElement(Field, { label: "School name" },
                    React.createElement("input", { id: "sc-name", className: "inp", value: form.name, onChange: upd("name") })),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "Contact person" },
                        React.createElement("input", { id: "sc-contact", className: "inp", value: form.contact, placeholder: "The director", onChange: upd("contact") })),
                    React.createElement(Field, { label: "Their WhatsApp" },
                        React.createElement("input", { id: "sc-phone", className: "inp", type: "tel", inputMode: "tel", placeholder: "07 00 00 00 00", value: form.phone, onChange: upd("phone") })),
                    React.createElement(Field, { label: "Rate per hour (FCFA)" },
                        React.createElement("input", { id: "sc-rate", className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", placeholder: "12500", value: form.rate, onChange: upd("rate") })),
                    React.createElement(Field, { label: "Transport per visit (FCFA)" },
                        React.createElement("input", { id: "sc-transport", className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", placeholder: "0", value: form.transport, onChange: upd("transport") }))),
                React.createElement(Field, { label: "Invoice language" },
                    React.createElement("select", { id: "sc-lang", className: "inp", value: form.lang, onChange: upd("lang") },
                        React.createElement("option", { value: "fr" }, "French"),
                        React.createElement("option", { value: "en" }, "English"))),
                err && React.createElement("p", { className: "err", role: "alert" }, err),
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn", onClick: submit }, "Save school"),
                    React.createElement("button", { className: "btn ghost", onClick: () => { setForm(null); setErr(""); } }, "Cancel")))),
            rows.length === 0 ? (!form && React.createElement(Empty, { text: "Add a school you teach at. Log each visit, and the app makes the monthly invoice for you." })) : (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "month-nav" },
                    React.createElement("button", { className: "icon-btn", "aria-label": "Previous month", onClick: () => { setMonth((m) => shiftMonth(m, -1)); setOpenId(null); } },
                        React.createElement(Icon, { name: "left", size: 20 })),
                    React.createElement("strong", null, monthLabel(month)),
                    React.createElement("button", { className: "icon-btn", "aria-label": "Next month", onClick: () => { setMonth((m) => shiftMonth(m, 1)); setOpenId(null); } },
                        React.createElement(Icon, { name: "right", size: 20 }))),
                React.createElement("div", { className: "sum" },
                    React.createElement("p", { className: "muted small" }, "Due from schools"),
                    React.createElement("p", { className: "sum-big" }, fcfa(totalDue)),
                    React.createElement("div", { className: "sum-line" },
                        React.createElement("span", null, "Paid so far"),
                        React.createElement("strong", null, fcfa(totalPaid)))),
                React.createElement("ul", { className: "rows" }, rows.map((r) => (React.createElement("li", { key: r.id },
                    React.createElement("button", { className: "row-btn", "aria-expanded": openId === r.id, onClick: () => setOpenId(openId === r.id ? null : r.id) },
                        React.createElement("span", { className: "row-main" },
                            React.createElement("span", { className: "row-title" }, r.name),
                            React.createElement("span", { className: "row-sub" },
                                r.vs.length,
                                " ",
                                r.vs.length === 1 ? "visit" : "visits",
                                ", ",
                                plainNum(r.hours, 2),
                                " hours")),
                        React.createElement("span", { className: "amt" },
                            React.createElement("span", { className: "pill " + (r.due === 0 ? "none" : r.paid >= r.due ? "paid" : r.paid > 0 ? "partial" : "unpaid") }, r.due === 0 ? "No visits" : r.paid >= r.due ? "Paid" : r.paid > 0 ? "Part paid" : "Not paid"),
                            React.createElement("span", { className: "row-sub" },
                                num(r.due),
                                " FCFA"))),
                    openId === r.id && (React.createElement(SchoolDetail, { key: r.id + month, r: r, month: month, v: v, teacher: teacher, pay: pay, downloads: downloads, flash: flash, fail: fail, onEdit: () => { setErr(""); setForm({ id: r.id, name: r.name, contact: r.contact || "", phone: r.phone || "", rate: String(r.rate), transport: r.transport ? String(r.transport) : "", lang: r.lang || "fr" }); setOpenId(null); window.scrollTo(0, 0); }, onRemove: () => { saveBiz(Object.assign(Object.assign({}, biz), { schools: biz.schools.filter((x) => x.id !== r.id) })).catch(fail); setOpenId(null); } }))))))))));
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
        for (let v = 0; v <= top + 1; v += step)
            ticks.push(v);
        const bw = (W - padL - padR) / months.length;
        const barW = Math.min(46, bw * 0.56);
        const y = (v) => padT + (H - padT - padB) * (1 - v / top);
        const h = months[hover];
        return (React.createElement("div", { className: "chart" },
            React.createElement("div", { className: "legend" }, SERIES.map((s) => React.createElement("span", { key: s.k },
                React.createElement("i", { className: "sw " + s.cls }),
                s.label))),
            React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Money collected each month for the last 6 months, by type of class" },
                ticks.map((v) => (React.createElement("g", { key: v },
                    React.createElement("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), className: "grid" }),
                    React.createElement("text", { x: padL - 8, y: y(v) + 4, className: "tick", textAnchor: "end" }, shortMoney(v))))),
                months.map((m, i) => {
                    const cx = padL + bw * i + bw / 2;
                    let acc = 0;
                    const segs = SERIES.map((s) => { const val = m[s.k]; const y0 = y(acc); acc += val; return val > 0 ? { s, y0, y1: y(acc) } : null; }).filter(Boolean);
                    return (React.createElement("g", { key: m.m, className: "col" + (hover === i ? " on" : ""), tabIndex: 0, role: "button", "aria-label": `${monthLabel(m.m)}: ${fcfa(m.total)} collected`, onMouseEnter: () => setHover(i), onFocus: () => setHover(i), onClick: () => setHover(i) },
                        React.createElement("rect", { x: padL + bw * i, y: padT, width: bw, height: H - padT - padB, className: "hit" }),
                        segs.map((g, j) => (React.createElement("rect", { key: g.s.k, x: cx - barW / 2, y: g.y1, width: barW, height: Math.max(1, g.y0 - g.y1 - (j > 0 ? 2 : 0)), rx: j === segs.length - 1 ? 4 : 0, className: "seg-bar " + g.s.cls }))),
                        React.createElement("text", { x: cx, y: H - 10, textAnchor: "middle", className: "tick" + (hover === i ? " strong" : "") }, parseISO(m.m + "-01").toLocaleDateString("en-US", { month: "short" }))));
                })),
            h && (React.createElement("div", { className: "chart-detail", role: "status" },
                React.createElement("strong", null, monthLabel(h.m)),
                SERIES.map((s) => React.createElement("span", { key: s.k },
                    React.createElement("i", { className: "sw " + s.cls }),
                    s.label,
                    ": ",
                    fcfa(h[s.k]))),
                React.createElement("span", null,
                    "Total ",
                    fcfa(h.total),
                    ", yours after shares ",
                    fcfa(h.yours))))));
    }
    function IncomeSection({ db, userId, roster, schedule, changes, places }) {
        const [state, setState] = useState({ loading: true, slow: false, months: [] });
        useEffect(() => {
            if (!db || !userId)
                return undefined;
            let alive = true;
            const slowTimer = setTimeout(() => alive && setState((s) => (Object.assign(Object.assign({}, s), { slow: true }))), 10000);
            const base = "data/users/" + userId + "/money";
            const keys = [5, 4, 3, 2, 1, 0].map((k) => shiftMonth(monthKey(new Date()), -k));
            const get = (p) => db.doc(p).get().then((s) => (s.exists && s.data()) || {}).catch(() => ({}));
            Promise.all([get(base), ...keys.flatMap((m) => [get(base + "/months/" + m), get(base + "/attendance/" + m), get(base + "/visits/" + m)])]).then(([feesDoc, ...rest]) => {
                if (!alive)
                    return;
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
                        if (sm.online)
                            online += sm.paid;
                        else
                            priv += sm.paid;
                        cut += sm.cut;
                    });
                    pays.forEach((p) => { if (!seen.has(p.studentId))
                        priv += Number(p.amount) || 0; });
                    const schools = arr(visits.paid).reduce((a, p) => a + (Number(p.amount) || 0), 0);
                    const total = priv + online + schools;
                    return { m, priv, online, schools, total, cut, yours: total - cut };
                });
                setState({ loading: false, slow: false, months });
            });
            return () => { alive = false; clearTimeout(slowTimer); };
        }, [db, userId]);
        if (state.loading)
            return React.createElement("p", { className: "empty", role: "status" }, state.slow ? "Your records can't be reached yet. Check your connection." : "Adding up your last 6 months...");
        const sum = state.months.reduce((a, m) => a + m.yours, 0);
        return (React.createElement("div", null,
            React.createElement("div", { className: "sum" },
                React.createElement("p", { className: "muted small" }, "Yours after shares, last 6 months"),
                React.createElement("p", { className: "sum-big" }, fcfa(sum)),
                React.createElement("p", { className: "muted small" },
                    "About ",
                    fcfa(sum / 6),
                    " a month")),
            React.createElement(IncomeChart, { months: state.months }),
            React.createElement("div", { className: "table-wrap" },
                React.createElement("table", { className: "tbl" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", { scope: "col" }, "Month"),
                            React.createElement("th", { scope: "col" }, "Collected"),
                            React.createElement("th", { scope: "col" }, "Shares"),
                            React.createElement("th", { scope: "col" }, "Yours"))),
                    React.createElement("tbody", null, [...state.months].reverse().map((m) => (React.createElement("tr", { key: m.m },
                        React.createElement("th", { scope: "row" }, monthLabel(m.m)),
                        React.createElement("td", null, num(m.total)),
                        React.createElement("td", null, num(m.cut)),
                        React.createElement("td", null,
                            React.createElement("strong", null, num(m.yours))))))))),
            React.createElement("p", { className: "hint", style: { marginTop: 10 } }, "Amounts in FCFA, from the payments you record. Online groups are students whose classes have an online link or take place online.")));
    }
    /* ---------- Business tab: settings ---------- */
    function BizSettings({ biz, saveBiz, schedule, pay, flash }) {
        const names = useMemo(() => {
            const seen = new Map();
            [...schedule.map((s) => placeName(s)), ...biz.places.map((p) => p.name), "Home"].forEach((n) => { if (n && !seen.has(placeKey(n)))
                seen.set(placeKey(n), n); });
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
            saveBiz(Object.assign(Object.assign({}, biz), { teacher: { name: name.trim(), phone: phone.trim() }, places })).then(() => flash("Settings saved."), () => flash("That didn't save. Check your connection and try again."));
        };
        return (React.createElement("div", null,
            React.createElement("p", { className: "sub-h" }, "Your details"),
            React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "Shown on invoices and certificates."),
            React.createElement("div", { className: "grid2" },
                React.createElement(Field, { label: "Your name" },
                    React.createElement("input", { id: "me-name", className: "inp", value: name, onChange: (e) => setName(e.target.value) })),
                React.createElement(Field, { label: "Your phone" },
                    React.createElement("input", { id: "me-phone", className: "inp", type: "tel", inputMode: "tel", value: phone, onChange: (e) => setPhone(e.target.value) }))),
            React.createElement("p", { className: "sub-h", style: { marginTop: 14 } }, "Shares by place"),
            React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "The part of a student's fee that goes to the place where the class happens. The app works it out from where each class was actually taught."),
            React.createElement("ul", { className: "rows", style: { marginBottom: 16 } }, names.map((n) => (React.createElement("li", { key: n, className: "place-row" },
                React.createElement("span", { className: "row-title" }, n),
                React.createElement("span", { className: "pct" },
                    React.createElement("input", { id: "pct-" + placeKey(n).replace(/[^a-z0-9]+/g, "-"), className: "inp", type: "number", inputMode: "numeric", min: "0", max: "100", "aria-label": `Share for ${n} (%)`, placeholder: "0", value: pcts[n] || "", onChange: (e) => setPcts(Object.assign(Object.assign({}, pcts), { [n]: e.target.value })) }),
                    "%"))))),
            React.createElement("button", { className: "btn", onClick: save }, "Save settings"),
            React.createElement(ImportBackup, null)));
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
        const updO = (id, k) => (e) => setForm(Object.assign(Object.assign({}, form), { offers: form.offers.map((o) => (o.id === id ? Object.assign(Object.assign({}, o), { [k]: e.target.value }) : o)) }));
        const updG = (g, k, val) => setForm(Object.assign(Object.assign({}, form), { groups: form.groups.map((x) => (x.group === g ? Object.assign(Object.assign({}, x), { [k]: val }) : x)) }));
        const save = () => {
            if (form.contact.trim() && !waDigits(form.contact)) {
                setErr("That WhatsApp number looks too short. Use the full number.");
                return;
            }
            setErr("");
            saveJoin({
                intro: form.intro.trim(), contact: form.contact.trim(),
                offers: form.offers.filter((o) => o.title.trim()).map((o) => ({ id: o.id, title: o.title.trim(), price: Number(o.price) || 0, per: o.per, note: o.note.trim() })),
                groups: form.groups.filter((g) => g.show).map((g) => ({ group: g.group, capacity: Math.max(1, Number(g.capacity) || 1) })),
            });
            flash("Join page saved.");
        };
        return (React.createElement("div", null,
            React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "A page for new families: your classes, prices, open spots and a button to book a free trial on WhatsApp. Anyone with your app link can open it from the first screen with \"New student? See classes and prices\". You can also add #join to the end of the link to open it directly."),
            React.createElement(Field, { label: "Welcome message" },
                React.createElement("textarea", { id: "join-intro", className: "inp", value: form.intro, placeholder: STR.fr.joinTagline, onChange: (e) => setForm(Object.assign(Object.assign({}, form), { intro: e.target.value })) })),
            React.createElement(Field, { label: "WhatsApp for trial bookings" },
                React.createElement("input", { id: "join-contact", className: "inp", type: "tel", inputMode: "tel", placeholder: pay.whatsapp || "07 00 00 00 00", value: form.contact, onChange: (e) => setForm(Object.assign(Object.assign({}, form), { contact: e.target.value })) })),
            React.createElement("p", { className: "hint" }, "Leave it empty to use the number from How students pay."),
            React.createElement("p", { className: "sub-h", style: { marginTop: 14 } }, "Classes and prices"),
            form.offers.map((o) => (React.createElement("div", { key: o.id, className: "method-edit" },
                React.createElement(Field, { label: "Class" },
                    React.createElement("input", { id: "of-title-" + o.id, className: "inp", value: o.title, onChange: updO(o.id, "title") })),
                React.createElement("div", { className: "grid2" },
                    React.createElement(Field, { label: "Price (FCFA)" },
                        React.createElement("input", { id: "of-price-" + o.id, className: "inp", type: "number", inputMode: "numeric", min: "0", step: "500", value: o.price, onChange: updO(o.id, "price") })),
                    React.createElement(Field, { label: "Per" },
                        React.createElement("select", { id: "of-per-" + o.id, className: "inp", value: o.per, onChange: updO(o.id, "per") },
                            React.createElement("option", { value: "month" }, "Month"),
                            React.createElement("option", { value: "class" }, "Class"),
                            React.createElement("option", { value: "hour" }, "Hour")))),
                React.createElement(Field, { label: "Details (optional)" },
                    React.createElement("input", { id: "of-note-" + o.id, className: "inp", value: o.note, onChange: updO(o.id, "note") })),
                React.createElement("button", { className: "btn ghost sm danger", onClick: () => setForm(Object.assign(Object.assign({}, form), { offers: form.offers.filter((x) => x.id !== o.id) })) },
                    React.createElement(Icon, { name: "trash", size: 15 }),
                    "Remove")))),
            React.createElement("button", { className: "btn ghost sm", style: { marginBottom: 16 }, onClick: () => setForm(Object.assign(Object.assign({}, form), { offers: [...form.offers, { id: uid(), title: "", price: "", per: "month", note: "" }] })) },
                React.createElement(Icon, { name: "plus", size: 16 }),
                "Add a class type"),
            React.createElement("p", { className: "sub-h" }, "Groups with open spots"),
            form.groups.length === 0 ? React.createElement("p", { className: "hint", style: { marginTop: 0 } }, "Add students with a group name, and the groups show up here.") : (React.createElement("ul", { className: "rows", style: { marginBottom: 16 } }, form.groups.map((g) => {
                const count = roster.filter((r) => r.group === g.group).length;
                return (React.createElement("li", { key: g.group, className: "place-row" },
                    React.createElement("label", { className: "check", style: { margin: 0 } },
                        React.createElement("input", { type: "checkbox", checked: g.show, onChange: (e) => updG(g.group, "show", e.target.checked) }),
                        g.group,
                        React.createElement("span", { className: "muted small" },
                            count,
                            " now")),
                    React.createElement("span", { className: "pct" },
                        React.createElement("input", { className: "inp", type: "number", inputMode: "numeric", min: "1", "aria-label": `Places in ${g.group}`, value: g.capacity, disabled: !g.show, onChange: (e) => updG(g.group, "capacity", e.target.value) }),
                        "places")));
            }))),
            err && React.createElement("p", { className: "err", role: "alert" }, err),
            React.createElement("button", { className: "btn", onClick: save }, "Save join page")));
    }
    function JoinPage({ join, pay, schedule, counts = {}, onBack, onLang }) {
        const { t, lang } = useT();
        const contact = join.contact || pay.whatsapp;
        const per = { month: t("perMonth"), class: t("perClass"), hour: t("perHour") };
        const groups = join.groups.map((g) => {
            const slots = schedule.filter((s) => s.group === g.group).sort((a, b) => a.day - b.day);
            const left = Math.max(0, (Number(g.capacity) || 0) - (Number(counts[g.group]) || 0));
            return Object.assign(Object.assign({}, g), { slots, left });
        });
        return (React.createElement("div", { className: "welcome" },
            React.createElement("div", { className: "welcome-lang between" },
                React.createElement("button", { className: "link", onClick: onBack }, t("haveCode")),
                React.createElement("button", { className: "link", onClick: onLang, "aria-label": t("otherLangName") }, t("otherLang"))),
            React.createElement("div", { className: "seyes welcome-page" },
                React.createElement("h1", { className: "welcome-title" }, "Bright Minds"),
                React.createElement("p", { className: "welcome-sub" }, join.intro || t("joinTagline"))),
            join.offers.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("h2", { className: "h" }, t("classesPrices")),
                React.createElement("ul", { className: "rows", style: { marginBottom: 20 } }, join.offers.map((o) => (React.createElement("li", { key: o.id, className: "offer" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, o.title),
                        o.note && React.createElement("span", { className: "row-sub" }, o.note)),
                    React.createElement("span", { className: "offer-price" },
                        React.createElement("strong", null, fcfa(o.price)),
                        React.createElement("span", { className: "muted small" }, per[o.per] || "")))))))),
            groups.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("h2", { className: "h" }, t("openGroups")),
                React.createElement("ul", { className: "rows", style: { marginBottom: 20 } }, groups.map((g) => (React.createElement("li", { key: g.group, className: "offer" },
                    React.createElement("div", { className: "row-main" },
                        React.createElement("span", { className: "row-title" }, g.group),
                        React.createElement("span", { className: "row-sub" }, g.slots.map((s) => `${cap(DAYS[lang][s.day])} ${s.start}`).join(", "))),
                    React.createElement("span", { className: "pill " + (g.left > 0 ? "paid" : "unpaid") }, g.left > 0 ? t("spotsLeft", g.left) : t("full")))))))),
            contact && (React.createElement("div", { className: "join-cta" },
                React.createElement("a", { className: "btn", href: waLink(contact, t("trialMsg")), target: "_blank", rel: "noopener noreferrer" },
                    React.createElement(Icon, { name: "chat", size: 18 }),
                    t("bookTrial")),
                React.createElement("p", { className: "hint", style: { margin: "8px 0 0" } }, t("trialHint"))))));
    }
    function BusinessTeacher({ bizH, db, userId, flash, pay, downloads, roster, schedule, changes, join, saveJoin, groups }) {
        const [mode, setMode] = useState("schools");
        const modes = [["schools", "Schools"], ["income", "Income"], ["join", "Join page"], ["settings", "Settings"]];
        const placesNeedDb = mode !== "join" && !bizH.on;
        return (React.createElement("section", null,
            React.createElement("h2", { className: "h" }, "Business"),
            React.createElement("div", { className: "seg seg-wrap" }, modes.map(([id, label]) => React.createElement("button", { key: id, "aria-pressed": mode === id, onClick: () => setMode(id) }, label))),
            placesNeedDb ? React.createElement("p", { className: "note" }, "Sign in as the teacher to use this.")
                : !bizH.ready && mode !== "join" ? React.createElement("p", { className: "empty", role: "status" }, "Loading...")
                    : mode === "schools" ? React.createElement(SchoolsSection, { biz: bizH.biz, saveBiz: bizH.save, db: db, userId: userId, flash: flash, pay: pay, downloads: downloads })
                        : mode === "income" ? React.createElement(IncomeSection, { db: db, userId: userId, roster: roster, schedule: schedule, changes: changes, places: bizH.biz.places })
                            : mode === "join" ? React.createElement(JoinSettings, { join: join, saveJoin: saveJoin, groups: groups, roster: roster, pay: pay, flash: flash })
                                : React.createElement(BizSettings, { biz: bizH.biz, saveBiz: bizH.save, schedule: schedule, pay: pay, flash: flash })));
    }
    /* ---------- live data from the database ---------- */
    function useContent(on) {
        const [state, setState] = useState({ content: null, error: false });
        useEffect(() => {
            if (!on)
                return undefined;
            let un = () => { };
            try {
                un = FB.db.doc("site/content").onSnapshot((s) => setState({ content: normalize(s.exists ? s.data() : {}), error: false }), () => setState((x) => (Object.assign(Object.assign({}, x), { error: true }))));
            }
            catch (e) {
                setState((x) => (Object.assign(Object.assign({}, x), { error: true })));
            }
            return () => un();
        }, [on]);
        return state;
    }
    function useRoster(on) {
        const [state, setState] = useState({ roster: [], ready: false });
        useEffect(() => {
            if (!on) {
                setState({ roster: [], ready: false });
                return undefined;
            }
            let un = () => { };
            try {
                un = FB.db.collection("students").onSnapshot((qs) => setState({ roster: qs.docs.map((d) => (Object.assign(Object.assign({}, d.data()), { code: d.id }))), ready: true }), () => setState((x) => (Object.assign(Object.assign({}, x), { ready: true }))));
            }
            catch (e) {
                setState((x) => (Object.assign(Object.assign({}, x), { ready: true })));
            }
            return () => un();
        }, [on]);
        return state;
    }
    function useStudentDoc(code) {
        const [state, setState] = useState({ code: null, doc: undefined });
        useEffect(() => {
            if (!code || !FB) {
                setState({ code, doc: null });
                return undefined;
            }
            setState({ code, doc: undefined });
            let un = () => { };
            try {
                un = FB.db.doc("students/" + code).onSnapshot((s) => setState({ code, doc: s.exists ? Object.assign(Object.assign({}, s.data()), { code }) : null }), () => setState({ code, doc: null }));
            }
            catch (e) {
                setState({ code, doc: null });
            }
            return () => un();
        }, [code]);
        return state.code === code ? state.doc : undefined;
    }
    function Notice({ text }) {
        return (React.createElement("div", { className: "welcome" },
            React.createElement("div", { className: "seyes welcome-page" },
                React.createElement("h1", { className: "welcome-title" }, "Bright Minds"),
                React.createElement("p", { className: "welcome-sub" }, text))));
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
        const moneyNow = useMoney(isTeacher ? db : null, userId, thisMonth);
        const bizH = useBiz(isTeacher ? db : null, userId);
        const progressAll = useCollectionMap("progress", isTeacher);
        const voiceAll = useCollectionMap("voice", isTeacher);
        const [voiceSent, setVoiceSent] = useState(() => ls.get("bm:voice", {}) || {});
        const flash = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3200); };
        const saveFail = () => flash("That didn't save. Check your connection and try again.");
        useEffect(() => {
            if (!FB) {
                setUser(null);
                return undefined;
            }
            FB.auth.getRedirectResult().catch(() => { });
            return FB.auth.onAuthStateChanged((u) => { checkTeacher(u).then(() => setUser(u || null), () => setUser(u || null)); });
        }, []);
        useEffect(() => {
            const onHash = () => { const h = window.location.hash || ""; setJoinView(h === "#join"); setInstallView(h === "#install"); };
            window.addEventListener("hashchange", onHash);
            return () => window.removeEventListener("hashchange", onHash);
        }, []);
        useEffect(() => {
            if (user === undefined)
                return;
            if (canTeach && role == null) {
                setRole("teacher");
                ls.set("bm:role", "teacher");
            }
            if (!canTeach && role === "teacher") {
                setRole(null);
                ls.del("bm:role");
            }
        }, [user, role]);
        // Keep each student's "classes left" and "paid" up to date from your private records.
        const showStatus = content ? content.settings.showStatus : true;
        const wanted = useMemo(() => (isTeacher && rosterH.ready && moneyNow.ready && attToday.ready && !moneyNow.failed
            ? (showStatus ? computeStatuses(rosterH.roster, moneyNow.fees, moneyNow.pays, attToday.taken, thisMonth) : {}) : null), [isTeacher, showStatus, rosterH.ready, rosterH.roster, moneyNow.ready, moneyNow.failed, moneyNow.fees, moneyNow.pays, attToday.ready, attToday.taken, thisMonth]);
        useEffect(() => {
            if (!wanted)
                return;
            const batch = FB.db.batch();
            let n = 0;
            rosterH.roster.forEach((r) => {
                const w = wanted[r.id] || null;
                const cur = r.st ? { m: r.st.m, left: r.st.left, total: r.st.total, pay: r.st.pay } : null;
                if (stable(cur) === stable(w))
                    return;
                batch.set(FB.db.doc("students/" + r.code), { st: w ? Object.assign(Object.assign({}, w), { at: todayISO() }) : null }, { mergeFields: ["st"] });
                n++;
            });
            if (n)
                batch.commit().catch(() => { });
        }, [wanted]);
        const saveContent = (key) => (value) => {
            FB.db.doc("site/content").set({ [key]: value, updated: new Date().toISOString() }, { mergeFields: [key, "updated"] }).catch(saveFail);
        };
        const saveRoster = (next) => { saveRosterDocs(rosterH.roster, next).catch(saveFail); };
        const roster = rosterH.roster;
        const groups = useMemo(() => {
            const s = [...new Set(roster.map((r) => r.group).filter((g) => g && g !== EVERYONE))].sort();
            return [EVERYONE, ...s];
        }, [roster]);
        const meR = !me ? null : me.id === "guest" ? GUEST : studentRec || null;
        const progDoc = useProgressDoc(!isTeacher && meR && meR.id !== "guest" ? meR.id : null);
        const addVoiceSent = (lessonId, x) => {
            const next = Object.assign(Object.assign({}, voiceSent), { [lessonId]: [...arr(voiceSent[lessonId]), x].slice(-5) });
            setVoiceSent(next);
            ls.set("bm:voice", next);
        };
        const toggleLang = () => { const next = lang === "fr" ? "en" : "fr"; setLang(next); ls.set("bm:lang", next); };
        const toggleDone = (lessonId) => {
            const next = Object.assign({}, done);
            if (next[lessonId])
                delete next[lessonId];
            else
                next[lessonId] = todayISO();
            setDone(next);
            ls.set("bm:done", next);
        };
        const chooseStudent = (s) => {
            const m = s ? { id: s.id, name: s.name, group: s.group, code: s.code } : GUEST;
            setMe(m);
            ls.set("bm:me", m);
            setRole("student");
            ls.set("bm:role", "student");
            setTab("words");
        };
        const toTeacher = () => { setRole("teacher"); ls.set("bm:role", "teacher"); setTab("classes"); window.scrollTo(0, 0); };
        const toStudentView = () => { setRole("student"); ls.set("bm:role", "student"); setTab(null); };
        const switchStudent = () => { setMe(null); ls.del("bm:me"); setTab(null); };
        const signIn = async () => {
            try {
                await teacherSignIn();
                if (await checkTeacher(FB.auth.currentUser))
                    toTeacher();
            }
            catch (e) {
                flash("Sign-in didn't work. Check your connection and try again.");
            }
        };
        const signOut = () => { FB.auth.signOut().catch(() => { }); setRole(null); ls.del("bm:role"); setTab(null); };
        const uiLang = isTeacher ? "en" : lang;
        const T = (k) => STR[uiLang][k];
        const tabs = isTeacher
            ? [{ id: "classes", label: "Classes", icon: "calendar" }, { id: "lessons", label: "Lessons", icon: "clipboard" }, { id: "words", label: "Words", icon: "book" }, { id: "students", label: "Students", icon: "users" }, { id: "business", label: "Business", icon: "briefcase" }]
            : [{ id: "words", label: T("tabWords"), icon: "book" }, { id: "homework", label: T("tabHomework"), icon: "clipboard" },
                ...(me && me.id !== "guest" ? [{ id: "progress", label: T("tabProgress"), icon: "award" }] : []),
                { id: "classes", label: T("tabClasses"), icon: "calendar" }, { id: "pay", label: T("tabPay"), icon: "wallet" }];
        const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
        if (!FB)
            return React.createElement(Notice, { text: CONFIGURED ? "Bright Minds could not load. Check your internet connection, then open the page again." : "This app isn't connected to its database yet." });
        if (role === "teacher" && user === undefined)
            return React.createElement("p", { className: "boot", role: "status" }, "Opening Bright Minds...");
        if (installView) {
            const closeInstall = () => {
                setInstallView(false);
                try {
                    history.replaceState(null, "", window.location.pathname + window.location.search);
                }
                catch (e) {
                    window.location.hash = "";
                }
                window.scrollTo(0, 0);
            };
            return React.createElement(LangCtx.Provider, { value: lang },
                React.createElement(InstallPage, { onBack: closeInstall, onLang: toggleLang }));
        }
        if (!content)
            return error ? React.createElement(Notice, { text: STR[lang].offline }) : React.createElement("p", { className: "boot", role: "status" }, STR[lang].opening);
        if (!isTeacher && me && me.id !== "guest" && studentRec === undefined)
            return React.createElement("p", { className: "boot", role: "status" }, STR[lang].opening);
        const view = content;
        if (!isTeacher && !meR) {
            return (React.createElement(LangCtx.Provider, { value: lang },
                joinView
                    ? React.createElement(JoinPage, { join: view.join, pay: view.pay, schedule: view.schedule, counts: view.groupCounts, onBack: () => { setJoinView(false); if (window.location.hash === "#join") {
                            try {
                                history.replaceState(null, "", window.location.pathname + window.location.search);
                            }
                            catch (e) { /* ignore */ }
                        } }, onLang: toggleLang })
                    : React.createElement(Welcome, { canTeach: canTeach, signedIn: !!user, notTeacher: user && !canTeach ? user.email || "This account" : "", onStudent: chooseStudent, onTeacher: toTeacher, onSignIn: signIn, onSignOut: signOut, onLang: toggleLang, onJoin: () => { setJoinView(true); window.scrollTo(0, 0); } }),
                toast && React.createElement("div", { className: "dock" },
                    React.createElement("div", { className: "toast", role: "status" }, toast))));
        }
        let screen;
        if (isTeacher) {
            if (current === "classes")
                screen = (React.createElement(React.Fragment, null,
                    React.createElement(NoticesTeacher, { notices: view.notices, groups: groups, saveNotices: saveContent("notices"), flash: flash }),
                    React.createElement(Classes, { schedule: view.schedule, changes: view.changes, saveChanges: saveContent("changes"), notices: view.notices, saveNotices: saveContent("notices"), isTeacher: true, groups: groups, saveSchedule: saveContent("schedule"), flash: flash, roster: roster, att: attToday })));
            else if (current === "lessons")
                screen = React.createElement(LessonsTeacher, { lessons: view.lessons, groups: groups, saveLessons: saveContent("lessons"), flash: flash, sample: null, db: db, userId: userId, decks: view.decks, saveDecks: saveContent("decks"), roster: roster, voiceNotes: voiceAll.map, progressMap: progressAll.map });
            else if (current === "words")
                screen = React.createElement(WordsTeacher, { decks: view.decks, groups: groups, saveDecks: saveContent("decks"), openId: openDeck, setOpenId: setOpenDeck, sample: null });
            else if (current === "business")
                screen = (React.createElement(BusinessTeacher, { bizH: bizH, db: db, userId: userId, flash: flash, pay: view.pay, downloads: downloads, roster: roster, schedule: view.schedule, changes: view.changes, join: view.join, saveJoin: saveContent("join"), groups: groups }));
            else
                screen = (React.createElement(StudentsTeacher, { roster: roster, saveRoster: saveRoster, pay: view.pay, savePay: saveContent("pay"), settings: view.settings, saveSettings: saveContent("settings"), lessons: view.lessons, decks: view.decks, schedule: view.schedule, changes: view.changes, places: bizH.biz.places, downloads: downloads, teacherName: bizH.biz.teacher.name || view.pay.accountName, db: db, userId: userId, flash: flash }));
        }
        else {
            const st = view.settings.showStatus ? meR.st : null;
            if (current === "words")
                screen = React.createElement(WordsStudent, { decks: view.decks, me: meR });
            else if (current === "homework")
                screen = React.createElement(HomeworkStudent, { lessons: view.lessons, me: meR, done: done, onToggle: toggleDone, prog: progDoc, voiceSent: voiceSent, onVoiceSent: addVoiceSent });
            else if (current === "progress")
                screen = React.createElement(ProgressStudent, { me: meR, prog: progDoc });
            else if (current === "pay")
                screen = React.createElement(PayStudent, { pay: view.pay, me: meR, st: st });
            else
                screen = React.createElement(Classes, { schedule: view.schedule, changes: view.changes, me: meR, st: st, updated: st && st.at ? st.at : null });
        }
        const today = todayISO();
        const voiceNew = isTeacher ? Object.values(voiceAll.map).filter((v) => !v.heard).length : 0;
        const hwCount = isTeacher ? 0 : view.lessons.filter((l) => l.homework && forGroup(l.group, meR.group) && !done[l.id] && (!l.due || l.due >= today)).length;
        const fresh = isTeacher && rosterH.ready && roster.length === 0 && !view.lessons.length && !view.schedule.length;
        return (React.createElement(LangCtx.Provider, { value: uiLang },
            React.createElement("div", { className: "shell" },
                React.createElement("header", { className: "top" },
                    React.createElement("span", { className: "brand" }, "Bright Minds"),
                    React.createElement("div", { className: "who" }, isTeacher ? (React.createElement(React.Fragment, null,
                        React.createElement("span", null, "Teacher"),
                        React.createElement("button", { className: "link", onClick: toStudentView }, "Student view"),
                        React.createElement("button", { className: "link", onClick: signOut }, "Sign out"))) : (React.createElement(React.Fragment, null,
                        React.createElement("span", null, meR.id === "guest" ? "" : meR.name),
                        React.createElement("button", { className: "link", onClick: toggleLang, "aria-label": STR[lang].otherLangName }, STR[lang].otherLang),
                        React.createElement("button", { className: "link", onClick: switchStudent }, STR[lang].switchUser),
                        canTeach && React.createElement("button", { className: "link", onClick: toTeacher }, "Teacher view"))))),
                React.createElement("main", null,
                    fresh && React.createElement("p", { className: "note" }, "Welcome to your own Bright Minds. To bring in everything from the Claude version, go to Business, then Settings, and use Move in."),
                    !isTeacher && !installHidden && current === tabs[0].id && React.createElement(InstallCard, { onHide: () => { setInstallHidden(true); ls.set("bm:installHidden", true); } }),
                    !isTeacher && React.createElement(StudentNotices, { notices: view.notices, me: meR }),
                    screen)),
            React.createElement("div", { className: "dock" },
                toast && React.createElement("div", { className: "toast", role: "status" }, toast),
                React.createElement("nav", { className: "tabbar", "aria-label": "Sections" },
                    React.createElement("div", { className: "dock-in" }, tabs.map((t) => (React.createElement("button", { key: t.id, className: "tab", "aria-current": current === t.id ? "page" : undefined, onClick: () => setTab(t.id) },
                        React.createElement(Icon, { name: t.icon, size: 22 }),
                        React.createElement("span", { className: "tab-label" }, t.label),
                        t.id === "homework" && hwCount > 0 && React.createElement("span", { className: "badge", "aria-label": `${hwCount}` }, hwCount),
                        t.id === "lessons" && voiceNew > 0 && React.createElement("span", { className: "badge", "aria-label": `${voiceNew} new voice notes` }, voiceNew)))))))));
    }
    ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
})();
