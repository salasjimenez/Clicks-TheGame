import { particlesAllowed } from '../features/v29-state.js';
export function spawnClickParticle(x, y, text, critical) {
    if (!particlesAllowed())
        return;
    const particle = document.createElement("span");
    particle.className = `click-particle${critical ? " is-critical" : ""}`;
    particle.textContent = critical ? `CRÍTICO ${text}` : text;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    document.body.appendChild(particle);
    window.setTimeout(() => particle.remove(), 850);
}
