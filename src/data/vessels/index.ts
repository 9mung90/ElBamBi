import vesselsJson from './raw/vessels.json';
import type { Vessel } from './types';

const vesselAssetUrls = import.meta.glob('../../assets/images/vessels/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const nightAssetUrls = import.meta.glob('../../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const assetUrlsByNormalizedPath = new Map<string, string>();

for (const [path, url] of [...Object.entries(vesselAssetUrls), ...Object.entries(nightAssetUrls)]) {
  assetUrlsByNormalizedPath.set(normalizeAssetPath(path), url);
}

function normalizeAssetPath(path: string) {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/?src\/assets\/images\//i, '../../assets/images/')
    .replace(/^\/?assets\/images\//i, '../../assets/images/')
    .replace(/^\.\.\/assets\/images\//i, '../../assets/images/')
    .replace(/^\.\.\/\.\.\/assets\/images\//i, '../../assets/images/')
    .replace(/\/Vessels\//i, '/vessels/')
    .toLowerCase();
}

function resolveAssetUrl(path: string) {
  if (!path.trim()) return path;

  return assetUrlsByNormalizedPath.get(normalizeAssetPath(path)) ?? path;
}

function resolvePipeSeparatedImages(value: string) {
  return value
    .split('|')
    .map((path) => {
      const trimmedPath = path.trim();
      return trimmedPath ? resolveAssetUrl(trimmedPath) : trimmedPath;
    })
    .join(' | ');
}

function resolveVesselImageFields(vessel: Vessel): Vessel {
  return {
    ...vessel,
    nameImages: resolvePipeSeparatedImages(vessel.nameImages),
    characterImages: resolvePipeSeparatedImages(vessel.characterImages),
    relicColorImageUrls: resolvePipeSeparatedImages(vessel.relicColorImageUrls),
    deepRelicColorImageUrls: resolvePipeSeparatedImages(vessel.deepRelicColorImageUrls),
  };
}

export const vessels = (vesselsJson as unknown as Vessel[]).map(resolveVesselImageFields);

export const vesselNames = vessels.map((vessel) => vessel.name);

export type { Vessel };
