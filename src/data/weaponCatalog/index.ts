import weaponsJson from './raw/weapons.json';
import type { WeaponCatalogItem } from './types';

export const weaponCatalog = weaponsJson as unknown as WeaponCatalogItem[];

export const weaponCatalogByTitle = new Map(
  weaponCatalog.map((weapon) => [weapon.title, weapon]),
);

export type { WeaponCatalogItem };
