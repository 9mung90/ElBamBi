import nightfarersJson from './raw/nightfarers.json';
import type { Nightfarer } from './types';

export const nightfarers = nightfarersJson as unknown as Nightfarer[];

export const nightfarerNames = nightfarers.map((nightfarer) => nightfarer.name);

export type { Nightfarer };
