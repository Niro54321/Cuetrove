// The Stremio add-on protocol, as Stremio and Nuvio speak it:
//   /{config}/manifest.json
//   /{config}/subtitles/{type}/{id}/{extra}.json   -> the list of tracks
//   /{config}/file/{source}/{token}.srt|vtt        -> one subtitle, converted to clean UTF-8
//   /{config}/configure                            -> the settings page
// {config} is optional; without it the defaults are used (Arabic and English first, no keys).

import { DEFAULTS, decode as decodeConfig, encode as encodeConfig } from "./config.js";
import { getJson as cacheGet, putJson as cachePut } from "./cache.js";
import { inferServices } from "./fingerprint.js";
import { extras, resolve } from "./ids.js";
import { LANGUAGES, iso3, langName, language } from "./languages.js";
import { LOGO_PNG } from "./logo.js";
import { VERSION } from "./net.js";
import { page } from "./page.js";
import { describe, episodeOf, matchScore } from "./release.js";
import * as mine from "./sources/mine.js";
import * as opensubtitles from "./sources/opensubtitles.js";
import * as subdl from "./sources/subdl.js";
import * as subsource from "./sources/subsource.js";
import { SUBTITLE_FILE, convert } from "./subtitle.js";
import { entries, isZip } from "./zip.js";

export const SOURCES = [mine, subsource, subdl, opensubtitles];
const BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

const SEARCH_TTL = 6 * 3600;
const FILE_TTL = 30 * 86400;

// ---------- responses ----------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
};

function json(data, maxAge = 0) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
  });
}

function text(body, type, status = 200, maxAge = 0) {
  return new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": type, "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" },
  });
}

function b64url(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

// ---------- entry point ----------

/**
 * env: { cache, fetch?, log? } — cache is a MemoryCache/WorkerCache; fetch defaults to the global.
 */
export async function handle(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Private-Network": "true", "Access-Control-Max-Age": "86400" } });
  }
  if (!["GET", "HEAD", "POST"].includes(request.method)) return text("method not allowed", "text/plain", 405);
  const url = new URL(request.url);
  let parts = url.pathname.split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  let cfg = decodeConfig(parts[0]);
  let seg = "";
  if (cfg) {
    seg = parts[0];
    parts = parts.slice(1);
  } else {
    cfg = { ...DEFAULTS, langs: [...DEFAULTS.langs] };
  }
  const base = `${url.origin}${seg ? "/" + seg : ""}`;
  try {
    if (parts[0] === "mine" || parts[0] === "mine.json") return await mineRoute(request, env, cfg, parts);
    if (request.method === "POST") return text("method not allowed", "text/plain", 405);
    if (!parts.length) return Response.redirect(`${base}/configure`, 302);
    if (parts.length === 1 && parts[0] === "configure") {
      return text(page({ origin: url.origin, config: cfg, languages: LANGUAGES, version: VERSION, storage: Boolean(env.store) }), "text/html; charset=utf-8");
    }
    if (parts.length === 1 && parts[0] === "manifest.json") return json(manifest(url.origin, base, cfg), 3600);
    if (parts.length === 1 && parts[0] === "logo.png") return new Response(LOGO_PNG, { headers: { ...CORS, "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" } });
    if (parts.length === 1 && parts[0] === "health") return text("ok", "text/plain");
    if (parts[0] === "subtitles" && (parts.length === 3 || parts.length === 4)) {
      const type = parts[1];
      const last = parts[parts.length - 1].replace(/\.json$/, "");
      const id = parts.length === 3 ? last : parts[2];
      const extra = parts.length === 4 ? last : "";
      const subtitles = await listSubtitles(env, cfg, base, type, id, extra);
      return json({ subtitles, cacheMaxAge: subtitles.length ? 3600 : 300 });
    }
    if (parts[0] === "file" && parts.length === 3) {
      const m = /^([A-Za-z0-9_-]{2,1500})\.(srt|vtt)$/.exec(parts[2]);
      if (!m || !BY_ID[parts[1]]) return text("not found", "text/plain", 404);
      return await serveFile(env, cfg, parts[1], m[1], m[2]);
    }
  } catch (err) {
    env.log?.(`error on ${url.pathname.replace(/^\/[A-Za-z0-9_-]{20,}/, "/{config}")}: ${err?.stack || err}`);
    return text("error", "text/plain", 500);
  }
  return text("not found", "text/plain", 404);
}

