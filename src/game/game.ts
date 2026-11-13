// Game core: owns every system, the save state, progression and the frame loop.
import * as THREE from 'three';
import { Gfx } from '../engine/gfx';
import { Input } from '../engine/input';
import { Physics } from '../engine/physics';
import { Sound } from '../engine/audio';
import { Fx } from '../engine/fx';
import { Kit } from '../world/kit';
import { Sky } from '../world/sky';
import { Town } from '../world/town';
import { Task, Work, ToolId, PaintTask } from './work';
import { Player } from './player';
import { Vehicle } from './vehicle';
import { Npc, Critters } from './npc';
import { UI } from '../ui/ui';
import * as C from './content';
import { TILE } from '../art/pixel';

export const SKILLS = ['carpentry', 'painting', 'engineering', 'demolition', 'business', 'negotiation', 'exploration'] as const;
export type Skill = (typeof SKILLS)[number];
const LV = [0, 40, 110, 220, 380];
const SAVE_KEY = 'contractor-legends-save-v1';

export interface Save {
  v: number; name: string; money: number; rep: number; day: number; time: number;
  pos: { x: number; z: number }; truck: { x: number; z: number; rot: number }; skid: { x: number; z: number; rot: number };
  skills: Record<Skill, number>;
  inv: { lumber: number; nails: number; paint: number; concrete: number; bulbs: number };
  items: string[];
  tools: Record<string, boolean>;
  tool: ToolId; paintColor: number;
  flags: Record<string, any>;
  quests: Record<string, { step: number; done: boolean }>;
  trust: Record<string, number>;
  crew: Record<string, { hired: boolean; assign: 'jobs' | 'assist' }>;
  props: Record<string, { owned: boolean; restored: boolean }>;
  contracts: { offers: C.Offer[]; active: C.Offer | null; done: number; seed: number };
  stats: { earned: number; jobs: number; found: string[] };
  playtime: number;
}

export interface Interact { id: string; x: number; z: number; r?: number; label: string | (() => string); when?: () => any; act: () => void }

