// Character sprite pipeline. Every character is painted procedurally into a 24×32 frame
// sheet (4 directions × 8 frames: idle×2, walk×4, work×2) from a compact CharSpec, then
// shown on a camera-facing plane with nearest-neighbour filtering and alpha-tested depth
// so sprites sort and occlude correctly inside the 3D world.
import * as THREE from 'three';
import { mkCanvas, shade, PAL, radialTex } from './pixel';

export const FW = 24, FH = 32, COLS = 8, ROWS = 4;
export const SPR_PPM = 15;
export type Dir = 0 | 1 | 2 | 3; // down, left, right, up
export type Anim = 'idle' | 'walk' | 'work';
export type ToolLook = 'none' | 'hammer' | 'roller' | 'sledge' | 'saw' | 'washer' | 'nailgun';

export interface CharSpec {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'pony' | 'curly';
  hat?: 'cap' | 'hardhat' | 'beanie' | 'captain';
  hatColor?: string;
  shirt: string;
  style: 'tee' | 'flannel' | 'overalls' | 'apron' | 'suit' | 'vest' | 'dress';
  accent?: string;
  pants: string;
  shoes?: string;
  beard?: string;
  glasses?: boolean;
  kid?: boolean;
  tool?: ToolLook;
  toolColor?: string;
}

const EYE = '#241d2e';