// ---------- manifest ----------

export function manifest(origin, base, cfg) {
  const langs = cfg.langs.map(langName);
  const listed = langs.length > 1 ? `${langs.slice(0, -1).join(", ")} and ${langs[langs.length - 1]}` : langs[0] || "every language";
  const sources = SOURCES.filter((s) => s.enabled(cfg)).map((s) => s.title);
  const prefixes = ["tt", "kitsu"];
  if (cfg.subdl) prefixes.push("tmdb");
  return {
    id: "io.github.niro54321.cuetrove",
    version: VERSION,
    name: "Cuetrove",
    description: `${cfg.official ? "Official subtitles" : "Subtitles"} in ${listed}${cfg.only ? "" : ", then every other language"}. ` +
      "Releases made for Netflix, Disney+, Crunchyroll, Paramount+, Apple TV+ and other services come first, " +
      `labelled with their source. From ${sources.join(", ") || "no source yet: open Configure"}.`,
    logo: `${origin}/logo.png`,
    resources: ["subtitles"],
    types: ["movie", "series", "anime", "other"],
    idPrefixes: prefixes,
    catalogs: [],
    behaviorHints: { configurable: true, configurationRequired: false },
  };
}

// ---------- the list ----------

function searchKey(src, cfg, video, extra) {
  const id = video.imdb || `tmdb${video.tmdb}`;
  const langs = src.id === "os" ? "" : `${cfg.only ? "only" : "all"}:${cfg.langs.join(",")}`;
  const hash = src.id === "os" ? extra.videoHash : "";
  return `s1:${src.id}:${id}:${video.season || 0}:${video.episode || 0}:${hash}:${langs}`;
}

async function searchSource(env, src, cfg, video, extra) {
  if (src.id === "my") return src.search(env, cfg, video, extra);       // always fresh
  const key = searchKey(src, cfg, video, extra);
  const hit = await cacheGet(env.cache, key);
  if (hit) return hit;
  const found = await src.search(env, cfg, video, extra);
  await cachePut(env.cache, key, found, SEARCH_TTL);
  return found;
}

/** Score, label and keep-or-drop for one candidate. */
export function judge(c, cfg, playing) {
  if (c.mine) return { score: 100000, official: true, label: c.release ? `My subtitle · ${c.release}` : "My subtitle" };
  let info = describe(c.release, c.file, c.other);
  let byTiming = false;
  if (c.timedAs && !info.service && info.tier < 4) {
    info = { ...info, service: c.timedAs, kind: "web", tier: 0, label: `${c.timedAs} WEB` };
    byTiming = true;
  }
  const match = c.hash ? 100 : matchScore(c.release || c.file, playing);
  let score = [300, 200, 100, 50, 0, -300][info.tier];
  if (c.hash) score += 1000;
  score += match * 4;
  if (c.retail === true) score += 250;
  if (c.retail === false) score -= 120;
  if (c.machine) score -= 400;
  score += Math.log10((c.downloads || 0) + 1) * 8 + Math.max(-10, Math.min(15, c.rating || 0));
  if (cfg.hi === "prefer" && c.hi) score += 60;
  if (cfg.hi === "avoid" && c.hi) score -= 60;
  if (c.pack) score -= 15;
  const official = !c.machine && info.tier !== 5 && (c.retail === true || (c.retail !== false && (info.tier === 0 || info.kind === "bluray")));
  const bits = [];
  if (c.retail === true) bits.push(info.service ? `${info.service} · official` : "Official");
  else if (info.label) bits.push(info.label);
  else bits.push("Unknown release");
  if (byTiming) bits.push("by timing");
  if (c.hi) bits.push("SDH");
  if (c.pack) bits.push("season pack");
  if (match >= 40) bits.push("same release");
  return { score, official, label: bits.join(" · ") };
}

function dedupeKey(c) {
  if (c.mine) return `mine|${c.ref}`;
  return `${c.lang}|${String(c.release || c.file).toLowerCase().replace(/\.(srt|ass|ssa|vtt|sub|zip)$/, "").replace(/[^a-z0-9]+/g, "")}|${c.hi ? 1 : 0}`;
}

