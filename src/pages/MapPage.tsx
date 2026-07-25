import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type TouchEvent,
} from 'react';
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
import ResponsiveSelect from '../components/ResponsiveSelect';
import './MapPage.css';

// 지도 배경 이미지 가져오기
const mapImages = import.meta.glob('../assets/images/mapReader/mapTypes/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

// 건물과 장소 아이콘 가져오기
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
  k_event?: string;
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

interface SlotPoiAssignment {
  details: string[];
  label?: string;
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

// 밤의 왕별 지도 패턴
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

// 한글 번역 목록
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

// 밤의 왕 표시 순서
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

// 슬롯에 붙는 속성 이름
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

// 건물 기본 이름
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
  march: '호소',
  medium_castle: '성',
  ruins: '폐허',
  small_castle: '소형 성',
  sorcerers: '마술사의 탑',
  spawn: '시작 지점',
  temple: '신전',
  township: '마을',
};

// 슬롯 속성 한글 이름
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

// 번역이 없는 맵 타입 이름
const mapTypeFallbackLabels: Record<string, string> = {
  Default: '기본',
  'Forsaken Hollows': '대공동',
};

const focusedFieldBossLocations: Record<string, string> = {
  'Castle Rooftop': '성체 옥상',
  'Castle Basement': '성 지하실',
};

// 가까운 슬롯과 지도 위치를 합칠 거리
const facilityPoiMergeDistance = 3.6;
const fieldBossPoiMergeDistance = 0.25;

// 지도 시설별 마커 정보
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

// 보스 이름을 찾을 번역 목록
const bossDomains: LocaleDomainName[] = [
  'boss_castle',
  'boss_field',
  'boss_evergaol',
  'boss_night',
];

// 지도 원본 데이터 정리
const seeds = seedData as SeedRow[];
const coordsByMap = coordsData as Record<string, CoordinatePoint[]>;
const mapBackgrounds = mapBackgroundData as Record<string, string>;
const poiById = new Map<number, [number, number]>(
  (poiData as PoiCoordinate[]).map((poi) => [Number(poi.id), poi.uv]),
);

// 한글 번역 찾기
function tr(domain: LocaleDomainName, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const text = String(value);
  return localeDomains[domain][text] ?? text;
}

// 보스 한글 이름 찾기
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

// 등록된 보스 이름 확인
function isKnownBossName(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return bossDomains.some((domain) => Boolean(localeDomains[domain][value]));
}

// 슬롯 이름에서 속성 부분 제거
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

// 슬롯 속성 이름 찾기
function slotAttribute(value: string) {
  for (const suffix of slotAttributeSuffixes) {
    const token = `_${suffix}`;
    if (value.endsWith(token)) {
      return attributeLabels[suffix] ?? suffix;
    }
  }
  return '';
}

// 지도 슬롯에 표시할 이름
function slotLabel(value: string) {
  if (isKnownBossName(value)) {
    return bossKo(value);
  }
  const base = slotBase(value);
  const baseLabel = buildingBaseLabels[base] ?? value;
  const attribute = slotAttribute(value);
  return attribute ? `${baseLabel} - ${attribute}` : baseLabel;
}

// 번역 문구에서 세부 설명 분리
function detailSuffix(value: string) {
  const translated = tr('overlay_poi_values', value);
  const parts = translated.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ') : translated;
}

// 지도 슬롯 상세 설명
function slotDetails(value: string, mergedDetails: string[] = []) {
  if (isKnownBossName(value) && mergedDetails.length > 0) {
    return [bossKo(value), ...mergedDetails];
  }
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

// 지도 위치 상세 설명
function poiDetails(item: PatternPoint, kind: PoiMarker['kind']) {
  const value = item.value ?? item.boss ?? item.event ?? '';
  const eventLabel = item.k_event ?? tr('events_labels', item.event);
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
    details.push(eventLabel);
  } else {
    details.push('장소 정보');
    details.push(detailSuffix(value));
  }

  return details.filter(Boolean);
}

// 레이아웃 번호 표시 형식
function formatLayoutNumber(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return String(numeric).padStart(numeric >= 1000 ? 4 : 3, '0');
}

// 시드 번호 표시 형식
function formatSeedNumber(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return String(numeric);
}

// 영원한 밤 레이아웃 확인
function isEverdarkLayout(nightlord: string, layoutNumber: string | number) {
  if (nightlord === 'Harmonia' || nightlord === 'Straghess') {
    return false;
  }
  return Number(layoutNumber) >= 1000;
}

// 맵 타입 한글 이름
function mapTypeLabel(mapType: string) {
  const translated = tr('shifting_earth_labels', mapType);
  if (translated !== mapType) {
    return translated;
  }
  return mapTypeFallbackLabels[mapType] ?? mapType;
}

// 파일 이름으로 이미지 찾기
function assetByFileName(assets: Record<string, string>, fileName: string) {
  const match = Object.entries(assets).find(([path]) => path.endsWith(`/${fileName}`));
  return match?.[1] ?? null;
}

// 맵 타입에 맞는 배경 이미지
function mapImageUrl(mapType: string) {
  const relPath = mapBackgrounds[mapType] ?? `${mapType}.webp`;
  const fileName = relPath.split('/').pop() ?? relPath;
  return assetByFileName(mapImages, fileName);
}

// 슬롯 값에 맞는 아이콘
function iconUrlForSlot(value: string) {
  const exact = assetByFileName(buildingIcons, `${value}.webp`);
  if (exact) {
    return exact;
  }
  const base = slotBase(value);
  if (base === 'caravan') {
    return assetByFileName(buildingIcons, 'mainencampment.webp');
  }
  return assetByFileName(buildingIcons, `${base}.webp`);
}

// 공통 아이콘 찾기
function iconUrlForKey(key: string) {
  return assetByFileName(buildingIcons, `${key}.webp`) ?? assetByFileName(buildingIcons, 'empty.webp') ?? '';
}

// 성 종류에 맞는 아이콘
function iconUrlForCastleKey(key: PatternListKey) {
  if (key === 'small_castle') {
    return iconUrlForKey('small_castle');
  }
  return iconUrlForKey('medium_castle');
}

// 지도 위치 번호를 퍼센트 좌표로 변환
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

// 주요 보스 요약 목록
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

  rows.push({
    id: 'nightlord',
    label: `밤의 왕: ${tr('nightlords', pattern.nightlord)}`,
  });

  return rows;
}

