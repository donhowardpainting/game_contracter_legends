// Townsfolk with daily schedules who walk the sidewalks, plus the small life that makes
// the harbour feel inhabited: gulls, a diner cat, fireflies, butterflies, drifting leaves.
import * as THREE from 'three';
import { Billboard, CharSpec, gullTextures, catTextures } from '../art/sprites';
import { TILE } from '../art/pixel';
import type { Game } from './game';
import * as C from './content';

export interface Sched { h: number; at: string; act?: 'idle' | 'work'; in?: boolean }
export interface NpcDef { id: string; name: string; role: string; spec: CharSpec; sched: Sched[]; home: string }

// sidewalk graph (axis-aligned segments)
const VX = [-45.5, -3.5, 51.5], HZ = [-37.5, -7.5, 18.5];
type Seg = { a: number[]; b: number[] };
const SEGS: Seg[] = [];
for (const z of HZ) for (let i = 0; i < VX.length - 1; i++) SEGS.push({ a: [VX[i], z], b: [VX[i + 1], z] });
for (const x of VX) for (let i = 0; i < HZ.length - 1; i++) SEGS.push({ a: [x, HZ[i]], b: [x, HZ[i + 1]] });
SEGS.push({ a: [-3.5, 18.5], b: [-3.5, 42] }, { a: [-38, 42], b: [-3.5, 42] }, { a: [-3.5, 42], b: [38, 42] }, { a: [-45.5, -7.5], b: [-52, -14] });
const key = (p: number[]) => p[0] + ',' + p[1];

function project(x: number, z: number) {
  let best = { d: 1e9, p: [x, z], seg: SEGS[0] };
  for (const s of SEGS) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2));
    const p = [s.a[0] + dx * t, s.a[1] + dz * t], d = Math.hypot(p[0] - x, p[1] - z);
    if (d < best.d) best = { d, p, seg: s };
  }
  return best;
}
export function findPath(x0: number, z0: number, x1: number, z1: number): number[][] {
  if (Math.hypot(x1 - x0, z1 - z0) < 9) return [[x1, z1]];
  const A = project(x0, z0), B = project(x1, z1);
  const adj = new Map<string, { p: number[]; n: { k: string; w: number }[] }>();
  const node = (p: number[]) => { const k = key(p); if (!adj.has(k)) adj.set(k, { p, n: [] }); return k; };
  const link = (p: number[], q: number[]) => { const a = node(p), b = node(q), w = Math.hypot(p[0] - q[0], p[1] - q[1]); adj.get(a)!.n.push({ k: b, w }); adj.get(b)!.n.push({ k: a, w }); };
  for (const s of SEGS) link(s.a, s.b);
  link(A.p, A.seg.a); link(A.p, A.seg.b); link(B.p, B.seg.a); link(B.p, B.seg.b);
  if (A.seg === B.seg) link(A.p, B.p);
  const start = key(A.p), goal = key(B.p), dist = new Map<string, number>([[start, 0]]), prev = new Map<string, string>(), open = new Set([start]);
  while (open.size) {
    let u = '', bd = 1e9;
    for (const k of open) if (dist.get(k)! < bd) { bd = dist.get(k)!; u = k; }
    open.delete(u);
    if (u === goal) break;
    for (const e of adj.get(u)!.n) { const nd = bd + e.w; if (nd < (dist.get(e.k) ?? 1e9)) { dist.set(e.k, nd); prev.set(e.k, u); open.add(e.k); } }
  }
  const out: number[][] = [[x1, z1]];
  let k: string | undefined = goal;
  while (k) { out.unshift(adj.get(k)!.p); k = prev.get(k); }
  return out;
}

export class Npc {
  bb: Billboard;
  pos = new THREE.Vector3();
  visible = true;
  hold: { x: number; z: number; dir?: number; anim?: 'idle' | 'work' } | null = null;
  private path: number[][] = [];
  private dest = '';
  private arrived = false;
  private barkT = 4 + Math.random() * 10;
  private workT = 0;
  private cur?: Sched;
  talking = false;

