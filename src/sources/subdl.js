// SubDL (subdl.com): the old Subscene library and more, very rich in Arabic. Needs the user's own
// free API key (2,000 searches a day). Files come as ZIP archives.

import { toCode } from "../languages.js";
import { retailNote } from "../release.js";
import { getBytes, getJson } from "../net.js";

const API = "https://api.subdl.com/api/v1/subtitles";
const DL = "https://dl.subdl.com";

export const id = "subdl";
export const title = "SubDL";

// Our language code -> SubDL's, where it is not just the upper-case ISO 639-1 code.
const CODES = { "pt-BR": "BR_PT", "zh-TW": "ZH_BG", "es-419": "ES", tl: "TL", mni: "MNI" };

export function siteCode(code) {
  return CODES[code] || code.split("-")[0].toUpperCase();
}

export function enabled(cfg) {
  return Boolean(cfg.subdl);
}

async function query(env, cfg, video, languages) {
  const q = new URLSearchParams({ api_key: cfg.subdl, subs_per_page: "30", comment: "1", releases: "1", unpack: "1", client: "stremio" });
  if (video.imdb) q.set("imdb_id", video.imdb);
  else if (video.tmdb) q.set("tmdb_id", video.tmdb);
  else return [];
  q.set("type", video.series ? "tv" : "movie");
  if (video.series && video.season) {
    q.set("season_number", String(video.season));
    if (video.episode) q.set("episode_number", String(video.episode));
  }
  if (languages) q.set("languages", languages);
  const data = await getJson(env, `${API}?${q}`, { timeout: 9000 });
  if (data && data.status === false) {
    const err = new Error(String(data.error || "SubDL refused the request"));
    err.status = 401;
    throw err;
  }
  return data?.subtitles || [];
}

export async function search(env, cfg, video) {
  // One search for the user's own languages (so Arabic is never buried), one for everything else.
  const mine = cfg.langs.map(siteCode).filter((c, i, a) => a.indexOf(c) === i).slice(0, 10).join(",");
  const calls = [query(env, cfg, video, mine || null)];
  if (!cfg.only) calls.push(query(env, cfg, video, null));
  const settled = await Promise.allSettled(calls);
  if (settled.every((s) => s.status === "rejected")) throw settled[0].reason;
  const rows = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const out = [];
  const seen = new Set();
  for (const s of rows) {
    const lang = toCode(s.language) || toCode(s.lang);
    if (!lang || !s.url) continue;
    let ref = String(s.url);
    let release = String(s.release_name || s.name || "");
    let pack = Boolean(s.full_season);
    if (video.series && video.episode && Array.isArray(s.unpack_files) && s.unpack_files.length) {
      const file = s.unpack_files.find((f) => Number(f.episode) === video.episode && (!f.season || Number(f.season) === video.season));
      if (file?.url) {
        ref = String(file.url);
        release = String(file.release_name || file.name || release);
        pack = false;
      }
    }
    if (video.series && video.episode && !pack && s.episode && Number(s.episode) !== video.episode
        && !(s.episode_from && s.episode_end && video.episode >= s.episode_from && video.episode <= s.episode_end)) continue;
    if (!validRef(ref) || seen.has(ref)) continue;
    seen.add(ref);
    const releases = Array.isArray(s.releases) ? s.releases.map((r) => (typeof r === "string" ? r : r?.release_name || "")).filter(Boolean) : [];
    out.push({
      src: id,
      ref,
      lang,
      release,
      file: String(s.name || ""),
      other: releases.slice(0, 5).join(" "),
      hi: Boolean(s.hi),
      enc: "",
      fps: s.fps ? Number(s.fps) : null,
      hash: false,
      downloads: 0,
      retail: retailNote(s.comment),
      pack,
      author: String(s.author || ""),
    });
  }
  return out;
}

export function validRef(ref) {
  return /^\/subtitle\/[A-Za-z0-9_-]+(?:\.zip|\/[A-Za-z0-9_-]+)$/.test(ref);
}

export async function download(env, cfg, ref) {
  return getBytes(env, DL + ref);
}
