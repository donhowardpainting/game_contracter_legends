// Construction kit: real 3D geometry dressed in pixel-art materials at 16 texels / metre.
import * as THREE from 'three';
import * as PX from '../art/pixel';
import { PAL, shade, rng, mkCanvas } from '../art/pixel';
import type { Physics } from '../engine/physics';

export const TM = 4; // metres covered by one 64px texture repeat
export const uTime = { value: 0 };
export const uWind = { value: 1 };
/** Foreground cutaway: geometry standing between the camera and the player is stippled away
 *  (the depth-of-field pass then melts the stipple into soft translucency). */
export const uCut = { value: new THREE.Vector4(0, 0, 0, 0) };     // focus xyz, enabled
export const uCutScr = { value: new THREE.Vector3(0, 0, 200) };   // player screen px, porthole radius px
export function cutaway(sh: any, amt = 0.66) {
  sh.uniforms.uCut = uCut; sh.uniforms.uCutScr = uCutScr;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec4 uCut; uniform vec3 uCutScr; varying vec3 vCutW;
      float cutBayer(vec2 p){ vec2 q = floor(mod(p, 4.0)); const mat4 M = mat4(0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (M[int(q.x)][int(q.y)] + 0.5) / 16.0; }`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (uCut.w > 0.5 && vCutW.z > uCut.z + 2.0 && vCutW.y > 0.3) {
        float b = cutBayer(gl_FragCoord.xy / 2.0);
        vec2 d = (gl_FragCoord.xy - uCutScr.xy) / uCutScr.z; d.y *= 0.8;
        float hole = 1.0 - smoothstep(0.7, 1.15, length(d));
        float high = smoothstep(2.3, 3.4, vCutW.y) * smoothstep(2.0, 5.0, vCutW.z - uCut.z);
        if (b < max(hole * 1.1, high * ${amt.toFixed(2)})) discard;
      }`);
}
(THREE.MeshLambertMaterial.prototype as any).onBeforeCompile = function (sh: any) { cutaway(sh); };

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(t: THREE.Texture, opts: THREE.MeshLambertMaterialParameters = {}, key = ''): THREE.MeshLambertMaterial {
  const k = t.uuid + key;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ map: t, ...opts }); matCache.set(k, m); }
  return m;
}

/** Box whose UVs are scaled so the texture keeps a constant world density. */
export function uvBox(w: number, h: number, d: number, tm = TM): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / tm, (uv.getY(k) * dims[f][1]) / tm); }
  return g;
}

export interface Interior { x0: number; x1: number; z0: number; z1: number; hide: THREE.Object3D[]; light?: THREE.PointLight; inside?: boolean; name: string }
export interface Lamp { glow: THREE.Sprite; pool: THREE.Mesh; head: THREE.Mesh; on: boolean; broken: boolean; x: number; z: number }

export class Kit {
  group = new THREE.Group();
  winMats: THREE.MeshLambertMaterial[][] = [[], []];
  lamps: Lamp[] = [];
  smokers: THREE.Vector3[] = [];
  interiors: Interior[] = [];
  glows: { s: THREE.Object3D; night: boolean }[] = [];
  private trees: { kind: number; x: number; z: number; s: number; y: number }[] = [];
  private tufts: { kind: number; x: number; z: number; s: number; y: number }[] = [];
  private glowTex = PX.radialTex('rgba(255,214,140,0.9)', 'rgba(255,180,90,0)');
  private aoTex: THREE.Texture;
  R = rng(20261113);

