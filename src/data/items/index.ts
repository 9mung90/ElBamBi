import itemsJson from './raw/items.json';
import type { EtcItem } from './types';

export const items = itemsJson as unknown as EtcItem[];

export type { EtcItem };
