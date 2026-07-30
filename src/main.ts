import { GameEngine } from './game/engine.js';
import { loadState, saveState } from './game/storage.js';
import { GameUI } from './ui/render.js';

const engine = new GameEngine(loadState());
new GameUI(engine);
document.documentElement.dataset.appReady = 'true';

window.setInterval(() => engine.tick(), 100);
window.setInterval(() => saveState(engine.state), 5000);

window.addEventListener('beforeunload', () => saveState(engine.state));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveState(engine.state);
});
