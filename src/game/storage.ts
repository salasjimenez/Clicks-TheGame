import {
  exportStoredMedia,
  importStoredMedia,
  type PortableBackgroundMedia,
} from "./media-storage.js";
import { createInitialState, normalizeState } from "./state.js";
import type { GameState } from "../types.js";
import { clearV29State, exportV29State, importV29State, type V29FeatureState } from '../features/v29-state.js';

const SAVE_KEY = "clicksTheGameV3";
const LEGACY_KEY = "clickGameSave";

interface PortableSave extends GameState {
  localBackgroundMedia?: PortableBackgroundMedia;
  v29Features?: V29FeatureState;
}

function migrateLegacy(raw: string): GameState | null {
  try {
    const legacy = JSON.parse(raw) as {
      gameState?: Record<string, unknown>;
      itemCounts?: Record<string, unknown>;
      prestigeData?: Record<string, unknown>;
    };
    const state = createInitialState();
    const game = legacy.gameState || {};
    const items = legacy.itemCounts || {};
    const prestige = legacy.prestigeData || {};
    state.coins = Number(game.clickCount) || 0;
    state.lifetimeCoins = state.coins;
    state.totalClicks = Number(game.totalClicks) || 0;
    state.manualClicks = Math.floor(state.totalClicks);
    state.upgrades.autoClicker =
      Number(items.autoClicker ?? game.autoClickers) || 0;
    const multiplier = Math.max(
      1,
      Number(game.clickMultiplier ?? items.multiplier) || 1,
    );
    state.upgrades.clickMultiplier = Math.max(
      0,
      Math.round(Math.log2(multiplier)),
    );
    state.prestigeLevel = Number(prestige.level) || 0;
    state.prestigePoints = Number(prestige.points) || 0;
    state.playSeconds = Number(game.playTime) || 0;
    state.stats.itemsPurchased = Number(game.totalPurchases) || 0;
    return normalizeState(state);
  } catch {
    return null;
  }
}

export function loadState(): GameState {
  const current = localStorage.getItem(SAVE_KEY);
  if (current) {
    try {
      return normalizeState(JSON.parse(current));
    } catch {
      localStorage.removeItem(SAVE_KEY);
    }
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    const migrated = migrateLegacy(legacy);
    if (migrated) {
      saveState(migrated);
      return migrated;
    }
  }
  return createInitialState();
}

export function saveState(state: GameState): void {
  state.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_KEY);
  clearV29State();
}

export async function exportState(state: GameState): Promise<void> {
  const localBackgroundMedia = await exportStoredMedia(state.background);
  const v29Features = exportV29State(state);
  const portable: PortableSave = localBackgroundMedia
    ? { ...state, localBackgroundMedia, v29Features }
    : { ...state, v29Features };
  const blob = new Blob([JSON.stringify(portable, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `clicks-the-game-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importState(file: File): Promise<GameState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (parsed && typeof parsed === "object") {
    const portable = parsed as Partial<PortableSave>;
    await importStoredMedia(portable.localBackgroundMedia);
  }
  const state = normalizeState(parsed);
  if (parsed && typeof parsed === 'object') {
    const portable = parsed as Partial<PortableSave>;
    if (portable.v29Features !== undefined) importV29State(portable.v29Features, state);
  }
  saveState(state);
  return state;
}
