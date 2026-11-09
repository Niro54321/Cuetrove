<p align="center"><img src="docs/logo.png" width="96" alt="Cuetrove logo"></p>

<h1 align="center">Cuetrove</h1>

<p align="center">A Stremio and Nuvio add-on for <b>official subtitles in every language</b>, Arabic first by default.<br>
Subtitles made for Netflix, Disney+, Crunchyroll, Paramount+, Apple TV+, Prime Video, Max and other services come first, with their source written next to them.</p>

---

## What it does

When a movie or episode starts, your player asks Cuetrove for subtitles. Cuetrove searches three public subtitle libraries through their official APIs, reads each file's release name and the uploader's notes, and returns a short, ranked list:

```
Arabic  · Netflix · official · SubSource
Arabic  · Netflix WEB · same release · OpenSubtitles
English · Netflix WEB · SDH · SubDL
French  · Disney+ WEB · OpenSubtitles
```

- **Official first.** A subtitle marked *retail* (taken from the service or the disc itself) ranks highest. Next come subtitles made for a streaming service's own release (`NF`, `DSNP`, `ATVP`, `CR`, `PMTP`, `AMZN`, `HMAX` and about 60 more tags), then Blu-ray. With **Only official subtitles** on (the default), fan translations, cam rips, TV rips and machine translations are hidden.
- **Named by timing.** A service times every language of a title the same way. When a file's name says nothing (`Movie.2025.WEB.h264-GRP`), Cuetrove compares its cue times with files that do name a service; if they line up, it is labelled, for example, `Prime Video WEB · by timing`.
- **In sync.** When your player sends the file name, subtitles from the same release are marked *same release* and put on top, because a Netflix subtitle is timed for the Netflix release.
- **Every language.** About 80 languages. Your languages come first, in your order, then every other language that exists (or only yours).
- **Clean files.** Every file is converted to UTF-8 SRT (or WebVTT): cp1256 Arabic, cp1255 Hebrew, cp1251 Cyrillic, UTF-16 and other old encodings are detected, Arabic that was saved as `ÇáÓáÇã` mojibake is repaired, and ASS, MicroDVD and MPL2 files are converted.
- **Right-to-left that reads right.** Arabic, Persian, Urdu and Hebrew lines are wrapped in right-to-left marks, so full stops and question marks sit at the correct end in every player. Files whose punctuation was flipped for old players are turned back.
- **My subtitles.** Upload your own subtitle file from the settings page: search the title, pick the season and episode, choose the file (SRT, VTT, ASS, SUB or a ZIP). It is converted like every other file and shows first in the list for that movie or episode, on every device. Files are kept in your Worker's KV storage (or a folder on your PC) under a private id that only your install link carries; the first link that uploads owns that Worker's storage.
- **Season packs.** The right episode is taken out of a season's ZIP archive.
- **Anime.** Kitsu ids (from the Anime Kitsu catalog) are mapped to the right IMDb season and episode.
- **Cached.** Searches are kept for 6 hours and converted files for 30 days.

## Sources

| Source | Key | Limits | Notes |
| --- | --- | --- | --- |
| [SubSource](https://subsource.net/api-docs) | free key from your SubSource account (API tab) | 60 requests a minute, 7,200 a day | Old Subscene library. Marks official subtitles as *retail*. Very rich in Arabic. |
| [SubDL](https://subdl.com/api-doc) | free key from your SubDL account | 2,000 searches a day; 300 downloads a day per IP | Old Subscene library and more. Very rich in Arabic. |
| OpenSubtitles | none | none | Through Stremio's public OpenSubtitles add-on. Only release-tagged files are shown while "Only official" is on. |

Each person uses their own keys. They live only inside that person's install link, never on the server and never in this repository.

## Install

You need an address your player can reach. Pick one:

### A. Your own free Cloudflare Worker (works on phones and TVs)

```bash
git clone https://github.com/Niro54321/Cuetrove.git
cd Cuetrove
npm install
npx wrangler login
npx wrangler deploy
```

Wrangler prints your address, for example `https://cuetrove.<you>.workers.dev`. The free Workers plan is enough.

### B. On your PC (Nuvio or Stremio on the same PC)

Node.js 20 or newer:

```bash
npm start
```

Then open `http://127.0.0.1:7386/configure`. To use it from a phone or TV on your home network, run `npm run start:lan` and open the address it prints.

> Stremio **Web** cannot reach an add-on on `127.0.0.1` because browsers block websites from local addresses. Use option A for Stremio Web, or use the Stremio desktop app and Nuvio, which can.

### Then, in your player

1. Open `<your address>/configure`.
2. Choose your languages (Arabic and English are already there), and paste your SubSource and SubDL keys.
3. Install:
   - **Stremio:** press *Install in Stremio*, or *Stremio Web*.
   - **Nuvio:** press *Copy link*, then in Nuvio go to *Settings → Addons* and paste it.

To change a setting later, open the add-on's *Configure* button in Stremio, or the configure page, and install the new link.

## How "official" is decided

Cuetrove never sees the streaming services themselves, so it reads what the libraries say about each file:

1. **Retail** (SubSource's own *retail* mark, or an uploader note such as "Retail", "Netflix subs", "ترجمة نتفليكس الرسمية"): the service's or disc's own subtitle. Labelled *official*.
2. **A service's release tag** (`Show.S01E01.1080p.NF.WEB-DL…`): the file was made for that service's release. Most of these are the service's own subtitles. Some are fan translations timed to that release, and an uploader note that says so moves them down.
3. **Blu-ray**: made for a disc release.

Everything else (no release, TV and DVD rips, cams, notes such as "my translation", machine translation) is hidden while **Only official subtitles** is on, and ranked last when it is off.

## Legal

Cuetrove does **not** download, scrape or decrypt anything from Netflix, Disney+, Crunchyroll, Paramount+, Apple TV+ or any other streaming service, and it does not touch DRM. It only searches public subtitle libraries through the APIs those libraries publish for apps like this one, with each user's own key, and converts the file the user picked. It does not host or redistribute subtitle files: each person runs their own copy, and the cache only keeps files that person already asked for. You are responsible for following the copyright law of your country and the terms of each library.

## Development

```bash
npm test            # unit tests (node:test, no network)
npm run dev         # the Worker locally with wrangler, on http://127.0.0.1:8787
npm start           # the Node server, on http://127.0.0.1:7386
```

The code has no runtime dependencies. `src/addon.js` is the Stremio protocol, `src/sources/` has one file per library, `src/subtitle.js` reads and writes subtitle files, `src/release.js` reads release names, `src/worker.js` and `bin/cuetrove.js` are the two ways to run it.

## License

[MIT](LICENSE)
