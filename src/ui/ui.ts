// Pixel-styled DOM interface: HUD, dialogue, journal, skills, map, company, shops,
// and the two bench activities (saw cuts and the engineer's drafting board).
import * as THREE from 'three';
import { icon, PAINTS, TILE } from '../art/pixel';
import { portrait } from '../art/sprites';
import type { Game, Skill } from '../game/game';
import { SKILLS } from '../game/game';
import * as C from '../game/content';
import type { Script, Choice } from '../game/dialogue';
import { stepNpc } from '../game/dialogue';
import { PLAYER_SPEC } from '../game/player';
import type { Npc } from '../game/npc';
import type { SawTask, PuzzleTask, ToolId } from '../game/work';
import { MAP_W, MAP_H, OX, OZ } from '../world/town';

const $ = (html: string): HTMLElement => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ic = (n: string, s = 32) => `<img class="px" src="${icon(n)}" width="${s}" height="${s}">`;

export class UI {
  root = document.getElementById('ui')!;
  hud: HTMLElement; stats: HTMLElement; questEl: HTMLElement; hotbar: HTMLElement; mats: HTMLElement; promptEl: HTMLElement; taskbar: HTMLElement;
  toasts: HTMLElement; layer: HTMLElement; captionEl: HTMLElement; fadeEl: HTMLElement; cardEl: HTMLElement; stam: HTMLElement;
  private dlg: { script: Script; i: number; shown: number; text: string; onEnd?: () => void; el: HTMLElement; choosing: boolean } | null = null;
  private win: { name: string; el: HTMLElement; onClose?: () => void; tick?: (dt: number) => void } | null = null;
  private palette: HTMLElement | null = null;
  private bubbles: { el: HTMLElement; pos: () => THREE.Vector3; t: number }[] = [];
  private marker: HTMLElement; private minors: HTMLElement[] = [];
  private slow = 0;
  private bannerQ: string[][] = []; private bannerT = 0;
  private tab = 'journal';
  titleUp = true;

  constructor(private G: Game) {
    const r = this.root;
    this.hud = $(`<div id="hud" style="opacity:0"></div>`); r.append(this.hud);
    this.stats = $(`<div id="stats" class="panel"></div>`);
    this.questEl = $(`<div id="quest" class="panel"></div>`);
    this.hotbar = $(`<div id="hotbar" class="panel"></div>`);
    this.mats = $(`<div id="mats" class="panel"></div>`);
    this.stam = $(`<div id="stam"><i></i></div>`);
    this.promptEl = $(`<div id="prompt" class="hidden"></div>`);
    this.taskbar = $(`<div id="taskbar" class="hidden"></div>`);
    this.toasts = $(`<div id="toasts"></div>`);
    this.layer = $(`<div style="position:absolute;inset:0"></div>`);
    this.marker = $(`<div class="marker hidden"><i></i><small></small></div>`);
    this.layer.append(this.marker);
    this.hud.append(this.layer, this.stats, this.questEl, this.hotbar, this.mats, this.stam, this.promptEl, this.taskbar, this.toasts);
    this.captionEl = $(`<div id="caption"></div>`); this.cardEl = $(`<div id="titlecard" style="opacity:0"></div>`);
    this.fadeEl = $(`<div id="fade"></div>`);
    r.append(this.captionEl, this.cardEl, this.fadeEl);
    window.addEventListener('keydown', (e) => this.key(e));
    this.hotbar.addEventListener('click', (e) => { const s = (e.target as HTMLElement).closest('[data-tool]') as HTMLElement; if (s) G.setTool(s.dataset.tool as ToolId); else if ((e.target as HTMLElement).closest('#swatch')) this.paintPicker(); });
  }

  get blocking() { return !!this.dlg || !!this.win || this.titleUp; }
  get paused() { return this.win?.name === 'menu'; }
  get inDialogue() { return !!this.dlg; }

  // ───────────── basics ─────────────
  showHud(on: boolean) { this.hud.style.opacity = on ? '1' : '0'; }
  toast(msg: string, kind = '') {
    const t = $(`<div class="toast ${kind}">${esc(msg)}</div>`);
    this.toasts.append(t);
    while (this.toasts.children.length > 6) this.toasts.firstElementChild!.remove();
    setTimeout(() => t.remove(), 4300);
  }
  banner(a: string, b: string, c = '') { this.bannerQ.push([a, b, c]); }
  private showBanner() {
    const [a, b, c] = this.bannerQ.shift()!;
    document.getElementById('banner')?.remove();
    this.root.append($(`<div id="banner"><div class="b1">${esc(a)}</div><div class="b2">${esc(b)}</div><div class="b3">${esc(c)}</div></div>`));
    this.bannerT = 2.6;
    setTimeout(() => { if (!this.bannerQ.length && this.bannerT <= 0) document.getElementById('banner')?.remove(); }, 4100);
  }
  caption(t: string) { this.captionEl.style.opacity = t ? '1' : '0'; if (t) this.captionEl.textContent = t; }
  titleCard(a: string, b: string, c: string) { this.cardEl.innerHTML = a ? `<h1>${a}</h1><h2>${b}</h2><div>${c}</div>` : ''; this.cardEl.style.opacity = a ? '1' : '0'; }
  fade(v: number, cb?: () => void) { this.fadeEl.style.opacity = String(v); if (cb) setTimeout(cb, 650); }
  bubble(n: Npc, text: string) { this.bubbleAt(() => n.pos.clone().setY(2.25), text); }
  bubbleAt(pos: THREE.Vector3 | (() => THREE.Vector3), text: string) {
    const el = $(`<div class="bubble">${esc(text)}</div>`);
    this.layer.append(el);
    const p = typeof pos === 'function' ? pos : () => pos;
    this.bubbles.push({ el, pos: p, t: 3.4 });
  }
  checkDiscover() { C.discover(this.G); }

