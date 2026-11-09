import test from "node:test";
import assert from "node:assert/strict";
import { inferServices, overlap, starts } from "../src/fingerprint.js";
import { MemoryCache } from "../src/cache.js";
import { DEFAULTS } from "../src/config.js";

function srt(times, text = "x") {
  return times.map((t, i) => {
    const s = (ms) => new Date(ms).toISOString().slice(11, 23).replace(".", ",");
    return `${i + 1}\n${s(t)} --> ${s(t + 1500)}\n${text}\n`;
  }).join("\n");
}

const AMZN = Array.from({ length: 120 }, (_, i) => 5000 + i * 2711);
const OTHER = Array.from({ length: 120 }, (_, i) => 5300 + i * 2650);

test("starts() reads cue times, overlap() compares them", () => {
  assert.deepEqual(starts(srt([1000, 2500])), [1000, 2500]);
  assert.equal(overlap(AMZN, AMZN.map((t) => t + 20)), 1);
  assert.ok(overlap(AMZN, OTHER) < 0.2);
  assert.equal(overlap(AMZN.slice(0, 10), AMZN), 0);              // too short to tell
});

test("an untagged Arabic file timed like the Prime Video release is named Prime Video", async () => {
  const files = { 1: srt(AMZN, "Hello"), 2: srt(AMZN.map((t) => t + 10), "مرحبا"), 3: srt(OTHER, "مرحبا") };
  const source = { download: async (_e, _c, ref) => new TextEncoder().encode(files[ref]) };
  const candidates = [
    { src: "os", ref: "1", lang: "en", release: "Movie.2025.1080p.AMZN.WEB-DL.DDP5.1-GRP", file: "", other: "" },
    { src: "os", ref: "2", lang: "ar", release: "Movie.2025.1080p.WEB.h264-ETHEL", file: "", other: "" },
    { src: "os", ref: "3", lang: "ar", release: "Movie 2025", file: "", other: "" },
  ];
  await inferServices({ cache: new MemoryCache() }, { os: source }, DEFAULTS, candidates, null);
  assert.equal(candidates[1].timedAs, "Prime Video");
  assert.equal(candidates[2].timedAs, undefined);
});
