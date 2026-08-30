const GAME_SECONDS = 45;

export function neonRushMarkup(): string {
  return `<span class="eyebrow">BONUS STAGE · 45 SEGUNDOS</span>
    <h2 id="modal-title">Neon Rush</h2>
    <p>Golpea el objetivo de neón tantas veces como puedas. Se desbloquea con el primer reinicio de núcleo.</p>
    <div class="neon-rush" id="neon-rush">
      <div class="neon-rush-hud"><span>PUNTOS <strong id="neon-rush-score">0</strong></span><span>TIEMPO <strong id="neon-rush-time">45.0</strong>s</span></div>
      <div class="neon-rush-field" id="neon-rush-field">
        <button class="neon-rush-target" id="neon-rush-target" type="button" aria-label="Objetivo de Neon Rush">✦</button>
      </div>
      <p class="neon-rush-tip">10 puntos cuentan como victoria. El premio crece con tu puntuación.</p>
    </div>
    <div class="modal-actions"><button class="secondary-button" type="button" data-modal-action="close">Salir</button></div>`;
}

export function mountNeonRush(root: HTMLElement, onFinish: (score: number) => void): () => void {
  const field = root.querySelector<HTMLElement>('#neon-rush-field');
  const target = root.querySelector<HTMLButtonElement>('#neon-rush-target');
  const scoreElement = root.querySelector<HTMLElement>('#neon-rush-score');
  const timeElement = root.querySelector<HTMLElement>('#neon-rush-time');
  const startedAt = performance.now();
  const endsAt = startedAt + GAME_SECONDS * 1000;
  let score = 0;
  let stopped = false;
  let timer = 0;

  const moveTarget = (): void => {
    if (!field || !target) return;
    const width = Math.max(0, field.clientWidth - target.offsetWidth - 12);
    const height = Math.max(0, field.clientHeight - target.offsetHeight - 12);
    target.style.left = `${6 + Math.random() * width}px`;
    target.style.top = `${6 + Math.random() * height}px`;
  };

  const finish = (): void => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    if (target) target.disabled = true;
    onFinish(score);
  };

  const updateTimer = (): void => {
    if (stopped) return;
    const remaining = Math.max(0, (endsAt - performance.now()) / 1000);
    if (timeElement) timeElement.textContent = remaining.toFixed(1);
    if (remaining <= 0) {
      finish();
      return;
    }
    timer = window.setTimeout(updateTimer, 250);
  };

  const onHit = (): void => {
    if (stopped) return;
    score += 1;
    if (scoreElement) scoreElement.textContent = String(score);
    target?.classList.remove('is-hit');
    requestAnimationFrame(() => target?.classList.add('is-hit'));
    moveTarget();
  };

  target?.addEventListener('click', onHit);
  requestAnimationFrame(moveTarget);
  updateTimer();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    target?.removeEventListener('click', onHit);
  };
}
