// Reading any subtitle file (SRT, WebVTT, ASS/SSA, MicroDVD, MPL2) in any encoding, and writing
// clean UTF-8 SRT or WebVTT that players show the same way everywhere.

import { CODEPAGES } from "./codepages.js";
import { RTL, legacyEncoding, scriptOf } from "./languages.js";

// ---------- encodings ----------

const ALIASES = {
  cp1250: "windows-1250", cp1251: "windows-1251", cp1252: "windows-1252", cp1253: "windows-1253",
  cp1254: "windows-1254", cp1255: "windows-1255", cp1256: "windows-1256", cp1257: "windows-1257",
  cp1258: "windows-1258", cp874: "windows-874", "iso-8859-1": "windows-1252", latin1: "windows-1252",
  ascii: "utf-8", "us-ascii": "utf-8", "utf8": "utf-8", gb2312: "gb18030", gbk: "gb18030", cp936: "gb18030",
  cp950: "big5", "big-5": "big5", cp932: "shift_jis", sjis: "shift_jis", cp949: "euc-kr", "ks_c_5601-1987": "euc-kr",
  "iso-8859-6": "iso-8859-6", "iso-8859-7": "iso-8859-7", "iso-8859-8": "iso-8859-8", "koi8-r": "koi8-r",
};

export function encodingName(hint) {
  if (!hint) return null;
  const h = String(hint).trim().toLowerCase().replace(/_/g, "-");
  if (ALIASES[h]) return ALIASES[h];
  if (/^windows-\d+$/.test(h) || CODEPAGES[h]) return h;
  if (["gb18030", "big5", "shift_jis", "euc-kr", "euc-jp", "utf-16le", "utf-16be", "utf-8"].includes(h)) return h;
  return null;
}

function legacy(bytes, enc) {
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    // This runtime's TextDecoder does not know the code page: use our own table.
  }
  const table = CODEPAGES[enc] || CODEPAGES["windows-1252"];
  let out = "";
  for (let i = 0; i < bytes.length; i += 4096) {
    const chunk = bytes.subarray(i, i + 4096);
    let s = "";
    for (const b of chunk) s += b < 0x80 ? String.fromCharCode(b) : table[b - 0x80];
    out += s;
  }
  return out;
}

function scriptShare(text, code) {
  const re = scriptOf(code);
  if (!re) return 1;
  text = text.length > 12000 ? text.slice(0, 6000) + text.slice(-6000) : text;   // a sample is enough
  const letters = text.match(/\p{L}/gu);
  if (!letters || letters.length < 20) return 1;
  return (text.match(re) || []).length / letters.length;
}

/**
 * Bytes -> text. Order: byte-order mark, strict UTF-8, the site's encoding hint, then the code
 * page usual for the language (cp1256 for Arabic...). A guess is kept only when the text comes out
 * in the language's own script.
 */
export function decode(bytes, { lang = "", hint = "" } = {}) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const zeros = utf16Guess(bytes);
  if (zeros) return new TextDecoder(zeros).decode(bytes);
  try {
    return repair(new TextDecoder("utf-8", { fatal: true }).decode(bytes), lang);
  } catch {
    // not UTF-8
  }
  const tries = [];
  for (const e of [encodingName(hint), legacyEncoding(lang), "windows-1256", "windows-1251", "windows-1252"]) {
    if (e && e !== "utf-8" && !tries.includes(e)) tries.push(e);
  }
  let best = null;
  let bestShare = -1;
  for (const enc of tries) {
    const text = legacy(bytes, enc);
    const share = scriptShare(text, lang);
    if (share >= 0.6) return text;
    if (share > bestShare) [best, bestShare] = [text, share];
  }
  return best;
}

function utf16Guess(bytes) {
  const n = Math.min(bytes.length, 2000) & ~1;
  if (n < 20) return null;
  let even = 0, odd = 0;
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) even++;
    if (bytes[i + 1] === 0) odd++;
  }
  if (odd > n / 2 * 0.4 && even < n / 2 * 0.05) return "utf-16le";
  if (even > n / 2 * 0.4 && odd < n / 2 * 0.05) return "utf-16be";
  return null;
}

let REVERSE1252 = null;

/**
 * Fixes text that was decoded with the wrong code page before it was saved as UTF-8: Arabic that
 * reads "ÇáÓáÇã" (cp1256 bytes shown as cp1252) becomes "السلام" again. Same for Hebrew, Cyrillic,
 * Greek, Turkish and Central European text.
 */
