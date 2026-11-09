// "My subtitles": files the user uploads from the settings page, kept in their own Cloudflare KV
// (or a folder on their PC) under a private id that only their install link carries.
//
// Keys in the store:
//   owner                 the private id allowed to upload (the first one to upload claims it)
//   i:{vault}             index: [{f, v, t, l, n, a}] = file id, video key, title, language, name, added
//   v:{vault}:{video}     file ids for one movie or episode ("tt0903747" or "tt0903747:1:2")
//   f:{vault}:{file}      the subtitle, already converted to clean UTF-8 SRT

export const id = "my";
export const title = "My subtitles";

const MAX_FILES = 2000;
const MAX_BYTES = 2 * 1024 * 1024;

export function enabled(cfg) {
  return Boolean(cfg.my);
}

export function validRef(ref) {
  return /^[A-Za-z0-9]{8,32}$/.test(ref);
}

export function videoKey(video) {
  if (!video?.imdb) return null;
  return video.series && video.season && video.episode ? `${video.imdb}:${video.season}:${video.episode}` : video.imdb;
}

async function readJson(store, key, fallback) {
  const text = await store.get(key);
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

export async function search(env, cfg, video) {
  if (!env.store) return [];
  const key = videoKey(video);
  if (!key) return [];
  const files = await readJson(env.store, `v:${cfg.my}:${key}`, []);
  return files.map((f) => ({
    src: id, ref: f.f, lang: f.l, release: f.n || "", file: "", other: "", hi: false, enc: "utf-8",
    fps: null, hash: false, downloads: 0, retail: null, pack: false, mine: true,
  }));
}

export async function download(env, cfg, ref) {
  const text = env.store ? await env.store.get(`f:${cfg.my}:${ref}`) : null;
  if (!text) {
    const err = new Error("this file was deleted");
    err.status = 404;
    throw err;
  }
  return new TextEncoder().encode(text);
}

export class MineError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function randomId(n = 16) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}

async function claim(env, vault) {
  if (env.multiUser) return;
  const owner = await env.store.get("owner");
  if (!owner) await env.store.put("owner", vault);
  else if (owner !== vault) {
    throw new MineError(403, "This Cuetrove already keeps someone else's subtitles. Deploy your own copy to upload yours.");
  }
}

export async function list(env, cfg) {
  if (!env.store) throw new MineError(501, "This Cuetrove has no storage for your own subtitles.");
  return readJson(env.store, `i:${cfg.my}`, []);
}

/** Saves an already converted SRT for one video. Returns the new index entry. */
export async function add(env, cfg, { video, title: name, lang, label, srt }) {
  if (!env.store) throw new MineError(501, "This Cuetrove has no storage for your own subtitles.");
  if (!/^tt\d{5,10}(?::\d{1,4}:\d{1,5})?$/.test(video)) throw new MineError(400, "Pick a movie or an episode first.");
  if (srt.length > MAX_BYTES) throw new MineError(413, "The subtitle is too large (2 MB at most).");
  await claim(env, cfg.my);
  const index = await readJson(env.store, `i:${cfg.my}`, []);
  if (index.length >= MAX_FILES) throw new MineError(507, "You have reached 2,000 subtitles. Delete some first.");
  const file = randomId();
  const entry = { f: file, v: video, t: String(name || "").slice(0, 120), l: lang, n: String(label || "").slice(0, 80), a: Date.now() };
  await env.store.put(`f:${cfg.my}:${file}`, srt);
  const forVideo = await readJson(env.store, `v:${cfg.my}:${video}`, []);
  forVideo.unshift({ f: file, l: lang, n: entry.n });
  await env.store.put(`v:${cfg.my}:${video}`, JSON.stringify(forVideo));
  index.unshift(entry);
  await env.store.put(`i:${cfg.my}`, JSON.stringify(index));
  return entry;
}

export async function remove(env, cfg, file) {
  if (!env.store) throw new MineError(501, "This Cuetrove has no storage for your own subtitles.");
  if (!validRef(file)) throw new MineError(400, "Unknown file.");
  const index = await readJson(env.store, `i:${cfg.my}`, []);
  const entry = index.find((e) => e.f === file);
  if (!entry) return false;
  const forVideo = (await readJson(env.store, `v:${cfg.my}:${entry.v}`, [])).filter((e) => e.f !== file);
  if (forVideo.length) await env.store.put(`v:${cfg.my}:${entry.v}`, JSON.stringify(forVideo));
  else await env.store.delete(`v:${cfg.my}:${entry.v}`);
  await env.store.delete(`f:${cfg.my}:${file}`);
  await env.store.put(`i:${cfg.my}`, JSON.stringify(index.filter((e) => e.f !== file)));
  return true;
}
