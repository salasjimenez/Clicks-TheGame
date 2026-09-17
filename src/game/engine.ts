import { ACHIEVEMENTS } from "../data/achievements.js";
import { DEEP_UPGRADES } from "../data/deep-prestige.js";
import { EVENTS } from "../data/events.js";
import { currentSeason } from "../data/seasons.js";
import { CONSUMABLES, UPGRADES } from "../data/store.js";
import { createInitialState, todayKey } from "./state.js";
import type {
  Achievement,
  BackgroundSettings,
  ClickResult,
  DeepUpgradeId,
  DerivedStats,
  EventId,
  GameState,
  MissionMetric,
  StoreItemId,
  ToastMessage,
  UpgradeId,
} from "../types.js";

type StateListener = (state: GameState, derived: DerivedStats) => void;
type ToastListener = (message: ToastMessage) => void;

export class GameEngine {
  state: GameState;
  private readonly stateListeners = new Set<StateListener>();
  private readonly toastListeners = new Set<ToastListener>();
  private readonly eventSequence: EventId[] = [
    "doubleClick",
    "clickRain",
    "discount",
    "criticalFever",
  ];
  private eventIndex = 0;
  private lastTick = performance.now();
  private achievementAccumulator = 0;

  constructor(state: GameState) {
    this.state = state;
    this.ensureSeasonState();
    this.refreshMissionProgress();
    this.applyOfflineProgress();
    this.checkAchievements();
  }

  get derived(): DerivedStats {
    const quantum = 1 + this.state.upgrades.quantumCore * 0.2;
    const prestigeBonus = 1 + this.state.prestigeLevel * 0.12;
    const deepProductionMultiplier =
      1 + this.state.deepPrestige.upgrades.coreEcho * 0.1;
    const turboMultiplier = this.state.turboUntil > Date.now() ? 3 : 1;
    const overclock = 1 + this.state.upgrades.overclock * 0.15;
    const coinBonus = 1 + this.state.upgrades.coinMagnet * 0.1;
    const comboLimit = 10 + this.state.upgrades.comboDrive * 5;
    const comboMultiplier = 1 + Math.min(this.state.combo, comboLimit) * 0.02;
    const offlineEfficiency = Math.min(
      0.8,
      0.35 +
        this.state.upgrades.offlineBattery * 0.05 +
        this.state.deepPrestige.upgrades.timeDilation * 0.03,
    );
    const baseClick = 2 ** this.state.upgrades.clickMultiplier;
    const eventClick = this.state.activeEvent?.id === "doubleClick" ? 2 : 1;
    const eventCps = this.state.activeEvent?.id === "clickRain" ? 10 : 0;
    const criticalEvent =
      this.state.activeEvent?.id === "criticalFever" ? 0.25 : 0;
    const criticalChance = Math.min(
      0.65,
      0.05 +
        this.state.upgrades.luckyChip * 0.02 +
        this.state.deepPrestige.upgrades.criticalMatrix * 0.01 +
        criticalEvent,
    );
    const minigameMultiplier =
      1 + this.state.deepPrestige.upgrades.arcadeProtocol * 0.12;
    const missionRewardMultiplier =
      1 + this.state.deepPrestige.upgrades.missionCompiler * 0.05;
    return {
      clickPower:
        baseClick *
        quantum *
        prestigeBonus *
        deepProductionMultiplier *
        eventClick *
        coinBonus *
        comboMultiplier,
      cps:
        (this.state.upgrades.autoClicker *
          quantum *
          prestigeBonus *
          deepProductionMultiplier *
          overclock +
          eventCps) *
        turboMultiplier *
        coinBonus,
      prestigeBonus,
      deepProductionMultiplier,
      criticalChance,
      storeDiscount: this.state.activeEvent?.id === "discount" ? 0.25 : 0,
      turboMultiplier,
      comboMultiplier,
      comboLimit,
      offlineEfficiency,
      minigameMultiplier,
      missionRewardMultiplier,
    };
  }

