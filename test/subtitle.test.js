import test from "node:test";
import assert from "node:assert/strict";
import { decode, repair, parse, clean, toSrt, toVtt, convert, fixRtlLine, isFlipped } from "../src/subtitle.js";
import { CODEPAGES } from "../src/codepages.js";

const RLM = "‏";

function encodeWith(table, text) {
  // our own encoder for a single-byte code page, from the decoding table
  const map = new Map([...CODEPAGES[table]].map((ch, i) => [ch, 0x80 + i]));
  return Uint8Array.from([...text].map((ch) => (ch.charCodeAt(0) < 0x80 ? ch.charCodeAt(0) : map.get(ch))));
}

const ARABIC = "1\n00:00:01,000 --> 00:00:03,000\nمرحباً بكم في المدرسة، هذا هو اليوم الأول.\n\n2\n00:00:04,000 --> 00:00:06,000\nهل أنت مستعد للدرس؟ نعم أنا مستعد تماماً.\n";

test("cp1256 Arabic without a hint is decoded by the language", () => {
  const bytes = encodeWith("windows-1256", ARABIC);
  assert.equal(decode(bytes, { lang: "ar" }), ARABIC);
});

test("a wrong encoding hint does not win over the language's script", () => {
  const bytes = encodeWith("windows-1256", ARABIC);
  assert.equal(decode(bytes, { lang: "ar", hint: "CP1252" }), ARABIC);
});

test("UTF-8, UTF-8 with BOM and UTF-16 are read", () => {
  const utf8 = new TextEncoder().encode(ARABIC);
  assert.equal(decode(utf8, { lang: "ar" }), ARABIC);
  assert.equal(decode(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8]), {}), ARABIC);
  const u16 = new Uint8Array(2 + ARABIC.length * 2);
  u16[0] = 0xff; u16[1] = 0xfe;
  for (let i = 0; i < ARABIC.length; i++) { u16[2 + i * 2] = ARABIC.charCodeAt(i) & 0xff; u16[3 + i * 2] = ARABIC.charCodeAt(i) >> 8; }
  assert.equal(decode(u16, {}), ARABIC);
});

test("Cyrillic and Greek code pages", () => {
  const ru = "1\n00:00:01,000 --> 00:00:02,000\nПривет, как дела? Всё хорошо, спасибо большое.\n";
  assert.equal(decode(encodeWith("windows-1251", ru), { lang: "ru" }), ru);
  const el = "1\n00:00:01,000 --> 00:00:02,000\nΓεια σου, τι κάνεις; Είμαι πολύ καλά, ευχαριστώ.\n";
  assert.equal(decode(encodeWith("windows-1253", el), { lang: "el" }), el);
});

test("Arabic saved as cp1252 mojibake is repaired", () => {
  const bytes = encodeWith("windows-1256", ARABIC);
  const mojibake = [...bytes].map((b) => (b < 0x80 ? String.fromCharCode(b) : CODEPAGES["windows-1252"][b - 0x80])).join("");
  assert.notEqual(mojibake, ARABIC);
  assert.equal(repair(mojibake, "ar"), ARABIC);
  assert.equal(repair("Hello there, this is plain English text with no problems at all.", "en"), "Hello there, this is plain English text with no problems at all.");
});

test("SRT with broken blank lines, VTT, ASS, MicroDVD and MPL2 are parsed", () => {
  const srt = parse("1\r\n00:00:01,000 --> 00:00:02,500\r\nHello\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nWorld\r\nagain\r\n");
  assert.deepEqual(srt, [{ start: 1000, end: 2500, text: "Hello" }, { start: 3000, end: 4000, text: "World\nagain" }]);
  const vtt = parse("WEBVTT\n\n00:01.000 --> 00:02.000 align:start\n<i>Hi</i>\n\nnote\n00:00:03.000 --> 00:00:04.000\nThere\n");
  assert.equal(vtt.length, 2);
  assert.equal(vtt[0].start, 1000);
  const ass = parse("[Script Info]\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\i1}Hello, you\\Nthere\n");
  assert.deepEqual(ass, [{ start: 1500, end: 3000, text: "<i>Hello, you\nthere</i>" }]);
  const mdvd = parse("{1}{1}25\n{25}{50}Hello|World\n");
  assert.deepEqual(mdvd, [{ start: 1000, end: 2000, text: "Hello\nWorld" }]);
  const mpl = parse("[10][25]One|/Two\n");
  assert.deepEqual(mpl, [{ start: 1000, end: 2500, text: "One\nTwo" }]);
});

test("RTL lines are wrapped in right-to-left marks, tags stay outside", () => {
  assert.equal(fixRtlLine("مرحبا."), `${RLM}مرحبا.${RLM}`);
  assert.equal(fixRtlLine("<i>مرحبا!</i>"), `<i>${RLM}مرحبا!${RLM}</i>`);
  assert.equal(fixRtlLine("Hello."), "Hello.");
});

test("flipped files get their punctuation back in reading order", () => {
  const lines = [".مرحبا", "؟كيف حالك", "!رائع", ".أنا بخير", "...حسناً", "شكراً جزيلاً -"];
  assert.equal(isFlipped(lines), true);
  assert.equal(fixRtlLine(".مرحبا", true), `${RLM}مرحبا.${RLM}`);
  assert.equal(fixRtlLine("؟كيف حالك", true), `${RLM}كيف حالك؟${RLM}`);
  assert.equal(fixRtlLine("شكراً جزيلاً -", true), `${RLM}- شكراً جزيلاً${RLM}`);
  // a normal file with an occasional leading ellipsis is left alone
  assert.equal(isFlipped(["...ثم ذهبنا", "مرحبا.", "كيف حالك؟", "أنا بخير.", "رائع!"]), false);
});

test("clean() drops empty cues and unknown tags; writers make valid SRT and VTT", () => {
  const cues = clean([{ start: 0, end: 1000, text: "<c.yellow>Hi</c>  there" }, { start: 2000, end: 3000, text: "<b> </b>" }], "en");
  assert.deepEqual(cues, [{ start: 0, end: 1000, text: "Hi there" }]);
  assert.equal(toSrt(cues), "1\n00:00:00,000 --> 00:00:01,000\nHi there\n");
  assert.equal(toVtt(cues), "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi there\n");
});

test("convert(): cp1256 bytes in, clean UTF-8 SRT with RTL marks out", () => {
  const out = convert(encodeWith("windows-1256", ARABIC), { lang: "ar" });
  assert.match(out, /^1\n00:00:01,000 --> 00:00:03,000\n‏مرحباً بكم/);
  assert.ok(out.includes(`الأول.${RLM}`));
  assert.equal(convert(new TextEncoder().encode("not a subtitle"), { lang: "en" }), null);
});
