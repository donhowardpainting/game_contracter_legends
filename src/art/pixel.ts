// Pixel-art toolkit: every texture in the game is authored here, pixel by pixel, at a
// consistent density of 16 texels per world metre.
import * as THREE from 'three';

export const PPM = 16; // texels per metre
export type RNG = () => number;

export function rng(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function parse(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function fmt(r: number, g: number, b: number) {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((1 << 24) | (cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).slice(1);
}
/** f<1 darkens (with a slight cool hue shift), f>1 lightens (slightly warm). */
export function shade(c: string, f: number): string {
  const [r, g, b] = parse(c);
  if (f <= 1) return fmt(r * f * (0.96 + 0.04 * f), g * f, b * (f + (1 - f) * 0.12));
  const t = f - 1;
  return fmt(r + (255 - r) * t, g + (250 - g) * t, b + (225 - b) * t * 0.9);
}
export function mix(a: string, b: string, t: number): string {
  const A = parse(a), B = parse(b);
  return fmt(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export function tex(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const px = (g: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

// ───────────────────────── palette ─────────────────────────
export const PAL = {
  ink: '#1d1a2b',
  white: '#f4efe2',
  cream: '#eadfc4',
  sand: '#dcc590',
  navy: '#27395c',
  teal: '#3f8f8c',
  seafoam: '#8fc7b0',
  sky: '#7fb6d9',
  red: '#b5463c',
  brick: '#a8553f',
  rust: '#9c5a35',
  mustard: '#d9a441',
  butter: '#ecd58a',
  sage: '#8fa873',
  moss: '#5c7f45',
  grass: '#6aa651',
  pine: '#2f5d43',
  plum: '#6d4a6e',
  rose: '#cf8a86',
  wood: '#a37747',
  woodDark: '#6b4a32',
  lumber: '#e0bf85',
  grey: '#8f9098',
  slate: '#56607a',
  charcoal: '#3a3b4a',
  weathered: '#8c8676',
};

/** Paint colours the player can buy and roll onto walls. */
export const PAINTS: { name: string; c: string }[] = [
  { name: 'Lighthouse White', c: '#f1ead9' },
  { name: 'Chesapeake Blue', c: '#4f7fa8' },
  { name: 'Oyster Grey', c: '#a9a99f' },
  { name: 'Crab Shack Red', c: '#b4483c' },
  { name: 'Marsh Sage', c: '#86a06c' },
  { name: 'Sunrise Butter', c: '#ecd27e' },
  { name: 'Seafoam', c: '#8cc9b4' },
  { name: 'Harbor Navy', c: '#2e456e' },
  { name: 'Cedar Stain', c: '#a8683c' },
  { name: 'Rose Hip', c: '#cf847f' },
];

// ───────────────────────── wall / roof materials ─────────────────────────
const cache = new Map<string, THREE.CanvasTexture>();
function cached(key: string, make: () => HTMLCanvasElement): THREE.CanvasTexture {
  let t = cache.get(key);
  if (!t) {
    t = tex(make());
    cache.set(key, t);
  }
  return t;
}

/** Row pattern for clapboard siding; shared with the paint system so fresh paint matches. */
export function clapRow(y: number, c: string): string {
  const r = ((y % 4) + 4) % 4;
  return r === 0 ? shade(c, 1.14) : r === 3 ? shade(c, 0.7) : r === 2 ? shade(c, 0.94) : c;
}

export function clapboard(color: string, wear = 0, seed = 1) {
  return cached(`clap${color}${wear}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 77 + 5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) px(g, x, y, clapRow(y, color));
    for (let row = 0; row < 16; row++) {
      let x = Math.floor(R() * 20);
      while (x < 64) {
        px(g, x, row * 4, shade(color, 0.78), 1, 4);
        px(g, (x + 1) % 64, row * 4 + 1, shade(color, 1.08), 1, 2);
        x += 14 + Math.floor(R() * 22);
      }
    }
    const n = Math.floor(wear * 260);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(R() * 64), y = Math.floor(R() * 64);
      const w = 1 + Math.floor(R() * 3);
      const k = R();
      px(g, x, y, k < 0.5 ? clapRow(y, PAL.weathered) : k < 0.8 ? shade(color, 0.72) : clapRow(y, '#6f6a5c'), w, 1);
    }
    for (let i = 0; i < wear * 10; i++) {
      const x = Math.floor(R() * 64), y0 = Math.floor(R() * 40), len = 6 + Math.floor(R() * 20);
      for (let y = y0; y < y0 + len; y++) if (R() < 0.8) px(g, x, y % 64, shade(clapRow(y, color), 0.74));
    }
    return c;
  });
}

export function shakes(color: string, seed = 1) {
  return cached(`shake${color}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 31 + 9);
    for (let row = 0; row < 16; row++) {
      let x = row % 2 ? -3 : 0;
      while (x < 64) {
        const w = 4 + Math.floor(R() * 4);
        const col = shade(color, 0.86 + R() * 0.26);
        px(g, x, row * 4, col, w, 4);
        px(g, x, row * 4 + 3, shade(col, 0.66), w, 1);
        px(g, x + w - 1, row * 4, shade(col, 0.74), 1, 3);
        px(g, x, row * 4, shade(col, 1.12), w - 1, 1);
        x += w;
      }
    }
    return c;
  });
}

export function roofTex(color: string, moss = 0, seed = 1) {
  return cached(`roof${color}${moss}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 13 + 3);
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? 4 : 0;
      for (let i = -1; i < 9; i++) {
        const x = i * 8 + off;
        const col = shade(color, 0.84 + R() * 0.3);
        px(g, x, row * 4, col, 8, 4);
        px(g, x, row * 4, shade(col, 1.16), 7, 1);
        px(g, x, row * 4 + 3, shade(col, 0.6), 8, 1);
        px(g, x + 7, row * 4, shade(col, 0.72), 1, 3);
        if (R() < moss) px(g, x + 1 + Math.floor(R() * 5), row * 4 + 1, R() < 0.5 ? PAL.moss : '#7d9a4e', 2 + Math.floor(R() * 3), 2);
      }
    }
    return c;
  });
}

export function brick(color = PAL.brick, seed = 1) {
  return cached(`brick${color}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 7 + 1);
    px(g, 0, 0, shade(color, 0.5), 64, 64);
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? 4 : 0;
      for (let i = -1; i < 9; i++) {
        const col = shade(color, 0.8 + R() * 0.36);
        px(g, i * 8 + off, row * 4, col, 7, 3);
        px(g, i * 8 + off, row * 4, shade(col, 1.14), 6, 1);
        if (R() < 0.12) px(g, i * 8 + off + 2, row * 4 + 1, shade(col, 0.7), 3, 1);
      }
    }
    return c;
  });
}

export function stone(color = '#8d8c8a', seed = 1) {
  return cached(`stone${color}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 5 + 2);
    px(g, 0, 0, shade(color, 0.45), 64, 64);
    for (let row = 0; row < 8; row++) {
      let x = -Math.floor(R() * 6);
      while (x < 64) {
        const w = 7 + Math.floor(R() * 8);
        const col = shade(mix(color, R() < 0.3 ? '#9a8f7a' : '#7f8794', R() * 0.5), 0.8 + R() * 0.3);
        px(g, x, row * 8, col, w - 1, 7);
        px(g, x, row * 8, shade(col, 1.16), w - 2, 1);
        px(g, x, row * 8 + 6, shade(col, 0.72), w - 1, 1);
        for (let k = 0; k < 3; k++) px(g, x + 1 + Math.floor(R() * (w - 3)), row * 8 + 2 + Math.floor(R() * 3), shade(col, R() < 0.5 ? 0.85 : 1.1));
        x += w;
      }
    }
    return c;
  });
}

export function planks(color = PAL.wood, seed = 1, plankPx = 8) {
  return cached(`plank${color}${seed}${plankPx}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 19 + 4);
    for (let row = 0; row < 64 / plankPx; row++) {
      const col = shade(color, 0.82 + R() * 0.3);
      px(g, 0, row * plankPx, col, 64, plankPx);
      px(g, 0, row * plankPx, shade(col, 1.14), 64, 1);
      px(g, 0, row * plankPx + plankPx - 1, shade(col, 0.55), 64, 1);
      for (let k = 0; k < 9; k++) {
        const x = Math.floor(R() * 64), y = row * plankPx + 1 + Math.floor(R() * (plankPx - 2));
        px(g, x, y, shade(col, R() < 0.5 ? 0.84 : 1.08), 3 + Math.floor(R() * 8), 1);
      }
      const seam = Math.floor(R() * 64);
      px(g, seam, row * plankPx, shade(col, 0.55), 1, plankPx);
      px(g, (seam + 2) % 64, row * plankPx + 2, PAL.charcoal);
      px(g, (seam + 2) % 64, row * plankPx + plankPx - 3, PAL.charcoal);
      px(g, (seam + 62) % 64, row * plankPx + 2, PAL.charcoal);
    }
    return c;
  });
}

