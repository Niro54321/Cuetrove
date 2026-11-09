import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/addon.js";
import { MemoryCache } from "../src/cache.js";
import { DEFAULTS, decode, encode, normalize } from "../src/config.js";
import { makeZip } from "./zip.test.js";

const SRT_AR = "1\n00:00:01,000 --> 00:00:02,000\nمرحبا.\n";
const SRT_EN = "1\n00:00:01,000 --> 00:00:02,000\nHello.\n";

/** A fake internet: the three subtitle sites and Kitsu. */
function fakeFetch(calls) {
  return async (url, opts = {}) => {
    const u = new URL(url);
    calls.push({ url: String(url), headers: opts.headers || {} });
    const json = (d) => new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json" } });
    if (u.hostname === "opensubtitles-v3.strem.io") {
      return json({ subtitles: [
        { id: "1", url: "https://subs5.strem.io/en/download/subencoding-stremio-utf8/src-api/file/111", lang: "ara", movieReleaseName: "Show.S01E02.1080p.NF.WEB-DL.DDP5.1-NTb", SubEncoding: "UTF-8", m: "i" },
        { id: "2", url: "https://subs5.strem.io/en/download/subencoding-stremio-utf8/src-api/file/222", lang: "eng", movieReleaseName: "Show.S01E02.720p.HDTV.x264-ABC", m: "i" },
        { id: "3", url: "https://subs5.strem.io/en/download/subencoding-stremio-utf8/src-api/file/333", lang: "eng", movieReleaseName: "Show.S01E02.HDCAM", m: "i" },
        { id: "4", url: "https://subs5.strem.io/en/download/subencoding-stremio-utf8/src-api/file/444", lang: "fre", movieReleaseName: "Show.S01E02.1080p.NF.WEB-DL-NTb", m: "i" },
      ] });
    }
    if (u.hostname === "subs5.strem.io") {
      return new Response(u.pathname.endsWith("/111") ? SRT_AR : SRT_EN);
    }
    if (u.hostname === "api.subdl.com") {
      if (u.searchParams.get("api_key") !== "goodkey") return json({ status: false, error: "Invalid API key" });
      return json({ status: true, subtitles: [
        { release_name: "Show.S01E02.1080p.DSNP.WEB-DL-GRP", name: "x.zip", lang: "arabic", language: "AR", url: "/subtitle/555-666.zip", season: 1, episode: 2, hi: false, comment: "ترجمة ديزني الرسمية" },
        { release_name: "Show.S01.Season.Pack", name: "p.zip", lang: "english", language: "EN", url: "/subtitle/777-888.zip", full_season: true, season: 1, episode: 0,
          unpack_files: [{ episode: 2, season: 1, release_name: "Show.S01E02.AMZN.WEB-DL", url: "/subtitle/777-888/f2" }] },
      ] });
    }
    if (u.hostname === "dl.subdl.com") {
      if (u.pathname.endsWith(".zip")) return new Response(makeZip([{ name: "Show.S01E02.srt", data: SRT_AR }]));
      return new Response(SRT_EN);
    }
    return new Response("not found", { status: 404 });
  };
}

function env() {
  const calls = [];
  return { calls, cache: new MemoryCache(), fetch: fakeFetch(calls) };
}

const get = (e, path) => handle(new Request("https://cuetrove.example" + path), e);

test("config round trip keeps only changes, rejects junk", () => {
  assert.equal(encode(DEFAULTS), "");
  const seg = encode({ ...DEFAULTS, langs: ["fr", "ar"], subdl: "abc123", per: 99 });
  const back = decode(seg);
  assert.deepEqual(back.langs, ["fr", "ar"]);
  assert.equal(back.subdl, "abc123");
  assert.equal(back.per, 10);
  assert.equal(decode("manifest.json"), null);
  assert.equal(decode("configure"), null);
  assert.deepEqual(normalize({ langs: ["xx", "ar", "ar"], hi: "nope", subdl: "bad key with spaces" }).langs, ["ar"]);
  assert.equal(normalize({ subdl: "<script>" }).subdl, "");
});

