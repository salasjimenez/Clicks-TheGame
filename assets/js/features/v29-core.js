export const V29_RELEASE = '2.9';
export const V29_STATE_VERSION = 1;
export const WEEKLY_MISSIONS = [
    { id: 'weekly-clicks-2500', title: 'Maratón de clics', description: 'Haz 2,500 clics manuales esta semana', emoji: '👆', metric: 'manualClicks', target: 2500, reward: 4200 },
    { id: 'weekly-coins-50000', title: 'Caja semanal', description: 'Genera 50,000 monedas esta semana', emoji: '🪙', metric: 'coinsEarned', target: 50000, reward: 5200 },
    { id: 'weekly-purchases-12', title: 'Ingeniero arcade', description: 'Compra 12 mejoras o consumibles', emoji: '🛠️', metric: 'purchases', target: 12, reward: 4500 },
    { id: 'weekly-games-10', title: 'Turno extendido', description: 'Juega 10 minijuegos', emoji: '🕹️', metric: 'minigames', target: 10, reward: 4800 },
    { id: 'weekly-crits-80', title: 'Precisión neón', description: 'Consigue 80 clics críticos', emoji: '🎯', metric: 'criticalClicks', target: 80, reward: 5000 },
    { id: 'weekly-clicks-5000', title: 'Dedo de acero', description: 'Haz 5,000 clics manuales esta semana', emoji: '⚡', metric: 'manualClicks', target: 5000, reward: 7600 },
    { id: 'weekly-coins-150000', title: 'Magnate semanal', description: 'Genera 150,000 monedas esta semana', emoji: '💰', metric: 'coinsEarned', target: 150000, reward: 9000 }
];
export const SPECIALIZATION_NODES = [
    { id: 'powerTap', path: 'manual', name: 'Power Tap', description: '+15% poder de clic por nivel', emoji: '👆', maxLevel: 3 },
    { id: 'comboForge', path: 'manual', name: 'Combo Forge', description: '+4 al límite de combo por nivel', emoji: '🔥', maxLevel: 3 },
    { id: 'servoGrid', path: 'automation', name: 'Servo Grid', description: '+15% CPS por nivel', emoji: '🤖', maxLevel: 3 },
    { id: 'batteryLoop', path: 'automation', name: 'Battery Loop', description: '+4% eficiencia offline por nivel', emoji: '🔋', maxLevel: 3 },
    { id: 'critLens', path: 'critical', name: 'Crit Lens', description: '+3% probabilidad crítica por nivel', emoji: '🎯', maxLevel: 3 },
    { id: 'neonEdge', path: 'critical', name: 'Neon Edge', description: '+10% poder de clic por nivel', emoji: '💥', maxLevel: 3 }
];
export const SPECIALIZATION_LABELS = {
    manual: 'Manual',
    automation: 'Automatización',
    critical: 'Crítico'
};
export function emptySpecializationLevels() {
    return {
        powerTap: 0,
        comboForge: 0,
        servoGrid: 0,
        batteryLoop: 0,
        critLens: 0,
        neonEdge: 0
    };
}
export function clampOfflineHours(value) {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 8;
    return Math.min(8, Math.max(4, Math.round(numeric)));
}
export function isoWeekKey(date = new Date()) {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const year = target.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}
function seededRandom(seed) {
    let value = Array.from(seed).reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
    return () => {
        value = Math.imul(value ^ (value >>> 15), 1 | value);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
export function selectWeeklyMissions(key, count = 3) {
    const random = seededRandom(`click-v29:${key}`);
    const candidates = [...WEEKLY_MISSIONS];
    const selected = [];
    while (selected.length < Math.min(count, candidates.length)) {
        const index = Math.floor(random() * candidates.length);
        const mission = candidates.splice(index, 1)[0];
        if (mission)
            selected.push({ ...mission });
    }
    return selected;
}
export function gameMetricSnapshot(state) {
    return {
        manualClicks: state.manualClicks,
        coinsEarned: state.lifetimeCoins,
        purchases: state.stats.itemsPurchased,
        minigames: state.stats.minigamesPlayed,
        criticalClicks: state.stats.criticalClicks
    };
}
export function weeklyProgress(metric, baseline, state) {
    const current = gameMetricSnapshot(state)[metric];
    return Math.max(0, current - baseline[metric]);
}
export function specializationPrice(level) {
    const prices = [1, 2, 4];
    return prices[Math.max(0, Math.floor(level))] ?? Number.POSITIVE_INFINITY;
}
export function applySpecializationDerived(base, specialization) {
    const levels = specialization.levels;
    if (specialization.path === 'manual') {
        return {
            ...base,
            clickPower: base.clickPower * (1 + levels.powerTap * 0.15),
            comboLimit: base.comboLimit + levels.comboForge * 4
        };
    }
    if (specialization.path === 'automation') {
        return {
            ...base,
            cps: base.cps * (1 + levels.servoGrid * 0.15),
            offlineEfficiency: Math.min(0.95, base.offlineEfficiency + levels.batteryLoop * 0.04)
        };
    }
    if (specialization.path === 'critical') {
        return {
            ...base,
            criticalChance: Math.min(0.8, base.criticalChance + levels.critLens * 0.03),
            clickPower: base.clickPower * (1 + levels.neonEdge * 0.1)
        };
    }
    return { ...base };
}
export function estimateUpgradeBenefit(id, state, derived) {
    const click = Math.max(0.01, derived.clickPower);
    const cps = Math.max(0.01, derived.cps);
    switch (id) {
        case 'autoClicker':
            return Math.max(0.25, state.upgrades.autoClicker > 0 ? cps / state.upgrades.autoClicker : click * 0.35);
        case 'clickMultiplier':
            return click;
        case 'quantumCore':
            return (click + cps) * 0.17;
        case 'luckyChip':
            return click * 0.08;
        case 'comboDrive':
            return click * 0.04;
        case 'overclock':
            return cps * 0.13;
        case 'coinMagnet':
            return (click + cps) * 0.09;
        case 'offlineBattery':
            return cps * 0.05 * 120;
    }
}
export function priceEfficiency(price, benefit) {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(benefit) || benefit <= 0)
        return 0;
    return benefit / price;
}
export function classifyBuySignal(score, allScores, affordable) {
    if (!affordable)
        return 'save';
    const valid = allScores.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => b - a);
    if (valid.length === 0)
        return 'available';
    const smartCount = Math.max(1, Math.ceil(valid.length / 3));
    const threshold = valid[smartCount - 1] ?? Number.POSITIVE_INFINITY;
    return score >= threshold ? 'smart' : 'available';
}
export function meetsRequirement(current, requirement) {
    return Number.isFinite(current) && Number.isFinite(requirement) && current >= requirement;
}
