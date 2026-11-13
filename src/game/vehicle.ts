// Drivable vehicles: Walt's old pickup and the skid steer. Arcade handling on a Rapier
// kinematic controller — steer toward where you point the stick, slide along obstacles.
import * as THREE from 'three';
import { RAPIER } from '../engine/physics';
import * as PX from '../art/pixel';
import { PAL, mkCanvas } from '../art/pixel';
import { mat } from '../world/kit';
import type { Game } from './game';

function bodyTex(base: string, rust: boolean) {
  const [c, g] = mkCanvas(64, 32);
  const R = PX.rng(base.length * 17);
  g.fillStyle = base; g.fillRect(0, 0, 64, 32);
  g.fillStyle = PX.shade(base, 1.2); g.fillRect(0, 0, 64, 3);
  g.fillStyle = PX.shade(base, 0.7); g.fillRect(0, 27, 64, 5);
  g.fillStyle = PX.shade(base, 0.55); g.fillRect(0, 14, 64, 1);
  if (rust) for (let i = 0; i < 90; i++) { g.fillStyle = R() < 0.5 ? '#9c5a35' : '#6e3d22'; g.fillRect(Math.floor(R() * 64), 18 + Math.floor(R() * 14), 1 + Math.floor(R() * 3), 1); }
  return PX.tex(c);
}

