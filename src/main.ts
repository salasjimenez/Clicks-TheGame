import { GameEngine } from './game/engine.js';
import { loadState, saveState } from './game/storage.js';
import { GameUI } from './ui/render.js';
import { V29Features, installV29Derived } from './features/v29.js';
import { capOfflineSeconds, prepareOfflineState } from './features/v29-state.js';

const TICK_MS = 250;
const SAVE_MS = 30000;
const engine = new GameEngine(prepareOfflineState(loadState()));
installV29Derived(engine);
new GameUI(engine);
new V29Features(engine);
document.documentElement.dataset.appReady = 'true';

let tickTimer = 0;
let saveTimer = 0;
let hiddenAt = 0;

function stopTickLoop(): void {
  if (tickTimer) window.clearTimeout(tickTimer);
  tickTimer = 0;
}

function startTickLoop(): void {
  stopTickLoop();
  if (document.visibilityState === 'hidden') return;
  const tick = (): void => {
    if (document.visibilityState === 'hidden') {
      tickTimer = 0;
      return;
    }
    engine.tick();
    tickTimer = window.setTimeout(tick, TICK_MS);
  };
  tickTimer = window.setTimeout(tick, TICK_MS);
}

function stopSaveLoop(): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = 0;
}

function startSaveLoop(): void {
  stopSaveLoop();
  if (document.visibilityState === 'hidden') return;
  saveTimer = window.setTimeout(() => {
    saveState(engine.state);
    startSaveLoop();
  }, SAVE_MS);
}

startTickLoop();
startSaveLoop();

window.addEventListener('beforeunload', () => saveState(engine.state));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    stopTickLoop();
    stopSaveLoop();
    saveState(engine.state);
    return;
  }
  if (hiddenAt > 0) {
    engine.resumeFromBackground(capOfflineSeconds((Date.now() - hiddenAt) / 1000));
    hiddenAt = 0;
  }
  startTickLoop();
  startSaveLoop();
});
