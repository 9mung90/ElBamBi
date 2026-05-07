import bossesJson from './raw/bosses.json';
import type { Boss, BossesData } from './types';

export const bossesData = bossesJson as unknown as BossesData;
export const bosses = bossesData.bosses;

export type { Boss, BossesData };