// 지도 확대 범위 제한
function clampZoom(value: number) {
  return Math.min(2.5, Math.max(1, value));
}

// 두 손가락 사이 거리
function touchDistance(touches: TouchEvent<HTMLDivElement>['touches']) {
  if (touches.length < 2) {
    return null;
  }
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

// 두 손가락의 가운데 위치
function touchMidpoint(touches: TouchEvent<HTMLDivElement>['touches']) {
  if (touches.length < 2) {
    return null;
  }
  const first = touches[0];
  const second = touches[1];
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
}

// 패턴에 맞는 시드 찾기
function seedForPattern(nightlord: string, pattern: PatternRow) {
  return seeds.find(
    (seed) =>
      seed.nightlord === nightlord &&
      Number(seed.seed_id) === Number(pattern.layout_number),
  );
}

// 밤의 왕에 맞는 맵 타입 목록
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

// 밤의 왕과 맵 타입에 맞는 후보 목록
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

// 지도 후보 고유 번호
function candidateKey(candidate: CandidateEntry) {
  return `${candidate.seed.nightlord}-${candidate.seed.seed_id}`;
}

// 선택한 슬롯과 일치하는 시드 확인
function matchesSlotSelections(seed: SeedRow, selections: Record<string, string>, exceptSlotId?: string) {
  return Object.entries(selections).every(([slotId, value]) => {
    if (slotId === exceptSlotId) {
      return true;
    }
    return seed.slots[slotId] === value;
  });
}

// 슬롯 종류 확인
function slotKind(value: string): SlotOverlay['kind'] {
  if (isKnownBossName(value)) {
    return 'boss';
  }
  return slotBase(value) === 'spawn' ? 'spawn' : 'facility';
}

// 값이 정해진 지도 슬롯 만들기
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
    iconUrl: kind === 'boss' ? iconUrlForKey('boss') : (iconUrlForSlot(value) ?? iconUrlForKey('empty')),
    kind,
  };
}

// 아직 선택하지 않은 지도 슬롯 만들기
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

// 시설 위치 고유 번호
function facilityPoiKey(key: PatternListKey, item: PatternPoint) {
  return `${key}-${item.poi_id ?? 'none'}-${item.value ?? item.boss ?? item.event ?? ''}`;
}

// 대공동 밤 보스와 겹치는 슬롯 제외
function removeForsakenHollowsNight2OverlappingSlots(
  slots: SlotOverlay[],
  mapType: string,
  pattern: PatternRow | undefined,
) {
  if (mapType !== 'Forsaken Hollows') {
    return slots;
  }

  const night2Position = poiPosition(pattern?.night2?.poi_id);
  if (!night2Position) {
    return slots;
  }

  return slots.filter((slot) => Math.hypot(slot.x - night2Position.x, slot.y - night2Position.y) >= 0.2);
}

// 시설과 연결할 수 있는 슬롯 종류
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

// 시설과 합칠 상세 설명
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

// 필드 보스와 합칠 상세 설명
function fieldBossMergeDetails(item: PatternPoint) {
  const boss = bossKo(item.boss);
  return poiDetails(item, 'field').filter((detail) => detail && detail !== boss);
}