export function repair(text, lang) {
  const target = legacyEncoding(lang);
  if (!lang || target === "windows-1252" || !CODEPAGES[target]) return text;
  if (scriptShare(text, lang) >= 0.3) return text;
  const sample = text.length > 12000 ? text.slice(0, 12000) : text;
  const latin = (sample.match(/[À-ÿ]/g) || []).length;
  const letters = (sample.match(/\p{L}/gu) || []).length;
  if (letters < 20 || latin / letters < 0.25) return text;
  if (!REVERSE1252) {
    REVERSE1252 = new Map();
    [...CODEPAGES["windows-1252"]].forEach((ch, i) => REVERSE1252.set(ch, 0x80 + i));
  }
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes[i] = c;
    else if (c <= 0xff && !REVERSE1252.has(text[i])) bytes[i] = c;   // latin-1 control range
    else if (REVERSE1252.has(text[i])) bytes[i] = REVERSE1252.get(text[i]);
    else return text;                                                // a character cp1252 cannot hold
  }
  const fixed = legacy(bytes, target);
  return scriptShare(fixed, lang) > 0.6 ? fixed : text;
}

// ---------- parsing ----------

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.:](\d{1,3})/;

function ms(stamp) {
  const m = TIME.exec(stamp.trim());
  if (!m) return null;
  const [, h, mi, s, frac] = m;
  return ((Number(h || 0) * 60 + Number(mi)) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, "0").slice(0, 3));
}

/** Any supported subtitle text -> [{start, end, text}] in time order (times in ms). */
export function parse(text, { fps = 23.976 } = {}) {
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  let cues;
  if (/^\s*\[Script Info\]/i.test(text) || /^Dialogue:/m.test(text)) cues = parseAss(text);
  else if (/^\s*\{\d+\}\{\d*\}/m.test(text)) cues = parseMicroDvd(text, fps);
  else if (/^\s*\[\d+\]\[\d*\]/m.test(text)) cues = parseMpl2(text);
  else cues = parseSrtVtt(text);
  return cues.filter((c) => c.text.trim() && c.end > c.start).sort((a, b) => a.start - b.start);
}

function parseSrtVtt(text) {
  const cues = [];
  const arrow = /^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = arrow.exec(lines[i]);
    if (!m) continue;
    const start = ms(m[1]);
    const end = ms(m[2]);
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (!lines[j].trim()) {
        // a blank line ends the cue, unless the next line is plainly more text of it (broken files)
        const next = lines[j + 1];
        if (next === undefined || /^\s*\d+\s*$/.test(next) || arrow.test(next) || !next.trim()) break;
        continue;
      }
      if (arrow.test(lines[j])) break;
      if (/^\s*\d+\s*$/.test(lines[j]) && j + 1 < lines.length && arrow.test(lines[j + 1])) break;
      body.push(lines[j]);
    }
    i = j - 1;
    if (start !== null && end !== null) cues.push({ start, end, text: body.join("\n").trim() });
  }
  return cues;
}

function parseAss(text) {
  const cues = [];
  let format = ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
  for (const line of text.split("\n")) {
    const f = /^Format:\s*(.*)$/i.exec(line);
    if (f && /text/i.test(f[1])) format = f[1].split(",").map((s) => s.trim().toLowerCase());
    const d = /^Dialogue:\s*(.*)$/i.exec(line);
    if (!d) continue;
    const parts = d[1].split(",");
    const textAt = format.indexOf("text");
    const row = parts.slice(0, textAt).concat(parts.slice(textAt).join(","));
    const start = ms(row[format.indexOf("start")] || "");
    const end = ms(row[format.indexOf("end")] || "");
    let body = row[textAt] || "";
    const italic = /\{[^}]*\\i1[^}]*\}/.test(body);
    body = body.replace(/\{[^}]*\}/g, "").replace(/\\N/gi, "\n").replace(/\\h/g, " ").trim();
    if (italic && body) body = `<i>${body}</i>`;
    if (start !== null && end !== null && body) cues.push({ start, end, text: body });
  }
  return cues;
}

function parseMicroDvd(text, fps) {
  const cues = [];
  for (const line of text.split("\n")) {
    const m = /^\s*\{(\d+)\}\{(\d*)\}(.*)$/.exec(line);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a + fps * 3;
    if (a === 1 && b === 1 && /^\d+([.,]\d+)?$/.test(m[3].trim())) {
      fps = Number(m[3].trim().replace(",", ".")) || fps;    // {1}{1}23.976 declares the frame rate
      continue;
    }
    const body = m[3].replace(/\{[^}]*\}/g, "").split("|").map((s) => s.replace(/^\/+/, "")).join("\n").trim();
    cues.push({ start: Math.round((a / fps) * 1000), end: Math.round((b / fps) * 1000), text: body });
  }
  return cues;
}

function parseMpl2(text) {
  const cues = [];
  for (const line of text.split("\n")) {
    const m = /^\s*\[(\d+)\]\[(\d*)\](.*)$/.exec(line);
    if (!m) continue;
    const a = Number(m[1]) * 100;
    const b = m[2] ? Number(m[2]) * 100 : a + 3000;
    cues.push({ start: a, end: b, text: m[3].split("|").map((s) => s.replace(/^\/+/, "")).join("\n").trim() });
  }
  return cues;
}

