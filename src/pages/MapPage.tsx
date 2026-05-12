import { useMemo, useRef, useState, type CSSProperties, type MouseEvent, type TouchEvent, type WheelEvent } from 'react';
import coordsData from '../data/mapReader/coordsXY.json';
import mapBackgroundData from '../data/mapReader/map_backgrounds.json';
import poiData from '../data/mapReader/poi_uv_with_ids.json';
import seedData from '../data/mapReader/seed_data.json';
import adelPatterns from '../data/mapReader/patterns_by_nightlord/Adel.json';
import caligoPatterns from '../data/mapReader/patterns_by_nightlord/Caligo.json';
import fulghorPatterns from '../data/mapReader/patterns_by_nightlord/Fulghor.json';
import gladiusPatterns from '../data/mapReader/patterns_by_nightlord/Gladius.json';
import gnosterPatterns from '../data/mapReader/patterns_by_nightlord/Gnoster.json';
import harmoniaPatterns from '../data/mapReader/patterns_by_nightlord/Harmonia.json';
import heolstorPatterns from '../data/mapReader/patterns_by_nightlord/Heolstor.json';
import libraPatterns from '../data/mapReader/patterns_by_nightlord/Libra.json';
import marisPatterns from '../data/mapReader/patterns_by_nightlord/Maris.json';
import straghessPatterns from '../data/mapReader/patterns_by_nightlord/Straghess.json';
import bossCastleLabels from '../data/mapReader/locales/ko/boss_castle.json';
import bossEvergaolLabels from '../data/mapReader/locales/ko/boss_evergaol.json';
import bossFieldLabels from '../data/mapReader/locales/ko/boss_field.json';
import bossNightLabels from '../data/mapReader/locales/ko/boss_night.json';
import eventLabels from '../data/mapReader/locales/ko/events_labels.json';
import nightlordLabels from '../data/mapReader/locales/ko/nightlords.json';
import poiValueLabels from '../data/mapReader/locales/ko/overlay_poi_values.json';
import shiftingEarthLabels from '../data/mapReader/locales/ko/shifting_earth_labels.json';
import './MapPage.css';