// 시설과 합칠 표시 이름
function facilityMergeLabel(key: PatternListKey, item: PatternPoint) {
  if (
    key === 'churches' ||
    key === 'sorcerers_rises' ||
    key === 'spawn_points' ||
    key === 'caravans' ||
    key === 'townships'
  ) {
    return '';
  }
  const value = item.value ?? item.boss ?? item.event ?? '';
  const translated = tr('overlay_poi_values', value);
  const detail = detailSuffix(value);
  return detail && detail !== translated ? detail : '';
}

// 가까운 시설 위치를 슬롯에 합치기
function assignFacilityPoisToSlots(slots: SlotOverlay[], pattern: PatternRow | undefined) {
  const bySlot = new Map<string, SlotPoiAssignment>();
  const assignedPoiKeys = new Set<string>();
  if (!pattern) {
    return { bySlot, assignedPoiKeys };
  }

  // 같은 종류의 슬롯과 시설 사이 거리 계산
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

  // 가까운 항목부터 하나씩 연결
  const usedSlots = new Set<string>();
  for (const candidate of candidates) {
    const key = facilityPoiKey(candidate.key, candidate.item);
    if (usedSlots.has(candidate.slot.itemId) || assignedPoiKeys.has(key)) {
      continue;
    }
    const label = facilityMergeLabel(candidate.key, candidate.item);
    bySlot.set(candidate.slot.itemId, {
      details: facilityMergeDetails(candidate.key, candidate.item),
      ...(label ? { label } : {}),
    });
    assignedPoiKeys.add(key);
    usedSlots.add(candidate.slot.itemId);
  }

  return { bySlot, assignedPoiKeys };
}

// 가까운 필드 보스를 슬롯에 합치기
function assignFieldBossPoisToSlots(slots: SlotOverlay[], pattern: PatternRow | undefined) {
  const bySlot = new Map<string, SlotPoiAssignment>();
  const assignedPoiKeys = new Set<string>();
  if (!pattern) {
    return { bySlot, assignedPoiKeys };
  }

  // 같은 보스 슬롯과 필드 보스 사이 거리 계산
  const candidates = (pattern.field_bosses ?? []).flatMap((item) => {
    const position = poiPosition(item.poi_id);
    if (!position || !item.boss) {
      return [];
    }
    return slots
      .filter((slot) => slot.kind === 'boss' && slot.rawValue === item.boss)
      .map((slot) => ({
        slot,
        item,
        distance: Math.hypot(slot.x - position.x, slot.y - position.y),
      }));
  })
    .filter((candidate) => candidate.distance <= fieldBossPoiMergeDistance)
    .sort((left, right) => left.distance - right.distance);

  const usedSlots = new Set<string>();
  for (const candidate of candidates) {
    const key = facilityPoiKey('field_bosses', candidate.item);
    if (usedSlots.has(candidate.slot.itemId) || assignedPoiKeys.has(key)) {
      continue;
    }
    bySlot.set(candidate.slot.itemId, {
      details: fieldBossMergeDetails(candidate.item),
      label: bossKo(candidate.item.boss),
    });
    assignedPoiKeys.add(key);
    usedSlots.add(candidate.slot.itemId);
  }

  return { bySlot, assignedPoiKeys };
}

