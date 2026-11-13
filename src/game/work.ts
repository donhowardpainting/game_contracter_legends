// Hands-on trade work. Every task here is done in the world with a tool in your hand:
// rolling paint onto real wall pixels, blasting grime off, setting boards and driving nails,
// swinging a sledge and watching the pieces fly.
import * as THREE from 'three';
import * as PX from '../art/pixel';
import { PAINTS, PAL, shade, clapRow, rng } from '../art/pixel';
import { mat, uvBox } from '../world/kit';
import type { Game } from './game';
import type { DynBody } from '../engine/physics';

export type ToolId = 'hands' | 'hammer' | 'paint' | 'sledge' | 'saw' | 'washer';
export interface Hit { task: Task; point: THREE.Vector3; dist: number; target: any; uv?: THREE.Vector2 }
const TOOL_NAME: Record<ToolId, string> = { hands: 'hands', hammer: 'hammer [2]', paint: 'paint roller [3]', sledge: 'sledgehammer [4]', saw: 'saw [5]', washer: 'pressure washer [6]' };

export abstract class Task {
  done = false;
  active = false;
  pos = new THREE.Vector3();
  reachFrom?: { x: number; z: number };
  kind = 'task';
  constructor(public G: Game, public id: string, public label: string) {}
  abstract progress(): number;
  pick(_ray: THREE.Raycaster): Hit | null { return null; }
  use(_h: Hit, _tool: ToolId, _dt: number, _clicked: boolean): boolean { return false; }
  setActive(on: boolean) { this.active = on && !this.done; this.refresh(); }
  refresh() {}
  update(_dt: number) {}
  /** one unit of crew labour; returns where it happened */
  auto(): THREE.Vector3 | null { return null; }
  saveData(): any { return 1; }
  restore(_data: any) { this.done = true; this.active = false; this.refresh(); }
  reset() { this.done = false; delete this.G.S.flags['task:' + this.id]; this.refresh(); }
  complete() {
    if (this.done) return;
    this.done = true;
    this.active = false;
    this.G.S.flags['task:' + this.id] = this.saveData();
    this.refresh();
    this.G.onTaskDone(this);
  }
  protected needTool(tool: ToolId, want: ToolId, clicked: boolean) {
    if (tool === want) return true;
    if (clicked) this.G.toast(`Equip your ${TOOL_NAME[want]} for this.`, 'warn');
    return false;
  }
}

// ───────────────────────── painting & washing ─────────────────────────
interface Surf { mesh: THREE.Mesh; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; W: number; H: number; st: Uint8Array; grime: number; grime0: number; painted: number; floor: boolean; last?: { x: number; y: number; t: number } }
export interface SurfSpec { x: number; y: number; z: number; w: number; h: number; floor?: boolean }
export interface PaintOpts { parent?: THREE.Object3D; ox?: number; oy?: number; oz?: number; wash?: boolean; color?: number; pattern?: 'clap' | 'plank' | 'plain'; mural?: boolean; reachFrom?: { x: number; z: number } }

