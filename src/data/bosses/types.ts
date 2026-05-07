export type BossIds = {
  bossId: string;
  npcId: string;
  instance: string | null;
};

export type BossStatBlock = {
  raw: string;
  values: number[];
};

export type Boss = {
  name: string;
  bossType: string;
  ids: BossIds;
  hp: BossStatBlock;
  runes: BossStatBlock;
  weakAgainst: string[];
  strongAgainst: string[];
  resistances: string[];
  deepOfNight: string[];
  rawText: string;
};

export type BossesData = {
  source: string;
  language: string;
  scrapedAt: string;
  count: number;
  bosses: Boss[];
};
