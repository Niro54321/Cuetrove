export const VERSION = "1.0.0";
export const USER_AGENT = `Cuetrove/${VERSION} (+https://github.com/Niro54321/Cuetrove)`;

export class HttpError extends Error {
  constructor(status, url, message) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.url = url;
  }
}

/** fetch with a time limit, our User-Agent and a size limit. Returns the Response (ok only). */
export async function get(env, url, { headers = {}, timeout = 9000 } = {}) {
  const doFetch = env.fetch || fetch;
  let res;
  try {
    res = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...headers },
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    throw new HttpError(0, url, err?.name === "TimeoutError" ? "timed out" : "could not connect");
  }
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function getJson(env, url, opts) {
  const res = await get(env, url, opts);
  return res.json();
}

export async function getBytes(env, url, opts = {}) {
  const res = await get(env, url, { timeout: 15000, ...opts });
  const limit = opts.limit || 10 * 1024 * 1024;
  if (Number(res.headers.get("content-length") || 0) > limit) throw new HttpError(413, url, "file is too large");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > limit) throw new HttpError(413, url, "file is too large");
  return buf;
}