async function listSubtitles(env, cfg, base, type, rawId, rawExtra) {
  const video = await resolve(env, type, rawId);
  if (!video) return [];
  const extra = extras(rawExtra);
  const active = SOURCES.filter((s) => s.enabled(cfg));
  const results = await Promise.allSettled(active.map((s) => searchSource(env, s, cfg, video, extra)));
  const tracks = [];
  const problems = [];
  const candidates = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") candidates.push(...r.value);
    else {
      const status = r.reason?.status;
      env.log?.(`${active[i].title}: ${r.reason?.message || r.reason}`);
      if (status === 401 || status === 403) problems.push(active[i]);
    }
  });

  await inferServices(env, BY_ID, cfg, candidates, pickFromZip);

  const playing = extra.filename;
  const judged = candidates
    .map((c) => ({ c, ...judge(c, cfg, playing) }))
    .filter((j) => !cfg.official || j.official)
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  const byLang = new Map();
  for (const j of judged) {
    if (cfg.only && !cfg.langs.includes(j.c.lang) && !j.c.mine) continue;
    const k = dedupeKey(j.c);
    if (seen.has(k)) continue;
    seen.add(k);
    const list = byLang.get(j.c.lang) || [];
    if (list.length >= cfg.per && !j.c.mine) continue;
    list.push(j);
    byLang.set(j.c.lang, list);
  }
  const order = [...cfg.langs.filter((l) => byLang.has(l))];
  if (!cfg.only) {
    order.push(...[...byLang.keys()].filter((l) => !cfg.langs.includes(l)).sort((a, b) => langName(a).localeCompare(langName(b))));
  }
  const ext = cfg.fmt === "vtt" ? "vtt" : "srt";
  const usedIds = new Set();
  for (const lang of order) {
    for (const j of byLang.get(lang)) {
      const c = j.c;
      const token = { r: c.ref, l: c.lang };
      if (video.series && video.episode) { token.e = video.episode; token.s = video.season || 0; }
      if (c.enc) token.h = c.enc;
      if (c.fps) token.f = c.fps;
      const src = BY_ID[c.src];
      // Nuvio shows a track's "id" under the language name, Stremio shows "label": both get the
      // readable description, and an invisible mark keeps ids unique when two tracks read the same.
      const label = c.mine ? j.label : `${j.label} · ${src.title}`;
      let id = label;
      while (usedIds.has(id)) id += "\u200B";              // invisible, keeps ids unique
      usedIds.add(id);
      tracks.push({
        id,
        url: `${base}/file/${c.src}/${b64url(token)}.${ext}`,
        lang: iso3(lang),
        label: `${langName(lang)} · ${label}`,
      });
    }
  }
  for (const src of problems) {
    tracks.push({
      id: `Cuetrove: ${src.title} refused your API key — open Configure`,
      url: `${base}/file/${src.id}/${b64url({ r: "key", l: cfg.langs[0] || "en" })}.${ext}`,
      lang: iso3(cfg.langs[0] || "en"),
      label: `Cuetrove: ${src.title} refused your API key — open Configure`,
    });
  }
  return tracks;
}

// ---------- files ----------

function message(textLine, fmt) {
  const cue = [{ start: 500, end: 10000, text: textLine }];
  return fmt === "vtt" ? `WEBVTT\n\n00:00:00.500 --> 00:00:10.000\n${textLine}\n` : `1\n00:00:00,500 --> 00:00:10,000\n${cue[0].text}\n`;
}

const RANK = { srt: 0, ass: 1, ssa: 1, vtt: 2, sub: 3, txt: 4, smi: 5 };

/** The subtitle inside an archive: the episode asked for, else the main .srt file. */
export async function pickFromZip(bytes, want = {}) {
  const files = entries(bytes).filter((f) => SUBTITLE_FILE.test(f.name) && !/(^|\/)(__MACOSX|\._)/.test(f.name));
  if (!files.length) throw new Error("no subtitle file in the archive");
  const ext = (n) => RANK[(/\.([a-z]+)$/i.exec(n) || [])[1]?.toLowerCase()] ?? 9;
  files.sort((a, b) => ext(a.name) - ext(b.name) || b.size - a.size);
  let pick = null;
  if (want.episode && files.length > 1) {
    pick = files.find((f) => {
      const e = episodeOf(f.name.split("/").pop());
      return e.episode === want.episode && (!e.season || !want.season || e.season === want.season);
    });
    if (!pick) throw new Error(`episode ${want.episode} is not in this archive`);
  }
  pick = pick || files[0];
  return { name: pick.name, bytes: await pick.read() };
}