  // ───────────── HUD ─────────────
  refreshHotbar() {
    const S = this.G.S, T = S.tools;
    const slots: [ToolId, string, boolean][] = [['hands', 'hands', true], ['hammer', T.nailgun ? 'nailgun' : 'hammer', true], ['paint', T.sprayer ? 'sprayer' : 'roller', !!T.paint], ['sledge', 'sledge', !!T.sledge], ['saw', T.circsaw ? 'circsaw' : 'handsaw', !!T.saw], ['washer', 'washer', !!T.washer]];
    this.hotbar.innerHTML = slots.map(([id, icn, own], i) => `<div class="slot ${S.tool === id ? 'on' : ''} ${own ? '' : 'locked'}" data-tool="${id}"><span class="key">${i + 1}</span>${ic(icn, 48)}</div>`).join('') + `<div id="swatch" style="background:${PAINTS[S.paintColor].c}" title="${PAINTS[S.paintColor].name}"><span class="key">C</span></div>`;
    this.hotbar.classList.toggle('hidden', !!this.G.player.driving);
  }
  refreshQuest() { this.slow = 0; }
  private questTarget(): { pos: THREE.Vector3; note: string } | null {
    const G = this.G, id = G.S.flags.track;
    if (!id || !C.qActive(G, id)) return null;
    const q = C.quest(id), step = G.S.quests[id].step, st = q.steps[step];
    const nid = stepNpc(G, id, step);
    if (nid) { const n = G.npcs.find((x) => x.def.id === nid)!; if (n.visible) return { pos: n.pos.clone().setY(2.6), note: '' }; const h = G.places[n.def.home]; return { pos: new THREE.Vector3(h.x, 2.6, h.z), note: `${C.npcName(nid)} is home for the night — rest at your shop until morning.` }; }
    if (st.tasks) { const t = st.tasks.map((x) => G.task(x)).find((x) => x && !x.done); if (t) return { pos: t.pos.clone().setY(2.4), note: '' }; }
    if (st.at && G.places[st.at]) return { pos: new THREE.Vector3(G.places[st.at].x, 2.4, G.places[st.at].z), note: '' };
    return null;
  }
  private updateHud(dt: number) {
    const G = this.G, S = G.S;
    this.slow -= dt;
    if (this.slow <= 0) {
      this.slow = 0.25;
      const w = G.sky.forceWeather ?? G.sky.weather;
      this.stats.innerHTML = `<div class="tier">${esc(G.tier().name)}</div><div class="row">${ic('coin', 24)}<b>$${Math.floor(S.money)}</b><span style="flex:1"></span>${ic('star', 24)}${Math.floor(S.rep)}</div><div class="row clock">Day ${G.sky.day} · ${G.sky.hourLabel()} · ${w === 'clear' ? (G.sky.isDay ? 'Clear' : 'Starry') : w === 'cloudy' ? 'Overcast' : w === 'rain' ? 'Rain' : 'Fog'}</div>`;
      this.mats.innerHTML = `<span>${ic('lumber', 24)}${S.inv.lumber}</span><span>${ic('nails', 24)}${S.inv.nails}</span><span>${ic('paint', 24)}${S.inv.paint.toFixed(1)}</span>${S.inv.concrete ? `<span>${ic('concrete', 24)}${S.inv.concrete}</span>` : ''}${S.inv.bulbs ? `<span>${ic('bulb', 24)}${S.inv.bulbs}</span>` : ''}`;
      // tracker
      const id = S.flags.track;
      let html = '';
      const tg = this.questTarget();
      if (id && C.qActive(G, id)) { const q = C.quest(id), st = q.steps[S.quests[id].step]; html += `<div class="qt">${q.main ? '◆' : '◇'} ${esc(q.title)}</div>${esc(typeof st.text === 'string' ? st.text : st.text(G))}`; if (tg?.note) html += `<div class="sub">${esc(tg.note)}</div>`; }
      else html += `<div class="qt">FREE PLAY</div>${S.flags.contracts_open ? 'Check the Company Board at your shop for work.' : 'Explore the town.'}`;
      const c = S.contracts.active;
      if (c) html += `<div class="sub">Contract: ${esc(c.title)} — $${c.pay}<br>${c.tasks.map((t) => (G.task(t).done ? '✔ ' : '· ') + esc(G.task(t).label)).join('<br>')}</div>`;
      this.questEl.innerHTML = html;
      (this as any)._tg = tg;
      this.stam.style.opacity = G.player.stamina < 0.98 ? '1' : '0';
      (this.stam.firstElementChild as HTMLElement).style.width = G.player.stamina * 100 + '%';
    }
    // prompt
    if (G.near && !this.blocking) { this.promptEl.classList.remove('hidden'); this.promptEl.innerHTML = `<b>E</b>${esc(G.near.label)}`; } else this.promptEl.classList.add('hidden');
    // task progress
    let tk = G.work.hover?.task ?? null;
    if (!tk) { let bd = 9; for (const t of G.tasks.values()) if (t.active && !t.done) { const d = Math.hypot(t.pos.x - G.player.pos.x, t.pos.z - G.player.pos.z); if (d < bd) { bd = d; tk = t; } } }
    if (tk && !this.blocking && !G.cine) {
      this.taskbar.classList.remove('hidden');
      const st = (tk as any).stageLabel ? ` — ${(tk as any).stageLabel()}` : '';
      this.taskbar.innerHTML = `${esc(tk.label)}${esc(st)}<div class="bar"><i style="width:${Math.round(tk.progress() * 100)}%"></i></div>`;
    } else this.taskbar.classList.add('hidden');
    // markers
    const tg = (this as any)._tg as { pos: THREE.Vector3 } | null;
    const place = (el: HTMLElement, pos: THREE.Vector3, label: boolean) => {
      const sp = G.gfx.screenPos(pos), W = window.innerWidth, H = window.innerHeight, m = 60;
      let x = sp.x, y = sp.y;
      const off = !sp.vis || x < m || x > W - m || y < m + 40 || y > H - 130;
      if (off) { const cx = W / 2, cy = H / 2; let dx = x - cx, dy = y - cy; const v = pos.clone().project(G.gfx.camera); if (v.z > 1) { dx = -dx; dy = -dy; } const k = Math.min((W / 2 - m) / Math.abs(dx || 1), (H / 2 - m - 60) / Math.abs(dy || 1)); x = cx + dx * k; y = cy + dy * k; }
      el.style.left = x + 'px'; el.style.top = y + 'px';
      if (label) (el.lastElementChild as HTMLElement).textContent = off ? Math.round(Math.hypot(pos.x - G.player.pos.x, pos.z - G.player.pos.z)) + 'm' : '';
    };
    if (tg && !this.blocking) { this.marker.classList.remove('hidden'); place(this.marker, tg.pos, true); } else this.marker.classList.add('hidden');
    let mi = 0;
    if (!this.blocking) for (const t of G.tasks.values()) {
      if (!t.active || t.done || (tg && t.pos.distanceTo(tg.pos) < 3.5) || Math.hypot(t.pos.x - G.player.pos.x, t.pos.z - G.player.pos.z) > 70) continue;
      const el = this.minors[mi] ?? (this.minors[mi] = (() => { const e = $(`<div class="marker minor"><i></i></div>`); this.layer.append(e); return e; })());
      el.classList.remove('hidden'); place(el, t.pos.clone().setY(2.2), false); mi++;
    }
    for (; mi < this.minors.length; mi++) this.minors[mi].classList.add('hidden');
    // bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]; b.t -= dt;
      const sp = G.gfx.screenPos(b.pos());
      b.el.style.left = sp.x + 'px'; b.el.style.top = sp.y - 8 + 'px'; b.el.style.display = sp.vis && !this.blocking ? '' : 'none';
      if (b.t <= 0) { b.el.remove(); this.bubbles.splice(i, 1); }
    }
  }

  update(dt: number) {
    this.bannerT -= dt;
    if (this.bannerQ.length && this.bannerT <= 0 && !this.dlg) this.showBanner();
    if (this.G.running) this.updateHud(dt);
    if (this.dlg) this.tickDialogue(dt);
    this.win?.tick?.(dt);
  }

  private key(e: KeyboardEvent) {
    const G = this.G, k = e.code;
    if (e.target instanceof HTMLInputElement) { if (k === 'Enter') (e.target as any)._ok?.(); if (k === 'Escape') this.closeWin(); return; }
    if (this.titleUp || !G.running || G.cine) return;
    if (this.dlg) {
      if (['Space', 'Enter', 'KeyE'].includes(k)) this.advance();
      if (this.dlg?.choosing && /^Digit[1-9]$/.test(k)) (this.dlg.el.querySelectorAll('.choices button')[+k.slice(5) - 1] as HTMLElement)?.click();
      return;
    }
    if (this.palette) { if (/^Digit\d$/.test(k)) { const i = (+k.slice(5) + 9) % 10; this.pickColor(i); } if (k === 'Escape' || k === 'KeyC') this.closePalette(); e.stopImmediatePropagation(); G.input.pressed.clear(); return; }
    if (this.win) { if (k === 'Escape' || (this.win.name === 'menu' && (k === 'Tab' || k === 'KeyM' || k === 'KeyJ'))) { this.closeWin(); e.preventDefault(); } return; }
    if (k === 'Escape' || k === 'Tab') { this.openMenu(k === 'Escape' ? 'system' : this.tab); e.preventDefault(); }
    if (k === 'KeyM') this.openMenu('map');
    if (k === 'KeyJ') this.openMenu('journal');
    if (k === 'KeyK') this.openMenu('skills');
    if (k === 'KeyI') this.openMenu('items');
    if (k === 'KeyB' && G.S.flags.contracts_open) this.openMenu('company');
  }

  // ───────────── dialogue ─────────────
  dialogue(script: Script, onEnd?: () => void) {
    this.dlg?.el.remove();
    const el = $(`<div id="dlg" class="panel"><img class="port px"><div style="flex:1"><div class="who"></div><div class="txt"></div><div class="choices"></div></div><div class="more">▼</div></div>`);
    this.root.append(el);
    el.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.advance(); });
    this.dlg = { script, i: -1, shown: 0, text: '', onEnd: onEnd ?? this.dlg?.onEnd, el, choosing: false };
    this.nextLine();
  }
  private nextLine() {
    const d = this.dlg!;
    d.i++;
    if (d.i >= d.script.lines.length) return this.endScript();
    const raw = d.script.lines[d.i].replace('{name}', this.G.S.name);
    const m = raw.match(/^(\w+): ([\s\S]*)$/);
    const who = m ? m[1] : '', text = m ? m[2] : raw;
    const port = d.el.querySelector('.port') as HTMLImageElement, whoEl = d.el.querySelector('.who')!, txt = d.el.querySelector('.txt')!;
    if (who === 'you') { port.src = portrait(PLAYER_SPEC); port.style.visibility = 'visible'; whoEl.innerHTML = esc(this.G.S.name); }
    else if (who) { const def = C.npcDef(who); port.src = portrait(def.spec); port.style.visibility = 'visible'; whoEl.innerHTML = `${esc(def.name)}<small>${esc(def.role)}</small>`; }
    else { port.style.visibility = 'hidden'; whoEl.innerHTML = '&nbsp;'; }
    txt.classList.toggle('narr', !who);
    d.text = text; d.shown = 0; txt.textContent = '';
    (d.el.querySelector('.more') as HTMLElement).style.display = 'none';
  }
  private tickDialogue(dt: number) {
    const d = this.dlg!;
    if (d.choosing || d.shown >= d.text.length) return;
    const before = Math.floor(d.shown);
    d.shown = Math.min(d.text.length, d.shown + dt * 55);
    if (Math.floor(d.shown) !== before) { d.el.querySelector('.txt')!.textContent = d.text.slice(0, Math.floor(d.shown)); if (Math.floor(d.shown) % 3 === 0) this.G.snd.sfx('talk'); }
    if (d.shown >= d.text.length) (d.el.querySelector('.more') as HTMLElement).style.display = '';
  }
  private advance() {
    const d = this.dlg;
    if (!d || d.choosing) return;
    if (d.shown < d.text.length) { d.shown = d.text.length; d.el.querySelector('.txt')!.textContent = d.text; (d.el.querySelector('.more') as HTMLElement).style.display = ''; return; }
    this.nextLine();
  }
  private endScript() {
    const d = this.dlg!, G = this.G, sc = d.script;
    if (sc.choices?.length) {
      d.choosing = true;
      (d.el.querySelector('.more') as HTMLElement).style.display = 'none';
      const box = d.el.querySelector('.choices')!;
      sc.choices.forEach((c: Choice, i) => {
        const okReq = !c.req || G.skillLv(c.req[0]) >= c.req[1], okCost = !c.cost || G.S.money >= c.cost;
        const tag = (c.req ? `<span class="req">[${C.SKILL_INFO[c.req[0]].name} ${c.req[1]}]</span>` : '') + (c.cost ? `<span class="req">[$${c.cost}]</span>` : '');
        const b = $(`<button ${okReq && okCost ? '' : 'disabled'}>${i + 1}. ${tag}${esc(c.t)}</button>`);
        b.onclick = () => { if (c.cost && !G.spend(c.cost)) return; G.snd.sfx('select'); this.follow(c.go(G)); };
        box.append(b);
      });
      return;
    }
    this.follow(sc.then?.(G));
  }
  private follow(next: Script | void) {
    if (next && next.lines) { const onEnd = this.dlg?.onEnd; this.dialogue(next, onEnd); if (!next.lines.length) this.endScript(); return; }
    const d = this.dlg!;
    d.el.remove(); this.dlg = null;
    d.onEnd?.();
    this.G.input.pressed.clear();
    this.refreshQuest();
  }

  // ───────────── windows ─────────────
  private openWin(name: string, title: string, body: string, wide = true): HTMLElement {
    this.closeWin(); this.closePalette();
    const el = $(`<div class="win panel" style="${wide ? '' : 'width:min(640px,92vw)'}"><button class="close">X</button><h2>${title}</h2><div class="body">${body}</div></div>`);
    (el.querySelector('.close') as HTMLElement).onclick = () => this.closeWin();
    this.root.append(el);
    this.win = { name, el };
    this.G.snd.sfx('page');
    return el;
  }
  closeWin() { if (!this.win) return; const w = this.win; this.win = null; w.el.remove(); w.onClose?.(); this.G.snd.sfx('back'); this.G.input.pressed.clear(); }
  note(title: string, text: string) { this.openWin('note', esc(title), `<div class="note">${esc(text)}</div>`, false); }
  report(title: string, lines: string[]) { this.openWin('note', esc(title), `<div class="note">${lines.map(esc).join('\n')}</div><div style="text-align:center"><button data-x>Back to work</button></div>`, false).querySelector('[data-x]')!.addEventListener('click', () => this.closeWin()); }
  prompt(title: string, text: string, cb: (v: string) => void) {
    const el = this.openWin('prompt', esc(title), `<p class="hint">${esc(text)}</p><div style="text-align:center;margin:14px"><input type="text" maxlength="4" inputmode="numeric"><button>Try</button></div>`, false);
    const inp = el.querySelector('input') as any;
    const ok = () => { const v = inp.value; this.closeWin(); cb(v); };
    inp._ok = ok; (el.querySelector('.body button') as HTMLElement).onclick = ok;
    setTimeout(() => inp.focus(), 30);
  }

  paintPicker() {
    if (this.palette) return this.closePalette();
    const el = $(`<div id="palette" class="panel">${PAINTS.map((p, i) => `<div data-i="${i}" style="background:${p.c}"><small>${(i + 1) % 10} ${p.name}</small></div>`).join('')}</div>`);
    el.onclick = (e) => { const t = (e.target as HTMLElement).closest('[data-i]') as HTMLElement; if (t) this.pickColor(+t.dataset.i!); };
    this.hud.append(el); this.palette = el;
  }
  private pickColor(i: number) { this.G.S.paintColor = i; this.G.player.refreshLook(); this.refreshHotbar(); this.G.snd.sfx('select'); this.closePalette(); }
  private closePalette() { this.palette?.remove(); this.palette = null; }

  // ───────────── main menu (journal / skills / items / map / company / system) ─────────────
  openMenu(tab: string) {
    const G = this.G;
    this.tab = tab;
    const tabs: [string, string][] = [['journal', 'Journal'], ['skills', 'Skills'], ['items', 'Gear'], ['map', 'Map'], ['company', 'Company'], ['system', 'System']];
    const el = this.openWin('menu', 'HOLLIS & CO.', `<div class="tabs">${tabs.map(([id, n]) => `<div class="tab ${id === tab ? 'on' : ''}" data-tab="${id}">${n}</div>`).join('')}</div><div id="tabbody"></div>`);
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, tb = t.closest('[data-tab]') as HTMLElement, a = t.closest('[data-act]') as HTMLElement;
      if (tb) return this.openMenu(tb.dataset.tab!);
      if (a) this.act(a.dataset.act!, a.dataset.arg ?? '');
    });
    const body = el.querySelector('#tabbody') as HTMLElement;
    if (tab === 'journal') body.innerHTML = this.journalHtml();
    if (tab === 'skills') body.innerHTML = this.skillsHtml();
    if (tab === 'items') body.innerHTML = this.itemsHtml();
    if (tab === 'company') body.innerHTML = this.companyHtml();
    if (tab === 'system') body.innerHTML = this.systemHtml();
    if (tab === 'map') { body.innerHTML = `<canvas id="mapc" width="${MAP_W * 4}" height="${MAP_H * 4}" style="width:min(100%,${MAP_W * 5.2}px)"></canvas><div class="legend"><span>■ You</span><span style="color:#6fc7b4">■ Truck</span><span style="color:#e2c15a">◆ Objective</span><span>Explore to name places</span></div>`; this.drawMap(body.querySelector('canvas')!); }
    if (tab === 'system') {
      const vol = body.querySelector('#vol') as HTMLInputElement, mus = body.querySelector('#mus') as HTMLInputElement;
      vol.oninput = () => { G.snd.vol.master = +vol.value / 100; G.snd.applyVolumes(); };
      mus.oninput = () => { G.snd.vol.music = +mus.value / 100; G.snd.musicOn = +mus.value > 0; G.snd.applyVolumes(); };
    }
  }
  openCompany(_sub?: string) { if (!this.G.S.flags.contracts_open) { this.toast("An empty corkboard. Walt's last job ticket is still pinned to it.", ''); return; } this.openMenu('company'); }
  private act(a: string, arg: string) {
    const G = this.G, S = G.S;
    if (a === 'track') { S.flags.track = arg; G.snd.sfx('select'); this.refreshQuest(); }
    if (a === 'accept') { const o = S.contracts.offers.find((x) => x.id === arg); if (o) C.acceptOffer(G, o); }
    if (a === 'haggle') { const o = S.contracts.offers.find((x) => x.id === arg); if (o) this.toast(C.haggle(G, o), ''); }
    if (a === 'assign') { const c = S.crew[arg]; c.assign = c.assign === 'jobs' ? 'assist' : 'jobs'; G.snd.sfx('select'); }
    if (a === 'fire') { delete S.crew[arg]; this.toast(`${C.npcName(arg)} is off the payroll.`, ''); }
    if (a === 'buyprop') C.buyProp(G, arg);
    if (a === 'save') G.save();
    if (a === 'quality') { G.gfx.quality = G.gfx.quality === 1 ? 0.7 : 1; G.gfx.resize(); }
    if (a === 'quit') { G.save(true); location.reload(); }
    if (a === 'tool') { G.setTool(arg as ToolId); }
    if (this.win?.name === 'menu') this.openMenu(this.tab);
  }
  private journalHtml() {
    const G = this.G;
    const card = (q: C.QuestDef) => {
      const s = C.qStep(G, q.id), done = s === 99;
      const st = done ? 'Complete.' : (() => { const t = q.steps[s].text; return typeof t === 'string' ? t : t(G); })();
      return `<div class="card ${done ? 'done' : ''} ${G.S.flags.track === q.id ? 'track' : ''}">${ic(q.main ? 'star' : 'doc', 48)}<div class="grow"><h3>${esc(q.title)}</h3><p>${esc(q.desc)}</p><p style="color:var(--paper)">${done ? '✔' : '▸'} ${esc(st)}</p></div>${done ? '' : `<button data-act="track" data-arg="${q.id}">${G.S.flags.track === q.id ? 'Tracking' : 'Track'}</button>`}</div>`;
    };
    const started = C.QUESTS.filter((q) => C.qStep(G, q.id) >= 0);
    const act = started.filter((q) => !C.qDone(G, q.id)), done = started.filter((q) => C.qDone(G, q.id));
    return `<p class="hint">Active</p>${act.map(card).join('') || '<p class="hint">Nothing on the books. Talk to people around town.</p>'}${done.length ? '<p class="hint">Finished</p>' + done.map(card).join('') : ''}`;
  }
  private skillsHtml() {
    const G = this.G;
    return `<div class="grid2">${SKILLS.map((s: Skill) => { const info = C.SKILL_INFO[s], lv = G.skillLv(s);
      return `<div class="card" style="align-items:flex-start">${ic(info.icon, 48)}<div class="grow"><h3>${info.name} — Lv ${lv}</h3><p>${info.desc}</p><div class="xp"><i style="width:${Math.round(G.skillProg(s) * 100)}%"></i></div>${info.perks.map((p, i) => `<div class="perk ${lv >= i + 2 ? 'got' : ''}"><b>LV${i + 2}</b>${esc(p)}</div>`).join('')}</div></div>`; }).join('')}</div><p class="hint">Skills grow by doing the work. Townsfolk will also teach a lesson once a day — for a price.</p>`;
  }
  private itemsHtml() {
    const G = this.G, S = G.S, T = S.tools;
    const tools: [string, string, string, boolean][] = [
      ['hammer', 'Framing Hammer', "Walt's. The handle is worn to your grip already.", true], ['nailgun', 'Nail Gun', 'One shot per nail. Hold to rapid-fire.', !!T.nailgun],
      ['roller', T.roller ? '18-inch Roller' : "Walt's Roller", 'Hold the mouse and roll it on.', !!T.paint], ['sprayer', 'Airless Sprayer', 'Huge soft fan of paint.', !!T.sprayer],
      ['sledge', T.heavySledge ? 'Heavy Sledge' : "Walt's Sledge", 'For deliberate un-building.', !!T.sledge], ['handsaw', 'Hand Saw', 'Honest and slow.', !!T.saw], ['circsaw', 'Circular Saw', 'Fast, forgiving cuts.', !!T.circsaw],
      ['washer', 'Pressure Washer', 'Grime goes; paint stays.', !!T.washer], ['truck', "Walt's Pickup" + (T.tuneup ? ' (tuned)' : ''), 'Carries your lumber and paint. Park it near the job.', true], ['skid', 'Skid Steer', 'Pushes rubble aside. Needs Engineering 2.', !!T.skid],
    ];
    return `<p class="hint">Tools</p><div class="grid2">${tools.filter((t) => t[3]).map(([i, n, d]) => `<div class="card">${ic(i, 48)}<div class="grow"><h3>${n}</h3><p>${d}</p></div></div>`).join('')}</div>
      <p class="hint">On the truck</p><div class="card">${ic('lumber', 48)}<div class="grow"><p style="color:var(--paper)">${S.inv.lumber} boards · ${S.inv.nails} nails · ${S.inv.paint.toFixed(1)} gal paint · ${S.inv.concrete} concrete · ${S.inv.bulbs} bulbs</p><p>Materials can be used within shouting distance of the truck or your shop.</p></div></div>
      <p class="hint">Keepsakes</p>${S.items.map((i) => `<div class="card">${ic(C.ITEMS[i].icon, 48)}<div class="grow"><h3>${C.ITEMS[i].name}</h3><p>${esc(C.ITEMS[i].desc)}</p></div></div>`).join('') || '<p class="hint">Nothing yet.</p>'}
      <p class="hint">People</p><div class="grid2">${G.npcs.filter((n) => S.flags['met_' + n.def.id]).map((n) => `<div class="card"><img class="px" src="${portrait(n.def.spec)}" width="48" height="48"><div class="grow"><h3>${esc(n.def.name)}</h3><p>${esc(n.def.role)}</p><div class="hearts">${Array.from({ length: 5 }, (_, i) => `<img class="px" src="${icon('heart')}" style="opacity:${(S.trust[n.def.id] ?? 2) / 2 > i ? 1 : 0.2}">`).join('')}</div></div></div>`).join('')}</div>`;
  }
  private companyHtml() {
    const G = this.G, S = G.S;
    if (!S.flags.contracts_open) return `<p class="hint">Hollis &amp; Co. has no work on the books yet. Finish a few jobs around town and people will start pinning requests to the board outside your shop.</p>`;
    const tier = G.tier(), cap = C.crewCap(G);
    let h = `<div class="card">${ic('star', 48)}<div class="grow"><h3>${esc(tier.name)}</h3><p>Reputation ${Math.floor(S.rep)} · ${S.contracts.done} contracts completed · $${S.stats.earned} earned all-time</p><p style="color:var(--paper)">Next: ${esc(tier.next)}</p></div></div>`;
    h += `<p class="hint">Contracts — new requests arrive every morning</p>`;
    if (S.contracts.active) { const c = S.contracts.active; h += `<div class="card track">${ic('doc', 48)}<div class="grow"><h3>IN PROGRESS: ${esc(c.title)}</h3><p>${esc(c.desc)}</p></div><span class="price">$${c.pay}</span></div>`; }
    h += S.contracts.offers.map((o) => `<div class="card">${ic(C.SKILL_INFO[o.skill].icon, 48)}<div class="grow"><h3>${esc(o.title)} — for ${esc(C.npcName(o.client))}</h3><p>${esc(o.desc)}</p><p style="color:var(--paper)">Needs: ${esc(o.needs)}</p></div><span class="price">$${o.pay}</span><div><button data-act="accept" data-arg="${o.id}" ${S.contracts.active ? 'disabled' : ''}>Sign</button><br><button data-act="haggle" data-arg="${o.id}" ${o.haggled !== undefined || G.skillLv('negotiation') < 2 ? 'disabled' : ''}>Haggle</button></div></div>`).join('') || '<p class="hint">Nothing new today.</p>';
    h += `<p class="hint">Crew — ${C.crewCount(G)}/${cap} ${cap === 0 ? '(Business Lv 2 to hire)' : ''}</p>`;
    h += C.CREW.map((c) => { const cs = S.crew[c.id], def = C.npcDef(c.id);
      return `<div class="card ${cs?.hired ? '' : 'done'}"><img class="px" src="${portrait(def.spec)}" width="48" height="48"><div class="grow"><h3>${esc(def.name)} — $${c.wage}/day</h3><p>${esc(c.blurb)}</p><p style="color:var(--paper)">${cs?.hired ? (cs.assign === 'jobs' ? `Running small jobs around town (about +$${c.earn}/day)` : 'Working alongside you on your open job site') : C.qDone(G, c.need) ? `Ready to hire — talk to ${C.npcName(c.id)}.` : `Earn ${C.npcName(c.id)}'s respect first.`}</p></div>${cs?.hired ? `<div><button data-act="assign" data-arg="${c.id}">${cs.assign === 'jobs' ? 'Bring on site' : 'Send on jobs'}</button><br><button data-act="fire" data-arg="${c.id}">Let go</button></div>` : ''}</div>`; }).join('');
    h += `<p class="hint">Property ${G.skillLv('business') < 3 ? '(Business Lv 3 to buy)' : ''}</p>`;
    h += C.PROPS.map((p) => { const ps = S.props[p.id];
      return `<div class="card">${ic('key', 48)}<div class="grow"><h3>${esc(p.name)}</h3><p>${ps?.restored ? `Renovated — earning $${p.rent}/day.` : ps?.owned ? 'Yours. Strip the rot, replace the trim, wash and paint to finish.' : `Abandoned since the Crown collapse. Rents for $${p.rent}/day once renovated.`}</p></div>${ps?.owned ? '' : `<span class="price">$${p.price}</span><button data-act="buyprop" data-arg="${p.id}" ${G.skillLv('business') < 3 ? 'disabled' : ''}>Buy</button>`}</div>`; }).join('');
    if (S.flags.restored_hotel) h += `<div class="card">${ic('star', 48)}<div class="grow"><h3>The Marlowe Hotel</h3><p>Restored and open — earning $320/day.</p></div></div>`;
    return h;
  }
  private systemHtml() {
    const G = this.G, m = Math.floor(G.S.playtime / 60);
    return `<div class="card"><div class="grow"><h3>${esc(G.S.name)} — Day ${G.sky.day}</h3><p>Time played: ${Math.floor(m / 60)}h ${m % 60}m. The game also saves automatically.</p></div><button data-act="save">Save now</button></div>
      <div class="card"><div class="grow"><h3>Sound</h3><p>Volume <input id="vol" type="range" min="0" max="100" value="${Math.round(G.snd.vol.master * 100)}"> &nbsp; Music <input id="mus" type="range" min="0" max="100" value="${Math.round(G.snd.vol.music * 100)}"></p></div></div>
      <div class="card"><div class="grow"><h3>Render quality: ${G.gfx.quality === 1 ? 'High' : 'Performance'}</h3><p>Lower the internal resolution if the game runs slowly.</p></div><button data-act="quality">Toggle</button></div>
      <div class="card"><div class="grow"><h3>Controls</h3><p>${CONTROLS}</p></div></div>
      <div class="card"><div class="grow"><h3>Leave</h3><p>Save and return to the title screen.</p></div><button data-act="quit">Quit to title</button></div>`;
  }
  private drawMap(cv: HTMLCanvasElement) {
    const G = this.G, g = cv.getContext('2d')!, T = TILE, s = 4;
    const col: Record<number, string> = { [T.grass]: '#6aa651', [T.flowers]: '#7fb95a', [T.dirt]: '#9b7a55', [T.road]: '#595b68', [T.roadLineH]: '#595b68', [T.roadLineV]: '#595b68', [T.sidewalk]: '#b9b4a6', [T.sand]: '#dcc793', [T.planks]: '#a98458', [T.cobble]: '#a9a195', [T.gravel]: '#9d968a', [T.forest]: '#3f6b40', [T.marsh]: '#7d8f4f', [T.path]: '#b39a6b', [T.garden]: '#6b4c36', [T.crosswalkH]: '#8a8a94', [T.crosswalkV]: '#8a8a94', [T.rubble]: '#8f887b', [T.tallgrass]: '#538c45', 255: '#3f86a8' };
    for (let z = 0; z < MAP_H; z++) for (let x = 0; x < MAP_W; x++) { const t = G.town.tiles[z * MAP_W + x]; g.fillStyle = G.town.walk[z * MAP_W + x] && t === 255 ? '#a98458' : col[t] ?? '#6aa651'; g.fillRect(x * s, z * s, s, s); }
    const X = (x: number) => (x - OX) * s, Z = (z: number) => (z - OZ) * s;
    for (const id in G.town.houses) { const h = G.town.houses[id].spec; const live = !G.town.restorables[id] || G.town.restorables[id].live.g.visible; g.fillStyle = '#141a2e'; g.fillRect(X(h.x - h.w / 2) - 1, Z(h.z - h.d / 2) - 1, h.w * s + 2, h.d * s + 2); g.fillStyle = live && !h.dead ? '#c98a6a' : '#7a7a80'; g.fillRect(X(h.x - h.w / 2), Z(h.z - h.d / 2), h.w * s, h.d * s); }
    g.font = '8px Silkscreen'; g.textAlign = 'center';
    const all = G.skillLv('exploration') >= 4;
    for (const l of C.LANDMARKS) if (all || G.S.stats.found.includes(l.id)) { g.fillStyle = '#141a2e'; g.fillText(l.name.toUpperCase(), X(l.x) + 1, Z(l.z) - 5); g.fillStyle = '#fff6cf'; g.fillText(l.name.toUpperCase(), X(l.x), Z(l.z) - 6); }
    const dot = (x: number, z: number, c: string, r = 3) => { g.fillStyle = '#141a2e'; g.fillRect(X(x) - r - 1, Z(z) - r - 1, r * 2 + 2, r * 2 + 2); g.fillStyle = c; g.fillRect(X(x) - r, Z(z) - r, r * 2, r * 2); };
    for (const t of G.tasks.values()) if (t.active && !t.done) dot(t.pos.x, t.pos.z, '#6fc7b4', 2);
    dot(G.truck.pos.x, G.truck.pos.z, '#3f8f8c');
    const tg = this.questTarget(); if (tg) dot(tg.pos.x, tg.pos.z, '#e2c15a', 4);
    dot(G.player.pos.x, G.player.pos.z, '#ffffff');
  }

  // ───────────── shops ─────────────
  openShop(kind: 'lumber' | 'tools') {
    const G = this.G;
    const render = () => {
      const items = C.SHOP[kind].map((it, i) => { const own = it.kind === 'tool' && G.S.tools[it.id], lock = it.req && G.skillLv(it.req[0]) < it.req[1];
        return `<div class="card ${own ? 'done' : ''}">${ic(it.icon, 48)}<div class="grow"><h3>${esc(it.name)}</h3><p>${esc(it.desc)}${lock ? ` <span style="color:var(--red)">Requires ${C.SKILL_INFO[it.req![0]].name} Lv ${it.req![1]}.</span>` : ''}</p></div><span class="price">${own ? 'OWNED' : '$' + C.priceOf(G, it)}</span>${own ? '' : `<button data-buy="${i}" ${lock ? 'disabled' : ''}>Buy</button>${it.kind === 'mat' && it.qty === 1 ? `<button data-buy="${i}" data-n="5">×5</button>` : ''}`}</div>`; }).join('');
      const S = G.S;
      return `<p class="hint">${kind === 'lumber' ? '"Leave the money in the box if I\'m not at the window." — Gus' : '"If it cuts, fastens or measures, I have it." — Nell'} &nbsp;·&nbsp; You have <b style="color:var(--gold)">$${Math.floor(S.money)}</b> &nbsp;·&nbsp; ${S.inv.lumber} boards, ${S.inv.nails} nails, ${S.inv.paint.toFixed(1)} gal, ${S.inv.concrete} concrete</p>${items}`;
    };
    const el = this.openWin('shop', kind === 'lumber' ? 'BRANNIGAN LUMBER' : 'TIDEWATER SUPPLY', render());
    el.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-buy]') as HTMLElement; if (!b) return; const it = C.SHOP[kind][+b.dataset.buy!]; for (let n = +(b.dataset.n ?? 1); n > 0; n--) if (!C.buy(G, it)) break; (el.querySelector('.body') as HTMLElement).innerHTML = render(); });
  }

  // ───────────── saw bench ─────────────
  sawGame(task: SawTask) {
    const G = this.G;
    const el = this.openWin('saw', 'CUT TO THE LINE', `<p class="hint">Stop the blade on the pencil line — <span class="kbd">SPACE</span> or click. Each cut uses one board. A bad cut is firewood.</p><canvas id="sawc" width="300" height="84" style="width:100%"></canvas><p class="hint" id="sawmsg" style="text-align:center;min-height:22px"></p>`, false);
    const cv = el.querySelector('canvas')!, g = cv.getContext('2d')!, msg = el.querySelector('#sawmsg')!;
    let mark = 0.35 + Math.random() * 0.5, x = 0, dir = 1, wait = 0, cuts: number[] = [];
    const speed = G.S.tools.circsaw ? 0.5 : 0.62;
    const cut = () => {
      if (wait > 0) return;
      if (G.S.inv.lumber < 1) { this.toast('Out of lumber.', 'warn'); this.closeWin(); return; }
      const r = task.result(Math.abs(x - mark));
      cuts.push(x);
      msg.textContent = r === 'perfect' ? 'Dead on the line. Walt would nod.' : r === 'good' ? 'Clean cut.' : 'Off the line — that one is firewood.';
      (msg as HTMLElement).style.color = r === 'miss' ? 'var(--red)' : 'var(--teal)';
      G.fx.burst(G.player.pos.clone().setY(1), 10, { colors: ['#e8cf9a', '#c9a56a'], speed: 2, up: 2, life: 0.6, size: 0.07 });
      wait = 0.9;
    };
    cv.onclick = cut;
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { cut(); e.preventDefault(); } };
    window.addEventListener('keydown', kd);
    this.win!.onClose = () => window.removeEventListener('keydown', kd);
    this.win!.tick = (dt) => {
      if (wait > 0) { wait -= dt; if (wait <= 0) { if (task.done) { this.closeWin(); return; } mark = 0.3 + Math.random() * 0.55; cuts = []; } }
      else { x += dir * dt * speed; if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; } }
      g.fillStyle = '#18203a'; g.fillRect(0, 0, 300, 84);
      g.fillStyle = '#6b4a32'; g.fillRect(30, 56, 8, 24); g.fillRect(262, 56, 8, 24); g.fillRect(20, 52, 260, 6);
      const bx = 20, bw = 260;
      for (let r = 0; r < 20; r++) { g.fillStyle = r === 0 ? '#f0d8a4' : r === 19 ? '#a8854f' : r % 5 === 2 ? '#d4b47a' : '#e0bf85'; g.fillRect(bx, 32 + r, bw, 1); }
      g.fillStyle = '#4a4f66'; g.fillRect(bx + Math.round(mark * bw), 30, 1, 24); g.fillRect(bx + Math.round(mark * bw) - 2, 28, 5, 2);
      for (const c of cuts) { g.fillStyle = '#141a2e'; g.fillRect(bx + Math.round(c * bw), 32, 2, 20); }
      const sx = bx + Math.round(x * bw);
      g.fillStyle = '#b9bfc8'; g.fillRect(sx - 1, 8, 3, 26); g.fillStyle = '#727a88'; for (let i = 0; i < 26; i += 3) g.fillRect(sx + 2, 8 + i, 1, 2);
      g.fillStyle = '#a37747'; g.fillRect(sx - 4, 2, 9, 8);
      g.fillStyle = '#e2c15a'; g.font = '8px Silkscreen'; g.textAlign = 'left'; g.fillText(`BOARDS ${task.cut}/${task.count}`, 4, 80); g.textAlign = 'right'; g.fillText(`LUMBER ${G.S.inv.lumber}`, 296, 80);
    };
  }

  // ───────────── the drafting board ─────────────
  puzzle(task: PuzzleTask) {
    const G = this.G, truss = task.puzzle === 'truss';
    const hint = G.skillLv('engineering') >= 4;
    const el = this.openWin('puzzle', truss ? 'DRAFTING BOARD — TIMBER TRUSS' : 'DRAFTING BOARD — PILE SCHEDULE',
      `<p class="hint">${truss ? 'Click each panel to set its diagonal brace. <b>Timber braces can only push.</b> Lean every brace so it carries the deck load <b>down toward the nearest support</b>, then run a load test.' : `Left-click a pile to drive it deeper, right-click to pull it back. Every pile must seat <b>1 m into firm clay</b> below the fill — but you only have <b>19 m</b> of timber pile. ${G.has('survey') ? "Thorn's field book has the fill depths." : ''}`}</p><canvas id="pzc" width="320" height="170" style="width:100%"></canvas><p class="hint" id="pzmsg" style="text-align:center;min-height:22px"></p><div style="text-align:center"><button id="pztest">Run ${truss ? 'load' : 'storm'} test</button></div>`, false);
    const cv = el.querySelector('canvas')!, g = cv.getContext('2d')!, msg = el.querySelector('#pzmsg') as HTMLElement;
    const N = truss ? (task.id === 'bridge_truss' ? 4 : 6) : 5;
    const st: number[] = new Array(N).fill(truss ? 0 : 1);
    const fill = [2, 4, 3, 1, 3];
    let test = -1, bad: number[] = [];
    const pw = truss ? 240 / N : 48, x0 = truss ? 40 : 40;
    cv.oncontextmenu = (e) => e.preventDefault();
    cv.onmousedown = (e) => {
      if (test >= 0) return;
      const r = cv.getBoundingClientRect(), mx = ((e.clientX - r.left) / r.width) * 320;
      const i = Math.floor((mx - x0) / pw);
      if (i < 0 || i >= N) return;
      if (truss) st[i] = (st[i] + 1) % 3; else st[i] = Math.max(1, Math.min(6, st[i] + (e.button === 2 ? -1 : 1)));
      bad = []; msg.textContent = ''; G.snd.sfx('ui');
    };
    (el.querySelector('#pztest') as HTMLElement).onclick = () => {
      if (test >= 0) return;
      bad = [];
      if (truss) for (let i = 0; i < N; i++) { const want = i < N / 2 ? 1 : 2; if (st[i] !== want) bad.push(i); }
      else { for (let i = 0; i < N; i++) if (st[i] < fill[i] + 1) bad.push(i); if (st.reduce((a, b) => a + b, 0) > 19) bad.push(-1); }
      test = 0; G.snd.sfx('select');
    };
    this.win!.tick = (dt) => {
      if (test >= 0) {
        test += dt;
        if (test > 2) {
          test = -1;
          if (!bad.length) { msg.style.color = 'var(--teal)'; msg.textContent = truss ? 'Every member in compression. She holds.' : 'Every pile seated in clay. The wall will stand.'; G.addXp('engineering', 45); G.snd.sfx('quest'); setTimeout(() => { if (this.win?.name === 'puzzle') this.closeWin(); task.complete(); }, 900); }
          else { msg.style.color = 'var(--red)'; G.snd.sfx('error'); msg.textContent = truss ? (bad.some((i) => st[i] === 0) ? 'An unbraced panel folded like a card table.' : `Panel ${bad[0] + 1} racked — that brace was being pulled, not pushed.`) : bad.includes(-1) ? `You specified ${st.reduce((a, b) => a + b, 0)} m of pile — only 19 m on hand.` : `Pile ${bad[0] + 1} never reached clay. It is standing in mud.`; }
        }
      }
      g.fillStyle = '#e9e0c6'; g.fillRect(0, 0, 320, 170);
      g.fillStyle = '#d6ccb0'; for (let x = 0; x < 320; x += 10) g.fillRect(x, 0, 1, 170); for (let y = 0; y < 170; y += 10) g.fillRect(0, y, 320, 1);
      const ink = '#2e456e', red = '#b5463c';
      const line = (ax: number, ay: number, bx: number, by: number, c: string, w = 2) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); };
      g.font = '8px Silkscreen'; g.textAlign = 'center';
      if (truss) {
        const top = 50, bot = 110, tp = test >= 0 ? Math.min(1, test / 1.6) : -1;
        g.fillStyle = '#3f86a8'; g.fillRect(0, 140, 320, 30); g.fillStyle = '#8a7350'; g.fillRect(0, 112, 42, 58); g.fillRect(278, 112, 42, 58);
        for (let i = 0; i < N; i++) {
          const failing = tp >= 0 && bad.includes(i) && tp > (i + 0.5) / N, sag = failing ? 8 : 0, c = bad.includes(i) && test < 0 && msg.textContent ? red : ink;
          const ax = x0 + i * pw, bx = ax + pw, sk = failing ? 5 : 0;
          line(ax + sk, top + sag, bx + sk, top + sag, c, 3); line(ax, bot + sag, bx, bot + sag, c, 3); line(ax + sk, top + sag, ax, bot + sag, c, 2); if (i === N - 1) line(bx + sk, top + sag, bx, bot + sag, c, 2);
          if (st[i] === 1) line(ax, bot + sag, bx + sk, top + sag, failing ? red : '#a37747', 3);
          if (st[i] === 2) line(ax + sk, top + sag, bx, bot + sag, failing ? red : '#a37747', 3);
          if (!st[i]) { g.fillStyle = '#9a927c'; g.fillText('?', ax + pw / 2, 84); }
          if (hint && !st[i]) { g.fillStyle = '#6fc7b4'; g.fillText(i < N / 2 ? '/' : '\\', ax + pw / 2, 96); }
        }
        g.fillStyle = '#f4ead0'; g.fillText('BANK', 21, 126); g.fillText('BANK', 299, 126);
        if (tp >= 0) { const lx = x0 + tp * 240; g.fillStyle = '#3f8f8c'; g.fillRect(lx - 9, 34, 18, 10); g.fillStyle = '#141a2e'; g.fillRect(lx - 7, 44, 4, 4); g.fillRect(lx + 3, 44, 4, 4); }
      } else {
        const gy = 40, m = 16, tp = test >= 0 ? Math.min(1, test / 1.6) : 0;
        g.fillStyle = '#9fd0e6'; g.fillRect(0, gy - 14 - Math.sin(tp * 12) * 5 * (test >= 0 ? 1 : 0), 320, 14 + 6);
        g.fillStyle = '#7a8a94'; g.fillRect(0, gy + 6 * m, 320, 170);
        for (let i = 0; i < N; i++) { const fx = x0 + i * pw; g.fillStyle = '#a58a62'; g.fillRect(fx, gy, pw, fill[i] * m); g.fillStyle = '#8a7350'; for (let k = 0; k < 6; k++) g.fillRect(fx + ((k * 13) % (pw - 3)), gy + ((k * 7) % Math.max(4, fill[i] * m - 2)), 3, 1); g.fillStyle = '#7a8a94'; g.fillRect(fx, gy + fill[i] * m, pw, (6 - fill[i]) * m); }
        g.fillStyle = ink; g.fillText('FILL', 20, gy + 14); g.fillText('CLAY', 20, gy + 5 * m);
        for (let i = 0; i < N; i++) {
          const cx = x0 + i * pw + pw / 2, failing = test >= 0 && bad.includes(i) && tp > 0.3, lean = failing ? (tp - 0.3) * 14 : 0;
          line(cx + lean, gy - 12, cx, gy + st[i] * m, bad.includes(i) && test < 0 && msg.textContent ? red : '#5d4a3a', 7);
          g.fillStyle = ink; g.fillText(st[i] + ' M', cx, gy - 18); g.fillText('STA.' + (i + 1), cx, 164);
        }
        g.fillStyle = st.reduce((a, b) => a + b, 0) > 19 ? red : ink; g.textAlign = 'left'; g.fillText(`PILE USED ${st.reduce((a, b) => a + b, 0)} / 19 M`, 4, 10);
      }
    };
  }

  // ───────────── title ─────────────
  showTitle() {
    const G = this.G;
    const el = $(`<div id="title"><h1>CONTRACTOR<br><span>LEGENDS</span></h1><h2>RISE OF THE MASTER BUILDER</h2><div id="tbtn"></div><div class="foot">An HD-2D trades RPG · inspired by the craftsmanship of Don Howard Painting &amp; Don Howard Construction</div></div>`);
    this.root.append(el);
    const box = el.querySelector('#tbtn') as HTMLElement;
    const main = () => {
      box.innerHTML = `${G.hasSave() ? '<button class="big" data-a="cont">Continue</button>' : ''}<button class="big" data-a="new">New Game</button><button class="big" data-a="how">How to Play</button>`;
    };
    const go = (isNew: boolean) => { this.fade(1, () => { el.remove(); this.titleUp = false; G.gfx.cine = null; G.begin(isNew); }); };
    box.addEventListener('click', (e) => {
      const a = ((e.target as HTMLElement).closest('[data-a]') as HTMLElement)?.dataset.a;
      if (!a) return;
      G.snd.start(); G.snd.sfx('select');
      if (a === 'cont') { if (G.load()) go(false); }
      if (a === 'new') { box.innerHTML = `<div class="panel" style="text-align:center"><p>${G.hasSave() ? 'Starting over will replace your saved game.<br>' : ''}What's your name, apprentice?</p><input type="text" maxlength="12" value="Riley"><br><button data-a="start">Open the shop</button><button data-a="back">Back</button></div>`; const inp = box.querySelector('input') as any; inp._ok = () => (box.querySelector('[data-a=start]') as HTMLElement).click(); setTimeout(() => inp.select(), 30); }
      if (a === 'start') { const name = (box.querySelector('input') as HTMLInputElement).value.trim() || 'Riley'; G.wipe(); G.S = G.fresh(name); go(true); }
      if (a === 'how') box.innerHTML = `<div class="panel" style="max-width:640px;line-height:1.5">${CONTROLS}<br><br>Rebuild Harbor's End one job at a time: talk to people, take on work, buy materials at Brannigan Lumber and haul them in the truck. Aim with the mouse and hold to work — every wall is painted stroke by stroke, every nail is driven by hand.<div style="text-align:center"><button data-a="back">Back</button></div></div>`;
      if (a === 'back') main();
    });
    main();
  }
}
const K = (k: string) => `<span class="kbd">${k}</span>`;
const CONTROLS = `${K('WASD')}move ${K('SHIFT')}sprint ${K('E')}talk / use / drive<br>${K('1-6')}tools ${K('C')}paint colour ${K('MOUSE')}aim, hold to work ${K('WHEEL')}zoom<br>${K('TAB')}menu ${K('J')}journal ${K('M')}map ${K('K')}skills ${K('B')}company<br>${K('SPACE')}brake ${K('H')}horn ${K('F5')}quick save`;
