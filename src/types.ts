export type BackgroundMode = 'default' | 'preset' | 'customImage' | 'customVideo';
export type BackgroundPreset = 'neonGrid' | 'synthSunset' | 'cyberCircuit';
export type UiPalette = 'arcade' | 'matrix' | 'violet' | 'sunset' | 'ice' | 'amber';

export interface BackgroundSettings {
  palette: UiPalette;
  mode: BackgroundMode;
  preset: BackgroundPreset;
  videoPaused: boolean;
  imageUnlockNotified: boolean;
  videoUnlockNotified: boolean;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'godly';
export type AchievementCategory =
  | 'clicks'
  | 'cps'
  | 'autoClickers'
  | 'multiplier'
  | 'prestige'
  | 'deepPrestige'
  | 'minigames'
  | 'missions'
  | 'events'
  | 'seasons'
  | 'time'
  | 'shop'
  | 'secret';
export type UpgradeId =
  | 'autoClicker'
  | 'clickMultiplier'
  | 'quantumCore'
  | 'luckyChip'
  | 'comboDrive'
  | 'overclock'
  | 'coinMagnet'
  | 'offlineBattery';
export type DeepUpgradeId =
  | 'coreEcho'
  | 'timeDilation'
  | 'arcadeProtocol'
  | 'missionCompiler'
  | 'seasonAntenna'
  | 'criticalMatrix';
export type ConsumableId = 'timeBoost' | 'capsule' | 'superCapsule';
export type StoreItemId = UpgradeId | ConsumableId;
export type EventId = 'doubleClick' | 'clickRain' | 'discount' | 'criticalFever';
export type MissionMetric = 'manualClicks' | 'coinsEarned' | 'purchases' | 'minigames' | 'criticalClicks';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  requirement: number;
  reward: number;
  rarity: Rarity;
  category: AchievementCategory;
  secret?: boolean;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  emoji: string;
  basePrice: number;
  growth: number;
  maxLevel?: number;
}

export interface DeepUpgradeDefinition {
  id: DeepUpgradeId;
  name: string;
  description: string;
  emoji: string;
  basePrice: number;
  growth: number;
  maxLevel: number;
}

export interface ConsumableDefinition {
  id: ConsumableId;
  name: string;
  description: string;
  emoji: string;
  price: number;
  currency: 'coins' | 'prestige';
}

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  emoji: string;
  metric: MissionMetric;
  target: number;
  reward: number;
}

export interface DailyMission extends MissionTemplate {
  progress: number;
  claimed: boolean;
}

export interface DailyCounters {
  manualClicks: number;
  coinsEarned: number;
  purchases: number;
  minigames: number;
  criticalClicks: number;
}

export interface DailyState {
  date: string;
  missions: DailyMission[];
  counters: DailyCounters;
  streak: number;
  lastCompletedDate: string;
}

export interface DeepPrestigeState {
  level: number;
  shards: number;
  totalShardsEarned: number;
  upgrades: Record<DeepUpgradeId, number>;
}

export interface SeasonState {
  id: string;
  enabled: boolean;
  points: number;
  lastDailyBonusDate: string;
}

export interface GameStats {
  highestCoins: number;
  minigamesPlayed: number;
  minigamesWon: number;
  missionsCompleted: number;
  eventsCompleted: number;
  itemsPurchased: number;
  criticalClicks: number;
  totalPrestigePointsEarned: number;
  highestCombo: number;
  passiveCoins: number;
  deepPrestiges: number;
  neonRushPlayed: number;
  neonRushWins: number;
  highestNeonRushScore: number;
  seasonPoints: number;
  guessWinStreak: number;
  highestGuessWinStreak: number;
}

export interface ActiveEvent {
  id: EventId;
  title: string;
  description: string;
  emoji: string;
  endsAt: number;
  participated: boolean;
}

export interface GameState {
  version: number;
  coins: number;
  lifetimeCoins: number;
  totalClicks: number;
  manualClicks: number;
  combo: number;
  comboExpiresAt: number;
  prestigeLevel: number;
  prestigePoints: number;
  deepPrestige: DeepPrestigeState;
  upgrades: Record<UpgradeId, number>;
  unlockedAchievements: string[];
  stats: GameStats;
  daily: DailyState;
  season: SeasonState;
  activeEvent: ActiveEvent | null;
  nextEventAt: number;
  turboUntil: number;
  playSeconds: number;
  startedAt: number;
  lastSavedAt: number;
  background: BackgroundSettings;
  theme: 'dark';
  soundEnabled: boolean;
}

export interface DerivedStats {
  clickPower: number;
  cps: number;
  prestigeBonus: number;
  deepProductionMultiplier: number;
  criticalChance: number;
  storeDiscount: number;
  turboMultiplier: number;
  comboMultiplier: number;
  comboLimit: number;
  offlineEfficiency: number;
  minigameMultiplier: number;
  missionRewardMultiplier: number;
}

export interface ClickResult {
  amount: number;
  critical: boolean;
  combo: number;
  comboMultiplier: number;
}

export interface ToastMessage {
  text: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
}
