// Day/night lighting, weather, and the pixel-quantised bay water.
import * as THREE from 'three';
import type { Gfx } from '../engine/gfx';
import type { Kit } from './kit';
import { uTime, uWind } from './kit';
import type { Fx } from '../engine/fx';

interface Key { h: number; sun: number; si: number; sky: number; gnd: number; hi: number; fog: number; tint: number; }
const KEYS: Key[] = [
  { h: 0, sun: 0x8fa8e6, si: 1.15, sky: 0x4a5cab, gnd: 0x262c52, hi: 1.75, fog: 0x1c2548, tint: 0xc4cfff },
  { h: 5, sun: 0x8fa8e6, si: 1.15, sky: 0x4a5cab, gnd: 0x262c52, hi: 1.75, fog: 0x1c2548, tint: 0xc4cfff },
  { h: 6, sun: 0xff9a70, si: 0.6, sky: 0x8a86b8, gnd: 0x4a3c50, hi: 1.3, fog: 0xc99aa0, tint: 0xffe6e0 },
  { h: 7, sun: 0xffb884, si: 2.3, sky: 0xa9bfe0, gnd: 0x6a5a58, hi: 1.5, fog: 0xf0c8ac, tint: 0xfff0e4 },
  { h: 9.5, sun: 0xfff0d2, si: 3.1, sky: 0xbfdcf6, gnd: 0x74805c, hi: 1.75, fog: 0xbfe0f0, tint: 0xffffff },
  { h: 16, sun: 0xffe9c0, si: 3.1, sky: 0xbfdcf6, gnd: 0x74805c, hi: 1.75, fog: 0xc4e0ec, tint: 0xfffaf0 },
  { h: 18.3, sun: 0xffb478, si: 2.3, sky: 0xe0b8c4, gnd: 0x6c5a66, hi: 1.75, fog: 0xf2b894, tint: 0xfff0e2 },
  { h: 19.6, sun: 0xd47a80, si: 0.6, sky: 0x7a74b8, gnd: 0x343258, hi: 1.4, fog: 0x5a4a80, tint: 0xe6d8ff },
  { h: 21, sun: 0x8fa8e6, si: 1.15, sky: 0x4a5cab, gnd: 0x262c52, hi: 1.75, fog: 0x1c2548, tint: 0xc4cfff },
  { h: 24, sun: 0x8fa8e6, si: 1.15, sky: 0x4a5cab, gnd: 0x262c52, hi: 1.75, fog: 0x1c2548, tint: 0xc4cfff },
];
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog';

export class Sky {
  sun = new THREE.DirectionalLight(0xffffff, 3);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
  fog = new THREE.Fog(0xbfe0f0, 50, 210);
  time = 7.5;
  day = 1;
  weather: Weather = 'clear';
  wAmt = 0; // 0 clear → 1 full weather effect
  night = 0;
  rain: THREE.LineSegments;
  water!: THREE.Mesh;
  private rainN = 1400;
  private c1 = new THREE.Color(); private c2 = new THREE.Color();
  private nextWeather = 14;
  timeScale = 1 / 38; // game hours per real second
  paused = false;
  forceWeather: Weather | null = null;
  beam?: THREE.Object3D;

