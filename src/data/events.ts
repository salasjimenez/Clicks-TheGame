import type { EventId } from '../types.js';

export const EVENTS: Record<EventId, { title: string; description: string; emoji: string; duration: number }> = {
  doubleClick: { title: 'Sobrecarga de clics', description: 'Cada clic manual vale el doble', emoji: '⚡', duration: 25000 },
  clickRain: { title: 'Lluvia automática', description: 'La producción automática recibe +10 CPS', emoji: '🌧️', duration: 25000 },
  discount: { title: 'Mercado relámpago', description: 'Todas las mejoras tienen 25% de descuento', emoji: '🏷️', duration: 30000 },
  criticalFever: { title: 'Fiebre crítica', description: 'La probabilidad crítica aumenta 25%', emoji: '🎯', duration: 22000 }
};
