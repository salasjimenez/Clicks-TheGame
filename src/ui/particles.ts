export function spawnClickParticle(x: number, y: number, text: string, critical: boolean): void {
  const particle = document.createElement('span');
  particle.className = `click-particle${critical ? ' is-critical' : ''}`;
  particle.textContent = critical ? `CRÍTICO ${text}` : text;
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;
  document.body.appendChild(particle);
  window.setTimeout(() => particle.remove(), 850);
}
