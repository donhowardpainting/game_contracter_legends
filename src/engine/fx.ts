// Chunky square "pixel" particles: sawdust, paint flecks, spray, smoke, sparks, fireflies, fireworks.
import * as THREE from 'three';

const N = 3000;
export interface BurstOpts { colors: string[]; speed?: number; up?: number; spread?: number; life?: number; size?: number; gravity?: number; drag?: number; glow?: boolean; dir?: THREE.Vector3 }

export class Fx {
  points: THREE.Points;
  private pos = new Float32Array(N * 3);
  private col = new Float32Array(N * 3);
  private size = new Float32Array(N);
  private glow = new Float32Array(N);
  private vel = new Float32Array(N * 3);
  private life = new Float32Array(N);
  private max = new Float32Array(N);
  private grav = new Float32Array(N);
  private drag = new Float32Array(N);
  private base = new Float32Array(N);
  private next = 0;
  ambient = new THREE.Color(1, 1, 1);
  private tmp = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(this.glow, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uAmb: { value: this.ambient }, uScale: { value: 800 } },
      vertexShader: `attribute float aSize; attribute float aGlow; varying vec3 vC; uniform vec3 uAmb; uniform float uScale;
        void main(){ vC = color * mix(uAmb, vec3(1.6), aGlow); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; }`,
      fragmentShader: `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }`,
      vertexColors: true, depthWrite: true,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  setScale(h: number) { (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h * 1.9; }

  one(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, o: BurstOpts) {
    const i = this.next; this.next = (this.next + 1) % N;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.tmp.set(color);
    this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
    this.life[i] = this.max[i] = (o.life ?? 0.8) * (0.6 + Math.random() * 0.8);
    this.base[i] = (o.size ?? 0.09) * (0.7 + Math.random() * 0.6);
    this.grav[i] = o.gravity ?? 9; this.drag[i] = o.drag ?? 0.5; this.glow[i] = o.glow ? 1 : 0;
  }
  burst(p: THREE.Vector3 | { x: number; y: number; z: number }, n: number, o: BurstOpts) {
    const sp = o.speed ?? 2, spread = o.spread ?? 0.15;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random();
      let vx = Math.cos(a) * sp * r, vz = Math.sin(a) * sp * r, vy = (o.up ?? 2) * (0.4 + Math.random() * 0.8);
      if (o.dir) { vx = o.dir.x * sp + (Math.random() - 0.5) * sp * 0.5; vy = o.dir.y * sp + (Math.random() - 0.5) * sp * 0.5 + (o.up ?? 0); vz = o.dir.z * sp + (Math.random() - 0.5) * sp * 0.5; }
      this.one(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread, vx, vy, vz, o.colors[Math.floor(Math.random() * o.colors.length)], o);
    }
  }
  update(dt: number) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.03 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.03; this.vel[i * 3 + 1] = 0; this.vel[i * 3] *= 0.5; this.vel[i * 3 + 2] *= 0.5; }
      const t = this.life[i] / this.max[i];
      this.size[i] = this.life[i] > 0 ? this.base[i] * Math.min(1, t * 3) : 0;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true; g.attributes.aGlow.needsUpdate = true;
  }
}