  get prestigeRequirement(): number {
    return Math.floor(5000 * 1.85 ** this.state.prestigeLevel);
  }

  get prestigeGain(): number {
    if (this.state.totalClicks < this.prestigeRequirement) return 0;
    return Math.max(1, Math.floor((this.state.totalClicks / 5000) ** 0.55));
  }

  get deepPrestigeRequirement(): number {
    return 5 + this.state.deepPrestige.level * 3;
  }

  get deepPrestigeGain(): number {
    if (this.state.prestigeLevel < this.deepPrestigeRequirement) return 0;
    const progress =
      (this.state.prestigeLevel + this.state.prestigePoints) /
      this.deepPrestigeRequirement;
    return Math.max(1, Math.floor(Math.sqrt(progress)));
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
    this.ensureSeasonState();
    this.refreshMissionProgress();
    this.checkBackgroundUnlocks();
    this.checkAchievements();
    this.emit();
  }

  click(): ClickResult {
    this.ensureDailyState();
    const now = Date.now();
    this.state.combo =
      now <= this.state.comboExpiresAt
        ? Math.min(this.state.combo + 1, this.derived.comboLimit)
        : 1;
    this.state.comboExpiresAt = now + 1300;
    this.state.stats.highestCombo = Math.max(
      this.state.stats.highestCombo,
      this.state.combo,
    );
    const critical = Math.random() < this.derived.criticalChance;
    const amount = this.derived.clickPower * (critical ? 5 : 1);
    this.state.totalClicks += 1;
    this.state.manualClicks += 1;
    this.checkBackgroundUnlocks();
    this.state.daily.counters.manualClicks += 1;
    if (critical) {
      this.state.stats.criticalClicks += 1;
      this.state.daily.counters.criticalClicks += 1;
    }
    this.awardCoins(amount, "manual");
    if (this.state.activeEvent) this.state.activeEvent.participated = true;
    this.refreshMissionProgress();
    this.checkAchievements();
    this.emit();
    return {
      amount,
      critical,
      combo: this.state.combo,
      comboMultiplier: this.derived.comboMultiplier,
    };
  }

