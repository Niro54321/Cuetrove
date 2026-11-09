#!/usr/bin/env node
// Runs Cuetrove on this PC: http://127.0.0.1:7386/configure
//   node bin/cuetrove.js [--port 7386] [--lan]
// --lan also serves other devices on your home network (a phone or TV running Nuvio or Stremio).

import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { networkInterfaces, homedir } from "node:os";
import { join } from "node:path";
import { handle } from "../src/addon.js";
import { MemoryCache } from "../src/cache.js";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(value("--port", process.env.PORT || 7386));
const LAN = flag("--lan");
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";
const CACHE_DIR = process.env.CUETROVE_CACHE
  || join(process.env.LOCALAPPDATA || join(homedir(), ".cache"), "Cuetrove", "cache");

/** Memory first, then a folder on disk, so subtitles survive a restart. */
class DiskCache extends MemoryCache {
  constructor(dir) {
    super(600);
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.prune();
  }

  file(key) {
    return join(this.dir, createHash("sha1").update(key).digest("hex") + ".json");
  }

  async get(key) {
    const mem = await super.get(key);
    if (mem !== null) return mem;
    try {
      const { until, value } = JSON.parse(readFileSync(this.file(key), "utf8"));
      if (until < Date.now()) return null;
      await super.put(key, value, Math.max(1, (until - Date.now()) / 1000));
      return value;
    } catch {
      return null;
    }
  }

  async put(key, value, ttl) {
    await super.put(key, value, ttl);
    try {
      writeFileSync(this.file(key), JSON.stringify({ until: Date.now() + ttl * 1000, value }));
    } catch {
      // a full or read-only disk only costs a new download later
    }
  }

  prune() {
    try {
      const now = Date.now();
      for (const name of readdirSync(this.dir)) {
        const p = join(this.dir, name);
        if (now - statSync(p).mtimeMs > 31 * 86400 * 1000) rmSync(p, { force: true });
      }
    } catch {
      // ignore
    }
  }
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) out.push(a.address);
  }
  return out;
}

/** "My subtitles" on this PC: one small file per key, in a folder next to the cache. */
class FolderStore {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  file(key) {
    return join(this.dir, createHash("sha1").update(key).digest("hex") + ".txt");
  }

  async get(key) {
    try { return readFileSync(this.file(key), "utf8"); } catch { return null; }
  }

  async put(key, value) {
    writeFileSync(this.file(key), value);
  }

  async delete(key) {
    rmSync(this.file(key), { force: true });
  }
}

const MINE_DIR = process.env.CUETROVE_MINE || join(CACHE_DIR, "..", "mine");

const allowedHosts = new Set(["127.0.0.1", "localhost", ...(LAN ? lanAddresses() : [])]);
const env = { cache: new DiskCache(CACHE_DIR), store: new FolderStore(MINE_DIR), multiUser: true, log: (m) => console.log(new Date().toISOString().slice(11, 19), m) };

const server = createServer(async (req, res) => {
  const host = String(req.headers.host || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (!allowedHosts.has(host)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("forbidden host");
    return;
  }
  try {
    const url = `http://${req.headers.host}${req.url}`;
    let body;
    if (req.method === "POST") {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) { res.writeHead(413); res.end("too large"); return; }
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const response = await handle(new Request(url, { method: req.method, headers: req.headers, body }), env);
    const headers = Object.fromEntries(response.headers);
    res.writeHead(response.status, headers);
    if (req.method === "HEAD" || !response.body) return res.end();
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    env.log(`server error: ${err?.stack || err}`);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("error");
  }
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${PORT} is already in use. Try --port 7387.` : err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Cuetrove is running.`);
  console.log(`  Settings and install link: http://127.0.0.1:${PORT}/configure`);
  if (LAN) for (const ip of lanAddresses()) console.log(`  From your phone or TV:      http://${ip}:${PORT}/configure`);
  console.log(`  Cache: ${CACHE_DIR}`);
  console.log(`  My subtitles: ${MINE_DIR}`);
  console.log("Press Ctrl+C to stop.");
});
