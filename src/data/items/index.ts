import itemsJson from './raw/items.json';
import consumablesJson from './raw/consumables_all.json';
import type { ConsumableItem, EtcItem } from './types';

export const items = itemsJson as unknown as EtcItem[];
export const consumables = consumablesJson as unknown as ConsumableItem[];

export type { ConsumableItem, EtcItem };
