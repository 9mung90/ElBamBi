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

export type RelicRollEffect = {
  key: string;
  effect: string;
  effect_kor: string;
  effect_detail_kor: string;
  group: number | string;
  id: number | string;
  cat: number;
  loc: number;
  cursed?: boolean;
};

export type RelicRollMode = {
  id: string;
  label: string;
  sourceFile: string;
  isDlc: boolean;
  isDeepMode: boolean;
  effectSlots: number;
  debuffTable: string | null;
  requiresDebuffWhenDebuffSlotUnlocked: boolean;
  count: number;
  categoryCounts: Record<string, number>;
  effects: RelicRollEffect[];
  indexes: {
    byKey: Record<string, number>;
    byEffect: Record<string, string>;
    byGroup: Record<string, string[]>;
    byCat: Record<string, string[]>;
  };
};

export type RelicRollDebuffTable = {
  id: string;
  label: string;
  sourceFile: string;
  count: number;
  categoryCounts: Record<string, number>;
  effects: RelicRollEffect[];
  indexes: RelicRollMode['indexes'];
};

export type RelicRollAppData = {
  schemaVersion: string;
  generatedFrom: string;
  generatedAt: string;
  purpose: string;
  importantLimitations: string[];
  validationRulesInferred: {
    slotCount: number;
    noDuplicateEffectKey: boolean;
    noDuplicateEffectId: boolean;
    sameGroupMayConflict: boolean;
    recommendedCategorySortOrder: number[];
    recommendedLineSortFields: string[];
    deepModesRequireDebuffWhenUnlocked: boolean;
    debuffDuplicateNotAllowed: boolean;
    confidence: string;
    note: string;
  };
  categoryNotes: Record<string, { label: string; description: string }>;
  modes: Record<string, RelicRollMode>;
  debuffTables: Record<string, RelicRollDebuffTable>;
};
