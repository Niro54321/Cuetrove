// Telling which service an untagged subtitle came from by its timing.
//
// A streaming service times every language of a title the same way: Prime Video's Arabic and
// English subtitles start on the same milliseconds. So a file called "Movie.2025.WEB.h264-GRP"
// whose cues start where the cues of "Movie.2025.AMZN.WEB-DL" (any language) start is Prime
// Video's own subtitle, even though its name does not say so.

import { getJson as cacheGet, putJson as cachePut } from "./cache.js";
import { describe } from "./release.js";
import { decode } from "./subtitle.js";
import { isZip } from "./zip.js";

const STAMP = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->/g;
const MAX_CUES = 200;
const MATCH = 0.85;
const MIN_CUES = 40;

/** The first cue start times (ms) of a subtitle file. Fast: only the "-->" lines are read. */
export function starts(text) {
  const out = [];
  STAMP.lastIndex = 0;
  let m;
  while ((m = STAMP.exec(text)) && out.length < MAX_CUES * 2) {
    out.push(((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]));
  }
  return [...new Set(out)].sort((a, b) => a - b).slice(0, MAX_CUES);
}

/** Share of a's cue starts that b also has, within 50 ms. */
export function overlap(a, b) {
  if (a.length < MIN_CUES || b.length < MIN_CUES) return 0;
  const last = Math.min(a[a.length - 1], b[b.length - 1]);
  let hit = 0, n = 0, j = 0;
  for (const t of a) {
    if (t > last) break;
    n++;
    while (j < b.length && b[j] < t - 50) j++;
    if (j < b.length && Math.abs(b[j] - t) <= 50) hit++;
  }
  return n >= MIN_CUES ? hit / n : 0;
}

async function print(env, src, cfg, c, pick) {
  const key = `fp1:${c.src}:${c.ref}`;
  const hit = await cacheGet(env.cache, key);
  if (hit) return hit;
  let bytes = await src.download(env, cfg, c.ref);
  if (isZip(bytes)) bytes = (await pick(bytes, {})).bytes;
  const text = decode(bytes.subarray(0, 60000), { lang: c.lang, hint: c.enc });
  const fp = starts(text || "");
  await cachePut(env.cache, key, fp, 30 * 86400);
  return fp;
}

/**
 * Marks candidates of the user's languages that name no service with `timedAs` when their timing
 * matches a file that does (season packs are skipped).
 * Gives up quietly after `budget` ms.
 */
export async function inferServices(env, sources, cfg, candidates, pick, { budget = 3500 } = {}) {
  const known = [];
  const unknown = [];
  for (const c of candidates) {
    if (c.pack || c.machine || c.mine) continue;
    const d = describe(c.release, c.file, c.other);
    if (d.service && d.kind === "web") known.push({ c, service: d.service });
    else if (!d.service && d.tier !== 4 && d.tier !== 5 && cfg.langs.slice(0, 2).includes(c.lang) && c.retail !== false) unknown.push(c);
  }
  if (!known.length || !unknown.length) return;
  // References: a few files per service, English first (the most uploaded), free sources first.
  // Dubbed-audio and forced-only files are timed differently or hold few lines: last.
  const odd = (x) => (/\b(dubbed|forced)\b|forced\./i.test(`${x.c.release} ${x.c.file}`) ? 4 : 0);
  const order = (x) => odd(x) + (x.c.lang === "en" ? 0 : 1) + (x.c.src === "os" ? 0 : 2);
  const refs = [];
  const perService = new Map();
  for (const k of known.sort((a, b) => order(a) - order(b))) {
    const n = perService.get(k.service) || 0;
    if (n >= 3 || refs.length >= 6) continue;
    perService.set(k.service, n + 1);
    refs.push(k);
  }
  // The user's first language first; one file per release name.
  const rank = (c) => cfg.langs.indexOf(c.lang) * 10 + (c.src === "os" ? 0 : 1);
  const seenRelease = new Set();
  const todo = unknown.sort((a, b) => rank(a) - rank(b)).filter((c) => {
    const k = `${c.lang}|${c.release}`;
    if (seenRelease.has(k)) return false;
    seenRelease.add(k);
    return true;
  }).slice(0, 4);
  const work = (async () => {
    const fps = await Promise.all([...refs.map((r) => r.c), ...todo].map((c) =>
      print(env, sources[c.src], cfg, c, pick).catch((e) => { env.log?.(`timing: ${e?.message || e}`); return []; })));
    const refPrints = fps.slice(0, refs.length);
    todo.forEach((c, i) => {
      const mine = fps[refs.length + i];
      // Studios hand the same subtitle to several stores (Prime Video, Movies Anywhere, iTunes):
      // every store that matches is named, best first.
      const score = new Map();
      refPrints.forEach((rp, r) => {
        const s = overlap(mine, rp);
        if (s > (score.get(refs[r].service) || 0)) score.set(refs[r].service, s);
      });
      const hits = [...score].filter(([, s]) => s >= MATCH).sort((a, b) => b[1] - a[1]).map(([name]) => name);
      if (hits.length) c.timedAs = hits.slice(0, 2).join(" / ");
    });
  })();
  let timer;
  await Promise.race([work, new Promise((r) => { timer = setTimeout(r, budget); })]);
  clearTimeout(timer);
}
