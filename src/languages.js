// Every language Cuetrove knows: our code, English name, native name, the ISO 639-2 code that
// Stremio and Nuvio group subtitles by, and the other spellings subtitle sites use for it.

const TABLE = [
  ["ar", "Arabic", "العربية", "ara", ["arabic"]],
  ["en", "English", "English", "eng", ["english"]],
  ["fr", "French", "Français", "fre", ["fra", "french"]],
  ["es", "Spanish", "Español", "spa", ["spanish", "spn", "es-es", "sp"]],
  ["es-419", "Spanish (Latin America)", "Español (Latinoamérica)", "spa", ["spl", "ea", "es-la", "es-mx", "spanish latin america", "latin american spanish"]],
  ["de", "German", "Deutsch", "ger", ["deu", "german"]],
  ["it", "Italian", "Italiano", "ita", ["italian"]],
  ["pt", "Portuguese", "Português", "por", ["portuguese", "pt-pt"]],
  ["pt-BR", "Portuguese (Brazil)", "Português (Brasil)", "pob", ["pb", "pt-br", "br_pt", "brazilian portuguese", "brazillian portuguese", "portuguese brazil", "portuguese brazilian"]],
  ["tr", "Turkish", "Türkçe", "tur", ["turkish"]],
  ["fa", "Persian", "فارسی", "per", ["fas", "farsi", "persian", "farsi persian", "farsi_persian"]],
  ["ur", "Urdu", "اردو", "urd", ["urdu"]],
  ["he", "Hebrew", "עברית", "heb", ["hebrew", "iw"]],
  ["ku", "Kurdish", "Kurdî", "kur", ["kurdish"]],
  ["ps", "Pashto", "پښتو", "pus", ["pashto"]],
  ["hi", "Hindi", "हिन्दी", "hin", ["hindi"]],
  ["bn", "Bengali", "বাংলা", "ben", ["bengali", "bangla"]],
  ["ta", "Tamil", "தமிழ்", "tam", ["tamil"]],
  ["te", "Telugu", "తెలుగు", "tel", ["telugu"]],
  ["ml", "Malayalam", "മലയാളം", "mal", ["malayalam"]],
  ["kn", "Kannada", "ಕನ್ನಡ", "kan", ["kannada"]],
  ["mr", "Marathi", "मराठी", "mar", ["marathi"]],
  ["gu", "Gujarati", "ગુજરાતી", "guj", ["gujarati"]],
  ["pa", "Punjabi", "ਪੰਜਾਬੀ", "pan", ["punjabi"]],
  ["si", "Sinhala", "සිංහල", "sin", ["sinhala", "sinhalese"]],
  ["ne", "Nepali", "नेपाली", "nep", ["nepali"]],
  ["id", "Indonesian", "Bahasa Indonesia", "ind", ["indonesian", "in"]],
  ["ms", "Malay", "Bahasa Melayu", "may", ["msa", "malay"]],
  ["tl", "Filipino", "Filipino", "tgl", ["fil", "tagalog", "filipino"]],
  ["th", "Thai", "ไทย", "tha", ["thai"]],
  ["vi", "Vietnamese", "Tiếng Việt", "vie", ["vietnamese"]],
  ["my", "Burmese", "မြန်မာ", "bur", ["mya", "burmese"]],
  ["km", "Khmer", "ខ្មែរ", "khm", ["khmer", "cambodian"]],
  ["lo", "Lao", "ລາວ", "lao", ["lao"]],
  ["ja", "Japanese", "日本語", "jpn", ["japanese", "jp"]],
  ["ko", "Korean", "한국어", "kor", ["korean", "kr"]],
  ["zh", "Chinese (Simplified)", "简体中文", "chi", ["zho", "chs", "zh-cn", "zh-hans", "chinese", "chinese simplified", "chinese bg code", "simplified chinese"]],
  ["zh-TW", "Chinese (Traditional)", "繁體中文", "zht", ["cht", "zh-tw", "zh-hant", "zh-hk", "zh_bg", "big 5 code", "chinese traditional", "traditional chinese"]],
  ["ze", "Chinese + English", "中英双语", "ze", ["chinese bilingual", "chinese english"]],
  ["ru", "Russian", "Русский", "rus", ["russian"]],
  ["uk", "Ukrainian", "Українська", "ukr", ["ukrainian", "ukranian"]],
  ["be", "Belarusian", "Беларуская", "bel", ["belarusian"]],
  ["bg", "Bulgarian", "Български", "bul", ["bulgarian"]],
  ["sr", "Serbian", "Српски", "scc", ["srp", "serbian"]],
  ["hr", "Croatian", "Hrvatski", "hrv", ["croatian"]],
  ["bs", "Bosnian", "Bosanski", "bos", ["bosnian"]],
  ["sl", "Slovenian", "Slovenščina", "slv", ["slovenian", "slovene"]],
  ["mk", "Macedonian", "Македонски", "mac", ["mkd", "macedonian"]],
  ["sq", "Albanian", "Shqip", "alb", ["sqi", "albanian"]],
  ["el", "Greek", "Ελληνικά", "gre", ["ell", "greek"]],
  ["ro", "Romanian", "Română", "rum", ["ron", "romanian"]],
  ["hu", "Hungarian", "Magyar", "hun", ["hungarian"]],
  ["cs", "Czech", "Čeština", "cze", ["ces", "czech"]],
  ["sk", "Slovak", "Slovenčina", "slo", ["slk", "slovak"]],
  ["pl", "Polish", "Polski", "pol", ["polish"]],
  ["nl", "Dutch", "Nederlands", "dut", ["nld", "dutch", "flemish"]],
  ["sv", "Swedish", "Svenska", "swe", ["swedish"]],
  ["no", "Norwegian", "Norsk", "nor", ["nob", "nb", "nno", "norwegian"]],
  ["da", "Danish", "Dansk", "dan", ["danish"]],
  ["fi", "Finnish", "Suomi", "fin", ["finnish"]],
  ["is", "Icelandic", "Íslenska", "ice", ["isl", "icelandic"]],
  ["et", "Estonian", "Eesti", "est", ["estonian"]],
  ["lv", "Latvian", "Latviešu", "lav", ["latvian"]],
  ["lt", "Lithuanian", "Lietuvių", "lit", ["lithuanian"]],
  ["ca", "Catalan", "Català", "cat", ["catalan"]],
  ["eu", "Basque", "Euskara", "baq", ["eus", "basque"]],
  ["gl", "Galician", "Galego", "glg", ["galician"]],
  ["ga", "Irish", "Gaeilge", "gle", ["irish"]],
  ["cy", "Welsh", "Cymraeg", "wel", ["cym", "welsh"]],
  ["ka", "Georgian", "ქართული", "geo", ["kat", "georgian"]],
  ["hy", "Armenian", "Հայերեն", "arm", ["hye", "armenian"]],
  ["az", "Azerbaijani", "Azərbaycan", "aze", ["azerbaijani"]],
  ["kk", "Kazakh", "Қазақ", "kaz", ["kazakh"]],
  ["uz", "Uzbek", "Oʻzbek", "uzb", ["uzbek"]],
  ["mn", "Mongolian", "Монгол", "mon", ["mongolian"]],
  ["sw", "Swahili", "Kiswahili", "swa", ["swahili"]],
  ["am", "Amharic", "አማርኛ", "amh", ["amharic"]],
  ["so", "Somali", "Soomaali", "som", ["somali"]],
  ["af", "Afrikaans", "Afrikaans", "afr", ["afrikaans"]],
  ["eo", "Esperanto", "Esperanto", "epo", ["esperanto"]],
  ["la", "Latin", "Latina", "lat", ["latin"]],
  ["mni", "Manipuri", "মৈতৈলোন্", "mni", ["manipuri"]],
  ["kl", "Greenlandic", "Kalaallisut", "kal", ["greenlandic"]],
];

