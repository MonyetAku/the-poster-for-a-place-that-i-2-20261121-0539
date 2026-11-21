// The Poster for a Place That Isn't There — LUMARIS
// A travel poster for an island where the sea glows at night.
// Drawn as a studio-grade poster with an own PNG encoder.
// Node 22, stdlib only, fully deterministic (seeded RNG, no time, no randomness).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------- deterministic RNG (mulberry32) ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- wide caps font, 8 wide x 10 tall (only the glyphs LUMARIS needs) ----------
const GLYPHS: Record<string, string[]> = {
  L: [
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "########",
  ],
  U: [
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    ".######.",
  ],
  M: [
    "#......#",
    "##....##",
    "#.#..#.#",
    "#.#..#.#",
    "#..##..#",
    "#..##..#",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
  ],
  A: [
    "...##...",
    "..#..#..",
    "..#..#..",
    ".#....#.",
    ".#....#.",
    "#......#",
    "#......#",
    "########",
    "#......#",
    "#......#",
  ],
  R: [
    "######..",
    "#.....#.",
    "#.....#.",
    "#.....#.",
    "######..",
    "#...#...",
    "#....#..",
    "#.....#.",
    "#.....#.",
    "#......#",
  ],
  I: [
    "########",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
    "########",
  ],
  S: [
    ".######.",
    "#......#",
    "#.......",
    "#.......",
    ".#####..",
    "......#.",
    "......#.",
    "#......#",
    "#......#",
    ".######.",
  ],
};

type RGB = [number, number, number];

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const blend = (base: RGB, over: RGB, alpha: number): RGB => [
  clamp255(Math.round(mix(base[0], over[0], alpha))),
  clamp255(Math.round(mix(base[1], over[1], alpha))),
  clamp255(Math.round(mix(base[2], over[2], alpha))),
];
const falloff = (d: number, a: number, b: number): number => {
  if (d <= a) return 1;
  if (d >= b) return 0;
  const t = (d - a) / (b - a);
  return 1 - t * t * (3 - 2 * t);
};

class Board {
  w: number;
  h: number;
  data: Uint8Array;
  constructor(w: number, h: number, fill: RGB) {
    this.w = w; this.h = h;
    this.data = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.data[i * 3] = fill[0];
      this.data[i * 3 + 1] = fill[1];
      this.data[i * 3 + 2] = fill[2];
    }
  }
  at(x: number, y: number): RGB {
    const i = (y * this.w + x) * 3;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2];
  }
  put(x: number, y: number, c: RGB, alpha: number): void {
    if (alpha <= 0) return;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (alpha >= 1) { this.set(x, y, c); return; }
    this.set(x, y, blend(this.at(x, y), c, alpha));
  }
  box(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }
  boxA(x: number, y: number, w: number, h: number, c: RGB, alpha: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, c, alpha);
  }
  vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
    for (let j = 0; j < h; j++) {
      const t = h <= 1 ? 0 : j / (h - 1);
      const c: RGB = [
        Math.round(mix(top[0], bottom[0], t)),
        Math.round(mix(top[1], bottom[1], t)),
        Math.round(mix(top[2], bottom[2], t)),
      ];
      for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = cy - r; y <= cy + r; y++) {
      const dy = (y - cy) / r;
      const span = Math.sqrt(Math.max(0, 1 - dy * dy)) * r;
      for (let x = Math.ceil(cx - span); x <= Math.floor(cx + span); x++) this.set(x, y, c);
    }
  }
  discA(cx: number, cy: number, r: number, c: RGB, alpha: number): void {
    for (let y = cy - r; y <= cy + r; y++) {
      const dy = (y - cy) / r;
      const span = Math.sqrt(Math.max(0, 1 - dy * dy)) * r;
      for (let x = Math.ceil(cx - span); x <= Math.floor(cx + span); x++) this.put(x, y, c, alpha);
    }
  }
  glow(cx: number, cy: number, r: number, c: RGB, peak: number): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (d > r) continue;
        const a = peak * (1 - d / r) * (1 - d / r);
        this.put(x, y, c, a);
      }
    }
  }
  seg(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  segA(x0: number, y0: number, x1: number, y1: number, c: RGB, alpha: number, thick = 1): void {
    for (let t = 0; t < thick; t++) {
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, x = x0, y = y0 + t;
      for (;;) {
        this.put(x, y, c, alpha);
        if (x === x1 && y === y1 + t) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    }
  }
  glyph(ch: string, x: number, y: number, s: number, c: RGB): void {
    const g = GLYPHS[ch] || GLYPHS[" "];
    if (!g) return;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 8; col++) {
        if (g[row][col] === "#") this.box(x + col * s, y + row * s, s, s, c);
      }
    }
  }
  label(s: string, x: number, y: number, s2: number, c: RGB, gap?: number): number {
    const g = gap === undefined ? s2 : gap;
    let cx = x;
    for (const ch of s.toUpperCase()) {
      this.glyph(ch, cx, y, s2, c);
      cx += 8 * s2 + g;
    }
    return cx - g;
  }
  labelWidth(s: string, s2: number, gap?: number): number {
    const g = gap === undefined ? s2 : gap;
    return s.length * (8 * s2 + g) - g;
  }
}

