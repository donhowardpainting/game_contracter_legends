import '@fontsource/silkscreen/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './ui/style.css';
import { Physics } from './engine/physics';
import { Game } from './game/game';
import * as C from './game/content';

async function boot() {
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.textContent = "RAISING HARBOR'S END…";
  document.body.append(loading);
  await Physics.init();
  try { await Promise.all([document.fonts.load('8px Silkscreen'), document.fonts.load('16px "Pixelify Sans"')]); } catch { /* fall back to system fonts */ }
  await new Promise((r) => setTimeout(r, 30));
  const G = new Game(document.getElementById('game') as HTMLCanvasElement);
  C.setupWorld(G);
  (window as any).G = G;
  G.fx.setScale(window.innerHeight);
  window.addEventListener('resize', () => G.fx.setScale(window.innerHeight));
  G.sky.time = 17.6;
  G.ui.showTitle();
  G.start();
  loading.remove();
}
boot();
