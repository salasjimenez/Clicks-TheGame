import { MISSION_TEMPLATES } from '../data/missions.js';
import type { DailyCounters, DailyMission, GameState, MissionTemplate, ThemeMode, UpgradeId } from '../types.js';

const EMPTY_COUNTERS: DailyCounters = {
  manualClicks: 0,
  coinsEarned: 0,
  purchases: 0,
  minigames: 0,
  criticalClicks: 0
};

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function seededRandom(seed: string): () => number {
  let value = Array.from(seed).reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function selectDailyTemplates(date: string): MissionTemplate[] {
  const random = seededRandom(date);
  const candidates = [...MISSION_TEMPLATES];
  const selected: MissionTemplate[] = [];
  while (selected.length < 3 && candidates.length > 0) {
    const index = Math.floor(random() * candidates.length);
    const template = candidates.splice(index, 1)[0];
    if (template) selected.push(template);
  }
  return selected;
}

export function createDailyState(date = todayKey()): GameState['daily'] {
  const missions: DailyMission[] = selectDailyTemplates(date).map((mission) => ({
    ...mission,
    progress: 0,
    claimed: false
  }));
  return {
    date,
    missions,
    counters: { ...EMPTY_COUNTERS },
    streak: 0,
    lastCompletedDate: ''
  };
}

export function createInitialState(): GameState {
  const now = Date.now();
  const preferredTheme: ThemeMode = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return {
    version: 4,
    coins: 0,
    lifetimeCoins: 0,
    totalClicks: 0,
    manualClicks: 0,
    combo: 0,
    comboExpiresAt: 0,
    prestigeLevel: 0,
    prestigePoints: 0,
    upgrades: {
      autoClicker: 0,
      clickMultiplier: 0,
      quantumCore: 0,
      luckyChip: 0,
      comboDrive: 0,
      overclock: 0,
      coinMagnet: 0,
      offlineBattery: 0
    },
    unlockedAchievements: [],
    stats: {
      highestCoins: 0,
      minigamesPlayed: 0,
      minigamesWon: 0,
      missionsCompleted: 0,
      eventsCompleted: 0,
      itemsPurchased: 0,
      criticalClicks: 0,
      totalPrestigePointsEarned: 0,
      highestCombo: 0,
      passiveCoins: 0
    },
    daily: createDailyState(),
    activeEvent: null,
    nextEventAt: now + 45000,
    turboUntil: 0,
    playSeconds: 0,
    startedAt: now,
    lastSavedAt: now,
    theme: preferredTheme,
    soundEnabled: true
  };
}

function numeric(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function integer(value: unknown, fallback = 0): number {
  return Math.floor(numeric(value, fallback));
}

function upgradeRecord(value: unknown): Record<UpgradeId, number> {
  const source = typeof value === 'object' && value ? value as Partial<Record<UpgradeId, unknown>> : {};
  return {
    autoClicker: integer(source.autoClicker),
    clickMultiplier: integer(source.clickMultiplier),
    quantumCore: integer(source.quantumCore),
    luckyChip: integer(source.luckyChip),
    comboDrive: integer(source.comboDrive),
    overclock: integer(source.overclock),
    coinMagnet: integer(source.coinMagnet),
    offlineBattery: integer(source.offlineBattery)
  };
}

export function normalizeState(value: unknown): GameState {
  const fresh = createInitialState();
  if (!value || typeof value !== 'object') return fresh;
  const source = value as Partial<GameState>;
  const previousVersion = integer(source.version);
  const state: GameState = {
    ...fresh,
    version: 4,
    coins: numeric(source.coins),
    lifetimeCoins: numeric(source.lifetimeCoins),
    totalClicks: previousVersion > 0 && previousVersion < 4 ? integer(source.manualClicks) : integer(source.totalClicks),
    manualClicks: integer(source.manualClicks),
    combo: integer(source.combo),
    comboExpiresAt: numeric(source.comboExpiresAt),
    prestigeLevel: integer(source.prestigeLevel),
    prestigePoints: integer(source.prestigePoints),
    upgrades: upgradeRecord(source.upgrades),
    unlockedAchievements: Array.isArray(source.unlockedAchievements) ? source.unlockedAchievements.filter((id): id is string => typeof id === 'string') : [],
    stats: {
      highestCoins: numeric(source.stats?.highestCoins),
      minigamesPlayed: integer(source.stats?.minigamesPlayed),
      minigamesWon: integer(source.stats?.minigamesWon),
      missionsCompleted: integer(source.stats?.missionsCompleted),
      eventsCompleted: integer(source.stats?.eventsCompleted),
      itemsPurchased: integer(source.stats?.itemsPurchased),
      criticalClicks: integer(source.stats?.criticalClicks),
      totalPrestigePointsEarned: integer(source.stats?.totalPrestigePointsEarned),
      highestCombo: integer(source.stats?.highestCombo),
      passiveCoins: numeric(source.stats?.passiveCoins)
    },
    activeEvent: source.activeEvent && typeof source.activeEvent === 'object' ? source.activeEvent : null,
    nextEventAt: numeric(source.nextEventAt, Date.now() + 45000),
    turboUntil: numeric(source.turboUntil),
    playSeconds: integer(source.playSeconds),
    startedAt: numeric(source.startedAt, Date.now()),
    lastSavedAt: numeric(source.lastSavedAt, Date.now()),
    theme: source.theme === 'light' ? 'light' : 'dark',
    soundEnabled: source.soundEnabled !== false
  };
  const daily = source.daily;
  if (daily && daily.date === todayKey() && Array.isArray(daily.missions)) {
    state.daily = {
      date: daily.date,
      missions: daily.missions.map((mission) => ({ ...mission, progress: numeric(mission.progress), claimed: Boolean(mission.claimed) })),
      counters: {
        manualClicks: integer(daily.counters?.manualClicks),
        coinsEarned: numeric(daily.counters?.coinsEarned),
        purchases: integer(daily.counters?.purchases),
        minigames: integer(daily.counters?.minigames),
        criticalClicks: integer(daily.counters?.criticalClicks)
      },
      streak: integer(daily.streak),
      lastCompletedDate: typeof daily.lastCompletedDate === 'string' ? daily.lastCompletedDate : ''
    };
  } else {
    const replacement = createDailyState();
    replacement.streak = integer(daily?.streak);
    replacement.lastCompletedDate = typeof daily?.lastCompletedDate === 'string' ? daily.lastCompletedDate : '';
    state.daily = replacement;
  }
  state.stats.highestCoins = Math.max(state.stats.highestCoins, state.coins);
  if (state.comboExpiresAt < Date.now()) state.combo = 0;
  return state;
}
