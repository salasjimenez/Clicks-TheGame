import { MISSION_TEMPLATES } from '../data/missions.js';
import { currentSeason } from '../data/seasons.js';
import type {
  BackgroundMode,
  BackgroundPreset,
  UiPalette,
  DailyCounters,
  DailyMission,
  DeepUpgradeId,
  GameState,
  MissionTemplate,
  UpgradeId
} from '../types.js';

const STATE_VERSION = 7;

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

function emptyUpgrades(): Record<UpgradeId, number> {
  return {
    autoClicker: 0,
    clickMultiplier: 0,
    quantumCore: 0,
    luckyChip: 0,
    comboDrive: 0,
    overclock: 0,
    coinMagnet: 0,
    offlineBattery: 0
  };
}

function emptyDeepUpgrades(): Record<DeepUpgradeId, number> {
  return {
    coreEcho: 0,
    timeDilation: 0,
    arcadeProtocol: 0,
    missionCompiler: 0,
    seasonAntenna: 0,
    criticalMatrix: 0
  };
}

export function createInitialState(): GameState {
  const now = Date.now();
  const season = currentSeason();
  return {
    version: STATE_VERSION,
    coins: 0,
    lifetimeCoins: 0,
    totalClicks: 0,
    manualClicks: 0,
    combo: 0,
    comboExpiresAt: 0,
    prestigeLevel: 0,
    prestigePoints: 0,
    deepPrestige: {
      level: 0,
      shards: 0,
      totalShardsEarned: 0,
      upgrades: emptyDeepUpgrades()
    },
    upgrades: emptyUpgrades(),
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
      passiveCoins: 0,
      deepPrestiges: 0,
      neonRushPlayed: 0,
      neonRushWins: 0,
      highestNeonRushScore: 0,
      seasonPoints: 0,
      guessWinStreak: 0,
      highestGuessWinStreak: 0
    },
    daily: createDailyState(),
    season: {
      id: season.id,
      enabled: true,
      points: 0,
      lastDailyBonusDate: ''
    },
    activeEvent: null,
    nextEventAt: now + 120000,
    turboUntil: 0,
    playSeconds: 0,
    startedAt: now,
    lastSavedAt: now,
    background: {
      palette: 'arcade',
      mode: 'default',
      preset: 'neonGrid',
      videoPaused: false,
      imageUnlockNotified: false,
      videoUnlockNotified: false
    },
    theme: 'dark',
    soundEnabled: true
  };
}


function uiPalette(value: unknown): UiPalette {
  if (value === 'matrix' || value === 'violet' || value === 'sunset' || value === 'ice' || value === 'amber') return value;
  return 'arcade';
}

function backgroundMode(value: unknown): BackgroundMode {
  return value === 'preset' || value === 'customImage' || value === 'customVideo' ? value : 'default';
}

function backgroundPreset(value: unknown): BackgroundPreset {
  return value === 'synthSunset' || value === 'cyberCircuit' ? value : 'neonGrid';
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

function deepUpgradeRecord(value: unknown): Record<DeepUpgradeId, number> {
  const source = typeof value === 'object' && value ? value as Partial<Record<DeepUpgradeId, unknown>> : {};
  return {
    coreEcho: integer(source.coreEcho),
    timeDilation: integer(source.timeDilation),
    arcadeProtocol: integer(source.arcadeProtocol),
    missionCompiler: integer(source.missionCompiler),
    seasonAntenna: integer(source.seasonAntenna),
    criticalMatrix: integer(source.criticalMatrix)
  };
}

export function normalizeState(value: unknown): GameState {
  const fresh = createInitialState();
  if (!value || typeof value !== 'object') return fresh;
  const source = value as Partial<GameState>;
  const previousVersion = integer(source.version);
  const seasonDefinition = currentSeason();
  const sourceSeason = source.season;
  const sourceBackground = source.background;
  const sameSeason = sourceSeason?.id === seasonDefinition.id;

  const state: GameState = {
    ...fresh,
    version: STATE_VERSION,
    coins: numeric(source.coins),
    lifetimeCoins: numeric(source.lifetimeCoins),
    totalClicks: previousVersion > 0 && previousVersion < 4 ? integer(source.manualClicks) : integer(source.totalClicks),
    manualClicks: integer(source.manualClicks),
    combo: integer(source.combo),
    comboExpiresAt: numeric(source.comboExpiresAt),
    prestigeLevel: integer(source.prestigeLevel),
    prestigePoints: integer(source.prestigePoints),
    deepPrestige: {
      level: integer(source.deepPrestige?.level),
      shards: integer(source.deepPrestige?.shards),
      totalShardsEarned: integer(source.deepPrestige?.totalShardsEarned),
      upgrades: deepUpgradeRecord(source.deepPrestige?.upgrades)
    },
    upgrades: upgradeRecord(source.upgrades),
    unlockedAchievements: Array.isArray(source.unlockedAchievements)
      ? [...new Set(source.unlockedAchievements.filter((id): id is string => typeof id === 'string'))]
      : [],
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
      passiveCoins: numeric(source.stats?.passiveCoins),
      deepPrestiges: integer(source.stats?.deepPrestiges),
      neonRushPlayed: integer(source.stats?.neonRushPlayed),
      neonRushWins: integer(source.stats?.neonRushWins),
      highestNeonRushScore: integer(source.stats?.highestNeonRushScore),
      seasonPoints: integer(source.stats?.seasonPoints),
      guessWinStreak: integer(source.stats?.guessWinStreak),
      highestGuessWinStreak: integer(source.stats?.highestGuessWinStreak)
    },
    activeEvent: source.activeEvent && typeof source.activeEvent === 'object' ? source.activeEvent : null,
    nextEventAt: numeric(source.nextEventAt, Date.now() + 120000),
    turboUntil: numeric(source.turboUntil),
    playSeconds: numeric(source.playSeconds),
    startedAt: numeric(source.startedAt, Date.now()),
    lastSavedAt: numeric(source.lastSavedAt, Date.now()),
    background: {
      palette: uiPalette(sourceBackground?.palette),
      mode: backgroundMode(sourceBackground?.mode),
      preset: backgroundPreset(sourceBackground?.preset),
      videoPaused: Boolean(sourceBackground?.videoPaused),
      imageUnlockNotified: Boolean(sourceBackground?.imageUnlockNotified),
      videoUnlockNotified: Boolean(sourceBackground?.videoUnlockNotified)
    },
    theme: 'dark',
    soundEnabled: source.soundEnabled !== false,
    season: {
      id: seasonDefinition.id,
      enabled: sourceSeason?.enabled !== false,
      points: sameSeason ? integer(sourceSeason?.points) : 0,
      lastDailyBonusDate: sameSeason && typeof sourceSeason?.lastDailyBonusDate === 'string' ? sourceSeason.lastDailyBonusDate : ''
    }
  };

  const daily = source.daily;
  if (daily && daily.date === todayKey() && Array.isArray(daily.missions)) {
    state.daily = {
      date: daily.date,
      missions: daily.missions.map((mission) => ({
        ...mission,
        progress: numeric(mission.progress),
        claimed: Boolean(mission.claimed)
      })),
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
