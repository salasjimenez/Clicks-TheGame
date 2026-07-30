import { ACHIEVEMENTS } from '../data/achievements.js';
import { EVENTS } from '../data/events.js';
import { CONSUMABLES, UPGRADES } from '../data/store.js';
import { createInitialState, todayKey } from './state.js';
import type {
  Achievement,
  ClickResult,
  DerivedStats,
  EventId,
  GameState,
  MissionMetric,
  StoreItemId,
  ToastMessage,
  UpgradeId
} from '../types.js';

type StateListener = (state: GameState, derived: DerivedStats) => void;
type ToastListener = (message: ToastMessage) => void;

export class GameEngine {
  state: GameState;
  private stateListeners = new Set<StateListener>();
  private toastListeners = new Set<ToastListener>();
  private lastTick = performance.now();
  private eventSequence: EventId[] = ['doubleClick', 'clickRain', 'discount', 'criticalFever'];
  private eventIndex = 0;

  constructor(state: GameState) {
    this.state = state;
    this.refreshMissionProgress();
    this.applyOfflineProgress();
    this.checkAchievements();
  }

  get derived(): DerivedStats {
    const quantum = 1 + this.state.upgrades.quantumCore * 0.2;
    const prestigeBonus = 1 + this.state.prestigeLevel * 0.15;
    const turboMultiplier = this.state.turboUntil > Date.now() ? 3 : 1;
    const overclock = 1 + this.state.upgrades.overclock * 0.15;
    const coinBonus = 1 + this.state.upgrades.coinMagnet * 0.1;
    const comboLimit = 10 + this.state.upgrades.comboDrive * 5;
    const comboMultiplier = 1 + Math.min(this.state.combo, comboLimit) * 0.02;
    const offlineEfficiency = Math.min(1, 0.5 + this.state.upgrades.offlineBattery * 0.05);
    const baseClick = 2 ** this.state.upgrades.clickMultiplier;
    const eventClick = this.state.activeEvent?.id === 'doubleClick' ? 2 : 1;
    const eventCps = this.state.activeEvent?.id === 'clickRain' ? 10 : 0;
    const criticalEvent = this.state.activeEvent?.id === 'criticalFever' ? 0.25 : 0;
    return {
      clickPower: baseClick * quantum * prestigeBonus * eventClick * coinBonus * comboMultiplier,
      cps: (this.state.upgrades.autoClicker * quantum * prestigeBonus * overclock + eventCps) * turboMultiplier * coinBonus,
      prestigeBonus,
      criticalChance: Math.min(0.65, 0.05 + this.state.upgrades.luckyChip * 0.02 + criticalEvent),
      storeDiscount: this.state.activeEvent?.id === 'discount' ? 0.25 : 0,
      turboMultiplier,
      comboMultiplier,
      comboLimit,
      offlineEfficiency
    };
  }

  get prestigeRequirement(): number {
    return Math.floor(10000 * 2.15 ** this.state.prestigeLevel);
  }