export class Vehicle {
  group = new THREE.Group();
  pos = new THREE.Vector3();
  rot = 0;
  speed = 0;
  driver = false;
  body: RAPIER.RigidBody; col: RAPIER.Collider; ctl: RAPIER.KinematicCharacterController;
  private wheels: THREE.Mesh[] = [];
  private load?: THREE.Group;
  private beams: THREE.Object3D[] = [];
  private bump = 0;
  maxSpeed: number;
  constructor(private G: Game, public id: 'truck' | 'skid') {
    const K = G.kit, g = this.group;
    G.gfx.scene.add(g);
    const wheel = (x: number, z: number, r = 0.42) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 10), mat(PX.flat('#26242e'))); w.rotation.x = Math.PI / 2; w.position.set(x, r, z); w.castShadow = true; g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.32, 6), mat(PX.flat('#b9bfc8'))); hub.rotation.x = Math.PI / 2; hub.position.copy(w.position); g.add(hub); this.wheels.push(w); };
    if (id === 'truck') {
      this.maxSpeed = 13;
      const t = bodyTex('#3f8f8c', true), tm = 4;
      K.box(g, t, 0.1, 0.45, 0, 4.7, 0.75, 1.9, tm);                 // chassis
      K.box(g, t, 0.75, 1.2, 0, 1.5, 0.85, 1.8, tm);                 // cab
      K.flatBox(g, '#eae4d0', 0.75, 2.05, 0, 1.6, 0.1, 1.86);        // roof
      K.flatBox(g, '#bfe0ee', 1.52, 1.3, 0, 0.06, 0.6, 1.6, false);  // windshield
      K.flatBox(g, '#bfe0ee', 0.75, 1.35, 0.92, 1.1, 0.5, 0.04, false); K.flatBox(g, '#bfe0ee', 0.75, 1.35, -0.92, 1.1, 0.5, 0.04, false);
      K.box(g, t, 1.95, 0.95, 0, 1.0, 0.45, 1.8, tm);                // hood
      K.flatBox(g, '#c9c5b8', 2.5, 0.5, 0, 0.12, 0.3, 1.95);         // bumper
      K.flatBox(g, '#c9c5b8', -2.3, 0.5, 0, 0.12, 0.3, 1.95);
      for (const z of [-0.9, 0.9]) K.box(g, t, -1.15, 1.2, z, 2.2, 0.45, 0.1, tm);
      K.box(g, t, -2.22, 1.2, 0, 0.1, 0.45, 1.9, tm);
      K.box(g, PX.planks('#7a5a3c', 4, 4), -1.15, 1.16, 0, 2.1, 0.06, 1.7, tm, false);
      K.sign(g, 'HOLLIS', 0.75, 1.0, 0.96, { bg: '#3f8f8c', fg: '#eae4d0', w: 1.1, px: 44 });
      for (const z of [-0.6, 0.6]) { K.flatBox(g, '#fff6cf', 2.47, 0.95, z, 0.06, 0.2, 0.3, false); const gl = K.glow(0, 0, 0, 1.6, 0xfff0c0); g.add(gl); gl.position.set(2.6, 0.95, z); }
      wheel(1.6, 0.9); wheel(1.6, -0.9); wheel(-1.4, 0.9); wheel(-1.4, -0.9);
      this.load = new THREE.Group(); g.add(this.load);
      for (let i = 0; i < 3; i++) K.box(this.load, PX.planks(PAL.lumber, 20 + i, 4), -1.15, 1.22 + i * 0.16, (i - 1) * 0.3, 2.0, 0.14, 0.9, 4);
      K.flatBox(this.load, '#b9bfc8', -1.9, 1.22, 0.55, 0.36, 0.4, 0.36);
      const sl = new THREE.SpotLight(0xfff0c0, 0, 30, 0.55, 0.6, 1.2); sl.position.set(2.4, 1, 0); sl.target.position.set(10, 0, 0); g.add(sl, sl.target); this.beams.push(sl);
    } else {
      this.maxSpeed = 6;
      const t = bodyTex('#d9a441', false);
      K.box(g, t, -0.1, 0.4, 0, 1.9, 1.0, 1.5, 4);
      K.flatBox(g, '#2e3344', 0, 1.4, 0, 1.3, 0.9, 1.3); K.flatBox(g, '#bfe0ee', 0.66, 1.5, 0, 0.04, 0.6, 1.0, false); K.flatBox(g, '#d9a441', 0, 2.3, 0, 1.5, 0.1, 1.5);
      for (const z of [-0.8, 0.8]) { const arm = K.flatBox(g, '#d9a441', 0.7, 0.9, z, 2.0, 0.18, 0.14); arm.rotation.z = -0.35; }
      K.flatBox(g, '#6d7482', 1.75, 0.1, 0, 0.5, 0.7, 1.9); K.flatBox(g, '#4b505c', 2.0, 0.05, 0, 0.3, 0.12, 1.9);
      wheel(0.6, 0.78, 0.4); wheel(0.6, -0.78, 0.4); wheel(-0.7, 0.78, 0.4); wheel(-0.7, -0.78, 0.4);
    }
    const hx = id === 'truck' ? 2.4 : 1.25, hz = id === 'truck' ? 1.0 : 0.95;
    const k = G.phys.kinematic(0, 1, 0, RAPIER.ColliderDesc.cuboid(hx, 0.7, hz));
    this.body = k.body; this.col = k.col; this.ctl = k.ctl;
    this.ctl.disableAutostep();
    this.ctl.setApplyImpulsesToDynamicBodies(id === 'skid');
    this.ctl.setCharacterMass(id === 'skid' ? 5000 : 1500);
  }
  place(x: number, z: number, rot: number) {
    this.pos.set(x, 0, z); this.rot = rot; this.speed = 0;
    const q = { x: 0, y: Math.sin(rot / 2), z: 0, w: Math.cos(rot / 2) };
    this.body.setTranslation({ x, y: 0.75, z }, true); this.body.setRotation(q, true);
    this.body.setNextKinematicTranslation({ x, y: 0.75, z }); this.body.setNextKinematicRotation(q);
    this.group.position.copy(this.pos); this.group.rotation.y = rot;
  }
  refresh() { if (this.load) { const inv = this.G.S.inv; this.load.visible = inv.lumber > 0; this.load.children.forEach((c, i) => { if (i < 3) c.visible = inv.lumber > i * 6; else c.visible = inv.paint > 0; }); } }
  update(dt: number) {
    const G = this.G;
    if (this.driver) {
      const a = G.input.axis(), len = Math.hypot(a.x, a.z);
      const brake = G.input.key('Space');
      if (len > 0 && !brake) {
        const want = Math.atan2(-a.z, a.x);
        let d = want - this.rot;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const reversing = Math.abs(d) > 2.2 && this.speed < 2.5;
        if (reversing) { this.speed = Math.max(-4, this.speed - 9 * dt); let rd = d > 0 ? d - Math.PI : d + Math.PI; this.rot -= Math.sign(rd) * Math.min(Math.abs(rd), 1.2 * dt) * Math.min(1, Math.abs(this.speed) / 2) * -1; }
        else {
          const turn = (this.id === 'skid' ? 3.2 : 2.3) * Math.min(1, 0.35 + Math.abs(this.speed) / 5);
          this.rot += Math.sign(d) * Math.min(Math.abs(d), turn * dt);
          const align = Math.max(0.25, Math.cos(d));
          this.speed = Math.min(this.maxSpeed * align + 1, this.speed + (this.id === 'skid' ? 7 : 8.5) * dt);
        }
      } else this.speed *= Math.exp(-(brake ? 5 : 1.3) * dt);
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
      if (this.speed !== 0) {
        const dx = Math.cos(this.rot) * this.speed * dt, dz = -Math.sin(this.rot) * this.speed * dt;
        const q = { x: 0, y: Math.sin(this.rot / 2), z: 0, w: Math.cos(this.rot / 2) };
        this.body.setRotation(q, true);
        this.ctl.computeColliderMovement(this.col, { x: dx, y: 0, z: dz });
        const m = this.ctl.computedMovement();
        const want = Math.hypot(dx, dz), got = Math.hypot(m.x, m.z);
        if (got < want * 0.6 && Math.abs(this.speed) > 3) { G.snd.sfx('thud'); G.gfx.shake = Math.min(0.4, Math.abs(this.speed) * 0.03); this.speed *= 0.3; this.bump = 0.2; }
        else if (got < want * 0.9) this.speed *= 0.94;
        const t = this.body.translation();
        this.pos.set(t.x + m.x, 0, t.z + m.z);
        this.body.setNextKinematicTranslation({ x: this.pos.x, y: 0.75, z: this.pos.z });
        this.body.setNextKinematicRotation(q);
        for (const w of this.wheels) w.rotation.y += this.speed * dt * 2;
        if (Math.abs(this.speed) > 5 && Math.random() < 0.3) { const tl = G.town.tileAt(this.pos.x, this.pos.z); if (tl !== PX.TILE.road) G.fx.burst({ x: this.pos.x - Math.cos(this.rot) * 2, y: 0.2, z: this.pos.z + Math.sin(this.rot) * 2 }, 2, { colors: ['#c9b89a', '#a89a80'], speed: 1, up: 1, life: 0.6, size: 0.12 }); }
      }
      if (G.input.hit('KeyH')) G.snd.sfx('horn');
    }
    this.bump = Math.max(0, this.bump - dt);
    this.group.position.set(this.pos.x, Math.sin(this.bump * 40) * this.bump * 0.2 + (this.driver && this.speed ? Math.sin(performance.now() / 45) * 0.012 : 0), this.pos.z);
    this.group.rotation.y = this.rot;
    const lights = this.driver && G.sky.night > 0.3;
    for (const b of this.beams) (b as THREE.SpotLight).intensity = lights ? 260 : 0;
  }
}