export class PaintTask extends Task {
  kind = 'paint';
  surfs: Surf[] = [];
  colorUsed = 0;
  private R = rng(5);
  constructor(G: Game, id: string, label: string, specs: SurfSpec[], public o: PaintOpts = {}) {
    super(G, id, label);
    this.reachFrom = o.reachFrom;
    const parent = o.parent ?? G.kit.group;
    for (const s of specs) {
      const W = Math.round(s.w * 16), H = Math.round(s.h * 16);
      const [c, ctx] = PX.mkCanvas(W, H);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      mesh.position.set(s.x - (o.ox ?? 0), s.y - (o.oy ?? 0), s.z - (o.oz ?? 0));
      if (s.floor) mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      mesh.renderOrder = 2;
      parent.add(mesh);
      this.surfs.push({ mesh, ctx, tex, W, H, st: new Uint8Array(W * H), grime: 0, grime0: 1, painted: 0, floor: !!s.floor });
      this.pos.set(s.x, s.floor ? s.y : s.y - s.h / 2, s.z + (s.floor ? 0 : 0.5));
    }
    this.initGrime();
  }
  private initGrime() {
    for (const s of this.surfs) {
      s.ctx.clearRect(0, 0, s.W, s.H); s.st.fill(0); s.grime = 0; s.painted = 0;
      if (this.o.wash) {
        const R = rng(s.W * 31 + s.H), n: number[] = [];
        const gw = Math.ceil(s.W / 6) + 2, gh = Math.ceil(s.H / 6) + 2;
        for (let i = 0; i < gw * gh; i++) n.push(R());
        for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
          const fx = x / 6, fy = y / 6, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
          const v = (n[iy * gw + ix] * (1 - tx) + n[iy * gw + ix + 1] * tx) * (1 - ty) + (n[(iy + 1) * gw + ix] * (1 - tx) + n[(iy + 1) * gw + ix + 1] * tx) * ty;
          if (v + (y / s.H) * 0.3 > 0.56 || R() < 0.05) {
            s.st[y * s.W + x] = 1; s.grime++;
            s.ctx.fillStyle = v > 0.62 ? '#3f4a35' : R() < 0.5 ? '#55533f' : '#4a5440';
            s.ctx.globalAlpha = 0.6 + R() * 0.25;
            s.ctx.fillRect(x, y, 1, 1);
          }
        }
        s.ctx.globalAlpha = 1;
        s.grime0 = Math.max(1, s.grime);
      }
      s.tex.needsUpdate = true;
    }
  }
  get washing() { return !!this.o.wash && this.surfs.some((s) => s.grime > 0); }
  progress() {
    let g = 0, g0 = 0, p = 0, t = 0;
    for (const s of this.surfs) { g += s.grime; g0 += s.grime0; p += s.painted; t += s.W * s.H; }
    const paintP = Math.min(1, p / t / 0.95);
    return this.o.wash ? (1 - g / g0) * 0.4 + paintP * 0.6 : paintP;
  }
  stageLabel() { return this.washing ? 'Pressure-wash the grime' : 'Paint'; }
  pick(ray: THREE.Raycaster): Hit | null {
    for (const s of this.surfs) {
      const r = ray.intersectObject(s.mesh, false)[0];
      if (r && r.uv) return { task: this, point: r.point, dist: r.distance, target: s, uv: r.uv };
    }
    return null;
  }
  private pix(s: Surf, x: number, y: number, c: string) {
    const p = this.o.pattern ?? (s.floor ? 'plank' : 'clap');
    let col = c;
    if (p === 'clap') col = clapRow(y, c);
    else if (p === 'plank') { const r = y % 8; col = r === 0 ? shade(c, 1.12) : r === 7 ? shade(c, 0.6) : (x * 7 + Math.floor(y / 8) * 13) % 29 === 0 ? shade(c, 0.7) : (x + y * 3) % 11 === 0 ? shade(c, 0.9) : c; }
    else if ((x * 13 + y * 7) % 17 === 0) col = shade(c, 0.93);
    s.ctx.fillStyle = col;
    s.ctx.fillRect(x, y, 1, 1);
  }
  private stamp(s: Surf, cx: number, cy: number, r: number, mode: 'paint' | 'wash', color: string): number {
    let n = 0;
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(s.H - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(s.W - 1, Math.ceil(cx + r)); x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 > r2 || (d2 > r2 * 0.6 && this.R() < 0.35)) continue;
        const i = y * s.W + x, st = s.st[i];
        if (mode === 'wash') { if (st === 1) { s.st[i] = 0; s.grime--; s.ctx.clearRect(x, y, 1, 1); n++; } }
        else if (st !== 1) {
          if (st !== 2) { s.painted++; n++; } else if (!this.o.mural) continue;
          s.st[i] = 2; this.pix(s, x, y, color);
        }
      }
    if (n || (this.o.mural && mode === 'paint')) s.tex.needsUpdate = true;
    return n;
  }
  use(h: Hit, tool: ToolId, _dt: number, clicked: boolean): boolean {
    const G = this.G, s = h.target as Surf, S = G.S;
    const x = h.uv!.x * s.W, y = (1 - h.uv!.y) * s.H;
    const now = performance.now();
    const from = s.last && now - s.last.t < 180 ? s.last : { x, y };
    s.last = { x, y, t: now };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 3));
    if (this.washing) {
      if (!this.needTool(tool, 'washer', clicked)) return false;
      let n = 0;
      for (let k = 1; k <= steps; k++) n += this.stamp(s, from.x + ((x - from.x) * k) / steps, from.y + ((y - from.y) * k) / steps, 9, 'wash', '');
      G.snd.setLoop('wash', true, 0.3);
      if (Math.random() < 0.7) G.fx.burst(h.point, 3, { colors: ['#cfeaf6', '#9fd0e6', '#f4fbff'], speed: 2.2, up: 1.5, life: 0.5, size: 0.08 });
      if (n) { G.addXp('painting', n / 500); if (s.grime / s.grime0 < 0.06) { for (let i = 0; i < s.st.length; i++) if (s.st[i] === 1) s.st[i] = 0; s.grime = 0; this.redraw(s); if (!this.washing) { G.toast('Spotless. Now it will hold paint.', 'good'); G.snd.sfx('sparkle'); } } }
      return true;
    }
    if (!this.needTool(tool, 'paint', clicked)) return false;
    if (this.o.wash && s.grime > 0) return false;
    if (this.o.color !== undefined && S.paintColor !== this.o.color) { if (clicked) G.toast(`The client asked for ${PAINTS[this.o.color].name}. Press [C] to change colour.`, 'warn'); return false; }
    if (S.inv.paint <= 0.001) { if (clicked) G.toast('Out of paint — Brannigan Lumber sells it by the gallon.', 'warn'); return false; }
    if (!G.materialsNear()) { if (clicked) G.toast('Your paint is in the truck. Bring it closer.', 'warn'); return false; }
    const r = S.tools.sprayer ? 14 : (S.tools.roller ? 9.5 : 6.5) + (G.skillLv('painting') >= 2 ? 2 : 0);
    let n = 0;
    for (let k = 1; k <= steps; k++) n += this.stamp(s, from.x + ((x - from.x) * k) / steps, from.y + ((y - from.y) * k) / steps, r, 'paint', PAINTS[S.paintColor].c);
    G.snd.setLoop('paint', true, S.tools.sprayer ? 0.3 : 0.14);
    if (n) {
      this.colorUsed = S.paintColor;
      S.inv.paint = Math.max(0, S.inv.paint - n / (5200 * (G.skillLv('painting') >= 4 ? 1.4 : 1)));
      G.addXp('painting', n / 260);
      if (Math.random() < 0.3) G.fx.burst(h.point, 1, { colors: [PAINTS[S.paintColor].c], speed: 0.6, up: 0.2, life: 0.6, size: 0.07 });
      let p = 0, t = 0;
      for (const q of this.surfs) { p += q.painted; t += q.W * q.H; }
      if (p / t >= 0.95) { if (!this.o.mural) this.fill(PAINTS[this.colorUsed].c); G.fx.burst(this.pos.clone().setY(2), 30, { colors: ['#fff6cf', '#ffe08a', PAINTS[this.colorUsed].c], speed: 3.5, up: 3, life: 1.1, size: 0.1, glow: true }); this.complete(); }
    }
    return true;
  }
  private redraw(s: Surf) {
    s.ctx.clearRect(0, 0, s.W, s.H);
    s.tex.needsUpdate = true;
  }
  fill(c: string) {
    for (const s of this.surfs) {
      for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { s.st[y * s.W + x] = 2; this.pix(s, x, y, c); }
      s.painted = s.W * s.H; s.grime = 0; s.tex.needsUpdate = true;
    }
  }
  auto() {
    const s = this.surfs[0];
    for (let tries = 0; tries < 30; tries++) {
      const x = Math.random() * s.W, y = Math.random() * s.H, st = s.st[Math.floor(y) * s.W + Math.floor(x)];
      if (this.washing ? st === 1 : st === 0) {
        if (this.washing) { this.stamp(s, x, y, 10, 'wash', ''); if (s.grime / s.grime0 < 0.06) { for (let i = 0; i < s.st.length; i++) if (s.st[i] === 1) s.st[i] = 0; s.grime = 0; this.redraw(s); } }
        else {
          const ci = this.o.color ?? (this.colorUsed || this.G.S.paintColor);
          this.colorUsed = ci;
          this.stamp(s, x, y, 9, 'paint', PAINTS[ci].c);
          let p = 0, t = 0;
          for (const q of this.surfs) { p += q.painted; t += q.W * q.H; }
          if (p / t >= 0.95) { this.fill(PAINTS[ci].c); this.complete(); }
        }
        const lp = new THREE.Vector3((x / s.W - 0.5) * (s.W / 16), s.floor ? 0 : (0.5 - y / s.H) * (s.H / 16), 0);
        return s.mesh.localToWorld(s.floor ? new THREE.Vector3(lp.x, (0.5 - y / s.H) * (s.H / 16), 0) : lp);
      }
    }
    return null;
  }
  saveData() { return this.o.mural ? { img: this.surfs[0].ctx.canvas.toDataURL() } : { c: this.colorUsed }; }
  restore(d: any) {
    super.restore(d);
    if (d && d.img) { const im = new Image(); im.onload = () => { const s = this.surfs[0]; s.ctx.drawImage(im, 0, 0); s.st.fill(2); s.painted = s.W * s.H; s.tex.needsUpdate = true; }; im.src = d.img; }
    else { this.colorUsed = d?.c ?? 0; this.fill(PAINTS[this.colorUsed].c); }
  }
  reset() { super.reset(); this.initGrime(); }
}

