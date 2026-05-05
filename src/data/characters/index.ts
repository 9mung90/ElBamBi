import statsJson from './raw/stats.json';
import type { CharacterStats } from './types';

export const characterStats = statsJson as unknown as CharacterStats[];

export const characterNames = Array.from(
  new Set(characterStats.map((entry) => entry.character)),
);

export type { CharacterName, CharacterStats } from './types';
