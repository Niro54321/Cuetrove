// SubSource (subsource.net): the other home of the Subscene library, with a "retail" mark for
// subtitles taken from the service or disc itself. Needs the user's own free API key
// (60 requests a minute, 7,200 a day). Files come as ZIP archives.

import { language, toCode } from "../languages.js";
import { episodeOf, retailNote } from "../release.js";
import { getBytes, getJson } from "../net.js";
import { getJson as cacheGet, putJson as cachePut } from "../cache.js";

const API = "https://api.subsource.net/api/v1";

export const id = "ss";
export const title = "SubSource";

// Our language code -> the name SubSource filters by.
const NAMES = { "pt-BR": "brazillian_portuguese", fa: "farsi_persian", "zh-TW": "big_5_code", zh: "chinese_bg_code", "es-419": "spanish" };

export function enabled(cfg) {
  return Boolean(cfg.ss);
}

function headers(cfg) {
  return { "X-API-Key": cfg.ss, Accept: "application/json" };
}

async function movieIds(env, cfg, video) {
  const key = `ss:movies:${video.imdb}:${video.season || 0}`;
  const hit = await cacheGet(env.cache, key);
  if (hit) return hit;
  const q = new URLSearchParams({ searchType: "imdb", imdb: video.imdb });
  if (video.series && video.season) q.set("season", String(video.season));
  const data = await getJson(env, `${API}/movies/search?${q}`, { headers: headers(cfg), timeout: 8000 });
  let rows = data?.data || [];
  if (video.series && video.season) rows = rows.filter((r) => !r.season || Number(r.season) === video.season);
  const ids = rows.map((r) => r.movieId).filter((n) => Number.isInteger(n)).slice(0, 3);
  await cachePut(env.cache, key, ids, 86400);
  return ids;
}

async function list(env, cfg, movieId, language) {
  const q = new URLSearchParams({ movieId: String(movieId), limit: "100", sort: "popular" });
  if (language) q.set("language", language);
  const data = await getJson(env, `${API}/subtitles?${q}`, { headers: headers(cfg), timeout: 9000 });
  return data?.data || [];
}

export async function search(env, cfg, video) {
  if (!video.imdb) return [];
  const ids = await movieIds(env, cfg, video);
  if (!ids.length) return [];
  const first = cfg.langs[0];
  const calls = [];
  for (const mid of ids) {
    if (cfg.only) for (const l of cfg.langs.slice(0, 4)) calls.push(list(env, cfg, mid, NAMES[l] || langWord(l)));
    else {
      calls.push(list(env, cfg, mid, null));
      if (first) calls.push(list(env, cfg, mid, NAMES[first] || langWord(first)));
    }
  }
  const settled = await Promise.allSettled(calls);
  if (settled.every((s) => s.status === "rejected")) throw settled[0].reason;
  const out = [];
  const seen = new Set();
  for (const s of settled.flatMap((x) => (x.status === "fulfilled" ? x.value : []))) {
    const lang = toCode(String(s.language || "").replace(/_/g, " "));
    const ref = String(s.subtitleId || "");
    if (!lang || !validRef(ref) || seen.has(ref)) continue;
    const releases = (Array.isArray(s.releaseInfo) ? s.releaseInfo : [s.releaseInfo]).filter(Boolean).map(String);
    let pack = false;
    if (video.series && video.episode) {
      const eps = releases.map(episodeOf).filter((e) => e.episode !== null);
      if (eps.length && !eps.some((e) => e.episode === video.episode && (!e.season || e.season === video.season))) continue;
      if (!eps.length) pack = true;     // no episode written: a season pack, or unclear
    }
    seen.add(ref);
    const production = String(s.productionType || "").toLowerCase();
    let retail = production === "retail" ? true : production === "translated" || production === "machine" ? false : null;
    if (retail === null) retail = retailNote(s.commentary);
    out.push({
      src: id,
      ref,
      lang,
      release: releases[0] || "",
      file: "",
      other: [releases.slice(1, 5).join(" "), String(s.releaseType || "")].join(" ").trim(),
      hi: Boolean(s.hearingImpaired),
      enc: "",
      fps: s.framerate ? Number(s.framerate) || null : null,
      hash: false,
      downloads: Number(s.downloads) || 0,
      rating: s.rating?.total ? (s.rating.good || 0) - (s.rating.bad || 0) : 0,
      retail,
      machine: production === "machine",
      pack,
    });
  }
  return out;
}

function langWord(code) {
  const l = language(code);
  return l ? l.name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "") : null;
}

export function validRef(ref) {
  return /^\d{1,12}$/.test(ref);
}

export async function download(env, cfg, ref) {
  return getBytes(env, `${API}/subtitles/${ref}/download`, { headers: { "X-API-Key": cfg.ss } });
}
