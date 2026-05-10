import { bosses } from '../data/bosses';

export type BossFilters = {
  types: string[];
};

export const bossTypeLabels: Record<string, string> = {
  'Evergoal Boss': '봉인감옥 보스',
  'Field Boss': '필드 보스',
  'Location Boss': '지역 보스',
  'Night Boss': '밤 보스',
};

export const bossFilterOptions = {
  types: Array.from(new Set(bosses.map((boss) => boss.bossType))),
};

export function createEmptyBossFilters(): BossFilters {
  return {
    types: [],
  };
}

export function formatBossType(type: string) {
  return bossTypeLabels[type] ?? type;
}
