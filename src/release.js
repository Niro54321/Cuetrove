// Reading release names ("Wednesday.S01E01.1080p.NF.WEB-DL.DDP5.1.H.264-NTb"): which streaming
// service or disc a subtitle was made for, how good that source is, and how well it matches the
// file being played.

// Tags that only ever mean one service.
const CLEAR = {
  NF: "Netflix", NFLX: "Netflix", NETFLIX: "Netflix",
  AMZN: "Prime Video", AMAZON: "Prime Video", PRIMEVIDEO: "Prime Video",
  DSNP: "Disney+", DSNY: "Disney+", DSPN: "Disney+", DISNEYPLUS: "Disney+", "DISNEY+": "Disney+",
  ATVP: "Apple TV+", ATV: "Apple TV+", APTV: "Apple TV+", APPLETV: "Apple TV+", "APPLETV+": "Apple TV+",
  PMTP: "Paramount+", PMNP: "Paramount+", PPLUS: "Paramount+", PARAMOUNTPLUS: "Paramount+", "PARAMOUNT+": "Paramount+",
  CRUNCHYROLL: "Crunchyroll", CRUNCHY: "Crunchyroll", CRUNCHYROLLS: "Crunchyroll",
  HMAX: "Max", HBOMAX: "Max",
  HULU: "Hulu", PCOK: "Peacock", PEACOCK: "Peacock",
  SKST: "SkyShowtime", SHOWTIME: "Showtime", STARZ: "Starz", STZ: "Starz",
  VIKI: "Viki", IQIYI: "iQIYI", WETV: "WeTV", TVING: "TVING", WAVVE: "Wavve", COUPANG: "Coupang Play", CPNG: "Coupang Play",
  HIDI: "HIDIVE", HIDIVE: "HIDIVE", FUNI: "Funimation", FUNIMATION: "Funimation", BGLOBAL: "Bilibili", BILI: "Bilibili",
  ABEMA: "ABEMA", UNXT: "U-NEXT", "U-NEXT": "U-NEXT", DMM: "DMM TV", LEMINO: "Lemino",
  SHAHID: "Shahid", SHAHIDVIP: "Shahid", OSN: "OSN+", OSNP: "OSN+", "OSN+": "OSN+", STARZPLAY: "STARZPLAY", WATCHIT: "WATCH iT", TOD: "TOD",
  VUDU: "Vudu", MUBI: "MUBI", CRAV: "Crave", CRAVE: "Crave", ROKU: "Roku", TUBI: "Tubi", PLUTO: "Pluto TV",
  HTSR: "Hotstar", HOTSTAR: "Hotstar", JIOHS: "JioHotstar", JIOC: "JioCinema", ZEE5: "ZEE5", SNXT: "SonyLIV", SONYLIV: "SonyLIV",
  ITVX: "ITVX", ALL4: "Channel 4", VIAP: "Viaplay", VIAPLAY: "Viaplay", CNLP: "Canal+", JOYN: "Joyn", RTLP: "RTL+",
  AUBC: "ABC iview", STAN: "Stan", BCORE: "Bravia Core", MGMP: "MGM+", AMCP: "AMC+", "AMC+": "AMC+", BRTB: "BritBox", BRITBOX: "BritBox",
  KNPY: "Kanopy", CRKL: "Crackle", FXTL: "FX", HTAN: "Hallmark",
};

// Tags that mean a service only next to a WEB tag ("CR" is Crunchyroll in "CR.WEB-DL").
const WITH_WEB = {
  CR: "Crunchyroll", MAX: "Max", HBO: "Max", IT: "iTunes", MA: "Movies Anywhere", IP: "BBC iPlayer", ITV: "ITVX",
  NOW: "NOW", RED: "YouTube", YT: "YouTube", ADN: "ADN", IQ: "iQIYI", SHO: "Showtime", CBC: "CBC Gem", GEM: "CBC Gem",
  DSNY: "Disney+", PCOK: "Peacock", B: null,
};

const WEB = /^(WEB|WEBDL|WEB-DL|WEBRIP|WEB-RIP|WEBHD|WEBCAP)$/;
const BLURAY = /^(BLURAY|BLU-RAY|BDRIP|BRRIP|BDREMUX|REMUX|BD|BD25|BD50|UHD|BDMV|UHDBD|UHDRIP)$/;
const TV = /^(HDTV|PDTV|SDTV|DSR|DSRIP|TVRIP|HDTVRIP|AHDTV|UHDTV)$/;
const DVD = /^(DVD|DVDRIP|DVD5|DVD9|DVDR|NTSC|PAL)$/;
const CAM = /^(CAM|CAMRIP|HDCAM|TS|HDTS|TELESYNC|TC|TELECINE|HDTC|SCR|SCREENER|DVDSCR|BDSCR|PRE-DVD|PREDVD|HQCAM|HD-TS|HD-CAM)$/;
const MACHINE = /(machine|google|deepl|auto[- ]?translat|ai[- ]?translat|ترجمة آلية|ترجمه آلية|مترجم آلي)/i;

