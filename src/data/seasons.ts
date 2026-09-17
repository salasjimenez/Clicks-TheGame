export interface SeasonDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

const SEASON_NAMES = [
  {
    name: "Neón Polar",
    description: "Luces frías y desafíos de precisión.",
    emoji: "❄️",
  },
  {
    name: "Circuito Primavera",
    description: "Una temporada de crecimiento y combos.",
    emoji: "🌸",
  },
  {
    name: "Retro Solar",
    description: "Ritmo rápido y energía arcade.",
    emoji: "☀️",
  },
  {
    name: "Noche Pixel",
    description: "El cierre del año bajo luces de 8 bits.",
    emoji: "🌙",
  },
] as const;

export function currentSeason(date = new Date()): SeasonDefinition {
  const quarter = Math.floor(date.getMonth() / 3);
  const entry = SEASON_NAMES[quarter] ?? SEASON_NAMES[0];
  return {
    id: `${date.getFullYear()}-Q${quarter + 1}`,
    name: entry.name,
    description: entry.description,
    emoji: entry.emoji,
  };
}
