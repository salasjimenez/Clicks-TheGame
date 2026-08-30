import { ACHIEVEMENTS, RARITY_LABELS } from '../data/achievements.js';
import { DEEP_UPGRADES } from '../data/deep-prestige.js';
import { currentSeason } from '../data/seasons.js';
import { CONSUMABLES, UPGRADES } from '../data/store.js';
import { GameAudio } from '../game/audio.js';
import { clearState, exportState, importState, saveState } from '../game/storage.js';
import { achievementIconMarkup } from './achievement-icons.js';
import { byId, escapeHtml, formatDuration } from './dom.js';
import { spawnClickParticle } from './particles.js';
const CLICK_PALETTES = {
    arcade: [
        ['#ff3cac', '#7a5cff', '#00f5ff'],
        ['#00f5ff', '#2563eb', '#ff3cac'],
        ['#a855f7', '#ff3cac', '#00f5ff']
    ],
    matrix: [
        ['#6dff6d', '#16a34a', '#c8ff5e'],
        ['#9cff57', '#22c55e', '#39ffb6'],
        ['#d7ff4f', '#34d399', '#86efac']
    ],
    violet: [
        ['#c084fc', '#7c3aed', '#f0abfc'],
        ['#a78bfa', '#8b5cf6', '#e879f9'],
        ['#d8b4fe', '#6d28d9', '#c4b5fd']
    ],
    sunset: [
        ['#ff6b35', '#ef4444', '#ffb347'],
        ['#fb7185', '#f97316', '#fde047'],
        ['#ff4d6d', '#dc2626', '#fb923c']
    ],
    ice: [
        ['#67e8f9', '#2563eb', '#bae6fd'],
        ['#22d3ee', '#3b82f6', '#93c5fd'],
        ['#a5f3fc', '#0ea5e9', '#60a5fa']
    ],
    amber: [
        ['#fbbf24', '#d97706', '#fde68a'],
        ['#f59e0b', '#ea580c', '#fef08a'],
        ['#facc15', '#c2410c', '#fdba74']
    ]
};
export class GameUI {
    engine;
    audio = new GameAudio();
    clickButton = byId('click-button');
    coinCount = byId('coin-count');
    cpsCount = byId('cps-count');
    currentTime = byId('current-time');
    clickPower = byId('click-power');
    eventBanner = byId('event-banner');
    eventEmoji = byId('event-emoji');
    eventTitle = byId('event-title');
    eventDescription = byId('event-description');
    eventTimer = byId('event-timer');
    missionList = byId('mission-list');
    missionSummary = byId('mission-summary');
    storeGrid = byId('store-grid');
    discountPill = byId('discount-pill');
    achievementPreview = byId('achievement-preview');
    modalBackdrop = byId('modal-backdrop');
    modal = byId('modal-panel');
    modalContent = byId('modal-content');
    panelSources = byId('panel-sources');
    toastRegion = byId('toast-region');
    importFile = byId('import-file');
    comboConsole = byId('combo-console');
    imageLabButton = byId('image-lab-button');
    backgroundSettings = byId('background-settings');
    backgroundImageInput = byId('background-image-input');
    backgroundVideoInput = byId('background-video-input');
    deepUpgradeGrid = byId('deep-upgrade-grid');
    neonRushCard = byId('neon-rush-card');
    lastMissionSignature = '';
    lastStoreSignature = '';
    lastAchievementSignature = '__initial__';
    lastDeepSignature = '';
    lastBackgroundSignature = '';
    lastUiPalette = '';
    backgroundSyncSequence = 0;
    clickPaletteIndex = 0;
    clicksSincePaletteChange = 0;
    lastPaletteAt = 0;
    lastCoinAnimationAt = 0;
    coinAnimationFrame = 0;
    lastFocused = null;
    mountedPanel = null;
    featureCleanup = null;
    constructor(engine) {
        this.engine = engine;
        this.imageLabButton.hidden = false;
        this.bindEvents();
        this.updateClock();
        window.setInterval(() => {
            if (document.visibilityState === 'visible')
                this.updateClock();
        }, 1000);
        this.engine.onToast((message) => this.showToast(message));
        this.engine.subscribe((state, derived) => this.render(state, derived));
    }
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.dataset.tone = message.tone;
        toast.textContent = message.text;
        this.toastRegion.appendChild(toast);
        if (message.tone === 'success')
            this.audio.playSuccess(this.engine.state.soundEnabled);
        if (message.text.includes('Logro:'))
            this.flashBody('fx-achievement');
        else if (message.text.includes('Núcleo reiniciado'))
            this.flashBody('fx-deep-prestige');
        else if (message.text.includes('Prestigio'))
            this.flashBody('fx-prestige');
        window.setTimeout(() => {
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 190);
        }, 3000);
    }
    bindEvents() {
        this.clickButton.addEventListener('click', (event) => {
            event.preventDefault();
            const rect = this.clickButton.getBoundingClientRect();
            this.performClick(event.clientX || rect.left + rect.width / 2, event.clientY || rect.top + rect.height / 2);
        });
        document.addEventListener('keydown', (event) => {
            const target = event.target;
            const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
            if (event.code === 'Space' && !event.repeat && !isTyping && this.modalBackdrop.hidden) {
                event.preventDefault();
                const rect = this.clickButton.getBoundingClientRect();
                this.performClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
            if (event.key === 'Escape' && !this.modalBackdrop.hidden)
                this.closeModal();
        });
        byId('sound-toggle').addEventListener('click', () => this.engine.toggleSound());
        byId('help-button').addEventListener('click', () => this.openHelp());
        byId('achievements-button').addEventListener('click', () => this.openAchievements());
        byId('save-button').addEventListener('click', () => {
            saveState(this.engine.state);
            this.showToast({ text: '💾 Progreso guardado.', tone: 'success' });
        });
        byId('export-button').addEventListener('click', () => {
            void exportState(this.engine.state).catch(() => this.showToast({ text: 'No se pudo exportar la partida.', tone: 'danger' }));
        });
        byId('import-button').addEventListener('click', () => this.importFile.click());
        byId('reset-button').addEventListener('click', () => this.openResetConfirmation());
        byId('prestige-button').addEventListener('click', () => this.openPrestigeConfirmation());
        byId('deep-prestige-button').addEventListener('click', () => this.openDeepPrestigeConfirmation());
        byId('season-toggle').addEventListener('click', () => this.engine.toggleSeason());
        byId('modal-close').addEventListener('click', () => this.closeModal());
        this.imageLabButton.addEventListener('click', () => void this.openImageLab());
        this.backgroundSettings.addEventListener('click', (event) => void this.handleBackgroundAction(event));
        this.backgroundImageInput.addEventListener('change', () => void this.handleBackgroundFile('image'));
        this.backgroundVideoInput.addEventListener('change', () => void this.handleBackgroundFile('video'));
        document.querySelectorAll('[data-panel]').forEach((button) => {
            button.addEventListener('click', () => {
                const panel = button.dataset.panel;
                if (panel)
                    this.openPanel(panel);
            });
        });
        document.querySelectorAll('[data-minigame]').forEach((button) => {
            button.addEventListener('click', () => {
                const game = button.dataset.minigame;
                if (game === 'roulette')
                    this.openRoulette();
                if (game === 'slots')
                    this.openSlots();
                if (game === 'guess')
                    this.openGuess();
                if (game === 'neonRush')
                    void this.openNeonRush();
            });
        });
        this.modalBackdrop.addEventListener('pointerdown', (event) => {
            if (event.target === this.modalBackdrop)
                this.closeModal();
        });
        this.importFile.addEventListener('change', async () => {
            const file = this.importFile.files?.[0];
            if (!file)
                return;
            try {
                const state = await importState(file);
                this.engine.replaceState(state);
                this.showToast({ text: '📂 Partida importada correctamente.', tone: 'success' });
            }
            catch {
                this.showToast({ text: 'El archivo no contiene una partida válida.', tone: 'danger' });
            }
            finally {
                this.importFile.value = '';
            }
        });
        this.storeGrid.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const button = target.closest('[data-store-item]');
            const id = button?.dataset.storeItem;
            if (id)
                this.engine.purchase(id);
        });
        this.deepUpgradeGrid.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const button = target.closest('[data-deep-upgrade]');
            const id = button?.dataset.deepUpgrade;
            if (id)
                this.engine.purchaseDeepUpgrade(id);
        });
        this.missionList.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const button = target.closest('[data-mission-id]');
            if (button?.dataset.missionId)
                this.engine.claimMission(button.dataset.missionId);
        });
        this.modalContent.addEventListener('click', (event) => void this.handleModalAction(event));
    }
    render(state, derived) {
        byId('sound-toggle').classList.toggle('is-muted', !state.soundEnabled);
        this.renderCountUp(this.coinCount, state.coins);
        this.cpsCount.textContent = this.engine.format(derived.cps);
        this.clickPower.textContent = `+${this.engine.format(derived.clickPower)} por clic`;
        byId('prestige-level-mini').textContent = String(state.prestigeLevel);
        byId('prestige-level-hud').textContent = String(state.prestigeLevel);
        byId('total-clicks-hud').textContent = this.engine.format(state.manualClicks);
        byId('multiplier-hud').textContent = `x${(derived.prestigeBonus * derived.deepProductionMultiplier * derived.comboMultiplier).toFixed(2)}`;
        byId('quick-prestige-points').textContent = String(state.prestigePoints);
        byId('prestige-level').textContent = String(state.prestigeLevel);
        byId('prestige-points').textContent = String(state.prestigePoints);
        byId('prestige-bonus').textContent = `x${derived.prestigeBonus.toFixed(2)}`;
        byId('prestige-requirement').textContent = this.engine.prestigeGain > 0
            ? `+${this.engine.prestigeGain} puntos`
            : `${this.engine.format(this.engine.prestigeRequirement)} clics`;
        byId('prestige-button').disabled = this.engine.prestigeGain < 1;
        byId('daily-streak').textContent = String(state.daily.streak);
        byId('achievement-count-mini').textContent = String(state.unlockedAchievements.length);
        byId('achievement-total-mini').textContent = String(ACHIEVEMENTS.length);
        byId('lifetime-coins').textContent = this.engine.format(state.lifetimeCoins);
        byId('manual-clicks').textContent = this.engine.format(state.manualClicks);
        byId('highest-coins').textContent = this.engine.format(state.stats.highestCoins);
        byId('minigames-won').textContent = `${state.stats.minigamesWon}/${state.stats.minigamesPlayed}`;
        byId('critical-clicks').textContent = this.engine.format(state.stats.criticalClicks);
        byId('highest-combo').textContent = this.engine.format(state.stats.highestCombo);
        byId('passive-coins').textContent = this.engine.format(state.stats.passiveCoins);
        byId('play-time').textContent = formatDuration(state.playSeconds);
        this.comboConsole.hidden = state.combo < 2;
        byId('combo-value').textContent = `x${derived.comboMultiplier.toFixed(2)}`;
        byId('combo-count').textContent = `${state.combo}/${derived.comboLimit} golpes`;
        byId('combo-progress').style.width = `${Math.min(100, (state.combo / derived.comboLimit) * 100)}%`;
        this.renderDeepPrestige(state, derived);
        this.renderEvent(state);
        this.renderNextAchievement(state);
        this.renderMissions(state, derived);
        this.renderStore(state, derived);
        this.renderAchievementPreview(state);
        this.renderBackgroundControls(state);
    }
    renderDeepPrestige(state, derived) {
        byId('deep-prestige-level').textContent = String(state.deepPrestige.level);
        byId('deep-shards').textContent = String(state.deepPrestige.shards);
        byId('deep-bonus').textContent = `x${derived.deepProductionMultiplier.toFixed(2)}`;
        byId('deep-prestige-requirement').textContent = this.engine.deepPrestigeGain > 0
            ? `+${this.engine.deepPrestigeGain} fragmentos`
            : `Prestigio ${this.engine.deepPrestigeRequirement}`;
        byId('deep-prestige-button').disabled = this.engine.deepPrestigeGain < 1;
        const season = currentSeason();
        byId('season-name').textContent = `${season.emoji} ${season.name}`;
        byId('season-points').textContent = String(state.season.points);
        const seasonToggle = byId('season-toggle');
        seasonToggle.textContent = state.season.enabled ? 'Temporada activa' : 'Temporada pausada';
        seasonToggle.setAttribute('aria-pressed', String(state.season.enabled));
        this.neonRushCard.disabled = state.deepPrestige.level < 1;
        this.neonRushCard.dataset.locked = state.deepPrestige.level < 1 ? 'true' : 'false';
        const signature = JSON.stringify([state.deepPrestige.upgrades, state.deepPrestige.shards]);
        if (signature === this.lastDeepSignature)
            return;
        this.lastDeepSignature = signature;
        this.deepUpgradeGrid.innerHTML = DEEP_UPGRADES.map((upgrade) => {
            const level = state.deepPrestige.upgrades[upgrade.id];
            const maximum = level >= upgrade.maxLevel;
            const price = this.engine.getDeepUpgradePrice(upgrade.id);
            return `<article class="deep-upgrade-card">
        <span class="store-emoji" aria-hidden="true">${upgrade.emoji}</span>
        <div class="store-info"><strong>${escapeHtml(upgrade.name)}</strong><small>${escapeHtml(upgrade.description)}</small><span class="store-level">Nivel ${level}/${upgrade.maxLevel}</span></div>
        <button class="buy-button" type="button" data-deep-upgrade="${upgrade.id}" ${maximum || state.deepPrestige.shards < price ? 'disabled' : ''}>${maximum ? 'MAX' : `${price} 💠`}</button>
      </article>`;
        }).join('');
    }
    renderEvent(state) {
        const event = state.activeEvent;
        this.eventBanner.hidden = !event;
        if (!event)
            return;
        this.eventEmoji.textContent = event.emoji;
        this.eventTitle.textContent = event.title;
        this.eventDescription.textContent = event.description;
        const remaining = Math.max(0, Math.ceil((event.endsAt - Date.now()) / 1000));
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        this.eventTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    renderNextAchievement(state) {
        const clickAchievements = ACHIEVEMENTS
            .filter((achievement) => achievement.category === 'clicks' && !achievement.secret)
            .sort((first, second) => first.requirement - second.requirement);
        const next = clickAchievements.find((achievement) => achievement.requirement > state.manualClicks);
        const name = byId('next-achievement-name');
        const progress = byId('achievement-progress');
        const fill = byId('achievement-progress-fill');
        const value = byId('achievement-progress-value');
        const target = byId('achievement-progress-target');
        if (!next) {
            name.textContent = 'Colección de clics completada';
            fill.style.width = '100%';
            progress.setAttribute('aria-valuenow', '100');
            value.textContent = this.engine.format(state.manualClicks);
            target.textContent = 'Completado';
            return;
        }
        const previous = [...clickAchievements].reverse().find((achievement) => achievement.requirement <= state.manualClicks)?.requirement ?? 0;
        const percentage = Math.min(100, Math.max(0, ((state.manualClicks - previous) / (next.requirement - previous)) * 100));
        name.innerHTML = `${achievementIconMarkup(next.category, false, 'achievement-inline-icon')}<span>${escapeHtml(next.name)}</span>`;
        fill.style.width = `${percentage}%`;
        progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
        value.textContent = this.engine.format(state.manualClicks);
        target.textContent = this.engine.format(next.requirement);
    }
    renderMissions(state, derived) {
        const signature = JSON.stringify([state.daily.missions.map((mission) => [mission.id, Math.floor(mission.progress), mission.claimed]), derived.missionRewardMultiplier]);
        if (signature === this.lastMissionSignature)
            return;
        this.lastMissionSignature = signature;
        const completed = state.daily.missions.filter((mission) => mission.claimed).length;
        const summary = `${completed}/${state.daily.missions.length}`;
        this.missionSummary.textContent = summary;
        byId('sidebar-mission-badge').textContent = summary;
        this.missionList.innerHTML = state.daily.missions.map((mission) => {
            const percentage = Math.min(100, (mission.progress / mission.target) * 100);
            const ready = mission.progress >= mission.target;
            const reward = Math.max(1, Math.floor(mission.reward * derived.missionRewardMultiplier));
            const buttonText = mission.claimed ? 'Listo' : ready ? 'Reclamar' : `${this.engine.format(reward)} 🪙`;
            return `<article class="mission-card${ready ? ' is-complete' : ''}">
        <span class="mission-emoji" aria-hidden="true">${mission.emoji}</span>
        <div class="mission-info"><strong>${escapeHtml(mission.title)}</strong><small>${escapeHtml(mission.description)}</small>
          <div class="mission-progress-row"><div class="progress-track"><span style="width:${percentage}%"></span></div><span>${this.engine.format(mission.progress)}/${this.engine.format(mission.target)}</span></div>
        </div>
        <button class="claim-button${mission.claimed ? ' is-claimed' : ''}" type="button" data-mission-id="${mission.id}" ${mission.claimed || !ready ? 'disabled' : ''}>${buttonText}</button>
      </article>`;
        }).join('');
    }
    renderStore(state, derived) {
        const signature = JSON.stringify([state.upgrades, derived.storeDiscount, state.turboUntil > Date.now(), state.prestigePoints]);
        if (signature === this.lastStoreSignature)
            return;
        this.lastStoreSignature = signature;
        this.discountPill.hidden = derived.storeDiscount === 0;
        const upgrades = UPGRADES.map((item) => {
            const level = state.upgrades[item.id];
            const maximum = item.maxLevel !== undefined && level >= item.maxLevel;
            const price = this.engine.getUpgradePrice(item.id);
            return `<article class="store-card"><span class="store-emoji" aria-hidden="true">${item.emoji}</span>
        <div class="store-info"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><span class="store-level">Nivel ${level}${item.maxLevel !== undefined ? `/${item.maxLevel}` : ''}</span></div>
        <button class="buy-button" type="button" data-store-item="${item.id}" ${maximum || state.coins < price ? 'disabled' : ''}>${maximum ? 'MAX' : `${this.engine.format(price)} 🪙`}</button></article>`;
        });
        const consumables = CONSUMABLES.map((item) => {
            const available = item.currency === 'coins' ? state.coins >= item.price : state.prestigePoints >= item.price;
            const currency = item.currency === 'coins' ? '🪙' : '💎';
            return `<article class="store-card store-consumable"><span class="store-emoji" aria-hidden="true">${item.emoji}</span>
        <div class="store-info"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><span class="store-level">Consumible</span></div>
        <button class="buy-button" type="button" data-store-item="${item.id}" ${available ? '' : 'disabled'}>${this.engine.format(item.price)} ${currency}</button></article>`;
        });
        this.storeGrid.innerHTML = [...upgrades, ...consumables].join('');
    }
    renderAchievementPreview(state) {
        const signature = state.unlockedAchievements.join('|');
        if (signature === this.lastAchievementSignature)
            return;
        this.lastAchievementSignature = signature;
        const unlocked = ACHIEVEMENTS.filter((achievement) => state.unlockedAchievements.includes(achievement.id));
        const locked = ACHIEVEMENTS.filter((achievement) => !state.unlockedAchievements.includes(achievement.id) && !achievement.secret);
        const preview = [...unlocked.slice(-5).reverse(), ...locked].slice(0, 5);
        this.achievementPreview.innerHTML = preview.map((achievement) => this.achievementMarkup(achievement, state.unlockedAchievements.includes(achievement.id))).join('');
    }
    achievementMarkup(achievement, unlocked) {
        const hidden = achievement.secret && !unlocked;
        return `<article class="achievement-card${unlocked ? '' : ' is-locked'}" data-rarity="${achievement.rarity}">
      ${achievementIconMarkup(achievement.category, hidden || !unlocked, 'achievement-icon')}
      <strong>${hidden ? 'Logro secreto' : escapeHtml(achievement.name)}</strong>
      <small>${unlocked ? RARITY_LABELS[achievement.rarity] : hidden ? 'Requisito oculto' : this.engine.format(achievement.requirement)}</small>
    </article>`;
    }
    performClick(x, y) {
        const result = this.engine.click();
        this.maybeRotateClickPalette();
        this.audio.playClick(this.engine.state.soundEnabled, result.critical);
        spawnClickParticle(x, y, `+${this.engine.format(result.amount)}`, result.critical);
        this.clickButton.classList.remove('is-clicking', 'is-critical', 'is-combo-flash');
        requestAnimationFrame(() => {
            this.clickButton.classList.add('is-clicking');
            if (result.critical)
                this.clickButton.classList.add('is-critical');
            if (result.combo >= 10 && result.combo % 10 === 0)
                this.clickButton.classList.add('is-combo-flash');
            window.setTimeout(() => this.clickButton.classList.remove('is-clicking', 'is-critical', 'is-combo-flash'), 160);
        });
    }
    renderCountUp(element, value) {
        const formatted = this.engine.format(value);
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            element.textContent = formatted;
            element.dataset.numericValue = String(value);
            return;
        }
        const previous = Number(element.dataset.numericValue ?? value);
        element.dataset.numericValue = String(value);
        const now = performance.now();
        if (!Number.isFinite(previous) || previous === value || now - this.lastCoinAnimationAt < 450) {
            element.textContent = formatted;
            return;
        }
        this.lastCoinAnimationAt = now;
        if (this.coinAnimationFrame)
            cancelAnimationFrame(this.coinAnimationFrame);
        const startedAt = performance.now();
        const duration = 180;
        const animate = (time) => {
            const progress = Math.min(1, (time - startedAt) / duration);
            const eased = 1 - (1 - progress) ** 3;
            element.textContent = this.engine.format(previous + (value - previous) * eased);
            element.classList.toggle('is-number-updating', progress < 1);
            if (progress < 1)
                this.coinAnimationFrame = requestAnimationFrame(animate);
            else
                element.textContent = formatted;
        };
        this.coinAnimationFrame = requestAnimationFrame(animate);
    }
    applyClickPalette(index = this.clickPaletteIndex) {
        const palettes = CLICK_PALETTES[this.engine.state.background.palette];
        const [primary, secondary, ring] = palettes[index] ?? palettes[0];
        const machine = this.clickButton.closest('.click-machine');
        if (!machine)
            return;
        machine.style.setProperty('--click-accent', primary);
        machine.style.setProperty('--click-accent-2', secondary);
        machine.style.setProperty('--click-ring', ring);
    }
    maybeRotateClickPalette() {
        this.clicksSincePaletteChange += 1;
        const now = performance.now();
        if (this.clicksSincePaletteChange < 4 || now - this.lastPaletteAt < 900)
            return;
        this.clicksSincePaletteChange = 0;
        this.lastPaletteAt = now;
        const palettes = CLICK_PALETTES[this.engine.state.background.palette];
        let next = this.clickPaletteIndex;
        while (next === this.clickPaletteIndex && palettes.length > 1)
            next = Math.floor(Math.random() * palettes.length);
        this.clickPaletteIndex = next;
        this.applyClickPalette(next);
    }
    renderBackgroundControls(state) {
        document.body.dataset.uiPalette = state.background.palette;
        this.backgroundSettings.querySelectorAll('[data-ui-palette]').forEach((button) => {
            const selected = button.dataset.uiPalette === state.background.palette;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        if (this.lastUiPalette !== state.background.palette) {
            this.lastUiPalette = state.background.palette;
            this.clickPaletteIndex = 0;
            this.applyClickPalette(0);
        }
        const imageUnlocked = state.manualClicks >= 1000;
        const videoUnlocked = state.manualClicks >= 5000;
        const imageRemaining = Math.max(0, 1000 - state.manualClicks);
        const videoRemaining = Math.max(0, 5000 - state.manualClicks);
        const imageStatus = byId('background-image-status');
        const videoStatus = byId('background-video-status');
        imageStatus.textContent = imageUnlocked ? 'Desbloqueado' : `Faltan ${this.engine.format(imageRemaining)} clics`;
        videoStatus.textContent = videoUnlocked ? 'Desbloqueado' : `Faltan ${this.engine.format(videoRemaining)} clics`;
        this.backgroundSettings.querySelectorAll('[data-background-preset], [data-background-action="upload-image"]').forEach((button) => {
            button.disabled = !imageUnlocked;
        });
        this.backgroundSettings.querySelectorAll('[data-background-action="upload-video"]').forEach((button) => {
            button.disabled = !videoUnlocked;
        });
        const pauseButton = this.backgroundSettings.querySelector('[data-background-action="toggle-video"]');
        if (pauseButton) {
            pauseButton.disabled = state.background.mode !== 'customVideo';
            pauseButton.textContent = state.background.videoPaused ? 'Reproducir video' : 'Pausar video';
        }
        this.backgroundSettings.querySelectorAll('[data-background-preset]').forEach((button) => {
            button.classList.toggle('is-selected', state.background.mode === 'preset' && button.dataset.backgroundPreset === state.background.preset);
        });
        const signature = JSON.stringify(state.background);
        if (signature === this.lastBackgroundSignature)
            return;
        this.lastBackgroundSignature = signature;
        void this.syncBackgroundVisual();
    }
    async syncBackgroundVisual() {
        const sequence = ++this.backgroundSyncSequence;
        try {
            const feature = await import('../features/backgrounds.js');
            if (sequence !== this.backgroundSyncSequence)
                return;
            await feature.applyBackground(this.engine.state.background);
        }
        catch {
            if (sequence === this.backgroundSyncSequence)
                this.showToast({ text: 'No se pudo aplicar el fondo local.', tone: 'warning' });
        }
    }
    async handleBackgroundAction(event) {
        const target = event.target;
        if (!(target instanceof Element))
            return;
        const button = target.closest('[data-background-action], [data-background-preset], [data-ui-palette]');
        if (!button)
            return;
        const palette = button.dataset.uiPalette;
        if (palette) {
            this.engine.updateBackground({ palette });
            saveState(this.engine.state);
            this.showToast({ text: `Paleta ${palette === 'arcade' ? 'Arcade' : palette === 'matrix' ? 'Matrix' : palette === 'violet' ? 'Violeta' : palette === 'sunset' ? 'Sunset' : palette === 'ice' ? 'Ice' : 'Ámbar'} aplicada.`, tone: 'info' });
            return;
        }
        const preset = button.dataset.backgroundPreset;
        if (preset) {
            if (this.engine.state.manualClicks < 1000)
                return;
            this.engine.updateBackground({ mode: 'preset', preset, videoPaused: true });
            saveState(this.engine.state);
            this.showToast({ text: 'Fondo prediseñado aplicado.', tone: 'success' });
            return;
        }
        const action = button.dataset.backgroundAction;
        if (action === 'upload-image') {
            if (this.engine.state.manualClicks >= 1000)
                this.backgroundImageInput.click();
            return;
        }
        if (action === 'upload-video') {
            if (this.engine.state.manualClicks >= 5000)
                this.backgroundVideoInput.click();
            return;
        }
        if (action === 'toggle-video') {
            if (this.engine.state.background.mode !== 'customVideo')
                return;
            this.engine.updateBackground({ videoPaused: !this.engine.state.background.videoPaused });
            saveState(this.engine.state);
            return;
        }
        if (action === 'remove') {
            this.engine.updateBackground({ mode: 'default', videoPaused: true });
            saveState(this.engine.state);
            this.showToast({ text: 'Fondo personalizado desactivado.', tone: 'info' });
        }
    }
    async handleBackgroundFile(kind) {
        const input = kind === 'image' ? this.backgroundImageInput : this.backgroundVideoInput;
        const file = input.files?.[0];
        input.value = '';
        if (!file)
            return;
        const requiredClicks = kind === 'image' ? 1000 : 5000;
        if (this.engine.state.manualClicks < requiredClicks)
            return;
        try {
            const feature = await import('../features/backgrounds.js');
            await feature.saveBackgroundFile(kind, file);
            const compact = window.matchMedia?.('(max-width: 767px)').matches ?? false;
            this.engine.updateBackground({
                mode: kind === 'image' ? 'customImage' : 'customVideo',
                videoPaused: kind === 'video' ? compact : true
            });
            saveState(this.engine.state);
            this.showToast({ text: kind === 'image' ? 'Imagen de fondo guardada localmente.' : 'Video de fondo guardado localmente.', tone: 'success' });
        }
        catch (error) {
            this.showToast({ text: error instanceof Error ? error.message : 'No se pudo guardar el fondo.', tone: 'danger' });
        }
    }
    updateClock() {
        this.currentTime.textContent = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    }
    openPanel(name) {
        const panel = document.getElementById(`panel-${name}`);
        if (!panel)
            return;
        this.prepareModal();
        this.modalContent.innerHTML = '';
        this.mountedPanel = panel;
        this.modalContent.appendChild(panel);
        this.modal.classList.toggle('modal-wide', name === 'store' || name === 'stats' || name === 'achievements' || name === 'prestige');
        this.showModal();
    }
    restoreMountedPanel() {
        if (!this.mountedPanel)
            return;
        this.panelSources.appendChild(this.mountedPanel);
        this.mountedPanel = null;
    }
    openModal(markup, wide = false) {
        this.prepareModal();
        this.modalContent.innerHTML = markup;
        this.modal.classList.toggle('modal-wide', wide);
        this.showModal();
    }
    prepareModal() {
        if (this.modalBackdrop.hidden)
            this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.cleanupFeature();
        this.restoreMountedPanel();
    }
    showModal() {
        this.modalBackdrop.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => this.modal.querySelector('button, input, [tabindex="0"]')?.focus());
    }
    closeModal() {
        this.cleanupFeature();
        this.restoreMountedPanel();
        this.modalBackdrop.hidden = true;
        document.body.style.overflow = '';
        this.modalContent.innerHTML = '';
        this.lastFocused?.focus();
    }
    cleanupFeature() {
        this.featureCleanup?.();
        this.featureCleanup = null;
    }
    openHelp() {
        this.openModal(`<span class="eyebrow">GUÍA RÁPIDA</span>
      <h2 id="modal-title">Cómo jugar CLICK!</h2>
      <p>El progreso se guarda en este navegador. Image Lab también funciona de forma local y no solicita cuentas ni datos de servicios externos.</p>
      <ul class="help-list">
        <li><span>🖱️</span><div><strong>Genera monedas</strong><small>Pulsa el botón central o la barra espaciadora. Los críticos valen cinco veces más.</small></div></li>
        <li><span>🛒</span><div><strong>Compra mejoras</strong><small>Aumenta el valor de cada clic y automatiza la producción.</small></div></li>
        <li><span>📋</span><div><strong>Completa misiones</strong><small>Tres tareas diarias entregan recompensas sin competir con los eventos.</small></div></li>
        <li><span>🌟</span><div><strong>Reinicia para crecer</strong><small>El prestigio normal y el núcleo profundo ofrecen bonificaciones permanentes.</small></div></li>
        <li><span>🕹️</span><div><strong>Juega en el arcade</strong><small>Neon Rush aparece al conseguir tu primer nivel de núcleo.</small></div></li>
      </ul>
      <div class="modal-actions"><button class="primary-button" type="button" data-modal-action="close"><span>Entendido</span></button></div>`);
    }
    openAchievements(filter = 'all') {
        const filtered = ACHIEVEMENTS.filter((achievement) => this.achievementMatchesFilter(achievement, filter));
        const cards = filtered.map((achievement) => this.achievementMarkup(achievement, this.engine.state.unlockedAchievements.includes(achievement.id))).join('');
        const tabs = [
            ['all', 'Todos'], ['clicks', 'Clics'], ['production', 'Producción'], ['prestige', 'Reinicios'], ['arcade', 'Arcade'], ['daily', 'Diarios'], ['other', 'Otros']
        ];
        this.openModal(`<span class="eyebrow">COLECCIÓN COMPLETA</span>
      <h2 id="modal-title">${ACHIEVEMENTS.length} logros</h2>
      <p>Desbloqueados: ${this.engine.state.unlockedAchievements.length} de ${ACHIEVEMENTS.length}.</p>
      <div class="achievement-tabs" role="tablist" aria-label="Categorías de logros">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === filter}" class="achievement-tab${id === filter ? ' is-active' : ''}" data-modal-action="achievement-filter-${id}">${label}</button>`).join('')}</div>
      <div class="achievement-modal-grid">${cards}</div>`, true);
    }
    achievementMatchesFilter(achievement, filter) {
        if (filter === 'all')
            return true;
        if (filter === 'clicks')
            return achievement.category === 'clicks';
        if (filter === 'production')
            return ['cps', 'autoClickers', 'multiplier'].includes(achievement.category);
        if (filter === 'prestige')
            return achievement.category === 'prestige' || achievement.category === 'deepPrestige';
        if (filter === 'arcade')
            return achievement.category === 'minigames';
        if (filter === 'daily')
            return ['missions', 'events', 'seasons'].includes(achievement.category);
        return ['time', 'shop', 'secret'].includes(achievement.category);
    }
    openResetConfirmation() {
        this.openModal(`<span class="eyebrow">ZONA DE RIESGO</span><h2 id="modal-title">Reiniciar partida</h2>
      <p>Esto borrará el progreso guardado en este navegador. Exporta una copia antes si quieres conservarla.</p>
      <div class="modal-actions"><button class="secondary-button" type="button" data-modal-action="close">Cancelar</button><button class="danger-button" type="button" data-modal-action="confirm-reset">Reiniciar</button></div>`);
    }
    openPrestigeConfirmation() {
        const gain = this.engine.prestigeGain;
        if (gain < 1)
            return;
        this.openModal(`<span class="eyebrow">ASCENSIÓN</span><h2 id="modal-title">Confirmar prestigio</h2>
      <p>Recibirás <strong>${gain} puntos de prestigio</strong>. Tus monedas y mejoras volverán a cero, pero conservarás logros, estadísticas y progreso profundo.</p>
      <div class="modal-actions"><button class="secondary-button" type="button" data-modal-action="close">Cancelar</button><button class="primary-button" type="button" data-modal-action="confirm-prestige"><span>Prestigiar ahora</span></button></div>`);
    }
    openDeepPrestigeConfirmation() {
        const gain = this.engine.deepPrestigeGain;
        if (gain < 1)
            return;
        this.openModal(`<span class="eyebrow">NÚCLEO PROFUNDO</span><h2 id="modal-title">Reiniciar el núcleo</h2>
      <p>Recibirás <strong>${gain} fragment${gain === 1 ? 'o' : 'os'} 💠</strong>. Se reiniciarán prestigio normal, monedas y mejoras base. Conservarás fragmentos, mejoras profundas, logros y estadísticas.</p>
      <div class="modal-actions"><button class="secondary-button" type="button" data-modal-action="close">Cancelar</button><button class="primary-button" type="button" data-modal-action="confirm-deep-prestige"><span>Reiniciar núcleo</span></button></div>`);
    }
    openRoulette() {
        this.openModal(`<span class="eyebrow">MINIJUEGO</span><h2 id="modal-title">🎡 Ruleta neón</h2><p>Cuesta 100 monedas. Elige un color.</p>
      <div class="modal-actions minigame-actions"><button class="secondary-button" type="button" data-modal-action="roulette-red">🔴 Rojo</button><button class="secondary-button" type="button" data-modal-action="roulette-black">⚫ Negro</button><button class="secondary-button" type="button" data-modal-action="roulette-green">🟢 Verde</button></div>`);
    }
    openSlots() {
        this.openModal(`<span class="eyebrow">MINIJUEGO</span><h2 id="modal-title">🎰 Pixel slots</h2><p>Cuesta 75 monedas. Tres símbolos iguales dan el mejor premio.</p>
      <div class="modal-actions"><button class="secondary-button" type="button" data-modal-action="close">Cancelar</button><button class="primary-button" type="button" data-modal-action="slots-spin">Girar</button></div>`);
    }
    openGuess() {
        this.openModal(`<span class="eyebrow">MINIJUEGO</span><h2 id="modal-title">🔢 Código secreto</h2><p>Cuesta 50 monedas. Elige un número del 1 al 10.</p>
      <label class="field-label" for="guess-input">Tu número</label><input class="game-input" id="guess-input" type="number" min="1" max="10" value="5" inputmode="numeric">
      <div class="modal-actions"><button class="secondary-button" type="button" data-modal-action="close">Cancelar</button><button class="primary-button" type="button" data-modal-action="guess-play">Jugar</button></div>`);
    }
    async openImageLab() {
        this.openModal(`<span class="eyebrow">CARGANDO MÓDULO LOCAL</span><h2 id="modal-title">Image Lab</h2><p>Preparando la herramienta...</p>`, true);
        try {
            const feature = await import('../features/image-lab.js');
            this.openModal(feature.imageLabMarkup(), true);
            this.featureCleanup = feature.mountImageLab(this.modalContent);
        }
        catch {
            this.openModal(`<span class="eyebrow">IMAGE LAB</span><h2 id="modal-title">No disponible</h2><p>No se pudo cargar el módulo local. Recarga la página e inténtalo de nuevo.</p><div class="modal-actions"><button class="primary-button" type="button" data-modal-action="close">Cerrar</button></div>`);
        }
    }
    async openNeonRush() {
        if (this.engine.state.deepPrestige.level < 1) {
            this.showToast({ text: '💠 Neon Rush se desbloquea con el primer reinicio de núcleo.', tone: 'warning' });
            return;
        }
        this.openModal(`<span class="eyebrow">CARGANDO BONUS STAGE</span><h2 id="modal-title">Neon Rush</h2><p>Preparando la arena...</p>`, true);
        try {
            const feature = await import('../features/neon-rush.js');
            this.openModal(feature.neonRushMarkup(), true);
            this.featureCleanup = feature.mountNeonRush(this.modalContent, (score) => {
                const reward = this.engine.completeNeonRush(score);
                this.showMinigameResult(`✦ ${score} puntos`, `Premio: ${this.engine.format(reward)} monedas`);
            });
        }
        catch {
            this.showToast({ text: 'No se pudo cargar Neon Rush.', tone: 'danger' });
            this.closeModal();
        }
    }
    async handleModalAction(event) {
        const target = event.target;
        if (!(target instanceof Element))
            return;
        const button = target.closest('[data-modal-action]');
        const action = button?.dataset.modalAction;
        if (!action)
            return;
        if (action === 'close')
            this.closeModal();
        if (action.startsWith('achievement-filter-'))
            this.openAchievements(action.replace('achievement-filter-', ''));
        if (action === 'confirm-reset') {
            clearState();
            this.engine.reset();
            saveState(this.engine.state);
            this.closeModal();
            this.showToast({ text: 'Partida reiniciada.', tone: 'info' });
        }
        if (action === 'confirm-prestige') {
            this.engine.prestige();
            this.closeModal();
        }
        if (action === 'confirm-deep-prestige') {
            this.engine.deepPrestige();
            this.closeModal();
        }
        if (action.startsWith('roulette-')) {
            const choice = action.replace('roulette-', '');
            const result = this.engine.playRoulette(choice);
            if (!result)
                return;
            const colorEmoji = result.color === 'red' ? '🔴' : result.color === 'black' ? '⚫' : '🟢';
            this.showMinigameResult(`${colorEmoji} ${result.number}`, result.reward > 0 ? `Ganaste ${this.engine.format(result.reward)} monedas` : 'No hubo premio');
        }
        if (action === 'slots-spin') {
            const result = this.engine.playSlots();
            if (!result)
                return;
            this.showMinigameResult(result.symbols.join(' '), result.reward > 0 ? `Ganaste ${this.engine.format(result.reward)} monedas` : 'No hubo premio');
        }
        if (action === 'guess-play') {
            const input = this.modalContent.querySelector('#guess-input');
            const result = this.engine.playGuess(Number(input?.value));
            if (!result)
                return;
            this.showMinigameResult(`🔢 ${result.answer}`, result.reward > 0 ? `Acertaste: +${this.engine.format(result.reward)} monedas` : 'No acertaste esta vez');
        }
    }
    showMinigameResult(symbol, message) {
        this.openModal(`<span class="eyebrow">RESULTADO</span><h2 id="modal-title">Partida finalizada</h2>
      <div class="modal-result"><span class="result-emoji">${symbol}</span><strong>${escapeHtml(message)}</strong></div>
      <div class="modal-actions"><button class="primary-button" type="button" data-modal-action="close"><span>Continuar</span></button></div>`);
    }
    flashBody(className) {
        document.body.classList.remove(className);
        requestAnimationFrame(() => {
            document.body.classList.add(className);
            window.setTimeout(() => document.body.classList.remove(className), 650);
        });
    }
}
