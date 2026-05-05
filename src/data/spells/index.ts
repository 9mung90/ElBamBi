import spellsJson from './raw/spells.json';
import type { Spell } from './types';

export const spells = spellsJson as unknown as Spell[];

export type { Spell };
