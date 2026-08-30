// Local/CI smoke test for save compatibility. Not shipped to the browser bundle.
const { normalizeState } = await import('../assets/js/game/state.js');

const oldSave = {
  version: 4,
  coins: 12345,
  lifetimeCoins: 54321,
  totalClicks: 6789,
  manualClicks: 4321,
  prestigeLevel: 4,
  prestigePoints: 7,
  upgrades: {
    autoClicker: 12,
    clickMultiplier: 3,
    quantumCore: 2,
    luckyChip: 1,
    comboDrive: 4,
    overclock: 2,
    coinMagnet: 1,
    offlineBattery: 3
  },
  unlockedAchievements: ['CLICK_1', 'CLICK_10'],
  stats: {
    highestCoins: 60000,
    minigamesPlayed: 8,
    minigamesWon: 3,
    missionsCompleted: 5,
    eventsCompleted: 2,
    itemsPurchased: 25,
    criticalClicks: 11,
    totalPrestigePointsEarned: 9,
    highestCombo: 14,
    passiveCoins: 1500
  },
  daily: null,
  activeEvent: null,
  nextEventAt: Date.now() + 60000,
  turboUntil: 0,
  playSeconds: 7200,
  startedAt: Date.now() - 7200000,
  lastSavedAt: Date.now(),
  theme: 'dark',
  soundEnabled: true
};

const migrated = normalizeState(oldSave);
const checks = [
  ['version', migrated.version === 7],
  ['coins', migrated.coins === oldSave.coins],
  ['lifetimeCoins', migrated.lifetimeCoins === oldSave.lifetimeCoins],
  ['totalClicks', migrated.totalClicks === oldSave.totalClicks],
  ['manualClicks', migrated.manualClicks === oldSave.manualClicks],
  ['prestigeLevel', migrated.prestigeLevel === oldSave.prestigeLevel],
  ['prestigePoints', migrated.prestigePoints === oldSave.prestigePoints],
  ['autoClicker', migrated.upgrades.autoClicker === oldSave.upgrades.autoClicker],
  ['achievement', migrated.unlockedAchievements.includes('CLICK_10')],
  ['deep defaults', migrated.deepPrestige.level === 0 && migrated.deepPrestige.shards === 0],
  ['season defaults', typeof migrated.season.id === 'string' && migrated.season.id.length > 0],
  ['background defaults', migrated.background.mode === 'default' && migrated.background.preset === 'neonGrid'],
  ['palette default', migrated.background.palette === 'arcade'],
  ['theme fixed', migrated.theme === 'dark']
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`SAVE_MIGRATION=FAIL ${failed.join(', ')}`);
  process.exit(1);
}
console.log('SAVE_MIGRATION=PASS version4->version7 progress preserved');
