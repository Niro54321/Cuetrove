import test from "node:test";
import assert from "node:assert/strict";
import { describe, episodeOf, matchScore, retailNote } from "../src/release.js";

test("streaming services are read from release names", () => {
  const cases = [
    ["Wednesday.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-NTb", "Netflix"],
    ["Star.Wars.Andor.S01E01.1080p.DSNP.WEB-DL.DDP5.1.H.265-NTb", "Disney+"],
    ["Severance.S02E01.2160p.ATVP.WEB-DL.DDP5.1.HDR.H.265-FLUX", "Apple TV+"],
    ["Frieren.S01E01.1080p.CR.WEB-DL.AAC2.0.H.264-VARYG", "Crunchyroll"],
    ["Tulsa.King.S01E01.1080p.PMTP.WEB-DL.DDP5.1.H.264-NTb", "Paramount+"],
    ["The.Boys.S04E01.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb", "Prime Video"],
    ["House.of.the.Dragon.S02E01.1080p.HMAX.WEB-DL.DDP5.1.H.264-NTb", "Max"],
    ["Show.S01E01.1080p.iT.WEB-DL.DD5.1.H.264-GRP", "iTunes"],
  ];
  for (const [name, service] of cases) {
    const d = describe(name);
    assert.equal(d.service, service, name);
    assert.equal(d.tier, 0, name);
  }
  assert.equal(describe("Wednesday.S01E01.1080p.WEB.H264-GLHF", "", "Netflix WEBRip").service, "Netflix");
});

test("ambiguous tags need a WEB tag next to them", () => {
  assert.equal(describe("Some.Movie.2020.CR.Edition.BluRay.x264-GRP").service, null);
  assert.equal(describe("Some.Movie.2020.MA.1080p.BluRay").service, null);
  assert.equal(describe("Oppenheimer.2023.1080p.MA.WEB-DL.DDP5.1.Atmos.H.264").service, "Movies Anywhere");
});

test("tiers: WEB/Blu-ray above TV/DVD above unknown above cam above machine", () => {
  assert.equal(describe("Movie.2023.1080p.WEB-DL.x264-GRP").tier, 1);
  assert.equal(describe("Movie.2023.1080p.BluRay.x264-GRP").tier, 1);
  assert.equal(describe("Show.S01E01.720p.HDTV.x264-BiA").tier, 2);
  assert.equal(describe("Movie 2023").tier, 3);
  assert.equal(describe("Oppenheimer.2023.V1.HDCAM-Will1869").tier, 4);
  assert.equal(describe("Oppenheimer.2023.1080p.HD-TS-C1NEM4").tier, 4);
  assert.equal(describe("Movie.2023.1080p.WEB-DL", "", "machine translated").tier, 5);
  assert.equal(describe("Movie.2023.1080p.NF.WEB-DL.x264-GRP").label, "Netflix WEB");
});

test("episode numbers in file names", () => {
  assert.deepEqual(episodeOf("Show.S02E05.1080p.mkv"), { season: 2, episode: 5 });
  assert.deepEqual(episodeOf("Show 2x05.srt"), { season: 2, episode: 5 });
  assert.deepEqual(episodeOf("[SubsPlease] Frieren - 07 (1080p).ass"), { season: null, episode: 7 });
  assert.deepEqual(episodeOf("Show.E12.srt"), { season: null, episode: 12 });
  assert.deepEqual(episodeOf("Movie.2023.1080p.srt"), { season: null, episode: null });
});

test("match score prefers the same group and service", () => {
  const playing = "Wednesday.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-NTb.mkv";
  assert.ok(matchScore("Wednesday.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-NTb", playing) >= 75);
  assert.ok(matchScore("Wednesday.S01E01.1080p.NF.WEB-DL.H.264-FLUX", playing) >= 35);
  assert.equal(matchScore("Wednesday.S01E01.720p.HDTV.x264-ABC", playing), 0);
});

test("uploader notes: retail vs fan-made", () => {
  assert.equal(retailNote("Retail subs from Netflix"), true);
  assert.equal(retailNote("ترجمة نتفليكس الرسمية"), true);
  assert.equal(retailNote("ترجمتي الخاصة، أرجو أن تنال إعجابكم"), false);
  assert.equal(retailNote(""), null);
  assert.equal(retailNote("synced for the NTb release"), null);
});