// 지도 페이지 전체
const MapPage = () => {
  // 지도 선택과 표시 상태
  const [selectedNightlord, setSelectedNightlord] = useState('Gladius');
  const [selectedMapType, setSelectedMapType] = useState('Default');
  const [selectedSlotValues, setSelectedSlotValues] = useState<Record<string, string>>({});
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showPoiMarkers, setShowPoiMarkers] = useState(true);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [fullscreenPanel, setFullscreenPanel] = useState<
    'settings' | 'summary' | 'events' | 'bosses' | null
  >(null);

  // 지도 확대와 이동 상태
  const [mapZoom, setMapZoom] = useState(1);
  const mapZoomRef = useRef(1);
  const pendingMapScrollRef = useRef<{
    zoom: number;
    left: number;
    top: number;
  } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    zoom: number;
    contentX: number;
    contentY: number;
  } | null>(null);
  const mapPageRef = useRef<HTMLElement | null>(null);
  const mapStagePanelRef = useRef<HTMLDivElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const [mapFitSize, setMapFitSize] = useState<number | null>(null);
  const mapDragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);
  const suppressMapClickRef = useRef(false);

  // 밤의 왕과 맵 타입 선택 목록
  const nightlordOptions = useMemo(
    () => [allNightlordsKey, ...nightlordOrder.filter((nightlord) => patternsByNightlord[nightlord])],
    [],
  );

  const mapTypeOptions = useMemo(() => mapTypesForNightlord(selectedNightlord), [selectedNightlord]);
  const currentMapType = mapTypeOptions.includes(selectedMapType)
    ? selectedMapType
    : (mapTypeOptions[0] ?? 'Default');

  // 현재 조건에 맞는 시드 후보
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

  // 후보가 하나면 완성된 지도 사용
  const solvedCandidate = selectedCandidate ?? (matchingCandidates.length === 1 ? matchingCandidates[0] : null);
  const currentPattern = solvedCandidate?.pattern;
  const currentSeed = solvedCandidate?.seed;
  const currentLayoutNumber = currentPattern?.layout_number ?? '';
  const backgroundUrl = mapImageUrl(currentMapType);

  // 화면 크기에 맞는 지도 크기 계산
  useEffect(() => {
    const panel = mapStagePanelRef.current;
    if (!panel) return;

    const updateMapFitSize = () => {
      const visualViewport = window.visualViewport;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const panelWidth = panel.getBoundingClientRect().width;
      const panelInnerWidth = Math.max(240, panelWidth - 20);
      const isMobileFullscreen = isMapFullscreen && viewportWidth <= 780;
      const heightLimit = isMapFullscreen
        ? Math.max(240, viewportHeight - (isMobileFullscreen ? 0 : 20))
        : viewportWidth <= 780
          ? Math.max(260, viewportHeight - 160)
          : Number.POSITIVE_INFINITY;
      const nextSize = Math.floor(
        isMobileFullscreen
          ? Math.max(viewportWidth, heightLimit)
          : Math.min(panelInnerWidth, viewportWidth - 24, heightLimit),
      );

      setMapFitSize((currentSize) => (currentSize === nextSize ? currentSize : nextSize));
    };

    updateMapFitSize();

    const resizeObserver = new ResizeObserver(updateMapFitSize);
    resizeObserver.observe(panel);
    window.addEventListener('resize', updateMapFitSize);
    window.visualViewport?.addEventListener('resize', updateMapFitSize);
    window.visualViewport?.addEventListener('scroll', updateMapFitSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateMapFitSize);
      window.visualViewport?.removeEventListener('resize', updateMapFitSize);
      window.visualViewport?.removeEventListener('scroll', updateMapFitSize);
    };
  }, [isMapFullscreen]);

  // 현재 지도에 표시할 기본 슬롯
  const baseSlotOverlays = useMemo<SlotOverlay[]>(() => {
    const coordinates = coordsByMap[currentMapType] ?? coordsByMap.Default ?? [];
    const overlays: SlotOverlay[] = [];

    for (const point of coordinates) {
      const rawId = String(point.id);
      if (rawId === 'nightlord') {
        continue;
      }
      const slotId = rawId.length === 1 ? rawId.padStart(2, '0') : rawId;

      // 완성된 지도는 시드의 슬롯 값 사용
      if (currentSeed) {
        const rawValue = currentSeed.slots[slotId];
        if (!rawValue) {
          continue;
        }
        overlays.push(createSlotOverlay(slotId, point, rawValue));
        continue;
      }

      // 식별 중인 지도는 선택 가능한 빈 슬롯 표시
      const selectedValue = selectedSlotValues[slotId] ?? '';
      const canHaveValue = baseCandidates.some((candidate) => Boolean(candidate.seed.slots[slotId]));
      if (!selectedValue && !canHaveValue) {
        continue;
      }
      overlays.push(createUnknownSlotOverlay(slotId, point, selectedValue));
    }

    return overlays;
  }, [baseCandidates, currentMapType, currentSeed, selectedSlotValues]);

  // 슬롯에 합칠 시설 정보
  const facilityPoiAssignments = useMemo(
    () => assignFacilityPoisToSlots(baseSlotOverlays, currentPattern),
    [baseSlotOverlays, currentPattern],
  );

  // 슬롯에 합칠 필드 보스 정보
  const fieldBossPoiAssignments = useMemo(
    () => assignFieldBossPoisToSlots(baseSlotOverlays, currentPattern),
    [baseSlotOverlays, currentPattern],
  );

  // 최종 지도 슬롯 목록
  const slotOverlays = useMemo(
    () => {
      const slots = baseSlotOverlays.map((slot) => {
        const facilityAssignment = facilityPoiAssignments.bySlot.get(slot.itemId);
        const fieldBossAssignment = fieldBossPoiAssignments.bySlot.get(slot.itemId);
        const label = fieldBossAssignment?.label ?? facilityAssignment?.label ?? slot.label;

        return {
          ...slot,
          label,
          details: slotDetails(slot.rawValue, [
            ...(facilityAssignment?.details ?? []),
            ...(fieldBossAssignment?.details ?? []),
          ]),
        };
      });
      return removeForsakenHollowsNight2OverlappingSlots(slots, currentMapType, currentPattern);
    },
    [baseSlotOverlays, currentMapType, currentPattern, facilityPoiAssignments, fieldBossPoiAssignments],
  );

  // 보스와 이벤트 및 시설 마커 목록
  const poiMarkers = useMemo<PoiMarker[]>(() => {
    if (!currentPattern) {
      return [];
    }

    const markers: PoiMarker[] = [];
    // 위치가 있는 마커만 목록에 추가
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
        item.k_event ?? tr('events_labels', item.event),
        poiDetails(item, 'event'),
        iconUrlForKey('empty'),
      );
    }

    for (const item of currentPattern.field_bosses ?? []) {
      if (fieldBossPoiAssignments.assignedPoiKeys.has(facilityPoiKey('field_bosses', item))) {
        continue;
      }
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
        bossKo(item.boss),
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
  }, [currentPattern, facilityPoiAssignments, fieldBossPoiAssignments]);

  // 선택한 슬롯에서 가능한 값 목록
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

  // 슬롯 선택창 바깥 클릭 시 닫기
  useEffect(() => {
    if (!selectedSlot) return;

    const closeSlotPickerOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.map-slot-picker-popover, .map-slot-marker')) return;

      setActiveItemId((current) => current === selectedSlot.itemId ? null : current);
      setHoveredItemId(null);
    };

    document.addEventListener('pointerdown', closeSlotPickerOutside);
    return () => document.removeEventListener('pointerdown', closeSlotPickerOutside);
  }, [selectedSlot]);

  // 마우스와 키보드로 가리킨 지도 정보
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

  // 지도 항목 선택 및 해제
  const toggleActiveItem = (itemId: string) => {
  setActiveItemId((current) => (current === itemId ? null : itemId));
  setHoveredItemId(null);
  };

  // 시드 후보 직접 선택
  const selectCandidate = (candidate: CandidateEntry) => {
    setSelectedCandidateKey(candidateKey(candidate));
    setActiveItemId(null);
    setHoveredItemId(null);
  };

  // 슬롯 값 선택
  const updateSlotValue = (slotId: string, value: string) => {
    setSelectedCandidateKey(null);
    setSelectedSlotValues((current) => ({ ...current, [slotId]: value }));
    setActiveItemId(null);
    setHoveredItemId(null);
  };

  // 슬롯 값 선택 해제
  const clearSlotValue = (slotId: string) => {
    setSelectedCandidateKey(null);
    setSelectedSlotValues((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
  };

  // 지도 식별 조건 초기화
  const resetMapReader = () => {
    setSelectedNightlord('Gladius');
    setSelectedMapType('Default');
    setSelectedCandidateKey(null);
    setSelectedSlotValues({});
    setActiveItemId(null);
    setHoveredItemId(null);
    setShowLabels(false);
    setShowPoiMarkers(true);
    mapZoomRef.current = 1;
    pendingMapScrollRef.current = { zoom: 1, left: 0, top: 0 };
    setMapZoom(1);
  };

  // 지도 전체화면 변경
  const toggleMapFullscreen = () => {
    const nextFullscreen = !isMapFullscreen;
    setIsMapFullscreen(nextFullscreen);
    setFullscreenPanel(null);
    mapZoomRef.current = 1;
    pendingMapScrollRef.current = { zoom: 1, left: 0, top: 0 };
    setMapZoom(1);

    if (nextFullscreen) {
      const page = mapPageRef.current;
      if (page?.requestFullscreen) {
        void page.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
          // CSS fullscreen remains active as a fallback when native fullscreen is unavailable.
        });
      }
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        // State and CSS have already left fullscreen.
      });
    }
  };

  // 브라우저 전체화면 상태 맞추기
  useEffect(() => {
    const syncNativeFullscreenState = () => {
      if (document.fullscreenElement === mapPageRef.current) return;

      setIsMapFullscreen(false);
      setFullscreenPanel(null);
      mapZoomRef.current = 1;
      pendingMapScrollRef.current = { zoom: 1, left: 0, top: 0 };
      setMapZoom(1);
    };

    document.addEventListener('fullscreenchange', syncNativeFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncNativeFullscreenState);
  }, []);

  // 전체화면 스크롤과 ESC 키 처리
  useEffect(() => {
    if (!isMapFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleFullscreenKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (fullscreenPanel) {
        setFullscreenPanel(null);
        return;
      }
      mapZoomRef.current = 1;
      pendingMapScrollRef.current = { zoom: 1, left: 0, top: 0 };
      setMapZoom(1);
      setIsMapFullscreen(false);
    };

    window.addEventListener('keydown', handleFullscreenKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleFullscreenKeyDown);
    };
  }, [fullscreenPanel, isMapFullscreen]);

  // 확대 배율과 지도 스크롤 함께 변경
  const setMapZoomWithScroll = useCallback((nextZoom: number, left: number, top: number) => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;

    const clampedZoom = clampZoom(nextZoom);
    const zoomChanged = clampedZoom !== mapZoomRef.current;
    const hasPendingZoom = pendingMapScrollRef.current !== null;

    if (zoomChanged || hasPendingZoom) {
      pendingMapScrollRef.current = {
        zoom: clampedZoom,
        left,
        top,
      };
    } else {
      viewport.scrollLeft = left;
      viewport.scrollTop = top;
    }

    if (zoomChanged) {
      mapZoomRef.current = clampedZoom;
      setMapZoom(clampedZoom);
    }
  }, []);

  // 마우스 위치를 중심으로 지도 확대
  const zoomMapAtClientPoint = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;

    const currentZoom = mapZoomRef.current;
    const clampedZoom = clampZoom(nextZoom);
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const pendingScroll = pendingMapScrollRef.current;
    const currentLeft = pendingScroll?.zoom === currentZoom ? pendingScroll.left : viewport.scrollLeft;
    const currentTop = pendingScroll?.zoom === currentZoom ? pendingScroll.top : viewport.scrollTop;
    const contentX = (currentLeft + localX) / currentZoom;
    const contentY = (currentTop + localY) / currentZoom;

    setMapZoomWithScroll(
      clampedZoom,
      contentX * clampedZoom - localX,
      contentY * clampedZoom - localY,
    );
  }, [setMapZoomWithScroll]);

  // 확대 후 저장해 둔 스크롤 위치 적용
  useLayoutEffect(() => {
    const viewport = mapViewportRef.current;
    const pendingScroll = pendingMapScrollRef.current;
    if (!viewport || !pendingScroll || pendingScroll.zoom !== mapZoom) return;

    viewport.scrollLeft = pendingScroll.left;
    viewport.scrollTop = pendingScroll.top;
    pendingMapScrollRef.current = null;
  }, [mapZoom]);

  // 모바일 전체화면 지도 가운데 맞추기
  useLayoutEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport || !isMapFullscreen || window.innerWidth > 780 || mapZoomRef.current !== 1) {
      return;
    }

    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  }, [isMapFullscreen, mapFitSize]);

  // 마우스 휠 확대와 브라우저 기본 확대 막기
  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (event.target instanceof Element && event.target.closest('.map-slot-picker-popover')) {
        return;
      }
      event.preventDefault();
      if (event.deltaY === 0) return;

      const deltaPixels = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * viewport.clientHeight
          : event.deltaY;
      const zoomFactor = Math.min(1.25, Math.max(0.8, Math.exp(-deltaPixels * 0.0015)));
      zoomMapAtClientPoint(
        mapZoomRef.current * zoomFactor,
        event.clientX,
        event.clientY,
      );
    };
    const handleNativeTouchMove = (event: globalThis.TouchEvent) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
    };

    viewport.addEventListener('wheel', handleNativeWheel, { passive: false });
    viewport.addEventListener('touchmove', handleNativeTouchMove, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleNativeWheel);
      viewport.removeEventListener('touchmove', handleNativeTouchMove);
    };
  }, [zoomMapAtClientPoint]);

  // 지도 끌기 시작
  const startMapDrag = (clientX: number, clientY: number) => {
    const viewport = mapViewportRef.current;
    if (
      !viewport
      || (viewport.scrollWidth <= viewport.clientWidth && viewport.scrollHeight <= viewport.clientHeight)
    ) {
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

  // 지도 끌어서 이동
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

  // 지도 끌기 종료
  const endMapDrag = () => {
    mapDragRef.current = null;
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

  // 지도 이동 직후 잘못된 클릭 막기
  const handleMapClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressMapClickRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressMapClickRef.current = false;
  };

  // 한 손가락 이동과 두 손가락 확대 시작
  const handleMapTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const distance = touchDistance(event.touches);
    const midpoint = touchMidpoint(event.touches);
    if (distance !== null && midpoint) {
      endMapDrag();
      const viewport = mapViewportRef.current;
      if (!viewport) return;

      const zoom = mapZoomRef.current;
      const rect = viewport.getBoundingClientRect();
      const localX = midpoint.clientX - rect.left;
      const localY = midpoint.clientY - rect.top;
      const pendingScroll = pendingMapScrollRef.current;
      const currentLeft = pendingScroll?.zoom === zoom ? pendingScroll.left : viewport.scrollLeft;
      const currentTop = pendingScroll?.zoom === zoom ? pendingScroll.top : viewport.scrollTop;
      pinchRef.current = {
        distance,
        zoom,
        contentX: (currentLeft + localX) / zoom,
        contentY: (currentTop + localY) / zoom,
      };
      return;
    }
    const touch = event.touches[0];
    if (touch) {
      startMapDrag(touch.clientX, touch.clientY);
    }
  };

  // 두 손가락 간격에 맞춰 확대
  const handleMapTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const distance = touchDistance(event.touches);
    const midpoint = touchMidpoint(event.touches);
    if (distance !== null && midpoint && pinchRef.current) {
      event.preventDefault();
      const viewport = mapViewportRef.current;
      if (!viewport) return;

      const nextZoom = clampZoom((pinchRef.current.zoom * distance) / pinchRef.current.distance);
      const rect = viewport.getBoundingClientRect();
      const localX = midpoint.clientX - rect.left;
      const localY = midpoint.clientY - rect.top;
      setMapZoomWithScroll(
        nextZoom,
        pinchRef.current.contentX * nextZoom - localX,
        pinchRef.current.contentY * nextZoom - localY,
      );
      return;
    }
    const touch = event.touches[0];
    if (touch && moveMapDrag(touch.clientX, touch.clientY)) {
      event.preventDefault();
    }
  };

  // 터치 확대와 이동 종료
  const handleMapTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }
    if (event.touches.length === 0) {
      endMapDrag();
    }
  };

  // 지도 설정과 식별 결과 화면
  return (
    <section
      ref={mapPageRef}
      className={`map-page${isMapFullscreen ? ' is-map-fullscreen' : ''}`}
      aria-label="Nightreign 맵"
    >
      {/* 현재 지도 요약 */}
      <header className="map-page-heading">
        <div>
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
        {/* 밤의 왕과 맵 타입 설정 */}
        <aside className={`map-control-panel${fullscreenPanel === 'settings' ? ' is-open' : ''}`}>
          <div className="map-fullscreen-drawer-heading">
            <strong>지도 설정</strong>
            <button type="button" onClick={() => setFullscreenPanel(null)} aria-label="지도 설정 닫기">
              ×
            </button>
          </div>
          <label>
            <span>밤의 왕</span>
            <ResponsiveSelect
              value={selectedNightlord}
              ariaLabel="밤의 왕"
              sheetTitle="밤의 왕 선택"
              options={nightlordOptions.map((nightlord) => ({
                value: nightlord,
                label: tr('nightlords', nightlord),
              }))}
              onChange={(nextNightlord) => {
                const nextMapTypes = mapTypesForNightlord(nextNightlord);
                setSelectedNightlord(nextNightlord);
                setSelectedMapType(nextMapTypes.includes(selectedMapType) ? selectedMapType : (nextMapTypes[0] ?? 'Default'));
                setSelectedCandidateKey(null);
                setSelectedSlotValues({});
                setActiveItemId(null);
                setHoveredItemId(null);
              }}
            />
          </label>

          <label>
            <span>맵 타입</span>
            <ResponsiveSelect
              value={currentMapType}
              ariaLabel="맵 타입"
              sheetTitle="맵 타입 선택"
              options={mapTypeOptions.map((mapType) => ({
                value: mapType,
                label: mapTypeLabel(mapType),
              }))}
              onChange={(nextMapType) => {
                setSelectedMapType(nextMapType);
                setSelectedCandidateKey(null);
                setSelectedSlotValues({});
                setActiveItemId(null);
                setHoveredItemId(null);
              }}
            />
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

        </aside>

        {/* 지도 화면 */}
        <div
          ref={mapStagePanelRef}
          className="map-stage-panel"
          style={mapFitSize ? ({ '--map-fit-size': `${mapFitSize}px` } as CSSProperties) : undefined}
        >
          <button
            type="button"
            className="map-fullscreen-button"
            onClick={toggleMapFullscreen}
            aria-label={isMapFullscreen ? '지도 전체화면 종료' : '지도 전체화면'}
          >
            <span aria-hidden="true">{isMapFullscreen ? '×' : '⛶'}</span>
            <small>{isMapFullscreen ? '나가기' : '전체화면'}</small>
          </button>

          {/* 전체화면 메뉴 */}
          {isMapFullscreen ? (
            <nav className="map-fullscreen-nav" aria-label="전체화면 지도 메뉴">
              <button
                type="button"
                className={fullscreenPanel === 'settings' ? 'is-active' : ''}
                onClick={() => setFullscreenPanel((current) => current === 'settings' ? null : 'settings')}
              >
                설정
              </button>
              <button
                type="button"
                className={fullscreenPanel === 'summary' ? 'is-active' : ''}
                onClick={() => setFullscreenPanel((current) => current === 'summary' ? null : 'summary')}
              >
                요약
              </button>
              {currentPattern ? (
                <>
                  <button
                    type="button"
                    className={fullscreenPanel === 'events' ? 'is-active' : ''}
                    onClick={() => setFullscreenPanel((current) => current === 'events' ? null : 'events')}
                  >
                    특수<br />이벤트
                  </button>
                  <button
                    type="button"
                    className={fullscreenPanel === 'bosses' ? 'is-active' : ''}
                    onClick={() => setFullscreenPanel((current) => current === 'bosses' ? null : 'bosses')}
                  >
                    주요<br />보스
                  </button>
                </>
              ) : null}
            </nav>
          ) : null}

          <div
            ref={mapViewportRef}
            className={`map-stage-viewport${mapZoom > 1 || isMapFullscreen ? ' is-draggable' : ''}`}
            data-no-page-swipe
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
            {/* 지도 배경과 마커 */}
            <div
              className="map-stage"
              style={{
                backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
                '--map-zoom': mapZoom,
              } as CSSProperties}
            >
              <div className="map-stage-shade" aria-hidden="true" />
              {/* 식별 슬롯 마커 */}
              {slotOverlays.map((slot) => (
                <button
                  key={slot.itemId}
                  type="button"
                  className={`map-slot-marker is-${slot.kind}${activeItemId === slot.itemId ? ' is-active' : ''}`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
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

              {/* 보스와 이벤트 및 시설 마커 */}
              {showPoiMarkers
                ? poiMarkers.map((marker) => (
                    <button
                      key={marker.id}
                      type="button"
                      className={`map-poi-marker is-${marker.kind}${marker.isHotspot ? ' is-hotspot' : ''}${showLabels && marker.isHotspot ? ' has-visible-label' : ''}${activeItemId === marker.id ? ' is-active' : ''}`}
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                      aria-label={marker.label}
                      onClick={() => toggleActiveItem(marker.id)}
                      onMouseEnter={() => setHoveredItemId(marker.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      onFocus={() => setHoveredItemId(marker.id)}
                      onBlur={() => setHoveredItemId(null)}
                    >
                      {marker.isHotspot ? null : <img src={marker.iconUrl} alt="" />}
                      {showLabels ? <span className="map-marker-label">{marker.label}</span> : null}
                    </button>
                  ))
                : null}

              {/* 선택한 슬롯의 가능한 요소 */}
              {!currentPattern && selectedSlot ? (
                <div
                  className={`map-slot-picker-popover is-${selectedSlot.kind}${selectedSlot.x > 62 ? ' is-align-left' : ''}${selectedSlot.y < 26 ? ' is-align-top' : selectedSlot.y > 74 ? ' is-align-bottom' : ''}`}
                  style={{ left: `${selectedSlot.x}%`, top: `${selectedSlot.y}%` }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onTouchMove={(event) => event.stopPropagation()}
                >
                  <div className="map-slot-picker-heading">
                    <div className="map-selected-detail">
                      <strong>슬롯 {selectedSlot.id}</strong>
                      <span>
                        {selectedSlot.rawValue
                          ? `현재: ${selectedSlot.label}`
                          : `가능한 요소 ${activeSlotOptions.length}개`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="map-slot-picker-close"
                      onClick={() => toggleActiveItem(selectedSlot.itemId)}
                      aria-label={`슬롯 ${selectedSlot.id} 선택 목록 닫기`}
                    >
                      ×
                    </button>
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
              ) : null}

              {/* 가리킨 지도 항목 설명 */}
              {focusedMapItem && (!selectedSlot || focusedMapItem.id !== selectedSlot.itemId) ? (
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

        {/* 시드와 레이아웃 정보 */}
        <aside className={`map-info-panel${fullscreenPanel && fullscreenPanel !== 'settings' ? ' is-open' : ''}`}>
          <div className="map-fullscreen-drawer-heading">
            <strong>
              {fullscreenPanel === 'events'
                ? '특수 이벤트'
                : fullscreenPanel === 'bosses'
                  ? '주요 보스'
                  : currentPattern
                    ? '레이아웃 요약'
                    : '시드 목록'}
            </strong>
            <button type="button" onClick={() => setFullscreenPanel(null)} aria-label="정보 패널 닫기">
              ×
            </button>
          </div>

          {/* 완성 지도 요약 또는 시드 후보 */}
          <section className={`map-info-card map-summary-card${fullscreenPanel !== 'summary' ? ' is-fullscreen-panel-hidden' : ''}`}>
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
                <div>
                  <dt>밤의 왕</dt>
                  <dd>{tr('nightlords', currentPattern.nightlord)}</dd>
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

          {/* 특수 이벤트 목록 */}
          {currentPattern ? (
            <section className={`map-info-card map-events-card${fullscreenPanel !== 'events' ? ' is-fullscreen-panel-hidden' : ''}`}>
              <h3>특수 이벤트</h3>
              {specialEvents.length > 0 ? (
                <ul className="map-detail-list">
                  {specialEvents.map((event, index) => (
                    <li key={`${event.event}-${event.poi_id ?? index}`}>
                      <strong>{event.k_event ?? tr('events_labels', event.event)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="map-empty-text">없음</p>
              )}
            </section>
          ) : null}

          {/* 주요 보스 목록 */}
          {currentPattern ? (
            <section className={`map-info-card map-bosses-card${fullscreenPanel !== 'bosses' ? ' is-fullscreen-panel-hidden' : ''}`}>
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