function paintFrame(spec: CharSpec, dir: Dir, col: number): (string | null)[] {
  const buf: (string | null)[] = new Array(FW * FH).fill(null);
  const flip = dir === 2;
  const P = (x: number, y: number, c: string | null) => {
    if (flip) x = FW - 1 - x;
    if (x >= 0 && x < FW && y >= 0 && y < FH) buf[y * FW + x] = c;
  };
  const R = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c);
  };
  /** rect with built-in light (top-left) and shadow (right / bottom) */
  const S = (x: number, y: number, w: number, h: number, c: string) => {
    R(x, y, w, h, c);
    if (w > 2) R(x + w - 1, y, 1, h, shade(c, 0.78));
    if (h > 3) R(x, y + h - 1, w, 1, shade(c, 0.78));
  };

  const walk = col >= 2 && col <= 5 ? col - 2 : -1;
  const work = col >= 6 ? col - 6 : -1;
  const bob = col === 1 || walk === 0 || walk === 2 ? 1 : 0;
  const legLen = spec.kid ? 4 : 6;
  const torsoH = spec.kid ? 7 : 9;
  const legTop = 29 - legLen;
  const tTop = legTop - torsoH + bob;
  const hTop = tTop - 10;
  const shoes = spec.shoes ?? '#4a3b33';
  const skin = spec.skin, skinD = shade(skin, 0.8);
  const longSleeve = spec.style === 'flannel' || spec.style === 'suit' || spec.style === 'overalls';
  const shirt = spec.shirt, pants = spec.pants, acc = spec.accent ?? PAL.white;
  const dress = spec.style === 'dress';
  const side = dir === 1 || dir === 2;
  const back = dir === 3;

  // ── legs ──
  const leg = (x: number, lift: number, dark: boolean, w = 3) => {
    const c = dress ? skin : dark ? shade(pants, 0.78) : pants;
    R(x, legTop, w, legLen - lift, c);
    if (!dress) R(x + w - 1, legTop, 1, legLen - lift, shade(c, 0.8));
    R(x, 29 - lift, w, 2, dark ? shade(shoes, 0.8) : shoes);
    if (side) P(x - 1, 30 - lift, dark ? shade(shoes, 0.8) : shoes);
  };
  if (!side) {
    const l = walk === 0 ? 0 : walk === 2 ? 2 : 0, r = walk === 2 ? 0 : walk === 0 ? 2 : 0;
    leg(8, l, walk === 2);
    leg(13, r, walk === 0);
    R(11, legTop, 2, 2, dress ? shirt : shade(pants, 0.86));
  } else if (walk === 0 || walk === 2) {
    leg(13, 1, walk === 0);
    leg(8, 0, walk === 2);
    R(10, legTop, 4, 2, pants);
  } else {
    leg(11, walk >= 0 ? 1 : 0, true, 3);
    leg(9, 0, false, 3);
  }

  // ── torso ──
  const tx = side ? 9 : 8, tw = side ? 6 : 8, th = legTop - tTop;
  S(tx, tTop, tw, th, shirt);
  if (spec.style === 'flannel') {
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if ((x + y) % 3 === 0) P(tx + x, tTop + y, shade(shirt, 0.72));
    if (!side && !back) R(11, tTop, 1, th, shade(shirt, 0.6));
  }
  if (spec.style === 'overalls') {
    R(tx + 1, tTop + 3, tw - 2, th - 3, pants);
    P(tx + 1, tTop + 1, pants); P(tx + 1, tTop + 2, pants);
    P(tx + tw - 2, tTop + 1, pants); P(tx + tw - 2, tTop + 2, pants);
    if (!back && !side) { P(tx + 1, tTop + 3, acc); P(tx + tw - 2, tTop + 3, acc); }
  }
  if (spec.style === 'suit' && !back) {
    if (!side) { R(11, tTop, 2, 4, PAL.white); R(11, tTop + 1, 1, 4, acc); P(10, tTop, shade(shirt, 1.25)); P(13, tTop, shade(shirt, 1.25)); }
    else { R(tx, tTop, 1, 4, PAL.white); P(tx, tTop + 2, acc); }
  }
  if (spec.style === 'vest') {
    R(tx, tTop, side ? tw : 3, th - 1, acc);
    if (!side) R(tx + tw - 3, tTop, 3, th - 1, acc);
    R(tx, tTop + 4, tw, 1, '#e8e6da');
    if (back) R(tx, tTop, tw, th - 1, acc), R(tx, tTop + 4, tw, 1, '#e8e6da');
  }
  if (spec.style === 'apron' && !back) {
    R(tx + 1, tTop + 2, tw - 2, th + 2, acc);
    R(tx + 1, tTop + th + 1, tw - 2, 1, shade(acc, 0.8));
    P(tx + 1, tTop + 1, acc); P(tx + tw - 2, tTop + 1, acc);
  }
  if (dress) {
    R(tx - 1, legTop - 1, tw + 2, 3, shirt);
    R(tx - 1, legTop + 1, tw + 2, 1, shade(shirt, 0.78));
    R(tx, tTop + 3, tw, 1, acc);
  }
  if (!dress && !side) R(tx, legTop - 1, tw, 1, shade(pants, 0.7)); // belt line

  // ── head ──
  const hx = 7, hw = 10;
  R(hx, hTop, hw, 10, skin);
  P(hx, hTop, null); P(hx + hw - 1, hTop, null); P(hx, hTop + 9, null); P(hx + hw - 1, hTop + 9, null);
  R(hx + hw - 1, hTop + 1, 1, 8, skinD);
  R(hx + 1, hTop + 9, hw - 2, 1, skinD);
  const hair = spec.hair, hairL = shade(hair, 1.25), hairD = shade(hair, 0.72);
  const bald = spec.hairStyle === 'bald';
  if (back) {
    if (!bald) {
      R(hx, hTop, hw, 8, hair); P(hx, hTop, null); P(hx + hw - 1, hTop, null);
      R(hx + hw - 1, hTop + 1, 1, 7, hairD); R(hx + 2, hTop + 1, 3, 1, hairL);
      R(hx + 1, hTop + 8, hw - 2, 1, hairD);
    } else { R(hx, hTop + 4, hw, 3, hair); }
    if (spec.hairStyle === 'long') { R(hx, hTop + 8, hw, 5, hair); R(hx + hw - 1, hTop + 8, 1, 5, hairD); }
    if (spec.hairStyle === 'pony') { R(11, hTop + 7, 2, 6, hair); P(11, hTop + 6, acc); P(12, hTop + 6, acc); }
    if (spec.hairStyle === 'curly') { R(hx - 1, hTop + 1, 1, 6, hair); R(hx + hw, hTop + 1, 1, 6, hairD); R(hx + 1, hTop - 1, hw - 2, 1, hair); }
  } else if (side) {
    // facing left: face on the low-x side
    P(hx, hTop + 5, skin); P(hx - 1, hTop + 6, skin); // nose
    R(hx + 2, hTop + 4, 1, 2, EYE);
    P(hx + 2, hTop + 3, shade(hair, 0.6));
    P(hx + 3, hTop + 7, shade(skin, 0.9));
    if (!bald) {
      R(hx, hTop, hw, 3, hair); P(hx, hTop, null); P(hx + hw - 1, hTop, null);
      R(hx + 5, hTop + 3, 5, 5, hair); R(hx + 7, hTop + 8, 3, 1, hairD);
      R(hx + 1, hTop + 1, 4, 1, hairL); R(hx + hw - 1, hTop + 1, 1, 7, hairD);
      P(hx + 5, hTop + 5, skinD); // ear
    } else { R(hx + 6, hTop + 3, 4, 3, hair); P(hx + 5, hTop + 5, skinD); }
    if (spec.hairStyle === 'long') R(hx + 6, hTop + 8, 4, 6, hair), R(hx + 9, hTop + 8, 1, 6, hairD);
    if (spec.hairStyle === 'pony') { R(hx + hw, hTop + 3, 2, 2, hair); R(hx + hw + 1, hTop + 5, 2, 5, hair); P(hx + hw, hTop + 3, acc); }
    if (spec.hairStyle === 'bun') R(hx + hw - 1, hTop + 2, 3, 3, hair), P(hx + hw + 1, hTop + 4, hairD);
    if (spec.hairStyle === 'curly') { R(hx + 1, hTop - 1, hw - 2, 1, hair); R(hx + hw, hTop + 1, 1, 7, hairD); }
    if (spec.beard) { R(hx, hTop + 7, 6, 3, spec.beard); P(hx, hTop + 9, null); R(hx - 1, hTop + 8, 1, 1, spec.beard); }
    if (spec.glasses) { R(hx + 1, hTop + 3, 3, 1, EYE); P(hx + 1, hTop + 4, '#bfe3ee'); R(hx + 4, hTop + 4, 3, 1, EYE); }
  } else {
    R(hx + 2, hTop + 5, 1, 2, EYE); R(hx + 7, hTop + 5, 1, 2, EYE);
    P(hx + 1, hTop + 7, shade(skin, 0.92)); P(hx + 8, hTop + 7, shade(skin, 0.86));
    R(hx + 4, hTop + 8, 2, 1, shade(skin, 0.7));
    if (!bald) {
      R(hx, hTop, hw, 3, hair); P(hx, hTop, null); P(hx + hw - 1, hTop, null);
      R(hx, hTop + 3, 1, 3, hair); R(hx + hw - 1, hTop + 3, 1, 3, hairD);
      R(hx + 1, hTop + 3, 2, 1, hair); R(hx + 6, hTop + 3, 3, 1, hair); P(hx + 4, hTop + 3, hair);
      R(hx + 2, hTop + 1, 4, 1, hairL);
    } else { R(hx, hTop + 3, 1, 3, hair); R(hx + hw - 1, hTop + 3, 1, 3, hair); }
    if (spec.hairStyle === 'long') { R(hx - 1, hTop + 2, 2, 11, hair); R(hx + hw - 1, hTop + 2, 2, 11, hairD); }
    if (spec.hairStyle === 'pony') { R(hx + hw, hTop + 2, 1, 3, hairD); }
    if (spec.hairStyle === 'bun') { R(hx + 3, hTop - 2, 4, 2, hair); R(hx + 4, hTop - 2, 2, 1, hairL); }
    if (spec.hairStyle === 'curly') { R(hx - 1, hTop + 1, 1, 6, hair); R(hx + hw, hTop + 1, 1, 6, hairD); R(hx + 1, hTop - 1, hw - 2, 1, hair); P(hx + 3, hTop + 3, hair); P(hx + 5, hTop + 4, hair); }
    if (spec.beard) { R(hx + 1, hTop + 7, hw - 2, 3, spec.beard); R(hx, hTop + 6, 1, 3, spec.beard); R(hx + hw - 1, hTop + 6, 1, 3, shade(spec.beard, 0.8)); R(hx + 4, hTop + 8, 2, 1, shade(spec.beard, 0.6)); R(hx + 2, hTop + 10, hw - 4, 1, spec.beard); }
    if (spec.glasses) { R(hx + 1, hTop + 4, 8, 1, '#4a4458'); P(hx + 1, hTop + 5, '#4a4458'); P(hx + 8, hTop + 5, '#4a4458'); P(hx + 3, hTop + 5, '#cfeaf2'); P(hx + 6, hTop + 5, '#cfeaf2'); P(hx + 3, hTop + 6, '#a9cbd6'); P(hx + 6, hTop + 6, '#a9cbd6'); }
  }
  // ── hats ──
  if (spec.hat) {
    const hc = spec.hatColor ?? PAL.navy, hl = shade(hc, 1.25), hd = shade(hc, 0.7);
    if (spec.hat === 'cap') {
      R(hx, hTop - 1, hw, 3, hc); P(hx, hTop - 1, null); P(hx + hw - 1, hTop - 1, null); R(hx + 2, hTop - 1, 4, 1, hl); R(hx + hw - 1, hTop, 1, 2, hd);
      if (side) R(hx - 3, hTop + 2, 6, 1, hd); else if (!back) R(hx - 1, hTop + 2, hw + 2, 1, hd); else P(hx + 4, hTop + 2, hd), P(hx + 5, hTop + 2, hd);
    } else if (spec.hat === 'hardhat') {
      R(hx + 2, hTop - 2, hw - 4, 1, hl); R(hx + 1, hTop - 1, hw - 2, 1, hc); R(hx, hTop, hw, 2, hc); R(hx + hw - 2, hTop - 1, 2, 3, hd);
      R(hx + 4, hTop - 2, 2, 4, hl); R(side ? hx - 2 : hx - 1, hTop + 2, side ? hw + 2 : hw + 2, 1, hd);
    } else if (spec.hat === 'beanie') {
      R(hx + 1, hTop - 2, hw - 2, 1, hc); R(hx, hTop - 1, hw, 3, hc); R(hx, hTop + 2, hw, 1, hl); R(hx + hw - 1, hTop - 1, 1, 3, hd); P(hx + 4, hTop - 3, hl); P(hx + 5, hTop - 3, hl);
    } else if (spec.hat === 'captain') {
      R(hx - 1, hTop - 2, hw + 2, 2, PAL.white); R(hx + hw, hTop - 2, 1, 2, '#c9c5b8'); R(hx, hTop, hw, 2, hc);
      if (!back) { P(side ? hx + 1 : hx + 4, hTop, '#e2c15a'); P(side ? hx + 2 : hx + 5, hTop, '#e2c15a'); }
      if (side) R(hx - 2, hTop + 2, 5, 1, PAL.ink); else if (!back) R(hx, hTop + 2, hw, 1, PAL.ink);
    }
  }

  // ── arms & tool ──
  const sleeve = longSleeve ? shirt : skin;
  const armTop = tTop + 1, armLen = spec.kid ? 5 : 7;
  const arm = (x: number, dy: number, dark: boolean, sx = 0) => {
    const c1 = dark ? shade(shirt, 0.8) : shirt, c2 = dark ? shade(sleeve, 0.85) : sleeve;
    R(x, armTop + Math.min(dy, 0), 2, 3, c1);
    R(x + sx, armTop + 3, 2, armLen - 5 + dy, c2);
    R(x + sx, armTop + armLen - 2 + dy, 2, 2, dark ? skinD : skin);
  };
  const drawTool = (hxp: number, hy: number) => {
    const t = spec.tool ?? 'hammer';
    const W = PAL.wood, St = '#b9bfc8', Sd = '#727a88';
    if (t === 'none') return;
    if (t === 'hammer') { R(hxp, hy - 4, 1, 4, W); R(hxp - 1, hy - 6, 4, 2, St); P(hxp + 2, hy - 5, Sd); }
    else if (t === 'sledge') { R(hxp, hy - 6, 1, 6, W); R(hxp - 2, hy - 9, 5, 3, Sd); R(hxp - 2, hy - 9, 5, 1, St); }
    else if (t === 'roller') { R(hxp, hy - 5, 1, 5, Sd); R(hxp - 2, hy - 8, 5, 3, spec.toolColor ?? PAL.white); R(hxp - 2, hy - 6, 5, 1, shade(spec.toolColor ?? PAL.white, 0.75)); }
    else if (t === 'saw') { R(hxp - 1, hy - 1, 2, 2, W); R(hxp - 6, hy - 1, 5, 2, St); for (let k = 0; k < 5; k += 2) P(hxp - 6 + k, hy + 1, Sd); }
    else if (t === 'washer') { R(hxp, hy - 5, 1, 5, Sd); R(hxp - 1, hy - 6, 3, 1, '#d9a441'); P(hxp, hy - 8, '#bfe9f7'); P(hxp - 1, hy - 9, '#bfe9f7'); P(hxp + 1, hy - 10, '#e6f7fc'); }
    else if (t === 'nailgun') { R(hxp - 3, hy - 3, 5, 3, '#d9a441'); R(hxp - 3, hy - 3, 5, 1, '#f0c766'); P(hxp - 4, hy - 2, Sd); R(hxp, hy, 2, 1, PAL.charcoal); }
  };
  if (work >= 0) {
    const hy = work === 0 ? tTop - 3 : tTop + 3;
    if (side) {
      R(8, armTop, 4, 2, shirt);
      R(6, Math.min(hy, armTop), 2, Math.abs(hy - armTop) + 2, sleeve);
      R(6, hy, 2, 2, skin);
      drawTool(6, hy);
    } else {
      arm(back ? 16 : 6, 0, false);
      const ax = back ? 5 : 17;
      R(ax - (back ? 0 : 1), armTop, 2, 2, shirt);
      R(ax, Math.min(hy, armTop), 2, Math.abs(hy - armTop) + 2, sleeve);
      R(ax, hy, 2, 2, skin);
      drawTool(ax, hy);
    }
  } else if (side) {
    const sw = walk === 0 ? -1 : walk === 2 ? 1 : 0;
    arm(11, 0, false, sw);
  } else {
    const dl = walk === 0 ? -1 : walk === 2 ? 1 : 0;
    arm(6, dl, false);
    arm(16, -dl, true);
  }
  return buf;
}

