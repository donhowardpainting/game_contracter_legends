// Keyboard + mouse state with per-frame "pressed" edges.
export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: 0, y: 0, nx: 0, ny: 0, down: false, clicked: false, rdown: false, wheel: 0, overUI: false };
  enabled = true;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.code;
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.down = false; });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
      this.mouse.overUI = e.target !== canvas;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.mouse.rdown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
  key(...codes: string[]) { return this.enabled && codes.some((c) => this.down.has(c)); }
  hit(...codes: string[]) { return this.enabled && codes.some((c) => this.pressed.has(c)); }
  /** raw edge, ignores `enabled` (for UI) */
  rawHit(...codes: string[]) { return codes.some((c) => this.pressed.has(c)); }
  axis() {
    let x = 0, z = 0;
    if (this.key('KeyA', 'ArrowLeft')) x -= 1;
    if (this.key('KeyD', 'ArrowRight')) x += 1;
    if (this.key('KeyW', 'ArrowUp')) z -= 1;
    if (this.key('KeyS', 'ArrowDown')) z += 1;
    return { x, z };
  }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; this.mouse.wheel = 0; }
}