  constructor(private gfx: Gfx, private kit: Kit, private fx: Fx) {
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    const c = s.shadow.camera;
    c.left = -46; c.right = 46; c.top = 46; c.bottom = -46; c.near = 1; c.far = 220;
    s.shadow.bias = -0.0006; s.shadow.normalBias = 0.05;
    gfx.scene.add(s, s.target, this.hemi);
    gfx.scene.fog = this.fog;
    // rain streaks
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.rainN * 6), 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbfd6ee, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    const p = g.attributes.position.array as Float32Array;
    for (let i = 0; i < this.rainN; i++) { p[i * 6] = (Math.random() - 0.5) * 70; p[i * 6 + 1] = Math.random() * 30; p[i * 6 + 2] = (Math.random() - 0.5) * 70; }
    gfx.scene.add(this.rain);
  }

  makeWater(sdf: THREE.DataTexture, originX: number, originZ: number, sizeX: number, sizeZ: number) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime, uSdf: { value: sdf }, uOrigin: { value: new THREE.Vector2(originX, originZ) }, uSize: { value: new THREE.Vector2(sizeX, sizeZ) },
        uDeep: { value: new THREE.Color(0x2c6f96) }, uShallow: { value: new THREE.Color(0x5fb7c0) }, uLight: { value: new THREE.Color(1, 1, 1) }, uSpark: { value: 1 },
      },
      fog: true,
      vertexShader: /* glsl */ `varying vec3 vW;
#include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform sampler2D uSdf; uniform vec2 uOrigin; uniform vec2 uSize; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uLight; uniform float uSpark;
        varying vec3 vW;
#include <fog_pars_fragment>
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = floor(vW.xz * 8.0) / 8.0;            // world-space pixel grid
          float t = floor(uTime * 7.0) / 7.0;           // stepped animation, like hand-drawn frames
          float w = vn(p * vec2(0.22, 0.5) + vec2(t * 0.14, t * 0.06)) + 0.55 * vn(p * vec2(0.6, 1.3) - vec2(t * 0.11, -t * 0.19));
          w = floor(w * 3.5) / 3.5;
          vec3 col = mix(uDeep, uShallow, clamp(w * 0.75, 0.0, 1.0));
          vec2 suv = (vW.xz - uOrigin) / uSize;
          float d = 8.0;
          if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) d = texture2D(uSdf, suv).r * 8.0;
          col = mix(col, uShallow * 1.12, (1.0 - smoothstep(0.0, 5.0, d)) * 0.7);
          float streak = step(0.83, vn(vec2(p.x * 0.3 + t * 0.2, p.y * 2.4 + floor(p.x * 0.07))));
          col += streak * 0.07;
          float edge = step(d, 0.55 + 0.3 * sin(t * 1.7 + p.x * 0.9 + p.y * 0.7));
          float band = step(0.72, sin(d * 2.4 - t * 1.6 + vn(p * 0.6) * 3.0)) * step(d, 2.6) * step(0.35, vn(p * 1.5 + t * 0.2));
          col = mix(col, vec3(0.95, 0.98, 1.0), clamp(edge + band * 0.75, 0.0, 1.0));
          float sp = step(0.994, hash(floor(vW.xz * 4.0) + floor(uTime * 5.0) * 13.0)) * uSpark;
          col = col * uLight + sp * 0.8;
          gl_FragColor = vec4(col, 1.0);
#include <fog_fragment>
        }`,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), m);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.38;
    this.gfx.scene.add(this.water);
  }

  private sample(h: number) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
    const L = (x: number, y: number, out: THREE.Color) => out.setHex(x).lerp(this.c2.setHex(y), t);
    return { a, b, t, L };
  }
  get isDay() { return this.time >= 6 && this.time < 19.6; }
  hourLabel() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 6) * 10;
    return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  update(dt: number, focus: THREE.Vector3, onNewDay?: () => void) {
    if (!this.paused) {
      this.time += dt * this.timeScale;
      if (this.time >= 24) { this.time -= 24; this.day++; onNewDay?.(); }
      this.nextWeather -= dt * this.timeScale;
      if (this.nextWeather <= 0) {
        const r = Math.random();
        this.weather = r < 0.5 ? 'clear' : r < 0.72 ? 'cloudy' : r < 0.9 ? 'rain' : 'fog';
        this.nextWeather = 5 + Math.random() * 9;
      }
    }
    const weather = this.forceWeather ?? this.weather;
    this.wAmt += ((weather === 'clear' ? 0 : 1) - this.wAmt) * Math.min(1, dt * 0.25);
    const wet = weather === 'rain' ? this.wAmt : 0, grey = this.wAmt * (weather === 'fog' ? 0.6 : 0.75);
    uTime.value += dt;
    uWind.value = 0.7 + this.wAmt * 1.3;

    const h = this.time, { a, b, t, L } = this.sample(h);
    const lerp = (x: number, y: number) => x + (y - x) * t;
    this.night = h < 5.4 || h > 20.4 ? 1 : h < 6.6 ? 1 - (h - 5.4) / 1.2 : h > 19 ? (h - 19) / 1.4 : 0;
    // sun / moon
    let dir: THREE.Vector3;
    if (h >= 6 && h <= 19.6) {
      const ang = ((h - 6) / 13.6) * Math.PI;
      dir = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang) * 0.95 + 0.22, 0.6).normalize();
    } else dir = new THREE.Vector3(-0.45, 0.8, 0.5).normalize();
    this.sun.position.copy(focus).addScaledVector(dir, 110);
    this.sun.target.position.copy(focus);
    L(a.sun, b.sun, this.sun.color);
    this.sun.intensity = lerp(a.si, b.si) * (1 - grey * 0.6);
    L(a.sky, b.sky, this.hemi.color);
    L(a.gnd, b.gnd, this.hemi.groundColor);
    this.hemi.intensity = lerp(a.hi, b.hi) * (1 + grey * 0.12);
    L(a.fog, b.fog, this.fog.color);
    if (grey > 0) this.fog.color.lerp(this.c2.setHex(this.night > 0.5 ? 0x1c2238 : 0xaab4bc), grey * 0.8);
    const fogFar = weather === 'fog' ? 85 : weather === 'rain' ? 130 : 210;
    this.fog.far += (lerpN(210, fogFar, this.wAmt) - this.fog.far) * Math.min(1, dt);
    this.fog.near = this.fog.far * (weather === 'fog' ? 0.12 : 0.24);
    this.gfx.scene.background = this.fog.color;
    const gu = this.gfx.grade.uniforms;
    L(a.tint, b.tint, gu.tint.value);
    gu.haze.value.copy(this.fog.color);
    gu.hazeAmt.value = 0.1 + this.wAmt * 0.12;
    gu.saturation.value = 1.14 - grey * 0.22;
    this.gfx.bloom.strength = 0.28 + this.night * 0.14;
    // water colours follow the sky
    if (this.water) {
      const u = (this.water.material as THREE.ShaderMaterial).uniforms;
      u.uLight.value.copy(this.hemi.color).multiplyScalar(0.45 + 0.4 * (1 - this.night)).lerp(this.c2.setRGB(0.6, 0.62, 0.66), grey * 0.5);
      u.uSpark.value = (1 - this.night) * (1 - grey);
    }
    this.fx.ambient.copy(this.hemi.color).multiplyScalar(0.55 + 0.45 * (1 - this.night));
    // windows, lamps, glows
    const n = this.night;
    this.kit.winMats[0].forEach((m) => (m.emissiveIntensity = n > 0.3 && (h > 12 ? h < 23.2 : false) ? 1.05 * n : 0));
    this.kit.winMats[1].forEach((m) => (m.emissiveIntensity = n > 0.5 && (h > 12 || h < 1.2) ? 1.05 * n : 0));
    for (const l of this.kit.lamps) {
      const on = !l.broken && n > 0.25 ? n : 0;
      (l.glow.material as THREE.SpriteMaterial).opacity = on * 0.85;
      (l.pool.material as THREE.MeshBasicMaterial).opacity = on * 0.4;
      (l.head.material as THREE.MeshLambertMaterial).emissiveIntensity = on * 2.5;
    }
    for (const gl of this.kit.glows) (gl.s as THREE.Sprite).material.opacity = gl.night ? n * 0.8 : 0.8;
    if (this.beam) { this.beam.visible = n > 0.3 && this.beam.userData.lit; this.beam.rotation.y += dt * 0.5; }
    // rain
    this.rain.visible = wet > 0.05;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position.array as Float32Array;
      const count = Math.floor(this.rainN * wet);
      for (let i = 0; i < this.rainN; i++) {
        let y = p[i * 6 + 1] - dt * 26;
        if (y < 0) { y = 24 + Math.random() * 8; p[i * 6] = focus.x + (Math.random() - 0.5) * 70; p[i * 6 + 2] = focus.z + 8 + (Math.random() - 0.5) * 70; if (i < count && Math.random() < 0.15) this.fx.burst({ x: p[i * 6], y: 0.05, z: p[i * 6 + 2] }, 1, { colors: ['#cfe4f4'], speed: 0.6, up: 1, life: 0.25, size: 0.06 }); }
        p[i * 6 + 1] = y; p[i * 6 + 3] = p[i * 6] + 0.12; p[i * 6 + 4] = i < count ? y + 0.9 : y; p[i * 6 + 5] = p[i * 6 + 2];
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      (this.rain.material as THREE.LineBasicMaterial).opacity = 0.5 * wet;
    }
    // chimney smoke
    if (Math.random() < dt * 5) for (const s of this.kit.smokers) if (Math.random() < 0.25) this.fx.one(s.x, s.y, s.z, 0.25 * uWind.value, 0.7, 0.05, '#cfcfd6', { colors: [], life: 3.2, size: 0.2, gravity: -0.12, drag: 0.1 });
  }
}
function lerpN(a: number, b: number, t: number) { return a + (b - a) * t; }
