import { V29_RELEASE, V29_STATE_VERSION, clampOfflineHours, emptySpecializationLevels, gameMetricSnapshot, isoWeekKey } from './v29-core.js';
const STORAGE_KEY = 'clicksTheGameV29Features';
let cached = null;
function zeroBaseline() {
    return {
        manualClicks: 0,
        coinsEarned: 0,
        purchases: 0,
        minigames: 0,
        criticalClicks: 0
    };
}
function numeric(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}
function isPath(value) {
    return value === 'manual' || value === 'automation' || value === 'critical';
}
function normalizeLevels(value) {
    const source = value && typeof value === 'object'
        ? value
        : {};
    const level = (key) => Math.min(3, Math.floor(numeric(source[key])));
    return {
        powerTap: level('powerTap'),
        comboForge: level('comboForge'),
        servoGrid: level('servoGrid'),
        batteryLoop: level('batteryLoop'),
        critLens: level('critLens'),
        neonEdge: level('neonEdge')
    };
}
function normalizeBaseline(value, fallback) {
    const source = value && typeof value === 'object'
        ? value
        : {};
    return {
        manualClicks: numeric(source.manualClicks, fallback.manualClicks),
        coinsEarned: numeric(source.coinsEarned, fallback.coinsEarned),
        purchases: numeric(source.purchases, fallback.purchases),
        minigames: numeric(source.minigames, fallback.minigames),
        criticalClicks: numeric(source.criticalClicks, fallback.criticalClicks)
    };
}
function initialState(gameState) {
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
function normalizeState(value, gameState) {
    const fresh = initialState(gameState);
    if (!value || typeof value !== 'object')
        return fresh;
    const source = value;
    const weekly = source.weekly;
    const currentWeek = isoWeekKey();
    const weeklyMatches = weekly?.key === currentWeek;
    const fallbackBaseline = gameState ? gameMetricSnapshot(gameState) : zeroBaseline();
    const specialization = source.specialization;
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
                    ? [...new Set(weekly.claimed.filter((id) => typeof id === 'string'))]
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
function persist(state) {
    cached = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function readV29State(gameState) {
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
    let parsed = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        parsed = raw ? JSON.parse(raw) : null;
    }
    catch {
        parsed = null;
    }
    const state = normalizeState(parsed, gameState);
    persist(state);
    return state;
}
export function updateV29State(mutator, gameState) {
    const state = readV29State(gameState);
    mutator(state);
    const normalized = normalizeState(state, gameState);
    persist(normalized);
    return normalized;
}
export function exportV29State(gameState) {
    return JSON.parse(JSON.stringify(readV29State(gameState)));
}
export function importV29State(value, gameState) {
    const state = normalizeState(value, gameState);
    persist(state);
    return state;
}
export function clearV29State() {
    cached = null;
    localStorage.removeItem(STORAGE_KEY);
}
export function prepareOfflineState(state) {
    const settings = readV29State(state).preferences;
    const earliest = Date.now() - settings.offlineCapHours * 60 * 60 * 1000;
    state.lastSavedAt = Math.max(state.lastSavedAt, earliest);
    return state;
}
export function capOfflineSeconds(seconds) {
    const hours = readV29State().preferences.offlineCapHours;
    return Math.min(hours * 60 * 60, Math.max(0, seconds));
}
export function particlesAllowed() {
    if (!readV29State().preferences.particlesEnabled)
        return false;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
        return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function markV29Seen() {
    updateV29State((state) => {
        state.lastSeenVersion = V29_RELEASE;
    });
}