// ───────────────────────── framing & nailing ─────────────────────────
export interface PieceSpec { x: number; y: number; z: number; w: number; h: number; d: number; nails: number; tex?: string; rotNail?: boolean }
interface Piece { spec: PieceSpec; mesh: THREE.Mesh; edges: THREE.LineSegments; state: 0 | 1 | 2; nails: { m: THREE.Mesh; hp: number }[] }
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.28, depthWrite: false });
const edgeMat = new THREE.LineBasicMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.9 });
const nailMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const nailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

export class BuildTask extends Task {
  kind = 'build';
  pieces: Piece[] = [];
  private solid: THREE.Material;
  constructor(G: Game, id: string, label: string, specs: PieceSpec[], public o: { free?: boolean; reachFrom?: { x: number; z: number }; cost?: Record<string, number> } = {}) {
    super(G, id, label);
    this.reachFrom = o.reachFrom;
    this.solid = mat(PX.planks(PAL.lumber, 31, 4));
    const pile = mat(PX.planks('#6b5a48', 15, 16));
    for (const s of specs) {
      const mesh = new THREE.Mesh(uvBox(s.w, s.h, s.d, 4), ghostMat);
      mesh.position.set(s.x, s.y + s.h / 2, s.z);
      mesh.userData.solid = s.tex === 'pile' ? pile : this.solid;
      mesh.visible = false;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat);
      mesh.add(edges);
      G.kit.group.add(mesh);
      const p: Piece = { spec: s, mesh, edges, state: 0, nails: [] };
      const flat = s.h < 0.2 && s.d > 0.6, vertical = s.h > s.w && s.h > s.d;
      for (let i = 0; i < s.nails; i++) {
        const t = s.nails === 1 ? 0.5 : 0.12 + (0.76 * i) / (s.nails - 1);
        const m = new THREE.Mesh(nailGeo, nailMat);
        if (flat) m.position.set(s.rotNail ? 0 : (t - 0.5) * s.w, s.h / 2 + 0.05, s.rotNail ? (t - 0.5) * s.d : 0);
        else if (vertical) m.position.set(0, (t - 0.5) * s.h * 0.7 + s.h * 0.12, s.d / 2 + 0.05);
        else m.position.set((t - 0.5) * s.w, 0, s.d / 2 + 0.05);
        m.visible = false;
        mesh.add(m);
        p.nails.push({ m, hp: 3 });
      }
      this.pieces.push(p);
      this.pos.add(mesh.position);
    }
    this.pos.multiplyScalar(1 / specs.length);
    this.pos.y = Math.max(0, this.pos.y - 0.5);
  }
  progress() {
    let n = 0, t = 0;
    for (const p of this.pieces) { t += 1 + p.nails.length; n += (p.state > 0 ? 1 : 0) + p.nails.filter((x) => x.hp <= 0).length; }
    return n / t;
  }
  refresh() {
    for (const p of this.pieces) {
      p.mesh.visible = this.done || this.active || p.state > 0;
      const built = this.done || p.state > 0;
      p.mesh.material = built ? p.mesh.userData.solid : ghostMat;
      p.mesh.castShadow = built; p.mesh.receiveShadow = built;
      p.edges.visible = !built;
      for (const n of p.nails) n.m.visible = !this.done && p.state === 1 && n.hp > 0;
    }
  }
  pick(ray: THREE.Raycaster): Hit | null {
    let best: Hit | null = null;
    for (const p of this.pieces) {
      if (p.state === 2) continue;
      if (p.state === 1) {
        for (const n of p.nails) if (n.hp > 0) {
          const wp = n.m.getWorldPosition(new THREE.Vector3());
          const d = ray.ray.distanceToPoint(wp);
          if (d < 0.42) { const dist = ray.ray.origin.distanceTo(wp) - 2 + d; if (!best || dist < best.dist) best = { task: this, point: wp, dist, target: { p, n } }; }
        }
      } else {
        const r = ray.intersectObject(p.mesh, false)[0];
        if (r && (!best || r.distance < best.dist)) best = { task: this, point: r.point, dist: r.distance, target: { p } };
      }
    }
    return best;
  }
  private finishPiece(p: Piece) {
    p.state = 2;
    this.G.addXp('carpentry', 5);
    this.G.fx.burst(p.mesh.position, 8, { colors: ['#e8cf9a', '#c9a56a'], speed: 1.6, up: 1.6, life: 0.6, size: 0.07 });
    this.refresh();
    if (this.pieces.every((q) => q.state === 2)) this.complete();
  }
  private place(p: Piece, silent = false): boolean {
    const G = this.G;
    if (!this.o.free) {
      if (!silent && !G.materialsNear()) { G.toast('Your lumber is on the truck. Park it closer.', 'warn'); return false; }
      if (G.S.inv.lumber < 1) { if (!silent) G.toast('Out of lumber — pick some up at Brannigan Lumber.', 'warn'); return false; }
      G.S.inv.lumber--;
    }
    if (this.o.cost && this.pieces.every((q) => q.state === 0)) for (const k in this.o.cost) (G.S.inv as any)[k] = Math.max(0, (G.S.inv as any)[k] - this.o.cost[k]);
    p.state = 1;
    G.snd.sfx('place');
    G.fx.burst(p.mesh.position, 6, { colors: ['#e8cf9a'], speed: 1.2, up: 1, life: 0.4, size: 0.06 });
    this.refresh();
    if (!p.nails.length) this.finishPiece(p);
    return true;
  }
  use(h: Hit, tool: ToolId, _dt: number, clicked: boolean): boolean {
    const G = this.G, { p, n } = h.target as { p: Piece; n?: { m: THREE.Mesh; hp: number } };
    if (!this.needTool(tool, 'hammer', clicked)) return false;
    const gun = G.S.tools.nailgun;
    if (!n) { if (!clicked) return false; return this.place(p); }
    if (!clicked && !(gun && G.work.cool <= 0)) return false;
    if (G.work.cool > 0) return false;
    if (G.S.inv.nails < 1) { if (clicked) G.toast('Out of nails!', 'warn'); return false; }
    G.work.cool = gun ? 0.16 : 0.24;
    n.hp -= gun ? 3 : G.skillLv('carpentry') >= 3 ? 2 : 1;
    G.snd.sfx(gun ? 'nailgun' : 'hammer');
    G.gfx.shake = Math.max(G.gfx.shake, 0.05);
    G.fx.burst(h.point, 4, { colors: ['#fff6cf', '#e8cf9a'], speed: 1.5, up: 1, life: 0.3, size: 0.05, glow: true });
    n.m.scale.setScalar(Math.max(0.3, n.hp / 3));
    if (n.hp <= 0) {
      G.S.inv.nails--; n.m.visible = false; G.snd.sfx('nail'); G.addXp('carpentry', 1.5);
      if (p.nails.every((q) => q.hp <= 0)) this.finishPiece(p);
    }
    return true;
  }
  auto() {
    for (const p of this.pieces) {
      if (p.state === 0) { if (!this.place(p, true)) return null; return p.mesh.position.clone(); }
      if (p.state === 1) { const n = p.nails.find((q) => q.hp > 0); if (n) { n.hp = 0; n.m.visible = false; this.G.snd.sfx('hammer'); if (p.nails.every((q) => q.hp <= 0)) this.finishPiece(p); } return p.mesh.position.clone(); }
    }
    return null;
  }
  restore(d: any) { for (const p of this.pieces) { p.state = 2; p.nails.forEach((n) => (n.hp = 0)); } super.restore(d); }
  reset() { for (const p of this.pieces) { p.state = 0; p.nails.forEach((n) => { n.hp = 3; n.m.scale.setScalar(1); }); } super.reset(); }
  update() { const s = 0.8 + Math.sin(performance.now() / 140) * 0.25; if (this.active) for (const p of this.pieces) if (p.state === 1) for (const n of p.nails) if (n.hp > 0) n.m.rotation.set(0, 0, performance.now() / 300), n.m.scale.setScalar(s * Math.max(0.45, n.hp / 3)); }
}