  tick(now = performance.now()): void {
    const elapsed = Math.min(1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    if (elapsed <= 0) return;
    this.ensureDailyState();
    this.checkBackgroundUnlocks();
    const production = this.derived.cps * elapsed;
    if (production > 0) this.awardCoins(production, "passive");
    this.state.playSeconds += elapsed;
    const wallClock = Date.now();
    if (this.state.combo > 0 && wallClock > this.state.comboExpiresAt)
      this.state.combo = 0;
    if (this.state.activeEvent && wallClock >= this.state.activeEvent.endsAt)
      this.finishEvent();
    if (!this.state.activeEvent && wallClock >= this.state.nextEventAt)
      this.startEvent();
    this.refreshMissionProgress();
    this.achievementAccumulator += elapsed;
    if (this.achievementAccumulator >= 1) {
      this.achievementAccumulator = 0;
      this.checkAchievements();
    }
    this.emit();
  }

  resumeFromBackground(seconds: number): void {
    const elapsed = Math.min(28800, Math.max(0, seconds));
    this.lastTick = performance.now();
    if (elapsed < 1) return;
    const reward = this.derived.cps * elapsed * this.derived.offlineEfficiency;
    if (reward >= 1) {
      this.awardCoins(reward, "passive");
      this.toast(`🌙 Regreso rápido: +${this.format(reward)} monedas.`, "info");
    }
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

  getDeepUpgradePrice(id: DeepUpgradeId): number {
    const definition = DEEP_UPGRADES.find((upgrade) => upgrade.id === id);
    if (!definition) return Number.POSITIVE_INFINITY;
    const level = this.state.deepPrestige.upgrades[id];
    return Math.max(
      1,
      Math.ceil(definition.basePrice * definition.growth ** level),
    );
  }

  purchase(id: StoreItemId): boolean {
    this.ensureDailyState();
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (upgrade) {
      const level = this.state.upgrades[upgrade.id];
      if (upgrade.maxLevel !== undefined && level >= upgrade.maxLevel) {
        this.toast("Esta mejora ya alcanzó su nivel máximo.", "info");
        return false;
      }
      const price = this.getUpgradePrice(upgrade.id);
      if (!this.spendCoins(price)) return false;
      this.state.upgrades[upgrade.id] += 1;
      this.registerPurchase();
      this.toast(
        `${upgrade.emoji} ${upgrade.name} subió al nivel ${this.state.upgrades[upgrade.id]}.`,
        "success",
      );
      this.checkAchievements();
      this.emit();
      return true;
    }

    const consumable = CONSUMABLES.find((item) => item.id === id);
    if (!consumable) return false;
    if (consumable.currency === "coins") {
      if (!this.spendCoins(consumable.price)) return false;
    } else if (this.state.prestigePoints < consumable.price) {
      this.toast("No tienes suficientes puntos de prestigio.", "warning");
      return false;
    } else {
      this.state.prestigePoints -= consumable.price;
    }

    if (consumable.id === "timeBoost") {
      this.state.turboUntil =
        Math.max(Date.now(), this.state.turboUntil) + 30000;
      this.toast("⏱️ Turbo activado durante 30 segundos.", "success");
    }
    if (consumable.id === "capsule") {
      const reward = this.randomInteger(250, 1500);
      this.awardCoins(reward, "reward");
      this.toast(
        `💊 La cápsula contenía ${this.format(reward)} monedas.`,
        "success",
      );
    }
    if (consumable.id === "superCapsule") this.openSuperCapsule();
    this.registerPurchase();
    this.checkAchievements();
    this.emit();
    return true;
  }

  purchaseDeepUpgrade(id: DeepUpgradeId): boolean {
    const definition = DEEP_UPGRADES.find((upgrade) => upgrade.id === id);
    if (!definition) return false;
    const level = this.state.deepPrestige.upgrades[id];
    if (level >= definition.maxLevel) {
      this.toast("Esta mejora profunda ya está al máximo.", "info");
      return false;
    }
    const price = this.getDeepUpgradePrice(id);
    if (this.state.deepPrestige.shards < price) {
      this.toast(`Necesitas ${price} fragmentos de núcleo.`, "warning");
      return false;
    }
    this.state.deepPrestige.shards -= price;
    this.state.deepPrestige.upgrades[id] += 1;
    this.toast(
      `${definition.emoji} ${definition.name} subió al nivel ${this.state.deepPrestige.upgrades[id]}.`,
      "success",
    );
    this.checkAchievements();
    this.emit();
    return true;
  }

  playRoulette(
    choice: "red" | "black" | "green",
  ): {
    number: number;
    color: "red" | "black" | "green";
    reward: number;
  } | null {
    const cost = 100;
    if (!this.spendCoins(cost)) return null;
    const number = this.randomInteger(0, 36);
    const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
    const rawReward =
      choice === color ? cost * (color === "green" ? 14 : 2) : 0;
    const reward = this.finishMinigame(rawReward);
    if (number === 0 && choice === "green")
      this.unlockAchievementById("ROULETTE_JACKPOT");
    return { number, color, reward };
  }

  playSlots(): { symbols: string[]; reward: number } | null {
    const cost = 75;
    if (!this.spendCoins(cost)) return null;
    const pool = ["🍒", "🍋", "🔔", "💎", "7️⃣"];
    const symbols = Array.from(
      { length: 3 },
      () => pool[this.randomInteger(0, pool.length - 1)] ?? "🍒",
    );
    const unique = new Set(symbols).size;
    let rawReward = 0;
    if (unique === 1) rawReward = cost * (symbols[0] === "7️⃣" ? 25 : 8);
    else if (unique === 2) rawReward = cost * 2;
    const reward = this.finishMinigame(rawReward);
    if (symbols.every((symbol) => symbol === "7️⃣"))
      this.unlockAchievementById("SLOT_JACKPOT");
    return { symbols, reward };
  }

  playGuess(choice: number): { answer: number; reward: number } | null {
    const cost = 50;
    if (!Number.isInteger(choice) || choice < 1 || choice > 10) {
      this.toast("Selecciona un número válido del 1 al 10.", "warning");
      return null;
    }
    if (!this.spendCoins(cost)) return null;
    const answer = this.randomInteger(1, 10);
    const won = answer === choice;
    this.state.stats.guessWinStreak = won
      ? this.state.stats.guessWinStreak + 1
      : 0;
    this.state.stats.highestGuessWinStreak = Math.max(
      this.state.stats.highestGuessWinStreak,
      this.state.stats.guessWinStreak,
    );
    const reward = this.finishMinigame(won ? cost * 6 : 0);
    if (this.state.stats.guessWinStreak >= 10)
      this.unlockAchievementById("GUESS_MASTER");
    return { answer, reward };
  }

  completeNeonRush(score: number): number {
    const safeScore = Math.max(0, Math.floor(score));
    this.state.stats.neonRushPlayed += 1;
    this.state.stats.highestNeonRushScore = Math.max(
      this.state.stats.highestNeonRushScore,
      safeScore,
    );
    if (safeScore >= 10) this.state.stats.neonRushWins += 1;
    return this.finishMinigame(safeScore * 160, safeScore >= 10);
  }

  claimMission(id: string): boolean {
    const mission = this.state.daily.missions.find((item) => item.id === id);
    if (!mission || mission.claimed || mission.progress < mission.target)
      return false;
    mission.claimed = true;
    this.state.stats.missionsCompleted += 1;
    const reward = Math.max(
      1,
      Math.floor(mission.reward * this.derived.missionRewardMultiplier),
    );
    this.awardCoins(reward, "reward");
    this.toast(
      `${mission.emoji} Misión completada: +${this.format(reward)} monedas.`,
      "success",
    );
    if (this.state.daily.missions.every((item) => item.claimed))
      this.updateDailyStreak();
    this.checkAchievements();
    this.emit();
    return true;
  }

  prestige(): boolean {
    const gain = this.prestigeGain;
    if (gain < 1) {
      this.toast(
        `Necesitas ${this.format(this.prestigeRequirement)} clics para prestigiar.`,
        "warning",
      );
      return false;
    }
    this.state.prestigeLevel += 1;
    this.state.prestigePoints += gain;
    this.state.stats.totalPrestigePointsEarned += gain;
    this.resetRunProgress();
    this.toast(
      `🌟 Prestigio ${this.state.prestigeLevel}: recibiste ${gain} puntos.`,
      "success",
    );
    this.checkAchievements();
    this.emit();
    return true;
  }

  deepPrestige(): boolean {
    const gain = this.deepPrestigeGain;
    if (gain < 1) {
      this.toast(
        `Necesitas prestigio ${this.deepPrestigeRequirement} para reiniciar el núcleo.`,
        "warning",
      );
      return false;
    }
    this.state.deepPrestige.level += 1;
    this.state.deepPrestige.shards += gain;
    this.state.deepPrestige.totalShardsEarned += gain;
    this.state.stats.deepPrestiges += 1;
    this.state.prestigeLevel = 0;
    this.state.prestigePoints = 0;
    this.resetRunProgress();
    this.toast(
      `💠 Núcleo reiniciado: +${gain} fragment${gain === 1 ? "o" : "os"}.`,
      "success",
    );
    this.checkAchievements();
    this.emit();
    return true;
  }

  toggleSeason(): void {
    this.ensureSeasonState();
    this.state.season.enabled = !this.state.season.enabled;
    this.toast(
      this.state.season.enabled
        ? "✨ Temporada activada."
        : "⏸️ Temporada pausada.",
      "info",
    );
    this.emit();
  }

  updateBackground(settings: Partial<BackgroundSettings>): void {
    this.state.background = { ...this.state.background, ...settings };
    this.emit();
  }

  toggleSound(): void {
    this.state.soundEnabled = !this.state.soundEnabled;
    this.emit();
  }

  reset(): void {
    const soundEnabled = this.state.soundEnabled;
    this.state = createInitialState();
    this.state.soundEnabled = soundEnabled;
    this.lastTick = performance.now();
    this.emit();
  }

  format(value: number): string {
    if (!Number.isFinite(value)) return "0";
    const absolute = Math.abs(value);
    if (absolute < 1000) return Math.floor(value).toLocaleString("es-PE");
    const units = [
      { value: 1e15, suffix: "Q" },
      { value: 1e12, suffix: "T" },
      { value: 1e9, suffix: "B" },
      { value: 1e6, suffix: "M" },
      { value: 1e3, suffix: "K" },
    ];
    const unit = units.find((item) => absolute >= item.value);
    if (!unit) return Math.floor(value).toLocaleString("es-PE");
    const scaled = value / unit.value;
    return `${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}${unit.suffix}`;
  }

  private resetRunProgress(): void {
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
      offlineBattery: 0,
    };
    this.state.turboUntil = 0;
    this.state.activeEvent = null;
    this.state.nextEventAt = Date.now() + 120000;
  }

  private checkBackgroundUnlocks(): void {
    if (
      this.state.manualClicks >= 1000 &&
      !this.state.background.imageUnlockNotified
    ) {
      this.state.background.imageUnlockNotified = true;
      this.toast("¡Desbloqueaste fondos de imagen!", "success");
    }
    if (
      this.state.manualClicks >= 5000 &&
      !this.state.background.videoUnlockNotified
    ) {
      this.state.background.videoUnlockNotified = true;
      this.toast("¡Desbloqueaste fondos de video!", "success");
    }
  }

  private emit(): void {
    const derived = this.derived;
    this.state.stats.highestCoins = Math.max(
      this.state.stats.highestCoins,
      this.state.coins,
    );
    this.stateListeners.forEach((listener) => listener(this.state, derived));
  }

  private toast(text: string, tone: ToastMessage["tone"]): void {
    this.toastListeners.forEach((listener) => listener({ text, tone }));
  }

  private awardCoins(
    amount: number,
    source: "manual" | "passive" | "reward",
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.state.coins += amount;
    this.state.lifetimeCoins += amount;
    this.state.daily.counters.coinsEarned += amount;
    if (source === "passive") this.state.stats.passiveCoins += amount;
  }

  private spendCoins(amount: number): boolean {
    if (this.state.coins + Number.EPSILON < amount) {
      this.toast(`Necesitas ${this.format(amount)} monedas.`, "warning");
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

  private finishMinigame(
    rawReward: number,
    winOverride: boolean | null = null,
  ): number {
    this.state.stats.minigamesPlayed += 1;
    this.state.daily.counters.minigames += 1;
    const reward =
      rawReward > 0
        ? Math.max(1, Math.floor(rawReward * this.derived.minigameMultiplier))
        : 0;
    const won = winOverride ?? reward > 0;
    if (reward > 0) this.awardCoins(reward, "reward");
    if (won) {
      this.state.stats.minigamesWon += 1;
      this.toast(
        reward > 0
          ? `🕹️ Ganaste ${this.format(reward)} monedas.`
          : "🕹️ Ronda completada.",
        "success",
      );
    } else if (reward > 0) {
      this.toast(
        `🕹️ Premio de participación: ${this.format(reward)} monedas.`,
        "info",
      );
    } else {
      this.toast("🕹️ Esta ronda no tuvo premio.", "info");
    }
    this.refreshMissionProgress();
    this.checkAchievements();
    this.emit();
    return reward;
  }

  private openSuperCapsule(): void {
    const available = UPGRADES.filter(
      (upgrade) =>
        upgrade.maxLevel === undefined ||
        this.state.upgrades[upgrade.id] < upgrade.maxLevel,
    );
    if (available.length > 0 && Math.random() < 0.35) {
      const selected = available[this.randomInteger(0, available.length - 1)];
      if (selected) {
        this.state.upgrades[selected.id] += 1;
        this.toast(
          `🌟 Mejora gratuita: ${selected.name} nivel ${this.state.upgrades[selected.id]}.`,
          "success",
        );
        return;
      }
    }
    const reward = this.randomInteger(5000, 15000);
    this.awardCoins(reward, "reward");
    this.toast(`🌟 Premio estelar: ${this.format(reward)} monedas.`, "success");
  }

  private refreshMissionProgress(): void {
    this.state.daily.missions.forEach((mission) => {
      mission.progress = Math.min(
        mission.target,
        this.metricValue(mission.metric),
      );
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
    this.ensureSeasonState();
  }

  private ensureSeasonState(): void {
    const definition = currentSeason();
    if (this.state.season.id === definition.id) return;
    const enabled = this.state.season.enabled;
    this.state.season = {
      id: definition.id,
      enabled,
      points: 0,
      lastDailyBonusDate: "",
    };
  }

  private updateDailyStreak(): void {
    const today = todayKey();
    if (this.state.daily.lastCompletedDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      this.state.daily.streak =
        this.state.daily.lastCompletedDate === todayKey(yesterday)
          ? this.state.daily.streak + 1
          : 1;
      this.state.daily.lastCompletedDate = today;
      this.toast(
        `🔥 Racha diaria: ${this.state.daily.streak} días.`,
        "success",
      );
    }
    if (
      this.state.season.enabled &&
      this.state.season.lastDailyBonusDate !== today
    ) {
      this.state.season.points += 3;
      this.state.stats.seasonPoints += 3;
      this.state.season.lastDailyBonusDate = today;
      this.toast("✨ Temporada: +3 puntos por completar el día.", "success");
    }
  }

  private startEvent(): void {
    const id =
      this.eventSequence[this.eventIndex % this.eventSequence.length] ??
      "doubleClick";
    this.eventIndex += 1;
    const definition = EVENTS[id];
    const durationMultiplier = this.state.season.enabled
      ? 1 + this.state.deepPrestige.upgrades.seasonAntenna * 0.05
      : 1;
    this.state.activeEvent = {
      id,
      title: definition.title,
      description: definition.description,
      emoji: definition.emoji,
      endsAt: Date.now() + Math.floor(definition.duration * durationMultiplier),
      participated: false,
    };
    this.toast(
      `${definition.emoji} Evento activo: ${definition.title}.`,
      "info",
    );
  }

  private finishEvent(): void {
    if (this.state.activeEvent?.participated) {
      this.state.stats.eventsCompleted += 1;
      if (this.state.season.enabled) {
        this.state.season.points += 1;
        this.state.stats.seasonPoints += 1;
      }
      this.toast(
        this.state.season.enabled
          ? "✨ Evento completado: +1 punto de temporada."
          : "✨ Evento completado.",
        "success",
      );
    }
    this.state.activeEvent = null;
    this.state.nextEventAt = Date.now() + this.randomInteger(150000, 240000);
  }

  private checkAchievements(): void {
    for (const achievement of ACHIEVEMENTS) {
      if (this.state.unlockedAchievements.includes(achievement.id)) continue;
      if (!this.isAchievementUnlocked(achievement)) continue;
      this.unlockAchievement(achievement);
    }
  }

  private unlockAchievementById(id: string): void {
    if (this.state.unlockedAchievements.includes(id)) return;
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    if (achievement) this.unlockAchievement(achievement);
  }

  private unlockAchievement(achievement: Achievement): void {
    this.state.unlockedAchievements.push(achievement.id);
    this.awardCoins(achievement.reward, "reward");
    this.toast(
      `Logro: ${achievement.name} (+${this.format(achievement.reward)}).`,
      "success",
    );
  }

  private isAchievementUnlocked(achievement: Achievement): boolean {
    const id = achievement.id;
    if (id.startsWith("DEEP_LEVEL_"))
      return this.state.deepPrestige.level >= achievement.requirement;
    if (id.startsWith("DEEP_SHARDS_"))
      return (
        this.state.deepPrestige.totalShardsEarned >= achievement.requirement
      );
    if (id.startsWith("DEEP_UPGRADES_")) {
      const levels = Object.values(this.state.deepPrestige.upgrades).reduce(
        (sum, level) => sum + level,
        0,
      );
      return levels >= achievement.requirement;
    }
    if (id.startsWith("NEON_PLAY_"))
      return this.state.stats.neonRushPlayed >= achievement.requirement;
    if (id.startsWith("NEON_WIN_"))
      return this.state.stats.neonRushWins >= achievement.requirement;
    if (id.startsWith("NEON_SCORE_"))
      return this.state.stats.highestNeonRushScore >= achievement.requirement;
    if (id.startsWith("SEASON_POINTS_"))
      return this.state.stats.seasonPoints >= achievement.requirement;
    if (id === "MISSION_STREAK_7" || id === "MISSION_STREAK_30")
      return this.state.daily.streak >= achievement.requirement;
    if (id === "SECRET_7")
      return this.state.unlockedAchievements.length >= ACHIEVEMENTS.length - 1;
    if (achievement.category === "clicks")
      return this.state.manualClicks >= achievement.requirement;
    if (achievement.category === "cps")
      return this.derived.cps >= achievement.requirement;
    if (achievement.category === "autoClickers")
      return this.state.upgrades.autoClicker >= achievement.requirement;
    if (achievement.category === "multiplier")
      return (
        2 ** this.state.upgrades.clickMultiplier >= achievement.requirement
      );
    if (achievement.category === "prestige")
      return this.state.prestigeLevel >= achievement.requirement;
    if (achievement.category === "deepPrestige")
      return this.state.deepPrestige.level >= achievement.requirement;
    if (achievement.category === "minigames")
      return this.state.stats.minigamesPlayed >= achievement.requirement;
    if (achievement.category === "missions")
      return this.state.stats.missionsCompleted >= achievement.requirement;
    if (achievement.category === "events")
      return this.state.stats.eventsCompleted >= achievement.requirement;
    if (achievement.category === "seasons")
      return this.state.stats.seasonPoints >= achievement.requirement;
    if (achievement.category === "time")
      return this.state.playSeconds >= achievement.requirement;
    if (achievement.category === "shop")
      return this.state.stats.itemsPurchased >= achievement.requirement;
    if (id === "SECRET_1") return this.derived.cps >= achievement.requirement;
    if (id === "SECRET_2")
      return this.state.stats.minigamesWon >= achievement.requirement;
    if (id === "SECRET_3")
      return this.state.manualClicks >= achievement.requirement;
    if (id === "SECRET_4")
      return this.state.prestigeLevel >= achievement.requirement;
    if (id === "SECRET_5")
      return this.state.stats.eventsCompleted >= achievement.requirement;
    if (id === "SECRET_6")
      return this.state.unlockedAchievements.length >= achievement.requirement;
    if (id === "SECRET_8")
      return this.state.playSeconds >= achievement.requirement;
    return false;
  }

  private applyOfflineProgress(): void {
    const seconds = Math.min(
      28800,
      Math.max(0, (Date.now() - this.state.lastSavedAt) / 1000),
    );
    const reward = this.derived.cps * seconds * this.derived.offlineEfficiency;
    if (reward < 1) return;
    this.awardCoins(reward, "passive");
    queueMicrotask(() =>
      this.toast(
        `🌙 Progreso sin conexión: +${this.format(reward)} monedas.`,
        "info",
      ),
    );
  }

  private randomInteger(minimum: number, maximum: number): number {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
  }
}