function outline(buf: (string | null)[]): (string | null)[] {
  const out = buf.slice();
  const f = (x: number, y: number) => x >= 0 && y >= 0 && x < FW && y < FH && buf[y * FW + x] !== null;
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++)
      if (!f(x, y) && (f(x - 1, y) || f(x + 1, y) || f(x, y - 1) || f(x, y + 1))) out[y * FW + x] = PAL.ink;
  return out;
}

const sheetCache = new Map<string, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>();
export function charSheet(spec: CharSpec) {
  const key = JSON.stringify(spec);
  let s = sheetCache.get(key);
  if (s) return s;
  const [c, g] = mkCanvas(FW * COLS, FH * ROWS);
  for (let d = 0; d < 4; d++)
    for (let col = 0; col < COLS; col++) {
      const buf = outline(paintFrame(spec, d as Dir, col));
      for (let i = 0; i < buf.length; i++)
        if (buf[i]) {
          g.fillStyle = buf[i]!;
          g.fillRect(col * FW + (i % FW), d * FH + Math.floor(i / FW), 1, 1);
        }
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  s = { canvas: c, tex: t };
  sheetCache.set(key, s);
  return s;
}

/** Dialogue portrait: the sprite's own face, scaled with hard pixels. */
const portraitCache = new Map<string, string>();
export function portrait(spec: CharSpec): string {
  const key = JSON.stringify(spec);
  if (portraitCache.has(key)) return portraitCache.get(key)!;
  const sheet = charSheet({ ...spec, tool: undefined, toolColor: undefined });
  const [c, g] = mkCanvas(18, 18);
  g.fillStyle = '#2b3a5a';
  g.fillRect(0, 0, 18, 18);
  g.fillStyle = '#3a4f78';
  g.fillRect(0, 12, 18, 6);
  const top = spec.kid ? 5 : 1;
  g.drawImage(sheet.canvas, 3, top, 18, 18, 0, 0, 18, 18);
  const url = c.toDataURL();
  portraitCache.set(key, url);
  return url;
}

// ───────────────────────── billboards ─────────────────────────
let blobTex: THREE.Texture | null = null;
const planeGeo = (() => {
  const g = new THREE.PlaneGeometry(FW / SPR_PPM, FH / SPR_PPM);
  g.translate(0, FH / SPR_PPM / 2 - 1 / SPR_PPM, 0);
  // normals point up so sprites take the same light as the ground they stand on
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.92, 0.38);
  return g;
})();