// ───────────────────────── demolition ─────────────────────────
export interface DemoSpec { x: number; y: number; z: number; w: number; h: number; d: number; hp: number }
interface DemoPiece { spec: DemoSpec; mesh: THREE.Mesh; hp: number; col?: any; gone: boolean; shake: number }
export class DemoTask extends Task {
  kind = 'demo';
  pieces: DemoPiece[] = [];
  private m: THREE.Material;
  constructor(G: Game, id: string, label: string, specs: DemoSpec[], public o: { tex?: THREE.Texture; collide?: boolean } = {}) {
    super(G, id, label);
    this.m = mat(o.tex ?? PX.rotten(1));
    for (const s of specs) this.spawn(s);
    for (const p of this.pieces) this.pos.add(p.mesh.position);
    this.pos.multiplyScalar(1 / specs.length); this.pos.y = Math.max(0, this.pos.y - 0.6); this.pos.z += 0.4;
  }
  private spawn(s: DemoSpec) {
    const mesh = new THREE.Mesh(uvBox(s.w, s.h, s.d, 4), this.m);
    mesh.position.set(s.x, s.y + s.h / 2, s.z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.G.kit.group.add(mesh);
    const col = this.o.collide ? this.G.phys.box(s.x, s.y + s.h / 2, s.z, s.w / 2, s.h / 2, Math.max(0.15, s.d / 2)) : undefined;
    this.pieces.push({ spec: s, mesh, hp: s.hp, col, gone: false, shake: 0 });
  }
  progress() { return this.pieces.filter((p) => p.gone).length / this.pieces.length; }
  pick(ray: THREE.Raycaster): Hit | null {
    let best: Hit | null = null;
    for (const p of this.pieces) { if (p.gone) continue; const r = ray.intersectObject(p.mesh, false)[0]; if (r && (!best || r.distance < best.dist)) best = { task: this, point: r.point, dist: r.distance, target: p }; }
    return best;
  }
  private smash(p: DemoPiece, quiet = false) {
    const G = this.G, s = p.spec;
    p.gone = true; p.mesh.visible = false;
    if (p.col) { G.phys.remove(p.col); p.col = undefined; }
    if (quiet) return;
    const n = Math.min(8, Math.max(3, Math.round(s.w * s.h * s.d * 20 + 3)));
    for (let i = 0; i < n; i++) {
      const cw = Math.max(0.12, s.w / 3) * (0.5 + Math.random() * 0.6), ch = Math.max(0.1, s.h / 3) * (0.5 + Math.random() * 0.6), cd = Math.max(0.06, s.d * 0.7);
      const m = new THREE.Mesh(uvBox(cw, ch, cd, 4), this.m);
      m.position.set(s.x + (Math.random() - 0.5) * s.w * 0.8, s.y + s.h * Math.random(), s.z + (Math.random() - 0.5) * s.d);
      m.castShadow = true;
      G.kit.group.add(m);
      G.phys.debris(m, cw / 2, ch / 2, cd / 2, new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 4, 1 + Math.random() * 4), 7 + Math.random() * 3);
    }
    G.snd.sfx('smash'); G.gfx.shake = 0.35;
    G.fx.burst(p.mesh.position, 26, { colors: ['#8a7a5c', '#5f5648', '#b9ad90'], speed: 3.5, up: 3, life: 0.9, size: 0.1 });
    G.addXp('demolition', 6);
    if (G.skillLv('demolition') >= 3 && Math.random() < 0.5) { G.S.inv.lumber++; G.toast('Salvaged a good board. +1 lumber', 'good'); }
    if (this.pieces.every((q) => q.gone)) this.complete();
  }
  use(h: Hit, tool: ToolId, _dt: number, clicked: boolean): boolean {
    const G = this.G, p = h.target as DemoPiece;
    if (!clicked) return false;
    if (!this.needTool(tool, 'sledge', clicked)) return false;
    if (G.work.cool > 0) return false;
    G.work.cool = 0.42;
    p.hp -= (G.S.tools.heavySledge ? 2 : 1) + (G.skillLv('demolition') >= 4 ? 1 : 0);
    p.shake = 0.25;
    G.snd.sfx('thud'); G.gfx.shake = Math.max(G.gfx.shake, 0.16);
    G.fx.burst(h.point, 9, { colors: ['#8a7a5c', '#5f5648'], speed: 2.4, up: 2, life: 0.5, size: 0.07 });
    G.addXp('demolition', 1.5);
    if (p.hp <= 0) this.smash(p);
    return true;
  }
  auto() { const p = this.pieces.find((q) => !q.gone); if (!p) return null; p.hp--; p.shake = 0.25; this.G.snd.sfx('thud'); const pos = p.mesh.position.clone(); if (p.hp <= 0) this.smash(p); return pos; }
  update(dt: number) { for (const p of this.pieces) if (p.shake > 0) { p.shake -= dt; p.mesh.rotation.z = Math.sin(p.shake * 60) * p.shake * 0.25; } }
  restore(d: any) { for (const p of this.pieces) if (!p.gone) this.smash(p, true); super.restore(d); }
  reset() { for (const p of this.pieces) { p.gone = false; p.hp = p.spec.hp; p.mesh.visible = true; if (this.o.collide && !p.col) p.col = this.G.phys.box(p.spec.x, p.spec.y + p.spec.h / 2, p.spec.z, p.spec.w / 2, p.spec.h / 2, Math.max(0.15, p.spec.d / 2)); } super.reset(); }
}