  constructor(public phys: Physics) {
    // rectangular soft "contact shadow" for building bases
    const [c, g] = mkCanvas(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const dx = Math.max(0, Math.abs(x - 31.5) - 20) / 12, dy = Math.max(0, Math.abs(y - 31.5) - 20) / 12;
      const a = Math.max(0, 1 - Math.hypot(dx, dy));
      g.fillStyle = `rgba(14,16,36,${(a * a * 0.5).toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
    this.aoTex = new THREE.CanvasTexture(c);
  }

  box(parent: THREE.Object3D, t: THREE.Texture, x: number, y0: number, z: number, w: number, h: number, d: number, tm = TM, shadow = true): THREE.Mesh {
    const m = new THREE.Mesh(uvBox(w, h, d, tm), mat(t));
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  flatBox(parent: THREE.Object3D, color: string, x: number, y0: number, z: number, w: number, h: number, d: number, shadow = true) {
    return this.box(parent, PX.flat(color), x, y0, z, w, h, d, TM, shadow);
  }

  /** soft dark halo on the ground around a footprint — cheap baked-looking ambient occlusion */
  ao(x: number, z: number, w: number, d: number, y = 0.03) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6 + 2, d * 1.6 + 2), new THREE.MeshBasicMaterial({ map: this.aoTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    this.group.add(m);
    return m;
  }

  // ───────────── roofs ─────────────
  roof(parent: THREE.Object3D, kind: 'gableX' | 'gableZ' | 'hip' | 'flat' | 'shed', w: number, d: number, rise: number, roofT: THREE.Texture, wallT: THREE.Texture, trim: string, over = 0.45): THREE.Group {
    const g = new THREE.Group();
    parent.add(g);
    if (kind === 'flat') {
      this.box(g, roofT, 0, 0, 0, w + 0.3, 0.25, d + 0.3);
      this.flatBox(g, trim, 0, 0.25, d / 2 + 0.05, w + 0.3, 0.3, 0.2);
      this.flatBox(g, trim, 0, 0.25, -d / 2 - 0.05, w + 0.3, 0.3, 0.2);
      this.flatBox(g, trim, w / 2 + 0.05, 0.25, 0, 0.2, 0.3, d + 0.3);
      this.flatBox(g, trim, -w / 2 - 0.05, 0.25, 0, 0.2, 0.3, d + 0.3);
      return g;
    }
    if (kind === 'gableZ') { g.rotation.y = Math.PI / 2; [w, d] = [d, w]; }
    const W2 = w / 2 + over, D2 = d / 2 + over, ey = (-over * rise) / (d / 2);
    const pos: number[] = [], uv: number[] = [];
    const quad = (a: number[], b: number[], c: number[], e: number[]) => {
      const L = Math.hypot(e[1] - a[1], e[2] - a[2], e[0] - a[0]), U = Math.hypot(b[0] - a[0], b[2] - a[2]);
      pos.push(...a, ...b, ...c, ...a, ...c, ...e);
      const u0 = 0, u1 = U / TM, off = (U - Math.hypot(c[0] - e[0], c[2] - e[2])) / 2 / TM;
      uv.push(u0, 0, u1, 0, u1 - off, L / TM, u0, 0, u1 - off, L / TM, u0 + off, L / TM);
    };
    const tri = (a: number[], b: number[], c: number[]) => {
      const U = Math.hypot(b[0] - a[0], b[2] - a[2]), L = Math.hypot(c[1] - a[1], Math.hypot(c[0] - (a[0] + b[0]) / 2, c[2] - (a[2] + b[2]) / 2));
      pos.push(...a, ...b, ...c);
      uv.push(0, 0, U / TM, 0, U / TM / 2, L / TM);
    };
    if (kind === 'shed') {
      quad([-W2, 0, D2], [W2, 0, D2], [W2, rise, -D2], [-W2, rise, -D2]);
    } else {
      const rl = kind === 'hip' ? Math.max(0.2, w / 2 - d / 2) : W2;
      quad([-W2, ey, D2], [W2, ey, D2], [rl, rise, 0], [-rl, rise, 0]);
      quad([W2, ey, -D2], [-W2, ey, -D2], [-rl, rise, 0], [rl, rise, 0]);
      if (kind === 'hip') {
        tri([W2, ey, D2], [W2, ey, -D2], [rl, rise, 0]);
        tri([-W2, ey, -D2], [-W2, ey, D2], [-rl, rise, 0]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat(roofT, { side: THREE.DoubleSide }, 'ds'));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    // fascia + ridge cap give the silhouette a crisp painted edge
    this.flatBox(g, trim, 0, ey - 0.12, D2 - 0.03, W2 * 2, 0.16, 0.1, false);
    this.flatBox(g, trim, 0, (kind === 'shed' ? rise : ey) - 0.12, -D2 + 0.03, W2 * 2, 0.16, 0.1, false);
    if (kind !== 'shed') {
      const rl = kind === 'hip' ? Math.max(0.2, w / 2 - d / 2) : W2;
      const cap = this.box(g, roofT, 0, rise - 0.06, 0, rl * 2, 0.14, 0.3);
      cap.castShadow = false;
    }
    if (kind === 'gableX' || kind === 'gableZ') {
      // gable-end walls
      const gp: number[] = [], gu: number[] = [];
      for (const s of [1, -1]) {
        const x = (s * w) / 2;
        const a = [x, 0, (s * d) / 2], b = [x, 0, (-s * d) / 2], c = [x, rise, 0];
        gp.push(...a, ...b, ...c);
        gu.push(0, 0, d / TM, 0, d / TM / 2, rise / TM);
        // rake trim
        for (const zz of [1, -1]) {
          const len = Math.hypot(D2, rise - ey);
          const rk = this.flatBox(g, trim, x + s * (over - 0.04), 0, 0, 0.1, 0.16, len, false);
          rk.position.set(x + s * (over - 0.04), (rise + ey) / 2 - 0.06, (zz * D2) / 2);
          rk.rotation.x = zz * Math.atan2(rise - ey, D2);
        }
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2));
      gg.computeVertexNormals();
      const gm = new THREE.Mesh(gg, mat(wallT, { side: THREE.DoubleSide }, 'ds'));
      gm.castShadow = gm.receiveShadow = true;
      g.add(gm);
    }
    return g;
  }

  // ───────────── openings ─────────────
  private winMatCache = new Map<string, THREE.MeshLambertMaterial>();
  window(parent: THREE.Object3D, x: number, y: number, z: number, w = 1, h = 1.3, face: 's' | 'e' | 'w' | 'n' = 's', dead = false, shutter?: string, grp = -1): THREE.Mesh {
    const pw = Math.round(w * 16), ph = Math.round(h * 16);
    if (grp < 0) grp = this.R() < 0.5 ? 0 : 1;
    const key = `${pw}x${ph}${dead}${grp}`;
    let m = this.winMatCache.get(key);
    if (!m) {
      if (dead) m = new THREE.MeshLambertMaterial({ map: PX.tex(PX.windowTex('dead', pw, ph, pw), false) });
      else {
        m = new THREE.MeshLambertMaterial({ map: PX.tex(PX.windowTex('day', pw, ph), false), emissive: 0xffffff, emissiveMap: PX.tex(PX.windowTex('lit', pw, ph), false), emissiveIntensity: 0 });
        this.winMats[grp].push(m);
      }
      this.winMatCache.set(key, m);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), m);
    mesh.position.set(x, y, z);
    if (face === 'e') mesh.rotation.y = Math.PI / 2;
    if (face === 'w') mesh.rotation.y = -Math.PI / 2;
    if (face === 'n') mesh.rotation.y = Math.PI;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (face === 's') {
      this.flatBox(parent, dead ? '#6c665a' : PAL.white, x, y - h / 2 - 0.1, z + 0.04, w + 0.2, 0.1, 0.2, false);
      if (shutter && !dead) for (const s of [-1, 1]) this.box(parent, PX.planks(shutter, 3, 4), x + s * (w / 2 + 0.2), y - h / 2, z, 0.34, h, 0.06, TM, false);
    }
    return mesh;
  }
  door(parent: THREE.Object3D, x: number, y0: number, z: number, color: string, dead = false, face: 's' | 'e' | 'w' = 's'): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.15, 0.12), new THREE.MeshLambertMaterial({ map: PX.tex(PX.doorTex(color, dead), false) }));
    m.position.set(x, y0 + 1.075, z);
    if (face === 'e') m.rotation.y = Math.PI / 2;
    if (face === 'w') m.rotation.y = -Math.PI / 2;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, opts: { bg?: string; fg?: string; w?: number; h?: number; weathered?: boolean; rotY?: number; px?: number } = {}): THREE.Mesh {
    const lines = text.split('\n');
    const pxW = opts.px ?? Math.max(...lines.map((l) => l.length)) * 7 + 12, pxH = lines.length * 9 + 9;
    const c = PX.signTex(text, opts.bg ?? PAL.navy, opts.fg ?? PAL.cream, pxW, pxH, opts.weathered);
    const w = opts.w ?? pxW / 16 * 1.5, h = opts.h ?? (w * pxH) / pxW;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), new THREE.MeshLambertMaterial({ map: PX.tex(c, false) }));
    m.position.set(x, y, z);
    m.rotation.y = opts.rotY ?? 0;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // ───────────── buildings ─────────────
  house(s: HouseSpec): House {
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    this.group.add(g);
    const front = new THREE.Group(), top = new THREE.Group();
    g.add(front, top);
    const h = s.h ?? 3.2, fz = s.d / 2, trim = s.trim ?? PAL.white, dead = !!s.dead;
    const base = s.base ?? 0.35;
    const wallT = s.wall;
    if (base > 0) this.box(g, PX.stone('#8d8c8a', 2), 0, 0, 0, s.w + 0.14, base, s.d + 0.14);
    const doorX = s.door?.x ?? 0;
    if (s.interior) {
      const t = 0.25;
      this.box(g, wallT, 0, base, -fz + t / 2, s.w, h, t);
      this.box(g, wallT, -s.w / 2 + t / 2, base, 0, t, h, s.d - 2 * t);
      this.box(g, wallT, s.w / 2 - t / 2, base, 0, t, h, s.d - 2 * t);
      const gap = 1.5, lw = s.w / 2 + doorX - gap / 2, rw = s.w / 2 - doorX - gap / 2;
      this.box(front, wallT, -s.w / 2 + lw / 2, base, fz - t / 2, lw, h, t);
      this.box(front, wallT, s.w / 2 - rw / 2, base, fz - t / 2, rw, h, t);
      this.box(front, wallT, doorX, base + 2.2, fz - t / 2, gap, h - 2.2, t);
      // interior lining + floor
      const inT = s.interior.wall ?? PX.planks('#c9ad84', 5, 16);
      const lin = (x: number, z: number, w: number, d: number) => { const m = this.box(g, inT, x, base + 0.02, z, w, h - 0.04, d); m.castShadow = false; };
      lin(0, -fz + t + 0.03, s.w - 2 * t, 0.05); lin(-s.w / 2 + t + 0.03, 0, 0.05, s.d - 2 * t); lin(s.w / 2 - t - 0.03, 0, 0.05, s.d - 2 * t);
      const fl = this.box(g, s.interior.floor ?? PX.planks('#b98e5e', 6), 0, base - 0.02, 0, s.w - 2 * t, 0.06, s.d - 2 * t);
      fl.castShadow = false;
      // colliders: floor slab, three walls, front with a doorway
      const P = this.phys, X = s.x, Z = s.z;
      P.solid(X, Z, s.w, s.d, base);
      P.solid(X, Z - fz + t / 2, s.w, t, h + base);
      P.solid(X - s.w / 2 + t / 2, Z, t, s.d, h + base);
      P.solid(X + s.w / 2 - t / 2, Z, t, s.d, h + base);
      P.solid(X - s.w / 2 + lw / 2, Z + fz - t / 2, lw, t, h + base);
      P.solid(X + s.w / 2 - rw / 2, Z + fz - t / 2, rw, t, h + base);
      const light = new THREE.PointLight(0xffc98a, 0, 26, 1.1);
      light.position.set(0, base + h + 1.6, 1);
      g.add(light);
      this.interiors.push({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - fz, z1: s.z + fz, hide: [front, top], light, name: s.name ?? '' });
    } else {
      this.box(g, wallT, 0, base, 0, s.w, h, s.d);
      this.phys.solid(s.x, s.z, s.w, s.d, h + base + 2);
    }
    // corner boards & skirt trim
    for (const sx of [-1, 1]) this.flatBox(front, trim, sx * (s.w / 2 - 0.04), base, fz + 0.02, 0.16, h, 0.08, false);
    this.flatBox(front, trim, 0, base + h - 0.16, fz + 0.02, s.w, 0.16, 0.08, false);
    // door + windows on the camera-facing facade
    const y0 = base;
    if (s.door && !s.interior) this.door(front, doorX, y0, fz + 0.05, s.door.color ?? PAL.navy, dead);
    if (s.door) {
      this.flatBox(front, trim, doorX, y0 + 2.15, fz + 0.06, 1.5, 0.14, 0.14, false);
      if (!s.porch) { const st = this.box(g, PX.concrete(), doorX, 0, fz + 0.45, 1.6, base * 0.6, 0.8); st.castShadow = false; this.phys.solid(s.x + doorX, s.z + fz + 0.45, 1.6, 0.8, base * 0.6); }
    }
    const floors = Math.max(1, Math.round(h / 3));
    const winXs = s.windows ?? autoWindows(s.w, doorX, !!s.door);
    for (let f = 0; f < floors; f++) {
      const wy = y0 + 1.55 + f * 2.9;
      for (const wx of winXs) this.window(front, wx, wy, fz + 0.04, s.winW ?? 1, s.winH ?? 1.3, 's', dead, s.shutter);
      if (f > 0 && s.door) this.window(front, doorX, wy, fz + 0.04, s.winW ?? 1, s.winH ?? 1.3, 's', dead, s.shutter);
      if (s.d > 5) {
        this.window(g, s.w / 2 + 0.04, wy, 0, 1, 1.3, 'e', dead);
        this.window(g, -s.w / 2 - 0.04, wy, 0, 1, 1.3, 'w', dead);
      }
    }
    // roof
    const rise = s.rise ?? (s.roof === 'flat' ? 0 : Math.min(s.roof === 'gableZ' ? s.w : s.d, 9) * 0.36);
    const roofT = PX.roofTex(s.roofColor ?? PAL.slate, dead ? 0.22 : s.moss ?? 0.02, Math.floor(s.x + s.z));
    const rf = this.roof(top, s.roof ?? 'gableX', s.w, s.d, rise, roofT, wallT, trim, s.over ?? 0.45);
    rf.position.y = base + h;
    if (s.roof === 'gableZ' && !dead) this.window(top, 0, base + h + rise * 0.38, fz + 0.04, 0.8, 0.8, 's', false, undefined, 1);
    if (s.chimney) {
      const cx = s.chimney.x, cz = s.chimney.z ?? -s.d / 4;
      this.box(top, PX.brick(PAL.brick, 3), cx, base + h, cz, 0.8, rise + 1.1, 0.8);
      this.flatBox(top, '#5b4a44', cx, base + h + rise + 1.1, cz, 0.95, 0.14, 0.95);
      if (!dead) this.smokers.push(new THREE.Vector3(s.x + cx, base + h + rise + 1.4, s.z + cz));
    }
    if (s.dormers && (s.roof ?? 'gableX') === 'gableX') {
      for (const dx of s.dormers) {
        const dg = new THREE.Group();
        dg.position.set(dx, base + h + rise * 0.3, fz * 0.55);
        top.add(dg);
        this.box(dg, wallT, 0, 0, 0, 1.5, 1.3, 1.6);
        const dr = this.roof(dg, 'gableZ', 1.5, 1.6, 0.6, roofT, wallT, trim, 0.2);
        dr.position.y = 1.3;
        this.window(dg, 0, 0.7, 0.84, 0.9, 0.9, 's', dead, undefined, 1);
      }
    }
    // porch
    if (s.porch) {
      const p = s.porch, pw = p.w ?? s.w, pd = p.d ?? 2.2, pxo = p.x ?? 0, pz = fz + pd / 2;
      const deckT = PX.planks(p.color ?? '#a98458', 7);
      const dk = this.box(g, deckT, pxo, 0, pz, pw, base, pd);
      dk.castShadow = false;
      this.phys.solid(s.x + pxo, s.z + pz, pw, pd, base);
      const st = this.box(g, deckT, doorX, 0, fz + pd + 0.35, 1.8, base * 0.55, 0.7); st.castShadow = false;
      this.phys.solid(s.x + doorX, s.z + fz + pd + 0.35, 1.8, 0.7, base * 0.55);
      if (p.roofed !== false) {
        const n = Math.max(2, Math.round(pw / 3) + 1);
        for (let i = 0; i < n; i++) {
          const px = pxo - pw / 2 + 0.15 + (i * (pw - 0.3)) / (n - 1);
          if (Math.abs(px - doorX) < 0.7) continue;
          this.flatBox(front, trim, px, base, fz + pd - 0.15, 0.16, 2.5, 0.16);
        }
        const pr = this.roof(front, 'shed', pw + 0.2, pd + 0.2, 0.7, roofT, wallT, trim, 0.2);
        pr.position.set(pxo, base + 2.5, pz);
      }
      if (p.rail) {
        const railT = picketTex(trim);
        for (const [x0, x1] of [[pxo - pw / 2, doorX - 0.9], [doorX + 0.9, pxo + pw / 2]]) {
          if (x1 - x0 < 0.5) continue;
          this.alphaPlane(front, railT, (x0 + x1) / 2, base + 0.45, fz + pd - 0.12, x1 - x0, 0.9, 1);
        }
      }
    }
    if (s.awning) {
      const aw = this.roof(front, 'shed', s.w * 0.86, 1.4, 0.5, awningTex(s.awning), wallT, shade(s.awning, 0.7), 0);
      aw.position.set(0, base + 2.45, fz + 0.7);
    }
    if (s.sign) {
      const onWall = s.roof === 'gableZ';
      const lines = s.sign.text.split('\n'), pxW = Math.max(...lines.map((l) => l.length)) * 7 + 12, pxH = lines.length * 9 + 9;
      const sw = s.sign.w ?? Math.min(s.w * 0.8, (pxW / 16) * 1.25), sh = (sw * pxH) / pxW;
      const sy = onWall ? base + h - 0.5 : base + h + sh / 2 + (s.roof === 'flat' ? 0.5 : 0.02), sz = onWall ? fz + 0.14 : s.roof === 'flat' ? fz + 0.2 : fz + (s.porch && (s.porch.roofed !== false) && Math.abs((s.porch.x ?? 0) - (s.sign.x ?? 0)) < (s.porch.w ?? s.w) / 2 ? (s.porch.d ?? 2.2) + 0.25 : (s.over ?? 0.45) + 0.06);
      const sgy = s.porch && sz > fz + 1 ? base + 2.5 + sh / 2 + 0.05 : sy;
      this.sign(front, s.sign.text, s.sign.x ?? 0, sgy, sz, { bg: s.sign.bg, fg: s.sign.fg, weathered: dead, w: sw });
    }
    if (dead) {
      // ivy creeping up the facade
      const R = rng(Math.floor(s.x * 7 + s.z));
      for (let i = 0; i < Math.floor(s.w / 2.5); i++) {
        const ix = (R() - 0.5) * s.w * 0.9, ih = 1 + R() * (h - 1);
        this.alphaPlane(front, ivyTex(), ix, base + ih / 2, fz + 0.09, 1 + R(), ih, 1);
      }
    }
    this.ao(s.x, s.z, s.w, s.d);
    return { g, front, top, spec: s, base, h, rise, fz };
  }

  alphaPlane(parent: THREE.Object3D, t: THREE.Texture, x: number, y: number, z: number, w: number, h: number, tm = 1, rotY = 0): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tm, uv.getY(i) * (t.wrapT === THREE.RepeatWrapping && t.userData.tileY ? h / tm : 1));
    const m = new THREE.Mesh(geo, mat(t, { alphaTest: 0.5, side: THREE.DoubleSide }, 'at'));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.customDepthMaterial = depthMat(t);
    parent.add(m);
    return m;
  }

  // ───────────── props ─────────────
  fence(x0: number, z0: number, x1: number, z1: number, kind: 'picket' | 'wood' | 'chain' = 'picket', color = PAL.white, collide = true) {
    const len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(-(z1 - z0), x1 - x0), h = kind === 'picket' ? 1 : 1.8;
    const t = kind === 'picket' ? picketTex(color) : kind === 'wood' ? boardFenceTex(color) : chainTex();
    this.alphaPlane(this.group, t, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, len, h, 1, rot);
    if (collide) this.phys.box((x0 + x1) / 2, 0.6, (z0 + z1) / 2, len / 2, 0.6, 0.08, rot);
  }
  lamp(x: number, z: number, broken = false): Lamp {
    const g = this.group;
    this.flatBox(g, '#2e3344', x, 0, z, 0.16, 3.4, 0.16);
    this.flatBox(g, '#2e3344', x, 0, z, 0.34, 0.3, 0.34);
    this.flatBox(g, '#2e3344', x, 3.4, z, 0.6, 0.08, 0.6, false);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), new THREE.MeshLambertMaterial({ color: 0x9a927c, emissive: 0xffc878, emissiveIntensity: 0 }));
    head.position.set(x, 3.2, z);
    g.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.position.set(x, 3.2, z);
    glow.scale.setScalar(3.6);
    g.add(glow);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.06, z);
    pool.renderOrder = 2;
    g.add(pool);
    this.phys.cyl(x, z, 0.18, 3);
    const l = { glow, pool, head, on: false, broken, x, z };
    this.lamps.push(l);
    return l;
  }
  /** additive glow that only shows at night (lanterns, signs, windows) */
  glow(x: number, y: number, z: number, size = 2, color = 0xffd08a, always = false): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    this.group.add(s);
    this.glows.push({ s, night: !always });
    return s;
  }
  bench(x: number, z: number, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.group.add(g);
    const t = PX.planks('#8c6a45', 9, 4);
    this.box(g, t, 0, 0.4, 0, 1.8, 0.1, 0.5); this.box(g, t, 0, 0.6, -0.22, 1.8, 0.5, 0.08);
    for (const sx of [-0.8, 0.8]) this.flatBox(g, '#2e3344', sx, 0, 0, 0.1, 0.45, 0.5);
    this.phys.box(x, 0.3, z, 0.9, 0.3, 0.3, rot);
  }
  crate(x: number, z: number, s = 0.8, y = 0) { const m = this.box(this.group, crateTex(), x, y, z, s, s, s, s); if (y === 0) this.phys.solid(x, z, s, s, s); return m; }
  barrel(x: number, z: number, color = '#7a5a3c') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.95, 8), mat(PX.planks(color, 11, 16)));
    m.position.set(x, 0.475, z); m.castShadow = m.receiveShadow = true; this.group.add(m);
    this.phys.cyl(x, z, 0.38, 1);
  }
  lumberStack(x: number, z: number, w = 3, layers = 3, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.group.add(g);
    for (let i = 0; i < layers; i++) { this.box(g, PX.planks(PAL.lumber, 20 + i, 4), 0, 0.15 + i * 0.32, 0, w, 0.26, 1.2); for (const sx of [-w / 3, w / 3]) this.flatBox(g, PAL.woodDark, sx, 0.09 + i * 0.32, 0, 0.12, 0.07, 1.2, false); }
    this.phys.box(x, 0.5, z, w / 2, 0.5, 0.6, rot);
  }
  sawhorse(x: number, z: number, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.group.add(g);
    const t = PX.planks(PAL.lumber, 5, 4);
    this.box(g, t, 0, 0.8, 0, 1.4, 0.1, 0.12);
    for (const sx of [-0.55, 0.55]) for (const sz of [-1, 1]) { const l = this.box(g, t, sx, 0, sz * 0.2, 0.08, 0.85, 0.08); l.rotation.x = -sz * 0.25; }
    return g;
  }
  mailbox(x: number, z: number, color = PAL.red) { this.flatBox(this.group, PAL.woodDark, x, 0, z, 0.1, 1, 0.1); this.flatBox(this.group, color, x, 1, z, 0.28, 0.26, 0.5); }
  flowerBox(parent: THREE.Object3D, x: number, y: number, z: number, w = 1.1) {
    this.box(parent, PX.planks('#7a5a3c', 2, 4), x, y, z, w, 0.2, 0.25, TM, false);
    this.alphaPlane(parent, flowerTex(), x, y + 0.36, z + 0.02, w, 0.4, 1);
  }
  rockAt(x: number, z: number, s = 1, y = 0) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(PX.rock(1), { flatShading: true }, 'fs'));
    m.position.set(x, y + s * 0.3, z); m.rotation.set(this.R() * 3, this.R() * 3, this.R() * 3); m.scale.y = 0.65;
    m.castShadow = m.receiveShadow = true; this.group.add(m);
    return m;
  }
  bush(x: number, z: number, s = 0.7, color = '#4f8f46') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), swayMat(PX.leaves(color, 2), 0.04));
    m.position.set(x, s * 0.55, z); m.scale.y = 0.75; m.rotation.y = this.R() * 6;
    m.castShadow = m.receiveShadow = true; this.group.add(m);
  }
  tree(x: number, z: number, s = 1, kind = 0, collide = true, y = 0) { this.trees.push({ kind, x, z, s, y }); if (collide) this.phys.cyl(x, z, 0.35 * s, 3); }
  tuft(x: number, z: number, kind = 0, s = 1, y = 0) { this.tufts.push({ kind, x, z, s, y }); }

  /** Bake queued trees and ground cover into instanced meshes. */
  finalize() {
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    const inst = (geo: THREE.BufferGeometry, material: THREE.Material, list: { m: THREE.Matrix4; c?: THREE.Color }[], shadow = true) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((l, i) => { im.setMatrixAt(i, l.m); if (l.c) im.setColorAt(i, l.c); });
      im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false;
      this.group.add(im);
    };
    const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) => { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix(); return dummy.matrix.clone(); };
    const trunks: any[] = [], blobs: any[] = [], cones: any[] = [], blobs2: any[] = [];
    const R = rng(99);
    for (const t of this.trees) {
      const tint = () => col.setHSL(0, 0, 0.82 + R() * 0.36).clone();
      if (t.kind === 1) {
        trunks.push({ m: M(t.x, t.y + 1.0 * t.s, t.z, 0.6 * t.s, 2 * t.s, 0.6 * t.s) });
        const c = tint();
        for (let i = 0; i < 4; i++) cones.push({ m: M(t.x, t.y + (2.2 + i * 1.5) * t.s, t.z, (2.3 - i * 0.48) * t.s, 2.4 * t.s, (2.3 - i * 0.48) * t.s, R() * 6), c });
      } else {
        const hgt = (2.6 + R() * 0.8) * t.s;
        trunks.push({ m: M(t.x, t.y + hgt / 2, t.z, t.s, hgt, t.s) });
        const c = tint(), arr = t.kind === 2 ? blobs2 : blobs;
        arr.push({ m: M(t.x, t.y + hgt + 0.8 * t.s, t.z, 2.2 * t.s, 1.9 * t.s, 2.2 * t.s, R() * 6), c });
        arr.push({ m: M(t.x + 1.2 * t.s, t.y + hgt + 0.1 * t.s, t.z + 0.3 * t.s, 1.5 * t.s, 1.3 * t.s, 1.5 * t.s, R() * 6), c });
        arr.push({ m: M(t.x - 1.1 * t.s, t.y + hgt + 0.3 * t.s, t.z + 0.5 * t.s, 1.6 * t.s, 1.3 * t.s, 1.6 * t.s, R() * 6), c });
        arr.push({ m: M(t.x + 0.1 * t.s, t.y + hgt + 0.2 * t.s, t.z - 1.0 * t.s, 1.5 * t.s, 1.3 * t.s, 1.5 * t.s, R() * 6), c });
      }
    }
    inst(new THREE.CylinderGeometry(0.2, 0.3, 1, 6), mat(PX.bark()), trunks);
    const ico = new THREE.IcosahedronGeometry(1, 1);
    inst(ico, swayMat(PX.leaves('#4f9247', 1), 0.1), blobs);
    inst(ico, swayMat(PX.leaves('#c9813a', 4), 0.1), blobs2);
    inst(new THREE.ConeGeometry(1, 1, 7), swayMat(PX.leaves('#2f6b4c', 3), 0.05), cones);
    // crossed-quad ground cover
    const cross = (() => {
      const a = new THREE.PlaneGeometry(1, 1), b = new THREE.PlaneGeometry(1, 1);
      a.translate(0, 0.5, 0); b.translate(0, 0.5, 0); b.rotateY(Math.PI / 2);
      const g = new THREE.BufferGeometry();
      const pos = [...(a.attributes.position.array as any), ...(b.attributes.position.array as any)], uv = [...(a.attributes.uv.array as any), ...(b.attributes.uv.array as any)];
      const i0 = [...(a.index!.array as any), ...[...(b.index!.array as any)].map((i: number) => i + 4)];
      const idx = [...i0]; for (let i = 0; i < i0.length; i += 3) idx.push(i0[i], i0[i + 2], i0[i + 1]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      g.setIndex(idx);
      return g;
    })();
    const kinds = [tuftTex(0), tuftTex(1), tuftTex(2), tuftTex(3)];
    kinds.forEach((t, k) => {
      const list = this.tufts.filter((u) => u.kind === k).map((u) => ({ m: M(u.x, u.y, u.z, u.s * (k === 2 ? 1.2 : 0.8), u.s * (k === 2 ? 1.9 : 0.8), u.s * 0.8, R() * 3) }));
      inst(cross, swayMat(t, 0.08, { alphaTest: 0.5 }), list, false);
    });
  }
}

export interface HouseSpec {
  name?: string; x: number; z: number; w: number; d: number; h?: number; base?: number;
  wall: THREE.Texture; trim?: string; roof?: 'gableX' | 'gableZ' | 'hip' | 'flat' | 'shed'; rise?: number; roofColor?: string; moss?: number; over?: number;
  door?: { x?: number; color?: string }; windows?: number[]; winW?: number; winH?: number; shutter?: string;
  porch?: { w?: number; d?: number; x?: number; roofed?: boolean; color?: string; rail?: boolean };
  chimney?: { x: number; z?: number }; dormers?: number[]; dead?: boolean; awning?: string;
  sign?: { text: string; bg?: string; fg?: string; y?: number; x?: number; w?: number };
  interior?: { wall?: THREE.Texture; floor?: THREE.Texture };
}
export interface House { g: THREE.Group; front: THREE.Group; top: THREE.Group; spec: HouseSpec; base: number; h: number; rise: number; fz: number }

function autoWindows(w: number, doorX: number, hasDoor: boolean): number[] {
  const out: number[] = [];
  const n = Math.max(1, Math.floor((w - 1.2) / 2.6));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5);
    if (hasDoor && Math.abs(x - doorX) < 1.5) continue;
    out.push(x);
  }
  return out;
}

// ───────────── small authored textures ─────────────
const tcache = new Map<string, THREE.CanvasTexture>();
function ct(key: string, w: number, h: number, draw: (o: (x: number, y: number, c: string, w?: number, h?: number) => void, R: () => number) => void, repeat = true) {
  let t = tcache.get(key);
  if (!t) {
    const [c, g] = mkCanvas(w, h);
    draw((x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, rng(key.length * 131 + w));
    t = PX.tex(c, repeat);
    t.wrapT = THREE.ClampToEdgeWrapping;
    tcache.set(key, t);
  }
  return t;
}
export const picketTex = (c: string) => ct('picket' + c, 16, 16, (o) => {
  for (const x of [1, 6, 11]) { o(x, 2, c, 3, 14); o(x + 1, 1, c); o(x + 2, 2, shade(c, 0.78), 1, 14); }
  o(0, 5, shade(c, 0.86), 16, 2); o(0, 11, shade(c, 0.86), 16, 2); o(0, 6, shade(c, 0.66), 16, 1); o(0, 12, shade(c, 0.66), 16, 1);
});
export const boardFenceTex = (c: string) => ct('bfence' + c, 16, 32, (o, R) => {
  for (let i = 0; i < 4; i++) { const col = shade(c, 0.8 + R() * 0.3), top = Math.floor(R() * 2); o(i * 4, top, col, 4, 32 - top); o(i * 4 + 3, top, shade(col, 0.6), 1, 32); o(i * 4, top, shade(col, 1.15), 3, 1); }
  o(0, 8, shade(c, 0.6), 16, 1); o(0, 24, shade(c, 0.6), 16, 1);
});
export const chainTex = () => ct('chain', 16, 32, (o) => {
  for (let y = 2; y < 32; y++) for (let x = 0; x < 16; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) o(x, y, '#8a909c');
  o(0, 1, '#6d7482', 16, 2); o(0, 0, '#6d7482', 2, 32);
});
export const ivyTex = () => ct('ivy', 16, 32, (o, R) => {
  for (let i = 0; i < 70; i++) { const y = Math.floor(R() * 32), x = Math.floor(8 + (R() - 0.5) * (6 + y * 0.35)); o(x, y, R() < 0.5 ? '#4b7a3c' : R() < 0.5 ? '#6a9a4a' : '#35602f', 2, 2); }
});
export const flowerTex = () => ct('flowerbox', 16, 8, (o, R) => {
  for (let x = 0; x < 16; x++) { o(x, 4 + Math.floor(R() * 2), '#4f8f46', 1, 4); if (R() < 0.6) o(x, 2 + Math.floor(R() * 3), ['#e58fa0', '#f0d264', '#f4efe2', '#d6605a'][Math.floor(R() * 4)], 2, 2); }
});
export const awningTex = (c: string) => ct('awn' + c, 16, 16, (o) => { for (let x = 0; x < 16; x++) o(x, 0, Math.floor(x / 4) % 2 ? c : PAL.white, 1, 16); o(0, 0, 'rgba(0,0,0,0.25)', 16, 1); });
export const crateTex = () => ct('crate', 16, 16, (o) => {
  o(0, 0, '#a37747', 16, 16); o(0, 0, '#6b4a32', 16, 2); o(0, 14, '#6b4a32', 16, 2); o(0, 0, '#6b4a32', 2, 16); o(14, 0, '#6b4a32', 2, 16);
  for (let i = 2; i < 14; i++) { o(i, i, '#7d5a3a', 2, 1); } o(2, 5, '#8c6a45', 12, 1); o(2, 10, '#8c6a45', 12, 1);
});
export function tuftTex(kind: number) {
  return ct('tuft' + kind, 16, 16, (o, R) => {
    if (kind === 0) { for (let i = 0; i < 9; i++) { const x = 2 + Math.floor(R() * 12), h = 4 + Math.floor(R() * 7), c = ['#5d9a48', '#7fb95a', '#467a3d'][i % 3]; for (let y = 0; y < h; y++) o(x + (y > h - 3 ? (i % 2 ? 1 : -1) : 0), 15 - y, c); } }
    else if (kind === 1) { for (let i = 0; i < 6; i++) { const x = 2 + Math.floor(R() * 12), h = 4 + Math.floor(R() * 6); o(x, 16 - h, '#4f8f46', 1, h); const c = ['#e58fa0', '#f0d264', '#f4efe2', '#b99ae0'][Math.floor(R() * 4)]; o(x - 1, 15 - h, c, 3, 2); o(x, 14 - h, shade(c, 1.2)); } }
    else if (kind === 2) { for (let i = 0; i < 7; i++) { const x = 1 + Math.floor(R() * 14), h = 9 + Math.floor(R() * 7); o(x, 16 - h, i % 2 ? '#9aa35a' : '#c2b96f', 1, h); if (i % 2 === 0) o(x, 16 - h, '#6b4a32', 1, 3); } }
    else { for (let i = 0; i < 16; i++) { const x = Math.floor(R() * 15), y = 6 + Math.floor(R() * 9); o(x, y, ['#3f7a3a', '#5a9a48', '#35602f'][i % 3], 3, 2); } o(3, 9, '#d6605a', 2, 2); o(10, 11, '#d6605a', 2, 2); }
  });
}

const depthCache = new Map<string, THREE.MeshDepthMaterial>();
function depthMat(t: THREE.Texture) {
  let m = depthCache.get(t.uuid);
  if (!m) { m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 }); depthCache.set(t.uuid, m); }
  return m;
}

/** Lambert material whose vertices sway gently in the wind (foliage, grass, flags). */
const swayCache = new Map<string, THREE.MeshLambertMaterial>();
export function swayMat(t: THREE.Texture, amount: number, opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const key = t.uuid + amount;
  let m = swayCache.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ map: t, flatShading: !opts.alphaTest, ...opts });
  m.onBeforeCompile = (sh) => {
    cutaway(sh, 1.2); sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swp = (instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vec3 swp = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif
        float sw = sin(uTime * 1.7 + swp.x * 0.35 + swp.z * 0.27) + 0.5 * sin(uTime * 3.1 + swp.x * 0.9);
        transformed.x += sw * ${amount.toFixed(3)} * uWind * max(position.y + 0.3, 0.0);
        transformed.z += sw * ${(amount * 0.5).toFixed(3)} * uWind * max(position.y + 0.3, 0.0);`);
  };
  swayCache.set(key, m);
  return m;
}
