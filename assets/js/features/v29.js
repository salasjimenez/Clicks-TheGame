import { UPGRADES } from '../data/store.js';
import { escapeHtml } from '../ui/dom.js';
import { SPECIALIZATION_LABELS, SPECIALIZATION_NODES, V29_RELEASE, applySpecializationDerived, classifyBuySignal, estimateUpgradeBenefit, priceEfficiency, selectWeeklyMissions, specializationPrice, weeklyProgress } from './v29-core.js';
import { markV29Seen, readV29State, updateV29State } from './v29-state.js';
const DERIVED_MARK = Symbol('click-v29-derived');
export function installV29Derived(engine) {
    const tagged = engine;
    if (tagged[DERIVED_MARK])
        return;
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(engine), 'derived');
    const getter = descriptor?.get;
    if (!getter)
        return;
    Object.defineProperty(engine, 'derived', {
        configurable: true,
        get() {
            const base = getter.call(engine);
            return applySpecializationDerived(base, readV29State(engine.state).specialization);
        }
    });
    tagged[DERIVED_MARK] = true;
}
function focusables(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}
export class V29Features {
    engine;
    weeklySignature = '';
    specializationSignature = '';
    storeSignalSignature = '';
    constructor(engine) {
        this.engine = engine;
        this.injectWeeklyPanel();
        this.injectSpecializationPanel();
        this.injectPreferences();
        this.injectChangelog();
        this.bindEvents();
        this.engine.subscribe((state, derived) => this.render(state, derived));
        window.setTimeout(() => this.maybeOpenChangelog(), 280);
    }
    injectWeeklyPanel() {
        const panel = document.getElementById('panel-missions');
        if (!panel || document.getElementById('v29-weekly-section'))
            return;
        const section = document.createElement('section');
        section.id = 'v29-weekly-section';
        section.className = 'v29-weekly-section';
        section.innerHTML = `
      <div class="v29-section-heading">
        <div><span class="eyebrow">DESAFÍO SEMANAL</span><h3>Misiones de la semana</h3><p>Rotan cada semana y son independientes de la temporada.</p></div>
        <span class="panel-counter" id="v29-weekly-summary">0/3</span>
      </div>
      <div class="mission-list" id="v29-weekly-list"></div>`;
        panel.appendChild(section);
    }
    injectSpecializationPanel() {
        const panel = document.getElementById('panel-store');
        if (!panel || document.getElementById('v29-specialization'))
            return;
        const section = document.createElement('section');
        section.id = 'v29-specialization';
        section.className = 'v29-specialization';
        section.innerHTML = `
      <div class="v29-section-heading">
        <div><span class="eyebrow">SPECIALIZATION TREE</span><h3>Ruta de especialización</h3><p>Elige una rama. Cambiar de rama cuesta 3 puntos de prestigio y reinicia sus nodos.</p></div>
        <span class="v29-specialization-current" id="v29-specialization-current">Sin ruta</span>
      </div>
      <div class="v29-path-grid" id="v29-path-grid"></div>
      <div class="v29-node-grid" id="v29-node-grid"></div>`;
        panel.appendChild(section);
    }
    injectPreferences() {
        const panel = document.getElementById('panel-stats');
        if (!panel || document.getElementById('v29-preferences'))
            return;
        const section = document.createElement('section');
        section.id = 'v29-preferences';
        section.className = 'v29-preferences';
        section.innerHTML = `
      <div class="v29-section-heading">
        <div><span class="eyebrow">V2.9 SETTINGS</span><h3>Juego y accesibilidad</h3><p>Preferencias locales incluidas en exportar/importar.</p></div>
      </div>
      <div class="v29-preference-grid">
        <label class="v29-setting-card" for="v29-offline-cap">
          <span><strong>Progreso offline</strong><small>Máximo acumulable al regresar</small></span>
          <select id="v29-offline-cap" aria-label="Máximo de horas de progreso offline">
            <option value="4">4 horas</option><option value="5">5 horas</option><option value="6">6 horas</option><option value="7">7 horas</option><option value="8">8 horas</option>
          </select>
        </label>
        <label class="v29-setting-card v29-toggle-card" for="v29-particles-enabled">
          <span><strong>Partículas de clic</strong><small>Se desactivan también con reduced-motion</small></span>
          <input id="v29-particles-enabled" type="checkbox">
        </label>
      </div>`;
        const saveActions = panel.querySelector('.save-actions');
        if (saveActions)
            panel.insertBefore(section, saveActions);
        else
            panel.appendChild(section);
        this.syncPreferenceControls();
    }
    injectChangelog() {
        if (document.getElementById('v29-changelog-dialog'))
            return;
        const dialog = document.createElement('dialog');
        dialog.id = 'v29-changelog-dialog';
        dialog.className = 'v29-changelog-dialog';
        dialog.setAttribute('aria-labelledby', 'v29-changelog-title');
        dialog.innerHTML = `
      <div class="v29-changelog-shell">
        <div class="v29-changelog-head"><span class="eyebrow">SYSTEM UPDATE</span><button type="button" data-v29-action="close-changelog" aria-label="Cerrar novedades">×</button></div>
        <h2 id="v29-changelog-title">CLICK! v2.9</h2>
        <p>Actualización funcional manteniendo tu partida y el estilo Retro Arcade.</p>
        <div class="v29-changelog-grid">
          <article><strong>🌙 Offline configurable</strong><span>4–8 horas máximas.</span></article>
          <article><strong>📅 Misiones semanales</strong><span>Rotación independiente de temporadas.</span></article>
          <article><strong>🌿 Especialización</strong><span>Manual, automatización o crítico.</span></article>
          <article><strong>📈 Compra inteligente</strong><span>Indicador costo/beneficio.</span></article>
          <article><strong>✨ Partículas</strong><span>Configurables y accesibles.</span></article>
          <article><strong>⌨️ Teclado</strong><span>Focus visible y navegación modal.</span></article>
        </div>
        <button class="primary-button full-button" type="button" data-v29-action="close-changelog">ENTENDIDO</button>
      </div>`;
        document.body.appendChild(dialog);
        const footer = document.querySelector('.arcade-footer');
        if (footer && !document.getElementById('v29-changelog-button')) {
            const button = document.createElement('button');
            button.id = 'v29-changelog-button';
            button.className = 'v29-changelog-button';
            button.type = 'button';
            button.dataset.v29Action = 'open-changelog';
            button.textContent = 'Novedades v2.9';
            footer.appendChild(button);
        }
    }
    bindEvents() {
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const action = target.closest('[data-v29-action]')?.dataset.v29Action;
            if (action === 'claim-weekly') {
                const id = target.closest('[data-v29-weekly-id]')?.dataset.v29WeeklyId;
                if (id)
                    this.claimWeekly(id);
            }
            if (action === 'choose-path') {
                const path = target.closest('[data-v29-path]')?.dataset.v29Path;
                if (path)
                    this.choosePath(path);
            }
            if (action === 'buy-node') {
                const id = target.closest('[data-v29-node]')?.dataset.v29Node;
                if (id)
                    this.buyNode(id);
            }
            if (action === 'open-changelog')
                this.openChangelog(false);
            if (action === 'close-changelog')
                this.closeChangelog();
        });
        document.getElementById('v29-offline-cap')?.addEventListener('change', (event) => {
            const select = event.currentTarget;
            updateV29State((state) => { state.preferences.offlineCapHours = Number(select.value); }, this.engine.state);
            this.notify(`🌙 Progreso offline limitado a ${select.value} horas.`, 'info');
        });
        document.getElementById('v29-particles-enabled')?.addEventListener('change', (event) => {
            const input = event.currentTarget;
            updateV29State((state) => { state.preferences.particlesEnabled = input.checked; }, this.engine.state);
            this.notify(input.checked ? '✨ Partículas activadas.' : '✨ Partículas desactivadas.', 'info');
        });
        document.addEventListener('keydown', (event) => this.handleKeyboard(event));
        const dialog = document.getElementById('v29-changelog-dialog');
        dialog?.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.closeChangelog();
        });
    }
    handleKeyboard(event) {
        if (event.key !== 'Tab')
            return;
        const dialog = document.getElementById('v29-changelog-dialog');
        const regularModal = document.querySelector('.modal-backdrop:not([hidden]) .modal');
        const container = dialog?.open ? dialog : regularModal;
        if (!container)
            return;
        const items = focusables(container);
        if (items.length === 0)
            return;
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last)
            return;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
    render(state, derived) {
        this.renderWeekly(state);
        this.renderSpecialization(state);
        this.renderStoreSignals(state, derived);
        this.syncPreferenceControls();
    }
    renderWeekly(state) {
        const feature = readV29State(state);
        const missions = selectWeeklyMissions(feature.weekly.key);
        const signature = JSON.stringify([
            feature.weekly.key,
            feature.weekly.claimed,
            missions.map((mission) => [mission.id, Math.floor(weeklyProgress(mission.metric, feature.weekly.baseline, state))])
        ]);
        if (signature === this.weeklySignature)
            return;
        this.weeklySignature = signature;
        const list = document.getElementById('v29-weekly-list');
        const summary = document.getElementById('v29-weekly-summary');
        if (!list || !summary)
            return;
        const claimed = missions.filter((mission) => feature.weekly.claimed.includes(mission.id)).length;
        summary.textContent = `${claimed}/${missions.length}`;
        list.innerHTML = missions.map((mission) => {
            const progress = weeklyProgress(mission.metric, feature.weekly.baseline, state);
            const done = progress >= mission.target;
            const isClaimed = feature.weekly.claimed.includes(mission.id);
            const percentage = Math.min(100, (progress / mission.target) * 100);
            return `<article class="mission-card v29-weekly-card${done ? ' is-complete' : ''}">
        <span class="mission-emoji" aria-hidden="true">${mission.emoji}</span>
        <div class="mission-info"><strong>${escapeHtml(mission.title)}</strong><small>${escapeHtml(mission.description)}</small>
          <div class="mission-progress-row"><div class="progress-track"><span style="width:${percentage}%"></span></div><span>${this.engine.format(progress)}/${this.engine.format(mission.target)}</span></div>
        </div>
        <button class="claim-button${isClaimed ? ' is-claimed' : ''}" type="button" data-v29-action="claim-weekly" data-v29-weekly-id="${mission.id}" ${isClaimed || !done ? 'disabled' : ''}>${isClaimed ? 'Listo' : done ? 'Reclamar' : `${this.engine.format(mission.reward)} 🪙`}</button>
      </article>`;
        }).join('');
    }
    claimWeekly(id) {
        const feature = readV29State(this.engine.state);
        const mission = selectWeeklyMissions(feature.weekly.key).find((item) => item.id === id);
        if (!mission || feature.weekly.claimed.includes(id))
            return;
        const progress = weeklyProgress(mission.metric, feature.weekly.baseline, this.engine.state);
        if (progress < mission.target)
            return;
        updateV29State((state) => { state.weekly.claimed.push(id); }, this.engine.state);
        this.engine.state.coins += mission.reward;
        this.engine.state.lifetimeCoins += mission.reward;
        this.engine.state.daily.counters.coinsEarned += mission.reward;
        this.engine.state.stats.missionsCompleted += 1;
        this.notify(`${mission.emoji} Misión semanal completada: +${this.engine.format(mission.reward)} monedas.`, 'success');
        this.engine.replaceState(this.engine.state);
    }
    renderSpecialization(state) {
        const feature = readV29State(state);
        const signature = JSON.stringify([feature.specialization, state.prestigePoints]);
        if (signature === this.specializationSignature)
            return;
        this.specializationSignature = signature;
        const current = document.getElementById('v29-specialization-current');
        const pathGrid = document.getElementById('v29-path-grid');
        const nodeGrid = document.getElementById('v29-node-grid');
        if (!current || !pathGrid || !nodeGrid)
            return;
        current.textContent = feature.specialization.path ? SPECIALIZATION_LABELS[feature.specialization.path] : 'Sin ruta';
        const paths = ['manual', 'automation', 'critical'];
        pathGrid.innerHTML = paths.map((path) => {
            const selected = feature.specialization.path === path;
            const label = SPECIALIZATION_LABELS[path];
            const extra = feature.specialization.path && !selected ? ' · cambio 3 💎' : '';
            return `<button type="button" class="v29-path-button${selected ? ' is-selected' : ''}" data-v29-action="choose-path" data-v29-path="${path}" aria-pressed="${selected}"><strong>${label}</strong><small>${selected ? 'Rama activa' : `Seleccionar${extra}`}</small></button>`;
        }).join('');
        if (!feature.specialization.path) {
            nodeGrid.innerHTML = '<p class="v29-empty-tree">Selecciona una ruta para desbloquear sus nodos.</p>';
            return;
        }
        const activePath = feature.specialization.path;
        nodeGrid.innerHTML = SPECIALIZATION_NODES.filter((node) => node.path === activePath).map((node) => {
            const level = feature.specialization.levels[node.id];
            const maximum = level >= node.maxLevel;
            const price = specializationPrice(level);
            const disabled = maximum || state.prestigePoints < price;
            return `<article class="v29-node-card"><span class="store-emoji" aria-hidden="true">${node.emoji}</span><div><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.description)}</small><span>Nivel ${level}/${node.maxLevel}</span></div><button type="button" class="buy-button" data-v29-action="buy-node" data-v29-node="${node.id}" ${disabled ? 'disabled' : ''}>${maximum ? 'MAX' : `${price} 💎`}</button></article>`;
        }).join('');
    }
    choosePath(path) {
        const feature = readV29State(this.engine.state);
        if (feature.specialization.path === path)
            return;
        if (feature.specialization.path) {
            const cost = 3;
            if (this.engine.state.prestigePoints < cost) {
                this.notify('Necesitas 3 puntos de prestigio para cambiar de especialización.', 'warning');
                return;
            }
            if (!window.confirm(`Cambiar a ${SPECIALIZATION_LABELS[path]} cuesta 3 puntos de prestigio y reinicia los nodos de la rama actual. ¿Continuar?`))
                return;
            this.engine.state.prestigePoints -= cost;
            updateV29State((state) => {
                state.specialization.path = path;
                Object.keys(state.specialization.levels).forEach((id) => {
                    state.specialization.levels[id] = 0;
                });
            }, this.engine.state);
            this.notify(`🌿 Ruta ${SPECIALIZATION_LABELS[path]} activada.`, 'success');
        }
        else {
            updateV29State((state) => { state.specialization.path = path; }, this.engine.state);
            this.notify(`🌿 Ruta ${SPECIALIZATION_LABELS[path]} seleccionada.`, 'success');
        }
        this.engine.replaceState(this.engine.state);
    }
    buyNode(id) {
        const feature = readV29State(this.engine.state);
        const node = SPECIALIZATION_NODES.find((item) => item.id === id);
        if (!node || feature.specialization.path !== node.path)
            return;
        const level = feature.specialization.levels[id];
        if (level >= node.maxLevel)
            return;
        const price = specializationPrice(level);
        if (this.engine.state.prestigePoints < price) {
            this.notify(`Necesitas ${price} puntos de prestigio.`, 'warning');
            return;
        }
        this.engine.state.prestigePoints -= price;
        updateV29State((state) => { state.specialization.levels[id] += 1; }, this.engine.state);
        this.notify(`${node.emoji} ${node.name} subió al nivel ${level + 1}.`, 'success');
        this.engine.replaceState(this.engine.state);
    }
    renderStoreSignals(state, derived) {
        const data = UPGRADES.map((item) => {
            const price = this.engine.getUpgradePrice(item.id);
            const benefit = estimateUpgradeBenefit(item.id, state, derived);
            return { id: item.id, price, score: priceEfficiency(price, benefit) };
        });
        const signature = JSON.stringify([state.coins, state.upgrades, data.map((item) => [item.id, item.price, item.score.toFixed(8)])]);
        if (signature === this.storeSignalSignature)
            return;
        this.storeSignalSignature = signature;
        const scores = data.map((item) => item.score);
        for (const item of data) {
            const button = document.querySelector(`[data-store-item="${item.id}"]`);
            const card = button?.closest('.store-card');
            const info = card?.querySelector('.store-info');
            if (!button || !card || !info)
                continue;
            const signal = classifyBuySignal(item.score, scores, state.coins >= item.price);
            card.classList.toggle('is-smart-buy', signal === 'smart');
            card.classList.toggle('is-save-buy', signal === 'save');
            let badge = info.querySelector('.v29-buy-signal');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'v29-buy-signal';
                info.appendChild(badge);
            }
            badge.dataset.signal = signal;
            badge.textContent = signal === 'smart' ? 'BUENA COMPRA' : signal === 'available' ? 'DISPONIBLE' : 'AHORRA';
            button.setAttribute('aria-description', badge.textContent);
        }
    }
    syncPreferenceControls() {
        const preferences = readV29State(this.engine.state).preferences;
        const cap = document.getElementById('v29-offline-cap');
        const particles = document.getElementById('v29-particles-enabled');
        if (cap && cap.value !== String(preferences.offlineCapHours))
            cap.value = String(preferences.offlineCapHours);
        if (particles)
            particles.checked = preferences.particlesEnabled;
    }
    maybeOpenChangelog() {
        const feature = readV29State(this.engine.state);
        if (feature.lastSeenVersion !== V29_RELEASE)
            this.openChangelog(true);
    }
    openChangelog(automatic) {
        const dialog = document.getElementById('v29-changelog-dialog');
        if (!dialog || dialog.open)
            return;
        dialog.showModal();
        dialog.querySelector('button')?.focus();
        if (!automatic)
            return;
    }
    closeChangelog() {
        const dialog = document.getElementById('v29-changelog-dialog');
        if (!dialog?.open)
            return;
        markV29Seen();
        dialog.close();
    }
    notify(text, tone) {
        const region = document.getElementById('toast-region');
        if (!region)
            return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.dataset.tone = tone;
        toast.textContent = text;
        region.appendChild(toast);
        window.setTimeout(() => {
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 190);
        }, 3000);
    }
}
