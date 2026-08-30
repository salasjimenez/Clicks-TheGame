import type { ConsumableDefinition, UpgradeDefinition } from '../types.js';

export const UPGRADES: UpgradeDefinition[] = [
  { id: 'autoClicker', name: 'Auto Clicker', description: '+1 CPS por nivel', emoji: '🤖', basePrice: 45, growth: 1.15 },
  { id: 'clickMultiplier', name: 'Multiplicador', description: 'Duplica el valor base del clic', emoji: '⚡', basePrice: 100, growth: 2.05, maxLevel: 12 },
  { id: 'quantumCore', name: 'Núcleo cuántico', description: '+20% a toda la producción', emoji: '🧿', basePrice: 550, growth: 1.58, maxLevel: 30 },
  { id: 'luckyChip', name: 'Chip crítico', description: '+2% de probabilidad crítica', emoji: '🎯', basePrice: 360, growth: 1.52, maxLevel: 20 },
  { id: 'comboDrive', name: 'Combo Drive', description: 'Aumenta el límite del combo rápido', emoji: '🔥', basePrice: 650, growth: 1.48, maxLevel: 20 },
  { id: 'overclock', name: 'Overclock', description: '+15% de CPS por nivel', emoji: '🚀', basePrice: 900, growth: 1.58, maxLevel: 25 },
  { id: 'coinMagnet', name: 'Imán de monedas', description: '+10% a monedas manuales y automáticas', emoji: '🧲', basePrice: 1200, growth: 1.65, maxLevel: 20 },
  { id: 'offlineBattery', name: 'Batería offline', description: '+5% de eficiencia sin conexión', emoji: '🔋', basePrice: 1800, growth: 1.8, maxLevel: 10 }
];

export const CONSUMABLES: ConsumableDefinition[] = [
  { id: 'timeBoost', name: 'Turbo temporal', description: 'CPS x3 durante 30 segundos', emoji: '⏱️', price: 500, currency: 'coins' },
  { id: 'capsule', name: 'Cápsula misteriosa', description: 'Premio aleatorio entre 250 y 1,500', emoji: '💊', price: 900, currency: 'coins' },
  { id: 'superCapsule', name: 'Cápsula estelar', description: 'Premio premium o mejora gratuita', emoji: '🌟', price: 2, currency: 'prestige' }
];
