// Caches: search results for a few hours, converted subtitle files for a month. On Cloudflare the
// Workers Cache API is used; on a PC, memory plus a folder on disk (see bin/cuetrove.js).

export class MemoryCache {
  constructor(max = 400) {
    this.max = max;
    this.map = new Map();
  }

  async get(key) {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.until < Date.now()) { this.map.delete(key); return null; }
    this.map.delete(key);
    this.map.set(key, hit);           // most recently used last
    return hit.value;
  }

  async put(key, value, ttlSeconds) {
    this.map.set(key, { value, until: Date.now() + ttlSeconds * 1000 });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
}

/** Cloudflare's per-data-centre cache. Values are strings (JSON or subtitle text). */
export class WorkerCache {
  constructor(ctx) {
    this.ctx = ctx;
    this.memory = new MemoryCache(100);
  }

  url(key) {
    return `https://cache.cuetrove.internal/${encodeURIComponent(key)}`;
  }

  async get(key) {
    const mem = await this.memory.get(key);
    if (mem !== null) return mem;
    try {
      const res = await caches.default.match(this.url(key));
      if (!res) return null;
      const value = await res.text();
      await this.memory.put(key, value, 300);
      return value;
    } catch {
      return null;
    }
  }

  async put(key, value, ttlSeconds) {
    await this.memory.put(key, value, Math.min(ttlSeconds, 300));
    const res = new Response(value, { headers: { "Cache-Control": `max-age=${ttlSeconds}`, "Content-Type": "text/plain; charset=utf-8" } });
    const job = caches.default.put(this.url(key), res).catch(() => {});
    if (this.ctx?.waitUntil) this.ctx.waitUntil(job);
    else await job;
  }
}

/** JSON helpers on top of any cache. */
export async function getJson(cache, key) {
  const text = await cache.get(key);
  if (text === null || text === undefined) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export function putJson(cache, key, value, ttlSeconds) {
  return cache.put(key, JSON.stringify(value), ttlSeconds);
}
