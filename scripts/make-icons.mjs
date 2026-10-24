/**
 * Generates the PWA icons.
 *
 * Written as a script rather than committing PNGs by hand so the icon stays
 * editable: it's drawn from the same palette as the game, so when the art
 * direction changes (generated art is planned — see ART-PLAN.md), you change these numbers
 * and re-run instead of trying to hand-edit a binary.
 *
 *   node scripts/make-icons.mjs
 *
 * No dependencies — it rasterises into an RGBA buffer and writes the PNG with
 * Node's built-in zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---------------------------------------------------------------- raster ---

class Raster {
  constructor(size) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
  }

  /** Source-over blend of a solid colour, so translucent glow layers stack. */
  fillRect(x, y, w, h, [r, g, b], a = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.size, Math.round(x + w));
    const y1 = Math.min(this.size, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.size + px) * 4;
        this.data[i] = this.data[i] * (1 - a) + r * a;
        this.data[i + 1] = this.data[i + 1] * (1 - a) + g * a;
        this.data[i + 2] = this.data[i + 2] * (1 - a) + b * a;
        this.data[i + 3] = 255;
      }
    }
  }

  verticalGradient(top, bottom) {
    for (let y = 0; y < this.size; y++) {
      const t = y / (this.size - 1);
      const c = [0, 1, 2].map((k) => top[k] + (bottom[k] - top[k]) * t);
      this.fillRect(0, y, this.size, 1, c, 1);
    }
  }
}

// ------------------------------------------------------------------ png ----

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, body])));
  return Buffer.concat([length, typeBytes, body, crc]);
}

function encodePng(raster) {
  const { size, data } = raster;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type; 0 (none) is fine here
  // because the image is flat colour blocks and compresses well regardless.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- icon ----

// From PALETTE in src/render/palette.ts, so the icon on the home screen looks
// like the game it opens. The subject is a Space Raccoon in his bubble helmet,
// mid-raspberry, against the stars: the villain and the setting in one face.
const SPACE_TOP = [13, 22, 64];
const SPACE_BOTTOM = [58, 31, 92];
const STAR = [255, 233, 168];
const FUR = [139, 143, 152];
const BELLY = [201, 204, 210];
const MASK = [38, 38, 46];
const WHITE = [255, 255, 255];
const NOSE = [26, 26, 31];
const TONGUE = [255, 122, 168];
const TONGUE_DARK = [217, 79, 132];
const GLASS = [191, 233, 255];
const PINK = [255, 122, 138];

/** Filled ellipse, by scanlines. */
function ellipse(raster, cx, cy, rx, ry, colour) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    raster.fillRect(cx - half, y, half * 2, 1, colour, 1);
  }
}

/** Filled triangle, by scanlines. */
function triangle(raster, ax, ay, bx, by, cx, cy, colour) {
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const edges = [
    [ax, ay, bx, by],
    [bx, by, cx, cy],
    [cx, cy, ax, ay],
  ];
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((yc >= y0 && yc < y1) || (yc >= y1 && yc < y0)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    if (xs.length >= 2) raster.fillRect(Math.min(...xs), y, Math.abs(xs[1] - xs[0]), 1, colour, 1);
  }
}

function drawIcon(size) {
  const r = new Raster(size);
  const u = size / 100; // work in percent

  r.verticalGradient(SPACE_TOP, SPACE_BOTTOM);
  for (const [x, y, s] of [[12, 14, 2], [84, 10, 2.5], [90, 70, 1.5], [8, 80, 2], [70, 88, 1.5], [22, 46, 1.2], [80, 40, 1.2]]) {
    ellipse(r, x * u, y * u, s * u, s * u, STAR);
  }

  // Everything that matters stays inside the central 80%, the maskable safe zone.
  const cx = 50 * u;
  const cy = 50 * u;
  const R = 22 * u;

  // The bubble helmet: a glassy ring behind and around his head.
  ellipse(r, cx, cy, 34 * u, 34 * u, GLASS);
  ellipse(r, cx, cy, 31 * u, 31 * u, [70, 90, 140]);
  ellipse(r, cx - 14 * u, cy - 18 * u, 6 * u, 3.5 * u, WHITE);
  // A pink collar ring at the bottom of the helmet.
  r.fillRect(cx - 22 * u, cy + 27 * u, 44 * u, 5 * u, PINK, 1);

  // Ears.
  triangle(r, cx - 20 * u, cy - 8 * u, cx - 14 * u, cy - 27 * u, cx - 4 * u, cy - 18 * u, FUR);
  triangle(r, cx + 20 * u, cy - 8 * u, cx + 14 * u, cy - 27 * u, cx + 4 * u, cy - 18 * u, FUR);
  triangle(r, cx - 16 * u, cy - 12 * u, cx - 14 * u, cy - 22 * u, cx - 8 * u, cy - 17 * u, MASK);
  triangle(r, cx + 16 * u, cy - 12 * u, cx + 14 * u, cy - 22 * u, cx + 8 * u, cy - 17 * u, MASK);

  ellipse(r, cx, cy, R, R, FUR);
  ellipse(r, cx, cy + 8 * u, 13 * u, 11 * u, BELLY);

  // The bandit mask, and eyes squeezed shut with glee: ^ ^
  ellipse(r, cx, cy - 3 * u, 20 * u, 6.5 * u, MASK);
  for (const side of [-1, 1]) {
    const ex = cx + side * 8.5 * u;
    const ey = cy - 3 * u;
    for (let k = -4; k <= 4; k++) {
      const px = ex + k * 0.9 * u;
      const py = ey - (4 - Math.abs(k)) * 0.7 * u;
      r.fillRect(px - 0.8 * u, py - 0.8 * u, 1.6 * u, 1.6 * u, WHITE, 1);
    }
  }

  ellipse(r, cx, cy + 4 * u, 2.7 * u, 2.2 * u, NOSE);
  r.fillRect(cx - 4.5 * u, cy + 8 * u, 9 * u, 1.3 * u, NOSE, 1);
  ellipse(r, cx, cy + 13.5 * u, 4 * u, 5.5 * u, TONGUE);
  r.fillRect(cx - 0.5 * u, cy + 10 * u, 1 * u, 6 * u, TONGUE_DARK, 1);
  ellipse(r, cx - 11 * u, cy + 6.5 * u, 3.3 * u, 3.3 * u, [244, 170, 190]);
  ellipse(r, cx + 11 * u, cy + 6.5 * u, 3.3 * u, 3.3 * u, [244, 170, 190]);

  return r;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512, 180]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, encodePng(drawIcon(size)));
  console.log(`wrote ${file}`);
}