export const LANGUAGES = TABLE.map(([code, name, native, iso, aliases]) => ({ code, name, native, iso, aliases }));

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));
const LOOKUP = new Map();
for (const l of LANGUAGES) {
  for (const key of [l.code, l.iso, l.name, ...l.aliases]) {
    const k = norm(key);
    if (!LOOKUP.has(k)) LOOKUP.set(k, l.code);
  }
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** 'ara', 'AR', 'arabic', 'Farsi_Persian', 'pt-BR', 'BR_PT' -> our code; null when unknown. */
export function toCode(any) {
  if (!any) return null;
  const k = norm(any);
  if (LOOKUP.has(k)) return LOOKUP.get(k);
  const first = k.split(" ")[0];                      // "english german" (bilingual) -> first language
  return k.includes(" ") && LOOKUP.has(first) ? LOOKUP.get(first) : null;
}

export function language(code) {
  return BY_CODE.get(code) || null;
}

export function langName(code) {
  return BY_CODE.get(code)?.name || code;
}

/** The ISO 639-2 code players group by ('ara', 'eng', 'pob'...). */
export function iso3(code) {
  return BY_CODE.get(code)?.iso || code;
}

export const RTL = new Set(["ar", "fa", "ur", "he", "ps"]);

/** The legacy code page a subtitle in this language was most likely saved in (when not UTF-8). */
export function legacyEncoding(code) {
  switch (code) {
    case "ar": case "fa": case "ur": case "ps": return "windows-1256";
    case "he": return "windows-1255";
    case "ru": case "uk": case "be": case "bg": case "sr": case "mk": case "kk": case "mn": return "windows-1251";
    case "el": return "windows-1253";
    case "tr": case "az": return "windows-1254";
    case "cs": case "sk": case "pl": case "hu": case "ro": case "hr": case "sl": case "bs": case "sq": return "windows-1250";
    case "et": case "lv": case "lt": return "windows-1257";
    case "vi": return "windows-1258";
    case "th": return "windows-874";
    case "zh": case "ze": return "gb18030";
    case "zh-TW": return "big5";
    case "ja": return "shift_jis";
    case "ko": return "euc-kr";
    default: return "windows-1252";
  }
}

/** The script a language's text should mostly be in, to check a decoding guess. */
export function scriptOf(code) {
  if (["ar", "fa", "ur", "ps"].includes(code)) return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
  if (code === "he") return /[֐-׿]/g;
  if (["ru", "uk", "be", "bg", "mk", "kk", "mn"].includes(code)) return /[Ѐ-ӿ]/g;
  if (code === "el") return /[Ͱ-Ͽἀ-῿]/g;
  if (code === "th") return /[฀-๿]/g;
  if (["zh", "zh-TW", "ze", "ja"].includes(code)) return /[぀-ヿ㐀-鿿]/g;
  if (code === "ko") return /[가-힯ᄀ-ᇿ]/g;
  if (code === "hi" || code === "mr" || code === "ne") return /[ऀ-ॿ]/g;
  return null;
}
