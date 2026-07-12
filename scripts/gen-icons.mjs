/**
 * Generates Capno PWA icons and the Open Graph share image (PNG) with zero
 * dependencies by writing the PNG format directly (zlib from node core).
 * Icon: the brand mark — one amber capnogram breath on a monitor-black tile
 * (see docs/brand.md and public/brand/capno-icon.svg, same 512-space
 * geometry).
 * Run: `npm run icons` (outputs are committed).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ── Minimal PNG encoder ───────────────────────────────────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // Raw scanlines with filter byte 0.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon drawing ──────────────────────────────────────────────────────────────
// Geometry in the authored 512×512 space of public/brand/capno-icon.svg:
// one capnogram breath (upstroke, ascending plateau, downstroke), round caps.
const TILE = [5, 8, 13]; // #05080d monitor black
const AMBER = [250, 204, 21]; // #facc15 EtCO₂ yellow
const TILE_RADIUS = 114 / 512;
const STROKE_HALF = 17 / 512; // stroke-width 34
const WAVE = [
  [96, 325], [154, 325], [172, 199], [328, 187], [342, 325], [416, 325],
].map(([x, y]) => [x / 512, y / 512]);

/** Stroke a polyline with round joints via a per-pixel setter. */
function strokePolyline(set, pts, thick, color) {
  const drawSegment = (x0, y0, x1, y1) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      for (let dy = -thick; dy <= thick; dy++) {
        for (let dx = -thick; dx <= thick; dx++) {
          if (dx * dx + dy * dy <= thick * thick) set(Math.round(x + dx), Math.round(y + dy), color);
        }
      }
    }
  };
  for (let i = 0; i < pts.length - 1; i++) {
    drawSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
}

/**
 * shape: 'tile' (rounded corners, transparent outside — home-screen icons),
 * 'square' (full bleed — apple-touch, which must stay opaque, and the
 * maskable icon, whose wave sits inside the 80% safe circle).
 */
function drawIcon(size, shape) {
  const img = Buffer.alloc(size * size * 4);

  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    img[i] = r;
    img[i + 1] = g;
    img[i + 2] = b;
    img[i + 3] = a;
  };

  const radius = TILE_RADIUS * size;
  const inTile = (x, y) => {
    if (shape === 'square') return true;
    const dx = Math.max(radius - x - 0.5, x + 0.5 - (size - radius), 0);
    const dy = Math.max(radius - y - 0.5, y + 0.5 - (size - radius), 0);
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inTile(x, y)) set(x, y, TILE);
    }
  }

  const pts = WAVE.map(([x, y]) => [x * size, y * size]);
  const thick = Math.max(2, Math.round(STROKE_HALF * size));
  strokePolyline(set, pts, thick, AMBER);

  return encodePng(size, size, img);
}

/**
 * 1200×630 Open Graph share card (public/og.png): the brand mark centered
 * on full-bleed monitor black. No text — this encoder draws no type, and
 * og:title carries the wordmark alongside the image.
 */
function drawOg(width, height) {
  const img = Buffer.alloc(width * height * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    img[i] = r;
    img[i + 1] = g;
    img[i + 2] = b;
    img[i + 3] = a;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) set(x, y, TILE);
  }

  // The 512-space brand geometry rendered in a centered box.
  const box = 460;
  const offX = (width - box) / 2;
  const offY = (height - box) / 2;
  const pts = WAVE.map(([x, y]) => [offX + x * box, offY + y * box]);
  strokePolyline(set, pts, Math.max(2, Math.round(STROKE_HALF * box)), AMBER);

  return encodePng(width, height, img);
}

for (const [name, size, shape] of [
  ['icon-192.png', 192, 'tile'],
  ['icon-512.png', 512, 'tile'],
  ['icon-512-maskable.png', 512, 'square'],
  ['apple-touch-icon.png', 180, 'square'],
]) {
  writeFileSync(join(outDir, name), drawIcon(size, shape));
  console.log(`wrote public/icons/${name}`);
}

// Public root (not /icons/), so the service worker's cache-first icon rule
// never serves a stale share image.
writeFileSync(join(outDir, '..', 'og.png'), drawOg(1200, 630));
console.log('wrote public/og.png');