export class Billboard {
  root = new THREE.Group();
  mesh: THREE.Mesh;
  ghost?: THREE.Mesh;
  shadow: THREE.Mesh;
  tex: THREE.Texture;
  dir: Dir = 0;
  anim: Anim = 'idle';
  t = Math.random() * 3;
  private lastCol = -1;
  private lastDir = -1;

  constructor(spec: CharSpec, withGhost = false) {
    this.tex = charSheet(spec).tex.clone();
    this.tex.repeat.set(1 / COLS, 1 / ROWS);
    this.tex.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    mat.onBeforeCompile = () => {};
    this.mesh = new THREE.Mesh(planeGeo, mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.root.add(this.mesh);
    if (withGhost) {
      const gm = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, color: 0x24304f, transparent: true, opacity: 0.45, depthFunc: THREE.GreaterDepth, depthWrite: false });
      this.ghost = new THREE.Mesh(planeGeo, gm);
      this.ghost.renderOrder = 5;
      this.root.add(this.ghost);
    }
    blobTex ??= radialTex('rgba(10,12,30,0.55)', 'rgba(10,12,30,0)');
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.04;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);
    this.apply(0);
  }

  setSpec(spec: CharSpec) {
    const src = charSheet(spec).tex;
    this.tex.image = src.image;
    this.tex.needsUpdate = true;
  }

  face(dx: number, dz: number) {
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
    this.dir = Math.abs(dx) > Math.abs(dz) * 1.1 ? (dx < 0 ? 1 : 2) : dz > 0 ? 0 : 3;
  }

  private apply(col: number) {
    if (col === this.lastCol && this.dir === this.lastDir) return;
    this.lastCol = col;
    this.lastDir = this.dir;
    this.tex.offset.set(col / COLS, 1 - (this.dir + 1) / ROWS);
  }

  update(dt: number, camYaw = 0) {
    this.t += dt;
    let col = 0;
    if (this.anim === 'idle') col = Math.floor(this.t * 1.6) % 2;
    else if (this.anim === 'walk') col = 2 + (Math.floor(this.t * 8) % 4);
    else col = 6 + (Math.floor(this.t * 5) % 2);
    this.apply(col);
    this.mesh.rotation.y = camYaw;
    if (this.ghost) this.ghost.rotation.y = camYaw;
  }
}

