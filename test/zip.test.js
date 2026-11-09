import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { entries, isZip } from "../src/zip.js";
import { pickFromZip } from "../src/addon.js";

/** A minimal ZIP writer for tests: [{name, data, store?}] -> bytes */
export function makeZip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const raw = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const body = f.store ? raw : new Uint8Array(deflateRawSync(raw));
    const method = f.store ? 0 : 8;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(6, 0x800, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, body);
    centrals.push(central);
    offset += local.length + body.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const SRT = (t) => `1\n00:00:01,000 --> 00:00:02,000\n${t}\n`;

test("stored and deflated entries are read", async () => {
  const zip = makeZip([{ name: "a.srt", data: SRT("one"), store: true }, { name: "b/ب.srt", data: SRT("two") }]);
  assert.ok(isZip(zip));
  const list = entries(zip);
  assert.deepEqual(list.map((e) => e.name), ["a.srt", "b/ب.srt"]);
  assert.equal(new TextDecoder().decode(await list[0].read()), SRT("one"));
  assert.equal(new TextDecoder().decode(await list[1].read()), SRT("two"));
});

test("the right episode is picked from a season pack", async () => {
  const zip = makeZip([
    { name: "Show.S01E01.NF.WEB-DL.srt", data: SRT("ep1") },
    { name: "Show.S01E02.NF.WEB-DL.srt", data: SRT("ep2") },
    { name: "__MACOSX/._Show.S01E02.srt", data: "junk" },
  ]);
  const got = await pickFromZip(zip, { season: 1, episode: 2 });
  assert.equal(got.name, "Show.S01E02.NF.WEB-DL.srt");
  await assert.rejects(pickFromZip(zip, { season: 1, episode: 9 }), /episode 9/);
});

test("a single file archive is used whatever its name", async () => {
  const zip = makeZip([{ name: "readme.nfo", data: "x" }, { name: "Movie.2023.srt", data: SRT("m") }]);
  const got = await pickFromZip(zip, { episode: 4 });
  assert.equal(got.name, "Movie.2023.srt");
});
