/**
 * Generates Capno PWA icons (PNG) with zero dependencies by writing the PNG
 * format directly (zlib from node core). Icon: dark navy tile with a green
 * ECG-style pulse line. Run: `npm run icons` (outputs are committed).
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
function drawIcon(size) {
  const img = Buffer.alloc(size * size * 4);
  const bg = [11, 18, 32]; // #0b1220
  const edge = [5, 8, 13]; // #05080d
  const green = [34, 224, 95]; // #22e05f

  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    img[i] = r;
    img[i + 1] = g;
    img[i + 2] = b;
    img[i + 3] = a;
  };

  // Background with subtle vignette.
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cx) / cx;
      const t = Math.min(1, d * d);
      set(x, y, [
        Math.round(bg[0] + (edge[0] - bg[0]) * t),
        Math.round(bg[1] + (edge[1] - bg[1]) * t),
        Math.round(bg[2] + (edge[2] - bg[2]) * t),
      ]);
    }
  }

  // ECG pulse polyline across the middle (normalized coordinates).
  const pts = [
    [0.06, 0.5], [0.3, 0.5], [0.36, 0.42], [0.42, 0.58],
    [0.48, 0.18], [0.55, 0.78], [0.6, 0.5], [0.94, 0.5],
  ].map(([x, y]) => [x * size, y * size]);

  const thick = Math.max(2, Math.round(size * 0.045));
  const drawSegment = (x0, y0, x1, y1) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      for (let dy = -thick; dy <= thick; dy++) {
        for (let dx = -thick; dx <= thick; dx++) {
          if (dx * dx + dy * dy <= thick * thick) set(Math.round(x + dx), Math.round(y + dy), green);
        }
      }
    }
  };
  for (let i = 0; i < pts.length - 1; i++) {
    drawSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }

  return encodePng(size, size, img);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(outDir, name), drawIcon(size));
  console.log(`wrote public/icons/${name}`);
}