// ───────────────────────── rubble (push it with a machine, or break it by hand) ─────────────────────────
export class RubbleTask extends Task {
  kind = 'rubble';
  bodies: DynBody[] = [];
  private t = 0;
  private n0: number;
  constructor(G: Game, id: string, label: string, public zone: { x: number; z: number; w: number; d: number }, count: number) {
    super(G, id, label);
    this.n0 = count;
    this.pos.set(zone.x, 0, zone.z + zone.d / 2 + 0.5);
    const R = rng(id.length * 91);
    const mats = [mat(PX.concrete('#9a978e', 4)), mat(PX.brick('#8a5a48', 5)), mat(PX.rotten(4))];
    for (let i = 0; i < count; i++) {
      const s = 0.55 + R() * 0.5, m = new THREE.Mesh(uvBox(s, s * 0.8, s * 0.9, 4), mats[i % 3]);
      m.position.set(zone.x + (R() - 0.5) * zone.w * 0.8, 0.5 + Math.floor(i / 8) * 0.9, zone.z + (R() - 0.5) * zone.d * 0.7);
      m.castShadow = m.receiveShadow = true;
      G.kit.group.add(m);
      this.bodies.push(G.phys.debris(m, s / 2, s * 0.4, s * 0.45, new THREE.Vector3(), Infinity, 3, { hp: 2 }));
    }
  }
  private inZone() { const z = this.zone; return this.bodies.filter((b) => { const t = b.body.translation(); return Math.abs(t.x - z.x) < z.w / 2 && Math.abs(t.z - z.z) < z.d / 2 + 0.3 && t.y > -0.5; }).length; }
  progress() { return 1 - Math.min(1, this.inZone() / this.n0); }
  pick(ray: THREE.Raycaster): Hit | null {
    let best: Hit | null = null;
    for (const b of this.bodies) { const r = ray.intersectObject(b.mesh, false)[0]; if (r && (!best || r.distance < best.dist)) best = { task: this, point: r.point, dist: r.distance, target: b }; }
    return best;
  }
  private breakBody(b: DynBody) {
    const G = this.G, p = b.mesh.position.clone();
    this.bodies.splice(this.bodies.indexOf(b), 1);
    G.phys.removeDyn(b);
    G.snd.sfx('smash'); G.gfx.shake = 0.3;
    G.fx.burst(p, 22, { colors: ['#9a978e', '#6f6a66', '#b9b4a6'], speed: 3.2, up: 3, life: 0.8, size: 0.1 });
    G.addXp('demolition', 4);
  }
  use(h: Hit, tool: ToolId, _dt: number, clicked: boolean): boolean {
    const G = this.G, b = h.target as DynBody;
    if (!clicked) return false;
    if (!this.needTool(tool, 'sledge', clicked)) return false;
    if (G.work.cool > 0) return false;
    G.work.cool = 0.42;
    b.data.hp -= G.S.tools.heavySledge ? 2 : 1;
    G.snd.sfx('thud'); G.gfx.shake = Math.max(G.gfx.shake, 0.16);
    G.fx.burst(h.point, 8, { colors: ['#9a978e', '#6f6a66'], speed: 2.2, up: 2, life: 0.5, size: 0.07 });
    b.body.applyImpulse({ x: (Math.random() - 0.5) * 6, y: 8, z: -4 }, true);
    if (b.data.hp <= 0) this.breakBody(b);
    return true;
  }
  auto() { const b = this.bodies[0]; if (!b) return null; const p = b.mesh.position.clone(); this.breakBody(b); return p; }
  update(dt: number) {
    if (!this.active || this.done) return;
    this.t += dt;
    if (this.t > 0.5) { this.t = 0; if (this.inZone() <= 1) { this.clear(); this.complete(); } }
  }
  clear() { for (const b of this.bodies) b.life = 2.5; this.bodies = []; }
  restore(d: any) { for (const b of [...this.bodies]) this.G.phys.removeDyn(b); this.bodies = []; super.restore(d); }
}

