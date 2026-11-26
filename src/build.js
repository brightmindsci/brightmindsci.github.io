// Builds the site (index.html, app.js, app.css) at the repo root from src/app.jsx and src/styles.css.
// Run: node src/build.js
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");
const G = execSync("npm root -g").toString().trim();
const ts = require(G + "/typescript");
const root = __dirname + "/..";
const out = root;

const src = fs.readFileSync(__dirname + "/app.jsx", "utf8");
const sf = ts.createSourceFile("app.jsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
if (sf.parseDiagnostics.length) { console.error(sf.parseDiagnostics.map((d) => d.messageText + " @" + d.start).join("\n")); process.exit(1); }
const js = ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.None } }).outputText;

const baseCss = fs.readFileSync(__dirname + "/styles.css", "utf8");
const css = `/* Bright Minds */
html{-webkit-text-size-adjust:100%}
body{margin:0}
:root{padding-top:env(safe-area-inset-top,0px)}
img{max-width:100%}
[hidden]{display:none!important}
.teacher-link{margin-top:32px;text-align:center}
` + baseCss;

const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
fs.writeFileSync(out + "/app.js", js);
fs.writeFileSync(out + "/app.css", css);
if (!fs.existsSync(out + "/config.js")) { console.error("config.js is missing at the repo root"); process.exit(1); }
const cfg = fs.readFileSync(out + "/config.js", "utf8");
// courses.json: the lesson plans shown in Lessons → Library. Checked here so a broken edit fails the build.
const coursesPath = out + "/courses.json";
let coursesTag = "";
if (fs.existsSync(coursesPath)) {
  const raw = fs.readFileSync(coursesPath, "utf8");
  try { JSON.parse(raw); } catch (e) { console.error("courses.json is not valid JSON: " + e.message); process.exit(1); }
  coursesTag = `<script>window.BM_COURSES = "courses.json?v=${hash(raw)}";</script>\n`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Bright Minds</title>
<meta name="description" content="Bright Minds English classes for children and adults: word practice, homework, class times and payments.">
<meta name="theme-color" content="#FBF3E6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1A130E" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Bright Minds">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,700;1,9..40,400&family=Poppins:wght@700&display=swap">
<link rel="stylesheet" href="app.css?v=${hash(css)}">
</head>
<body>
<div id="root"><p class="boot">Opening Bright Minds...</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
${coursesTag}<script src="config.js?v=${hash(cfg)}"></script>
<script src="app.js?v=${hash(js)}"></script>
</body>
</html>
`;
fs.writeFileSync(out + "/index.html", html);
console.log("built: app.js", js.length, "bytes; app.css", css.length);
