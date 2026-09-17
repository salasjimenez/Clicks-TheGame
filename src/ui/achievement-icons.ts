import type { AchievementCategory } from "../types.js";

const ICONS = {
  speed: "./assets/icons/achievements/speed.svg",
  wealth: "./assets/icons/achievements/wealth.svg",
  explore: "./assets/icons/achievements/explore.svg",
  prestige: "./assets/icons/achievements/prestige.svg",
  special: "./assets/icons/achievements/special.svg",
  locked: "./assets/icons/achievements/locked.svg",
} as const;

const CATEGORY_ICON: Record<AchievementCategory, keyof typeof ICONS> = {
  clicks: "speed",
  cps: "speed",
  autoClickers: "speed",
  multiplier: "wealth",
  prestige: "prestige",
  deepPrestige: "prestige",
  minigames: "explore",
  missions: "explore",
  events: "explore",
  seasons: "explore",
  time: "explore",
  shop: "wealth",
  secret: "special",
};

export function achievementIconUrl(
  category: AchievementCategory,
  locked = false,
): string {
  return locked ? ICONS.locked : ICONS[CATEGORY_ICON[category]];
}

export function achievementIconMarkup(
  category: AchievementCategory,
  locked = false,
  className = "achievement-icon",
): string {
  return `<img class="${className}" src="${achievementIconUrl(category, locked)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}
