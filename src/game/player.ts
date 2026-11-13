// The apprentice: a pixel-art billboard driven by a Rapier kinematic character controller.
import * as THREE from 'three';
import { RAPIER } from '../engine/physics';
import { Billboard, CharSpec, ToolLook } from '../art/sprites';
import { PAINTS } from '../art/pixel';
import type { Game } from './game';
import type { Vehicle } from './vehicle';

export const PLAYER_SPEC: CharSpec = { skin: '#e8b78e', hair: '#6b4630', hairStyle: 'short', hat: 'cap', hatColor: '#b5463c', shirt: '#d9d0b8', style: 'overalls', pants: '#4a6a94', accent: '#e2c15a', shoes: '#5b4032' };

export class Player {
  pos = new THREE.Vector3();
  bb: Billboard;
  body: RAPIER.RigidBody; col: RAPIER.Collider; ctl: RAPIER.KinematicCharacterController;
  driving: Vehicle | null = null;
  zoom = 25;
  private workT = 0;
  private stepT = 0;
  private vy = 0;
  stamina = 1;

  constructor(private G: Game) {
    this.bb = new Billboard(PLAYER_SPEC, true);
    G.gfx.scene.add(this.bb.root);
    const k = G.phys.kinematic(0, 1, 0, RAPIER.ColliderDesc.capsule(0.5, 0.34));
    this.body = k.body; this.col = k.col; this.ctl = k.ctl;
    this.ctl.setApplyImpulsesToDynamicBodies(false);
  }
  teleport(x: number, z: number) {
    this.body.setTranslation({ x, y: 0.9, z }, true);
    this.body.setNextKinematicTranslation({ x, y: 0.9, z });
    this.pos.set(x, 0, z);
    this.bb.root.position.copy(this.pos);
  }
  refreshLook() {
    const S = this.G.S, t = S.tool;
    const look: ToolLook = t === 'hammer' ? (S.tools.nailgun ? 'nailgun' : 'hammer') : t === 'paint' ? 'roller' : t === 'sledge' ? 'sledge' : t === 'saw' ? 'saw' : t === 'washer' ? 'washer' : 'none';
    this.bb.setSpec({ ...PLAYER_SPEC, tool: look, toolColor: t === 'paint' ? PAINTS[S.paintColor].c : undefined });
  }
  workAt(p: THREE.Vector3) { this.workT = 0.35; this.bb.face(p.x - this.pos.x, p.z - this.pos.z + 0.01); if (p.z < this.pos.z && Math.abs(p.x - this.pos.x) < 2.5) this.bb.dir = 3; }
  enter(v: Vehicle) {
    this.driving = v; v.driver = true;
    this.bb.root.visible = false;
    this.col.setEnabled(false);
    this.G.snd.sfx('engine');
    this.G.ui.refreshHotbar();
  }
  exit() {
    const v = this.driving!;
    if (Math.abs(v.speed) > 2) { this.G.toast('Stop the vehicle first.', 'warn'); return; }
    // find a clear spot beside the vehicle
    const side = new THREE.Vector3(Math.sin(v.rot), 0, Math.cos(v.rot));
    let spot = v.pos.clone().addScaledVector(side, 1.9);
    if (this.G.town.isWater(spot.x, spot.z)) spot = v.pos.clone().addScaledVector(side, -1.9);
    this.driving = null; v.driver = false; v.speed = 0;
    this.col.setEnabled(true);
    this.bb.root.visible = true;
    this.teleport(spot.x, spot.z);
    this.G.snd.sfx('door');
    this.G.ui.refreshHotbar();
  }
  update(dt: number) {
    const G = this.G, I = G.input;
    if (this.driving) { this.pos.copy(this.driving.pos); this.pos.y = 0; return; }
    const a = I.axis();
    const len = Math.hypot(a.x, a.z);
    const sprint = I.key('ShiftLeft', 'ShiftRight') && len > 0 && this.stamina > 0.05;
    this.stamina = Math.max(0, Math.min(1, this.stamina + (sprint ? -dt / (6 + G.skillLv('exploration') * 2.5) : dt / 4)));
    const speed = (sprint ? 7.6 : 4.7) * (this.workT > 0 ? 0.25 : 1);
    let mx = 0, mz = 0;
    if (len > 0) { mx = (a.x / len) * speed * dt; mz = (a.z / len) * speed * dt; }
    this.vy = Math.max(-20, this.vy - 30 * dt);
    this.ctl.computeColliderMovement(this.col, { x: mx, y: this.vy * dt, z: mz });
    const m = this.ctl.computedMovement();
    if (this.ctl.computedGrounded()) this.vy = 0;
    const t = this.body.translation();
    const nx = t.x + m.x, ny = Math.max(0.84, t.y + m.y), nz = t.z + m.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.pos.set(nx, ny - 0.84, nz);
    this.bb.root.position.copy(this.pos);
    this.workT -= dt;
    if (this.workT > 0) this.bb.anim = 'work';
    else if (len > 0 && Math.hypot(m.x, m.z) > 0.2 * speed * dt) {
      this.bb.anim = 'walk'; this.bb.face(a.x, a.z);
      this.stepT -= dt * (sprint ? 1.6 : 1);
      if (this.stepT <= 0) { this.stepT = 0.3; G.snd.sfx('step'); if (sprint) G.fx.burst(this.pos, 2, { colors: ['#c9b89a'], speed: 0.6, up: 0.6, life: 0.4, size: 0.07 }); }
    } else this.bb.anim = 'idle';
    this.bb.update(dt * (sprint ? 1.4 : 1), G.gfx.yaw);
    // discover landmarks
    if (len > 0 && Math.random() < 0.05) G.ui.checkDiscover();
  }
}
