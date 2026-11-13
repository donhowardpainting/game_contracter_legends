// Thin Rapier wrapper: static world colliders, kinematic character controllers for the
// player and vehicles, and dynamic debris that demolition throws around.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export { RAPIER };
export interface DynBody { body: RAPIER.RigidBody; mesh: THREE.Object3D; life: number; data?: any }

export class Physics {
  world!: RAPIER.World;
  dyn: DynBody[] = [];
  static async init() { await RAPIER.init(); }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -18, z: 0 });
    this.world.timestep = 1 / 60;
  }

  box(x: number, y: number, z: number, hx: number, hy: number, hz: number, rotY = 0): RAPIER.Collider {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
    if (rotY) d.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
    return this.world.createCollider(d);
  }
  /** footprint-style helper: centre x/z, full width/depth, height from ground */
  solid(x: number, z: number, w: number, d: number, h = 4, y0 = 0) { return this.box(x, y0 + h / 2, z, w / 2, h / 2, d / 2); }
  cyl(x: number, z: number, r: number, h = 3) {
    return this.world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, h / 2, z));
  }
  remove(c: RAPIER.Collider | null | undefined) { if (c) this.world.removeCollider(c, true); }

  kinematic(x: number, y: number, z: number, shape: RAPIER.ColliderDesc) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const col = this.world.createCollider(shape, body);
    const ctl = this.world.createCharacterController(0.04);
    ctl.setApplyImpulsesToDynamicBodies(true);
    ctl.enableAutostep(0.35, 0.2, true);
    ctl.enableSnapToGround(0.4);
    ctl.setMaxSlopeClimbAngle(Math.PI / 3);
    return { body, col, ctl };
  }

  debris(mesh: THREE.Object3D, hx: number, hy: number, hz: number, vel: THREE.Vector3, life = 9, density = 1, data?: any): DynBody {
    const p = mesh.position;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setLinvel(vel.x, vel.y, vel.z)
        .setAngvel({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 }).setLinearDamping(0.3).setAngularDamping(0.6),
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setDensity(density).setFriction(0.9).setRestitution(0.15), body);
    const d = { body, mesh, life, data };
    this.dyn.push(d);
    return d;
  }
  removeDyn(d: DynBody) {
    const i = this.dyn.indexOf(d);
    if (i >= 0) this.dyn.splice(i, 1);
    this.world.removeRigidBody(d.body);
    d.mesh.parent?.remove(d.mesh);
  }

  step(dt: number) {
    this.world.step();
    for (let i = this.dyn.length - 1; i >= 0; i--) {
      const d = this.dyn[i];
      const t = d.body.translation(), r = d.body.rotation();
      d.mesh.position.set(t.x, t.y, t.z);
      d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (d.life !== Infinity) {
        d.life -= dt;
        if (d.life < 1) d.mesh.scale.setScalar(Math.max(0.01, d.life));
        if (d.life <= 0 || t.y < -20) this.removeDyn(d);
      }
    }
  }
}