async function serveFile(env, cfg, srcId, rawToken, fmt) {
  const type = fmt === "vtt" ? "text/vtt; charset=utf-8" : "application/x-subrip; charset=utf-8";
  let token;
  try { token = unb64url(rawToken); } catch { return text("not found", "text/plain", 404); }
  const src = BY_ID[srcId];
  if (token?.r === "key") {
    return text(message(`Cuetrove: ${src.title} did not accept your API key. Open the add-on's Configure page and check it.`, fmt), type);
  }
  if (!token || typeof token.r !== "string" || !src.validRef(token.r) || !src.enabled(cfg) && srcId !== "os") {
    return text("not found", "text/plain", 404);
  }
  const lang = typeof token.l === "string" ? token.l : "";
  const episode = Number.isInteger(token.e) ? token.e : 0;
  const season = Number.isInteger(token.s) ? token.s : 0;
  const key = `f1:${srcId}:${token.r}:${season}:${episode}:${lang}:${fmt}:${cfg.rtl ? 1 : 0}`;
  const hit = srcId === "my" ? null : await env.cache.get(key);
  if (hit) return text(hit, type, 200, 86400);
  let bytes;
  try {
    bytes = await src.download(env, cfg, token.r);
    if (isZip(bytes)) bytes = (await pickFromZip(bytes, { episode, season })).bytes;
  } catch (err) {
    env.log?.(`${src.title} download: ${err?.message || err}`);
    const why = err?.status === 429 ? "the site's daily limit was reached; try again later" : err?.message || "download failed";
    return text(message(`Cuetrove: ${src.title} — ${why}.`, fmt), type);
  }
  const body = convert(bytes, { lang, hint: typeof token.h === "string" ? token.h : "", format: fmt, rtl: cfg.rtl, fps: Number(token.f) || undefined });
  if (!body) return text(message(`Cuetrove: this ${src.title} file could not be read.`, fmt), type);
  if (srcId !== "my") await env.cache.put(key, body, FILE_TTL);
  return text(body, type, 200, srcId === "my" ? 0 : 86400);
}

export { encodeConfig };

// ---------- my subtitles ----------

async function mineRoute(request, env, cfg, parts) {
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
  if (!cfg.my) return reply({ error: "Turn on My subtitles in the settings first." }, 400);
  try {
    if (request.method === "GET" && parts.length === 1 && parts[0] === "mine.json") {
      return reply({ files: await mine.list(env, cfg) });
    }
    if (request.method === "POST" && parts.length === 1 && parts[0] === "mine") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 4 * 1024 * 1024) return reply({ error: "The file is too large (2 MB at most)." }, 413);
      let body;
      try { body = await request.json(); } catch { return reply({ error: "Bad request." }, 400); }
      const lang = typeof body.lang === "string" && language(body.lang) ? body.lang : null;
      if (!lang) return reply({ error: "Pick the subtitle's language." }, 400);
      if (typeof body.data !== "string" || body.data.length > 4 * 1024 * 1024) return reply({ error: "Choose a subtitle file." }, 400);
      let bytes;
      try { bytes = Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0)); } catch { return reply({ error: "Choose a subtitle file." }, 400); }
      const video = String(body.video || "");
      const ep = /:(\d+):(\d+)$/.exec(video);
      if (isZip(bytes)) {
        try {
          bytes = (await pickFromZip(bytes, ep ? { season: Number(ep[1]), episode: Number(ep[2]) } : {})).bytes;
        } catch (err) {
          return reply({ error: `Could not use this archive: ${err.message}.` }, 400);
        }
      }
      const srt = convert(bytes, { lang, format: "srt", rtl: false });
      if (!srt) return reply({ error: "This file could not be read as a subtitle." }, 400);
      const entry = await mine.add(env, cfg, { video, title: body.title, lang, label: body.label, srt });
      return reply({ ok: true, file: entry, cues: (srt.match(/ --> /g) || []).length });
    }
    if (request.method === "POST" && parts.length === 3 && parts[0] === "mine" && parts[1] === "delete") {
      return reply({ ok: await mine.remove(env, cfg, parts[2]) });
    }
  } catch (err) {
    if (err instanceof mine.MineError) return reply({ error: err.message }, err.status);
    throw err;
  }
  return reply({ error: "not found" }, 404);
}
