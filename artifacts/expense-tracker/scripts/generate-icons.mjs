#!/usr/bin/env node
/**
 * Pure Node.js PWA icon generator — no external dependencies.
 * Creates solid-color PNG icons in public/icons/ for all sizes required
 * by the PWA manifest in vite.config.ts.
 *
 * Color: SmartTrack green #22c55e = rgb(34, 197, 94)
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── PNG helpers ─────────────────────────────────────────────────────────────

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

// CRC-32 table (used by PNG chunk checksums)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}
function crc32(bufs) {
  let c = 0xffffffff;
  for (const buf of bufs) for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return u32((c ^ 0xffffffff) >>> 0);
}

function chunk(type, data) {
  const ty = Buffer.from(type, 'ascii');
  const da = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([u32(da.length), ty, da, crc32([ty, da])]);
}

/**
 * Build a solid-color RGB PNG of the given size.
 * Adds a 4-pixel white rounded inner border so it looks less like a blob.
 */
function createPNG(size, r, g, b) {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: width, height, bit-depth=8, color-type=2 (RGB), compress=0, filter=0, interlace=0
  const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8, 2, 0, 0, 0])]);

  // Raw image data: one filter byte (0 = None) + RGB pixels per row
  const rows = [];
  const border = Math.max(2, Math.round(size * 0.06)); // ~6% border
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      // White border around edge for rounded-square look when installed
      const inBorder = x < border || x >= size - border || y < border || y >= size - border;
      const pr = inBorder ? 255 : r;
      const pg = inBorder ? 255 : g;
      const pb = inBorder ? 255 : b;
      row[1 + x * 3]     = pr;
      row[2 + x * 3]     = pg;
      row[3 + x * 3]     = pb;
    }
    rows.push(row);
  }
  const rawData = Buffer.concat(rows);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rawData, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Generate icons ───────────────────────────────────────────────────────────

const [R, G, B] = [34, 197, 94]; // #22c55e
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = join(__dirname, '..', 'public', 'icons');

mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, createPNG(size, R, G, B));
  console.log(`  ✓ icon-${size}.png`);
}

console.log(`\nGenerated ${sizes.length} icons → public/icons/`);
