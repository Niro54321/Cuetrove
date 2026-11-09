// The settings page: pick languages and sources, paste your own API keys, get your install link.
// Everything is built in the browser; the link is the only place your settings and keys live.

import { DEFAULTS } from "./config.js";

const safe = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, "");

export function page({ origin, config, languages, version, storage = false }) {
  const langs = languages.map((l) => [l.code, l.name, l.native]);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cuetrove — settings</title>
<link rel="icon" href="${origin}/logo.png">
<style>
:root{--bg:#121418;--panel:#1b1e24;--line:#2a2e36;--text:#e9ecf1;--muted:#9aa3af;--accent:#f3c64f;--accent-ink:#1b1608;--ok:#7dd3a8;--warn:#f59e8b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 "Segoe UI",system-ui,-apple-system,Tahoma,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px}
header{display:flex;align-items:center;gap:14px;margin-bottom:6px}
header img{width:48px;height:48px;border-radius:12px}
h1{font-size:26px;margin:0;letter-spacing:.2px}
.lead{color:var(--muted);margin:4px 0 24px}
.switch-ui{margin-inline-start:auto;background:none;border:1px solid var(--line);color:var(--muted);border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit}
section{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;margin:14px 0}
h2{font-size:15px;margin:0 0 4px}
.hint{color:var(--muted);font-size:13px;margin:0 0 12px}
.chips{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.chip{display:flex;align-items:center;gap:8px;background:#23272f;border:1px solid var(--line);border-radius:10px;padding:6px 8px 6px 12px}
.chip .n{color:var(--accent);font-variant-numeric:tabular-nums;width:20px}
.chip .name{flex:1}
.chip .native{color:var(--muted);font-size:13px}
.chip button{background:none;border:1px solid var(--line);color:var(--text);border-radius:7px;width:30px;height:28px;cursor:pointer;font-size:14px}
.chip button:hover{border-color:var(--muted)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
select,input[type=text],input[type=password],input[type=number]{background:#111318;border:1px solid var(--line);color:var(--text);border-radius:9px;padding:9px 10px;font:inherit;min-width:0}
select:focus,input:focus{outline:2px solid #f3c64f55;border-color:var(--accent)}
.grow{flex:1}
label.opt{display:flex;gap:10px;align-items:flex-start;padding:8px 0;cursor:pointer}
label.opt input{margin-top:4px;accent-color:var(--accent)}
label.opt small{display:block;color:var(--muted)}
.source{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}
.source:first-of-type{border-top:0;padding-top:0;margin-top:0}
.source .top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.source a{color:var(--accent);font-size:13px}
.keyrow{display:flex;gap:8px;margin-top:8px}
.keyrow input{flex:1}
.keyrow button{background:#23272f;border:1px solid var(--line);color:var(--muted);border-radius:9px;padding:0 12px;cursor:pointer;font:inherit}
.tag{font-size:12px;color:var(--ok)}
.tag.off{color:var(--muted)}
.install{background:#1f1c12;border-color:#4a3d16}
.url{width:100%;font-family:Consolas,ui-monospace,monospace;font-size:12.5px;direction:ltr}
.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.btn{border:0;border-radius:10px;padding:10px 16px;font:600 14px/1.2 inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.btn.primary{background:var(--accent);color:var(--accent-ink)}
.btn.ghost{background:#2a2a22;color:var(--text);border:1px solid #4a3d16}
.warn{color:var(--warn);font-size:13px;margin:10px 0 0}
.copied{color:var(--ok);font-size:13px;margin-inline-start:6px}
footer{color:var(--muted);font-size:13px;margin-top:22px;line-height:1.6}
footer a{color:var(--muted)}
[dir=rtl] .url{text-align:left}
.results{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.result{display:flex;gap:10px;align-items:center;background:#23272f;border:1px solid var(--line);border-radius:10px;padding:6px;cursor:pointer;text-align:start;color:var(--text);font:inherit}
.result:hover,.result.on{border-color:var(--accent)}
.result img{width:34px;height:50px;object-fit:cover;border-radius:5px;background:#111}
.result small{display:block;color:var(--muted)}
h3{font-size:14px;margin:18px 0 8px}
.file{display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);padding:8px 0}
.file .what{flex:1;min-width:0}
.file small{display:block;color:var(--muted)}
.file button{background:none;border:1px solid var(--line);color:var(--warn);border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit}
.msg-ok{color:var(--ok)}.msg-bad{color:var(--warn)}
input[type=file]{color:var(--muted);max-width:100%}
@media (max-width:520px){.chip .native{display:none}}
</style>
</head>
<body>
<main>
<header>
  <img src="${origin}/logo.png" alt="">
  <div><h1>Cuetrove</h1></div>
  <button class="switch-ui" id="ui"></button>
</header>
<p class="lead" data-t="lead"></p>

<section>
  <h2 data-t="langs"></h2>
  <p class="hint" data-t="langsHint"></p>
  <div class="chips" id="chips"></div>
  <div class="row">
    <select id="add" class="grow"></select>
  </div>
  <label class="opt"><input type="radio" name="only" value="0"><span data-t="mineFirst"></span></label>
  <label class="opt" style="padding-top:0"><input type="radio" name="only" value="1"><span data-t="onlyMine"></span></label>
</section>

<section>
  <h2 data-t="quality"></h2>
  <label class="opt"><input type="checkbox" id="official"><span><span data-t="official"></span><small data-t="officialHint"></small></span></label>
  <label class="opt"><input type="checkbox" id="rtl"><span><span data-t="rtl"></span><small data-t="rtlHint"></small></span></label>
  <div class="row" style="margin-top:6px">
    <span data-t="per"></span><input type="number" id="per" min="1" max="10" style="width:72px">
    <span style="margin-inline-start:12px" data-t="hi"></span>
    <select id="hi"><option value="any" data-t="hiAny"></option><option value="prefer" data-t="hiPrefer"></option><option value="avoid" data-t="hiAvoid"></option></select>
    <span style="margin-inline-start:12px" data-t="fmt"></span>
    <select id="fmt"><option value="srt">SRT</option><option value="vtt">VTT</option></select>
  </div>
</section>

<section>
  <h2 data-t="sources"></h2>
  <p class="hint" data-t="sourcesHint"></p>
  <div class="source">
    <div class="top"><b>SubSource</b><a href="https://subsource.net/api-docs" target="_blank" rel="noopener" data-t="getKey"></a></div>
    <p class="hint" style="margin:2px 0 0" data-t="ssHint"></p>
    <div class="keyrow"><input type="password" id="ss" autocomplete="off" spellcheck="false" data-p="keyPlaceholder"><button type="button" data-show="ss" data-t="show"></button></div>
  </div>
  <div class="source">
    <div class="top"><b>SubDL</b><a href="https://subdl.com/panel/api" target="_blank" rel="noopener" data-t="getKey"></a></div>
    <p class="hint" style="margin:2px 0 0" data-t="subdlHint"></p>
    <div class="keyrow"><input type="password" id="subdl" autocomplete="off" spellcheck="false" data-p="keyPlaceholder"><button type="button" data-show="subdl" data-t="show"></button></div>
  </div>
  <div class="source">
    <label class="opt" style="padding:0"><input type="checkbox" id="os"><span><b>OpenSubtitles</b> <span class="tag" data-t="noKey"></span><small data-t="osHint"></small></span></label>
  </div>
</section>

<section id="mine"${storage ? "" : " hidden"}>
  <h2 data-t="mine"></h2>
  <p class="hint" data-t="mineHint"></p>
  <div id="mineOff"><button class="btn primary" type="button" id="mineOn" data-t="mineOn"></button></div>
  <div id="mineBox" hidden>
    <div class="row">
      <select id="mType"><option value="movie" data-t="movie"></option><option value="series" data-t="series"></option></select>
      <input type="text" id="mQuery" class="grow" data-p="searchTitle">
      <button class="btn ghost" type="button" id="mSearch" data-t="search"></button>
    </div>
    <div class="results" id="mResults"></div>
    <div class="row" id="mEp" hidden style="margin-bottom:10px">
      <span data-t="season"></span><select id="mSeason"></select>
      <span data-t="episode"></span><select id="mEpisode" class="grow"></select>
    </div>
    <div class="row" style="margin-bottom:10px">
      <span data-t="language"></span><select id="mLang"></select>
      <input type="file" id="mFile" accept=".srt,.vtt,.ass,.ssa,.sub,.txt,.zip">
    </div>
    <div class="row">
      <input type="text" id="mLabel" class="grow" data-p="labelPh" maxlength="80">
      <button class="btn primary" type="button" id="mUpload" data-t="upload"></button>
    </div>
    <p class="hint" id="mMsg" style="margin-top:10px"></p>
    <h3 data-t="myFiles"></h3>
    <div id="mList"></div>
  </div>
</section>

<section class="install">
  <h2 data-t="install"></h2>
  <input class="url" id="url" readonly>
  <div class="buttons">
    <a class="btn primary" id="stremio" data-t="inStremio"></a>
    <a class="btn ghost" id="web" target="_blank" rel="noopener" data-t="inWeb"></a>
    <button class="btn ghost" id="copy" type="button" data-t="copy"></button><span class="copied" id="copied"></span>
  </div>
  <p class="hint" style="margin-top:12px" data-t="nuvio"></p>
  <p class="warn" id="keywarn" data-t="private"></p>
  <p class="warn" id="reinstall" data-t="reinstall" hidden></p>
</section>

<footer>
  <p data-t="legal"></p>
  <p>Cuetrove ${version} · <a href="https://github.com/Niro54321/Cuetrove" target="_blank" rel="noopener">GitHub</a> · MIT</p>
</footer>
</main>
<script>
const ORIGIN = ${safe(origin)};
const DEFAULTS = ${safe(DEFAULTS)};
const LANGS = ${safe(langs)};
let cfg = ${safe(config)};

const T = {
  en: {
    ui: "العربية",
    lead: "Official subtitles for Stremio and Nuvio, in every language. Subtitles made for Netflix, Disney+, Crunchyroll, Paramount+, Apple TV+ and other services come first, with their source written next to them.",
    langs: "Your languages",
    langsHint: "The first one is shown at the top. Use the arrows to change the order.",
    addLang: "Add a language…",
    mineFirst: "My languages first, then every other language",
    onlyMine: "Only my languages",
    quality: "Quality",
    official: "Only official subtitles",
    officialHint: "Keeps subtitles marked retail or official, and those made for a streaming service's or a Blu-ray's release. Hides fan translations, cam rips and machine translations.",
    rtl: "Fix Arabic, Persian and Hebrew punctuation",
    rtlHint: "Puts full stops and question marks at the right end of right-to-left lines in every player.",
    per: "Tracks per language",
    hi: "Hearing impaired",
    hiAny: "Either", hiPrefer: "Prefer", hiAvoid: "Avoid",
    fmt: "Format",
    sources: "Sources",
    sourcesHint: "Each site's key is free and is your own. It is kept only inside your install link.",
    getKey: "Get a free key",
    ssHint: "The old Subscene library. Marks official subtitles as retail. Very rich in Arabic.",
    subdlHint: "The old Subscene library and more, very rich in Arabic.",
    keyPlaceholder: "Paste your API key",
    show: "Show",
    hide: "Hide",
    noKey: "no key needed",
    osHint: "Through Stremio's public OpenSubtitles add-on. With \\"Only official\\" on, only releases made for a streaming service or a disc are shown.",
    install: "Install",
    inStremio: "Install in Stremio",
    inWeb: "Stremio Web",
    copy: "Copy link",
    copied: "Copied",
    nuvio: "Nuvio: Settings → Addons → paste this link. Stremio on a TV or phone: paste it in the add-on search box.",
    private: "This link holds your API keys. Keep it to yourself.",
    mine: "My subtitles",
    mineHint: "Upload your own subtitle files. Each one shows at the top of the list for its movie or episode, on every device, and only you can see them.",
    mineOn: "Turn on My subtitles",
    movie: "Movie", series: "Series",
    searchTitle: "Movie or series name",
    search: "Search",
    season: "Season", episode: "Episode",
    language: "Language",
    labelPh: "A short note shown next to it (optional)",
    upload: "Upload",
    myFiles: "Uploaded",
    none: "Nothing yet.",
    pickTitle: "Search and pick the movie or series first.",
    pickFile: "Choose a subtitle file.",
    uploading: "Uploading…",
    uploaded: "Saved: {n} lines. It is in the list for this title now.",
    del: "Delete",
    reinstall: "Your link changed: install it again in Nuvio or Stremio, in place of the old one.",
    noResults: "Nothing found.",
    legal: "Cuetrove does not take anything from Netflix, Disney+ or any other streaming service, and it does not touch DRM. It searches public subtitle libraries (OpenSubtitles, SubDL, SubSource) through their official APIs and reads each file's release name to show which service or disc it was made for.",
  },
  ar: {
    ui: "English",
    lead: "ترجمات رسمية لـ Stremio وNuvio بكل اللغات. الترجمات المصنوعة لنتفليكس وديزني+ وكرانشي رول وباراماونت+ وApple TV+ وغيرها تظهر أولاً، ومكتوب بجانبها مصدرها.",
    langs: "لغاتك",
    langsHint: "الأولى تظهر في الأعلى. غيّر الترتيب بالأسهم.",
    addLang: "أضف لغة…",
    mineFirst: "لغاتي أولاً، ثم كل اللغات الأخرى",
    onlyMine: "لغاتي فقط",
    quality: "الجودة",
    official: "الترجمات الرسمية فقط",
    officialHint: "يبقي الترجمات المعلَّمة رسمية (retail)، والمصنوعة لنسخة خدمة بث أو Blu-ray. يخفي ترجمات المعجبين ونسخ الكام والترجمة الآلية.",
    rtl: "إصلاح علامات الترقيم في العربية والفارسية والعبرية",
    rtlHint: "يضع النقطة وعلامة الاستفهام في مكانهما الصحيح في كل المشغلات.",
    per: "عدد الترجمات لكل لغة",
    hi: "لضعاف السمع",
    hiAny: "لا يهم", hiPrefer: "أفضّلها", hiAvoid: "أتجنبها",
    fmt: "الصيغة",
    sources: "المصادر",
    sourcesHint: "مفتاح كل موقع مجاني وخاص بك، ولا يُحفظ إلا داخل رابط التثبيت الخاص بك.",
    getKey: "احصل على مفتاح مجاني",
    ssHint: "مكتبة Subscene القديمة. يعلّم الترجمات الرسمية بـ retail. غني جداً بالعربية.",
    subdlHint: "مكتبة Subscene القديمة وأكثر، غني جداً بالعربية.",
    keyPlaceholder: "الصق مفتاح API هنا",
    show: "إظهار",
    hide: "إخفاء",
    noKey: "بدون مفتاح",
    osHint: "عبر إضافة OpenSubtitles العامة من Stremio. مع \\"الرسمية فقط\\" يظهر منه فقط ما صُنع لنسخ خدمات البث أو الأقراص.",
    install: "التثبيت",
    inStremio: "ثبّت في Stremio",
    inWeb: "Stremio Web",
    copy: "انسخ الرابط",
    copied: "تم النسخ",
    nuvio: "Nuvio: الإعدادات ← Addons ← الصق هذا الرابط. Stremio على التلفاز أو الهاتف: الصقه في خانة البحث عن الإضافات.",
    private: "هذا الرابط يحمل مفاتيحك. لا تشاركه مع أحد.",
    mine: "ترجماتي",
    mineHint: "ارفع ملفات ترجمتك بنفسك. كل ملف يظهر أول القائمة لفيلمه أو حلقته، على كل أجهزتك، ولا يراه أحد غيرك.",
    mineOn: "فعّل ترجماتي",
    movie: "فيلم", series: "مسلسل",
    searchTitle: "اسم الفيلم أو المسلسل",
    search: "ابحث",
    season: "الموسم", episode: "الحلقة",
    language: "اللغة",
    labelPh: "ملاحظة قصيرة تظهر بجانبها (اختياري)",
    upload: "ارفع",
    myFiles: "المرفوعة",
    none: "لا شيء بعد.",
    pickTitle: "ابحث واختر الفيلم أو المسلسل أولاً.",
    pickFile: "اختر ملف الترجمة.",
    uploading: "جارٍ الرفع…",
    uploaded: "تم الحفظ: {n} سطر. أصبحت في قائمة هذا العمل الآن.",
    del: "احذف",
    reinstall: "تغيّر رابطك: ثبّته من جديد في Nuvio أو Stremio بدل القديم.",
    noResults: "لا توجد نتائج.",
    legal: "Cuetrove لا يأخذ أي شيء من نتفليكس أو ديزني+ أو أي خدمة بث، ولا يقترب من DRM. يبحث في مكتبات الترجمات العامة (OpenSubtitles وSubDL وSubSource) عبر واجهاتها الرسمية، ويقرأ اسم نسخة كل ملف ليبيّن لأي خدمة أو قرص صُنع.",
  },
};

let ui = (() => { try { return localStorage.getItem("cuetrove-ui"); } catch { return null; } })()
  || ((navigator.language || "").startsWith("ar") ? "ar" : "en");
const $ = (id) => document.getElementById(id);

function t(k) { return (T[ui] && T[ui][k]) || T.en[k] || k; }

function paint() {
  document.documentElement.lang = ui;
  document.documentElement.dir = ui === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll("[data-p]").forEach((el) => { el.placeholder = t(el.dataset.p); });
  document.querySelectorAll("[data-show]").forEach((b) => { b.textContent = $(b.dataset.show).type === "password" ? t("show") : t("hide"); });
  $("ui").textContent = t("ui");
  chips();
}

function name(code) {
  const l = LANGS.find((x) => x[0] === code);
  return l ? l : [code, code, code];
}

function chips() {
  const box = $("chips");
  box.innerHTML = "";
  cfg.langs.forEach((code, i) => {
    const [, en, native] = name(code);
    const row = document.createElement("div");
    row.className = "chip";
    row.innerHTML = '<span class="n"></span><span class="name"></span><span class="native"></span>' +
      '<button type="button" title="Up">↑</button><button type="button" title="Down">↓</button><button type="button" title="Remove">✕</button>';
    row.querySelector(".n").textContent = i + 1;
    row.querySelector(".name").textContent = en;
    row.querySelector(".native").textContent = native === en ? "" : native;
    const [up, down, del] = row.querySelectorAll("button");
    up.disabled = i === 0;
    down.disabled = i === cfg.langs.length - 1;
    up.onclick = () => { move(i, -1); };
    down.onclick = () => { move(i, 1); };
    del.onclick = () => { cfg.langs.splice(i, 1); update(); };
    box.appendChild(row);
  });
  const add = $("add");
  add.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = t("addLang");
  add.appendChild(first);
  for (const [code, en, native] of [...LANGS].sort((a, b) => a[1].localeCompare(b[1]))) {
    if (cfg.langs.includes(code)) continue;
    const o = document.createElement("option");
    o.value = code;
    o.textContent = native === en ? en : en + " · " + native;
    add.appendChild(o);
  }
}

function move(i, d) {
  const j = i + d;
  [cfg.langs[i], cfg.langs[j]] = [cfg.langs[j], cfg.langs[i]];
  update();
}

function encode(c) {
  const small = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (JSON.stringify(c[k]) !== JSON.stringify(DEFAULTS[k])) small[k] = c[k];
  }
  if (!Object.keys(small).length) return "";
  const bytes = new TextEncoder().encode(JSON.stringify(small));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}

function read() {
  cfg.only = document.querySelector('input[name=only]:checked').value === "1";
  cfg.official = $("official").checked;
  cfg.rtl = $("rtl").checked;
  cfg.per = Math.min(10, Math.max(1, parseInt($("per").value, 10) || DEFAULTS.per));
  cfg.hi = $("hi").value;
  cfg.fmt = $("fmt").value;
  cfg.os = $("os").checked;
  cfg.subdl = $("subdl").value.trim();
  cfg.ss = $("ss").value.trim();
}

function update() {
  chips();
  const seg = encode(cfg);
  const manifest = ORIGIN + (seg ? "/" + seg : "") + "/manifest.json";
  $("url").value = manifest;
  $("stremio").href = manifest.replace(/^https?:\\/\\//, "stremio://");
  $("web").href = "https://web.stremio.com/#/addons?addon=" + encodeURIComponent(manifest);
  $("keywarn").style.display = cfg.subdl || cfg.ss ? "" : "none";
  $("copied").textContent = "";
}

function load() {
  document.querySelector('input[name=only][value="' + (cfg.only ? 1 : 0) + '"]').checked = true;
  $("official").checked = cfg.official;
  $("rtl").checked = cfg.rtl;
  $("per").value = cfg.per;
  $("hi").value = cfg.hi;
  $("fmt").value = cfg.fmt;
  $("os").checked = cfg.os;
  $("subdl").value = cfg.subdl || "";
  $("ss").value = cfg.ss || "";
}

const own = (el) => el.id === "add" || el.id === "url" || Boolean(el.closest("#mine"));
document.addEventListener("input", (e) => { if (!own(e.target)) { read(); update(); } });
document.addEventListener("change", (e) => { if (!own(e.target)) { read(); update(); } });
$("add").onchange = (e) => { if (e.target.value) { cfg.langs.push(e.target.value); update(); } };
$("ui").onclick = () => { ui = ui === "ar" ? "en" : "ar"; try { localStorage.setItem("cuetrove-ui", ui); } catch {} paint(); };
document.querySelectorAll("[data-show]").forEach((b) => {
  b.onclick = () => { const i = $(b.dataset.show); i.type = i.type === "password" ? "text" : "password"; paint(); };
});
$("copy").onclick = async () => {
  try { await navigator.clipboard.writeText($("url").value); } catch { $("url").select(); document.execCommand("copy"); }
  $("copied").textContent = t("copied");
};

// ---------- my subtitles ----------
const STARTED_MY = cfg.my || "";
const CINEMETA = "https://v3-cinemeta.strem.io";
let picked = null;         // {id, name, type}
let episodes = [];         // [{season, episode, title}]

function randomVault() {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => abc[b % abc.length]).join("");
}

function mineBase() { return ORIGIN + "/" + encode(cfg); }

function msg(text, ok) {
  const m = $("mMsg");
  m.textContent = text || "";
  m.className = "hint " + (ok === true ? "msg-ok" : ok === false ? "msg-bad" : "");
}

function showMine() {
  $("mineOff").hidden = Boolean(cfg.my);
  $("mineBox").hidden = !cfg.my;
  $("reinstall").hidden = cfg.my === STARTED_MY;
  const sel = $("mLang");
  const keep = sel.value;
  sel.innerHTML = "";
  const order = [...cfg.langs, ...LANGS.map((l) => l[0]).filter((c) => !cfg.langs.includes(c))];
  for (const code of order) {
    const [, en, native] = name(code);
    const o = document.createElement("option");
    o.value = code;
    o.textContent = native === en ? en : en + " · " + native;
    sel.appendChild(o);
  }
  sel.value = keep || cfg.langs[0] || "ar";
  if (cfg.my) loadList();
}

async function search() {
  const q = $("mQuery").value.trim();
  if (!q) return;
  const type = $("mType").value;
  const box = $("mResults");
  box.innerHTML = "";
  picked = null;
  $("mEp").hidden = true;
  try {
    const data = await (await fetch(CINEMETA + "/catalog/" + type + "/top/search=" + encodeURIComponent(q) + ".json")).json();
    const metas = (data.metas || []).filter((m) => /^tt\\d+$/.test(m.id)).slice(0, 8);
    if (!metas.length) { box.textContent = t("noResults"); return; }
    for (const m of metas) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "result";
      b.innerHTML = "<img alt=''><span><b></b><small></small></span>";
      if (m.poster) b.querySelector("img").src = m.poster;
      b.querySelector("b").textContent = m.name;
      b.querySelector("small").textContent = m.releaseInfo || "";
      b.onclick = () => pick(m, type, b);
      box.appendChild(b);
    }
  } catch {
    box.textContent = t("noResults");
  }
}

async function pick(m, type, button) {
  document.querySelectorAll(".result").forEach((x) => x.classList.toggle("on", x === button));
  picked = { id: m.id, name: m.name + (m.releaseInfo ? " (" + m.releaseInfo + ")" : ""), type };
  $("mEp").hidden = type !== "series";
  if (type !== "series") return;
  episodes = [];
  try {
    const data = await (await fetch(CINEMETA + "/meta/series/" + m.id + ".json")).json();
    episodes = ((data.meta && data.meta.videos) || []).filter((v) => v.season && v.episode)
      .map((v) => ({ season: v.season, episode: v.episode, title: v.name || v.title || "" }))
      .sort((a, b) => a.season - b.season || a.episode - b.episode);
  } catch { /* numbers to pick by hand below */ }
  const seasons = [...new Set(episodes.map((e) => e.season))];
  const ss = $("mSeason");
  ss.innerHTML = "";
  for (const n of seasons.length ? seasons : Array.from({ length: 30 }, (_, i) => i + 1)) {
    const o = document.createElement("option"); o.value = n; o.textContent = n; ss.appendChild(o);
  }
  fillEpisodes();
}

function fillEpisodes() {
  const season = Number($("mSeason").value);
  const list = episodes.filter((e) => e.season === season);
  const es = $("mEpisode");
  es.innerHTML = "";
  for (const e of list.length ? list : Array.from({ length: 50 }, (_, i) => ({ episode: i + 1, title: "" }))) {
    const o = document.createElement("option");
    o.value = e.episode;
    o.textContent = e.episode + (e.title ? " · " + e.title : "");
    es.appendChild(o);
  }
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return btoa(bin);
}

async function upload() {
  if (!picked) return msg(t("pickTitle"), false);
  const file = $("mFile").files[0];
  if (!file) return msg(t("pickFile"), false);
  let video = picked.id;
  let title = picked.name;
  if (picked.type === "series") {
    video += ":" + $("mSeason").value + ":" + $("mEpisode").value;
    title += " · S" + $("mSeason").value + "E" + $("mEpisode").value;
  }
  msg(t("uploading"));
  $("mUpload").disabled = true;
  try {
    const data = toBase64(await file.arrayBuffer());
    const res = await fetch(mineBase() + "/mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video, title, lang: $("mLang").value, label: $("mLabel").value.trim() || file.name.replace(/\\.[^.]+$/, ""), data }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || res.status);
    msg(t("uploaded").replace("{n}", out.cues), true);
    $("mFile").value = "";
    $("mLabel").value = "";
    loadList();
  } catch (e) {
    msg(String(e.message || e), false);
  } finally {
    $("mUpload").disabled = false;
  }
}

async function loadList() {
  const box = $("mList");
  try {
    const out = await (await fetch(mineBase() + "/mine.json")).json();
    box.innerHTML = "";
    if (!out.files || !out.files.length) { box.textContent = t("none"); return; }
    for (const f of out.files) {
      const row = document.createElement("div");
      row.className = "file";
      row.innerHTML = "<div class='what'><b></b><small></small></div><button type='button'></button>";
      row.querySelector("b").textContent = f.t || f.v;
      row.querySelector("small").textContent = name(f.l)[1] + (f.n ? " · " + f.n : "") + " · " + new Date(f.a).toLocaleDateString();
      const del = row.querySelector("button");
      del.textContent = t("del");
      del.onclick = async () => {
        del.disabled = true;
        await fetch(mineBase() + "/mine/delete/" + f.f, { method: "POST" });
        loadList();
      };
      box.appendChild(row);
    }
  } catch {
    box.textContent = "";
  }
}

$("mineOn").onclick = () => { cfg.my = randomVault(); update(); showMine(); };
$("mSearch").onclick = search;
$("mQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
$("mSeason").onchange = fillEpisodes;
$("mUpload").onclick = upload;

load();
paint();
update();
showMine();
</script>
</body>
</html>`;
}
