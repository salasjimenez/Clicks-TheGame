import { ACHIEVEMENTS, RARITY_LABELS } from '../data/achievements.js';
import { CONSUMABLES, UPGRADES } from '../data/store.js';
import { GameAudio } from '../game/audio.js';
import { clearState, exportState, importState, saveState } from '../game/storage.js';
import { byId, escapeHtml, formatDuration } from './dom.js';
import { spawnClickParticle } from './particles.js';
const REPOSITORY_URL = 'https://github.com/sjhonn/Clicks_TheGame';
const REPOSITORY_API = 'https://api.github.com/repos/sjhonn/Clicks_TheGame';
const IMAGE_LAB_KEY = 'clicksTheGameImageLab';
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
    terminalPreview = byId('achievement-terminal-preview');
    toastRegion = byId('toast-region');
    importFile = byId('import-file');
    comboConsole = byId('combo-console');
    imageLabButton = byId('image-lab-button');
    starGateButton = byId('star-gate-button');
    imageLabFile = null;
    imageLabFormat = 'image/png';
    imagePreviewUrl = '';
    lastMissionSignature = '';
    lastStoreSignature = '';
    lastAchievementSignature = '__initial__';
    lastFocused = null;
    mountedPanel = null;
    constructor(engine) {
        this.engine = engine;
        this.bindEvents();
        this.updateClock();
        this.syncEasterEgg();
        void this.updateGitHubStars();
        window.setInterval(() => this.updateClock(), 1000);
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
        window.setTimeout(() => {
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 190);
        }, 3000);
    }
    bindEvents() {
        this.clickButton.addEventListener('click', (event) => {
            event.preventDefault();
            const rect = this.clickButton.getBoundingClientRect();
            const x = event.clientX || rect.left + rect.width / 2;
            const y = event.clientY || rect.top + rect.height / 2;
            this.performClick(x, y);
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
        byId('theme-toggle').addEventListener('click', () => this.engine.toggleTheme());
        byId('sound-toggle').addEventListener('click', () => this.engine.toggleSound());
        byId('help-button').addEventListener('click', () => this.openHelp());
        byId('achievements-button').addEventListener('click', () => this.openAchievements());
        byId('save-button').addEventListener('click', () => {
            saveState(this.engine.state);
            this.showToast({ text: '💾 Progreso guardado.', tone: 'success' });
        });
        byId('export-button').addEventListener('click', () => exportState(this.engine.state));
        byId('import-button').addEventListener('click', () => this.importFile.click());
        byId('reset-button').addEventListener('click', () => this.openResetConfirmation());
        byId('prestige-button').addEventListener('click', () => this.openPrestigeConfirmation());
        byId('modal-close').addEventListener('click', () => this.closeModal());
        this.starGateButton.addEventListener('click', () => this.openStarGate());
        this.imageLabButton.addEventListener('click', () => this.openImageLab());
        document.querySelectorAll('[data-panel]').forEach((button) => {
            button.addEventListener('click', () => {
                const panel = button.dataset.panel;
                if (panel)
                    this.openPanel(panel);
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
        this.missionList.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const button = target.closest('[data-mission-id]');
            if (button?.dataset.missionId)
                this.engine.claimMission(button.dataset.missionId);
        });
        document.querySelectorAll('[data-minigame]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.minigame === 'roulette')
                    this.openRoulette();
                if (button.dataset.minigame === 'slots')
                    this.openSlots();
                if (button.dataset.minigame === 'guess')
                    this.openGuess();
            });
        });
        this.modalContent.addEventListener('click', (event) => void this.handleModalAction(event));
        this.modalContent.addEventListener('change', (event) => void this.handleModalChange(event));
    }
    render(state, derived) {
        document.documentElement.dataset.theme = state.theme;
        byId('sound-toggle').classList.toggle('is-muted', !state.soundEnabled);
        this.coinCount.textContent = this.engine.format(state.coins);
        this.cpsCount.textContent = this.engine.format(derived.cps);
        this.clickPower.textContent = `+${this.engine.format(derived.clickPower)} por clic`;
        byId('prestige-level-mini').textContent = String(state.prestigeLevel);
        byId('prestige-level-hud').textContent = String(state.prestigeLevel);
        byId('total-clicks-hud').textContent = this.engine.format(state.manualClicks);
        byId('multiplier-hud').textContent = `x${(derived.prestigeBonus * derived.comboMultiplier).toFixed(2)}`;
        byId('quick-prestige-points').textContent = String(state.prestigePoints);
        byId('achievement-count-mini').textContent = String(state.unlockedAchievements.length);
        byId('terminal-achievement-count').textContent = String(state.unlockedAchievements.length);
        byId('daily-streak').textContent = String(state.daily.streak);
        byId('prestige-level').textContent = String(state.prestigeLevel);
        byId('prestige-points').textContent = String(state.prestigePoints);
        byId('prestige-bonus').textContent = `x${derived.prestigeBonus.toFixed(2)}`;
        byId('prestige-requirement').textContent = `${this.engine.format(this.engine.prestigeRequirement)} clics`;
        const prestigeButton = byId('prestige-button');
        prestigeButton.disabled = this.engine.prestigeGain < 1;
        prestigeButton.title = this.engine.prestigeGain > 0 ? `Recibirás ${this.engine.prestigeGain} puntos` : 'Aún no alcanzas el requisito';
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
        this.renderEvent(state);
        this.renderNextAchievement(state);
        this.renderMissions(state);
        this.renderStore(state, derived);
        this.renderAchievementPreview(state);
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
        this.eventTimer.textContent = `00:${String(remaining).padStart(2, '0')}`;
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
        name.textContent = `${next.emoji} ${next.name}`;
        fill.style.width = `${percentage}%`;
        progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
        value.textContent = this.engine.format(state.manualClicks);
        target.textContent = this.engine.format(next.requirement);
    }
    renderMissions(state) {
        const signature = JSON.stringify(state.daily.missions.map((mission) => [mission.id, Math.floor(mission.progress), mission.claimed]));
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
            const buttonText = mission.claimed ? 'Listo' : ready ? 'Reclamar' : `${this.engine.format(mission.reward)} 🪙`;
            return `<article class="mission-card${ready ? ' is-complete' : ''}">
        <span class="mission-emoji" aria-hidden="true">${mission.emoji}</span>
        <div class="mission-info">
          <strong>${escapeHtml(mission.title)}</strong>
          <small>${escapeHtml(mission.description)}</small>
          <div class="mission-progress-row">
            <div class="progress-track"><span style="width:${percentage}%"></span></div>
            <span>${this.engine.format(mission.progress)}/${this.engine.format(mission.target)}</span>
          </div>
        </div>
        <button class="claim-button${mission.claimed ? ' is-claimed' : ''}" type="button" data-mission-id="${mission.id}" ${mission.claimed || !ready ? 'disabled' : ''}>${buttonText}</button>
      </article>`;
        }).join('');
    }
    renderStore(state, derived) {
        const signature = JSON.stringify([state.upgrades, derived.storeDiscount, state.turboUntil > Date.now()]);
        if (signature === this.lastStoreSignature)
            return;
        this.lastStoreSignature = signature;
        this.discountPill.hidden = derived.storeDiscount === 0;
        const upgrades = UPGRADES.map((item) => {
            const level = state.upgrades[item.id];
            const maximum = item.maxLevel !== undefined && level >= item.maxLevel;
            const price = this.engine.getUpgradePrice(item.id);
            return `<article class="store-card">
        <span class="store-emoji" aria-hidden="true">${item.emoji}</span>
        <div class="store-info">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.description)}</small>
          <span class="store-level">Nivel ${level}${item.maxLevel !== undefined ? `/${item.maxLevel}` : ''}</span>
        </div>
        <button class="store-buy" type="button" data-store-item="${item.id}" ${maximum ? 'disabled' : ''}>
          <span>${maximum ? 'Nivel máximo' : 'Mejorar'}</span>
          <span class="store-price">${maximum ? '✓' : `${this.engine.format(price)} 🪙`}</span>
        </button>
      </article>`;
        }).join('');
        const consumables = CONSUMABLES.map((item) => {
            const active = item.id === 'timeBoost' && state.turboUntil > Date.now();
            const currency = item.currency === 'coins' ? '🪙' : '💎';
            return `<article class="store-card${item.currency === 'prestige' ? ' is-premium' : ''}">
        <span class="store-emoji" aria-hidden="true">${item.emoji}</span>
        <div class="store-info">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.description)}</small>
          <span class="store-level">${active ? 'Activo' : item.currency === 'prestige' ? 'Prestigio' : 'Consumible'}</span>
        </div>
        <button class="store-buy" type="button" data-store-item="${item.id}">
          <span>${active ? 'Extender' : 'Comprar'}</span>
          <span class="store-price">${this.engine.format(item.price)} ${currency}</span>
        </button>
      </article>`;
        }).join('');
        this.storeGrid.innerHTML = upgrades + consumables;
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
        this.terminalPreview.innerHTML = preview.slice(0, 4).map((achievement) => {
            const isUnlocked = state.unlockedAchievements.includes(achievement.id);
            return `<article class="terminal-achievement${isUnlocked ? '' : ' is-locked'}"><span>${isUnlocked ? achievement.emoji : '🔒'}</span><div><strong>${isUnlocked ? escapeHtml(achievement.name) : 'BLOQUEADO'}</strong><small>${isUnlocked ? RARITY_LABELS[achievement.rarity] : `${this.engine.format(achievement.requirement)} REQUERIDOS`}</small></div></article>`;
        }).join('');
    }
    achievementMarkup(achievement, unlocked) {
        const hidden = achievement.secret && !unlocked;
        return `<article class="achievement-card${unlocked ? '' : ' is-locked'}" data-rarity="${achievement.rarity}">
      <span class="achievement-emoji" aria-hidden="true">${hidden ? '🔒' : achievement.emoji}</span>
      <strong>${hidden ? 'Logro secreto' : escapeHtml(achievement.name)}</strong>
      <small>${unlocked ? RARITY_LABELS[achievement.rarity] : hidden ? 'Requisito oculto' : this.engine.format(achievement.requirement)}</small>
    </article>`;
    }
    performClick(x, y) {
        const result = this.engine.click();
        this.audio.playClick(this.engine.state.soundEnabled, result.critical);
        spawnClickParticle(x, y, `+${this.engine.format(result.amount)}`, result.critical);
        this.clickButton.classList.remove('is-clicking');
        requestAnimationFrame(() => {
            this.clickButton.classList.add('is-clicking');
            window.setTimeout(() => this.clickButton.classList.remove('is-clicking'), 110);
        });
    }
    updateClock() {
        this.currentTime.textContent = new Intl.DateTimeFormat('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date());
    }
    openPanel(name) {
        const panel = document.getElementById(`panel-${name}`);
        if (!panel)
            return;
        if (this.modalBackdrop.hidden)
            this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.restoreMountedPanel();
        this.modalContent.innerHTML = '';
        this.mountedPanel = panel;
        this.modalContent.appendChild(panel);
        this.modal.classList.toggle('modal-wide', name === 'store' || name === 'stats' || name === 'achievements');
        this.modalBackdrop.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => this.modal.querySelector('button, input, [tabindex="0"]')?.focus());
    }
    restoreMountedPanel() {
        if (!this.mountedPanel)
            return;
        this.panelSources.appendChild(this.mountedPanel);
        this.mountedPanel = null;
    }
    openModal(markup, wide = false) {
        if (this.modalBackdrop.hidden)
            this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.restoreMountedPanel();
        this.modalContent.innerHTML = markup;
        this.modal.classList.toggle('modal-wide', wide);
        this.modalBackdrop.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => this.modal.querySelector('button, input, [tabindex="0"]')?.focus());
    }
    closeModal() {
        this.restoreMountedPanel();
        this.modalBackdrop.hidden = true;
        document.body.style.overflow = '';
        this.modalContent.innerHTML = '';
        this.lastFocused?.focus();
    }
    openHelp() {
        this.openModal(`<span class="eyebrow">GUÍA RÁPIDA</span>
      <h2 id="modal-title">Cómo jugar CLICK!</h2>
      <p>El progreso se guarda en este navegador. También puedes exportar una copia JSON e importarla después.</p>
      <ul class="help-list">
        <li><span>🖱️</span><div><strong>Genera monedas</strong><small>Pulsa el botón central o la barra espaciadora. Los clics críticos valen cinco veces más.</small></div></li>
        <li><span>🛒</span><div><strong>Compra mejoras</strong><small>Aumenta el valor de cada clic, el CPS y la probabilidad crítica.</small></div></li>
        <li><span>📋</span><div><strong>Completa misiones</strong><small>Las tres tareas cambian cada día y entregan recompensas adicionales.</small></div></li>
        <li><span>🌟</span><div><strong>Usa el prestigio</strong><small>Reinicia la producción base para obtener una bonificación permanente.</small></div></li>
        <li><span>🔥</span><div><strong>Mantén el combo</strong><small>Haz clic rápidamente para aumentar temporalmente el valor de cada golpe.</small></div></li>
      </ul>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-modal-action="open-star-gate"><span>★</span> Secreto de GitHub</button>
        <button class="primary-button" type="button" data-modal-action="close"><span>Entendido</span></button>
      </div>`);
    }
    openAchievements() {
        const cards = ACHIEVEMENTS.map((achievement) => this.achievementMarkup(achievement, this.engine.state.unlockedAchievements.includes(achievement.id))).join('');
        this.openModal(`<span class="eyebrow">COLECCIÓN COMPLETA</span>
      <h2 id="modal-title">100 logros</h2>
      <p>Desbloqueados: ${this.engine.state.unlockedAchievements.length} de ${ACHIEVEMENTS.length}.</p>
      <div class="achievement-modal-grid">${cards}</div>`, true);
    }
    openRoulette() {
        this.openModal(`<span class="eyebrow">MINIJUEGO · 100 🪙</span>
      <h2 id="modal-title">Ruleta</h2>
      <p>Rojo y negro pagan x2. Verde paga x14.</p>
      <div class="modal-options">
        <button class="modal-option" type="button" data-modal-action="roulette-red"><span>🔴</span><strong>Rojo</strong><small>Números impares</small></button>
        <button class="modal-option" type="button" data-modal-action="roulette-black"><span>⚫</span><strong>Negro</strong><small>Números pares</small></button>
        <button class="modal-option" type="button" data-modal-action="roulette-green"><span>🟢</span><strong>Verde</strong><small>Solo el cero</small></button>
      </div>`);
    }
    openSlots() {
        this.openModal(`<span class="eyebrow">MINIJUEGO · 75 🪙</span>
      <h2 id="modal-title">Tragamonedas</h2>
      <p>Dos símbolos pagan x2. Tres iguales pagan x8 y tres sietes pagan x25.</p>
      <div class="modal-result"><span class="result-emoji">❔ ❔ ❔</span><strong>Listo para girar</strong></div>
      <div class="modal-actions"><button class="primary-button" type="button" data-modal-action="slots-spin"><span>Girar</span></button></div>`);
    }
    openGuess() {
        this.openModal(`<span class="eyebrow">MINIJUEGO · 50 🪙</span>
      <h2 id="modal-title">Adivina el número</h2>
      <p>Elige un número del 1 al 10. Un acierto paga x6.</p>
      <input class="guess-input" id="guess-input" type="number" min="1" max="10" inputmode="numeric" value="5" aria-label="Número elegido">
      <div class="modal-actions"><button class="primary-button" type="button" data-modal-action="guess-play"><span>Jugar</span></button></div>`);
    }
    openResetConfirmation() {
        this.openModal(`<span class="eyebrow">ACCIÓN IRREVERSIBLE</span>
      <h2 id="modal-title">Reiniciar partida</h2>
      <p>Se eliminarán monedas, mejoras, prestigio, estadísticas y logros guardados en este navegador.</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-modal-action="close">Cancelar</button>
        <button class="danger-button" type="button" data-modal-action="confirm-reset">Reiniciar todo</button>
      </div>`);
    }
    openPrestigeConfirmation() {
        const gain = this.engine.prestigeGain;
        if (gain < 1)
            return;
        this.openModal(`<span class="eyebrow">ASCENSIÓN</span>
      <h2 id="modal-title">Confirmar prestigio</h2>
      <p>Recibirás <strong>${gain} puntos de prestigio</strong>. Tus monedas y mejoras volverán a cero, pero conservarás logros y estadísticas.</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-modal-action="close">Cancelar</button>
        <button class="primary-button" type="button" data-modal-action="confirm-prestige"><span>Prestigiar ahora</span></button>
      </div>`);
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
        if (action === 'open-star-gate')
            this.openStarGate();
        if (action === 'open-image-lab')
            this.openImageLab();
        if (action === 'verify-star')
            await this.verifyStarFromModal(button);
        if (action.startsWith('image-format-'))
            this.selectImageFormat(action.replace('image-format-', ''));
        if (action === 'convert-image')
            await this.convertImage();
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
            const input = byId('guess-input');
            const result = this.engine.playGuess(Number(input.value));
            if (!result)
                return;
            this.showMinigameResult(`🔢 ${result.answer}`, result.reward > 0 ? `Acertaste: +${this.engine.format(result.reward)} monedas` : 'No acertaste esta vez');
        }
    }
    syncEasterEgg() {
        const unlocked = localStorage.getItem(IMAGE_LAB_KEY) === 'unlocked';
        this.imageLabButton.hidden = !unlocked;
        byId('github-star-label').textContent = unlocked ? 'IMAGE LAB UNLOCKED' : 'STAR REPOSITORY';
        this.starGateButton.classList.toggle('is-unlocked', unlocked);
    }
    async updateGitHubStars() {
        try {
            const response = await fetch(REPOSITORY_API, {
                headers: {
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            if (!response.ok)
                throw new Error(String(response.status));
            const repository = await response.json();
            byId('github-star-count').textContent = String(repository.stargazers_count ?? 0);
        }
        catch {
            byId('github-star-count').textContent = '★';
        }
    }
    openStarGate() {
        if (localStorage.getItem(IMAGE_LAB_KEY) === 'unlocked') {
            this.openImageLab();
            return;
        }
        this.openModal(`<span class="eyebrow">EASTER EGG · GITHUB</span>
      <h2 id="modal-title">Desbloquea Image Lab</h2>
      <p>Dale una estrella al repositorio, escribe tu usuario de GitHub y verifica. El desbloqueo se guarda solamente en este navegador.</p>
      <div class="star-gate-card">
        <a class="primary-button github-link-button" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer"><span>★</span> Abrir repositorio</a>
        <label class="field-label" for="github-username">Usuario de GitHub</label>
        <input class="github-input" id="github-username" type="text" maxlength="39" autocomplete="username" spellcheck="false" placeholder="ejemplo: sjhonn">
        <p class="verification-status" id="star-verification-status" aria-live="polite">La verificación usa la lista pública de estrellas del repositorio.</p>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-modal-action="close">Cancelar</button>
        <button class="primary-button" type="button" data-modal-action="verify-star"><span>Verificar estrella</span></button>
      </div>`);
    }
    async verifyStarFromModal(button) {
        const input = document.getElementById('github-username');
        const status = document.getElementById('star-verification-status');
        if (!(input instanceof HTMLInputElement) || !status)
            return;
        const username = input.value.trim();
        if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
            status.textContent = 'Escribe un usuario de GitHub válido.';
            status.dataset.tone = 'danger';
            return;
        }
        button.disabled = true;
        status.textContent = 'Consultando GitHub...';
        status.dataset.tone = 'info';
        try {
            const starred = await this.hasStarredRepository(username);
            if (!starred) {
                status.textContent = 'No se encontró la estrella. Confirma el usuario y vuelve a intentarlo.';
                status.dataset.tone = 'warning';
                return;
            }
            localStorage.setItem(IMAGE_LAB_KEY, 'unlocked');
            localStorage.setItem(`${IMAGE_LAB_KEY}User`, username);
            this.syncEasterEgg();
            this.showToast({ text: '★ Easter egg desbloqueado: Image Lab.', tone: 'success' });
            this.openImageLab();
        }
        catch {
            status.textContent = 'GitHub no respondió o se alcanzó el límite temporal. Inténtalo más tarde.';
            status.dataset.tone = 'danger';
        }
        finally {
            button.disabled = false;
        }
    }
    async hasStarredRepository(username) {
        for (let page = 1; page <= 10; page += 1) {
            const response = await fetch(`${REPOSITORY_API}/stargazers?per_page=100&page=${page}`, {
                headers: {
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            if (!response.ok)
                throw new Error(String(response.status));
            const users = await response.json();
            if (users.some((user) => user.login?.toLowerCase() === username.toLowerCase()))
                return true;
            if (users.length < 100)
                return false;
        }
        return false;
    }
    openImageLab() {
        if (localStorage.getItem(IMAGE_LAB_KEY) !== 'unlocked') {
            this.openStarGate();
            return;
        }
        this.imageLabFile = null;
        this.imageLabFormat = 'image/png';
        if (this.imagePreviewUrl)
            URL.revokeObjectURL(this.imagePreviewUrl);
        this.imagePreviewUrl = '';
        const user = escapeHtml(localStorage.getItem(`${IMAGE_LAB_KEY}User`) || 'PLAYER');
        this.openModal(`<span class="eyebrow">SECRET TOOL · ${user}</span>
      <h2 id="modal-title">Image Lab</h2>
      <p>Convierte imágenes en PNG, JPG o WebP directamente en el navegador. Ningún archivo se envía a un servidor.</p>
      <div class="image-lab">
        <label class="image-drop" for="image-source">
          <input id="image-source" type="file" accept="image/*" hidden>
          <span>🖼️</span>
          <strong>Seleccionar imagen</strong>
          <small>PNG, JPG, WebP, GIF, BMP, SVG y formatos admitidos por el navegador</small>
        </label>
        <div class="image-preview-shell" id="image-preview-shell" hidden>
          <img id="image-preview" alt="Vista previa de la imagen seleccionada">
          <div><strong id="image-file-name">Sin archivo</strong><small id="image-file-data">0 × 0</small></div>
        </div>
        <div class="format-selector" role="group" aria-label="Formato de salida">
          <button class="format-button is-active" type="button" data-modal-action="image-format-png">PNG</button>
          <button class="format-button" type="button" data-modal-action="image-format-jpeg">JPG</button>
          <button class="format-button" type="button" data-modal-action="image-format-webp">WEBP</button>
        </div>
        <label class="quality-control" for="image-quality"><span>Calidad JPG/WebP</span><output id="image-quality-value">92%</output><input id="image-quality" type="range" min="50" max="100" value="92"></label>
        <p class="verification-status" id="image-lab-status" aria-live="polite">Selecciona una imagen para comenzar.</p>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-modal-action="close">Cerrar</button>
        <button class="primary-button" type="button" data-modal-action="convert-image" disabled><span>Convertir y descargar</span></button>
      </div>`, true);
        const quality = document.getElementById('image-quality');
        quality?.addEventListener('input', () => {
            const value = quality instanceof HTMLInputElement ? quality.value : '92';
            const output = document.getElementById('image-quality-value');
            if (output)
                output.textContent = `${value}%`;
        });
    }
    async handleModalChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'image-source')
            return;
        const file = target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            this.setImageLabStatus('El archivo seleccionado no es una imagen válida.', 'danger');
            return;
        }
        this.imageLabFile = file;
        if (this.imagePreviewUrl)
            URL.revokeObjectURL(this.imagePreviewUrl);
        this.imagePreviewUrl = URL.createObjectURL(file);
        const preview = document.getElementById('image-preview');
        const shell = document.getElementById('image-preview-shell');
        if (!(preview instanceof HTMLImageElement) || !shell)
            return;
        preview.src = this.imagePreviewUrl;
        try {
            await preview.decode();
            shell.hidden = false;
            const name = document.getElementById('image-file-name');
            const data = document.getElementById('image-file-data');
            if (name)
                name.textContent = file.name;
            if (data)
                data.textContent = `${preview.naturalWidth} × ${preview.naturalHeight} · ${this.formatFileSize(file.size)}`;
            const convert = this.modalContent.querySelector('[data-modal-action="convert-image"]');
            if (convert)
                convert.disabled = false;
            this.setImageLabStatus('Imagen lista para convertir.', 'success');
        }
        catch {
            this.imageLabFile = null;
            this.setImageLabStatus('El navegador no pudo leer esta imagen.', 'danger');
        }
    }
    selectImageFormat(format) {
        this.imageLabFormat = `image/${format}`;
        this.modalContent.querySelectorAll('.format-button').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.modalAction === `image-format-${format}`);
        });
    }
    async convertImage() {
        const file = this.imageLabFile;
        if (!file) {
            this.setImageLabStatus('Selecciona una imagen antes de convertir.', 'warning');
            return;
        }
        const convert = this.modalContent.querySelector('[data-modal-action="convert-image"]');
        if (convert)
            convert.disabled = true;
        this.setImageLabStatus('Procesando la imagen localmente...', 'info');
        try {
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            if (!context)
                throw new Error('canvas');
            if (this.imageLabFormat === 'image/jpeg') {
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            const qualityInput = document.getElementById('image-quality');
            const quality = qualityInput instanceof HTMLInputElement ? Number(qualityInput.value) / 100 : 0.92;
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((result) => result ? resolve(result) : reject(new Error('blob')), this.imageLabFormat, quality);
            });
            const extension = this.imageLabFormat === 'image/jpeg' ? 'jpg' : this.imageLabFormat.split('/')[1] || 'png';
            const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') || 'imagen';
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${baseName}.${extension}`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.setImageLabStatus(`Conversión completada: ${extension.toUpperCase()} · ${this.formatFileSize(blob.size)}.`, 'success');
        }
        catch {
            this.setImageLabStatus('No fue posible convertir esta imagen en el navegador.', 'danger');
        }
        finally {
            if (convert)
                convert.disabled = false;
        }
    }
    setImageLabStatus(text, tone) {
        const status = document.getElementById('image-lab-status');
        if (!status)
            return;
        status.textContent = text;
        status.dataset.tone = tone;
    }
    formatFileSize(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    showMinigameResult(symbol, message) {
        this.modalContent.innerHTML = `<span class="eyebrow">RESULTADO</span>
      <h2 id="modal-title">Partida finalizada</h2>
      <div class="modal-result"><span class="result-emoji">${symbol}</span><strong>${escapeHtml(message)}</strong></div>
      <div class="modal-actions"><button class="primary-button" type="button" data-modal-action="close"><span>Continuar</span></button></div>`;
    }
}
