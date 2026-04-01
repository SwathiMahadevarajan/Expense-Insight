#!/usr/bin/env node
/**
 * PWA icon generator.
 *
 * On macOS (local dev / Netlify Linux):
 *   - Tries `sharp` (npm) first — fastest, best quality.
 *   - Falls back to `sips` (macOS built-in) for local dev without sharp.
 *   - Falls back to the pure-Node PNG fallback for Linux CI / Netlify.
 *
 * Source icon: public/icons/splash-icon.png (the branded rounded-square icon).
 * If it doesn't exist, the solid-color fallback is used instead.
 */
import { execSync }                from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath }           from "url";
import { dirname, join }           from "path";
import { deflateSync }             from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir    = join(__dirname, "..", "public", "icons");
const srcIcon   = join(outDir, "splash-icon.png");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

mkdirSync(outDir, { recursive: true });

// ── Strategy 1: sharp (npm) ───────────────────────────────────────────────────
async function trySharp() {
  const sharp = await import("sharp").then(m => m.default).catch(() => null);
  if (!sharp || !existsSync(srcIcon)) return false;
  for (const size of SIZES) {
    await sharp(srcIcon)
      .resize(size, size, { fit: "cover", position: "center" })
      .png()
      .toFile(join(outDir, `icon-${size}.png`));
    console.log(`  ✓ icon-${size}.png  (sharp)`);
  }
  return true;
}

// ── Strategy 2: sips (macOS built-in) ────────────────────────────────────────
function trySips() {
  if (!existsSync(srcIcon)) return false;
  try {
    execSync("which sips", { stdio: "ignore" });
  } catch {
    return false;
  }
  for (const size of SIZES) {
    const out = join(outDir, `icon-${size}.png`);
    // sips -z height width input --out output
    execSync(`sips -z ${size} ${size} "${srcIcon}" --out "${out}"`, { stdio: "ignore" });
    console.log(`  ✓ icon-${size}.png  (sips)`);
  }
  return true;
}

// ── Strategy 3: pure-Node solid-colour PNG fallback ───────────────────────────
// Used on Netlify Linux where neither sharp nor sips is available.
// Generates solid #22c55e (SmartTrack green) icons.
function pngFallback() {
  const [R, G, B] = [34, 197, 94]; // #22c55e

  function u32(n) {
    const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b;
  }
  const CRC = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    CRC[i] = c;
  }
  function crc32(bufs) {
    let c = 0xffffffff;
    for (const buf of bufs) for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
    return u32((c ^ 0xffffffff) >>> 0);
  }
  function chunk(type, data) {
    const ty = Buffer.from(type, "ascii");
    const da = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.concat([u32(da.length), ty, da, crc32([ty, da])]);
  }
  function makePNG(size) {
    const SIG  = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8,2,0,0,0])]);
    const border = Math.max(2, Math.round(size * 0.06));
    const rows = [];
    for (let y = 0; y < size; y++) {
      const row = Buffer.alloc(1 + size * 3); row[0] = 0;
      for (let x = 0; x < size; x++) {
        const edge = x < border || x >= size - border || y < border || y >= size - border;
        row[1+x*3] = edge ? 255 : R; row[2+x*3] = edge ? 255 : G; row[3+x*3] = edge ? 255 : B;
      }
      rows.push(row);
    }
    return Buffer.concat([SIG, chunk("IHDR",ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows),{level:6})), chunk("IEND",Buffer.alloc(0))]);
  }

  for (const size of SIZES) {
    writeFileSync(join(outDir, `icon-${size}.png`), makePNG(size));
    console.log(`  ✓ icon-${size}.png  (fallback)`);
  }
  return true;
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Generating ${SIZES.length} PWA icons → public/icons/`);
  if (await trySharp())  { console.log(`\nDone (used splash-icon.png via sharp)\n`); return; }
  if (trySips())         { console.log(`\nDone (used splash-icon.png via sips)\n`);  return; }
  pngFallback();           console.log(`\nDone (solid-colour fallback)\n`);
})();