export function rotten(seed = 1) {
  return cached(`rot${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 23 + 8);
    for (let row = 0; row < 8; row++) {
      const col = shade(mix('#5f5648', '#4b5140', R()), 0.8 + R() * 0.3);
      px(g, 0, row * 8, col, 64, 8);
      px(g, 0, row * 8 + 7, shade(col, 0.5), 64, 1);
      for (let k = 0; k < 14; k++) px(g, Math.floor(R() * 64), row * 8 + Math.floor(R() * 7), shade(col, R() < 0.6 ? 0.7 : 1.15), 2 + Math.floor(R() * 5), 1);
      for (let k = 0; k < 2; k++) {
        const x = Math.floor(R() * 60), y = row * 8 + 2 + Math.floor(R() * 3);
        px(g, x, y, '#231f24', 3, 2);
        px(g, x + 1, y - 1, '#231f24', 1, 4);
      }
      if (R() < 0.6) px(g, Math.floor(R() * 60), row * 8 + 1, '#6f8a4a', 4, 2);
    }
    return c;
  });
}

export function concrete(color = '#b4b1a8', seed = 1) {
  return cached(`conc${color}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 3 + 11);
    px(g, 0, 0, color, 64, 64);
    for (let i = 0; i < 420; i++) px(g, Math.floor(R() * 64), Math.floor(R() * 64), shade(color, R() < 0.5 ? 0.88 : 1.1), R() < 0.3 ? 2 : 1, 1);
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(R() * 64), y = Math.floor(R() * 64);
      for (let k = 0; k < 18; k++) {
        px(g, (x + 64) % 64, (y + 64) % 64, shade(color, 0.6));
        x += R() < 0.5 ? 1 : 0;
        y += R() < 0.6 ? 1 : R() < 0.5 ? -1 : 0;
      }
    }
    px(g, 0, 0, shade(color, 0.72), 64, 1);
    px(g, 0, 0, shade(color, 0.72), 1, 64);
    px(g, 0, 32, shade(color, 0.8), 64, 1);
    return c;
  });
}

