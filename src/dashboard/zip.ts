/**
 * Minimal zip writer. We do not pull in `archiver` because slipstream keeps its
 * runtime dependency surface tiny, and the only payloads we bundle are a few
 * JSON files and a markdown manifest. The STORED method (no compression) is a
 * valid zip per the PKWARE spec and any standard tool (unzip, macOS Finder,
 * Windows Explorer) opens it. Files are small enough that the lack of
 * compression is not a concern.
 */

import { writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

interface ZipEntry {
  path: string;
  data: Buffer;
  crc: number;
  offset: number;
}

const SIG_LFH = 0x04034b50;
const SIG_CFH = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** CRC-32 (IEEE 802.3 polynomial) over a buffer, slow but correct. */
function crc32(buf: Buffer): number {
  let table: number[] | null = (crc32 as { _t?: number[] })._t ?? null;
  if (!table) {
    table = new Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    (crc32 as { _t?: number[] })._t = table;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = (table[(crc ^ b) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a zip buffer from the given entries. STORED method, no compression. */
export function buildZip(files: { path: string; data: string | Buffer }[]): Buffer {
  const entries: ZipEntry[] = [];
  const chunks: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, "utf8");
    const nameBuf = Buffer.from(f.path, "utf8");
    const crc = crc32(data);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(SIG_LFH, 0);
    lfh.writeUInt16LE(20, 4); // version
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(0, 8); // method = stored
    lfh.writeUInt16LE(0, 10); // mtime
    lfh.writeUInt16LE(0x21, 12); // mdate = 1980-01-01
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    chunks.push(lfh, nameBuf, data);
    entries.push({ path: f.path, data, crc, offset });
    offset += lfh.length + nameBuf.length + data.length;
  }

  const cdStart = offset;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.path, "utf8");
    const cfh = Buffer.alloc(46);
    cfh.writeUInt32LE(SIG_CFH, 0);
    cfh.writeUInt16LE(20, 4); // version made by
    cfh.writeUInt16LE(20, 6); // version needed
    cfh.writeUInt16LE(0, 8);
    cfh.writeUInt16LE(0, 10);
    cfh.writeUInt16LE(0, 12);
    cfh.writeUInt16LE(0x21, 14);
    cfh.writeUInt32LE(e.crc, 16);
    cfh.writeUInt32LE(e.data.length, 20);
    cfh.writeUInt32LE(e.data.length, 24);
    cfh.writeUInt16LE(nameBuf.length, 28);
    cfh.writeUInt16LE(0, 30);
    cfh.writeUInt16LE(0, 32);
    cfh.writeUInt16LE(0, 34);
    cfh.writeUInt16LE(0, 36);
    cfh.writeUInt32LE(0, 38);
    cfh.writeUInt32LE(e.offset, 42);
    chunks.push(cfh, nameBuf);
    offset += cfh.length + nameBuf.length;
  }

  const cdSize = offset - cdStart;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  chunks.push(eocd);

  return Buffer.concat(chunks);
}

/** Convenience: write a zip to disk. */
export async function writeZip(
  outPath: string,
  files: { path: string; data: string | Buffer }[]
): Promise<void> {
  await writeFile(outPath, buildZip(files));
}

/** SHA256 fingerprint of a buffer, used by the manifest. */
export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}