test("manifest and configure page work with and without a config", async () => {
  const e = env();
  const m = await (await get(e, "/manifest.json")).json();
  assert.equal(m.id, "io.github.niro54321.cuetrove");
  assert.deepEqual(m.resources, ["subtitles"]);
  assert.ok(m.behaviorHints.configurable);
  const seg = encode({ langs: ["fr"], subdl: "goodkey" });
  const m2 = await (await get(e, `/${seg}/manifest.json`)).json();
  assert.match(m2.description, /French/);
  assert.ok(m2.idPrefixes.includes("tmdb"));
  const page = await (await get(e, `/${seg}/configure`)).text();
  assert.match(page, /Cuetrove/);
  assert.ok(!page.includes("</script><script>"));
  const root = await get(e, "/");
  assert.equal(root.status, 302);
});

test("official-only list: Arabic first, cams and TV rips hidden, services labelled", async () => {
  const e = env();
  const seg = encode({ langs: ["ar", "en"], subdl: "goodkey" });
  const res = await get(e, `/${seg}/subtitles/series/tt1234567:1:2/filename=Show.S01E02.1080p.NF.WEB-DL.DDP5.1-NTb.mkv.json`);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const { subtitles } = await res.json();
  const labels = subtitles.map((s) => `${s.lang} ${s.label}`);
  assert.equal(subtitles[0].lang, "ara");
  assert.ok(labels.some((l) => l.includes("Disney+ · official · SubDL")), labels.join("\n"));
  assert.ok(labels.some((l) => l.includes("Netflix WEB · same release · OpenSubtitles")), labels.join("\n"));
  assert.ok(labels.some((l) => l.startsWith("eng") && l.includes("Prime Video WEB")), labels.join("\n"));
  assert.ok(!labels.some((l) => /HDTV|Cam|TV ·/.test(l)), labels.join("\n"));
  assert.equal(subtitles[subtitles.length - 1].lang, "fre");          // other languages after mine
  // the Netflix release that matches the playing file is the first Arabic track
  assert.match(subtitles[0].label, /same release/);
  // keys never appear in labels or ids
  assert.ok(!JSON.stringify(subtitles.map((s) => [s.id, s.label])).includes("goodkey"));
});

test("files: zipped SubDL, raw season-pack file, and OpenSubtitles come back as clean SRT", async () => {
  const e = env();
  const seg = encode({ langs: ["ar", "en"], subdl: "goodkey" });
  const { subtitles } = await (await get(e, `/${seg}/subtitles/series/tt1234567:1:2.json`)).json();
  for (const s of subtitles) {
    const r = await handle(new Request(s.url), e);
    const body = await r.text();
    assert.equal(r.headers.get("content-type"), "application/x-subrip; charset=utf-8");
    assert.match(body, /^1\n00:00:01,000 --> 00:00:02,000\n/, s.label);
    if (s.lang === "ara") assert.ok(body.includes("‏مرحبا.‏"), body);
  }
  const subdlDownload = e.calls.find((x) => x.url.startsWith("https://dl.subdl.com/subtitle/555-666.zip"));
  assert.ok(subdlDownload);
  // cached: a second request does not download again
  const before = e.calls.length;
  await (await handle(new Request(subtitles[0].url), e)).text();
  assert.equal(e.calls.length, before);
});

test("a refused key shows a hint track instead of failing", async () => {
  const e = env();
  const seg = encode({ langs: ["ar"], subdl: "badkey", os: false });
  const { subtitles } = await (await get(e, `/${seg}/subtitles/movie/tt7654321.json`)).json();
  assert.equal(subtitles.length, 1);
  assert.match(subtitles[0].label, /SubDL refused your API key/);
  const body = await (await handle(new Request(subtitles[0].url), e)).text();
  assert.match(body, /did not accept your API key/);
});

test("forged file tokens and unknown routes are refused", async () => {
  const e = env();
  const bad = btoa(JSON.stringify({ r: "https://evil.example/x", l: "en" })).replace(/=+$/, "");
  assert.equal((await get(e, `/file/os/${bad}.srt`)).status, 404);
  const bad2 = btoa(JSON.stringify({ r: "/subtitle/../../etc", l: "en" })).replace(/=+$/, "");
  const seg = encode({ subdl: "goodkey" });
  assert.equal((await get(e, `/${seg}/file/subdl/${bad2}.srt`)).status, 404);
  assert.equal((await get(e, "/file/nope/abc.srt")).status, 404);
  assert.equal((await get(e, "/etc/passwd")).status, 404);
  assert.ok(!e.calls.some((x) => x.url.includes("evil.example")));
});