export function metal(color = '#7d8f97', rust = 0.3, seed = 1) {
  return cached(`metal${color}${rust}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 41 + 6);
    for (let x = 0; x < 64; x++) {
      const k = x % 4;
      px(g, x, 0, shade(color, k === 0 ? 1.2 : k === 1 ? 1 : k === 2 ? 0.8 : 0.62), 1, 64);
    }
    for (let i = 0; i < rust * 40; i++) {
      const x = Math.floor(R() * 64), y = Math.floor(R() * 64), len = 3 + Math.floor(R() * 14);
      for (let j = 0; j < len; j++) {
        px(g, x, (y + j) % 64, mix(PAL.rust, '#5e3520', R()), 1 + Math.floor(R() * 2), 1);
      }
    }
    px(g, 0, 31, shade(color, 0.5), 64, 1);
    for (let x = 2; x < 64; x += 8) px(g, x, 29, shade(color, 0.45));
    return c;
  });
}

export function stucco(color = PAL.cream, seed = 1) {
  return cached(`stucco${color}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 29 + 12);
    px(g, 0, 0, color, 64, 64);
    for (let i = 0; i < 500; i++) px(g, Math.floor(R() * 64), Math.floor(R() * 64), shade(color, R() < 0.5 ? 0.92 : 1.08), 1 + Math.floor(R() * 2), 1);
    return c;
  });
}

export function flat(color: string) {
  return cached(`flat${color}`, () => {
    const [c, g] = mkCanvas(8, 8);
    px(g, 0, 0, color, 8, 8);
    return c;
  });
}

export function leaves(color = '#4f8f46', seed = 1) {
  return cached(`leaf${color}${seed}`, () => {
    const [c, g] = mkCanvas(64, 64);
    const R = rng(seed * 53 + 14);
    px(g, 0, 0, shade(color, 0.72), 64, 64);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(R() * 64), y = Math.floor(R() * 64), k = R();
      const col = k < 0.35 ? shade(color, 0.56) : k < 0.75 ? color : shade(color, 1.22);
      px(g, x, y, col, 3, 2);
      px(g, x + 1, y - 1, col, 2, 1);
      px(g, x + 1, y + 2, shade(col, 0.8), 1, 1);
    }
    return c;
  });
}

export function bark(color = '#6a4b35') {
  return cached(`bark${color}`, () => {
    const [c, g] = mkCanvas(32, 32);
    const R = rng(88);
    px(g, 0, 0, color, 32, 32);
    for (let x = 0; x < 32; x++) {
      const k = R();
      if (k < 0.45) for (let y = 0; y < 32; y++) if (R() < 0.8) px(g, x, y, shade(color, k < 0.25 ? 0.68 : 1.18));
    }
    return c;
  });
}

