// Cloudflare Workers entry point. Deploy with `npx wrangler deploy` (see README).

import { handle } from "./addon.js";
import { WorkerCache } from "./cache.js";

export default {
  async fetch(request, env, ctx) {
    return handle(request, {
      cache: new WorkerCache(ctx),
      // "My subtitles" live in the MINE KV namespace (see wrangler.toml).
      store: env.MINE || null,
      multiUser: env.MULTI_USER === "1",
      log: (m) => console.log(m),
    });
  },
};
