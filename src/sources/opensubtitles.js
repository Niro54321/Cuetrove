// OpenSubtitles, through Stremio's public OpenSubtitles add-on (no key, no daily download quota).
// Its answers carry the release name, so official releases can be told apart.

import { toCode } from "../languages.js";
import { getBytes, getJson } from "../net.js";

const BASE = "https://opensubtitles-v3.strem.io";
const FILE = "https://subs5.strem.io/en/download/src-api/file/";

export const id = "os";
export const title = "OpenSubtitles";

export function enabled(cfg) {
  return cfg.os;
}

export async function search(env, cfg, video, extra) {
  if (!video.imdb) return [];
  const vid = video.series && video.season ? `${video.imdb}:${video.season}:${video.episode}` : video.imdb;
  const type = video.series ? "series" : "movie";
  const parts = [];
  if (extra.videoHash) parts.push(`videoHash=${extra.videoHash}`);
  if (extra.videoSize) parts.push(`videoSize=${extra.videoSize}`);
  if (extra.filename) parts.push(`filename=${encodeURIComponent(extra.filename)}`);
  const url = `${BASE}/subtitles/${type}/${encodeURIComponent(vid).replace(/%3A/g, ":")}${parts.length ? "/" + parts.join("&") : ""}.json`;
  const data = await getJson(env, url, { timeout: 9000 });
  const out = [];
  for (const s of data?.subtitles || []) {
    const ref = (/\/file\/(\d{1,15})$/.exec(String(s.url || "")) || [])[1];
    const lang = toCode(s.lang);
    if (!ref || !lang) continue;
    const file = String(s.subtitleFileName || "");
    out.push({
      src: id,
      ref,
      lang,
      release: String(s.movieReleaseName || file || ""),
      file,
      other: String(s.releaseOther || ""),
      hi: /(\bSDH\b|\bHI\b|hearing|\bCC\b)/i.test(file),
      enc: String(s.SubEncoding || ""),
      fps: s.fpsMilli ? Number(s.fpsMilli) / 1000 : null,
      hash: s.m === "h",
      downloads: 0,
      retail: null,
      pack: false,
    });
  }
  return out;
}

export function validRef(ref) {
  return /^\d{1,15}$/.test(ref);
}

export async function download(env, cfg, ref) {
  return getBytes(env, FILE + ref);
}