export function rock(seed = 1) {
  return cached(`rock${seed}`, () => {
    const [c, g] = mkCanvas(32, 32);
    const R = rng(seed * 61);
    px(g, 0, 0, '#7e7f86', 32, 32);
    for (let i = 0; i < 90; i++) px(g, Math.floor(R() * 32), Math.floor(R() * 32), shade('#7e7f86', 0.7 + R() * 0.55), 2 + Math.floor(R() * 4), 1 + Math.floor(R() * 2));
    return c;
  });
}

// ───────────────────────── windows, doors, signs ─────────────────────────
export function windowTex(kind: 'day' | 'lit' | 'dead', w = 16, h = 20, seed = 1): HTMLCanvasElement {
  const [c, g] = mkCanvas(w, h);
  const R = rng(seed * 97 + w);
  const frame = kind === 'dead' ? '#6c665a' : PAL.white;
  px(g, 0, 0, frame, w, h);
  const iw = w - 4, ih = h - 4;
  for (let y = 0; y < ih; y++)
    for (let x = 0; x < iw; x++) {
      let col: string;
      if (kind === 'lit') {
        col = mix('#ffd98a', '#f6a94e', y / ih);
        if (x < 2 || x >= iw - 2) col = mix(col, '#c9685a', 0.55); // curtains
      } else if (kind === 'dead') {
        col = R() < 0.12 ? '#3a3f48' : '#1b1c26';
      } else {
        col = mix('#35506e', '#5f87a6', y / ih);
        if ((x + y) % 9 < 2 && x > 1) col = mix(col, '#cfe6f0', 0.55);
        if (x < 2 || x >= iw - 2) col = mix(col, '#e8dcc6', 0.5);
      }
      px(g, x + 2, y + 2, col);
    }
  px(g, 2, 2 + Math.floor(ih / 2), frame, iw, 1);
  px(g, Math.floor(w / 2), 2, frame, 1, ih);
  if (kind === 'dead') {
    // boards nailed across
    for (let k = 0; k < 2; k++) {
      const y = 4 + k * Math.floor(h / 2.4) + Math.floor(R() * 2);
      px(g, 0, y, '#8a7350', w, 3);
      px(g, 0, y + 2, '#5d4a32', w, 1);
      px(g, 1, y + 1, PAL.ink);
      px(g, w - 2, y + 1, PAL.ink);
    }
  } else {
    px(g, 0, h - 2, shade(frame, 0.8), w, 2);
    px(g, 0, 0, shade(frame, 1.1), w, 1);
  }
  return c;
}

export function doorTex(color: string, dead = false): HTMLCanvasElement {
  const [c, g] = mkCanvas(18, 34);
  px(g, 0, 0, dead ? '#6c665a' : PAL.white, 18, 34);
  px(g, 2, 2, color, 14, 32);
  px(g, 2, 2, shade(color, 1.2), 14, 1);
  px(g, 15, 2, shade(color, 0.7), 1, 32);
  for (const [x, y, w, h] of [[4, 5, 4, 9], [10, 5, 4, 9], [4, 17, 4, 12], [10, 17, 4, 12]] as number[][]) {
    px(g, x, y, shade(color, 0.74), w, h);
    px(g, x + 1, y + 1, shade(color, 0.92), w - 1, h - 1);
  }
  if (!dead) {
    px(g, 4, 5, '#5f87a6', 4, 9);
    px(g, 10, 5, '#5f87a6', 4, 9);
    px(g, 5, 6, '#cfe6f0', 1, 3);
    px(g, 11, 6, '#cfe6f0', 1, 3);
  }
  px(g, 13, 18, '#e2c15a', 1, 2);
  if (dead) {
    px(g, 0, 12, '#8a7350', 18, 3);
    px(g, 0, 22, '#8a7350', 18, 3);
    px(g, 0, 14, '#5d4a32', 18, 1);
    px(g, 0, 24, '#5d4a32', 18, 1);
  }
  return c;
}

