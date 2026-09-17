import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = await readFile(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    },
    fileName: path,
    reportDiagnostics: true
  });
  const errors = (output.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `Transpilacion con errores en ${path}`);
  const url = `data:text/javascript;base64,${Buffer.from(output.outputText, 'utf8').toString('base64')}`;
  return import(url);
}

const core = await importTypeScript('src/features/v29-core.ts');
const achievementsModule = await importTypeScript('src/data/achievements.ts');
const achievements = achievementsModule.ACHIEVEMENTS;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`OK ${passed} - ${name}`);
}

test('offline cap se mantiene entre 4 y 8 horas', () => {
  assert.equal(core.clampOfflineHours(2), 4);
  assert.equal(core.clampOfflineHours(6), 6);
  assert.equal(core.clampOfflineHours(12), 8);
});

test('precio de especializacion escala 1, 2, 4', () => {
  assert.equal(core.specializationPrice(0), 1);
  assert.equal(core.specializationPrice(1), 2);
  assert.equal(core.specializationPrice(2), 4);
  assert.equal(core.specializationPrice(3), Number.POSITIVE_INFINITY);
});

test('misiones semanales rotan de forma determinista', () => {
  const first = core.selectWeeklyMissions('2026-W38').map((mission) => mission.id);
  const second = core.selectWeeklyMissions('2026-W38').map((mission) => mission.id);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 3);
});

test('rama manual aumenta produccion por clic y combo', () => {
  const base = { clickPower: 100, cps: 50, prestigeBonus: 1, deepProductionMultiplier: 1, criticalChance: 0.05, storeDiscount: 0, turboMultiplier: 1, comboMultiplier: 1, comboLimit: 10, offlineEfficiency: 0.35, minigameMultiplier: 1, missionRewardMultiplier: 1 };
  const levels = core.emptySpecializationLevels();
  levels.powerTap = 2;
  levels.comboForge = 1;
  const derived = core.applySpecializationDerived(base, { path: 'manual', levels });
  assert.equal(derived.clickPower, 130);
  assert.equal(derived.comboLimit, 14);
});

test('rama automatizacion aumenta CPS y offline con limite', () => {
  const base = { clickPower: 100, cps: 50, prestigeBonus: 1, deepProductionMultiplier: 1, criticalChance: 0.05, storeDiscount: 0, turboMultiplier: 1, comboMultiplier: 1, comboLimit: 10, offlineEfficiency: 0.9, minigameMultiplier: 1, missionRewardMultiplier: 1 };
  const levels = core.emptySpecializationLevels();
  levels.servoGrid = 2;
  levels.batteryLoop = 3;
  const derived = core.applySpecializationDerived(base, { path: 'automation', levels });
  assert.equal(derived.cps, 65);
  assert.equal(derived.offlineEfficiency, 0.95);
});

test('rama critica aumenta probabilidad sin superar limite', () => {
  const base = { clickPower: 100, cps: 50, prestigeBonus: 1, deepProductionMultiplier: 1, criticalChance: 0.76, storeDiscount: 0, turboMultiplier: 1, comboMultiplier: 1, comboLimit: 10, offlineEfficiency: 0.35, minigameMultiplier: 1, missionRewardMultiplier: 1 };
  const levels = core.emptySpecializationLevels();
  levels.critLens = 3;
  levels.neonEdge = 2;
  const derived = core.applySpecializationDerived(base, { path: 'critical', levels });
  assert.equal(derived.criticalChance, 0.8);
  assert.equal(derived.clickPower, 120);
});

test('senal de compra prioriza el mejor tercio costo-beneficio', () => {
  const scores = [0.2, 0.1, 0.05, 0.01];
  assert.equal(core.classifyBuySignal(0.2, scores, true), 'smart');
  assert.equal(core.classifyBuySignal(0.01, scores, true), 'available');
  assert.equal(core.classifyBuySignal(0.2, scores, false), 'save');
});

test('economia evita eficiencias invalidas', () => {
  assert.equal(core.priceEfficiency(0, 100), 0);
  assert.equal(core.priceEfficiency(100, 0), 0);
  assert.equal(core.priceEfficiency(100, 25), 0.25);
});

test('catalogo de logros mantiene IDs unicos y requisitos validos', () => {
  assert.ok(Array.isArray(achievements));
  assert.ok(achievements.length >= 100);
  assert.equal(new Set(achievements.map((achievement) => achievement.id)).size, achievements.length);
  assert.ok(achievements.every((achievement) => Number.isFinite(achievement.requirement) && achievement.requirement >= 0));
});

test('condicion de desbloqueo por requisito respeta el umbral', () => {
  const clickAchievement = achievements.find((achievement) => achievement.category === 'clicks' && achievement.requirement > 0);
  assert.ok(clickAchievement);
  assert.equal(core.meetsRequirement(clickAchievement.requirement - 1, clickAchievement.requirement), false);
  assert.equal(core.meetsRequirement(clickAchievement.requirement, clickAchievement.requirement), true);
});

console.log(`\n${passed} pruebas v2.9 aprobadas.`);