// ---------- cleaning ----------

const BIDI = /[‎‏‪-‮⁦-⁩]/g;
const RLM = "‏";
const LEAD_TAGS = /^((?:\s*(?:<[^>]+>|\{[^}]*\}))*)/;
const TRAIL_TAGS = /((?:(?:<\/[^>]+>|\{[^}]*\})\s*)*)$/;
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

function splitTags(line) {
  const lead = LEAD_TAGS.exec(line)[1];
  const rest = line.slice(lead.length);
  const trail = TRAIL_TAGS.exec(rest)[1];
  return [lead, rest.slice(0, rest.length - trail.length).replace(BIDI, "").trim(), trail];
}

const START_PUNCT = /^([.!?؟،,…:;]+)\s*(.*[\p{L}\p{N}\p{M}])$/u;
const END_DASH = /^(.*[\p{L}\p{N}\p{M}.!?؟…])\s+-$/u;

/**
 * Some Arabic, Persian and Hebrew files were made for old players: their punctuation is stored at
 * the wrong end (".مرحبا", "مرحبا -") so it showed right there. True when most lines of a file look
 * like that; then every line is turned back into reading order.
 */
export function isFlipped(lines) {
  let start = 0, end = 0, dashEnd = 0, dashStart = 0;
  for (const line of lines) {
    const core = splitTags(line)[1];
    if (!RTL_LETTER.test(core)) continue;
    if (/^[.!?؟،,…]/.test(core) && /[\p{L}\p{N}\p{M}]$/u.test(core)) start++;
    if (/[.!?؟،,…]$/.test(core)) end++;
    if (/\s-$/.test(core)) dashEnd++;
    if (/^-\s?/.test(core)) dashStart++;
  }
  return (start >= 5 && start > end * 2) || (dashEnd >= 3 && dashEnd > dashStart * 2);
}

/**
 * One line of right-to-left text, made to show the same in every player: punctuation back in
 * reading order (when the file was flipped), and the line wrapped in right-to-left marks so a full
 * stop or question mark sits at the left end even in players that lay every line out
 * left-to-right.
 */
export function fixRtlLine(line, flipped = false) {
  const [lead, text, trail] = splitTags(line);
  let core = text;
  if (!RTL_LETTER.test(core)) return line;
  if (flipped) {
    const p = START_PUNCT.exec(core);
    if (p) core = p[2] + p[1];
    const d = END_DASH.exec(core);
    if (d && !core.startsWith("-")) core = "- " + d[1];
  }
  return `${lead}${RLM}${core}${RLM}${trail}`;
}

/** Cues ready to write: tidy text, right-to-left lines fixed, no empty cues. */
export function clean(cues, lang, { rtl = true } = {}) {
  const isRtl = rtl && RTL.has(lang);
  const rows = cues.map((c) => c.text
    .replace(/<(?!\/?(?:i|b|u|font)\b)[^>]*>/gi, "")   // keep only tags players understand
    .replace(/\{\\an?\d\}/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean));
  const flipped = isRtl && isFlipped(rows.flat());
  const out = [];
  for (const [i, c] of cues.entries()) {
    let text = rows[i];
    if (isRtl) text = text.map((l) => fixRtlLine(l, flipped));
    const joined = text.join("\n");
    if (!joined.replace(/<[^>]+>/g, "").trim()) continue;
    out.push({ start: Math.max(0, c.start), end: Math.max(c.end, c.start + 200), text: joined });
  }
  return out;
}

// ---------- writing ----------

function stamp(t, sep) {
  t = Math.max(0, Math.round(t));
  const h = String(Math.floor(t / 3600000)).padStart(2, "0");
  const m = String(Math.floor(t / 60000) % 60).padStart(2, "0");
  const s = String(Math.floor(t / 1000) % 60).padStart(2, "0");
  return `${h}:${m}:${s}${sep}${String(t % 1000).padStart(3, "0")}`;
}

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.text}\n`).join("\n");
}

export function toVtt(cues) {
  const body = cues.map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.text.replace(/<\/?font[^>]*>/gi, "")}\n`).join("\n");
  return "WEBVTT\n\n" + body;
}

/** Bytes of any subtitle file -> UTF-8 SRT or VTT text, or null when nothing could be read. */
export function convert(bytes, { lang = "", hint = "", format = "srt", rtl = true, fps } = {}) {
  const text = decode(bytes, { lang, hint });
  if (!text) return null;
  const cues = clean(parse(text, fps ? { fps } : {}), lang, { rtl });
  if (!cues.length) return null;
  return format === "vtt" ? toVtt(cues) : toSrt(cues);
}

export const SUBTITLE_FILE = /\.(srt|vtt|ass|ssa|sub|txt|smi)$/i;