// ───────────────────────── sawing ─────────────────────────
/** Bench saw: a quick, skill-based cut-to-the-line at a sawhorse (UI in ui.ts). */
export class SawTask extends Task {
  kind = 'saw';
  cut = 0;
  constructor(G: Game, id: string, label: string, x: number, z: number, public count: number) {
    super(G, id, label);
    this.pos.set(x, 0, z + 0.4);
    G.addInteract({ id: 'saw_' + id, x, z: z + 0.9, r: 2.2, label: 'Cut boards to length', when: () => this.active && !this.done, act: () => this.open() });
  }
  progress() { return this.cut / this.count; }
  open() {
    const G = this.G;
    if (G.S.tool !== 'saw') { G.toast('Equip your saw [5] first.', 'warn'); return; }
    if (G.S.inv.lumber < 1) { G.toast('You need lumber to cut. Brannigan Lumber has plenty.', 'warn'); return; }
    if (!G.materialsNear()) { G.toast('Your lumber is on the truck. Park it closer.', 'warn'); return; }
    G.ui.sawGame(this);
  }
  /** called by the saw UI after each cut; err is distance from the pencil line in 0..1 board units */
  result(err: number) {
    const G = this.G, tol = G.S.tools.circsaw ? 0.07 : 0.045;
    G.S.inv.lumber--;
    G.snd.sfx('cut');
    if (err <= tol * (G.skillLv('carpentry') >= 5 ? 1.5 : 1)) { this.cut++; G.addXp('carpentry', err < tol / 3 ? 8 : 5); if (this.cut >= this.count) this.complete(); return err < tol / 3 ? 'perfect' : 'good'; }
    return 'miss';
  }
  restore(d: any) { this.cut = this.count; super.restore(d); }
  reset() { this.cut = 0; super.reset(); }
}

