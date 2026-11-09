// Stremio/Nuvio video ids -> what subtitle sites search by.
//   tt0903747            a movie (IMDb)
//   tt0903747:1:2        series, season 1 episode 2
//   kitsu:7442:5         anime from the Kitsu add-on, episode 5 (mapped to IMDb season/episode)
//   tmdb:1396:1:2        TMDB ids (some Nuvio catalogs)

import { getJson as cacheGet, putJson as cachePut } from "./cache.js";
import { getJson } from "./net.js";

const KITSU = "https://anime-kitsu.strem.fun";

/** {imdb, tmdb, season, episode, series} or null when the id is not one we can look up. */
export async function resolve(env, type, id) {
  let m = /^(tt\d{5,10})(?::(\d{1,4}):(\d{1,5}))?$/.exec(id);
  if (m) {
    const series = Boolean(m[2]) || type === "series";
    return { imdb: m[1], tmdb: null, season: m[2] ? Number(m[2]) : null, episode: m[3] ? Number(m[3]) : null, series };
  }
  m = /^tmdb:(\d{1,9})(?::(\d{1,4}):(\d{1,5}))?$/.exec(id);
  if (m) {
    return { imdb: null, tmdb: m[1], season: m[2] ? Number(m[2]) : null, episode: m[3] ? Number(m[3]) : null, series: Boolean(m[2]) || type === "series" };
  }
  m = /^kitsu:(\d{1,9})(?::(\d{1,5}))?$/.exec(id);
  if (m) return kitsu(env, m[1], m[2] ? Number(m[2]) : null, id);
  return null;
}

async function kitsu(env, kid, episode, fullId) {
  const key = `kitsu:${kid}`;
  let meta = await cacheGet(env.cache, key);
  if (!meta) {
    for (const kind of episode ? ["series", "movie"] : ["movie", "series"]) {
      try {
        const data = await getJson(env, `${KITSU}/meta/${kind}/kitsu:${kid}.json`, { timeout: 7000 });
        if (data?.meta) {
          meta = {
            imdb: data.meta.imdb_id || null,
            videos: (data.meta.videos || []).map((v) => [v.id, v.imdbSeason || null, v.imdbEpisode || null]),
          };
          break;
        }
      } catch {
        // try the other kind
      }
    }
    if (!meta) return null;
    await cachePut(env.cache, key, meta, 7 * 86400);
  }
  if (!meta.imdb || !/^tt\d+$/.test(meta.imdb)) return null;
  if (!episode) return { imdb: meta.imdb, tmdb: null, season: null, episode: null, series: false };
  const row = meta.videos.find((v) => v[0] === fullId);
  if (row && row[1] && row[2]) return { imdb: meta.imdb, tmdb: null, season: row[1], episode: row[2], series: true };
  return { imdb: meta.imdb, tmdb: null, season: 1, episode, series: true };
}

/** The extra part Stremio sends: videoHash=...&videoSize=...&filename=... */
export function extras(segment) {
  const out = { videoHash: "", videoSize: "", filename: "" };
  if (!segment) return out;
  for (const part of segment.split("&")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i);
    let v = part.slice(i + 1);
    try { v = decodeURIComponent(v.replace(/\+/g, " ")); } catch { /* keep raw */ }
    if (k === "videoHash" && /^[0-9a-f]{16}$/i.test(v)) out.videoHash = v.toLowerCase();
    if (k === "videoSize" && /^\d{1,15}$/.test(v)) out.videoSize = v;
    if (k === "filename") out.filename = v.slice(0, 300);
  }
  return out;
}