  constructor(private G: Game, public def: NpcDef) {
    this.bb = new Billboard({ ...def.spec, tool: 'hammer' });
    G.gfx.scene.add(this.bb.root);
    const s = this.current(G.sky.time), p = G.places[s.at] ?? { x: 0, z: 0 };
    this.pos.set(p.x, 0, p.z);
    this.dest = s.at; this.arrived = true; this.cur = s;
  }
  private current(h: number): Sched {
    const sc = this.def.sched;
    let cur = sc[sc.length - 1];
    for (const s of sc) if (s.h <= h) cur = s;
    return cur;
  }
  goTo(place: string) { const p = this.G.places[place]; if (!p) return; this.dest = place; this.arrived = false; this.path = findPath(this.pos.x, this.pos.z, p.x, p.z); }
  warp(place: string) { const p = this.G.places[place]; if (p) { this.pos.set(p.x, 0, p.z); this.dest = place; this.arrived = true; this.path = []; } }
  talk() {
    const G = this.G, pp = G.player.pos;
    this.bb.face(pp.x - this.pos.x, pp.z - this.pos.z);
    G.player.bb.face(this.pos.x - pp.x, this.pos.z - pp.z);
    this.talking = true;
    G.snd.sfx('select');
    G.ui.dialogue(C.talk(G, this.def.id), () => (this.talking = false));
  }
  update(dt: number) {
    const G = this.G, S = G.S;
    let anim: 'idle' | 'walk' | 'work' = 'idle';
    const crew = S.crew[this.def.id];
    if (this.hold) {
      const d = Math.hypot(this.hold.x - this.pos.x, this.hold.z - this.pos.z);
      if (d > 0.3) { this.step(this.hold.x, this.hold.z, dt, d > 30 ? 99 : 2.2); anim = 'walk'; }
      else { anim = this.hold.anim ?? 'idle'; if (this.hold.dir !== undefined) this.bb.dir = this.hold.dir as any; }
      this.visible = true;
    } else if (crew?.hired && crew.assign === 'assist' && G.running && G.sky.time > 6.5 && G.sky.time < 19 && this.assist(dt)) {
      anim = this.bb.anim; this.visible = true;
    } else {
      const s = this.current(G.sky.time);
      if (s !== this.cur || (s.at !== this.dest)) { this.cur = s; this.goTo(s.at); this.visible = true; }
      if (!this.arrived && !this.talking) {
        const wp = this.path[0];
        if (!wp) { this.arrived = true; }
        else {
          const d = Math.hypot(wp[0] - this.pos.x, wp[1] - this.pos.z);
          if (d < 0.25) this.path.shift(); else { this.step(wp[0], wp[1], dt, 1.9); anim = 'walk'; }
        }
      } else if (this.arrived) {
        if (s.in) this.visible = false;
        else { anim = s.act ?? 'idle'; if (!this.talking && anim === 'idle' && this.bb.anim === 'walk') this.bb.dir = 0; if (anim === 'work') this.bb.dir = 3; }
      }
    }
    if (this.talking) anim = 'idle';
    this.bb.anim = anim;
    this.bb.root.visible = this.visible;
    this.bb.root.position.copy(this.pos);
    this.bb.update(dt, G.gfx.yaw);
    // ambient barks
    if (this.visible && G.running && !G.ui.blocking) {
      this.barkT -= dt;
      const pd = Math.hypot(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z);
      if (this.barkT <= 0) { this.barkT = 12 + Math.random() * 16; if (pd < 12 && pd > 2) { const b = C.bark(G, this.def.id); if (b) G.ui.bubble(this, b); } }
      const v = G.player.driving;
      if (v && Math.abs(v.speed) > 5 && pd < 3.2 && this.barkT < 10) { this.barkT = 14; G.ui.bubble(this, ['Hey! Watch it!', 'Slow down, hotshot!', "That's Walt's truck, alright."][Math.floor(Math.random() * 3)]); this.pos.x += this.pos.x > v.pos.x ? 0.8 : -0.8; }
    }
  }
  private step(x: number, z: number, dt: number, sp: number) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz) || 1, m = Math.min(d, sp * dt);
    this.pos.x += (dx / d) * m; this.pos.z += (dz / d) * m;
    this.bb.face(dx, dz);
  }
  /** hired hands pitch in on whatever job the player has open nearby */
  private assist(dt: number): boolean {
    const G = this.G, pp = G.player.pos;
    let best: any = null, bd = 60;
    for (const t of G.tasks.values()) { if (!t.active || t.done || !['paint', 'build', 'demo', 'rubble'].includes(t.kind)) continue; const d = Math.hypot(t.pos.x - pp.x, t.pos.z - pp.z); if (d < bd) { bd = d; best = t; } }
    if (!best) return false;
    const off = (this.def.id.charCodeAt(0) % 5) - 2;
    const tx = (best.reachFrom?.x ?? best.pos.x) + off * 0.9, tz = (best.reachFrom?.z ?? best.pos.z) + 1.2;
    const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
    if (d > 1) { this.step(tx, tz, dt, d > 45 ? 99 : 2.6); this.bb.anim = 'walk'; return true; }
    this.bb.anim = 'work'; this.bb.dir = 3;
    this.workT -= dt;
    if (this.workT <= 0) { this.workT = 2.2 - G.skillLv('business') * 0.2; const p = best.auto(); if (p) G.fx.burst(p, 4, { colors: ['#e8cf9a', '#fff6cf'], speed: 1.2, up: 1, life: 0.4, size: 0.06 }); }
    return true;
  }
}

