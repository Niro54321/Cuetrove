import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/addon.js";
import { MemoryCache } from "../src/cache.js";
import { encode } from "../src/config.js";
import { CODEPAGES } from "../src/codepages.js";

class MapStore {
  constructor() { this.map = new Map(); }
  async get(k) { return this.map.has(k) ? this.map.get(k) : null; }
  async put(k, v) { this.map.set(k, v); }
  async delete(k) { this.map.delete(k); }
}

const VAULT = "A".repeat(16) + "b".repeat(16);
const ARABIC = "1\n00:00:01,000 --> 00:00:03,000\nمرحباً بكم في المدرسة، هذا هو اليوم الأول.\n\n2\n00:00:04,000 --> 00:00:06,000\nهل أنت مستعد للدرس؟ نعم أنا مستعد تماماً.\n";

function cp1256(text) {
  const map = new Map([...CODEPAGES["windows-1256"]].map((ch, i) => [ch, 0x80 + i]));
  return Uint8Array.from([...text].map((ch) => (ch.charCodeAt(0) < 0x80 ? ch.charCodeAt(0) : map.get(ch))));
}

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

function env(extra = {}) {
  return { cache: new MemoryCache(), store: new MapStore(), fetch: async () => new Response("{}", { status: 404 }), ...extra };
}

const post = (e, path, body) => handle(new Request("https://c.example" + path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), e);
const get = (e, path) => handle(new Request("https://c.example" + path), e);

test("upload a cp1256 Arabic file, see it first in the list, open it, delete it", async () => {
  const e = env();
  const seg = encode({ my: VAULT, os: false });
  let res = await post(e, `/${seg}/mine`, { video: "tt13443470:1:1", title: "Wednesday · S1E1", lang: "ar", label: "Netflix", data: b64(cp1256(ARABIC)) });
  let out = await res.json();
  assert.equal(res.status, 200, JSON.stringify(out));
  assert.equal(out.cues, 2);

  out = await (await get(e, `/${seg}/mine.json`)).json();
  assert.equal(out.files.length, 1);
  assert.equal(out.files[0].t, "Wednesday · S1E1");

  const { subtitles } = await (await get(e, `/${seg}/subtitles/series/tt13443470:1:1.json`)).json();
  assert.equal(subtitles.length, 1);
  assert.equal(subtitles[0].lang, "ara");
  assert.equal(subtitles[0].id, "My subtitle · Netflix");
  const body = await (await handle(new Request(subtitles[0].url), e)).text();
  assert.ok(body.includes("‏مرحباً بكم في المدرسة"), body);

  // nothing for another episode
  const other = await (await get(e, `/${seg}/subtitles/series/tt13443470:1:2.json`)).json();
  assert.equal(other.subtitles.length, 0);

  res = await post(e, `/${seg}/mine/delete/${out.files[0].f}`, {});
  assert.equal((await res.json()).ok, true);
  assert.equal((await (await get(e, `/${seg}/mine.json`)).json()).files.length, 0);
  assert.equal((await (await get(e, `/${seg}/subtitles/series/tt13443470:1:1.json`)).json()).subtitles.length, 0);
});

test("a season pack zip gives the episode chosen", async () => {
  const { makeZip } = await import("./zip.test.js");
  const e = env();
  const seg = encode({ my: VAULT, os: false });
  const zip = makeZip([
    { name: "Show.S01E01.srt", data: "1\n00:00:01,000 --> 00:00:02,000\nOne\n" },
    { name: "Show.S01E02.srt", data: "1\n00:00:01,000 --> 00:00:02,000\nTwo\n" },
  ]);
  const res = await post(e, `/${seg}/mine`, { video: "tt0000001:1:2", title: "Show", lang: "en", data: b64(zip) });
  assert.equal(res.status, 200);
  const { subtitles } = await (await get(e, `/${seg}/subtitles/series/tt0000001:1:2.json`)).json();
  const body = await (await handle(new Request(subtitles[0].url), e)).text();
  assert.match(body, /Two/);
});

test("bad uploads are refused; a second person cannot use someone else's Worker", async () => {
  const e = env();
  const seg = encode({ my: VAULT, os: false });
  assert.equal((await post(e, `/${seg}/mine`, { video: "nope", lang: "ar", data: b64(cp1256(ARABIC)) })).status, 400);
  assert.equal((await post(e, `/${seg}/mine`, { video: "tt1234567", lang: "xx", data: b64(cp1256(ARABIC)) })).status, 400);
  assert.equal((await post(e, `/${seg}/mine`, { video: "tt1234567", lang: "en", data: b64(new TextEncoder().encode("hello")) })).status, 400);
  assert.equal((await post(e, `/mine`, { video: "tt1234567", lang: "en", data: "" })).status, 400);   // not turned on
  assert.equal((await post(e, `/${seg}/mine`, { video: "tt1234567", lang: "ar", data: b64(cp1256(ARABIC)) })).status, 200);
  const intruder = encode({ my: "Z".repeat(32) });
  const res = await post(e, `/${intruder}/mine`, { video: "tt1234567", lang: "ar", data: b64(cp1256(ARABIC)) });
  assert.equal(res.status, 403);
  // and cannot read the owner's list with their own id
  assert.equal((await (await get(e, `/${intruder}/mine.json`)).json()).files.length, 0);
});
