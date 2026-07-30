export type ThemeMode = 'dark' | 'light';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'godly';
export type AchievementCategory = 'clicks' | 'cps' | 'autoClickers' | 'multiplier' | 'prestige' | 'minigames' | 'missions' | 'events' | 'time' | 'shop' | 'secret';
export type UpgradeId = 'autoClicker' | 'clickMultiplier' | 'quantumCore' | 'luckyChip' | 'comboDrive' | 'overclock' | 'coinMagnet' | 'offlineBattery';
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
  upgrades: Record<UpgradeId, number>;
  unlockedAchievements: string[];
  stats: GameStats;
  daily: DailyState;
  activeEvent: ActiveEvent | null;
  nextEventAt: number;
  turboUntil: number;
  playSeconds: number;
  startedAt: number;
  lastSavedAt: number;
  theme: ThemeMode;
  soundEnabled: boolean;
}

export interface DerivedStats {
  clickPower: number;
  cps: number;
  prestigeBonus: number;
  criticalChance: number;
  storeDiscount: number;
  turboMultiplier: number;
  comboMultiplier: number;
  comboLimit: number;
  offlineEfficiency: number;
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