/** A painted wooden sign with pixel lettering. */
export function signTex(text: string, bg = PAL.navy, fg = PAL.cream, w = 96, h = 20, weathered = false): HTMLCanvasElement {
  const [c, g] = mkCanvas(w, h);
  px(g, 0, 0, shade(bg, 0.6), w, h);
  px(g, 1, 1, bg, w - 2, h - 2);
  px(g, 1, 1, shade(bg, 1.15), w - 2, 1);
  g.fillStyle = fg;
  g.font = `${h >= 20 ? 8 : 8}px Silkscreen, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + 1 + (i - (lines.length - 1) / 2) * 9));
  // snap antialiased text to hard pixels
  const d = g.getImageData(0, 0, w, h);
  const B = parse(bg), F = parse(fg);
  for (let i = 0; i < d.data.length; i += 4) {
    const dr = Math.abs(d.data[i] - F[0]) + Math.abs(d.data[i + 1] - F[1]) + Math.abs(d.data[i + 2] - F[2]);
    const db = Math.abs(d.data[i] - B[0]) + Math.abs(d.data[i + 1] - B[1]) + Math.abs(d.data[i + 2] - B[2]);
    const y = Math.floor(i / 4 / w), x = (i / 4) % w;
    if (x > 1 && x < w - 2 && y > 1 && y < h - 2) {
      const on = dr < db;
      d.data[i] = on ? F[0] : B[0];
      d.data[i + 1] = on ? F[1] : B[1];
      d.data[i + 2] = on ? F[2] : B[2];
    }
  }
  g.putImageData(d, 0, 0);
  if (weathered) {
    const R = rng(text.length * 7);
    for (let i = 0; i < w * h * 0.12; i++) px(g, Math.floor(R() * w), Math.floor(R() * h), R() < 0.5 ? PAL.weathered : shade(bg, 0.7), 2, 1);
  }
  return c;
}

// ───────────────────────── ground atlas ─────────────────────────
export const TILE = {
  grass: 0, // 0..3 variants
  flowers: 4, // 4..5
  dirt: 6, // 6..7
  road: 8, // 8..9
  roadLineH: 10,
  roadLineV: 11,
  sidewalk: 12,
  sand: 13, // 13..14
  planks: 15,
  cobble: 16,
  gravel: 17, // 17..18
  forest: 19, // 19..20
  marsh: 21,
  seabed: 22,
  path: 23,
  garden: 24,
  crosswalkH: 25,
  crosswalkV: 26,
  rubble: 27,
  floor: 28,
  tallgrass: 29,
};
export const ATLAS_COLS = 8, ATLAS_ROWS = 4;

export function groundAtlas(): THREE.CanvasTexture {
  const [c, g] = mkCanvas(ATLAS_COLS * 16, ATLAS_ROWS * 16);
  const R = rng(4242);
  const tile = (i: number, fn: (o: (x: number, y: number, col: string, w?: number, h?: number) => void) => void) => {
    const ox = (i % ATLAS_COLS) * 16, oy = Math.floor(i / ATLAS_COLS) * 16;
    g.save();
    g.beginPath();
    g.rect(ox, oy, 16, 16);
    g.clip();
    fn((x, y, col, w = 1, h = 1) => px(g, ox + ((x + 16) % 16), oy + ((y + 16) % 16), col, w, h));
    g.restore();
  };
  const speck = (o: any, base: string, n: number, lo = 0.86, hi = 1.12, w = 2) => {
    o(0, 0, base, 16, 16);
    for (let k = 0; k < n; k++) o(Math.floor(R() * 16), Math.floor(R() * 16), shade(base, R() < 0.5 ? lo : hi), 1 + Math.floor(R() * w), 1);
  };
  const G = '#69a552', Gd = '#538c45', Gl = '#84bd5e', Gy = '#9bc965';
  const grass = (o: any, extra: number) => {
    o(0, 0, G, 16, 16);
    for (let k = 0; k < 16 + extra; k++) {
      const x = Math.floor(R() * 16), y = Math.floor(R() * 16), t = R();
      if (t < 0.4) { o(x, y, Gd); o(x, y - 1, Gd); o(x + 1, y, Gd); }
      else if (t < 0.8) { o(x, y, Gl); o(x + 1, y - 1, Gl); }
      else { o(x, y, Gy); o(x, y - 1, Gy); }
    }
  };
  for (let v = 0; v < 4; v++) tile(TILE.grass + v, (o) => grass(o, v * 4));
  for (let v = 0; v < 2; v++)
    tile(TILE.flowers + v, (o) => {
      grass(o, 4);
      const cols = v ? ['#f4efe2', '#f0d264'] : ['#e58fa0', '#f4efe2', '#b99ae0'];
      for (let k = 0; k < 5; k++) {
        const x = 1 + Math.floor(R() * 13), y = 2 + Math.floor(R() * 12), col = cols[Math.floor(R() * cols.length)];
        o(x, y, col); o(x + 1, y, shade(col, 0.85)); o(x, y - 1, shade(col, 1.15)); o(x, y + 1, Gd);
      }
    });
  for (let v = 0; v < 2; v++) tile(TILE.dirt + v, (o) => { speck(o, '#9b7a55', 34, 0.84, 1.12, 3); for (let k = 0; k < 3; k++) o(Math.floor(R() * 15), Math.floor(R() * 15), '#7c6b5e', 2, 1); });
  for (let v = 0; v < 2; v++) tile(TILE.road + v, (o) => { speck(o, '#595b68', 26, 0.88, 1.14, 2); if (v) { let x = 3, y = 0; for (let k = 0; k < 9; k++) { o(x, y, '#44465a'); y += 1; x += R() < 0.4 ? 1 : 0; } } });
  tile(TILE.roadLineH, (o) => { speck(o, '#595b68', 20, 0.88, 1.14, 2); o(2, 7, '#e3c765', 11, 2); o(2, 8, '#bfa24b', 11, 1); });
  tile(TILE.roadLineV, (o) => { speck(o, '#595b68', 20, 0.88, 1.14, 2); o(7, 2, '#e3c765', 2, 11); o(8, 2, '#bfa24b', 1, 11); });
  tile(TILE.sidewalk, (o) => { speck(o, '#b9b4a6', 18, 0.92, 1.07, 2); o(0, 0, '#8f8a80', 16, 1); o(0, 0, '#8f8a80', 1, 16); o(1, 1, '#cdc8ba', 15, 1); });
  for (let v = 0; v < 2; v++) tile(TILE.sand + v, (o) => { speck(o, '#dcc793', 26, 0.9, 1.08, 3); if (v) { o(4, 9, '#f4efe2', 2, 1); o(11, 4, '#b79f74', 2, 1); o(5, 10, '#b79f74'); } });
  tile(TILE.planks, (o) => {
    for (let r = 0; r < 4; r++) {
      const col = shade('#a98458', 0.86 + R() * 0.24);
      o(0, r * 4, col, 16, 4); o(0, r * 4, shade(col, 1.14), 16, 1); o(0, r * 4 + 3, shade(col, 0.55), 16, 1);
      o(Math.floor(R() * 12), r * 4 + 1, shade(col, 0.82), 5, 1);
      const s = Math.floor(R() * 16); o(s, r * 4, shade(col, 0.55), 1, 4); o(s + 1, r * 4 + 1, PAL.charcoal);
    }
  });
  tile(TILE.cobble, (o) => {
    o(0, 0, '#6f6a66', 16, 16);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      const col = shade(mix('#a9a195', '#9aa0a8', R()), 0.86 + R() * 0.24), ox = q * 4 + (r % 2 ? 2 : 0);
      o(ox, r * 4, col, 3, 3); o(ox, r * 4, shade(col, 1.15), 2, 1);
    }
  });
  for (let v = 0; v < 2; v++) tile(TILE.gravel + v, (o) => { o(0, 0, '#9d968a', 16, 16); for (let k = 0; k < 40; k++) { const col = shade(mix('#b3ab9c', '#8a8a90', R()), 0.8 + R() * 0.4); o(Math.floor(R() * 16), Math.floor(R() * 16), col, R() < 0.4 ? 2 : 1, 1); } });
  for (let v = 0; v < 2; v++) tile(TILE.forest + v, (o) => { speck(o, '#55733f', 30, 0.8, 1.14, 3); for (let k = 0; k < 4 + v * 3; k++) { const x = Math.floor(R() * 15), y = Math.floor(R() * 15); o(x, y, R() < 0.5 ? '#8a6a3c' : '#b58a43', 2, 1); } o(3, 12, '#3f5a33', 3, 1); });
  tile(TILE.marsh, (o) => { speck(o, '#7d8f4f', 30, 0.82, 1.15, 2); for (let k = 0; k < 6; k++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16); o(x, y, '#b9b267'); o(x, y - 1, '#b9b267'); o(x, y - 2, '#d6cd86'); } });
  tile(TILE.seabed, (o) => speck(o, '#6f8d86', 22, 0.86, 1.1, 3));
  tile(TILE.path, (o) => { speck(o, '#b39a6b', 28, 0.87, 1.1, 3); o(2, 3, '#8f8a80', 2, 1); o(11, 12, '#8f8a80', 2, 1); o(0, 0, Gd); o(15, 8, G); o(7, 15, Gd); });
  tile(TILE.garden, (o) => { for (let r = 0; r < 4; r++) { o(0, r * 4, '#6b4c36', 16, 2); o(0, r * 4 + 2, '#553a2a', 16, 2); for (let k = 0; k < 4; k++) { const x = k * 4 + 1; o(x, r * 4, '#5f9a48'); o(x + 1, r * 4 - 1, '#84bd5e'); } } });
  tile(TILE.crosswalkH, (o) => { speck(o, '#595b68', 14, 0.9, 1.1, 2); for (let x = 1; x < 16; x += 4) o(x, 0, '#d9d5c8', 2, 16); });
  tile(TILE.crosswalkV, (o) => { speck(o, '#595b68', 14, 0.9, 1.1, 2); for (let y = 1; y < 16; y += 4) o(0, y, '#d9d5c8', 16, 2); });
  tile(TILE.rubble, (o) => { speck(o, '#8f887b', 30, 0.75, 1.15, 3); for (let k = 0; k < 6; k++) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); o(x, y, '#5d5a58', 3, 2); o(x, y, '#aaa59a', 2, 1); } });
  tile(TILE.floor, (o) => { for (let r = 0; r < 4; r++) { const col = shade('#b98e5e', 0.9 + R() * 0.16); o(0, r * 4, col, 16, 4); o(0, r * 4 + 3, shade(col, 0.72), 16, 1); o((r * 7) % 16, r * 4, shade(col, 0.72), 1, 4); } });
  tile(TILE.tallgrass, (o) => { o(0, 0, Gd, 16, 16); for (let k = 0; k < 30; k++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16), col = R() < 0.5 ? G : R() < 0.5 ? Gl : '#467a3d'; o(x, y, col); o(x, y - 1, col); o(x, y - 2, shade(col, 1.12)); } });
  const t = tex(c, false);
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// ───────────────────────── icons (UI) ─────────────────────────
const iconCache = new Map<string, string>();
/** 16×16 pixel icons, returned as data URLs for the HUD. */
export function icon(name: string): string {
  if (iconCache.has(name)) return iconCache.get(name)!;
  const [c, g] = mkCanvas(16, 16);
  const o = (x: number, y: number, col: string, w = 1, h = 1) => px(g, x, y, col, w, h);
  const W = PAL.wood, Wd = PAL.woodDark, S = '#aeb4bd', Sd = '#6d7482', I = PAL.ink;
  const diag = (x0: number, y0: number, n: number, col: string, dx = 1, dy = 1, t = 2) => { for (let k = 0; k < n; k++) o(x0 + k * dx, y0 + k * dy, col, t, t); };
  switch (name) {
    case 'hands': o(5, 4, '#e8b78e', 6, 8); o(4, 6, '#e8b78e', 1, 4); o(11, 7, '#e8b78e', 1, 3); o(6, 2, '#e8b78e', 1, 2); o(8, 2, '#e8b78e', 1, 2); o(10, 3, '#e8b78e', 1, 2); o(5, 11, '#c98e68', 6, 1); break;
    case 'hammer': diag(3, 12, 8, W, 1, -1); diag(4, 13, 8, Wd, 1, -1, 1); o(8, 2, S, 6, 4); o(7, 3, Sd, 1, 3); o(13, 5, Sd, 2, 2); o(8, 2, '#d7dce3', 5, 1); break;
    case 'nailgun': o(2, 4, '#d9a441', 10, 4); o(2, 4, '#f0c766', 10, 1); o(12, 5, Sd, 3, 2); o(4, 8, '#3a3b4a', 3, 6); o(8, 8, Sd, 2, 4); o(2, 3, '#b5463c', 3, 1); break;
    case 'brush': diag(9, 2, 5, W, 1, 1); o(4, 7, S, 5, 2); o(3, 9, '#ecd58a', 6, 5); o(3, 12, '#4f7fa8', 6, 2); o(4, 14, '#4f7fa8', 1, 1); break;
    case 'roller': o(2, 2, '#f1ead9', 10, 4); o(2, 5, '#4f7fa8', 10, 1); o(12, 3, Sd, 2, 1); o(13, 3, Sd, 1, 5); o(8, 8, Sd, 6, 1); o(8, 8, Sd, 1, 2); o(7, 10, '#b5463c', 3, 5); break;
    case 'sprayer': o(3, 5, '#b5463c', 8, 4); o(11, 6, Sd, 3, 2); o(14, 5, S, 1, 4); o(5, 9, '#3a3b4a', 3, 5); o(4, 2, S, 4, 3); o(1, 4, '#8cc9b4'); o(0, 7, '#8cc9b4'); o(1, 9, '#8cc9b4'); break;
    case 'sledge': diag(2, 13, 9, W, 1, -1); o(9, 1, Sd, 6, 6); o(9, 1, S, 6, 2); o(9, 6, '#4b505c', 6, 1); break;
    case 'handsaw': for (let k = 0; k < 9; k++) { o(2 + k, 5 + Math.floor(k / 3), S, 1, 5 - Math.floor(k / 3)); if (k % 2) o(2 + k, 10, Sd); } o(11, 5, W, 4, 6); o(12, 7, I, 2, 2); break;
    case 'circsaw': o(4, 5, S, 8, 8); o(3, 7, S, 10, 4); o(6, 4, S, 4, 10); o(7, 8, Sd, 2, 2); o(3, 2, '#d9a441', 9, 4); o(11, 3, '#3a3b4a', 3, 3); o(3, 5, Sd); o(12, 12, Sd); o(3, 12, Sd); break;
    case 'washer': o(1, 9, '#d9a441', 7, 5); o(2, 14, I, 2, 1); o(6, 14, I, 2, 1); o(3, 7, '#3a3b4a', 3, 2); diag(7, 8, 6, Sd, 1, -1, 1); o(13, 2, S, 2, 2); o(15, 0, '#8ed0e8'); o(14, 0, '#8ed0e8'); o(15, 2, '#8ed0e8'); break;
    case 'lumber': o(1, 9, PAL.lumber, 14, 3); o(1, 5, shade(PAL.lumber, 0.9), 14, 3); o(3, 1, PAL.lumber, 10, 3); o(1, 12, Wd, 14, 1); o(1, 8, Wd, 14, 1); o(3, 4, Wd, 10, 1); o(12, 10, Wd); o(5, 6, Wd); break;
    case 'nails': for (const x of [3, 7, 11]) { o(x - 1, 3, S, 3, 1); o(x, 4, Sd, 1, 9); o(x, 13, I); } break;
    case 'paint': o(3, 5, S, 10, 9); o(3, 5, '#d7dce3', 10, 1); o(4, 8, '#4f7fa8', 8, 3); o(2, 4, Sd, 12, 1); o(6, 2, Sd, 4, 1); o(5, 3, Sd); o(10, 3, Sd); o(11, 6, '#4f7fa8', 1, 5); break;
    case 'concrete': o(3, 3, '#b8ad96', 10, 11); o(3, 3, '#d1c7b2', 10, 1); o(5, 6, '#8f887b', 6, 4); o(4, 2, '#8a7350', 8, 1); o(3, 13, '#8f887b', 10, 1); break;
    case 'bulb': o(5, 2, '#ffe08a', 6, 7); o(6, 1, '#ffe08a', 4, 1); o(6, 9, '#ffe08a', 4, 1); o(6, 3, '#fff6cf', 2, 2); o(6, 10, S, 4, 3); o(7, 13, Sd, 2, 1); break;
    case 'coin': o(4, 2, '#e2c15a', 8, 12); o(3, 4, '#e2c15a', 10, 8); o(5, 3, '#f6e39a', 5, 1); o(7, 5, '#a8862f', 2, 6); o(6, 6, '#a8862f', 4, 1); o(6, 9, '#a8862f', 4, 1); break;
    case 'star': o(7, 1, '#f0d264', 2, 5); o(2, 6, '#f0d264', 12, 3); o(4, 9, '#f0d264', 8, 2); o(3, 11, '#f0d264', 3, 3); o(10, 11, '#f0d264', 3, 3); o(7, 2, '#fff2b0', 1, 3); break;
    case 'heart': o(2, 4, '#cf5a5a', 5, 5); o(9, 4, '#cf5a5a', 5, 5); o(3, 3, '#cf5a5a', 3, 1); o(10, 3, '#cf5a5a', 3, 1); o(3, 9, '#cf5a5a', 10, 2); o(5, 11, '#cf5a5a', 6, 2); o(7, 13, '#cf5a5a', 2, 1); o(3, 5, '#f0a0a0', 2, 2); break;
    case 'key': o(2, 5, '#e2c15a', 5, 6); o(3, 7, I, 3, 2); o(7, 7, '#e2c15a', 8, 2); o(11, 9, '#e2c15a', 1, 2); o(13, 9, '#e2c15a', 1, 3); break;
    case 'doc': o(3, 1, PAL.cream, 10, 14); o(3, 1, '#fff', 10, 1); for (let y = 4; y < 13; y += 2) o(5, y, '#8a7350', 6, 1); o(10, 11, PAL.red, 2, 2); break;
    case 'truck': o(1, 6, PAL.teal, 9, 5); o(10, 4, PAL.teal, 5, 7); o(11, 5, '#cfe6f0', 3, 3); o(1, 11, Sd, 14, 1); o(3, 11, I, 3, 3); o(10, 11, I, 3, 3); break;
    case 'skid': o(3, 3, '#d9a441', 7, 8); o(4, 4, '#3a3b4a', 4, 4); o(10, 8, Sd, 3, 1); o(12, 8, Sd, 3, 4); o(2, 11, I, 9, 3); break;
    default: o(4, 4, PAL.grey, 8, 8);
  }
  // 1px outline
  const d = g.getImageData(0, 0, 16, 16), src = new Uint8ClampedArray(d.data);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : src[(y * 16 + x) * 4 + 3]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) { const i = (y * 16 + x) * 4; d.data[i] = 29; d.data[i + 1] = 26; d.data[i + 2] = 43; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const url = c.toDataURL();
  iconCache.set(name, url);
  return url;
}

/** Soft radial gradient (used for contact shadows and light pools — the only non-pixel textures). */
export function radialTex(inner: string, outer: string, size = 64): THREE.CanvasTexture {
  const [c, g] = mkCanvas(size, size);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