// ───────────────────────── critters & ambient life ─────────────────────────
export class Critters {
  private gulls: { m: THREE.Mesh; c: THREE.Vector3; r: number; a: number; sp: number; h: number; perch?: THREE.Vector3; fly: number }[] = [];
  private gt = gullTextures();
  private cat: THREE.Mesh; private ct = catTextures(); private catGoal = new THREE.Vector3(10, 0, -38.4); private catWait = 3;
  catPos = new THREE.Vector3(10, 0, -38.4);
  private t = 0;
  constructor(private G: Game) {
    const geo = new THREE.PlaneGeometry(1.1, 0.55);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.gt[0], alphaTest: 0.5, side: THREE.DoubleSide }));
      G.gfx.scene.add(m);
      const perch = i < 4 ? G.town.gullPerches[(i * 3) % Math.max(1, G.town.gullPerches.length)] : undefined;
      this.gulls.push({ m, c: new THREE.Vector3(-30 + i * 11, 0, -46 - (i % 3) * 7), r: 5 + (i % 4) * 2.5, a: i * 1.7, sp: (i % 2 ? 1 : -1) * (0.35 + (i % 3) * 0.1), h: 6 + (i % 4) * 1.6, perch, fly: perch ? 0 : 1 });
    }
    this.cat = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.62), new THREE.MeshLambertMaterial({ map: this.ct[0], alphaTest: 0.5, side: THREE.DoubleSide }));
    G.gfx.scene.add(this.cat);
    G.addInteract({ id: 'cat', x: 0, z: 0, r: 1.5, label: 'Pet Biscuit the cat', when: () => { const it = G.interacts.find((i) => i.id === 'cat')!; it.x = this.catPos.x; it.z = this.catPos.z; return true; }, act: () => { G.ui.bubbleAt(this.catPos.clone().setY(0.9), 'Mrrrp.'); G.snd.tone(700, 0.25, 'triangle', 0.08, 300); if (!G.S.flags.pet_cat) { G.flag('pet_cat'); G.addXp('exploration', 8); G.toast('Biscuit approves of you.', 'heart'); } } });
  }
  update(dt: number) {
    const G = this.G, pp = G.player.pos;
    this.t += dt;
    const flap = Math.floor(this.t * 5) % 2;
    for (const g of this.gulls) {
      if (g.perch && g.fly <= 0) {
        g.m.position.copy(g.perch); (g.m.material as THREE.MeshBasicMaterial).map = this.gt[1]; g.m.scale.setScalar(0.7);
        if (Math.hypot(pp.x - g.perch.x, pp.z - g.perch.z) < 4) { g.fly = 14 + Math.random() * 10; g.c.set(g.perch.x, 0, g.perch.z - 6); g.a = Math.PI / 2; G.snd.tone(1700, 0.2, 'sawtooth', 0.03, -600); }
      } else {
        if (g.perch) g.fly -= dt;
        g.a += g.sp * dt;
        g.m.scale.setScalar(1);
        g.m.position.set(g.c.x + Math.cos(g.a) * g.r, g.h + Math.sin(g.a * 2.3) * 0.6, g.c.z + Math.sin(g.a) * g.r * 0.6);
        (g.m.material as THREE.MeshBasicMaterial).map = this.gt[flap];
        g.m.scale.x = Math.sin(g.a) * g.sp > 0 ? -1 : 1;
      }
      (g.m.material as THREE.MeshBasicMaterial).color.setScalar(1 - G.sky.night * 0.6);
      g.m.visible = G.sky.night < 0.9 || !!g.perch;
    }
    // Biscuit patrols the boardwalk by the diner
    const d = this.catPos.distanceTo(this.catGoal);
    if (d > 0.15) {
      const dir = this.catGoal.clone().sub(this.catPos).normalize();
      this.catPos.addScaledVector(dir, Math.min(d, dt * 1.5));
      this.cat.scale.x = dir.x < 0 ? 1 : -1;
      (this.cat.material as THREE.MeshLambertMaterial).map = this.ct[Math.floor(this.t * 6) % 2];
    } else { this.catWait -= dt; (this.cat.material as THREE.MeshLambertMaterial).map = this.ct[0]; if (this.catWait <= 0) { this.catWait = 4 + Math.random() * 8; this.catGoal.set(4 + Math.random() * 22, 0, -39 + Math.random() * 2.2); } }
    this.cat.position.set(this.catPos.x, 0.3, this.catPos.z);
    // particles of life around the player
    const n = G.sky.night, R = Math.random;
    if (R() < dt * 6) {
      const x = pp.x + (R() - 0.5) * 34, z = pp.z + (R() - 0.7) * 26, t = G.town.tileAt(x, z);
      if (n > 0.6 && (t === TILE.grass || t === TILE.forest || t === TILE.tallgrass || t === TILE.flowers || t === TILE.marsh)) G.fx.one(x, 0.5 + R() * 1.4, z, (R() - 0.5) * 0.4, (R() - 0.5) * 0.2, (R() - 0.5) * 0.4, R() < 0.5 ? '#e6f08a' : '#c8f0a0', { colors: [], life: 2.6, size: 0.09, gravity: 0, drag: 0.2, glow: true });
      else if (n < 0.2 && (t === TILE.flowers || t === TILE.garden)) G.fx.one(x, 0.6 + R(), z, (R() - 0.5) * 1.2, (R() - 0.3) * 0.6, (R() - 0.5) * 1.2, ['#f4efe2', '#f0d264', '#e58fa0'][Math.floor(R() * 3)], { colors: [], life: 2.4, size: 0.09, gravity: -0.1, drag: 0.6 });
      else if (t === TILE.forest && R() < 0.6) G.fx.one(x, 5 + R() * 3, z, 0.5, -0.3, 0.2, R() < 0.5 ? '#c9813a' : '#8fae5a', { colors: [], life: 5, size: 0.1, gravity: 0.5, drag: 1.2 });
    }
  }
}