function tokens(text) {
  return String(text || "")
    .replace(/WEB[\s.-]?DL/gi, " WEBDL ").replace(/WEB[\s.-]?Rip/gi, " WEBRIP ").replace(/Blu[\s.-]?Ray/gi, " BLURAY ")
    .replace(/HD[\s.-]?(TS|CAM|TC)\b/gi, " HD$1 ").replace(/Disney\s*\+/gi, " DISNEYPLUS ").replace(/Paramount\s*\+/gi, " PARAMOUNTPLUS ")
    .replace(/Apple\s*TV\s*\+?/gi, " APPLETV ").replace(/Prime\s*Video/gi, " PRIMEVIDEO ").replace(/HBO\s*Max/gi, " HBOMAX ")
    .replace(/B[\s-]?Global/gi, " BGLOBAL ").replace(/U-NEXT/gi, " UNXT ").replace(/OSN\+/gi, " OSNP ").replace(/AMC\+/gi, " AMCP ")
    .split(/[\s._()[\]{},+\-]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * What a release name says about its source:
 * {service: 'Netflix'|null, kind: 'web'|'bluray'|'tv'|'dvd'|'cam'|null, group, label, tier}
 * tier 0 = a streaming service's own WEB release, 1 = WEB or Blu-ray, 2 = TV or DVD,
 * 3 = unknown, 4 = cam/telesync, 5 = machine translation.
 */
export function describe(...texts) {
  const all = texts.filter(Boolean).join(" ");
  const toks = tokens(all);
  let kind = null;
  if (toks.some((t) => WEB.test(t))) kind = "web";
  else if (toks.some((t) => BLURAY.test(t))) kind = "bluray";
  else if (toks.some((t) => CAM.test(t))) kind = "cam";
  else if (toks.some((t) => TV.test(t))) kind = "tv";
  else if (toks.some((t) => DVD.test(t))) kind = "dvd";
  let service = null;
  for (const t of toks) {
    if (CLEAR[t]) { service = CLEAR[t]; break; }
  }
  if (!service && kind === "web") {
    for (const t of toks) if (WITH_WEB[t]) { service = WITH_WEB[t]; break; }
  }
  if (!service && /(netflix|disney|crunchyroll|paramount|apple ?tv|prime video|hbo ?max|hulu|shahid)/i.test(all)) {
    const m = /(netflix|disney|crunchyroll|paramount|apple ?tv|prime video|hbo ?max|hulu|shahid)/i.exec(all)[1].toLowerCase();
    service = { netflix: "Netflix", disney: "Disney+", crunchyroll: "Crunchyroll", paramount: "Paramount+", "apple tv": "Apple TV+",
      appletv: "Apple TV+", "prime video": "Prime Video", "hbo max": "Max", hbomax: "Max", hulu: "Hulu", shahid: "Shahid" }[m] || null;
  }
  if (service && !kind) kind = "web";
  const group = (/-([A-Za-z0-9]{2,15})(?:\.[a-z]{2,4})?$/.exec(String(texts[0] || "").trim()) || [])[1] || "";
  let tier = 3;
  if (MACHINE.test(all)) tier = 5;
  else if (kind === "cam") tier = 4;
  else if (service && kind === "web") tier = 0;
  else if (kind === "web" || kind === "bluray") tier = 1;
  else if (kind === "tv" || kind === "dvd") tier = 2;
  const kindName = { web: "WEB", bluray: "Blu-ray", tv: "TV", dvd: "DVD", cam: "Cam" }[kind] || "";
  const label = tier === 5 ? "Machine translation" : service ? `${service} ${kindName === "WEB" ? "WEB" : kindName}`.trim() : kindName;
  return { service, kind, group: group.toLowerCase(), label, tier };
}

// Uploader notes that say the file is the service's own subtitle, not a fan translation.
const RETAIL_NOTE = /(\bretail\b|\bofficial\b|\bripped\b|\bnetflix (?:subs?|subtitles?|translation)|ترجمة (?:نتفليكس|نتفلكس|ديزني|شاهد|أمازون|امازون|كرانشي)|الترجمة (?:الرسمية|الأصلية|الاصلية)|ترجمة (?:رسمية|أصلية|اصلية)|مستخرجة|مسحوبة)/i;
const FAN_NOTE = /(\bfan ?sub|\bmy (?:own )?translation|ترجمتي|ترجمة وتعديل|ترجمة و تعديل|تمت الترجمة بواسطة|ترجمة:)/i;

/** true when an uploader's note says the subtitle is the official one; false when it says fan-made. */
export function retailNote(text) {
  const t = String(text || "");
  if (!t) return null;
  if (RETAIL_NOTE.test(t)) return true;
  if (FAN_NOTE.test(t)) return false;
  return null;
}

/** Season/episode written in a file or release name: {season, episode} or null parts. */
export function episodeOf(name) {
  const s = String(name || "");
  let m = /S(\d{1,2})[\s._-]*E(\d{1,4})/i.exec(s) || /(\d{1,2})x(\d{1,3})(?!\d)/i.exec(s);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  m = /(?:^|[\s._\-[(])(?:E|EP|Episode)[\s._-]?(\d{1,4})(?!\d)/i.exec(s) || /(?:^|\s)-\s(\d{1,4})(?:v\d)?(?:\s|$|[[(.])/.exec(s);
  if (m) return { season: null, episode: Number(m[1]) };
  return { season: null, episode: null };
}

/** How close a subtitle's release is to the file being played (0 = unknown or no match). */
export function matchScore(release, playing) {
  if (!release || !playing) return 0;
  const a = describe(release);
  const b = describe(playing);
  let score = 0;
  if (a.group && a.group === b.group) score += 40;
  if (a.service && a.service === b.service) score += 25;
  if (a.kind && a.kind === b.kind) score += 10;
  const res = (x) => (/(2160p|1080p|720p|480p)/i.exec(x) || [])[1]?.toLowerCase();
  if (res(release) && res(release) === res(playing)) score += 3;
  return score;
}
