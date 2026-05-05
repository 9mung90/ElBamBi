import vesselsJson from './raw/vessels.json';
import type { Vessel } from './types';

export const vessels = vesselsJson as unknown as Vessel[];

export const vesselNames = vessels.map((vessel) => vessel.name);

export type { Vessel };
