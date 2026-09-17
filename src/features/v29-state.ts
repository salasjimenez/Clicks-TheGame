import type { GameState } from '../types.js';
import {
  V29_RELEASE,
  V29_STATE_VERSION,
  clampOfflineHours,
  emptySpecializationLevels,
  gameMetricSnapshot,
  isoWeekKey,
  type SpecializationPath,
  type SpecializationUpgradeId,
  type V29FeatureState,
  type V29SpecializationState,
  type WeeklyBaseline
} from './v29-core.js';

export type { V29FeatureState } from './v29-core.js';

const STORAGE_KEY = 'clicksTheGameV29Features';
let cached: V29FeatureState | null = null;

function zeroBaseline(): WeeklyBaseline {
  return {
    manualClicks: 0,
    coinsEarned: 0,
    purchases: 0,
    minigames: 0,
    criticalClicks: 0
  };
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function isPath(value: unknown): value is SpecializationPath {
  return value === 'manual' || value === 'automation' || value === 'critical';
}

function normalizeLevels(value: unknown): Record<SpecializationUpgradeId, number> {
  const source = value && typeof value === 'object'
    ? value as Partial<Record<SpecializationUpgradeId, unknown>>
    : {};
  const level = (key: SpecializationUpgradeId): number => Math.min(3, Math.floor(numeric(source[key])));
  return {
    powerTap: level('powerTap'),
    comboForge: level('comboForge'),
    servoGrid: level('servoGrid'),
    batteryLoop: level('batteryLoop'),
    critLens: level('critLens'),
    neonEdge: level('neonEdge')
  };
}

function normalizeBaseline(value: unknown, fallback: WeeklyBaseline): WeeklyBaseline {
  const source = value && typeof value === 'object'
    ? value as Partial<Record<keyof WeeklyBaseline, unknown>>
    : {};
  return {
    manualClicks: numeric(source.manualClicks, fallback.manualClicks),
    coinsEarned: numeric(source.coinsEarned, fallback.coinsEarned),
    purchases: numeric(source.purchases, fallback.purchases),
    minigames: numeric(source.minigames, fallback.minigames),
    criticalClicks: numeric(source.criticalClicks, fallback.criticalClicks)
  };
}

function initialState(gameState?: GameState): V29FeatureState {
  return {
    version: V29_STATE_VERSION,
    preferences: {
      offlineCapHours: 8,
      particlesEnabled: true
    },
    weekly: {
      key: isoWeekKey(),
      baseline: gameState ? gameMetricSnapshot(gameState) : zeroBaseline(),
      claimed: []
    },
    specialization: {
      path: null,
      levels: emptySpecializationLevels()
    },
    lastSeenVersion: ''
  };
}

function normalizeState(value: unknown, gameState?: GameState): V29FeatureState {
  const fresh = initialState(gameState);
  if (!value || typeof value !== 'object') return fresh;
  const source = value as Partial<V29FeatureState>;
  const weekly = source.weekly;
  const currentWeek = isoWeekKey();
  const weeklyMatches = weekly?.key === currentWeek;
  const fallbackBaseline = gameState ? gameMetricSnapshot(gameState) : zeroBaseline();
  const specialization = source.specialization as Partial<V29SpecializationState> | undefined;
  return {
    version: V29_STATE_VERSION,
    preferences: {
      offlineCapHours: clampOfflineHours(source.preferences?.offlineCapHours),
      particlesEnabled: source.preferences?.particlesEnabled !== false
    },
    weekly: weeklyMatches
      ? {
          key: currentWeek,
          baseline: normalizeBaseline(weekly?.baseline, fallbackBaseline),
          claimed: Array.isArray(weekly?.claimed)
            ? [...new Set(weekly.claimed.filter((id): id is string => typeof id === 'string'))]
            : []
        }
      : {
          key: currentWeek,
          baseline: fallbackBaseline,
          claimed: []
        },
    specialization: {
      path: isPath(specialization?.path) ? specialization.path : null,
      levels: normalizeLevels(specialization?.levels)
    },
    lastSeenVersion: typeof source.lastSeenVersion === 'string' ? source.lastSeenVersion : ''
  };
}

function persist(state: V29FeatureState): void {
  cached = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function readV29State(gameState?: GameState): V29FeatureState {
  if (cached) {
    const currentWeek = isoWeekKey();
    if (cached.weekly.key !== currentWeek) {
      cached.weekly = {
        key: currentWeek,
        baseline: gameState ? gameMetricSnapshot(gameState) : zeroBaseline(),
        claimed: []
      };
      persist(cached);
    }
    return cached;
  }
  let parsed: unknown = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const state = normalizeState(parsed, gameState);
  persist(state);
  return state;
}

export function updateV29State(mutator: (state: V29FeatureState) => void, gameState?: GameState): V29FeatureState {
  const state = readV29State(gameState);
  mutator(state);
  const normalized = normalizeState(state, gameState);
  persist(normalized);
  return normalized;
}

export function exportV29State(gameState?: GameState): V29FeatureState {
  return JSON.parse(JSON.stringify(readV29State(gameState))) as V29FeatureState;
}

export function importV29State(value: unknown, gameState?: GameState): V29FeatureState {
  const state = normalizeState(value, gameState);
  persist(state);
  return state;
}

export function clearV29State(): void {
  cached = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function prepareOfflineState(state: GameState): GameState {
  const settings = readV29State(state).preferences;
  const earliest = Date.now() - settings.offlineCapHours * 60 * 60 * 1000;
  state.lastSavedAt = Math.max(state.lastSavedAt, earliest);
  return state;
}

export function capOfflineSeconds(seconds: number): number {
  const hours = readV29State().preferences.offlineCapHours;
  return Math.min(hours * 60 * 60, Math.max(0, seconds));
}

export function particlesAllowed(): boolean {
  if (!readV29State().preferences.particlesEnabled) return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function markV29Seen(): void {
  updateV29State((state) => {
    state.lastSeenVersion = V29_RELEASE;
  });
}