  get prestigeGain(): number {
    if (this.state.totalClicks < this.prestigeRequirement) return 0;
    return Math.max(1, Math.floor(Math.sqrt(this.state.totalClicks / 10000)));
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state, this.derived);
    return () => this.stateListeners.delete(listener);
  }

  onToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  replaceState(state: GameState): void {
    this.state = state;
    this.lastTick = performance.now();
    this.refreshMissionProgress();
    this.checkAchievements();
    this.emit();
  }

  click(): ClickResult {
    this.ensureDailyState();
    const now = Date.now();
    this.state.combo = now <= this.state.comboExpiresAt ? Math.min(this.state.combo + 1, this.derived.comboLimit) : 1;
    this.state.comboExpiresAt = now + 1300;
    this.state.stats.highestCombo = Math.max(this.state.stats.highestCombo, this.state.combo);
    const critical = Math.random() < this.derived.criticalChance;
    const amount = this.derived.clickPower * (critical ? 5 : 1);
    this.state.totalClicks += 1;
    this.state.manualClicks += 1;
    this.state.daily.counters.manualClicks += 1;
    if (critical) {
      this.state.stats.criticalClicks += 1;
      this.state.daily.counters.criticalClicks += 1;
    }
    this.awardCoins(amount, 'manual');
    if (this.state.activeEvent) this.state.activeEvent.participated = true;
    this.refreshMissionProgress();
    this.checkAchievements();
    this.emit();
    return { amount, critical, combo: this.state.combo, comboMultiplier: this.derived.comboMultiplier };
  }

  tick(now = performance.now()): void {
    const elapsed = Math.min(1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    if (elapsed <= 0) return;
    this.ensureDailyState();
    const production = this.derived.cps * elapsed;
    if (production > 0) this.awardCoins(production, 'passive');
    this.state.playSeconds += elapsed;
    const wallClock = Date.now();
    if (this.state.combo > 0 && wallClock > this.state.comboExpiresAt) this.state.combo = 0;
    if (this.state.activeEvent && wallClock >= this.state.activeEvent.endsAt) this.finishEvent();
    if (!this.state.activeEvent && wallClock >= this.state.nextEventAt) this.startEvent();
    this.refreshMissionProgress();
    this.checkAchievements();
    this.emit();
  }

  getUpgradePrice(id: UpgradeId): number {
    const definition = UPGRADES.find((upgrade) => upgrade.id === id);
    if (!definition) return Number.POSITIVE_INFINITY;
    const level = this.state.upgrades[id];
    const raw = definition.basePrice * definition.growth ** level;
    return Math.max(1, Math.floor(raw * (1 - this.derived.storeDiscount)));
  }

  purchase(id: StoreItemId): boolean {
    this.ensureDailyState();
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (upgrade) {
      const level = this.state.upgrades[upgrade.id];
      if (upgrade.maxLevel !== undefined && level >= upgrade.maxLevel) {
        this.toast('Esta mejora ya alcanzó su nivel máximo.', 'info');
        return false;
      }
      const price = this.getUpgradePrice(upgrade.id);
      if (!this.spendCoins(price)) return false;
      this.state.upgrades[upgrade.id] += 1;
      this.registerPurchase();
      this.toast(`${upgrade.emoji} ${upgrade.name} subió al nivel ${this.state.upgrades[upgrade.id]}.`, 'success');
      this.checkAchievements();
      this.emit();
      return true;
    }
    const consumable = CONSUMABLES.find((item) => item.id === id);
    if (!consumable) return false;
    if (consumable.currency === 'coins') {
      if (!this.spendCoins(consumable.price)) return false;
    } else if (this.state.prestigePoints < consumable.price) {
      this.toast('No tienes suficientes puntos de prestigio.', 'warning');
      return false;
    } else {
      this.state.prestigePoints -= consumable.price;
    }
    if (consumable.id === 'timeBoost') {
      this.state.turboUntil = Math.max(Date.now(), this.state.turboUntil) + 30000;
      this.toast('⏱️ Turbo activado durante 30 segundos.', 'success');
    }
    if (consumable.id === 'capsule') {
      const reward = this.randomInteger(250, 1500);
      this.awardCoins(reward, 'reward');
      this.toast(`💊 La cápsula contenía ${this.format(reward)} monedas.`, 'success');
    }
    if (consumable.id === 'superCapsule') this.openSuperCapsule();
    this.registerPurchase();
    this.checkAchievements();
    this.emit();
    return true;
  }

  playRoulette(choice: 'red' | 'black' | 'green'): { number: number; color: 'red' | 'black' | 'green'; reward: number } | null {
    const cost = 100;
    if (!this.spendCoins(cost)) return null;
    const number = this.randomInteger(0, 36);
    const color = number === 0 ? 'green' : number % 2 === 0 ? 'black' : 'red';
    const reward = choice === color ? cost * (color === 'green' ? 14 : 2) : 0;
    this.finishMinigame(reward);
    return { number, color, reward };
  }

  playSlots(): { symbols: string[]; reward: number } | null {
    const cost = 75;
    if (!this.spendCoins(cost)) return null;
    const pool = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
    const symbols = Array.from({ length: 3 }, () => pool[this.randomInteger(0, pool.length - 1)] ?? '🍒');
    const unique = new Set(symbols).size;
    let reward = 0;
    if (unique === 1) reward = cost * (symbols[0] === '7️⃣' ? 25 : 8);
    else if (unique === 2) reward = cost * 2;
    this.finishMinigame(reward);
    return { symbols, reward };
  }

  playGuess(choice: number): { answer: number; reward: number } | null {
    const cost = 50;
    if (!Number.isInteger(choice) || choice < 1 || choice > 10) {
      this.toast('Selecciona un número válido del 1 al 10.', 'warning');
      return null;
    }
    if (!this.spendCoins(cost)) return null;
    const answer = this.randomInteger(1, 10);
    const reward = answer === choice ? cost * 6 : 0;
    this.finishMinigame(reward);
    return { answer, reward };
  }

  claimMission(id: string): boolean {
    const mission = this.state.daily.missions.find((item) => item.id === id);
    if (!mission || mission.claimed || mission.progress < mission.target) return false;
    mission.claimed = true;
    this.state.stats.missionsCompleted += 1;
    this.awardCoins(mission.reward, 'reward');
    this.toast(`${mission.emoji} Misión completada: +${this.format(mission.reward)} monedas.`, 'success');
    if (this.state.daily.missions.every((item) => item.claimed)) this.updateDailyStreak();
    this.checkAchievements();
    this.emit();
    return true;
  }

  prestige(): boolean {
    const gain = this.prestigeGain;
    if (gain < 1) {
      this.toast(`Necesitas ${this.format(this.prestigeRequirement)} clics para prestigiar.`, 'warning');
      return false;
    }
    this.state.prestigeLevel += 1;
    this.state.prestigePoints += gain;
    this.state.stats.totalPrestigePointsEarned += gain;
    this.state.coins = 0;
    this.state.totalClicks = 0;
    this.state.combo = 0;
    this.state.comboExpiresAt = 0;
    this.state.upgrades = {
      autoClicker: 0,
      clickMultiplier: 0,
      quantumCore: 0,
      luckyChip: 0,
      comboDrive: 0,
      overclock: 0,
      coinMagnet: 0,
      offlineBattery: 0
    };
    this.state.turboUntil = 0;
    this.state.activeEvent = null;
    this.state.nextEventAt = Date.now() + 45000;
    this.toast(`🌟 Prestigio ${this.state.prestigeLevel}: recibiste ${gain} puntos.`, 'success');
    this.checkAchievements();
    this.emit();
    return true;
  }

  toggleTheme(): void {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.emit();
  }

  toggleSound(): void {
    this.state.soundEnabled = !this.state.soundEnabled;
    this.emit();
  }

  reset(): void {
    const theme = this.state.theme;
    const soundEnabled = this.state.soundEnabled;
    this.state = createInitialState();
    this.state.theme = theme;
    this.state.soundEnabled = soundEnabled;
    this.lastTick = performance.now();
    this.emit();
  }

  format(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const absolute = Math.abs(value);
    if (absolute < 1000) return Math.floor(value).toLocaleString('es-PE');
    const units = [
      { value: 1e15, suffix: 'Q' },
      { value: 1e12, suffix: 'T' },
      { value: 1e9, suffix: 'B' },
      { value: 1e6, suffix: 'M' },
      { value: 1e3, suffix: 'K' }
    ];
    const unit = units.find((item) => absolute >= item.value);
    if (!unit) return Math.floor(value).toLocaleString('es-PE');
    const scaled = value / unit.value;
    return `${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}${unit.suffix}`;
  }

  private emit(): void {
    const derived = this.derived;
    this.state.stats.highestCoins = Math.max(this.state.stats.highestCoins, this.state.coins);
    this.stateListeners.forEach((listener) => listener(this.state, derived));
  }

  private toast(text: string, tone: ToastMessage['tone']): void {
    this.toastListeners.forEach((listener) => listener({ text, tone }));
  }

  private awardCoins(amount: number, source: 'manual' | 'passive' | 'reward'): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.state.coins += amount;
    this.state.lifetimeCoins += amount;
    this.state.daily.counters.coinsEarned += amount;
    if (source === 'passive') this.state.stats.passiveCoins += amount;
  }

  private spendCoins(amount: number): boolean {
    if (this.state.coins + Number.EPSILON < amount) {
      this.toast(`Necesitas ${this.format(amount)} monedas.`, 'warning');
      return false;
    }
    this.state.coins -= amount;
    return true;
  }

  private registerPurchase(): void {
    this.state.stats.itemsPurchased += 1;
    this.state.daily.counters.purchases += 1;
    this.refreshMissionProgress();
  }

  private finishMinigame(reward: number): void {
    this.state.stats.minigamesPlayed += 1;
    this.state.daily.counters.minigames += 1;
    if (reward > 0) {
      this.state.stats.minigamesWon += 1;
      this.awardCoins(reward, 'reward');
      this.toast(`🕹️ Ganaste ${this.format(reward)} monedas.`, 'success');
    } else {
      this.toast('🕹️ Esta ronda no tuvo premio.', 'info');
    }
    this.refreshMissionProgress();
    this.checkAchievements();
    this.emit();
  }

  private openSuperCapsule(): void {
    const available = UPGRADES.filter((upgrade) => upgrade.maxLevel === undefined || this.state.upgrades[upgrade.id] < upgrade.maxLevel);
    if (available.length > 0 && Math.random() < 0.35) {
      const selected = available[this.randomInteger(0, available.length - 1)];
      if (selected) {
        this.state.upgrades[selected.id] += 1;
        this.toast(`🌟 Mejora gratuita: ${selected.name} nivel ${this.state.upgrades[selected.id]}.`, 'success');
        return;
      }
    }
    const reward = this.randomInteger(5000, 15000);
    this.awardCoins(reward, 'reward');
    this.toast(`🌟 Premio estelar: ${this.format(reward)} monedas.`, 'success');
  }

  private refreshMissionProgress(): void {
    this.state.daily.missions.forEach((mission) => {
      mission.progress = Math.min(mission.target, this.metricValue(mission.metric));
    });
  }

  private metricValue(metric: MissionMetric): number {
    return this.state.daily.counters[metric];
  }

  private ensureDailyState(): void {
    const current = todayKey();
    if (this.state.daily.date === current) return;
    const previousStreak = this.state.daily.streak;
    const previousCompleted = this.state.daily.lastCompletedDate;
    const fresh = createInitialState().daily;
    fresh.streak = previousStreak;
    fresh.lastCompletedDate = previousCompleted;
    this.state.daily = fresh;
  }

  private updateDailyStreak(): void {
    const today = todayKey();
    if (this.state.daily.lastCompletedDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.state.daily.streak = this.state.daily.lastCompletedDate === todayKey(yesterday) ? this.state.daily.streak + 1 : 1;
    this.state.daily.lastCompletedDate = today;
    this.toast(`🔥 Racha diaria: ${this.state.daily.streak} días.`, 'success');
  }

  private startEvent(): void {
    const id = this.eventSequence[this.eventIndex % this.eventSequence.length] ?? 'doubleClick';
    this.eventIndex += 1;
    const definition = EVENTS[id];
    this.state.activeEvent = {
      id,
      title: definition.title,
      description: definition.description,
      emoji: definition.emoji,
      endsAt: Date.now() + definition.duration,
      participated: false
    };
    this.toast(`${definition.emoji} Evento activo: ${definition.title}.`, 'info');
  }

  private finishEvent(): void {
    if (this.state.activeEvent?.participated) {
      this.state.stats.eventsCompleted += 1;
      this.toast('✨ Evento completado.', 'success');
    }
    this.state.activeEvent = null;
    this.state.nextEventAt = Date.now() + this.randomInteger(55000, 90000);
  }

  private checkAchievements(): void {
    for (const achievement of ACHIEVEMENTS) {
      if (this.state.unlockedAchievements.includes(achievement.id)) continue;
      if (!this.isAchievementUnlocked(achievement)) continue;
      this.state.unlockedAchievements.push(achievement.id);
      this.awardCoins(achievement.reward, 'reward');
      this.toast(`${achievement.emoji} Logro: ${achievement.name} (+${this.format(achievement.reward)}).`, 'success');
    }
  }

  private isAchievementUnlocked(achievement: Achievement): boolean {
    if (achievement.category === 'clicks') return this.state.manualClicks >= achievement.requirement;
    if (achievement.category === 'cps') return this.derived.cps >= achievement.requirement;
    if (achievement.category === 'autoClickers') return this.state.upgrades.autoClicker >= achievement.requirement;
    if (achievement.category === 'multiplier') return 2 ** this.state.upgrades.clickMultiplier >= achievement.requirement;
    if (achievement.category === 'prestige') return this.state.prestigeLevel >= achievement.requirement;
    if (achievement.category === 'minigames') return this.state.stats.minigamesPlayed >= achievement.requirement;
    if (achievement.category === 'missions') return this.state.stats.missionsCompleted >= achievement.requirement;
    if (achievement.category === 'events') return this.state.stats.eventsCompleted >= achievement.requirement;
    if (achievement.category === 'time') return this.state.playSeconds >= achievement.requirement;
    if (achievement.category === 'shop') return this.state.stats.itemsPurchased >= achievement.requirement;
    if (achievement.id === 'SECRET_1') return this.derived.cps >= achievement.requirement;
    if (achievement.id === 'SECRET_2') return this.state.stats.minigamesWon >= achievement.requirement;
    if (achievement.id === 'SECRET_3') return this.state.manualClicks >= achievement.requirement;
    if (achievement.id === 'SECRET_4') return this.state.prestigeLevel >= achievement.requirement;
    if (achievement.id === 'SECRET_5') return this.state.stats.eventsCompleted >= achievement.requirement;
    if (achievement.id === 'SECRET_6') return this.state.unlockedAchievements.length >= achievement.requirement;
    if (achievement.id === 'SECRET_7') return this.state.unlockedAchievements.length >= 99;
    if (achievement.id === 'SECRET_8') return this.state.playSeconds >= achievement.requirement;
    return false;
  }

  private applyOfflineProgress(): void {
    const seconds = Math.min(28800, Math.max(0, (Date.now() - this.state.lastSavedAt) / 1000));
    const reward = this.derived.cps * seconds * this.derived.offlineEfficiency;
    if (reward < 1) return;
    this.awardCoins(reward, 'passive');
    queueMicrotask(() => this.toast(`🌙 Progreso sin conexión: +${this.format(reward)} monedas.`, 'info'));
  }

  private randomInteger(minimum: number, maximum: number): number {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
  }
}
