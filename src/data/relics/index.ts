import candidateFilesJson from './raw/candidate-files.json';
import relicRollAppDataJson from './raw/ern-relic-app-data.json';
import effectsJson from './raw/effects.json';
import effectsKoJson from './raw/effects-ko.json';
import relicsJson from './raw/relics.json';
import weaponsJson from './raw/weapons.json';
import type {
  CandidateFile,
  Relic,
  RelicEffect,
  RelicRollAppData,
  RelicRollEffect,
  RelicRollMode,
  RelicWeapon,
} from './types';

export const relics = relicsJson as unknown as Relic[];
export const relicEffects = effectsJson as unknown as RelicEffect[];
export const relicEffectsKo = effectsKoJson as unknown as RelicEffect[];
export const relicWeaponsById = weaponsJson as unknown as Record<string, RelicWeapon>;
export const relicCandidateFiles = candidateFilesJson as unknown as CandidateFile[];
export const relicRollAppData = relicRollAppDataJson as unknown as RelicRollAppData;

export const relicWeapons = Object.values(relicWeaponsById);

export type {
  CandidateFile,
  Relic,
  RelicEffect,
  RelicRollAppData,
  RelicRollEffect,
  RelicRollMode,
  RelicWeapon,
};
