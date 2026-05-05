export type RelicColor = 'Red' | 'Blue' | 'Yellow' | 'Green' | string;

export type Relic = {
  id: number;
  name: string;
  nameOrNull?: string;
  color: RelicColor;
  image?: string;
  location?: string;
  type?: string;
  effects?: number[];
  obtainable?: string;
  group?: string;
  description?: string;
  raw?: string;
};

export type RelicEffect = {
  id: string | number;
  type: 'relic' | 'weapon' | string;
  name: string;
  category?: string;
  stackable?: boolean;
  desc?: string;
  dn?: boolean;
  unobtainable?: boolean;
  stackOther?: string;
};

export type DamageMap = Record<string, number>;
export type ScalingMap = Record<string, number>;
export type StatusDamageMap = Record<string, number[]>;
export type CorrectTypeMap = Record<string, number>;

export type RelicWeapon = {
  id: number;
  name: string;
  requiredLevel?: number;
  weaponType?: number;
  rarity?: number;
  attackType?: number;
  reinforceTypeId?: number;
  attackElementCorrectId?: number;
  scaling?: ScalingMap;
  baseDamage?: DamageMap;
  statusDamage?: StatusDamageMap;
  correctType?: CorrectTypeMap;
  physGuardCutRate?: number;
  magGuardCutRate?: number;
  fireGuardCutRate?: number;
  thunGuardCutRate?: number;
  saWeaponDamage?: number;
  spAttribute?: number;
  criticalMultiplier?: number;
  swordArtsId?: number;
};

export type CandidateFile = {
  url: string;
  size: number;
  preview: string;
};