/** Fallen trees: hold the saw on the cut marks until each log drops apart. */
interface Log { mesh: THREE.Mesh; marks: { m: THREE.Mesh; p: number }[]; spec: { x: number; z: number; len: number; rot: number }; gone: boolean }
export class LogTask extends Task {
  kind = 'logs';
  logs: Log[] = [];
  constructor(G: Game, id: string, label: string, specs: { x: number; z: number; len: number; rot: number }[]) {
    super(G, id, label);
    for (const s of specs) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, s.len, 8), mat(PX.bark('#5d4a3a')));
      mesh.rotation.z = Math.PI / 2; mesh.rotation.y = s.rot; mesh.position.set(s.x, 0.48, s.z);
      mesh.castShadow = mesh.receiveShadow = true;
      G.kit.group.add(mesh);
      const marks = [-0.22, 0.22].map((t) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xff7a5a })); m.position.y = t * s.len; m.visible = false; mesh.add(m); return { m, p: 0 }; });
      this.logs.push({ mesh, marks, spec: s, gone: false });
      this.pos.set(s.x + 1.8, 0, s.z);
    }
  }
  progress() { let n = 0, t = 0; for (const l of this.logs) for (const m of l.marks) { t++; n += Math.min(1, m.p); } return n / t; }
  refresh() { for (const l of this.logs) for (const m of l.marks) m.m.visible = this.active && m.p < 1; }
  pick(ray: THREE.Raycaster): Hit | null {
    let best: Hit | null = null;
    for (const l of this.logs) { if (l.gone) continue; for (const mk of l.marks) { if (mk.p >= 1) continue; const wp = mk.m.getWorldPosition(new THREE.Vector3()); const d = ray.ray.distanceToPoint(wp); if (d < 0.8) { const dist = ray.ray.origin.distanceTo(wp); if (!best || dist < best.dist) best = { task: this, point: wp, dist, target: { l, mk } }; } } }
    return best;
  }
  use(h: Hit, tool: ToolId, dt: number, clicked: boolean): boolean {
    const G = this.G, { l, mk } = h.target as { l: Log; mk: { m: THREE.Mesh; p: number } };
    if (!this.needTool(tool, 'saw', clicked)) return false;
    mk.p += dt * (G.S.tools.circsaw ? 1.3 : 0.5) * (1 + G.skillLv('carpentry') * 0.08);
    mk.m.scale.set(1, Math.max(0.2, 1 - mk.p), 1);
    G.snd.setLoop('saw', true, 0.3);
    if (Math.random() < 0.8) G.fx.burst(h.point, 2, { colors: ['#e8cf9a', '#c9a56a', '#f4e4b8'], speed: 1.8, up: 1.6, life: 0.6, size: 0.06 });
    if (mk.p >= 1) { mk.m.visible = false; G.snd.sfx('cut'); G.addXp('carpentry', 6); if (l.marks.every((q) => q.p >= 1)) this.drop(l); }
    return true;
  }
  private drop(l: Log, quiet = false) {
    const G = this.G, s = l.spec;
    l.gone = true; l.mesh.visible = false;
    if (!quiet) {
      const dir = new THREE.Vector3(Math.cos(s.rot), 0, -Math.sin(s.rot));
      for (const t of [-0.36, 0, 0.36]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, s.len * 0.3, 8), mat(PX.bark('#5d4a3a')));
        m.rotation.z = Math.PI / 2; m.rotation.y = s.rot; m.position.set(s.x + dir.x * t * s.len, 0.5, s.z + dir.z * t * s.len); m.castShadow = true;
        G.kit.group.add(m);
        G.phys.debris(m, s.len * 0.15, 0.4, 0.4, new THREE.Vector3(dir.x * t * 5, 2, dir.z * t * 5 + (t === 0 ? 2 : 0)), 6);
      }
      G.snd.sfx('thud');
    }
    if (this.logs.every((q) => q.gone)) this.complete();
  }
  restore(d: any) { for (const l of this.logs) { l.gone = true; l.mesh.visible = false; } super.restore(d); }
}

