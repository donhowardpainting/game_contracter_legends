// Hybrid HD-2D rendering pipeline:
//   scene (MSAA, HDR, depth) → depth-of-field "diorama" blur → restrained bloom → grade → output.
// Pixel-art textures and sprites are nearest-filtered; only out-of-focus depth is softened.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOF_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float near; uniform float far; uniform float focus; uniform float range; uniform float strength;
uniform vec2 texel;
varying vec2 vUv;
float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
float cocAt(vec2 uv){
  float z = viewZ(uv);
  float d = z - focus;
  float c = (abs(d) - range) / (d < 0.0 ? focus * 0.55 : focus * 1.5);
  return clamp(c, 0.0, 1.0);
}
void main(){
  vec3 col = texture2D(tColor, vUv).rgb;
  float coc = cocAt(vUv);
  if (coc > 0.02 && strength > 0.0) {
    vec3 acc = col; float wsum = 1.0;
    float r = coc * strength;
    for (int i = 0; i < 14; i++) {
      float fi = float(i) + 0.5;
      float a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * sqrt(fi / 14.0) * r * texel;
      float w = 0.25 + cocAt(vUv + o);
      acc += texture2D(tColor, vUv + o).rgb * w; wsum += w;
    }
    col = acc / wsum;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

class SceneDofPass extends Pass {
  rt: THREE.WebGLRenderTarget;
  quad: FullScreenQuad;
  mat: THREE.ShaderMaterial;
  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, w: number, h: number) {
    super();
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(w, h) });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        near: { value: 1 }, far: { value: 400 }, focus: { value: 24 }, range: { value: 5 }, strength: { value: 7 },
        texel: { value: new THREE.Vector2(1 / w, 1 / h) },
      },
      vertexShader: VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w: number, h: number) {
    this.rt.setSize(w, h);
    this.mat.uniforms.texel.value.set(1 / w, 1 / h);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.mat.uniforms.near.value = this.camera.near;
    this.mat.uniforms.far.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const GRADE = {
  uniforms: {
    tDiffuse: { value: null }, vignette: { value: 0.32 }, saturation: { value: 1.12 }, contrast: { value: 1.06 },
    tint: { value: new THREE.Color(1, 1, 1) }, haze: { value: new THREE.Color(0.8, 0.9, 1) }, hazeAmt: { value: 0.12 },
    fade: { value: 0 }, letterbox: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; uniform float contrast;
    uniform vec3 tint; uniform vec3 haze; uniform float hazeAmt; uniform float fade; uniform float letterbox;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = mix(c, haze, hazeAmt * smoothstep(0.5, 1.0, vUv.y));
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c *= tint;
      vec2 q = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(q, q) * 2.0);
      c *= 1.0 - fade;
      float lb = step(letterbox * 0.12, vUv.y) * step(vUv.y, 1.0 - letterbox * 0.12);
      gl_FragColor = vec4(max(c, 0.0) * lb, 1.0);
    }`,
};

export class Gfx {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  dof: SceneDofPass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  ray = new THREE.Raycaster();
  // camera rig
  target = new THREE.Vector3();
  goal = new THREE.Vector3();
  dist = 25; goalDist = 25;
  pitch = 0.6; goalPitch = 0.6;
  yaw = 0; goalYaw = 0;
  shake = 0;
  cine: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  quality = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 420);
    const w = window.innerWidth, h = window.innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.dof = new SceneDofPass(this.scene, this.camera, w, h);
    this.composer.addPass(this.dof);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.38, 0.7, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 1.5) * this.quality;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.dof.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.dof.mat.uniforms.strength.value = 7 * (h * pr) / 1080;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  snap() { this.target.copy(this.goal); this.dist = this.goalDist; this.pitch = this.goalPitch; this.yaw = this.goalYaw; }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 5);
    this.target.lerp(this.goal, k);
    this.dist += (this.goalDist - this.dist) * (1 - Math.exp(-dt * 3));
    this.pitch += (this.goalPitch - this.pitch) * (1 - Math.exp(-dt * 3));
    this.yaw += (this.goalYaw - this.yaw) * (1 - Math.exp(-dt * 2.5));
    const cam = this.camera;
    if (this.cine) {
      cam.position.copy(this.cine.pos);
      cam.lookAt(this.cine.look);
      this.dof.mat.uniforms.focus.value = this.cine.pos.distanceTo(this.cine.look);
    } else {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
      cam.lookAt(this.target.x, this.target.y + 1, this.target.z);
      this.dof.mat.uniforms.focus.value = this.dist;
    }
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    this.dof.mat.uniforms.range.value = this.dof.mat.uniforms.focus.value * 0.24;
    cam.updateMatrixWorld();
  }

  render() { this.composer.render(); }

  /** Cast the mouse into the scene against a set of objects. */
  pick(nx: number, ny: number, objs: THREE.Object3D[], recursive = false) {
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    return this.ray.intersectObjects(objs, recursive);
  }
  groundPoint(nx: number, ny: number, y = 0): THREE.Vector3 | null {
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    if (Math.abs(d.y) < 1e-5) return null;
    const t = (y - o.y) / d.y;
    return t > 0 ? o.clone().addScaledVector(d, t) : null;
  }
  screenPos(p: THREE.Vector3): { x: number; y: number; vis: boolean } {
    const v = p.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, vis: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }
}
