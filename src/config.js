// The user's settings live in the add-on address itself (base64url JSON), like every configurable
// Stremio add-on: nothing is stored on the server, and each person's own API keys stay in their
// own install link.

import { language } from "./languages.js";

export const DEFAULTS = Object.freeze({
  langs: ["ar", "en"],     // the user's languages, first = top of the list
  only: false,             // true: only these languages; false: these first, then every other language
  per: 3,                  // tracks per language
  os: true,                // OpenSubtitles through Stremio's public OpenSubtitles add-on (no key)
  subdl: "",               // SubDL API key (free, from subdl.com)
  ss: "",                  // SubSource API key (free, from subsource.net)
  hi: "any",               // hearing impaired: any | prefer | avoid
  official: true,          // only official subtitles: marked retail, or made for a service's/disc's release
  fmt: "srt",              // srt | vtt
  rtl: true,               // fix right-to-left punctuation
  my: "",                  // private id of the user's own uploaded subtitles ("My subtitles")
});

function b64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text) {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const KEY = /^[A-Za-z0-9_\-.:]{0,128}$/;

/** Any object -> a complete, safe config (unknown fields dropped, bad values replaced). */
export function normalize(raw = {}) {
  const c = { ...DEFAULTS };
  if (Array.isArray(raw.langs)) {
    const langs = raw.langs.filter((l) => typeof l === "string" && language(l));
    c.langs = [...new Set(langs)].slice(0, 40);
  }
  if (typeof raw.only === "boolean") c.only = raw.only && c.langs.length > 0;
  if (Number.isInteger(raw.per)) c.per = Math.min(10, Math.max(1, raw.per));
  if (typeof raw.os === "boolean") c.os = raw.os;
  if (typeof raw.subdl === "string" && KEY.test(raw.subdl.trim())) c.subdl = raw.subdl.trim();
  if (typeof raw.ss === "string" && KEY.test(raw.ss.trim())) c.ss = raw.ss.trim();
  if (["any", "prefer", "avoid"].includes(raw.hi)) c.hi = raw.hi;
  if (typeof raw.official === "boolean") c.official = raw.official;
  if (["srt", "vtt"].includes(raw.fmt)) c.fmt = raw.fmt;
  if (typeof raw.rtl === "boolean") c.rtl = raw.rtl;
  if (typeof raw.my === "string" && /^[A-Za-z0-9]{24,40}$/.test(raw.my)) c.my = raw.my;
  return c;
}

/** Only the fields that differ from the defaults, so links stay short. */
export function encode(config) {
  const c = normalize(config);
  const small = {};
  for (const [k, v] of Object.entries(c)) {
    if (JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])) small[k] = v;
  }
  return Object.keys(small).length ? b64urlEncode(JSON.stringify(small)) : "";
}

/** A path segment -> config, or null when it is not one of ours. */
export function decode(segment) {
  if (!segment || !/^[A-Za-z0-9_-]{4,4000}$/.test(segment)) return null;
  try {
    const raw = JSON.parse(b64urlDecode(segment));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? normalize(raw) : null;
  } catch {
    return null;
  }
}