/** Engineering work happens on the drafting board (UI in ui.ts). */
export class PuzzleTask extends Task {
  kind = 'puzzle';
  constructor(G: Game, id: string, label: string, x: number, z: number, public puzzle: 'truss' | 'piles') {
    super(G, id, label);
    this.pos.set(x, 0, z);
    G.addInteract({ id: 'pz_' + id, x, z, r: 2.4, label: puzzle === 'truss' ? 'Set up the drafting board' : 'Lay out the piles', when: () => this.active && !this.done, act: () => G.ui.puzzle(this) });
  }
  progress() { return this.done ? 1 : 0; }
}

// ───────────────────────── the work controller ─────────────────────────
export class Work {
  hover: Hit | null = null;
  cool = 0;
  reticle: THREE.Mesh;
  busy = 0;
  constructor(private G: Game) {
    const [c, g] = PX.mkCanvas(16, 16);
    g.fillStyle = '#fff';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillRect(Math.round(7.5 + Math.cos(a) * 6.5), Math.round(7.5 + Math.sin(a) * 6.5), 1, 1); }
    g.fillRect(7, 7, 2, 2);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
    this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
    this.reticle.renderOrder = 20; this.reticle.visible = false;
    G.gfx.scene.add(this.reticle);
  }
  inReach(h: Hit) {
    const p = this.G.player.pos, rf = h.task.reachFrom;
    if (rf) return Math.hypot(p.x - rf.x, p.z - rf.z) < 5.5;
    return Math.hypot(p.x - h.point.x, p.z - h.point.z) < 4.6;
  }
  update(dt: number) {
    const G = this.G, I = G.input;
    this.cool -= dt; this.busy -= dt;
    let used = false;
    this.hover = null;
    if (!G.ui.blocking && !G.player.driving && !I.mouse.overUI) {
      G.gfx.ray.setFromCamera(new THREE.Vector2(I.mouse.nx, I.mouse.ny), G.gfx.camera);
      for (const t of G.tasks.values()) {
        if (!t.active || t.done) continue;
        const h = t.pick(G.gfx.ray);
        if (h && (!this.hover || h.dist < this.hover.dist)) this.hover = h;
      }
      const h = this.hover;
      if (h) {
        const reach = this.inReach(h);
        if ((I.mouse.down || I.mouse.clicked) && I.enabled) {
          if (!reach) { if (I.mouse.clicked) G.toast('Too far away — step closer.', 'warn'); }
          else if (h.task.use(h, G.S.tool, dt, I.mouse.clicked)) { used = true; this.busy = 0.3; G.player.workAt(h.point); }
        }
        this.reticle.visible = true;
        this.reticle.position.copy(h.point);
        this.reticle.quaternion.copy(G.gfx.camera.quaternion);
        const s = h.task.kind === 'paint' ? (G.S.tool === 'washer' ? 1.2 : G.S.tools.sprayer ? 1.8 : G.S.tools.roller ? 1.3 : 0.9) : 0.7;
        this.reticle.scale.setScalar(s);
        (this.reticle.material as THREE.MeshBasicMaterial).color.setHex(reach ? 0xfff2b0 : 0xff6a5a);
      }
    }
    if (!this.hover) this.reticle.visible = false;
    if (!used || G.S.tool !== 'paint') G.snd.setLoop('paint', false);
    if (!used || G.S.tool !== 'washer') G.snd.setLoop('wash', false);
    if (!used || G.S.tool !== 'saw') G.snd.setLoop('saw', false);
    for (const t of G.tasks.values()) t.update(dt);
  }
}