const mapImages = import.meta.glob('../assets/images/mapReader/mapTypes/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const buildingIcons = import.meta.glob('../assets/images/mapReader/buildingIcons/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

type LocaleDomainName =
  | 'boss_castle'
  | 'boss_evergaol'
  | 'boss_field'
  | 'boss_night'
  | 'events_labels'
  | 'nightlords'
  | 'overlay_poi_values'
  | 'shifting_earth_labels';

type LocaleMap = Record<string, string>;

interface CoordinatePoint {
  id: string | number;
  x: number;
  y: number;
}

interface PoiCoordinate {
  id: number;
  uv: [number, number];
}

interface SeedRow {
  seed_id: string;
  map_type: string;
  nightlord: string;
  slots: Record<string, string>;
  day2_location?: number;
}

interface PatternPoint {
  poi_id?: number;
  boss?: string;
  event?: string;
  location?: string | null;
  night?: number;
  value?: string;
}

interface NightBossPoint {
  poi_id?: number;
  boss?: string;
  circle_location?: string;
}

interface PatternRow {
  layout_number: string;
  nightlord: string;
  shifting_earth: string;
  churches?: PatternPoint[];
  sorcerers_rises?: PatternPoint[];
  night1?: NightBossPoint;
  night2?: NightBossPoint;
  special_events?: PatternPoint[];
  extra_night_boss?: string;
  evergaols?: PatternPoint[];
  field_bosses?: PatternPoint[];
  castle?: PatternPoint[];
  small_castle?: PatternPoint[];
  medium_castle?: PatternPoint[];
  ruins?: PatternPoint[];
  forts?: PatternPoint[];
  camps?: PatternPoint[];
  great_churches?: PatternPoint[];
  caravans?: PatternPoint[];
  townships?: PatternPoint[];
  spawn_points?: PatternPoint[];
}

interface SlotOverlay {
  id: string;
  itemId: string;
  x: number;
  y: number;
  rawValue: string;
  label: string;
  details: string[];
  iconUrl: string;
  kind: 'facility' | 'boss' | 'spawn' | 'unknown';
}

interface PoiMarker {
  id: string;
  x: number;
  y: number;
  kind: 'night1' | 'night2' | 'event' | 'field' | 'evergaol' | 'castle' | 'church' | 'rise' | 'facility';
  shortLabel: string;
  label: string;
  details: string[];
  iconUrl: string;
  isHotspot?: boolean;
}

interface DetailRow {
  id: string;
  label: string;
}

interface CandidateEntry {
  pattern: PatternRow;
  seed: SeedRow;
}

type PatternListKey =
  | 'churches'
  | 'sorcerers_rises'
  | 'evergaols'
  | 'field_bosses'
  | 'castle'
  | 'small_castle'
  | 'medium_castle'
  | 'ruins'
  | 'forts'
  | 'camps'
  | 'great_churches'
  | 'caravans'
  | 'townships'
  | 'spawn_points';

const patternsByNightlord: Record<string, PatternRow[]> = {
  Adel: adelPatterns as PatternRow[],
  Caligo: caligoPatterns as PatternRow[],
  Fulghor: fulghorPatterns as PatternRow[],
  Gladius: gladiusPatterns as PatternRow[],
  Gnoster: gnosterPatterns as PatternRow[],
  Harmonia: harmoniaPatterns as PatternRow[],
  Heolstor: heolstorPatterns as PatternRow[],
  Libra: libraPatterns as PatternRow[],
  Maris: marisPatterns as PatternRow[],
  Straghess: straghessPatterns as PatternRow[],
};

const localeDomains: Record<LocaleDomainName, LocaleMap> = {
  boss_castle: bossCastleLabels as LocaleMap,
  boss_evergaol: bossEvergaolLabels as LocaleMap,
  boss_field: bossFieldLabels as LocaleMap,
  boss_night: bossNightLabels as LocaleMap,
  events_labels: eventLabels as LocaleMap,
  nightlords: nightlordLabels as LocaleMap,
  overlay_poi_values: poiValueLabels as LocaleMap,
  shifting_earth_labels: shiftingEarthLabels as LocaleMap,
};

const nightlordOrder = [
  'Gladius',
  'Adel',
  'Gnoster',
  'Maris',
  'Libra',
  'Fulghor',
  'Caligo',
  'Heolstor',
  'Harmonia',
  'Straghess',
];

const allNightlordsKey = '???';

const slotAttributeSuffixes = [
  'frostbite',
  'lightning',
  'madness',
  'electric',
  'poison',
  'bleed',
  'blight',
  'fire',
  'holy',
  'magic',
  'rot',
  'sleep',
];

const buildingBaseLabels: Record<string, string> = {
  blacksmith_town: '대장간 마을',
  caravan: '소규모 캠프',
  castle: '성',
  church: '교회',
  church_spawn: '교회',
  fort: '요새',
  gaol: '감옥',
  greatchurch: '대교회',
  mainencampment: '주둔지',
  march: '행군',
  medium_castle: '성',
  ruins: '폐허',
  small_castle: '소형 성',
  sorcerers: '마술사의 탑',
  spawn: '시작 지점',
  temple: '신전',
  township: '마을',
};

const attributeLabels: Record<string, string> = {
  bleed: '출혈',
  blight: '즉사',
  electric: '전기',
  fire: '화염',
  frostbite: '동상',
  holy: '신성',
  lightning: '벼락',
  madness: '광기',
  magic: '마력',
  poison: '독',
  rot: '부패',
  sleep: '수면',
};

const mapTypeFallbackLabels: Record<string, string> = {
  Default: '기본',
  'Forsaken Hollows': 'The Forsaken Hollows',
};

const focusedFieldBossLocations: Record<string, string> = {
  'Castle Rooftop': '캐슬 옥상',
  'Castle Basement': '성 지하실',
};

const facilityPoiMergeDistance = 3.6;

const facilityMarkerGroups: Array<{
  key: PatternListKey;
  kind: PoiMarker['kind'];
  shortLabel: string;
  iconKey: string;
}> = [
  { key: 'churches', kind: 'church', shortLabel: '교회', iconKey: 'church' },
  { key: 'sorcerers_rises', kind: 'rise', shortLabel: '탑', iconKey: 'sorcerers' },
  { key: 'ruins', kind: 'facility', shortLabel: '유적', iconKey: 'ruins' },
  { key: 'forts', kind: 'facility', shortLabel: '요새', iconKey: 'fort' },
  { key: 'camps', kind: 'facility', shortLabel: '야영', iconKey: 'mainencampment' },
  { key: 'great_churches', kind: 'facility', shortLabel: '폐교회', iconKey: 'greatchurch' },
  { key: 'caravans', kind: 'facility', shortLabel: '상단', iconKey: 'mainencampment' },
  { key: 'townships', kind: 'facility', shortLabel: '마을', iconKey: 'township' },
  { key: 'spawn_points', kind: 'facility', shortLabel: '출격', iconKey: 'spawn' },
];

const bossDomains: LocaleDomainName[] = [
  'boss_castle',
  'boss_field',
  'boss_evergaol',
  'boss_night',
];

const seeds = seedData as SeedRow[];
const coordsByMap = coordsData as Record<string, CoordinatePoint[]>;
const mapBackgrounds = mapBackgroundData as Record<string, string>;
const poiById = new Map<number, [number, number]>(
  (poiData as PoiCoordinate[]).map((poi) => [Number(poi.id), poi.uv]),
);

function tr(domain: LocaleDomainName, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const text = String(value);
  return localeDomains[domain][text] ?? text;
}

function bossKo(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  for (const domain of bossDomains) {
    const translated = tr(domain, value);
    if (translated !== value) {
      return translated;
    }
  }
  return value;
}

function isKnownBossName(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return bossDomains.some((domain) => Boolean(localeDomains[domain][value]));
}

function slotBase(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  for (const suffix of slotAttributeSuffixes) {
    const token = `_${suffix}`;
    if (value.endsWith(token)) {
      return value.slice(0, -token.length);
    }
  }
  return value;
}

function slotAttribute(value: string) {
  for (const suffix of slotAttributeSuffixes) {
    const token = `_${suffix}`;
    if (value.endsWith(token)) {
      return attributeLabels[suffix] ?? suffix;
    }
  }
  return '';
}

function slotLabel(value: string) {
  if (isKnownBossName(value)) {
    return bossKo(value);
  }
  const base = slotBase(value);
  const baseLabel = buildingBaseLabels[base] ?? value;
  const attribute = slotAttribute(value);
  return attribute ? `${baseLabel} - ${attribute}` : baseLabel;
}

function detailSuffix(value: string) {
  const translated = tr('overlay_poi_values', value);
  const parts = translated.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ') : translated;
}

function slotDetails(value: string, mergedDetails: string[] = []) {
  if (isKnownBossName(value)) {
    return ['장소 보스', bossKo(value)];
  }
  const base = slotBase(value);
  const attribute = slotAttribute(value);

  if (base === 'mainencampment') {
    const details = [buildingBaseLabels[base] ?? value];
    details.push(...mergedDetails);
    details.push(`속성: ${attribute || '없음'}`);
    return details;
  }

  if (value === 'church_spawn') {
    return ['교회', '시작 교회', ...mergedDetails];
  }

  const details = [buildingBaseLabels[base] ?? value];
  details.push(...mergedDetails);
  if (attribute) {
    details.push(`속성: ${attribute}`);
  }
  return details;
}

function poiDetails(item: PatternPoint, kind: PoiMarker['kind']) {
  const value = item.value ?? item.boss ?? item.event ?? '';
  const details: string[] = [];

  if (kind === 'rise') {
    details.push('마술사의 탑');
    details.push(`공략법: ${detailSuffix(value)}`);
  } else if (kind === 'church') {
    details.push('교회');
    details.push(detailSuffix(value));
  } else if (kind === 'field') {
    details.push('필드 보스');
    details.push(bossKo(item.boss));
  } else if (kind === 'evergaol') {
    details.push('봉인감옥 보스');
    details.push(bossKo(item.boss));
  } else if (kind === 'castle') {
    details.push('성 보스');
    details.push(bossKo(item.boss));
  } else if (kind === 'event') {
    details.push('특수 이벤트');
    details.push(tr('events_labels', item.event));
  } else {
    details.push('장소 정보');
    details.push(detailSuffix(value));
  }

  return details.filter(Boolean);
}

function formatLayoutNumber(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return String(numeric).padStart(numeric >= 1000 ? 4 : 3, '0');
}

function formatSeedNumber(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return String(numeric);
}

function isEverdarkLayout(nightlord: string, layoutNumber: string | number) {
  if (nightlord === 'Harmonia' || nightlord === 'Straghess') {
    return false;
  }
  return Number(layoutNumber) >= 1000;
}

function mapTypeLabel(mapType: string) {
  const translated = tr('shifting_earth_labels', mapType);
  if (translated !== mapType) {
    return translated;
  }
  return mapTypeFallbackLabels[mapType] ?? mapType;
}

function assetByFileName(assets: Record<string, string>, fileName: string) {
  const match = Object.entries(assets).find(([path]) => path.endsWith(`/${fileName}`));
  return match?.[1] ?? null;
}

function mapImageUrl(mapType: string) {
  const relPath = mapBackgrounds[mapType] ?? `${mapType}.webp`;
  const fileName = relPath.split('/').pop() ?? relPath;
  return assetByFileName(mapImages, fileName);
}

function iconUrlForSlot(value: string) {
  const exact = assetByFileName(buildingIcons, `${value}.webp`);
  if (exact) {
    return exact;
  }
  const base = slotBase(value);
  return assetByFileName(buildingIcons, `${base}.webp`);
}

function iconUrlForKey(key: string) {
  return assetByFileName(buildingIcons, `${key}.webp`) ?? assetByFileName(buildingIcons, 'empty.webp') ?? '';
}

function iconUrlForCastleKey(key: PatternListKey) {
  if (key === 'small_castle') {
    return iconUrlForKey('small_castle');
  }
  return iconUrlForKey('medium_castle');
}

function poiPosition(poiId: number | null | undefined) {
  if (poiId === null || poiId === undefined) {
    return null;
  }
  const uv = poiById.get(Number(poiId));
  if (!uv) {
    return null;
  }
  return { x: uv[0] * 100, y: uv[1] * 100 };
}

function focusedBossRows(pattern: PatternRow | undefined): DetailRow[] {
  if (!pattern) {
    return [];
  }

  const rows: DetailRow[] = [];
  const night1Boss = bossKo(pattern.night1?.boss);
  const night2Boss = bossKo(pattern.night2?.boss);

  if (night1Boss) {
    rows.push({ id: 'night-1', label: `1일차 밤보스: ${night1Boss}` });
  }
  if (night2Boss) {
    rows.push({ id: 'night-2', label: `2일차 밤보스: ${night2Boss}` });
  }

  for (const [location, label] of Object.entries(focusedFieldBossLocations)) {
    const boss = (pattern.field_bosses ?? []).find((item) => item.location === location);
    if (boss?.boss) {
      rows.push({
        id: `field-${location}-${boss.poi_id ?? boss.boss}`,
        label: `${label}: ${bossKo(boss.boss)}`,
      });
    }
  }

  return rows;
}

function clampZoom(value: number) {
  return Math.min(2.5, Math.max(1, value));
}

function touchDistance(touches: TouchEvent<HTMLDivElement>['touches']) {
  if (touches.length < 2) {
    return null;
  }
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function seedForPattern(nightlord: string, pattern: PatternRow) {
  return seeds.find(
    (seed) =>
      seed.nightlord === nightlord &&
      Number(seed.seed_id) === Number(pattern.layout_number),
  );
}

function mapTypesForNightlord(nightlord: string) {
  if (nightlord === allNightlordsKey) {
    const mapTypes = Array.from(
      new Set(
        Object.values(patternsByNightlord)
          .flat()
          .map((pattern) => pattern.shifting_earth),
      ),
    );
    return mapTypes.sort((left, right) => mapTypeLabel(left).localeCompare(mapTypeLabel(right)));
  }

  const mapTypes = Array.from(
    new Set((patternsByNightlord[nightlord] ?? []).map((pattern) => pattern.shifting_earth)),
  );
  return mapTypes.sort((left, right) => mapTypeLabel(left).localeCompare(mapTypeLabel(right)));
}

function candidateEntries(nightlord: string, mapType: string): CandidateEntry[] {
  if (nightlord === allNightlordsKey) {
    return Object.entries(patternsByNightlord).flatMap(([patternNightlord, patterns]) =>
      patterns.flatMap((pattern) => {
        if (pattern.shifting_earth !== mapType) {
          return [];
        }
        const seed = seedForPattern(patternNightlord, pattern);
        return seed ? [{ pattern, seed }] : [];
      }),
    );
  }

  return (patternsByNightlord[nightlord] ?? []).flatMap((pattern) => {
    if (pattern.shifting_earth !== mapType) {
      return [];
    }
    const seed = seedForPattern(nightlord, pattern);
    return seed ? [{ pattern, seed }] : [];
  });
}

function candidateKey(candidate: CandidateEntry) {
  return `${candidate.seed.nightlord}-${candidate.seed.seed_id}`;
}

function matchesSlotSelections(seed: SeedRow, selections: Record<string, string>, exceptSlotId?: string) {
  return Object.entries(selections).every(([slotId, value]) => {
    if (slotId === exceptSlotId) {
      return true;
    }
    return seed.slots[slotId] === value;
  });
}

function slotKind(value: string): SlotOverlay['kind'] {
  if (isKnownBossName(value)) {
    return 'boss';
  }
  return slotBase(value) === 'spawn' ? 'spawn' : 'facility';
}

function createSlotOverlay(slotId: string, point: CoordinatePoint, value: string): SlotOverlay {
  const kind = slotKind(value);
  return {
    id: slotId,
    itemId: `slot-${slotId}`,
    x: point.x / 10,
    y: point.y / 10,
    rawValue: value,
    label: slotLabel(value),
    details: slotDetails(value),
    iconUrl: kind === 'boss' ? iconUrlForKey('empty') : (iconUrlForSlot(value) ?? iconUrlForKey('empty')),
    kind,
  };
}

function createUnknownSlotOverlay(slotId: string, point: CoordinatePoint, value = ''): SlotOverlay {
  if (value) {
    return createSlotOverlay(slotId, point, value);
  }
  return {
    id: slotId,
    itemId: `slot-${slotId}`,
    x: point.x / 10,
    y: point.y / 10,
    rawValue: '',
    label: `슬롯 ${slotId}`,
    details: ['이 위치의 요소를 선택하세요.'],
    iconUrl: '',
    kind: 'unknown',
  };
}

function facilityPoiKey(key: PatternListKey, item: PatternPoint) {
  return `${key}-${item.poi_id ?? 'none'}-${item.value ?? item.boss ?? item.event ?? ''}`;
}

function slotBasesForFacility(key: PatternListKey) {
  const bases: Partial<Record<PatternListKey, string[]>> = {
    churches: ['church', 'church_spawn'],
    sorcerers_rises: ['sorcerers'],
    ruins: ['ruins'],
    forts: ['fort'],
    camps: ['mainencampment'],
    great_churches: ['greatchurch'],
    caravans: ['caravan'],
    townships: ['township'],
    spawn_points: ['spawn'],
  };
  return bases[key] ?? [];
}

function facilityMergeDetails(key: PatternListKey, item: PatternPoint) {
  const value = item.value ?? item.boss ?? item.event ?? '';
  if (key === 'sorcerers_rises') {
    return [`공략법: ${detailSuffix(value)}`];
  }
  if (key === 'churches') {
    return [`종류: ${detailSuffix(value)}`];
  }
  if (key === 'spawn_points') {
    return ['출격 지점'];
  }
  if (key === 'caravans') {
    return ['소규모 캠프'];
  }
  return [`보스: ${detailSuffix(value)}`];
}

function assignFacilityPoisToSlots(slots: SlotOverlay[], pattern: PatternRow | undefined) {
  const bySlot = new Map<string, string[]>();
  const assignedPoiKeys = new Set<string>();
  if (!pattern) {
    return { bySlot, assignedPoiKeys };
  }

  const candidates = facilityMarkerGroups.flatMap((group) => {
    const compatibleBases = slotBasesForFacility(group.key);
    if (compatibleBases.length === 0) {
      return [];
    }
    return (pattern[group.key] ?? []).flatMap((item) => {
      const position = poiPosition(item.poi_id);
      if (!position) {
        return [];
      }
      return slots
        .filter((slot) => compatibleBases.includes(slotBase(slot.rawValue)))
        .map((slot) => ({
          slot,
          item,
          key: group.key,
          distance: Math.hypot(slot.x - position.x, slot.y - position.y),
        }));
    });
  })
    .filter((candidate) => candidate.distance <= facilityPoiMergeDistance)
    .sort((left, right) => left.distance - right.distance);

  const usedSlots = new Set<string>();
  for (const candidate of candidates) {
    const key = facilityPoiKey(candidate.key, candidate.item);
    if (usedSlots.has(candidate.slot.itemId) || assignedPoiKeys.has(key)) {
      continue;
    }
    bySlot.set(candidate.slot.itemId, facilityMergeDetails(candidate.key, candidate.item));
    assignedPoiKeys.add(key);
    usedSlots.add(candidate.slot.itemId);
  }

  return { bySlot, assignedPoiKeys };
}

const MapPage = () => {
  const [selectedNightlord, setSelectedNightlord] = useState('Gladius');
  const [selectedMapType, setSelectedMapType] = useState('Default');
  const [selectedSlotValues, setSelectedSlotValues] = useState<Record<string, string>>({});
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showPoiMarkers, setShowPoiMarkers] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const mapDragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);
  const suppressMapClickRef = useRef(false);

  const nightlordOptions = useMemo(
    () => [allNightlordsKey, ...nightlordOrder.filter((nightlord) => patternsByNightlord[nightlord])],
    [],
  );

  const mapTypeOptions = useMemo(() => mapTypesForNightlord(selectedNightlord), [selectedNightlord]);
  const currentMapType = mapTypeOptions.includes(selectedMapType)
    ? selectedMapType
    : (mapTypeOptions[0] ?? 'Default');
  const baseCandidates = useMemo(
    () => candidateEntries(selectedNightlord, currentMapType),
    [currentMapType, selectedNightlord],
  );
  const matchingCandidates = useMemo(
    () => baseCandidates.filter((candidate) => matchesSlotSelections(candidate.seed, selectedSlotValues)),
    [baseCandidates, selectedSlotValues],
  );
  const selectedCandidate = useMemo(
    () => matchingCandidates.find((candidate) => candidateKey(candidate) === selectedCandidateKey) ?? null,
    [matchingCandidates, selectedCandidateKey],
  );
  const solvedCandidate = selectedCandidate ?? (matchingCandidates.length === 1 ? matchingCandidates[0] : null);
  const currentPattern = solvedCandidate?.pattern;
  const currentSeed = solvedCandidate?.seed;
  const currentLayoutNumber = currentPattern?.layout_number ?? '';
  const backgroundUrl = mapImageUrl(currentMapType);

  const baseSlotOverlays = useMemo<SlotOverlay[]>(() => {
    const coordinates = coordsByMap[currentMapType] ?? coordsByMap.Default ?? [];
    const overlays: SlotOverlay[] = [];

    for (const point of coordinates) {
      const rawId = String(point.id);
      if (rawId === 'nightlord') {
        continue;
      }
      const slotId = rawId.length === 1 ? rawId.padStart(2, '0') : rawId;

      if (currentSeed) {
        const rawValue = currentSeed.slots[slotId];
        if (!rawValue) {
          continue;
        }
        overlays.push(createSlotOverlay(slotId, point, rawValue));
        continue;
      }

      const selectedValue = selectedSlotValues[slotId] ?? '';
      const canHaveValue = baseCandidates.some((candidate) => Boolean(candidate.seed.slots[slotId]));
      if (!selectedValue && !canHaveValue) {
        continue;
      }
      overlays.push(createUnknownSlotOverlay(slotId, point, selectedValue));
    }

    return overlays;
  }, [baseCandidates, currentMapType, currentSeed, selectedSlotValues]);

  const facilityPoiAssignments = useMemo(
    () => assignFacilityPoisToSlots(baseSlotOverlays, currentPattern),
    [baseSlotOverlays, currentPattern],
  );

  const slotOverlays = useMemo(
    () =>
      baseSlotOverlays.map((slot) => ({
        ...slot,
        details: slotDetails(slot.rawValue, facilityPoiAssignments.bySlot.get(slot.itemId) ?? []),
      })),
    [baseSlotOverlays, facilityPoiAssignments],
  );

  const poiMarkers = useMemo<PoiMarker[]>(() => {
    if (!currentPattern) {
      return [];
    }

    const markers: PoiMarker[] = [];
    const addMarker = (
      id: string,
      poiId: number | null | undefined,
      kind: PoiMarker['kind'],
      shortLabel: string,
      label: string,
      details: string[],
      iconUrl: string,
      options: Pick<PoiMarker, 'isHotspot'> = {},
    ) => {
      const position = poiPosition(poiId);
      if (!position || !label) {
        return;
      }
      markers.push({
        id,
        x: position.x,
        y: position.y,
        kind,
        shortLabel,
        label,
        details,
        iconUrl,
        ...options,
      });
    };

    addMarker(
      'night-1',
      currentPattern.night1?.poi_id,
      'night1',
      '1밤',
      `1일차 밤 보스: ${bossKo(currentPattern.night1?.boss)}`,
      ['밤 보스', bossKo(currentPattern.night1?.boss)],
      iconUrlForKey('empty'),
    );
    addMarker(
      'night-2',
      currentPattern.night2?.poi_id,
      'night2',
      '2밤',
      `2일차 밤 보스: ${bossKo(currentPattern.night2?.boss)}`,
      ['밤 보스', bossKo(currentPattern.night2?.boss)],
      iconUrlForKey('empty'),
    );

    for (const item of currentPattern.special_events ?? []) {
      addMarker(
        `event-${item.poi_id}-${item.event}`,
        item.poi_id,
        'event',
        '이벤트',
        tr('events_labels', item.event),
        poiDetails(item, 'event'),
        iconUrlForKey('empty'),
      );
    }

    for (const item of currentPattern.field_bosses ?? []) {
      addMarker(
        `field-${item.poi_id}-${item.boss}`,
        item.poi_id,
        'field',
        '필드',
        bossKo(item.boss),
        poiDetails(item, 'field'),
        iconUrlForKey('boss'),
      );
    }

    for (const item of currentPattern.evergaols ?? []) {
      addMarker(
        `evergaol-${item.poi_id}-${item.boss}`,
        item.poi_id,
        'evergaol',
        '감옥',
        `봉인감옥: ${bossKo(item.boss)}`,
        poiDetails(item, 'evergaol'),
        '',
        { isHotspot: true },
      );
    }

    for (const key of ['castle', 'small_castle', 'medium_castle'] as PatternListKey[]) {
      for (const item of currentPattern[key] ?? []) {
        addMarker(
          `${key}-${item.poi_id}-${item.boss}`,
          item.poi_id,
          'castle',
          '성',
          `성: ${bossKo(item.boss)}`,
          poiDetails(item, 'castle'),
          iconUrlForCastleKey(key),
        );
      }
    }

    for (const group of facilityMarkerGroups) {
      for (const item of currentPattern[group.key] ?? []) {
        if (facilityPoiAssignments.assignedPoiKeys.has(facilityPoiKey(group.key, item))) {
          continue;
        }
        const value = item.value ?? '';
        addMarker(
          `${group.key}-${item.poi_id}-${value}`,
          item.poi_id,
          group.kind,
          group.shortLabel,
          tr('overlay_poi_values', value),
          poiDetails(item, group.kind),
          iconUrlForKey(group.iconKey),
        );
      }
    }

    return markers;
  }, [currentPattern, facilityPoiAssignments]);

  const selectedSlot = slotOverlays.find((slot) => slot.itemId === activeItemId);
  const activeSlotOptions = useMemo(() => {
    if (!selectedSlot) {
      return [];
    }
    const values = new Map<string, { value: string; label: string; iconUrl: string }>();
    for (const candidate of baseCandidates) {
      if (!matchesSlotSelections(candidate.seed, selectedSlotValues, selectedSlot.id)) {
        continue;
      }
      const value = candidate.seed.slots[selectedSlot.id];
      if (!value || values.has(value)) {
        continue;
      }
      values.set(value, {
        value,
        label: slotLabel(value),
        iconUrl: iconUrlForSlot(value) ?? iconUrlForKey('empty'),
      });
    }
    return Array.from(values.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [baseCandidates, selectedSlot, selectedSlotValues]);
  const focusedItemId = hoveredItemId ?? activeItemId;
  const focusedSlot = slotOverlays.find((slot) => slot.itemId === focusedItemId);
  const focusedMarker = poiMarkers.find((marker) => marker.id === focusedItemId);
  const focusedMapItem = focusedSlot
    ? {
        id: focusedSlot.itemId,
        x: focusedSlot.x,
        y: focusedSlot.y,
        kind: focusedSlot.kind,
        label: focusedSlot.label,
        details: focusedSlot.details,
      }
    : focusedMarker
      ? {
          id: focusedMarker.id,
          x: focusedMarker.x,
          y: focusedMarker.y,
          kind: focusedMarker.kind,
          label: focusedMarker.label,
          details: focusedMarker.details,
        }
      : null;
  const specialEvents = currentPattern?.special_events ?? [];
  const mainBossRows = focusedBossRows(currentPattern);
  const modeLabel = currentPattern
    ? isEverdarkLayout(currentPattern.nightlord, currentLayoutNumber)
      ? '영밤왕'
      : '일반'
    : '-';
  const extraNightBoss =
    currentPattern?.extra_night_boss && currentPattern.extra_night_boss !== 'empty'
      ? bossKo(currentPattern.extra_night_boss)
      : '';
  const selectedSlotCount = Object.keys(selectedSlotValues).length;
  const candidateRows = matchingCandidates;
  const zoomPercent = Math.round(mapZoom * 100);

  const toggleActiveItem = (itemId: string) => {
  setActiveItemId((current) => (current === itemId ? null : itemId));
  setHoveredItemId(null);
  };

  const selectCandidate = (candidate: CandidateEntry) => {
    setSelectedCandidateKey(candidateKey(candidate));
    setActiveItemId(null);
    setHoveredItemId(null);
  };

  const updateSlotValue = (slotId: string, value: string) => {
    setSelectedCandidateKey(null);
    setSelectedSlotValues((current) => ({ ...current, [slotId]: value }));
    setActiveItemId(`slot-${slotId}`);
    setHoveredItemId(null);
  };
  const clearSlotValue = (slotId: string) => {
    setSelectedCandidateKey(null);
    setSelectedSlotValues((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
  };
  const resetMapReader = () => {
    setSelectedNightlord('Gladius');
    setSelectedMapType('Default');
    setSelectedCandidateKey(null);
    setSelectedSlotValues({});
    setActiveItemId(null);
    setHoveredItemId(null);
    setShowLabels(false);
    setShowPoiMarkers(true);
    setMapZoom(1);
    mapViewportRef.current?.scrollTo({ left: 0, top: 0 });
  };
  const updateMapZoom = (nextZoom: number) => {
    setMapZoom(clampZoom(nextZoom));
  };
  const nudgeMapZoom = (delta: number) => {
    setMapZoom((currentZoom) => clampZoom(currentZoom + delta));
  };
  const startMapDrag = (clientX: number, clientY: number) => {
    const viewport = mapViewportRef.current;
    if (!viewport || mapZoom <= 1) {
      return;
    }
    mapDragRef.current = {
      startX: clientX,
      startY: clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
    };
  };
  const moveMapDrag = (clientX: number, clientY: number) => {
    const drag = mapDragRef.current;
    const viewport = mapViewportRef.current;
    if (!drag || !viewport) {
      return false;
    }
    const deltaX = clientX - drag.startX;
    const deltaY = clientY - drag.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      drag.moved = true;
      suppressMapClickRef.current = true;
    }
    viewport.scrollLeft = drag.scrollLeft - deltaX;
    viewport.scrollTop = drag.scrollTop - deltaY;
    return true;
  };
  const endMapDrag = () => {
    mapDragRef.current = null;
  };
  const handleMapWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    nudgeMapZoom(event.deltaY > 0 ? -0.15 : 0.15);
  };
  const handleMapMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    startMapDrag(event.clientX, event.clientY);
  };
  const handleMapMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (moveMapDrag(event.clientX, event.clientY)) {
      event.preventDefault();
    }
  };
  const handleMapMouseUp = () => {
    endMapDrag();
  };
  const handleMapClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressMapClickRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressMapClickRef.current = false;
  };
  const handleMapTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const distance = touchDistance(event.touches);
    if (distance !== null) {
      endMapDrag();
      pinchRef.current = { distance, zoom: mapZoom };
      return;
    }
    const touch = event.touches[0];
    if (touch) {
      startMapDrag(touch.clientX, touch.clientY);
    }
  };
  const handleMapTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const distance = touchDistance(event.touches);
    if (distance !== null && pinchRef.current) {
      event.preventDefault();
      updateMapZoom((pinchRef.current.zoom * distance) / pinchRef.current.distance);
      return;
    }
    const touch = event.touches[0];
    if (touch && moveMapDrag(touch.clientX, touch.clientY)) {
      event.preventDefault();
    }
  };
  const handleMapTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }
    if (event.touches.length === 0) {
      endMapDrag();
    }
  };

  return (
    <section className="map-page" aria-label="Nightreign 맵">
      <header className="map-page-heading">
        <div>
          <p className="list-page-kicker">Nightreign Map</p>
          <h2>맵 식별 도구</h2>
        </div>
        <div className="map-summary-pills" aria-label="현재 맵 요약">
          <span>{tr('nightlords', selectedNightlord)}</span>
          <span>{mapTypeLabel(currentMapType)}</span>
          <span>{currentPattern ? modeLabel : `후보 ${matchingCandidates.length}개`}</span>
          {currentPattern ? <span>Layout {formatLayoutNumber(currentLayoutNumber)}</span> : null}
        </div>
      </header>

      <div className="map-layout">
        <aside className="map-control-panel">
          <label>
            <span>밤의 왕</span>
            <select
              value={selectedNightlord}
              onChange={(event) => {
                const nextNightlord = event.target.value;
                const nextMapTypes = mapTypesForNightlord(nextNightlord);
                setSelectedNightlord(nextNightlord);
                setSelectedMapType(nextMapTypes.includes(selectedMapType) ? selectedMapType : (nextMapTypes[0] ?? 'Default'));
                setSelectedCandidateKey(null);
                setSelectedSlotValues({});
                setActiveItemId(null);
                setHoveredItemId(null);
              }}
            >
              {nightlordOptions.map((nightlord) => (
                <option key={nightlord} value={nightlord}>
                  {tr('nightlords', nightlord)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>맵 타입</span>
            <select
              value={currentMapType}
              onChange={(event) => {
                setSelectedMapType(event.target.value);
                setSelectedCandidateKey(null);
                setSelectedSlotValues({});
                setActiveItemId(null);
                setHoveredItemId(null);
              }}
            >
              {mapTypeOptions.map((mapType) => (
                <option key={mapType} value={mapType}>
                  {mapTypeLabel(mapType)}
                </option>
              ))}
            </select>
          </label>

          <div className="map-candidate-card">
            <span>남은 후보</span>
            <strong>{matchingCandidates.length}</strong>
            <small>선택한 슬롯 {selectedSlotCount}개</small>
            <button type="button" onClick={resetMapReader}>
              초기화
            </button>
          </div>

          <div className="map-toggle-row" role="group" aria-label="맵 표시 옵션">
            <label>
              <input
                type="checkbox"
                checked={showPoiMarkers}
                onChange={(event) => setShowPoiMarkers(event.target.checked)}
              />
              <span>보스/이벤트</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(event) => setShowLabels(event.target.checked)}
              />
              <span>이름 표시</span>
            </label>
          </div>

          <div className="map-stat-grid">
            <div>
              <span>전체 후보</span>
              <strong>{baseCandidates.length}</strong>
            </div>
            <div>
              <span>선택 슬롯</span>
              <strong>{selectedSlotCount}</strong>
            </div>
            <div>
              <span>표시 슬롯</span>
              <strong>{slotOverlays.length}</strong>
            </div>
            <div>
              <span>상태</span>
              <strong>{currentPattern ? '완성' : '식별중'}</strong>
            </div>
          </div>

          {!currentPattern ? (
            <section className="map-detail-card">
              <h3>슬롯 선택</h3>

    {selectedSlot ? (
      <div className="map-slot-picker">
        <div className="map-selected-detail">
          <strong>{selectedSlot.rawValue ? selectedSlot.label : `슬롯 ${selectedSlot.id}`}</strong>
          <span>가능한 요소 {activeSlotOptions.length}개</span>
        </div>

        {selectedSlot.rawValue ? (
          <button
            type="button"
            className="map-clear-selection"
            onClick={() => clearSlotValue(selectedSlot.id)}
          >
            이 슬롯 선택 해제
          </button>
        ) : null}

        <div className="map-option-list">
          {activeSlotOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={selectedSlot.rawValue === option.value ? 'is-selected' : ''}
              onClick={() => updateSlotValue(selectedSlot.id, option.value)}
            >
              <img src={option.iconUrl} alt="" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    ) : (
      <p>맵 위의 슬롯을 선택하면 가능한 요소가 표시됩니다.</p>
    )}
  </section>
) : null}
        </aside>

        <div className="map-stage-panel">
          <div className="map-zoom-control" aria-label="지도 확대 조절">
            <button type="button" onClick={() => nudgeMapZoom(0.25)} aria-label="지도 확대">
              +
            </button>
            <button type="button" className="map-zoom-reset" onClick={() => updateMapZoom(1)}>
              {zoomPercent}%
            </button>
            <button type="button" onClick={() => nudgeMapZoom(-0.25)} aria-label="지도 축소">
              -
            </button>
          </div>
          <div
            ref={mapViewportRef}
            className={`map-stage-viewport${mapZoom > 1 ? ' is-draggable' : ''}`}
            onWheel={handleMapWheel}
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={handleMapMouseUp}
            onClickCapture={handleMapClickCapture}
            onTouchStart={handleMapTouchStart}
            onTouchMove={handleMapTouchMove}
            onTouchEnd={handleMapTouchEnd}
            onTouchCancel={handleMapTouchEnd}
          >
            <div
              className="map-stage"
              style={{
                backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
                '--map-zoom': mapZoom,
              } as CSSProperties}
            >
              <div className="map-stage-shade" aria-hidden="true" />
              {slotOverlays.map((slot) => (
                <button
                  key={slot.itemId}
                  type="button"
                  className={`map-slot-marker is-${slot.kind}${activeItemId === slot.itemId ? ' is-active' : ''}`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  title={`슬롯 ${slot.id}: ${slot.label}`}
                  aria-label={`슬롯 ${slot.id}: ${slot.label}`}
                  onClick={() => toggleActiveItem(slot.itemId)}
                  onMouseEnter={() => setHoveredItemId(slot.itemId)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  onFocus={() => setHoveredItemId(slot.itemId)}
                  onBlur={() => setHoveredItemId(null)}
                >
                  {slot.kind === 'unknown' ? (
                    <span className="map-slot-placeholder">{slot.id}</span>
                  ) : (
                    <img src={slot.iconUrl} alt="" />
                  )}
                  {showLabels && slot.rawValue ? <span className="map-marker-label">{slot.label}</span> : null}
                </button>
              ))}

              {showPoiMarkers
                ? poiMarkers.map((marker) => (
                    <button
                      key={marker.id}
                      type="button"
                      className={`map-poi-marker is-${marker.kind}${marker.isHotspot ? ' is-hotspot' : ''}${activeItemId === marker.id ? ' is-active' : ''}`}
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                      title={marker.label}
                      aria-label={marker.label}
                      onClick={() => toggleActiveItem(marker.id)}
                      onMouseEnter={() => setHoveredItemId(marker.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      onFocus={() => setHoveredItemId(marker.id)}
                      onBlur={() => setHoveredItemId(null)}
                    >
                      {marker.isHotspot ? null : <img src={marker.iconUrl} alt="" />}
                      {showLabels && !marker.isHotspot ? <span className="map-marker-label">{marker.label}</span> : null}
                    </button>
                  ))
                : null}
              {focusedMapItem ? (
                <div
                  key={focusedMapItem.id}
                  className={`map-location-popover is-${focusedMapItem.kind}`}
                  style={{ left: `${focusedMapItem.x}%`, top: `${focusedMapItem.y}%` }}
                >
                  <strong>{focusedMapItem.label}</strong>
                  {focusedMapItem.details.map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="map-info-panel">
          <section className="map-info-card">
            <h3>{currentPattern ? '레이아웃 요약' : '시드 목록'}</h3>
            {currentPattern ? (
              <dl className="map-summary-list">
                <div>
                  <dt>시드</dt>
                  <dd>{currentSeed?.seed_id ?? formatLayoutNumber(currentLayoutNumber)}</dd>
                </div>
                <div>
                  <dt>맵 타입</dt>
                  <dd>{mapTypeLabel(currentMapType)}</dd>
                </div>
                <div>
                  <dt>1일차 밤 보스</dt>
                  <dd>{bossKo(currentPattern?.night1?.boss) || '-'}</dd>
                </div>
                <div>
                  <dt>2일차 밤 보스</dt>
                  <dd>{bossKo(currentPattern?.night2?.boss) || '-'}</dd>
                </div>
                {extraNightBoss ? (
                  <div>
                    <dt>추가 밤 보스</dt>
                    <dd>{extraNightBoss}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <div className="map-candidate-list">
                <p>슬롯을 선택해서 후보를 줄이면, 후보가 1개일 때 완성 지도가 표시됩니다.</p>
                <ul className="map-detail-list">
                  {candidateRows.map((candidate) => (
                    <li key={`${candidate.pattern.nightlord}-${candidate.pattern.layout_number}`}>
                      <button
                        type="button"
                        className="map-seed-option"
                        onClick={() => selectCandidate(candidate)}
                      >
                        <strong>시드 {formatSeedNumber(candidate.seed.seed_id)}</strong>
                        <span>{tr('nightlords', candidate.pattern.nightlord)} / {mapTypeLabel(candidate.pattern.shifting_earth)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {currentPattern ? (
            <section className="map-info-card">
              <h3>특수 이벤트</h3>
              {specialEvents.length > 0 ? (
                <ul className="map-detail-list">
                  {specialEvents.map((event, index) => (
                    <li key={`${event.event}-${event.poi_id ?? index}`}>
                      <strong>{tr('events_labels', event.event)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="map-empty-text">없음</p>
              )}
            </section>
          ) : null}

          {currentPattern ? (
            <section className="map-info-card">
              <h3>주요 보스</h3>
              <ul className="map-detail-list">
                {mainBossRows.map((row) => (
                  <li key={row.id}>
                    <strong>{row.label}</strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

        </aside>
      </div>
    </section>
  );
};

export default MapPage;