// ───────────────────────── critters ─────────────────────────
function mapSprite(rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  const [c, g] = mkCanvas(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
const critTex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
export function gullTextures() {
  const pal = { k: PAL.ink, w: '#f4efe2', g: '#b9bfc8', o: '#e2a23f' };
  return [
    mapSprite(['................', 'kk..........kk..', 'kwwk......kwwk..', '.kwwwk..kwwwk...', '..kgwwkkwwgk....', '...kkwwwwkko....', '.....kwwk.......', '......kk........'], pal),
    mapSprite(['................', '................', '......kkkk..o...', '..kkkkwwwwkk....', '.kwwggwwwwggwwk.', 'kwgkk.kwwk.kkgwk', 'kk.....kk.....kk', '................'], pal),
  ].map(critTex);
}
export function catTextures() {
  const pal = { k: PAL.ink, o: '#d98a3d', d: '#a8612a', w: '#f4efe2', e: '#7fd08a' };
  return [
    mapSprite(['.............k..', '..k.k........kok', '.kokok.......kok', '.koook......kok.', '.kekek.kkkkkkok.', '.koookkoodooook.', '..kkkoooodoook..', '....kooooooook..', '....kok.kkkok...', '....kwk...kwk...'], pal),
    mapSprite(['............k...', '..k.k.......kok.', '.kokok.......kok', '.koook.......kok', '.kekek.kkkkkkok.', '.koookkoodooook.', '..kkkoooodoook..', '....kooooooook..', '...kok.kkk.kok..', '...kwk.....kwk..'], pal),
  ].map(critTex);
}
