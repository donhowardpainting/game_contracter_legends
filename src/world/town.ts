// Harbor's End — one dense coastal district, laid out by hand.
// Axes: +x east, +z south. The camera looks north, so every facade worth seeing faces +z.
import * as THREE from 'three';
import * as PX from '../art/pixel';
import { PAL, TILE, rng } from '../art/pixel';
import { Kit, House, HouseSpec, mat, swayMat, awningTex } from './kit';
import type { Game } from '../game/game';
import { PaintTask, BuildTask, DemoTask, SawTask, LogTask, RubbleTask, PuzzleTask } from '../game/work';

export const MAP_W = 160, MAP_H = 128, OX = -96, OZ = -64;

export class Town {
  tiles = new Uint8Array(MAP_W * MAP_H);
  walk = new Uint8Array(MAP_W * MAP_H);
  tileTex!: THREE.DataTexture;
  private tileData = new Uint8Array(MAP_W * MAP_H * 4);
  houses: Record<string, House> = {};
  restorables: Record<string, { dead: House; live: House }> = {};
  festival = new THREE.Group();
  gullPerches: THREE.Vector3[] = [];
  private R = rng(777);

  constructor(private G: Game) {}

  idx(x: number, z: number) { return (Math.floor(z) - OZ) * MAP_W + (Math.floor(x) - OX); }
  inMap(x: number, z: number) { return x >= OX && x < OX + MAP_W && z >= OZ && z < OZ + MAP_H; }
  tileAt(x: number, z: number) { return this.inMap(x, z) ? this.tiles[this.idx(x, z)] : TILE.forest; }
  isWater(x: number, z: number) { return !this.inMap(x, z) ? z < -40 : this.tiles[this.idx(x, z)] === 255; }
  rect(x0: number, z0: number, x1: number, z1: number, t: number) {
    for (let z = Math.max(OZ, z0); z < Math.min(OZ + MAP_H, z1); z++) for (let x = Math.max(OX, x0); x < Math.min(OX + MAP_W, x1); x++) this.tiles[this.idx(x, z)] = t;
  }
  disc(cx: number, cz: number, r: number, t: number, jitter = 0) {
    for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
      if (this.inMap(x, z) && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) < r + (jitter ? (this.R() - 0.5) * jitter : 0)) this.tiles[this.idx(x, z)] = t;
  }
  path(pts: number[][], t = TILE.path, w = 1) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2);
      for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n; for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) if (this.inMap(x + a, z + b)) this.tiles[this.idx(x + a, z + b)] = t; }
    }
  }
  /** Swap ground tiles at runtime (restored boardwalk etc.) */
  setTiles(x0: number, z0: number, x1: number, z1: number, t: number) { this.rect(x0, z0, x1, z1, t); this.bakeTiles(); }

  private bakeTiles() {
    const R = rng(31337), d = this.tileData;
    const variants: Record<number, number> = { [TILE.grass]: 4, [TILE.flowers]: 2, [TILE.dirt]: 2, [TILE.road]: 2, [TILE.sand]: 2, [TILE.gravel]: 2, [TILE.forest]: 2 };
    for (let i = 0; i < this.tiles.length; i++) {
      let t = this.tiles[i];
      const r = R();
      if (t === 255) t = TILE.seabed;
      else if (variants[t]) t += t === TILE.road ? (r < 0.12 ? 1 : 0) : Math.floor(r * variants[t]);
      d[i * 4] = t; d[i * 4 + 3] = 255;
    }
    if (!this.tileTex) {
      this.tileTex = new THREE.DataTexture(d, MAP_W, MAP_H, THREE.RGBAFormat);
      this.tileTex.magFilter = this.tileTex.minFilter = THREE.NearestFilter;
    }
    this.tileTex.needsUpdate = true;
  }

  build() {
    const G = this.G, K = G.kit, P = G.phys, T = TILE;
    const place = (name: string, x: number, z: number) => (G.places[name] = { x, z });
    // ══════════ 1. ground plan ══════════
    this.tiles.fill(T.grass);
    this.rect(OX, OZ, -52, OZ + MAP_H, T.forest);                 // western woods
    this.rect(OX, OZ, OX + MAP_W, -40, 255);                      // the bay
    this.rect(-44, -52, -24, -40, T.grass);                       // Marlowe Point
    this.rect(-42, -42, -26, -40, T.cobble);
    this.rect(53, -58, 64, -40, T.grass); this.disc(58, -50, 5.5, T.sand, 2); // lighthouse spit
    this.rect(-60, -43, -44, -40, T.sand); this.rect(-74, -42, -60, -39, T.sand); this.rect(-52, -40, -44, -37, T.sand); // beach
    this.rect(-96, -40, -74, -38, T.forest);
    // creek + pond in the woods
    for (let z = -64; z < 12; z++) { const cx = -68.5 + Math.sin(z * 0.21) * 1.6; this.rect(Math.floor(cx - 1), z, Math.floor(cx + 2), z + 1, 255); }
    this.disc(-68, 14, 5.2, 255, 1.5);
    // marsh in the south-east
    this.rect(34, 46, 64, 64, T.marsh); this.disc(54, 56, 7, 255, 2.5); this.disc(44, 60, 4, 255, 2);
    this.rect(-52, 46, 34, 64, T.tallgrass);
    // roads
    const roadH = (z: number, x0: number, x1: number) => { this.rect(x0, z, x1, z + 6, T.road); this.rect(x0, z - 1, x1, z, T.sidewalk); this.rect(x0, z + 6, x1, z + 7, T.sidewalk); for (let x = x0; x < x1; x += 3) this.rect(x, z + 2, x + 1, z + 3, T.roadLineH), this.rect(x, z + 3, x + 1, z + 4, T.road); };
    const roadV = (x: number, z0: number, z1: number) => { this.rect(x, z0, x + 6, z1, T.road); this.rect(x - 1, z0, x, z1, T.sidewalk); this.rect(x + 6, z0, x + 7, z1, T.sidewalk); for (let z = z0; z < z1; z += 3) this.rect(x + 3, z, x + 4, z + 1, T.roadLineV); };
    this.rect(-52, -40, 53, -36, T.planks);                       // boardwalk
    roadH(-36, -52, 58); roadH(-7, -52, 58); roadH(19, -52, 58);
    roadV(-3, -36, 46); roadV(52, -36, 25); roadV(-52, -36, 25);
    for (const z of [-36, -7, 19]) for (const x of [-52, -3, 52]) this.rect(x, z, x + 6, z + 6, T.road);
    for (const z of [-8, 18]) { this.rect(-3, z, 3, z + 1, T.crosswalkH); this.rect(-3, z + 7, 3, z + 8, T.crosswalkH); }
    for (const z of [-7, 19]) { this.rect(-4, z, -3, z + 6, T.crosswalkV); this.rect(3, z, 4, z + 6, T.crosswalkV); }
    this.rect(-40, 40, 40, 44, T.dirt); this.rect(-3, 44, 3, 46, T.dirt); // Gull Row lane
    this.rect(-24, -40, -16, -36, T.rubble);                      // the breach in the seawall
    this.rect(-23, -36, -17, -35, T.rubble);
    // lots
    this.rect(-45, -28, -5, -9, T.gravel);                        // lumberyard
    this.rect(5, -11, 44, -8, T.cobble); this.rect(18, -22, 25, -8, T.cobble); // plaza
    this.rect(-29, 1, -5, 18, T.gravel);                          // HQ lot
    this.rect(-45, 0, -31, 18, T.grass); this.disc(-38, 9, 3.6, T.cobble);     // park
    this.path([[-38, 18], [-38, 12]]); this.path([[-45, 9], [-41, 9]]);
    this.rect(3, 13, 19, 18, T.flowers); this.rect(3, 2, 6, 13, T.garden);     // Mabel's garden
    this.path([[11, 13], [11, 18]], T.path, 2); this.path([[27, 13], [27, 18]], T.path, 2); this.path([[45, 13], [45, 18]], T.path, 2);
    this.disc(36, 10, 3, T.dirt, 1);
    for (const x of [-34, -22, -10]) this.path([[x, 37], [x, 40]], T.path, 2);
    this.path([[12, 37], [12, 40]], T.path, 2); this.path([[26, 37], [26, 40]], T.path, 2);
    this.rect(33, 27, 50, 39, T.garden); this.rect(35, 30, 46, 33, T.cobble); this.rect(33, 33, 50, 34, T.path); this.rect(41, 27, 42, 39, T.path);
    this.rect(5, 26, 19, 29, T.gravel);
    this.rect(55, -46, 61, -40, T.path); this.path([[58, -46], [58, -40], [55, -37]], T.path, 2);
    // forest trail to the surveyor's cabin
    this.path([[-52, -15], [-58, -14], [-64, -14], [-72, -14], [-77, -15], [-80, -15]], T.path, 2);
    this.disc(-80, -18, 6.5, T.dirt, 2);
    this.path([[-58, -14], [-60, -22], [-66, -25]], T.forest, 1);
    this.path([[-52, 8], [-60, 9], [-64, 12]], T.path, 1);
    this.bakeTiles();

    // ══════════ 2. terrain mesh, water distance field, colliders ══════════
    const dist = new Float32Array(MAP_W * MAP_H).fill(99), src = new Uint8Array(MAP_W * MAP_H);
    for (let i = 0; i < dist.length; i++) if (this.tiles[i] !== 255) { dist[i] = 0; src[i] = this.tiles[i]; }
    for (let pass = 0; pass < 2; pass++) {
      const rg = pass === 0 ? [0, MAP_H, 1, 0, MAP_W, 1] : [MAP_H - 1, -1, -1, MAP_W - 1, -1, -1];
      for (let z = rg[0]; z !== rg[1]; z += rg[2]) for (let x = rg[3]; x !== rg[4]; x += rg[5]) {
        const i = z * MAP_W + x;
        for (const [dx, dz, c] of [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [1, 1, 1.41]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= MAP_W || nz >= MAP_H) continue;
          const j = nz * MAP_W + nx;
          if (dist[j] + c < dist[i]) { dist[i] = dist[j] + c; src[i] = src[j]; }
        }
      }
    }
    const sdf = new Uint8Array(MAP_W * MAP_H * 4);
    for (let i = 0; i < dist.length; i++) { sdf[i * 4] = Math.min(255, (dist[i] / 8) * 255); sdf[i * 4 + 3] = 255; }
    const sdfTex = new THREE.DataTexture(sdf, MAP_W, MAP_H, THREE.RGBAFormat);
    sdfTex.magFilter = sdfTex.minFilter = THREE.LinearFilter; sdfTex.needsUpdate = true;
    G.sky.makeWater(sdfTex, OX, OZ, MAP_W, MAP_H);

    const geo = new THREE.PlaneGeometry(MAP_W, MAP_H, MAP_W, MAP_H);
    geo.rotateX(-Math.PI / 2); geo.translate(OX + MAP_W / 2, 0, OZ + MAP_H / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = Math.round(pos.getX(i) - OX), vz = Math.round(pos.getZ(i) - OZ);
      let dmin = 99, st = 0;
      for (const [ax, az] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const tx = Math.min(MAP_W - 1, Math.max(0, vx + ax)), tz = Math.min(MAP_H - 1, Math.max(0, vz + az)), j = tz * MAP_W + tx;
        if (dist[j] < dmin) { dmin = dist[j]; st = src[j]; }
      }
      if (dmin > 0) pos.setY(i, -Math.min(1.8, dmin * (st === T.sand || st === T.marsh || st === T.forest ? 0.28 : 1.1)));
    }
    geo.computeVertexNormals();
    const gm = new THREE.MeshLambertMaterial({ map: PX.groundAtlas() });
    const tileTex = this.tileTex;
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uTiles = { value: tileTex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uTiles; varying vec2 vWxz;')
        .replace('#include <map_fragment>', `
          vec2 wp = vWxz - vec2(${OX.toFixed(1)}, ${OZ.toFixed(1)});
          vec2 cell = floor(wp);
          float ti = floor(texture2D(uTiles, (cell + 0.5) / vec2(${MAP_W}.0, ${MAP_H}.0)).r * 255.0 + 0.5);
          vec2 f = clamp(fract(wp), 0.5 / 16.0, 1.0 - 0.5 / 16.0);
          vec2 tuv = (vec2(mod(ti, ${PX.ATLAS_COLS}.0), floor(ti / ${PX.ATLAS_COLS}.0)) + vec2(f.x, f.y)) / vec2(${PX.ATLAS_COLS}.0, ${PX.ATLAS_ROWS}.0);
          diffuseColor *= texture2D(map, vec2(tuv.x, 1.0 - tuv.y));`);
    };
    const ground = new THREE.Mesh(geo, gm);
    ground.receiveShadow = true;
    K.group.add(ground);
    // land that continues past the playable map (hidden by trees and haze)
    const skirtM = mat(PX.flat('#4d6b3c'));
    for (const [x, z, w, d] of [[OX - 150, 0, 300, 600], [OX + MAP_W + 150, 160, 300, 400], [0, OZ + MAP_H + 150, 700, 300]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), skirtM); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.02, z); m.receiveShadow = true; K.group.add(m);
    }
    P.box(0, -1, 0, 400, 1, 400);                                // ground slab
    for (const [x, z, w, d] of [[OX + 2, 0, 1, 200], [OX + MAP_W - 2, 0, 1, 200], [0, OZ + 2, 300, 1], [0, OZ + MAP_H - 4, 300, 1]]) P.solid(x, z, w, d, 6);

    // ══════════ 3. decks, wharves, piers (walkable planks over water) ══════════
    const deckT = PX.planks('#a98458', 14), pileT = PX.planks('#5d4a3a', 15, 16);
    const deck = (x0: number, z0: number, x1: number, z1: number, posts = true, parent: THREE.Object3D = K.group) => {
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) if (this.inMap(x, z)) this.walk[this.idx(x, z)] = 1;
      const m = K.box(parent, deckT, (x0 + x1) / 2, -0.28, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0);
      m.castShadow = false;
      K.box(parent, pileT, (x0 + x1) / 2, -0.5, z1 - 0.1, x1 - x0, 0.3, 0.2, 4, false);
      if (posts) for (let x = x0 + 0.3; x <= x1; x += Math.max(2.5, (x1 - x0 - 0.6) / Math.max(1, Math.round((x1 - x0) / 3)))) for (const z of [z0 + 0.3, z1 - 0.3]) {
        if (!this.isWater(x, z)) continue;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.2, 6), mat(pileT)); p.position.set(x, -1.2, z); p.castShadow = true; parent.add(p);
        if (this.R() < 0.4) this.gullPerches.push(new THREE.Vector3(x, 0.45, z));
      }
      return m;
    };
    deck(-16, -42, -8, -40); deck(-17, -49, -7, -42);             // boathouse dock
    deck(-1, -58, 2, -40); deck(-4, -62, 5, -58);                 // town pier
    deck(6, -52, 22, -40);                                        // Crab Pot wharf
    deck(31, -56, 52, -40);                                       // cannery wharf
    for (const x of [-1, 2]) for (let z = -56; z < -40; z += 4) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 6), mat(pileT)); p.position.set(x + (x < 0 ? -0.1 : 0.1), 0.5, z); p.castShadow = true; K.group.add(p); this.gullPerches.push(new THREE.Vector3(p.position.x, 1.2, z)); }

    // ══════════ 4. buildings ══════════
    const H = (name: string, s: HouseSpec) => (this.houses[name] = K.house({ name, ...s }));
    const clap = PX.clapboard, grp = K.group;

    // — Hollis & Co. (player HQ) —
    const hq = H('hq', { x: -18, z: 8.5, w: 12, d: 9, h: 3.6, wall: clap('#93a7a4', 0.95, 1), roofColor: '#8a4d3c', roof: 'gableX', door: { x: 2.5, color: '#5b4a44' }, windows: [-3.6, -0.8], interior: {}, sign: { text: 'HOLLIS & CO.', bg: '#40505c', fg: '#d8cfb4', x: -2.2, y: 3.45 } });
    place('hq_door', -15.5, 14.6); place('hq_in', -18, 9);
    {
      const g = hq.g, b = hq.base;
      K.box(g, PX.planks('#8c6a45', 3), -3.5, b, -3.4, 4, 0.95, 1.1); K.crate(-18 - 5, 8.5 - 3.3, 0.7, b);          // workbench
      K.flatBox(g, '#b5463c', -4.4, b + 0.95, -3.4, 0.5, 0.25, 0.3); K.flatBox(g, '#727a88', -3, b + 0.95, -3.3, 0.9, 0.08, 0.2);
      K.box(g, PX.planks('#6b4a32', 4), 4.6, b, -2.6, 1.1, 0.5, 2.2); K.flatBox(g, '#b9c7d6', 4.6, b + 0.5, -2.6, 1, 0.16, 2.1); K.flatBox(g, PAL.white, 4.6, b + 0.66, -3.3, 0.8, 0.12, 0.5); // cot
      K.box(g, PX.planks('#7a5a3c', 8), 0.8, b, -3.8, 2.4, 2.2, 0.5);                                            // shelves
      for (let i = 0; i < 6; i++) K.flatBox(g, [PAL.red, PAL.teal, PAL.mustard, PAL.cream][i % 4], 0 + (i % 3) * 0.7, b + 0.75 + Math.floor(i / 3) * 0.7, -3.6, 0.4, 0.45, 0.4, false);
      K.sawhorse(-18 - 1, 8.5 + 1.5, 0.3);
      P.solid(-21.5, 5.1, 4, 1.1, 1.4); P.solid(-13.4, 5.9, 1.1, 2.2, 1); P.solid(-17.2, 4.7, 2.4, 0.5, 2.4);
      G.addInteract({ id: 'cot', x: -14.2, z: 6.3, r: 1.6, label: 'Rest until morning', act: () => G.sleep() });
      // contract board on the outside wall
      K.box(grp, PX.planks('#7a5a3c', 2), -22.6, 1.0, 13.12, 1.9, 1.3, 0.1); K.flatBox(grp, PAL.cream, -23, 1.5, 13.19, 0.5, 0.6, 0.02, false); K.flatBox(grp, '#f1ead9', -22.3, 1.3, 13.19, 0.5, 0.7, 0.02, false); K.flatBox(grp, PAL.butter, -22.1, 1.95, 13.19, 0.4, 0.3, 0.02, false);
      G.addInteract({ id: 'board', x: -22.6, z: 14.2, r: 1.8, label: 'Company board', act: () => G.ui.openCompany() });
      place('hq_board', -22.6, 14.4);
    }
    K.lumberStack(-26, 5, 3, 2, 0.1); K.barrel(-25, 12.5); K.barrel(-26, 13.2, '#5a6a7a'); K.crate(-11, 4.2); K.crate(-10.3, 5, 0.6);
    G.addTask(new BuildTask(G, 'hq_rack', 'Rebuild the lumber rack', [
      { x: -9.2, y: 0, z: 9, w: 0.2, h: 2.2, d: 0.2, nails: 0 }, { x: -6.4, y: 0, z: 9, w: 0.2, h: 2.2, d: 0.2, nails: 0 },
      { x: -7.8, y: 0.5, z: 9.1, w: 3.2, h: 0.18, d: 0.16, nails: 2 }, { x: -7.8, y: 1.2, z: 9.1, w: 3.2, h: 0.18, d: 0.16, nails: 2 }, { x: -7.8, y: 1.9, z: 9.1, w: 3.2, h: 0.18, d: 0.16, nails: 2 },
    ]));
    G.addTask(new PaintTask(G, 'hq_paint', 'Paint the shop front', [{ x: -18, y: 0.35 + 1.8, z: 13.03, w: 12, h: 3.6 }], { parent: hq.front, ox: -18, oz: 8.5 }));
    G.addTask(new SawTask(G, 'hq_saw', 'Cut boards at the sawhorse', -12, 16.5, 4));
    K.sawhorse(-12, 16.5); K.sawhorse(-12, 17.4);

    // — Brannigan Lumber —
    H('lumber', { x: -38, z: -21, w: 9, d: 6, h: 3.2, wall: PX.shakes('#8a6a4a', 2), roofColor: '#3f6b55', roof: 'gableX', door: { x: -2, color: '#3f6b55' }, windows: [1.5], sign: { text: 'BRANNIGAN LUMBER', bg: '#3f6b55', fg: PAL.butter, y: 3.3 }, chimney: { x: 3 } });
    place('lumber_office', -39, -16.6); place('lumber_yard', -24, -14);
    G.addInteract({ id: 'lumber_shop', x: -36.5, z: -17, r: 2, label: 'Order window — materials', act: () => G.ui.openShop('lumber') });
    K.box(grp, PX.planks('#8c6a45', 3), -36.5, 0.35, -17.7, 2, 0.9, 0.6); K.flatBox(grp, '#3f6b55', -36.5, 2.5, -17.6, 2.4, 0.12, 1, false);
    { // open-sided timber shed
      const g = new THREE.Group(); g.position.set(-20, 0, -23); grp.add(g);
      for (const x of [-7, -2.3, 2.3, 7]) for (const z of [-2.2, 2.2]) K.box(g, PX.planks('#6b4a32', 4, 16), x, 0, z, 0.3, 3.6, 0.3);
      K.roof(g, 'shed', 15, 5.4, 1.2, PX.metal('#7d8f97', 0.35, 2), PX.flat('#6b4a32'), '#6b4a32', 0.5).position.y = 3.6;
      for (const x of [-4.6, 0, 4.6]) { K.lumberStack(-20 + x, -23.6, 3.6, 4); }
      K.lumberStack(-17, -21.6, 3.4, 2); P.solid(-20, -25.4, 15, 0.4, 3);
    }
    K.lumberStack(-12, -14, 3.2, 3, Math.PI / 2); K.lumberStack(-30, -12, 3.6, 2); K.lumberStack(-9, -22, 3, 4, Math.PI / 2); K.crate(-32, -24); K.crate(-31.1, -24.2, 0.6); K.barrel(-43, -12);
    K.fence(-45, -28, -5, -28, 'wood', '#8a7350'); K.fence(-45, -28, -45, -9, 'wood', '#8a7350'); K.fence(-45, -9, -30, -9, 'wood', '#8a7350'); K.fence(-24, -9, -5, -9, 'wood', '#8a7350'); K.fence(-5, -28, -5, -20, 'wood', '#8a7350'); K.fence(-5, -15, -5, -9, 'wood', '#8a7350');

    // — Tidewater Supply —
    H('tidewater', { x: 12, z: -16, w: 12, d: 9, h: 3.8, wall: PX.brick('#a8553f', 1), trim: PAL.cream, roof: 'flat', door: { x: 0, color: PAL.teal }, windows: [-3.6, 3.6], winW: 2.2, winH: 1.6, awning: PAL.teal, sign: { text: 'TIDEWATER SUPPLY', bg: PAL.cream, fg: PAL.navy, y: 3.9 } });
    place('tidewater_door', 12, -10); place('plaza', 21.5, -9.5);
    G.addInteract({ id: 'tool_shop', x: 12, z: -10.6, r: 2, label: 'Tidewater Supply — tools', act: () => G.ui.openShop('tools') });
    K.crate(7.2, -10.9, 0.7); K.barrel(16.6, -11); K.flatBox(grp, PAL.red, 8.4, 0, -10.9, 0.5, 0.9, 0.5);
    // anchor monument in the plaza
    K.box(grp, PX.stone('#9a9890', 3), 21.5, 0, -15, 2.4, 0.7, 2.4); P.solid(21.5, -15, 2.4, 2.4, 2);
    { const a = '#3a4250'; K.flatBox(grp, a, 21.5, 0.7, -15, 0.22, 2.6, 0.22); K.flatBox(grp, a, 21.5, 2.7, -15, 1.3, 0.18, 0.18); K.flatBox(grp, a, 21.5, 0.8, -15, 1.9, 0.2, 0.2); for (const s of [-1, 1]) { const f = K.flatBox(grp, a, 21.5 + s * 0.95, 0.95, -15, 0.2, 0.7, 0.2); f.rotation.z = s * 0.5; } }
    G.addInteract({ id: 'monument', x: 21.5, z: -13, r: 2, label: 'Read the plaque', act: () => G.ui.note('FOUNDERS\' ANCHOR', '"Raised from the wreck of the Marguerite, 1911.\nA town is only as strong as what holds it in place."\n\nSomeone has scratched underneath: W.H. — "Built right or not at all."') });

    // — Town Hall —
    const th = H('townhall', { x: 34, z: -17.5, w: 14, d: 10, h: 6.2, wall: PX.stucco('#e6dcc2', 2), trim: PAL.white, roof: 'hip', roofColor: '#4a5878', door: { x: 0, color: '#5b3a34' }, windows: [-5, -2.6, 2.6, 5], sign: { text: 'TOWN HALL', bg: PAL.cream, fg: '#4a5878', y: 6.25, w: 4 } });
    { const g = th.g; K.box(g, PX.stone('#b4b1a8', 4), 0, 0, 6, 8, 0.35, 2); P.solid(34, -11.5, 8, 2, 0.35);
      for (const x of [-3.2, -1.2, 1.2, 3.2]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 3.2, 8), mat(PX.flat(PAL.white))); c.position.set(x, 1.95, 6.6); c.castShadow = true; g.add(c); }
      K.roof(g, 'gableZ', 2, 8, 1.4, PX.roofTex('#4a5878'), PX.stucco('#e6dcc2', 2), PAL.white, 0.2).position.set(0, 3.55, 6);
      K.box(th.top, PX.stucco('#e6dcc2', 2), 0, 6.5, 0, 3, 4, 3); K.roof(th.top, 'hip', 3, 3, 2.2, PX.roofTex('#4a5878'), PX.flat('#fff'), PAL.white, 0.3).position.y = 10.5;
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 12), mat(PX.flat('#f4efe2'))); clock.rotation.x = Math.PI / 2; clock.position.set(0, 9, 1.56); th.top.add(clock);
      K.flatBox(th.top, PAL.ink, 0, 9, 1.62, 0.08, 0.7, 0.02, false); K.flatBox(th.top, PAL.ink, 0.22, 8.95, 1.62, 0.5, 0.08, 0.02, false); }
    place('townhall_steps', 34, -9.6); place('townhall_side', 30, -9.4);
    const flagPole = K.flatBox(grp, '#c9c5b8', 43.5, 0, -10, 0.12, 6, 0.12);
    { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1), swayMat(PX.tex(flagCanvas(), false), 0.12, { side: THREE.DoubleSide })); f.position.set(44.5, 5.3, -10); grp.add(f); void flagPole; }

    // — The Crab Pot —
    const diner = H('diner', { x: 14, z: -46.5, w: 12, d: 7, h: 3.4, base: 0.2, wall: clap('#b4483c', 0.35, 2), roofColor: '#3f5a66', roof: 'gableX', door: { x: -1, color: PAL.white }, windows: [-4.2, 2.2, 4.4], interior: { floor: PX.planks('#8c6a45', 12) }, sign: { text: 'THE CRAB POT', bg: PAL.white, fg: '#b4483c', y: 3.2, x: 2.5 }, chimney: { x: -4 } });
    { const g = diner.g, b = diner.base;
      K.box(g, PX.planks('#6b4a32', 6), 0, b, -1.6, 8, 1, 0.7); K.flatBox(g, '#d9d5c8', 0, b + 1, -1.6, 8.2, 0.08, 0.9); P.solid(14, -48.1, 8, 0.7, 1.4);
      for (let i = 0; i < 5; i++) { K.flatBox(g, '#b4483c', -3.2 + i * 1.6, b + 0.55, -0.8, 0.4, 0.1, 0.4, false); K.flatBox(g, '#727a88', -3.2 + i * 1.6, b, -0.8, 0.1, 0.55, 0.1, false); }
      for (const x of [-4, 3.5]) { K.box(g, PX.planks('#a37747', 3), x, b + 0.7, 1.5, 1.4, 0.1, 1); K.flatBox(g, '#6b4a32', x, b, 1.5, 0.14, 0.7, 0.14, false); P.solid(14 + x, -45, 1.4, 1, 1); }
      K.box(g, PX.planks('#7a5a3c', 8), -4.6, b, -2.8, 1.6, 2, 0.5); K.flatBox(g, '#e2c15a', 3, b + 2.2, -3.2, 1.2, 0.5, 0.05, false); }
    place('diner_door', 13, -41.6); place('diner_in', 12, -45.3); place('diner_counter', 14, -49);
    G.addTask(new PaintTask(G, 'diner_paint', 'Wash & repaint the Crab Pot', [{ x: 14, y: 0.2 + 1.7, z: -42.97, w: 12, h: 3.4 }], { parent: diner.front, ox: 14, oz: -46.5, wash: true, color: 3 }));
    K.crate(8, -42.6, 0.7); K.crate(8.8, -42.8, 0.5); K.barrel(20.6, -42.4, '#5a6a7a');
    for (let i = 0; i < 3; i++) K.crate(7.4, -50.5 + i * 0.9, 0.8);
    // seating deck the player builds (gap in the wharf until then)
    const seat = new THREE.Group(); seat.visible = false; grp.add(seat);
    { const m = deck(22, -47, 28, -40, true, seat); void m;
      for (const [x, z] of [[24, -45], [26, -42.5]]) { K.box(seat, PX.planks('#a37747', 3), x, 0.72, z, 1.2, 0.08, 1.2); K.flatBox(seat, '#6b4a32', x, 0, z, 0.14, 0.72, 0.14); const u = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 8), mat(awningTex('#b4483c'))); u.position.set(x, 2.3, z); u.castShadow = true; seat.add(u); K.flatBox(seat, '#c9c5b8', x, 0.8, z, 0.06, 1.5, 0.06, false); }
      K.alphaPlane(seat, PX.tex(picketCanvas(), true), 25, 0.5, -46.9, 6, 1, 1); K.alphaPlane(seat, PX.tex(picketCanvas(), true), 27.9, 0.5, -43.5, 7, 1, 1, Math.PI / 2); }
    G.gates.seat = P.solid(25, -43.5, 6, 7, 3);
    G.sceneFlags.seat = seat;
    const jo: any[] = [];
    for (let i = 0; i < 4; i++) jo.push({ x: 25, y: -0.32, z: -46.3 + i * 1.9, w: 6, h: 0.22, d: 0.2, nails: 2 });
    for (let i = 0; i < 6; i++) jo.push({ x: 22.5 + i * 1.0, y: -0.08, z: -43.5, w: 0.9, h: 0.1, d: 6.8, nails: 2, rotNail: true });
    G.addTask(new BuildTask(G, 'diner_deck', 'Frame & deck the seating area', jo, { reachFrom: { x: 21, z: -41.5 }, free: true }));
    place('diner_deck', 20.5, -41.5);

    // — Old Cannery —
    const can = H('cannery', { x: 41, z: -49, w: 18, d: 10, h: 5.6, base: 0.2, wall: PX.metal('#7d8f97', 0.9, 3), trim: '#6c665a', roof: 'gableX', roofColor: '#7a5140', door: { x: -4, color: '#6c665a' }, windows: [-7, 1, 4, 7], dead: true, interior: { wall: PX.metal('#6a7a82', 0.6, 5), floor: PX.concrete('#9a978e', 3) }, sign: { text: 'CHESAPEAKE CROWN\nLUXURY LOFTS - COMING SOON', bg: '#d8cfb4', fg: '#6d4a6e', y: 4.2, x: 2 } });
    { const g = can.g, b = can.base;
      for (const x of [-6, -1.5, 3]) { K.box(g, PX.metal('#5a6a72', 0.8, 6), x, b, -2.8, 3, 1.1, 1.4); P.solid(41 + x, -51.8, 3, 1.4, 1.3); }   // packing lines
      K.box(g, PX.planks('#7a5a3c', 8), 5.5, b, 1.2, 0.2, 2.8, 6.4); P.solid(46.5, -47.8, 0.2, 6.4, 3);                                   // office partition
      K.box(g, PX.planks('#6b4a32', 4), 7.5, b, -1.5, 1.8, 0.9, 0.9); P.solid(48.5, -50.5, 1.8, 0.9, 1);                                   // desk
      K.crate(41 - 7.5, -49 + 3, 0.9, b); K.crate(41 - 6.5, -49 + 3.4, 0.7, b); K.barrel(41 + 3, -49 + 3.4, '#5a6a7a');
      // safe behind a false wall
      const safe = K.flatBox(g, '#3a4250', 8.2, b, 3.6, 0.9, 1.1, 0.8); K.flatBox(g, '#e2c15a', 8.2, b + 0.5, 4.02, 0.16, 0.16, 0.04, false); void safe;
      P.solid(49.2, -45.4, 0.9, 0.8, 1.2);
    }
    G.addTask(new DemoTask(G, 'can_wall', 'Break through the false wall', [
      { x: 48.2, y: 0.2, z: -46.3, w: 1.6, h: 1.3, d: 0.2, hp: 3 }, { x: 48.2, y: 1.5, z: -46.3, w: 1.6, h: 1.3, d: 0.2, hp: 3 }, { x: 46.9, y: 0.2, z: -46.3, w: 0.9, h: 2.6, d: 0.2, hp: 3 },
    ], { tex: PX.planks('#8a7a5c', 9), collide: true }));
    G.addInteract({ id: 'safe', x: 49.2, z: -46.8, r: 2, label: 'Open the safe', when: () => G.S.flags['task:can_wall'] && !G.S.flags.got_ledger && G.S.flags.mq7_started, act: () => G.story('safe') });
    G.addTask(new RubbleTask(G, 'can_rubble', 'Clear the cannery entrance', { x: 37, z: -42.3, w: 5, d: 3 }, 16));
    G.gates.cannery = P.solid(37, -43.9, 1.6, 0.4, 3);
    place('cannery_front', 37, -39.5); place('cannery_in', 40, -47);
    K.crate(33, -41.5, 0.9); K.barrel(48.5, -41.6, '#7a5140'); K.barrel(49.3, -42.2, '#7a5140'); K.crate(50, -53, 1);
    K.fence(31.5, -40.2, 34.5, -40.2, 'chain'); K.fence(39.5, -40.2, 51.5, -40.2, 'chain');
    K.sign(grp, 'CONDEMNED\nKEEP OUT', 45, 1.3, -40.1, { bg: PAL.mustard, fg: PAL.ink, w: 1.6 });

    // — The Marlowe Hotel (condemned) —
    const hotelSpec: HouseSpec = { x: -34, z: -47, w: 16, d: 8, h: 9, wall: clap('#c9bfa6', 0.9, 4), roof: 'hip', roofColor: '#5a4a58', door: { x: 0, color: '#6d4a6e' }, windows: [-6, -3.4, 3.4, 6], porch: { d: 2, roofed: true }, sign: { text: 'THE MARLOWE', bg: '#5a4a58', fg: PAL.butter, y: 8.6, w: 5 } };
    this.restorable('hotel', hotelSpec, { wall: clap('#f1ead9', 0.03, 4), shutter: '#2e456e', chimney: { x: 5 } });
    place('hotel_front', -34, -39.6);
    G.addTask(new PaintTask(G, 'hotel_paint', 'Paint the Marlowe facade', [{ x: -34, y: 0.35 + 1.45, z: -42.97, w: 16, h: 2.9 }], {}));
    G.addTask(new BuildTask(G, 'hotel_shore', 'Shore up the Marlowe foundation', [
      { x: -40.5, y: 0, z: -40.6, w: 0.3, h: 2.6, d: 0.3, nails: 1 }, { x: -27.5, y: 0, z: -40.6, w: 0.3, h: 2.6, d: 0.3, nails: 1 },
      { x: -37.5, y: 0, z: -40.6, w: 0.3, h: 2.6, d: 0.3, nails: 1 }, { x: -30.5, y: 0, z: -40.6, w: 0.3, h: 2.6, d: 0.3, nails: 1 },
      { x: -39, y: 2.3, z: -40.6, w: 3.4, h: 0.3, d: 0.3, nails: 2 }, { x: -29, y: 2.3, z: -40.6, w: 3.4, h: 0.3, d: 0.3, nails: 2 },
    ], {}));
    G.addTask(new PuzzleTask(G, 'hotel_truss', 'Design the foundation bracing', -34, -39.4, 'truss'));
    K.fence(-43, -39.9, -37, -39.9, 'chain'); K.fence(-31, -39.9, -25, -39.9, 'chain');

    // — Boathouse —
    const bh = H('boathouse', { x: -12, z: -45.5, w: 8, d: 6, h: 3, base: 0.2, wall: PX.shakes('#6f8794', 5), roofColor: '#4d5a52', roof: 'gableZ', door: { x: 0, color: '#6c665a' }, windows: [-2.6, 2.6], dead: true, interior: {} });
    { const g = bh.g, b = bh.base; K.box(g, PX.planks('#7a5a3c', 3), -2.6, b, -1.8, 1.6, 0.9, 1); K.crate(-12 + 2.6, -45.5 - 1.6, 0.8, b); K.flatBox(g, '#8cc9b4', 2.4, b + 0.5, 1.3, 0.5, 0.5, 0.5); P.solid(-14.6, -47.3, 1.6, 1, 1.2);
      K.flatBox(g, PAL.cream, -2.6, b + 0.92, -1.8, 0.5, 0.05, 0.7, false); }
    G.addTask(new DemoTask(G, 'boathouse_boards', 'Break the boarded door', [{ x: -12, y: 0.5, z: -42.5, w: 1.7, h: 0.4, d: 0.12, hp: 2 }, { x: -12, y: 1.15, z: -42.5, w: 1.7, h: 0.4, d: 0.12, hp: 2 }, { x: -12, y: 1.8, z: -42.5, w: 1.7, h: 0.4, d: 0.12, hp: 2 }], { tex: PX.planks('#8a7350', 2), collide: true }));
    G.addInteract({ id: 'logbook', x: -14.6, z: -46.4, r: 2, label: "Read Walt's logbook", when: () => !G.S.flags.got_logbook && G.S.flags.mq4_started, act: () => G.story('logbook') });
    place('boathouse_door', -12, -40.8);
    G.addInteract({ id: 'hatch', x: -8.2, z: -40.6, r: 1.6, label: 'Squeeze through the loose planks', when: () => G.S.flags.mq4_started && !G.S.flags['task:boathouse_boards'] && G.skillLv('exploration') >= 2, act: () => G.story('hatch') });

    // — pier, bait shack, the Marguerite —
    { const g = new THREE.Group(); g.position.set(3.2, 0, -59.5); grp.add(g);
      K.box(g, PX.shakes('#7a8f7a', 3), 0, 0, 0, 2.6, 2.3, 2.2); K.roof(g, 'gableZ', 2.6, 2.2, 0.8, PX.roofTex('#8a4d3c'), PX.shakes('#7a8f7a', 3), PAL.white, 0.3).position.y = 2.3;
      K.sign(g, 'BAIT', 0, 1.9, 1.15, { bg: PAL.white, fg: PAL.red, w: 1.1 }); K.window(g, 0, 1.2, 1.12, 1.2, 0.8, 's', false, undefined, 1); P.solid(3.2, -59.5, 2.6, 2.2, 3); }
    place('pier_end', -1.5, -59.5); place('pier_mid', 0.5, -50); place('boat', 1.4, -53);
    K.crate(-2.8, -60.6, 0.7); K.barrel(-3.2, -59.2, '#5a6a7a');
    const boat = this.boat(5.6, -53, '#e9e2cf', '#2e456e', 7, true);
    G.bobbers.push({ o: boat, y: -0.1, ph: 1 });
    G.addTask(new PaintTask(G, 'boat_paint', 'Scrape & paint the Marguerite', [{ x: 5.6, y: 0.45, z: -51.69, w: 6, h: 1 }], { wash: true, parent: boat, ox: 5.6, oz: -53, oy: -0.1, pattern: 'plain', reachFrom: { x: 1.5, z: -53 } }));
    for (const [x, z, c1, c2, s] of [[-40, -70, '#d9d5c8', '#b4483c', 5], [24, -64, '#c9d6d8', '#3f8f8c', 4.5], [70, -66, '#e9e2cf', '#d9a441', 5]] as any[]) G.bobbers.push({ o: this.boat(x, z, c1, c2, s, false), y: -0.12, ph: x });
    for (const [x, z] of [[-22, -66], [16, -72], [46, -62], [-60, -58]]) { const b = new THREE.Group(); K.flatBox(b, PAL.red, 0, 0, 0, 0.5, 0.7, 0.5); K.flatBox(b, PAL.white, 0, 0.7, 0, 0.3, 0.4, 0.3); b.position.set(x, -0.3, z); grp.add(b); G.bobbers.push({ o: b, y: -0.3, ph: x * 2 }); }

    // — Maple Lane houses —
    const mabel = H('mabel', { x: 11, z: 8, w: 10, d: 8, h: 3.2, wall: clap('#ecd58a', 0.3, 5), roofColor: '#8a4d3c', roof: 'gableX', door: { x: 0, color: '#4f7fa8' }, shutter: '#4f7fa8', chimney: { x: 3.4 }, dormers: [-2.6, 2.6], porch: { d: 2.4, roofed: true, color: '#8a8272' } });
    place('mabel_porch', 11, 15.4); place('mabel_garden', 4.5, 15.5); place('mabel_in', 13, 13.6);
    K.flowerBox(mabel.front, -2.9, 0.95, 4.14); K.flowerBox(mabel.front, 2.9, 0.95, 4.14);
    K.fence(4, 18, 9.5, 18); K.fence(12.5, 18, 18, 18); K.fence(18, 18, 18, 12, 'picket'); K.mailbox(9.2, 18.4, '#4f7fa8');
    K.bench(15.5, 16.2, Math.PI); for (let i = 0; i < 4; i++) K.bush(5.2 + i * 0.1, 3 + i * 2.6, 0.5, i % 2 ? '#5a9a48' : '#b4483c');
    const rot = PX.rotten(3);
    G.addTask(new DemoTask(G, 'mabel_demo', 'Tear out the rotten railing', [
      { x: 7.6, y: 0.35, z: 14.3, w: 2.6, h: 0.9, d: 0.14, hp: 2 }, { x: 14.4, y: 0.35, z: 14.3, w: 2.6, h: 0.9, d: 0.14, hp: 2 }, { x: 11, y: 0, z: 14.9, w: 1.8, h: 0.24, d: 0.8, hp: 2 },
      { x: 6.1, y: 0.35, z: 13.2, w: 0.14, h: 0.9, d: 2.2, hp: 2 }, { x: 15.9, y: 0.35, z: 13.2, w: 0.14, h: 0.9, d: 2.2, hp: 2 },
    ], { tex: rot }));
    G.addTask(new BuildTask(G, 'mabel_build', 'Build the new railing & steps', [
      { x: 6.2, y: 0.35, z: 14.3, w: 0.16, h: 1, d: 0.16, nails: 1 }, { x: 9.1, y: 0.35, z: 14.3, w: 0.16, h: 1, d: 0.16, nails: 1 }, { x: 12.9, y: 0.35, z: 14.3, w: 0.16, h: 1, d: 0.16, nails: 1 }, { x: 15.8, y: 0.35, z: 14.3, w: 0.16, h: 1, d: 0.16, nails: 1 },
      { x: 7.65, y: 1.2, z: 14.3, w: 3.1, h: 0.12, d: 0.14, nails: 2 }, { x: 14.35, y: 1.2, z: 14.3, w: 3.1, h: 0.12, d: 0.14, nails: 2 },
      { x: 7.65, y: 0.75, z: 14.3, w: 3.1, h: 0.1, d: 0.1, nails: 2 }, { x: 14.35, y: 0.75, z: 14.3, w: 3.1, h: 0.1, d: 0.1, nails: 2 },
      { x: 11, y: 0, z: 14.9, w: 1.9, h: 0.2, d: 0.8, nails: 2 },
    ]));
    G.addTask(new PaintTask(G, 'mabel_paint', 'Stain the porch deck', [{ x: 11, y: 0.37, z: 13.2, w: 9.6, h: 2.2, floor: true }], { pattern: 'plank' }));

    const finch = H('finch', { x: 27, z: 8, w: 9, d: 8, h: 6, wall: clap('#8cc9b4', 0.15, 6), roofColor: '#56607a', roof: 'gableZ', door: { x: -1.5, color: PAL.white }, shutter: PAL.white, porch: { d: 2, w: 9, roofed: true, rail: true } });
    void finch; place('finch_door', 25.5, 15); place('oak', 34.5, 13.2);
    K.fence(21, 18, 25, 18); K.fence(29, 18, 40, 18); K.mailbox(24.8, 18.4, '#3f8f8c');
    K.tree(36, 10, 2.1, 0);
    G.addTask(new BuildTask(G, 'treehouse', "Build Hattie's treehouse", [
      { x: 34.4, y: 0, z: 11.4, w: 0.18, h: 3.2, d: 0.18, nails: 1 }, { x: 37.6, y: 0, z: 11.4, w: 0.18, h: 3.2, d: 0.18, nails: 1 },
      { x: 36, y: 3.2, z: 11.3, w: 3.8, h: 0.2, d: 0.2, nails: 2 }, { x: 36, y: 3.4, z: 10.4, w: 3.8, h: 0.12, d: 2.2, nails: 3 },
      { x: 36, y: 4.2, z: 11.4, w: 3.8, h: 0.12, d: 0.12, nails: 2 }, { x: 34.2, y: 3.5, z: 11.4, w: 0.12, h: 0.8, d: 0.12, nails: 1 }, { x: 37.8, y: 3.5, z: 11.4, w: 0.12, h: 0.8, d: 0.12, nails: 1 },
      { x: 33.9, y: 0, z: 11.6, w: 0.5, h: 3.3, d: 0.1, nails: 2 },
    ]));
    G.addTask(new PaintTask(G, 'treehouse_paint', 'Paint the treehouse sign', [{ x: 36, y: 3.85, z: 11.52, w: 3, h: 0.6 }], { pattern: 'plain' }));

    this.restorable('model', { x: 45, z: 8, w: 9, d: 8, h: 3.2, wall: clap('#b9b3a2', 0.95, 7), roofColor: '#6d4a6e', roof: 'gableX', door: { x: 2, color: '#6d4a6e' }, dormers: [-2], porch: { d: 2, w: 5, x: 2, roofed: true }, sign: { text: 'MODEL HOME', bg: '#d8cfb4', fg: '#6d4a6e', y: 2.9, x: -2 } }, { wall: clap('#cf847f', 0.02, 7), shutter: PAL.white, chimney: { x: -3 }, sign: undefined });
    place('model_front', 47, 15);
    G.addTask(new PaintTask(G, 'model_paint', 'Repaint the Model Home', [{ x: 45, y: 0.35 + 1.6, z: 12.03, w: 9, h: 3.2 }], { wash: true }));
    G.addTask(new DemoTask(G, 'model_demo', 'Strip the rotten porch', [{ x: 45.2, y: 0.35, z: 14.05, w: 2.6, h: 0.9, d: 0.14, hp: 2 }, { x: 48.8, y: 0.35, z: 14.05, w: 1.2, h: 0.9, d: 0.14, hp: 2 }, { x: 44.6, y: 0.35, z: 13.1, w: 0.14, h: 0.9, d: 1.9, hp: 2 }], { tex: rot }));
    G.addTask(new BuildTask(G, 'model_build', 'Rebuild the porch rail', [{ x: 44.6, y: 0.35, z: 14.05, w: 0.16, h: 1, d: 0.16, nails: 1 }, { x: 49.4, y: 0.35, z: 14.05, w: 0.16, h: 1, d: 0.16, nails: 1 }, { x: 45.3, y: 1.2, z: 14.05, w: 1.5, h: 0.12, d: 0.14, nails: 2 }, { x: 48.7, y: 1.2, z: 14.05, w: 1.5, h: 0.12, d: 0.14, nails: 2 }]));
    K.fence(41, 18, 43.5, 18, 'picket', '#b9b3a2'); K.fence(46.5, 18, 51, 18, 'picket', '#b9b3a2');

    // — Gull Row bungalows (buyable) —
    const bcol = ['#4f7fa8', '#86a06c', '#ecd27e'];
    [-34, -22, -10].forEach((x, i) => {
      const id = 'bung' + (i + 1);
      this.restorable(id, { x, z: 33, w: 8, d: 7, h: 3, wall: clap(['#9a9484', '#a39a8a', '#8f8c80'][i], 0.95, 8 + i), roofColor: ['#5d5a58', '#6b5548', '#4d5a52'][i], roof: i === 1 ? 'gableZ' : 'gableX', door: { x: i === 1 ? 0 : -1.5, color: '#6c665a' }, porch: i === 1 ? undefined : { d: 1.8, w: 4, x: -1.5, roofed: true } }, { wall: clap(bcol[i], 0.02, 8 + i), shutter: PAL.white, chimney: { x: 2.5 } });
      G.addTask(new PaintTask(G, id + '_paint', 'Wash & paint the bungalow', [{ x, y: 0.35 + 1.5, z: 36.53, w: 8, h: 3 }], { wash: true }));
      G.addTask(new DemoTask(G, id + '_demo', 'Pull the rotten trim', [{ x: x - 3, y: 0.3, z: 36.75, w: 1.6, h: 0.5, d: 0.14, hp: 2 }, { x: x + 3, y: 0.3, z: 36.75, w: 1.6, h: 0.5, d: 0.14, hp: 2 }, { x: x + 2.4, y: 1.9, z: 36.75, w: 1.8, h: 0.3, d: 0.14, hp: 2 }], { tex: rot }));
      G.addTask(new BuildTask(G, id + '_build', 'Install new trim boards', [{ x: x - 3, y: 0.3, z: 36.75, w: 1.6, h: 0.3, d: 0.1, nails: 2 }, { x: x + 3, y: 0.3, z: 36.75, w: 1.6, h: 0.3, d: 0.1, nails: 2 }, { x: x + 2.4, y: 2.9, z: 36.75, w: 2, h: 0.2, d: 0.1, nails: 2 }]));
      place(id, x, 39);
      K.fence(x - 5, 39.6, x - 1.5, 39.6, 'picket', '#b9b3a2'); K.fence(x + 1.5, 39.6, x + 5, 39.6, 'picket', '#b9b3a2');
      G.addInteract({ id: id + '_sign', x: x + 3.5, z: 39, r: 1.7, label: 'For-sale sign', when: () => !G.S.props[id], act: () => G.ui.openCompany('property') });
      K.flatBox(grp, PAL.woodDark, x + 3.5, 0, 38.6, 0.1, 1.1, 0.1); K.sign(grp, 'FOR SALE', x + 3.5, 1.2, 38.6, { bg: PAL.red, fg: PAL.white, w: 1.2 });
    });

    // — Patel Electric & Ines's cottage —
    H('patel', { x: 12, z: 32.5, w: 8, d: 7, h: 3.2, wall: PX.brick('#7f8fa8', 4), trim: PAL.white, roof: 'flat', door: { x: -2, color: PAL.mustard }, windows: [1.6], winW: 2.4, winH: 1.5, sign: { text: 'PATEL ELECTRIC', bg: PAL.mustard, fg: PAL.ink, y: 3.3 } });
    place('patel_door', 10, 38.2); this.van(15.5, 27.5);
    H('ines', { x: 26, z: 32.5, w: 8, d: 7, h: 3, wall: PX.stucco('#e9b9a8', 3), roofColor: '#3f8f8c', roof: 'hip', door: { x: 0, color: '#3f8f8c' }, shutter: '#3f8f8c', chimney: { x: -2.5 } });
    place('ines_door', 26, 38.2); place('mural', 40.5, 34.6);
    K.flowerBox(this.houses.ines.front, -2.6, 0.95, 3.64); K.flowerBox(this.houses.ines.front, 2.6, 0.95, 3.64);
    // community garden + mural wall
    K.box(grp, PX.stucco('#d9d5c8', 9), 40.5, 0, 31.4, 11, 3.2, 0.4); P.solid(40.5, 31.4, 11, 0.4, 3.2);
    G.addTask(new PaintTask(G, 'mural', 'Paint the garden mural', [{ x: 40.5, y: 1.6, z: 31.63, w: 11, h: 3.2 }], { pattern: 'plain', mural: true }));
    K.fence(33, 39.6, 50, 39.6, 'picket'); K.fence(50, 27, 50, 39.6, 'picket'); K.bench(36, 36.5, Math.PI); K.bench(45, 36.5, Math.PI);
    for (let i = 0; i < 14; i++) K.bush(34 + (i % 7) * 2.3 + (i > 6 ? 0.6 : 0), i > 6 ? 37.8 : 28.4, 0.38, i % 3 ? '#5a9a48' : '#d98a3d');

    // — Lighthouse —
    { const g = new THREE.Group(); g.position.set(58, 0, -51); grp.add(g);
      K.box(g, PX.stone('#8d8c8a', 6), 0, 0, 0, 5, 1, 5);
      K.box(g, clap('#c9c2b0', 0.95, 12), 0, 1, 0, 4, 10, 4);
      for (const y of [3.6, 7.2]) K.box(g, clap('#9a5a50', 0.9, 13), 0, y, 0, 4.06, 1.6, 4.06);
      K.flatBox(g, '#3a3b4a', 0, 11, 0, 5.2, 0.25, 5.2); for (const [x, z] of [[-2.5, 2.5], [2.5, 2.5], [-2.5, -2.5], [2.5, -2.5]]) K.flatBox(g, '#3a3b4a', x, 11.25, z, 0.1, 0.9, 0.1, false);
      K.flatBox(g, '#3a3b4a', 0, 12.1, 2.5, 5.1, 0.08, 0.08, false);
      const lampM = new THREE.MeshLambertMaterial({ color: 0x8fa3b0, emissive: 0xfff2c0, emissiveIntensity: 0 });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.8, 8), lampM); lamp.position.y = 12.2; g.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.4, 8), mat(PX.roofTex('#8a4d3c'))); cap.position.y = 13.8; cap.castShadow = true; g.add(cap);
      K.door(g, 0, 1, 2.05, '#5b4a44'); K.window(g, 0, 6, 2.05, 0.8, 1.1, 's', false, undefined, 1);
      K.box(g, PX.concrete(), 0, 0, 2.9, 1.8, 0.5, 0.9); K.box(g, PX.concrete(), 0, 0.5, 2.6, 1.8, 0.5, 0.5);
      P.solid(58, -51, 5, 5, 12);
      const beam = new THREE.Group(); beam.position.set(58, 12.2, -51); grp.add(beam);
      for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3.2, 70, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); b.rotation.z = Math.PI / 2; b.position.x = s * 36; b.scale.x = s; beam.add(b); }
      beam.visible = false; beam.userData.lit = false; G.sky.beam = beam;
      const lg = K.glow(58, 12.2, -51, 6, 0xfff0c0); lg.visible = false;
      G.sceneFlags.lighthouse = { lampM, beam, glow: lg };
      G.addTask(new PaintTask(G, 'lighthouse_paint', 'Repaint the lighthouse', [{ x: 58, y: 1 + 3.5, z: -48.96, w: 4, h: 7 }], { color: 0 }));
      G.addInteract({ id: 'lamp', x: 58, z: -47.4, r: 2, label: 'Climb up and relight the lamp', when: () => !!G.S.flags.can_light && !G.S.flags.lit, act: () => G.story('light') });
    }
    place('lighthouse', 58, -45.5);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; K.rockAt(58 + Math.cos(a) * (6 + this.R() * 1.5), -51 + Math.sin(a) * (7.5 + this.R() * 1.5), 0.8 + this.R() * 0.9, -0.5); }

    // — seawall breach (finale) —
    for (let i = 0; i < 9; i++) K.rockAt(-23.5 + i * 0.9 + this.R() * 0.4, -38.6 - this.R() * 1.6, 0.35 + this.R() * 0.4, -0.2);
    K.fence(-25, -35.4, -15, -35.4, 'chain', '', false);
    K.sign(grp, 'DANGER\nROAD UNDERMINED', -20, 1.2, -35.3, { bg: PAL.mustard, fg: PAL.ink, w: 2 });
    G.gates.breach = P.solid(-20, -38, 8, 4, 3);
    G.addTask(new PuzzleTask(G, 'seawall_piles', 'Set the pile depths from the survey', -20, -34.4, 'piles'));
    const sw: any[] = [];
    for (let i = 0; i < 5; i++) sw.push({ x: -23.6 + i * 1.8, y: -1.4, z: -40.2, w: 0.42, h: 2.6, d: 0.42, nails: 0, tex: 'pile' });
    for (let i = 0; i < 2; i++) sw.push({ x: -20, y: -0.9 + i * 1.0, z: -39.92, w: 8, h: 0.34, d: 0.16, nails: 4 });
    sw.push({ x: -20, y: 1.05, z: -40.1, w: 8.2, h: 0.16, d: 0.5, nails: 3 });
    G.addTask(new BuildTask(G, 'seawall_build', 'Rebuild the seawall', sw, { reachFrom: { x: -20, z: -35 }, cost: { concrete: 1 } }));
    place('breach', -20, -34.2);
    // stone seawall along the rest of the waterfront
    for (const [x0, x1] of [[-52, -44], [-24, -17], [-7, -1], [2, 6], [28, 31]]) { if (x0 === -24) continue; K.box(grp, PX.stone('#7f8085', 7), (x0 + x1) / 2, -1.6, -40.15, x1 - x0, 1.7, 0.5, 4, false); }
    K.box(grp, PX.stone('#7f8085', 7), -34, -1.6, -52.2, 20, 1.7, 0.5, 4, false); K.box(grp, PX.stone('#7f8085', 7), -44.2, -1.6, -46, 0.5, 1.7, 12.4, 4, false); K.box(grp, PX.stone('#7f8085', 7), -23.8, -1.6, -46, 0.5, 1.7, 12.4, 4, false);

    // — park & gazebo —
    { const g = new THREE.Group(); g.position.set(-38, 0, 9); grp.add(g);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.1, 0.35, 8), mat(PX.planks('#c9ad84', 3))); fl.position.y = 0.175; fl.receiveShadow = true; g.add(fl);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; K.flatBox(g, PAL.white, Math.cos(a) * 2.7, 0.35, Math.sin(a) * 2.7, 0.16, 2.6, 0.16); }
      const rf = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1.8, 8), mat(PX.roofTex('#3f8f8c'))); rf.position.y = 3.85; rf.castShadow = true; g.add(rf);
      K.flatBox(g, PAL.white, 0, 2.9, 0, 0.3, 0.12, 0.3, false); K.ao(-38, 9, 5, 5); P.solid(-38, 9, 5.6, 5.6, 0.35); }
    place('gazebo', -38, 9); place('park', -36, 15);
    K.bench(-42, 14.5, Math.PI / 2); K.bench(-34, 3.5, 0); K.tree(-43, 3, 1.5, 0); K.tree(-33, 15.5, 1.3, 2); K.tree(-43.5, 16, 1.2, 0);

    // — Thorn's survey cabin (forest) —
    const cabin = H('cabin', { x: -80, z: -19.5, w: 7, d: 6, h: 2.8, wall: PX.planks('#6b4a32', 21, 8), trim: '#4b3626', roofColor: '#4d5a52', moss: 0.2, roof: 'gableX', door: { x: -1.2, color: '#4b3626' }, windows: [1.6], interior: {}, chimney: { x: 2.4 } });
    { const g = cabin.g, b = cabin.base; K.box(g, PX.planks('#7a5a3c', 3), 1.8, b, -2, 2, 0.9, 1); K.flatBox(g, PAL.cream, 1.6, b + 0.92, -2, 0.7, 0.04, 0.5, false); K.flatBox(g, '#8a4d3c', -2.6, b, -1.8, 1, 0.5, 1.8); K.flatBox(g, '#d9a441', 2.3, b + 0.92, -2.2, 0.2, 0.5, 0.2, false); P.solid(-78.2, -21.5, 2, 1, 1.2);
      // surveyor's transit on a tripod outside
      const tr = new THREE.Group(); tr.position.set(-76, 0, -15.5); grp.add(tr); for (let i = 0; i < 3; i++) { const l = K.flatBox(tr, '#b58a43', Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3, 0.07, 1.4, 0.07); l.rotation.z = Math.cos(i * 2.1) * 0.22; l.rotation.x = -Math.sin(i * 2.1) * 0.22; } K.flatBox(tr, '#d9a441', 0, 1.4, 0, 0.3, 0.2, 0.2); }
    place('cabin_door', -81.2, -15.2);
    G.addInteract({ id: 'survey', x: -78.2, z: -20.6, r: 1.8, label: "Search Elias Thorn's desk", when: () => !!G.S.flags.mq5_started && !G.S.flags.got_survey, act: () => G.story('survey') });
    G.addTask(new LogTask(G, 'trail_logs', 'Cut through the fallen trees', [{ x: -58.5, z: -13.6, len: 5.5, rot: 1.35 }, { x: -60.2, z: -13.2, len: 5, rot: 1.75 }]));
    G.gates.logs = P.solid(-59.3, -13.5, 2.4, 6, 3);
    G.addInteract({ id: 'deertrail', x: -58.3, z: -18, r: 1.8, label: 'Follow the deer trail around', when: () => !G.S.flags['task:trail_logs'] && !!G.S.flags.mq5_started && G.skillLv('exploration') >= 2, act: () => G.story('deertrail') });
    // footbridge over the creek
    const bridge = new THREE.Group(); bridge.visible = false; grp.add(bridge);
    deck(-72, -15, -65, -13, false, bridge);
    for (const z of [-15, -13]) { K.flatBox(bridge, PAL.woodDark, -68.5, 0.85, z, 7, 0.1, 0.1, false); for (let x = -71.8; x <= -65; x += 1.7) K.flatBox(bridge, PAL.woodDark, x, 0, z, 0.1, 0.9, 0.1, false); }
    G.sceneFlags.bridge = bridge;
    for (const [x, z, r] of [[-71.4, -14.6, 0.3], [-66, -13.4, -0.2]]) { const b = K.box(grp, PX.rotten(2), x, -0.2, z, 1.6, 0.14, 1.6); b.rotation.z = r; }
    G.gates.bridge = P.solid(-68.5, -14, 5, 3, 3);
    G.addTask(new PuzzleTask(G, 'bridge_truss', 'Rebuild the footbridge truss', -73.2, -14, 'truss'));
    place('bridge', -73.4, -14); place('logs', -56, -13.6);
    // stepping stones (exploration shortcut)
    for (let i = 0; i < 4; i++) K.rockAt(-71.5 + i * 1.3, 1.6 + (i % 2) * 0.3, 0.55, -0.32);
    G.gates.stones = P.solid(-69.6, 1.8, 6, 2.4, 3);
    for (let z = 1; z < 3; z++) for (let x = -73; x < -66; x++) this.walk[this.idx(x, z)] = 1;
    G.addInteract({ id: 'stones', x: -64.5, z: 2, r: 2.2, label: 'Hop across the stepping stones', when: () => !!G.gates.stones && G.skillLv('exploration') >= 2, act: () => G.story('stones') });
    this.path([[-52, -2], [-58, 0], [-64, 2]], T.forest, 1);

    // ══════════ 5. street furniture & nature ══════════
    const lampSpots: number[][] = [];
    for (let x = -44; x <= 48; x += 12) { lampSpots.push([x + 0.5, -29.4], [x + 6.5, -7.6], [x + 0.5, 25.6]); }
    for (let z = -24; z <= 38; z += 14) lampSpots.push([3.6, z]);
    for (const x of [-30, -6, 10, 26, 44]) lampSpots.push([x, -36.6]);
    lampSpots.forEach(([x, z], i) => { K.lamp(x, z, x === 3.6); });
    for (const [x, z, r] of [[-9, -37.2, 0], [8, -37.2, 0], [26, -37.2, 0], [-28, -8.2, 0], [22, -8.4, 0], [44, 18.4, Math.PI]] as number[][]) K.bench(x, z, r);
    // street trees & hedges
    for (const [x, z, s, k] of [[-8, -31.5, 1, 0], [8, -9.5, 0.9, 2], [45, -11, 1.1, 0], [20, 2.5, 1.2, 0], [39, 2.5, 1, 2], [-4.5, 30, 1.2, 0], [20, 28, 1.1, 2], [4.5, 44.5, 1.3, 0], [-16, 45.5, 1.4, 0], [-30, 46, 1.2, 2], [30, 45.5, 1.3, 0], [18, 46.6, 1.1, 0], [-44, 44, 1.5, 0], [50, 3, 1.2, 0], [-46.5, -24, 1.2, 1], [-47, -12, 1.3, 1], [48, 44, 1.2, 2], [60, 20, 1.4, 0], [61, 5, 1.2, 1], [60.5, -12, 1.3, 0], [61, -28, 1.1, 1], [47, -24, 1.2, 0], [-28, 22.5, 1, 0]] as number[][]) K.tree(x, z, s, k);
    for (let i = 0; i < 9; i++) K.bush(-28 + i * 2.6, 0.2, 0.55); for (let i = 0; i < 6; i++) K.bush(20.5, 3 + i * 1.8, 0.5, '#467a3d');
    // the woods
    const F = rng(4711);
    for (let i = 0; i < 620; i++) {
      const x = -96 + F() * 44, z = -62 + F() * 124;
      const t = this.tileAt(x, z);
      if (t !== T.forest || this.isWater(x, z) || Math.hypot(x + 80, z + 18) < 8) continue;
      let nearPath = false;
      for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) { const tt = this.tileAt(x + dx, z + dz); if (tt === T.path || tt === T.dirt || this.isWater(x + dx, z + dz)) nearPath = true; }
      if (nearPath) continue;
      K.tree(x, z, 0.9 + F() * 0.9, F() < 0.72 ? 1 : F() < 0.6 ? 0 : 2, x > -94 && x < -53);
    }
    for (let i = 0; i < 220; i++) { const a = F() * 6.28, r = 20 + F() * 70; const x = -150 + Math.cos(a) * r * 0.7, z = Math.sin(a) * r * 1.6; if (x < -97) K.tree(x, z, 1.3 + F() * 1.4, 1, false, F() * 2); }
    for (let i = 0; i < 90; i++) { const x = 66 + F() * 40, z = -30 + F() * 110; K.tree(x, z, 1.1 + F(), F() < 0.5 ? 1 : 0, false); }
    for (let i = 0; i < 70; i++) { const x = -60 + F() * 130, z = 66 + F() * 10; K.tree(x, z, 1.2 + F(), F() < 0.4 ? 1 : 0, false); }
    // islands across the bay
    for (const [ix, iz, r] of [[-70, -118, 16], [40, -140, 22], [120, -110, 14]]) {
      const isl = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), mat(PX.leaves('#4a7a45', 6), { flatShading: true }, 'fs')); isl.scale.y = 0.16; isl.position.set(ix, -0.6, iz); grp.add(isl);
      for (let i = 0; i < r; i++) { const a = F() * 6.28, d = F() * r * 0.75; K.tree(ix + Math.cos(a) * d, iz + Math.sin(a) * d, 1.4 + F(), 1, false, r * 0.16 * (1 - d / r) - 0.4); }
    }
    // ground cover
    for (let i = 0; i < 2600; i++) {
      const x = -94 + F() * 156, z = -40 + F() * 102, t = this.tileAt(x, z);
      if (t === T.grass && F() < 0.3) K.tuft(x, z, F() < 0.8 ? 0 : 1, 0.7 + F() * 0.5);
      else if (t === T.flowers) K.tuft(x, z, 1, 0.8 + F() * 0.4);
      else if (t === T.tallgrass) K.tuft(x, z, F() < 0.75 ? 0 : 2, 1 + F() * 0.6);
      else if (t === T.marsh) K.tuft(x, z, 2, 0.9 + F() * 0.7);
      else if (t === T.forest && F() < 0.4) K.tuft(x, z, F() < 0.6 ? 3 : 0, 0.8 + F() * 0.5);
      else if (t === T.sand && F() < 0.12) K.tuft(x, z, 2, 0.6);
    }
    for (let i = 0; i < 30; i++) { const x = -74 + F() * 30, z = -41 + F() * 3; if (this.tileAt(x, z) === T.sand) K.rockAt(x, z, 0.2 + F() * 0.3, -0.05); }

    // ══════════ 6. festival dressing (hidden until the finale) ══════════
    this.festival.visible = false; grp.add(this.festival);
    const bulbs = [0xffd08a, 0xff8f7a, 0x8fd8c8, 0xf0e08a];
    const string = (x0: number, z0: number, x1: number, z1: number) => {
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.1);
      for (let i = 0; i <= n; i++) { const t = i / n, y = 3.3 - Math.sin(t * Math.PI) * 0.7; const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), new THREE.MeshBasicMaterial({ color: bulbs[i % 4] })); b.position.set(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t); this.festival.add(b); if (i % 3 === 1) { const gl = K.glow(b.position.x, y, b.position.z, 1.6, bulbs[i % 4], true); this.festival.add(gl); } }
    };
    for (const x of [-30, -6, 10]) string(x, -36.6, x === -30 ? -6 : x === -6 ? 10 : 26, -36.6);
    string(26, -36.6, 44, -36.6); string(3.6, -24, 3.6, -10); string(3.6, -10, 3.6, 4);
    string(-1, -40, -1, -57); string(2, -40, 2, -57);
    for (const [x, z] of [[-3, -37.8], [3.5, -37.8], [16, -37.6]]) { K.box(this.festival, PX.planks('#a37747', 3), x, 0.7, z, 2.2, 0.1, 1); K.box(this.festival, awningTex(PAL.teal), x, 0.72, z, 2, 0.04, 0.8, 1, false); K.flatBox(this.festival, '#6b4a32', x - 0.9, 0, z, 0.1, 0.7, 0.8, false); K.flatBox(this.festival, '#6b4a32', x + 0.9, 0, z, 0.1, 0.7, 0.8, false); }

    // ══════════ 7. water-edge colliders, road graph ══════════
    for (let z = 0; z < MAP_H; z++) {
      let run = -1;
      for (let x = 0; x <= MAP_W; x++) {
        const i = z * MAP_W + x;
        let block = false;
        if (x < MAP_W && this.tiles[i] === 255 && !this.walk[i]) {
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) { const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < MAP_W && nz < MAP_H) { const j = nz * MAP_W + nx; if (this.tiles[j] !== 255 || this.walk[j]) block = true; } }
        }
        if (block && run < 0) run = x;
        if (!block && run >= 0) { P.solid(OX + (run + x) / 2, OZ + z + 0.5, x - run, 1, 3, -1); run = -1; }
      }
    }
    K.finalize();
    G.gfx.scene.add(grp);
  }

  private restorable(id: string, spec: HouseSpec, live: Partial<HouseSpec>) {
    const dead = this.G.kit.house({ ...spec, dead: true, name: id });
    const lv = this.G.kit.house({ ...spec, ...live, dead: false, name: id });
    lv.g.visible = false;
    this.restorables[id] = { dead, live: lv };
    this.houses[id] = dead;
  }
  setRestored(id: string, on: boolean) { const r = this.restorables[id]; if (r) { r.dead.g.visible = !on; r.live.g.visible = on; } }

  private boat(x: number, z: number, hull: string, stripe: string, len: number, cabin: boolean): THREE.Group {
    const K = this.G.kit, g = new THREE.Group();
    g.position.set(x, -0.1, z);
    K.group.add(g);
    K.box(g, PX.planks(hull, 4, 8), 0, -0.3, 0, len, 1.1, 2.4);
    K.flatBox(g, stripe, 0, 0.55, 0, len + 0.1, 0.25, 2.5);
    const bow = K.box(g, PX.planks(hull, 4, 8), len / 2 + 0.2, -0.3, 0, 1.7, 1.1, 1.7); bow.rotation.y = Math.PI / 4;
    if (cabin) { K.box(g, PX.planks(PAL.white, 5, 8), -0.8, 0.8, 0, 2.4, 1.5, 1.8); K.flatBox(g, stripe, -0.8, 2.3, 0, 2.8, 0.14, 2.1); K.window(g, -0.8, 1.7, 0.92, 1.6, 0.6, 's', false, undefined, 1); K.flatBox(g, '#c9c5b8', 1.4, 0.8, 0, 0.1, 3.4, 0.1); }
    else { K.flatBox(g, '#c9c5b8', 0, 0.8, 0, 0.1, 5, 0.1); const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4), mat(PX.flat('#f4efe2'), { side: THREE.DoubleSide }, 'ds')); s.position.set(1.3, 3.2, 0); g.add(s); }
    return g;
  }
  private van(x: number, z: number) {
    const K = this.G.kit, g = new THREE.Group(); g.position.set(x, 0, z); K.group.add(g);
    K.flatBox(g, PAL.mustard, 0, 0.4, 0, 4.2, 1.7, 1.9); K.flatBox(g, '#cfe6f0', 1.6, 1.3, 0, 1.1, 0.7, 1.92, false); K.flatBox(g, PAL.ink, -1.3, 0.05, 0, 0.8, 0.7, 2, false); K.flatBox(g, PAL.ink, 1.3, 0.05, 0, 0.8, 0.7, 2, false);
    K.sign(g, 'PATEL', -0.6, 1.3, 0.97, { bg: PAL.mustard, fg: PAL.ink, w: 1.6 });
    this.G.phys.solid(x, z, 4.2, 1.9, 2);
  }
}

function flagCanvas() {
  const [c, g] = PX.mkCanvas(27, 16);
  g.fillStyle = '#2e456e'; g.fillRect(0, 0, 27, 16);
  g.fillStyle = '#f4efe2'; g.fillRect(0, 6, 27, 4);
  g.fillStyle = '#e2c15a'; g.fillRect(4, 3, 6, 10); g.fillRect(2, 5, 10, 2); g.fillRect(6, 2, 2, 12);
  return c;
}
function picketCanvas() {
  const [c, g] = PX.mkCanvas(16, 16);
  g.fillStyle = '#f4efe2';
  for (const x of [1, 6, 11]) g.fillRect(x, 2, 3, 14);
  g.fillStyle = '#c9c5b8'; g.fillRect(0, 5, 16, 2); g.fillRect(0, 11, 16, 2);
  return c;
}
