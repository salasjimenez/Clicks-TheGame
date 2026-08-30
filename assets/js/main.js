import { GameEngine } from './game/engine.js';
import { loadState, saveState } from './game/storage.js';
import { GameUI } from './ui/render.js';
const TICK_MS = 250;
const SAVE_MS = 30000;
const engine = new GameEngine(loadState());
new GameUI(engine);
document.documentElement.dataset.appReady = 'true';
let tickTimer = 0;
let saveTimer = 0;
let hiddenAt = 0;
function stopTickLoop() {
    if (tickTimer)
        window.clearTimeout(tickTimer);
    tickTimer = 0;
}
function startTickLoop() {
    stopTickLoop();
    if (document.visibilityState === 'hidden')
        return;
    const tick = () => {
        if (document.visibilityState === 'hidden') {
            tickTimer = 0;
            return;
        }
        engine.tick();
        tickTimer = window.setTimeout(tick, TICK_MS);
    };
    tickTimer = window.setTimeout(tick, TICK_MS);
}
function stopSaveLoop() {
    if (saveTimer)
        window.clearTimeout(saveTimer);
    saveTimer = 0;
}
function startSaveLoop() {
    stopSaveLoop();
    if (document.visibilityState === 'hidden')
        return;
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
        engine.resumeFromBackground((Date.now() - hiddenAt) / 1000);
        hiddenAt = 0;
    }
    startTickLoop();
    startSaveLoop();
});
