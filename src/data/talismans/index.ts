import talismansJson from './raw/talismans.json';
import type { Talisman } from './types';

export const talismans = talismansJson as unknown as Talisman[];

export type { Talisman };
