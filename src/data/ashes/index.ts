import ashesJson from './raw/ashes.json';
import type { AshOfWar } from './types';

export const ashes = ashesJson as unknown as AshOfWar[];

export type { AshOfWar };