// ---------- PNG writer (8-bit RGB, filter 0) ----------
const CRC: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v >>> 0;
  }
  return table;
})();
function crcOf(bytes: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(kind: string, payload: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length, 0);
  const body = Buffer.concat([Buffer.from(kind, "ascii"), payload]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crcOf(body), 0);
  return Buffer.concat([size, body, sum]);
}
function toPNG(b: Board): Buffer {
  const scan = Buffer.alloc(b.h * (1 + b.w * 3));
  for (let y = 0; y < b.h; y++) {
    scan[y * (1 + b.w * 3)] = 0;
    scan.set(b.data.subarray(y * b.w * 3, (y + 1) * b.w * 3), y * (1 + b.w * 3) + 1);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(b.w, 0);
  head.writeUInt32BE(b.h, 4);
  head[8] = 8; head[9] = 2; head[10] = 0; head[11] = 0; head[12] = 0;
  const packed = zlib.deflateSync(scan, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", head),
    pngChunk("IDAT", packed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- the scene: LUMARIS, where the sea glows ----------
const W = 1024, H = 1024, HORIZON = 640;
const SKY_TOP: RGB = [23, 16, 46];
const SKY_MID: RGB = [44, 35, 80];
const SKY_LOW: RGB = [58, 96, 110];
const SEA_TOP: RGB = [18, 76, 88];
const SEA_BOT: RGB = [6, 30, 38];
const GOLD: RGB = [242, 217, 160];
const GOLD_DARK: RGB = [122, 90, 32];
const AQUA: RGB = [77, 242, 208];
const AQUA_DEEP: RGB = [32, 180, 160];
const BEAM: RGB = [255, 233, 176];
const SHORE: RGB = [13, 31, 38];
const DARK: RGB = [8, 20, 26];

// shoreline control points: the glowing bay sweeps from bottom-left up to the right
const SHORE_PTS: [number, number][] = [
  [0, 905], [180, 850], [380, 800], [600, 760], [820, 735], [1024, 715],
];
function shoreY(x: number): number {
  for (let i = 0; i < SHORE_PTS.length - 1; i++) {
    const [x0, y0] = SHORE_PTS[i];
    const [x1, y1] = SHORE_PTS[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return SHORE_PTS[SHORE_PTS.length - 1][1];
}

function drawBoat(b: Board, cx: number, cy: number, s: number): void {
  // wooden hull: a small trapezoid, dark against the glowing water
  for (let dy = 0; dy < Math.round(12 * s); dy++) {
    const t = dy / (12 * s);
    const hw = (30 * s) * (1 - 0.35 * t);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      b.set(x, Math.round(cy + dy), [10, 18, 22]);
    }
  }
  // mast + warm lantern
  b.seg(cx, cy, cx, Math.round(cy - 30 * s), [16, 24, 28]);
  b.glow(cx, Math.round(cy - 32 * s), Math.round(16 * s), [255, 200, 110], 0.7);
  b.disc(cx, Math.round(cy - 32 * s), Math.max(2, Math.round(3 * s)), [255, 214, 130]);
  // lantern reflection on the water
  for (let dy = 0; dy < Math.round(26 * s); dy++) {
    const a = 0.30 * (1 - dy / (26 * s));
    b.put(cx, Math.round(cy + 13 * s + dy), [255, 200, 110], a);
  }
}

function drawPalm(b: Board, bx: number, by: number, s: number): void {
  const c: RGB = [7, 16, 21];
  // leaning trunk, thicker at the base
  b.segA(bx, by, bx + Math.round(4 * s), Math.round(by - 55 * s), c, 1, Math.max(4, Math.round(6 * s)));
  b.segA(bx + Math.round(4 * s), Math.round(by - 55 * s), bx + Math.round(14 * s), Math.round(by - 105 * s), c, 1, Math.max(3, Math.round(5 * s)));
  const tx = bx + Math.round(14 * s), ty = Math.round(by - 105 * s);
  // fronds: arcs that leave the crown sideways and droop down (no upward spikes)
  const fronds: [number, number][] = [
    [-64, 2], [-56, 18], [-32, 12], [2, 8], [30, 6], [54, 10], [60, 24], [22, 26],
  ];
  for (const [dx, dy] of fronds) {
    const mx = tx + Math.round(dx * 0.55 * s), my = ty + Math.round(dy * 0.4 * s);
    const ex = tx + Math.round(dx * s), ey = ty + Math.round(dy * s);
    b.segA(tx, ty, mx, my, c, 1, 4);
    b.segA(mx, my, ex, ey, c, 1, 4);
    b.segA(ex, ey, ex + Math.round(4 * s), ey + Math.round(20 * s), c, 1, 3);
  }
  // a few coconuts
  b.disc(tx - 4, ty + 6, 3, c);
  b.disc(tx + 4, ty + 7, 3, c);
}

function drawScene(): Board {
  const b = new Board(W, H, SKY_TOP);
  const rng = mulberry32(20261121);

  // dusk sky: violet at the top, warming to teal at the horizon
  b.vgrad(0, 0, W, 330, SKY_TOP, SKY_MID);
  b.vgrad(0, 330, W, HORIZON - 330, SKY_MID, SKY_LOW);

  // early stars (kept out of the name band so the letters stay clean)
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * 520);
    if (y > 100 && y < 250 && x > 200 && x < 824) continue;
    const v = 140 + Math.floor(rng() * 115);
    const r = rng() < 0.85 ? 1 : 2;
    b.discA(x, y, r, [v, v, Math.min(255, v + 20)], 0.9);
    if (rng() < 0.12) {
      b.segA(x - 4, y, x + 4, y, [v, v, 255], 0.5, 1);
      b.segA(x, y - 4, x, y + 4, [v, v, 255], 0.5, 1);
    }
  }

  // crescent moon, top right
  b.glow(880, 92, 90, [255, 250, 225], 0.35);
  b.disc(880, 92, 34, [255, 250, 228]);
  b.disc(896, 84, 30, SKY_TOP);

  // seabirds: small dark chevrons in the sky
  const birds: [number, number, number][] = [
    [300, 300, 10], [345, 332, 8], [700, 282, 9], [742, 312, 7], [180, 360, 8],
  ];
  for (const [bx, by, s] of birds) {
    b.segA(bx - s, by, bx, by - Math.round(s * 0.6), [26, 20, 48], 0.85, 2);
    b.segA(bx, by - Math.round(s * 0.6), bx + s, by, [26, 20, 48], 0.85, 2);
  }

  // sea: dark teal deepening toward the viewer
  b.vgrad(0, HORIZON, W, H - HORIZON, SEA_TOP, SEA_BOT);
  // faint horizontal shimmer on the water
  for (let i = 0; i < 26; i++) {
    const y = HORIZON + 12 + Math.floor(rng() * 340);
    const x0 = Math.floor(rng() * 700);
    const len = 60 + Math.floor(rng() * 200);
    const a = 0.05 + rng() * 0.08;
    b.segA(x0, y, x0 + len, y, [140, 210, 205], a, 2);
  }

  // the glowing bay: aqua light hugging the shoreline
  for (let x = 0; x < W; x++) {
    const sy = shoreY(x);
    for (let dy = -16; dy <= 4; dy++) {
      const d = Math.abs(dy + 6);
      const a = 0.5 * falloff(d, 2, 16);
      if (a > 0.01) b.put(x, Math.round(sy + dy), AQUA, a);
    }
    // bright core line right at the water's edge
    b.put(x, Math.round(sy - 2), AQUA, 0.75);
    b.put(x, Math.round(sy - 1), AQUA_DEEP, 0.5);
  }
  // scattered glow sparkles in the water just above the shore
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(rng() * W);
    const sy = shoreY(x);
    const y = Math.round(sy - 4 - rng() * 70);
    if (y < HORIZON + 4) continue;
    const a = 0.15 + rng() * 0.45;
    const r = rng() < 0.8 ? 1 : 2;
    b.discA(x, y, r, AQUA, a);
    if (rng() < 0.18) b.glow(x, y, 6, AQUA, 0.25);
  }

  // dark shore below the waterline
  for (let x = 0; x < W; x++) {
    const sy = shoreY(x);
    for (let y = Math.round(sy) + 3; y < H; y++) b.set(x, y, SHORE);
  }
  // faint wet-sand sheen along the shore
  for (let x = 0; x < W; x++) {
    const sy = shoreY(x);
    for (let dy = 4; dy < 12; dy++) b.put(x, Math.round(sy + dy), [40, 70, 76], 0.25 * (1 - dy / 12));
  }

  // cliff on the right, under the lighthouse (kept low so the tower shows)
  for (let y = 625; y <= 745; y++) {
    const t = (y - 625) / 120;
    const left = Math.round(862 + 8 * t);
    for (let x = left; x < W; x++) {
      const shade: RGB = [
        Math.round(mix(36, 20, t)),
        Math.round(mix(46, 28, t)),
        Math.round(mix(52, 34, t)),
      ];
      b.set(x, y, shade);
    }
  }
  b.segA(862, 625, 1023, 630, [96, 112, 118], 0.6, 2); // cliff top edge catching the dusk

  // lighthouse: white tower on the cliff
  for (let y = 470; y <= 610; y++) {
    const t = (y - 470) / 140;
    const hw = 20 + 8 * t;
    const cx = 905;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      // simple shading: left lit, right in shadow
      const col: RGB = u < 0.5 ? [236, 234, 224] : u < 0.78 ? [206, 203, 191] : [165, 161, 147];
      b.set(x, y, col);
    }
  }
  // two dark bands around the tower
  b.box(885, 520, 40, 10, [30, 34, 40]);
  b.box(883, 570, 44, 10, [30, 34, 40]);
  // lamp room + glowing window
  b.box(888, 446, 34, 26, [18, 24, 30]);
  b.glow(905, 459, 46, [255, 210, 130], 0.55);
  b.box(894, 452, 22, 14, [255, 216, 138]);
  // dome cap
  b.disc(905, 446, 15, [24, 30, 36]);
  b.disc(905, 442, 4, [255, 216, 138]);

  // the beam: a soft wedge sweeping left-down from the lamp across the water
  for (let y = 458; y <= 620; y++) {
    const dy = y - 458;
    const xc = 905 - 5.12 * dy;
    const half = 18 + dy * 0.30;
    for (let x = Math.floor(xc - half); x <= Math.ceil(xc + half); x++) {
      if (x < 0 || x >= W) continue;
      const across = Math.abs(x - xc) / half;
      const along = 1 - dy / 200;
      if (along <= 0) continue;
      b.put(x, y, BEAM, 0.15 * (1 - across) * along);
    }
  }
  // warm shimmer where the beam meets the water
  for (let i = 0; i < 14; i++) {
    const y = 648 + Math.floor(rng() * 90);
    const x0 = 480 + Math.floor(rng() * 220);
    const len = 40 + Math.floor(rng() * 120);
    b.segA(x0, y, x0 + len, y, [255, 220, 150], 0.10 + rng() * 0.10, 2);
  }

  // two lantern boats on the glowing bay
  drawBoat(b, 330, 828, 1);
  drawBoat(b, 620, 872, 1.25);

  // palm silhouettes on the foreground shore, bottom left
  drawPalm(b, 96, 1024, 1);
  drawPalm(b, 178, 1024, 0.8);

  // the name: large warm-gold capitals across the upper third
  const scale = 8;
  const lw = b.labelWidth("LUMARIS", scale, 16);
  const nx = Math.floor((W - lw) / 2);
  const ny = 118;
  // soft shadow behind the letters, then the gold face
  b.label("LUMARIS", nx + 3, ny + 4, scale, GOLD_DARK, 16);
  b.label("LUMARIS", nx, ny, scale, GOLD, 16);
  // thin gold rule under the name with a small diamond at its centre
  b.segA(nx + 8, ny + 96, nx + lw - 8, ny + 96, GOLD, 0.55, 2);
  const dx = Math.floor(W / 2), dy = ny + 96;
  b.seg(dx - 7, dy, dx, dy - 7, GOLD);
  b.seg(dx, dy - 7, dx + 7, dy, GOLD);
  b.seg(dx + 7, dy, dx, dy + 7, GOLD);
  b.seg(dx, dy + 7, dx - 7, dy, GOLD);

  // gentle vignette to hold the poster together
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx2 = (x - 512) / 512;
      const ny2 = (y - 512) / 512;
      const r2 = nx2 * nx2 + ny2 * ny2;
      if (r2 > 0.7) {
        const f = 1 - 0.14 * ((r2 - 0.7) / 1.3);
        const i = (y * W + x) * 3;
        b.data[i] = Math.round(b.data[i] * f);
        b.data[i + 1] = Math.round(b.data[i + 1] * f);
        b.data[i + 2] = Math.round(b.data[i + 2] * f);
      }
    }
  }

  return b;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  const board = drawScene();
  const png = toPNG(board);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
  // also leave the file in this entry directory (the repo root), guarded:
  // the grader sandbox is read-only outside /output, so a failing copy
  // must never abort the run.
  try {
    const here = path.dirname(new URL(import.meta.url).pathname);
    const local = path.join(here, "entry.png");
    if (path.resolve(local) !== path.resolve(path.join(outDir, "entry.png"))) {
      fs.writeFileSync(local, png);
    }
  } catch {
    // the /output write above already succeeded; the local copy is a nicety
  }
  console.log(`wrote entry.png ${png.length} bytes (${W}x${H})`);
}

main();