export class Game {
  gfx: Gfx; input: Input; phys: Physics; snd = new Sound(); fx: Fx; kit: Kit; sky: Sky; town: Town; ui: UI; work!: Work;
  player!: Player; truck!: Vehicle; skid!: Vehicle; npcs: Npc[] = []; critters!: Critters;
  S!: Save;
  places: Record<string, { x: number; z: number }> = {};
  tasks = new Map<string, Task>();
  interacts: Interact[] = [];
  gates: Record<string, any> = {};
  sceneFlags: Record<string, any> = {};
  bobbers: { o: THREE.Object3D; y: number; ph: number }[] = [];
  running = false;
  cine: { t: number; shots: C.Shot[]; i: number; done?: () => void } | null = null;
  near: { label: string; act: () => void } | null = null;
  private qTick = 0;
  private autoT = 0;
  private last = 0;
  fadeTo = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.gfx = new Gfx(canvas);
    this.input = new Input(canvas);
    this.phys = new Physics();
    this.fx = new Fx(this.gfx.scene);
    this.kit = new Kit(this.phys);
    this.sky = new Sky(this.gfx, this.kit, this.fx);
    this.S = this.fresh('Riley');
    this.town = new Town(this);
    this.ui = new UI(this);
    this.town.build();
    this.work = new Work(this);
    this.player = new Player(this);
    this.truck = new Vehicle(this, 'truck');
    this.skid = new Vehicle(this, 'skid');
    for (const d of C.NPCS) this.npcs.push(new Npc(this, d));
    this.critters = new Critters(this);
    this.addInteract({ id: 'truck', x: 0, z: 0, r: 2.6, label: 'Drive the truck', when: () => !this.player.driving && this.nearVehicle(this.truck), act: () => this.player.enter(this.truck) });
    this.addInteract({ id: 'skid', x: 0, z: 0, r: 2.4, label: 'Operate the skid steer', when: () => !this.player.driving && this.S.tools.skid && this.nearVehicle(this.skid), act: () => { if (this.skillLv('engineering') < 2) this.toast('You need Engineering Lv 2 to run heavy equipment.', 'warn'); else this.player.enter(this.skid); } });
    window.addEventListener('beforeunload', () => { if (this.running) this.save(true); });
  }
  private nearVehicle(v: Vehicle) { const it = this.interacts.find((i) => i.id === v.id)!; it.x = v.pos.x; it.z = v.pos.z; return true; }

  fresh(name: string): Save {
    return {
      v: 1, name, money: 120, rep: 0, day: 1, time: 7.2,
      pos: { x: -15.5, z: 16.5 }, truck: { x: -8, z: 14.5, rot: 0 }, skid: { x: -14, z: -13, rot: 0 },
      skills: { carpentry: 0, painting: 0, engineering: 0, demolition: 0, business: 0, negotiation: 0, exploration: 0 },
      inv: { lumber: 0, nails: 30, paint: 0, concrete: 0, bulbs: 0 }, items: [],
      tools: {}, tool: 'hands', paintColor: 0, flags: {}, quests: {}, trust: {}, crew: {}, props: {},
      contracts: { offers: [], active: null, done: 0, seed: 7 }, stats: { earned: 0, jobs: 0, found: [] }, playtime: 0,
    };
  }

  // ───────────── registration ─────────────
  addTask(t: Task) { this.tasks.set(t.id, t); return t; }
  addInteract(i: Interact) { this.interacts.push(i); }
  openGate(id: string) { if (this.gates[id]) { this.phys.remove(this.gates[id]); this.gates[id] = null; } }
  task(id: string) { return this.tasks.get(id)!; }

  // ───────────── progression ─────────────
  skillLv(s: Skill) { const xp = this.S.skills[s]; let l = 1; for (let i = 1; i < LV.length; i++) if (xp >= LV[i]) l = i + 1; return l; }
  skillProg(s: Skill) { const l = this.skillLv(s), xp = this.S.skills[s]; return l >= 5 ? 1 : (xp - LV[l - 1]) / (LV[l] - LV[l - 1]); }
  addXp(s: Skill, n: number) {
    const before = this.skillLv(s);
    this.S.skills[s] += n;
    const after = this.skillLv(s);
    if (after > before) {
      this.snd.sfx('level');
      this.ui.banner(`${C.SKILL_INFO[s].name} Lv ${after}`, C.SKILL_INFO[s].perks[after - 2] ?? '');
      this.fx.burst(this.player.pos.clone().setY(1.5), 40, { colors: ['#ffe08a', '#fff6cf', '#8fd8c8'], speed: 3, up: 4, life: 1.2, size: 0.1, glow: true });
    }
  }
  earn(n: number, why = '') { n = Math.round(n); this.S.money += n; this.S.stats.earned += n; this.snd.sfx('coin'); this.toast(`+$${n}${why ? ' — ' + why : ''}`, 'money'); }
  spend(n: number) { if (this.S.money < n) { this.toast("You can't afford that.", 'warn'); this.snd.sfx('error'); return false; } this.S.money -= Math.round(n); return true; }
  addRep(n: number) { this.S.rep = Math.max(0, this.S.rep + n); if (n > 0) this.toast(`Reputation +${n}`, 'good'); else if (n < 0) this.toast(`Reputation ${n}`, 'warn'); }
  trust(id: string, n: number) { this.S.trust[id] = Math.max(0, Math.min(10, (this.S.trust[id] ?? 2) + n)); if (n > 0) this.toast(`${C.npcName(id)} trusts you more.`, 'heart'); if (n < 0) this.toast(`${C.npcName(id)} is disappointed.`, 'warn'); }
  give(item: string) { if (!this.S.items.includes(item)) { this.S.items.push(item); this.toast(`Received: ${C.ITEMS[item]?.name ?? item}`, 'good'); this.snd.sfx('sparkle'); } }
  has(item: string) { return this.S.items.includes(item); }
  tier() { return C.tierFor(this); }
  toast(msg: string, kind = '') { this.ui.toast(msg, kind); }
  flag(k: string, v: any = 1) { this.S.flags[k] = v; }
  materialsNear() { const p = this.player.pos, t = this.truck.pos; return Math.hypot(p.x - t.x, p.z - t.z) < 34 || Math.hypot(p.x + 18, p.z - 9) < 22; }
  setTool(t: ToolId) {
    if (t !== 'hands' && t !== 'hammer' && !this.S.tools[t]) { this.toast("You don't own that tool yet.", 'warn'); return; }
    this.S.tool = t; this.player.refreshLook(); this.snd.sfx('ui'); this.ui.refreshHotbar();
  }

  onTaskDone(t: Task) {
    this.snd.sfx('quest');
    this.toast(`Done: ${t.label}`, 'good');
    const gate = ({ can_rubble: 'cannery', trail_logs: 'logs', bridge_truss: 'bridge', diner_deck: 'seat', seawall_build: 'breach' } as any)[t.id];
    if (gate) this.openGate(gate);
    C.onTaskDone(this, t);
    this.syncWorld();
    this.save(true);
  }

  /** Make the 3D world match the save flags (also used right after loading). */
  syncWorld() {
    const f = this.S.flags, sf = this.sceneFlags;
    sf.seat.visible = !!f['task:diner_deck'];
    sf.bridge.visible = !!f['task:bridge_truss'];
    for (const id in this.town.restorables) this.town.setRestored(id, !!this.S.props[id]?.restored || !!f['restored_' + id]);
    this.town.festival.visible = !!f.festival;
    const lit = !!f.lit;
    sf.lighthouse.lampM.emissiveIntensity = lit ? 3 : 0; sf.lighthouse.beam.userData.lit = lit; sf.lighthouse.glow.visible = lit;
    this.kit.lamps.forEach((l) => { if (l.broken && f.lamps_fixed) l.broken = false; });
    this.skid.group.visible = !!this.S.tools.skid;
    this.truck.refresh();
    if (f['task:seawall_build'] && this.town.tileAt(-20, -38) !== TILE.planks) this.town.setTiles(-24, -40, -16, -35, TILE.planks);
  }

  story(id: string) { C.story(this, id); }

  // ───────────── day cycle ─────────────
  sleep() {
    if (this.sky.time > 7 && this.sky.time < 17) { this.toast("It's the middle of the day — there's work to do.", 'warn'); return; }
    this.ui.fade(1, () => {
      if (this.sky.time > 12) { this.sky.day++; this.newDay(); }
      this.sky.time = 6.6; this.sky.weather = Math.random() < 0.7 ? 'clear' : 'cloudy';
      this.save(true);
      this.ui.fade(0);
    });
  }
  newDay() { C.newDay(this); }

  // ───────────── save / load ─────────────
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  save(silent = false) {
    if (!this.running) return;
    const S = this.S;
    S.day = this.sky.day; S.time = this.sky.time;
    S.pos = { x: this.player.pos.x, z: this.player.pos.z };
    S.truck = { x: this.truck.pos.x, z: this.truck.pos.z, rot: this.truck.rot };
    S.skid = { x: this.skid.pos.x, z: this.skid.pos.z, rot: this.skid.rot };
    const mural = this.task('mural') as PaintTask;
    if (mural.done) S.flags['task:mural'] = mural.saveData();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); if (!silent) this.toast('Game saved.', 'good'); } catch { if (!silent) this.toast('Could not save (storage unavailable).', 'warn'); }
  }
  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as Save;
      this.S = { ...this.fresh(d.name), ...d };
      return true;
    } catch { return false; }
  }
  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

  /** Enter the world with the current save state. */
  begin(isNew: boolean) {
    const S = this.S;
    this.sky.day = S.day; this.sky.time = S.time;
    this.player.teleport(S.pos.x, S.pos.z);
    this.truck.place(S.truck.x, S.truck.z, S.truck.rot);
    this.skid.place(S.skid.x, S.skid.z, S.skid.rot);
    for (const t of this.tasks.values()) { const d = S.flags['task:' + t.id]; if (d) t.restore(d); }
    for (const g of ['cannery', 'logs', 'bridge', 'seat', 'breach']) { const tid = ({ cannery: 'can_rubble', logs: 'trail_logs', bridge: 'bridge_truss', seat: 'diner_deck', breach: 'seawall_build' } as any)[g]; if (S.flags['task:' + tid]) this.openGate(g); }
    if (S.flags.stones_open) this.openGate('stones');
    if (S.flags.logs_bypass) this.openGate('logs');
    this.syncWorld();
    C.resumeQuests(this);
    this.player.refreshLook();
    this.gfx.goal.copy(this.player.pos); this.gfx.snap();
    this.running = true;
    this.ui.showHud(true);
    this.ui.refreshHotbar();
    if (isNew) C.intro(this);
    else this.ui.fade(0);
  }

  // ───────────── cinematics ─────────────
  playCine(shots: C.Shot[], done?: () => void) { this.cine = { t: 0, shots, i: 0, done }; this.input.enabled = false; this.ui.showHud(false); this.ui.caption(shots[0].text ?? ''); }
  private updateCine(dt: number) {
    const c = this.cine!;
    const s = c.shots[c.i];
    c.t += dt;
    const k = Math.min(1, c.t / s.dur), e = k * k * (3 - 2 * k);
    const P = (a: number[], b: number[]) => new THREE.Vector3(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e);
    this.gfx.cine = { pos: P(s.from, s.to), look: P(s.lookFrom, s.lookTo ?? s.lookFrom) };
    this.gfx.grade.uniforms.letterbox.value = Math.min(1, this.gfx.grade.uniforms.letterbox.value + dt * 2);
    const skip = this.input.rawHit('Space', 'Enter', 'Escape') || this.input.mouse.clicked;
    if (c.t >= s.dur || skip) {
      c.i++; c.t = 0;
      if (c.i >= c.shots.length) { this.cine = null; this.gfx.cine = null; this.input.enabled = true; this.ui.caption(''); this.ui.showHud(true); this.gfx.goal.copy(this.player.pos); this.gfx.snap(); c.done?.(); }
      else { this.ui.caption(c.shots[c.i].text ?? ''); c.shots[c.i].on?.(this); }
    }
  }

  // ───────────── frame ─────────────
  frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    const I = this.input, ui = this.ui;
    if (this.running) {
      const paused = ui.paused;
      if (!paused) {
        this.S.playtime += dt;
        if (this.cine) this.updateCine(dt);
        else this.gfx.grade.uniforms.letterbox.value = Math.max(0, this.gfx.grade.uniforms.letterbox.value - dt * 2);
        I.enabled = !ui.blocking && !this.cine;
        this.player.update(dt);
        this.truck.update(dt); this.skid.update(dt);
        for (const n of this.npcs) n.update(dt);
        this.critters.update(dt);
        this.work.update(dt);
        this.phys.step(dt);
        this.sky.paused = ui.blocking && !this.cine;
        this.sky.update(dt, this.player.pos, () => this.newDay());
        this.fx.update(dt);
        for (const b of this.bobbers) { b.o.position.y = b.y + Math.sin(now / 900 + b.ph) * 0.07; b.o.rotation.z = Math.sin(now / 1300 + b.ph) * 0.025; }
        this.updateInteract();
        this.qTick -= dt;
        if (this.qTick <= 0) { this.qTick = 0.4; C.tickQuests(this); }
        this.autoT -= dt;
        if (this.autoT <= 0) { this.autoT = 90; this.save(true); }
        this.updateCamera(dt);
        this.updateAudio();
      }
      ui.update(dt);
    } else {
      // title screen: slow orbit over the harbour
      this.sky.update(dt, this.gfx.target);
      this.fx.update(dt);
      const a = now / 26000;
      this.gfx.cine = { pos: new THREE.Vector3(6 + Math.sin(a) * 30, 15, 14 + Math.cos(a) * 12), look: new THREE.Vector3(6 + Math.sin(a) * 8, 2, -40) };
      for (const b of this.bobbers) b.o.position.y = b.y + Math.sin(now / 900 + b.ph) * 0.07;
      for (const n of this.npcs) n.update(dt);
      this.critters.update(dt);
      ui.update(dt);
    }
    this.gfx.update(dt);
    this.snd.update(dt);
    this.gfx.render();
    I.endFrame();
  };

  private updateCamera(dt: number) {
    const g = this.gfx, p = this.player, I = this.input;
    if (!this.ui.blocking && I.mouse.wheel) p.zoom = Math.max(15, Math.min(36, p.zoom + I.mouse.wheel * 2.5));
    const v = p.driving;
    const inside = this.kit.interiors.find((i) => i.inside);
    g.goal.set(p.pos.x + (v ? Math.cos(v.rot) * v.speed * 0.45 : 0), p.pos.y, p.pos.z + (v ? -Math.sin(v.rot) * v.speed * 0.45 : 0) - (inside ? 0 : 1.2));
    g.goalDist = inside ? 15 : v ? p.zoom + 9 : this.ui.inDialogue ? p.zoom - 6 : p.zoom;
    g.goalPitch = inside ? 0.78 : 0.6;
    // interiors: lift roof + front wall when the player steps in
    for (const it of this.kit.interiors) {
      const inNow = !v && p.pos.x > it.x0 + 0.1 && p.pos.x < it.x1 - 0.1 && p.pos.z > it.z0 && p.pos.z < it.z1 - 0.05;
      if (inNow !== !!it.inside) { it.inside = inNow; it.hide.forEach((o) => (o.visible = !inNow)); if (inNow) this.snd.sfx('door'); }
      if (it.light) it.light.intensity += ((inNow ? 34 : 0) - it.light.intensity) * Math.min(1, dt * 6);
    }
    void dt;
  }
  private updateAudio() {
    const p = this.player.pos, w = this.sky.forceWeather ?? this.sky.weather;
    const sea = Math.max(0, Math.min(1, (p.z * -1 - 5) / 35));
    this.snd.sea = sea; this.snd.night = this.sky.night;
    this.snd.setBed('sea', 0.05 + sea * 0.3);
    this.snd.setBed('wind', 0.04 + this.sky.wAmt * 0.12 + (p.x < -52 ? 0.08 : 0));
    this.snd.setBed('rain', w === 'rain' ? this.sky.wAmt * 0.3 : 0);
    const v = this.player.driving;
    this.snd.engine(!!v, v ? v.speed : 0);
  }

  private updateInteract() {
    this.near = null;
    if (this.ui.blocking || this.cine) return;
    const p = this.player.pos;
    let best = 1e9;
    if (this.player.driving) { this.near = { label: 'Get out', act: () => this.player.exit() }; }
    else {
      for (const n of this.npcs) { if (!n.visible) continue; const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < 2.4 && d < best) { best = d; this.near = { label: `Talk to ${n.def.name}`, act: () => n.talk() }; } }
      for (const it of this.interacts) {
        if (it.when && !it.when()) continue;
        const d = Math.hypot(it.x - p.x, it.z - p.z);
        if (d < (it.r ?? 2) && d < best + 0.4) { best = d - 0.4; this.near = { label: typeof it.label === 'string' ? it.label : it.label(), act: it.act }; }
      }
    }
    if (this.near && this.input.hit('KeyE')) { this.near.act(); this.input.pressed.delete('KeyE'); }
    // hotbar & misc keys
    const I = this.input;
    const tools: ToolId[] = ['hands', 'hammer', 'paint', 'sledge', 'saw', 'washer'];
    tools.forEach((t, i) => { if (I.hit('Digit' + (i + 1))) this.setTool(t); });
    if (I.hit('KeyC') && this.S.tool === 'paint') this.ui.paintPicker();
    if (I.hit('F5')) this.save();
  }

  start() { requestAnimationFrame(this.frame); }
}
