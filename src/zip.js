// A small ZIP reader (stored and deflated entries), enough for subtitle archives. Works on
// Cloudflare Workers and Node 18+ through DecompressionStream.

const MAX_ENTRY = 8 * 1024 * 1024;

export function isZip(bytes) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** [{name, size, read: async () => Uint8Array}] for every file in the archive. */
export function entries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip archive");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = [];
  const utf8 = new TextDecoder("utf-8");
  const cp437 = new TextDecoder("latin1");
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const usize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const raw = bytes.subarray(p + 46, p + 46 + nameLen);
    const name = (flags & 0x800 ? utf8 : cp437).decode(raw);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/") || flags & 1) continue;                 // folders and encrypted files
    out.push({
      name,
      size: usize,
      read: async () => {
        if (view.getUint32(local, true) !== 0x04034b50) throw new Error("broken zip entry");
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = bytes.subarray(start, start + csize);
        if (method === 0) return data;
        if (method !== 8) throw new Error(`zip method ${method} is not supported`);
        return inflate(data, Math.min(usize || MAX_ENTRY, MAX_ENTRY));
      },
    });
  }
  return out;
}

async function inflate(data, limit) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
    if (size > limit + 65536) { await reader.cancel(); throw new Error("zip entry is too large"); }
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}
