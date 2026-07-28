/**
 * Generates build/icon.ico + build/icon.png (256×256) with no external deps.
 *
 * A brass round table with four seats and a command-zone pip at the centre, on
 * dark slate — matching the app's accent/void tokens. Placeholder-quality art,
 * but properly anti-aliased (4×4 supersampling) so it stays clean at the 16 px
 * taskbar size where a hard-edged circle turns to gravel.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 256;
const H = 256;
const SS = 4; // supersample factor per axis

const BG = [0x13, 0x18, 0x20];
const BRASS = [0xd8, 0xb0, 0x6a];
const BRASS_DIM = [0x8a, 0x6c, 0x3c];

// ── Signed-distance helpers (all in supersampled space, then averaged) ──

function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - r;
}

function sdCircle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

/** Distance to a ring of radius r and half-thickness t. */
function sdRing(x, y, cx, cy, r, t) {
  return Math.abs(Math.hypot(x - cx, y - cy) - r) - t;
}

/** Distance to an axis-aligned diamond (L1 ball). */
function sdDiamond(x, y, cx, cy, r) {
  return Math.abs(x - cx) + Math.abs(y - cy) - r;
}

const C = 128;
const TABLE_R = 76;
const TABLE_T = 7;
const SEAT_R = 19;

/** Composite the icon at one sample point → [r,g,b,a] with 0..1 coverage. */
function sample(x, y) {
  const plate = sdRoundRect(x, y, C, C, 128, 128, 46);
  if (plate > 0) return null; // outside the plate entirely

  // Four seats at N/E/S/W, sitting on the table's edge.
  let seat = Infinity;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    seat = Math.min(
      seat,
      sdCircle(x, y, C + Math.cos(a) * TABLE_R, C + Math.sin(a) * TABLE_R, SEAT_R),
    );
  }

  const ring = sdRing(x, y, C, C, TABLE_R, TABLE_T);
  const pip = sdDiamond(x, y, C, C, 26);
  const pipHole = sdDiamond(x, y, C, C, 13);

  // Painter's order: plate, dim inner disc, ring, seats, centre pip.
  if (Math.max(pip, -pipHole) <= 0) return BRASS;
  if (seat <= 0) return BRASS;
  if (ring <= 0) return BRASS;
  if (sdCircle(x, y, C, C, TABLE_R - TABLE_T) <= 0) {
    // Faint inner felt so the ring reads as a table, not a wheel.
    return [
      Math.round(BG[0] + (BRASS_DIM[0] - BG[0]) * 0.18),
      Math.round(BG[1] + (BRASS_DIM[1] - BG[1]) * 0.18),
      Math.round(BG[2] + (BRASS_DIM[2] - BG[2]) * 0.18),
    ];
  }
  return BG;
}

const rgba = Buffer.alloc(W * H * 4);
for (let py = 0; py < H; py++) {
  for (let px = 0; px < W; px++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let hits = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
        if (c) { r += c[0]; g += c[1]; b += c[2]; hits++; }
      }
    }
    const total = SS * SS;
    const i = (py * W + px) * 4;
    if (hits === 0) continue; // fully transparent
    rgba[i] = Math.round(r / hits);
    rgba[i + 1] = Math.round(g / hits);
    rgba[i + 2] = Math.round(b / hits);
    rgba[i + 3] = Math.round((hits / total) * 255);
  }
}

// ── PNG encode ──
const crcTable = (() => {
  const tbl = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG() {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = W * 4 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const png = encodePNG();

// ── ICO container embedding the PNG ──
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(1, 4); // image count
const entry = Buffer.alloc(16);
entry[0] = 0; // width 0 ⇒ 256
entry[1] = 0; // height 0 ⇒ 256
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // offset
const ico = Buffer.concat([dir, entry, png]);

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'icon.png'), png);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
console.log(`Wrote build/icon.png (${png.length} B) and build/icon.ico (${ico.length} B)`);
