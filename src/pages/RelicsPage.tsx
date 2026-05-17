import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  relicEffectsKo,
  relicItemColorMap,
  relicRollAppData,
  relics,
  type Relic,
  type RelicEffect,
  type RelicRollEffect,
} from '../data/relics';
import RelicStorageSection from '../components/RelicStorageSection';
import {
  deleteRelicPreset,
  getStorageErrorMessage,
  listRelicPresets,
  listRelics,
  saveRelicPreset,
  type RelicPreset,
  type RelicPresetSlotInput,
  type StoredRelic,
  type StoredRelicOption,
} from '../api/storageApi';
import { nightfarers } from '../data/nightfarers';
import { vessels, type Vessel } from '../data/vessels';
import type { ParsedRelic, RelicScanResult } from '../utils/nightreignSaveParser';

type PresetColorMode = 'normal' | 'deep';
type PresetSlotRelics = Array<string | null>;
type RelicPageMode = 'catalog' | 'builder' | 'saved' | 'compare';
type ProtectedRelicPageMode = Exclude<RelicPageMode, 'catalog'>;
type RelicCollectionMode = 'catalog' | 'crafted';

const LOGIN_REQUIRED_MESSAGE = '로그인을 해주시길 바랍니다.';

type ComparablePresetEffect = {
  baseName: string;
  displayName: string;
  valueText: string;
  numericValue: number | null;
  isPercent: boolean;
  slotIndex: number;
  detail: string;
};

type PresetComparisonRow = {
  key: string;
  name: string;
  presetA: ComparablePresetEffect | null;
  presetB: ComparablePresetEffect | null;
  differenceText: string;
};

const ALL_CHARACTER_NAME = '전체 캐릭터';
const EMPTY_PRESET_SLOTS: PresetSlotRelics = [null, null, null, null, null, null];
const PRESET_SLOT_LABELS = ['1', '2', '3'];
const SAVE_PARSER_CACHE_KEY = 'nightreign_save_parser_result';
const EMPTY_EFFECT_ID = 0xffffffff;
const PRESET_COLOR_MODE_OPTIONS: Array<{ value: PresetColorMode; label: string }> = [
  { value: 'normal', label: '일반' },
  { value: 'deep', label: '깊은 밤' },
];

void PRESET_COLOR_MODE_OPTIONS;

const relicItemColorById = new Map(relicItemColorMap.map((entry) => [entry.itemId, entry]));
const relicEffectById = new Map(relicEffectsKo.map((effect) => [String(effect.id), effect]));
const relicCatalogById = new Map(relics.map((relic) => [relic.id, relic]));
const relicRollEffectById = new Map<string, RelicRollEffect>();
const relicRollDebuffById = new Map<string, RelicRollEffect>();

for (const mode of Object.values(relicRollAppData.modes)) {
  for (const effect of mode.effects) {
    relicRollEffectById.set(String(effect.id), effect);
  }
}

for (const debuffTable of Object.values(relicRollAppData.debuffTables)) {
  for (const effect of debuffTable.effects) {
    relicRollDebuffById.set(String(effect.id), effect);
  }
}

const relicAssetUrls = import.meta.glob('../assets/images/relics/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const nightAssetUrls = import.meta.glob('../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const vesselAssetUrls = import.meta.glob('../assets/images/vessels/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);
const vesselAssetUrlsByLower = new Map(
  Object.entries(vesselAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);

function resolveRelicImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return undefined;
  if (!imageUrl.startsWith('/src/assets/images/relics/')) return imageUrl;

  const assetPath = imageUrl.replace('/src/assets/images/relics/', '../assets/images/relics/');
  return relicAssetUrls[assetPath] ?? imageUrl;
}

function resolveNightAssetUrl(imageUrl: string | undefined) {
  if (!imageUrl) return undefined;
  if (!imageUrl.startsWith('/assets/images/night/')) return imageUrl;

  const assetPath = imageUrl.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? imageUrl;
}

function resolveVesselImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return undefined;
  if (!imageUrl.startsWith('/src/assets/images/Vessels/')) return imageUrl;

  const assetPath = imageUrl.replace('/src/assets/images/Vessels/', '../assets/images/vessels/');
  return (
    vesselAssetUrls[assetPath] ??
    vesselAssetUrlsByLower.get(assetPath.toLowerCase()) ??
    imageUrl
  );
}

function getNightfarerIconUrl(nightfarer: { nameImageUrl: string }) {
  return resolveNightAssetUrl(nightfarer.nameImageUrl);
}

function getVesselImageUrl(vessel: Vessel) {
  const imageUrl = vessel.nameImages
    .split('|')
    .map((item) => item.trim())
    .find(Boolean);

  return resolveVesselImageUrl(imageUrl);
}

function getRelicEffects(relic: Relic) {
  const mappedRelic = relic.id >= 2000 ? relicItemColorById.get(relic.id) : undefined;
  if (mappedRelic?.effects?.length) return mappedRelic.effects;

  if (relic.effects?.length) return relic.effects;

  if (!relic.raw) return [];

  try {
    const rawRelic = JSON.parse(relic.raw) as { effects?: number[] };
    return rawRelic.effects ?? [];
  } catch {
    return [];
  }
}

function getRelicEffectDetails(relic: Relic): RelicEffect[] {
  if (relic.id < 2000) return [];

  return getRelicEffects(relic)
    .map((effectId) => relicEffectById.get(String(effectId)))
    .filter((effect): effect is RelicEffect => Boolean(effect));
}

function matchesRelicSearch(relic: Relic, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    relic.id,
    relic.name,
    relic.nameOrNull,
    relic.color,
    relic.location,
    relic.type,
    relic.obtainable,
    relic.group,
    relic.description,
    ...getRelicEffects(relic),
    ...getRelicEffectDetails(relic).flatMap((effect) => [
      effect.name,
      effect.category,
      effect.desc,
    ]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function createEmptyPresetSlots(): PresetSlotRelics {
  return [...EMPTY_PRESET_SLOTS] as PresetSlotRelics;
}

function splitPresetList(value: string | undefined) {
  if (!value) return [];

  return value
    .split(/[|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRelicColor(color: string | undefined) {
  return (color ?? '').trim().toLowerCase();
}

function getRelicColorLabel(color: string | undefined) {
  const labels: Record<string, string> = {
    red: '빨강',
    blue: '파랑',
    yellow: '노랑',
    green: '초록',
    white: '자유',
    builder: '제작',
  };
  const normalizedColor = normalizeRelicColor(color);

  return labels[normalizedColor] ?? color ?? '-';
}

function getRelicColorClass(color: string | undefined) {
  const normalizedColor = normalizeRelicColor(color);
  return normalizedColor ? `relic-color-${normalizedColor}` : '';
}

function getVesselsForCharacter(characterName: string) {
  return vessels.filter(
    (vessel) => vessel.character === characterName || vessel.character === ALL_CHARACTER_NAME,
  );
}

function getDefaultVesselIndex(characterName: string) {
  const characterVessels = getVesselsForCharacter(characterName);
  return (
    characterVessels.find((vessel) => vessel.isDefault.toLowerCase() === 'yes')?.index ??
    characterVessels[0]?.index ??
    -1
  );
}

function getVesselColors(vessel: Vessel | undefined, colorMode: PresetColorMode) {
  if (!vessel) return [];

  return splitPresetList(colorMode === 'deep' ? vessel.deepRelicColors : vessel.relicColors);
}

function getPresetVesselSlotColors(vessel: Vessel | undefined) {
  return [...getVesselColors(vessel, 'normal'), ...getVesselColors(vessel, 'deep')];
}

function getPresetSlotModeLabel(slotIndex: number) {
  return slotIndex < 3 ? '일반' : '깊은 밤';
}

function getPresetSlotDisplayIndex(slotIndex: number) {
  return (slotIndex % 3) + 1;
}

function isDeepNightPresetRelic(relic: StoredRelic) {
  const modeId = relic.modeId.toLowerCase();
  return modeId.includes('deep') || modeId.includes('dn') || Boolean(relic.debuffs?.length);
}

function canRelicFitSlot(relic: StoredRelic, slotColor: string | undefined, slotIndex?: number) {
  const normalizedSlotColor = normalizeRelicColor(slotColor);
  if (!normalizedSlotColor) return false;
  if (slotIndex !== undefined && isDeepNightPresetRelic(relic) !== shouldIncludePresetDebuffs(slotIndex)) {
    return false;
  }
  if (normalizedSlotColor === 'white') return true;

  return normalizeRelicColor(relic.color) === normalizedSlotColor;
}

function sanitizePresetSlots(
  currentSlots: PresetSlotRelics,
  nextSlotColors: string[],
  nextOwnedRelics: StoredRelic[],
) {
  return currentSlots.map((relicId, slotIndex) => {
    const relic = relicId
      ? nextOwnedRelics.find((candidateRelic) => candidateRelic.relicId === relicId)
      : null;
    const slotColor = nextSlotColors[slotIndex];

    return relic && canRelicFitSlot(relic, slotColor, slotIndex) ? relicId : null;
  }) as PresetSlotRelics;
}

function removeMissingPresetRelics(
  currentSlots: PresetSlotRelics,
  nextOwnedRelics: StoredRelic[],
) {
  const ownedRelicIds = new Set(nextOwnedRelics.map((relic) => relic.relicId));

  return currentSlots.map((relicId) =>
    relicId && ownedRelicIds.has(relicId) ? relicId : null,
  ) as PresetSlotRelics;
}

function matchesStoredRelicPresetSearch(relic: StoredRelic, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    relic.itemId,
    relic.itemName,
    relic.color,
    relic.source,
    relic.modeId,
    ...relic.options.flatMap((option) => [
      option.name,
      option.detail,
      option.effectId,
      option.effectKey,
    ]),
    ...(relic.debuffs ?? []).flatMap((debuff) => [
      debuff.name,
      debuff.detail,
      debuff.effectId,
      debuff.effectKey,
    ]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function isUsableEffectId(effectId: number) {
  return effectId !== EMPTY_EFFECT_ID && effectId !== -1;
}

function getCachedSaveRelicName(relic: ParsedRelic) {
  return (
    relicItemColorById.get(relic.itemId)?.name ??
    relicCatalogById.get(relic.itemId)?.name ??
    `유물 ${relic.itemId}`
  );
}

function getCachedSaveRelicColor(relic: ParsedRelic) {
  return (
    relicItemColorById.get(relic.itemId)?.color ??
    relicCatalogById.get(relic.itemId)?.color ??
    relic.color
  );
}

function getRelicNameByItemId(itemId: number) {
  return relicItemColorById.get(itemId)?.name ?? relicCatalogById.get(itemId)?.name ?? `유물 ${itemId}`;
}

function getRelicColorByItemId(itemId: number) {
  return relicItemColorById.get(itemId)?.color ?? relicCatalogById.get(itemId)?.color ?? '';
}

function toCachedSaveRelicOption(effectId: number, slotIndex: number): StoredRelicOption | null {
  if (!isUsableEffectId(effectId)) return null;

  const relicEffect = relicEffectById.get(String(effectId));
  const rollEffect = relicRollEffectById.get(String(effectId));
  const debuffEffect = relicRollDebuffById.get(String(effectId));
  const effect = rollEffect ?? debuffEffect;

  return {
    slot: slotIndex + 1,
    effectId,
    ...(effect?.key ? { effectKey: effect.key } : {}),
    name: relicEffect?.name ?? effect?.effect_kor ?? effect?.effect ?? `효과 ${effectId}`,
    detail: relicEffect?.desc ?? effect?.effect_detail_kor ?? '',
  };
}

function getCachedSaveRelics() {
  try {
    const cachedResult = localStorage.getItem(SAVE_PARSER_CACHE_KEY);
    if (!cachedResult) return [];

    const parsedResult = JSON.parse(cachedResult) as Partial<RelicScanResult>;
    if (!Array.isArray(parsedResult.relics)) return [];

    const timestamp = new Date(0).toISOString();

    return parsedResult.relics.map((relic, index): StoredRelic => {
      const options = [
        relic.raw.effect1Id,
        relic.raw.effect2Id,
        relic.raw.effect3Id,
      ]
        .map((effectId, slotIndex) => toCachedSaveRelicOption(effectId, slotIndex))
        .filter((option): option is StoredRelicOption => Boolean(option));
      const debuffs = [
        relic.raw.effect4Id,
        relic.raw.effect5Id,
        relic.raw.effect6Id,
      ]
        .map((effectId, slotIndex) => toCachedSaveRelicOption(effectId, slotIndex))
        .filter((option): option is StoredRelicOption => Boolean(option));

      return {
        relicId: `save-cache-${relic.id || `${relic.itemId}-${index}`}`,
        userId: 'local-save-parser-cache',
        saveId: 'local-save-parser-cache',
        source: 'save',
        slotIndex: relic.slotIndex ?? index,
        itemId: relic.itemId,
        itemName: getCachedSaveRelicName(relic),
        color: getCachedSaveRelicColor(relic),
        modeId: relic.dn ? 'deep_night_save_cache' : 'save_cache',
        isValid: true,
        options,
        debuffs,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  } catch (error) {
    console.warn('세이브 분석 캐시 유물을 불러오지 못했습니다:', error);
    return [];
  }
}

function mergePresetRelics(storedRelics: StoredRelic[], cachedSaveRelics: StoredRelic[]) {
  const relicsById = new Map<string, StoredRelic>();

  for (const relic of [...storedRelics, ...cachedSaveRelics]) {
    relicsById.set(relic.relicId, relic);
  }

  return [...relicsById.values()];
}

function isQuestRelicItem(itemId: number) {
  const itemColorEntry = relicItemColorById.get(itemId);
  const catalogEntry = relicCatalogById.get(itemId);
  const typeText = [itemColorEntry?.type, catalogEntry?.type, catalogEntry?.raw]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return typeText.includes('quest') || typeText.includes('퀘스트');
}

function getStoredRelicImageUrl(relic: StoredRelic) {
  if (!isQuestRelicItem(relic.itemId)) return undefined;

  return resolveRelicImageUrl(relicCatalogById.get(relic.itemId)?.image);
}

function getStoredRelicOptionGroups(relic: StoredRelic, includeDebuffs = true) {
  return [1, 2, 3]
    .map((slot) => {
      const option = relic.options.find((candidate) => candidate.slot === slot);
      const debuff = includeDebuffs
        ? relic.debuffs?.find((candidate) => candidate.slot === slot)
        : undefined;

      if (!option && !debuff) return null;

      return {
        slot,
        option,
        debuff,
      };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
}

function getSavePresetSlotOptionGroups(effectIds: number[], includeDebuffs = true) {
  return [1, 2, 3]
    .map((slot) => {
      const option = toCachedSaveRelicOption(effectIds[slot - 1] ?? EMPTY_EFFECT_ID, slot - 1);
      const debuff = includeDebuffs
        ? toCachedSaveRelicOption(effectIds[slot + 2] ?? EMPTY_EFFECT_ID, slot - 1)
        : null;

      if (!option && !debuff) return null;

      return {
        slot,
        option,
        debuff,
      };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
}

function isCachedSaveRelic(relic: StoredRelic) {
  return relic.relicId.startsWith('save-cache-');
}

function shouldIncludePresetDebuffs(slotIndex: number) {
  return slotIndex >= 3;
}

function getPresetRelicEffectIds(relic: StoredRelic, includeDebuffs: boolean) {
  const buffEffectIds = [1, 2, 3].map(
    (slot) => relic.options.find((option) => option.slot === slot)?.effectId ?? EMPTY_EFFECT_ID,
  );
  if (!includeDebuffs) return buffEffectIds;

  const debuffEffectIds = [1, 2, 3].map(
    (slot) => relic.debuffs?.find((debuff) => debuff.slot === slot)?.effectId ?? EMPTY_EFFECT_ID,
  );

  return [...buffEffectIds, ...debuffEffectIds];
}

function toPresetSlotInput(relic: StoredRelic, slotIndex: number): RelicPresetSlotInput {
  if (isCachedSaveRelic(relic)) {
    return {
      slotIndex,
      relicRefType: 'save',
      itemId: relic.itemId,
      effectIds: getPresetRelicEffectIds(relic, shouldIncludePresetDebuffs(slotIndex)),
    };
  }

  return {
    slotIndex,
    relicRefType: 'stored',
    relicId: relic.relicId,
  };
}

function getStoredRelicSourceLabel(source: StoredRelic['source']) {
  return source === 'builder' ? '제작' : '세이브';
}

function StoredRelicPresetChoice({
  disabledReason,
  includeDebuffs,
  isDisabled,
  isSelected,
  onSelect,
  relic,
}: {
  disabledReason: string;
  includeDebuffs: boolean;
  isDisabled: boolean;
  isSelected: boolean;
  onSelect: (relic: StoredRelic) => void;
  relic: StoredRelic;
}) {
  const relicImageUrl = getStoredRelicImageUrl(relic);
  const optionGroups = getStoredRelicOptionGroups(relic, includeDebuffs);

  return (
    <button
      type="button"
      className={`relic-preset-choice${isSelected ? ' is-selected' : ''}`}
      disabled={isDisabled}
      aria-pressed={isSelected}
      onClick={() => onSelect(relic)}
    >
      <div className={`relic-preset-choice-main${relicImageUrl ? '' : ' has-no-image'}`}>
        {relicImageUrl ? (
          <img className="relic-preset-choice-image" src={relicImageUrl} alt="" loading="lazy" />
        ) : null}
        <div>
          <div className="option-card-header">
            <span className={`option-category ${getRelicColorClass(relic.color)}`}>
              {getRelicColorLabel(relic.color)}
            </span>
            <span className="stored-relic-source">{getStoredRelicSourceLabel(relic.source)}</span>
          </div>
          <strong>{relic.itemName || `유물 ${relic.itemId}`}</strong>
        </div>
      </div>

      {optionGroups.length ? (
        <ol className="relic-preset-choice-options">
          {optionGroups.slice(0, 3).map((group) => (
            <li key={group.slot}>
              {group.option?.name ?? '옵션 정보 없음'}
              {group.debuff ? (
                <span className="relic-preset-choice-debuff">
                  ㄴ {group.debuff.name}
                  {group.debuff.detail ? ` ${group.debuff.detail}` : ''}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <span className="muted-text">옵션 정보 없음</span>
      )}

      {isSelected ? <em>선택됨</em> : null}
      {disabledReason ? <em>{disabledReason}</em> : null}
    </button>
  );
}

function PresetCharacterChoice({
  isSelected,
  name,
  iconUrl,
  onSelect,
}: {
  isSelected: boolean;
  name: string;
  iconUrl: string | undefined;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`relic-preset-character-choice${isSelected ? ' is-selected' : ''}`}
      aria-pressed={isSelected}
      onClick={onSelect}
    >
      {iconUrl ? <img src={iconUrl} alt="" aria-hidden="true" /> : null}
      <span>{name}</span>
    </button>
  );
}

function PresetVesselChoice({
  isSelected,
  onSelect,
  vessel,
}: {
  isSelected: boolean;
  onSelect: () => void;
  vessel: Vessel;
}) {
  const vesselImageUrl = getVesselImageUrl(vessel);
  const slotColors = getPresetVesselSlotColors(vessel);

  return (
    <button
      type="button"
      className={`relic-preset-vessel-choice${isSelected ? ' is-selected' : ''}`}
      aria-pressed={isSelected}
      onClick={onSelect}
    >
      {vesselImageUrl ? <img src={vesselImageUrl} alt="" aria-hidden="true" /> : null}
      <span>
        <strong>{vessel.name}</strong>
        {vessel.isDefault.toLowerCase() === 'yes' ? <em>기본</em> : null}
      </span>
      <span className="relic-preset-vessel-choice-colors" aria-hidden="true">
        {slotColors.map((slotColor, slotIndex) => (
          <i
            key={`${slotColor}-${slotIndex}`}
            className={`relic-preset-mini-color-dot ${getRelicColorClass(slotColor)}`}
          />
        ))}
      </span>
    </button>
  );
}

function RelicPresetBuilder({
  authUserId,
  searchQuery,
  storageRefreshKey,
}: {
  authUserId: string | null;
  searchQuery: string;
  storageRefreshKey: number;
}) {
  const characterOptions = useMemo(() => nightfarers.map((nightfarer) => nightfarer.name), []);
  const initialCharacter = characterOptions[0] ?? '';
  const [selectedCharacter, setSelectedCharacter] = useState(initialCharacter);
  const [selectedVesselIndex, setSelectedVesselIndex] = useState(
    getDefaultVesselIndex(initialCharacter),
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [presetName, setPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetSaveNotice, setPresetSaveNotice] = useState<string | null>(null);
  const [expandedSummarySlotIndex, setExpandedSummarySlotIndex] = useState<number | null>(null);
  const [placedRelicIds, setPlacedRelicIds] = useState<PresetSlotRelics>(createEmptyPresetSlots);
  const [ownedRelics, setOwnedRelics] = useState<StoredRelic[]>([]);
  const [isLoadingOwnedRelics, setIsLoadingOwnedRelics] = useState(false);
  const [ownedRelicNotice, setOwnedRelicNotice] = useState<string | null>(null);

  const availableVessels = useMemo(
    () => getVesselsForCharacter(selectedCharacter),
    [selectedCharacter],
  );
  const selectedVessel = useMemo(
    () =>
      availableVessels.find((vessel) => vessel.index === selectedVesselIndex) ??
      availableVessels[0],
    [availableVessels, selectedVesselIndex],
  );
  const selectedNightfarer = useMemo(
    () => nightfarers.find((nightfarer) => nightfarer.name === selectedCharacter),
    [selectedCharacter],
  );
  const normalSlotColors = useMemo(
    () => getVesselColors(selectedVessel, 'normal'),
    [selectedVessel],
  );
  const deepSlotColors = useMemo(
    () => getVesselColors(selectedVessel, 'deep'),
    [selectedVessel],
  );
  const slotColors = useMemo(
    () => [...normalSlotColors, ...deepSlotColors],
    [normalSlotColors, deepSlotColors],
  );
  const activeSlotColor = activeSlotIndex === null ? undefined : slotColors[activeSlotIndex];
  const selectedRelics = useMemo(
    () =>
      placedRelicIds.map((relicId) =>
        relicId ? ownedRelics.find((relic) => relic.relicId === relicId) ?? null : null,
      ),
    [ownedRelics, placedRelicIds],
  );
  const placedRelicCount = selectedRelics.filter(Boolean).length;
  const activeSlotCandidateCount = activeSlotColor
    ? ownedRelics.filter((relic) => canRelicFitSlot(relic, activeSlotColor, activeSlotIndex ?? undefined)).length
    : 0;
  const visibleCandidateRelics = useMemo(
    () =>
      activeSlotIndex !== null && activeSlotColor
        ? ownedRelics.filter((relic) => {
            const isCurrentSlotRelic = relic.relicId === placedRelicIds[activeSlotIndex];
            return (
              canRelicFitSlot(relic, activeSlotColor, activeSlotIndex) &&
              (isCurrentSlotRelic || matchesStoredRelicPresetSearch(relic, searchQuery))
            );
          })
        : [],
    [activeSlotColor, activeSlotIndex, ownedRelics, placedRelicIds, searchQuery],
  );

  useEffect(() => {
    let isCurrentRequest = true;

    Promise.resolve()
      .then(() => {
        if (!isCurrentRequest) return null;

        const cachedSaveRelics = getCachedSaveRelics();

        if (!authUserId) {
          setOwnedRelics(cachedSaveRelics);
          setOwnedRelicNotice(null);
          setIsLoadingOwnedRelics(false);
          setPlacedRelicIds((currentSlots) =>
            removeMissingPresetRelics(currentSlots, cachedSaveRelics),
          );
          return null;
        }

        setIsLoadingOwnedRelics(true);
        return listRelics(authUserId, 'all').then((storedRelics) => ({
          storedRelics,
          cachedSaveRelics,
        }));
      })
      .then((result) => {
        if (!isCurrentRequest || !result) return;

        const storedRelics = Array.isArray(result.storedRelics) ? result.storedRelics : [];
        const nextOwnedRelics = mergePresetRelics(storedRelics, result.cachedSaveRelics);
        setOwnedRelics(nextOwnedRelics);
        setPlacedRelicIds((currentSlots) =>
          removeMissingPresetRelics(currentSlots, nextOwnedRelics),
        );
        setOwnedRelicNotice(null);
      })
      .catch((error) => {
        if (!isCurrentRequest) return;
        const cachedSaveRelics = getCachedSaveRelics();
        setOwnedRelics(cachedSaveRelics);
        setPlacedRelicIds((currentSlots) =>
          removeMissingPresetRelics(currentSlots, cachedSaveRelics),
        );
        setOwnedRelicNotice(getStorageErrorMessage(error, '보유 유물을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingOwnedRelics(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [authUserId, storageRefreshKey]);

  function handleSelectRelic(relic: StoredRelic) {
    if (activeSlotIndex === null) return;
    if (!canRelicFitSlot(relic, activeSlotColor, activeSlotIndex)) return;

    const slotIndexToUpdate = activeSlotIndex;

    setPlacedRelicIds((currentSlots) => {
      const nextSlots = currentSlots.map((relicId, slotIndex) => {
        if (slotIndex === slotIndexToUpdate) {
          return relicId === relic.relicId ? null : relic.relicId;
        }
        return relicId === relic.relicId ? null : relicId;
      }) as PresetSlotRelics;

      return nextSlots;
    });
    setExpandedSummarySlotIndex(null);
    setActiveSlotIndex(null);
  }

  function handleClearSlot(slotIndex: number) {
    setPlacedRelicIds((currentSlots) => {
      const nextSlots = [...currentSlots] as PresetSlotRelics;
      nextSlots[slotIndex] = null;
      return nextSlots;
    });
    setExpandedSummarySlotIndex((currentIndex) => (currentIndex === slotIndex ? null : currentIndex));
  }

  function toggleSummarySlot(slotIndex: number) {
    if (!selectedRelics[slotIndex]) return;
    setExpandedSummarySlotIndex((currentIndex) => (currentIndex === slotIndex ? null : slotIndex));
  }

  function handleSummarySlotKeyDown(event: KeyboardEvent<HTMLLIElement>, slotIndex: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleSummarySlot(slotIndex);
  }

  function handleSelectCharacter(characterName: string) {
    const nextVesselIndex = getDefaultVesselIndex(characterName);
    const nextVessel = getVesselsForCharacter(characterName).find(
      (vessel) => vessel.index === nextVesselIndex,
    );
    const nextSlotColors = getPresetVesselSlotColors(nextVessel);

    setSelectedCharacter(characterName);
    setSelectedVesselIndex(nextVesselIndex);
    setActiveSlotIndex(null);
    setExpandedSummarySlotIndex(null);
    setPlacedRelicIds((currentSlots) =>
      sanitizePresetSlots(currentSlots, nextSlotColors, ownedRelics),
    );
  }

  function handleSelectVessel(nextVessel: Vessel) {
    const nextSlotColors = getPresetVesselSlotColors(nextVessel);

    setSelectedVesselIndex(nextVessel.index);
    setActiveSlotIndex(null);
    setExpandedSummarySlotIndex(null);
    setPlacedRelicIds((currentSlots) =>
      sanitizePresetSlots(currentSlots, nextSlotColors, ownedRelics),
    );
  }

  async function handleSavePreset() {
    const trimmedName = presetName.trim();
    setPresetSaveNotice(null);

    if (!authUserId) {
      setPresetSaveNotice('로그인 후 프리셋을 저장할 수 있습니다.');
      return;
    }

    if (!trimmedName) {
      setPresetSaveNotice('프리셋 이름을 입력하세요.');
      return;
    }

    if (!selectedVessel) {
      setPresetSaveNotice('현기를 선택하세요.');
      return;
    }

    if (placedRelicCount !== slotColors.length || selectedRelics.some((relic) => !relic)) {
      setPresetSaveNotice('모든 슬롯에 유물을 배치해야 저장할 수 있습니다.');
      return;
    }

    const slots = selectedRelics
      .map((relic, slotIndex) => (relic ? toPresetSlotInput(relic, slotIndex) : null))
      .filter((slot): slot is RelicPresetSlotInput => Boolean(slot));

    if (slots.length !== slotColors.length) {
      setPresetSaveNotice('저장할 슬롯 정보를 만들 수 없습니다.');
      return;
    }

    const payload = {
      userId: authUserId,
      name: trimmedName,
      characterName: selectedCharacter,
      vesselIndex: selectedVessel.index,
      colorMode: 'normal' as const,
      slots,
    };

    setIsSavingPreset(true);

    try {
      const savedPreset = await saveRelicPreset(payload);
      console.info('[RelicsPage] Preset saved response', savedPreset);
      setPresetSaveNotice('프리셋 저장 완료.');
    } catch (error) {
      console.error('[RelicsPage] Failed to save preset', {
        payload,
        error,
      });
      setPresetSaveNotice(getStorageErrorMessage(error, '프리셋 저장에 실패했습니다.'));
    } finally {
      setIsSavingPreset(false);
    }
  }

  function renderPresetSlotButton(slotLabel: string, slotIndex: number) {
    const slotColor = slotColors[slotIndex];
    const placedRelic = selectedRelics[slotIndex];
    const isActive = activeSlotIndex === slotIndex;

    return (
      <button
        key={`${getPresetSlotModeLabel(slotIndex)}-${slotLabel}`}
        type="button"
        className={`relic-preset-slot-button${isActive ? ' is-active' : ''}${placedRelic ? ' has-relic' : ''}`}
        aria-pressed={isActive}
        onClick={() => setActiveSlotIndex(slotIndex)}
      >
        <span>{slotLabel}</span>
        <strong>{getRelicColorLabel(slotColor)}</strong>
        <em>{placedRelic?.itemName || '비어 있음'}</em>
      </button>
    );
  }

  function renderSummarySlotItem(slotLabel: string, slotIndex: number) {
    const slotColor = slotColors[slotIndex];
    const placedRelic = selectedRelics[slotIndex];
    const includeDebuffs = shouldIncludePresetDebuffs(slotIndex);
    const optionGroups = placedRelic ? getStoredRelicOptionGroups(placedRelic, includeDebuffs) : [];
    const isExpanded = expandedSummarySlotIndex === slotIndex;

    return (
      <li
        key={`${getPresetSlotModeLabel(slotIndex)}-${slotLabel}`}
        className={`relic-preset-summary-slot${placedRelic ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}`}
        role={placedRelic ? 'button' : undefined}
        tabIndex={placedRelic ? 0 : undefined}
        aria-expanded={placedRelic ? isExpanded : undefined}
        onClick={() => toggleSummarySlot(slotIndex)}
        onKeyDown={(event) => handleSummarySlotKeyDown(event, slotIndex)}
      >
        <span>{slotLabel}</span>
        <div>
          <div className="relic-preset-summary-top">
            <strong>{getRelicColorLabel(slotColor)}</strong>
            {placedRelic ? (
              <button
                type="button"
                className="relic-preset-clear-slot"
                onClick={(event) => {
                  event.stopPropagation();
                  handleClearSlot(slotIndex);
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                해제
              </button>
            ) : null}
          </div>
          {placedRelic ? (
            <>
              <p>{placedRelic.itemName || `유물 ${placedRelic.itemId}`}</p>
              {isExpanded && optionGroups.length ? (
                <ol className="relic-preset-summary-options">
                  {optionGroups.map((group) => (
                    <li key={group.slot}>
                      <span>{group.slot}</span>
                      <div>
                        {group.option ? <strong>{group.option.name}</strong> : null}
                        {group.option?.detail ? <p>{group.option.detail}</p> : null}
                        {group.debuff ? (
                          <div className="relic-builder-result-debuff">
                            <em>디버프</em>
                            <strong>{group.debuff.name}</strong>
                            {group.debuff.detail ? <p>{group.debuff.detail}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : (
            <em>아직 배치되지 않았습니다.</em>
          )}
        </div>
      </li>
    );
  }

  return (
    <section className="relic-preset-builder" aria-labelledby="relic-preset-title">
      <div className="relic-preset-heading">
        <div>
          <p className="list-page-kicker">프리셋</p>
          <h3 id="relic-preset-title">프리셋 만들기</h3>
        </div>
        <span className="option-count">
          {placedRelicCount} / {slotColors.length || 3}
        </span>
      </div>

      <div className="relic-preset-layout">
        <section className="calc-panel relic-preset-controls" aria-label="프리셋 설정">
          <div className="calc-control-grid relic-preset-control-grid">
            <div className="relic-preset-current-character">
              <span>캐릭터</span>
              <strong>
                {selectedNightfarer ? (
                  <img src={getNightfarerIconUrl(selectedNightfarer)} alt="" aria-hidden="true" />
                ) : null}
                {selectedCharacter}
              </strong>
            </div>

            <button
              type="button"
              className="relic-builder-reset"
              onClick={() => setPlacedRelicIds(createEmptyPresetSlots())}
            >
              초기화
            </button>
          </div>

          <div className="relic-preset-save-panel">
            <label>
              프리셋 이름
              <input
                type="text"
                value={presetName}
                maxLength={40}
                placeholder="저장할 프리셋 이름"
                onChange={(event) => setPresetName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="relic-builder-save-button"
              disabled={isSavingPreset}
              onClick={handleSavePreset}
            >
              {isSavingPreset ? '저장 중...' : '프리셋 저장'}
            </button>
            {presetSaveNotice ? (
              <p className="relic-builder-save-notice">{presetSaveNotice}</p>
            ) : null}
          </div>

          <div className="relic-preset-choice-section" aria-label="캐릭터 선택">
            <span>캐릭터 선택</span>
            <div className="relic-preset-character-grid">
              {nightfarers.map((nightfarer) => (
                <PresetCharacterChoice
                  key={nightfarer.index}
                  name={nightfarer.name}
                  iconUrl={getNightfarerIconUrl(nightfarer)}
                  isSelected={nightfarer.name === selectedCharacter}
                  onSelect={() => handleSelectCharacter(nightfarer.name)}
                />
              ))}
            </div>
          </div>

          <div className="relic-preset-choice-section" aria-label="현기 선택">
            <span>현기 선택</span>
            <div className="relic-preset-vessel-grid">
              {availableVessels.map((vessel) => (
                <PresetVesselChoice
                  key={vessel.index}
                  vessel={vessel}
                  isSelected={selectedVessel?.index === vessel.index}
                  onSelect={() => handleSelectVessel(vessel)}
                />
              ))}
            </div>
          </div>

          {selectedVessel ? (
            <div className="relic-preset-vessel-card">
              <div>
                <span>{selectedVessel.character}</span>
                <strong>{selectedVessel.name}</strong>
              </div>
              <div className="relic-preset-vessel-color-groups">
                <div>
                  <span>일반</span>
                  <div className="relic-preset-color-row">
                    {normalSlotColors.map((slotColor, slotIndex) => (
                      <span
                        key={`normal-${slotColor}-${slotIndex}`}
                        className={`relic-preset-color-dot ${getRelicColorClass(slotColor)}`}
                        title={`일반 ${slotIndex + 1}번 ${getRelicColorLabel(slotColor)}`}
                      >
                        {slotIndex + 1}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span>깊은 밤</span>
                  <div className="relic-preset-color-row">
                    {deepSlotColors.map((slotColor, slotIndex) => (
                      <span
                        key={`deep-${slotColor}-${slotIndex}`}
                        className={`relic-preset-color-dot ${getRelicColorClass(slotColor)}`}
                        title={`깊은 밤 ${slotIndex + 1}번 ${getRelicColorLabel(slotColor)}`}
                      >
                        {slotIndex + 1}
                      </span>
                    ))}
                  </div>
                </div>
                {false ? slotColors.map((slotColor, slotIndex) => (
                  <span
                    key={`${slotColor}-${slotIndex}`}
                    className={`relic-preset-color-dot ${getRelicColorClass(slotColor)}`}
                    title={`${slotIndex + 1}번: ${getRelicColorLabel(slotColor)}`}
                  >
                    {slotIndex + 1}
                  </span>
                )) : null}
              </div>
            </div>
          ) : null}

          <div className="relic-preset-owned-count">
            <span>보유 유물</span>
            <strong>{ownedRelics.length}개</strong>
          </div>
        </section>

        <div className="relic-preset-main">
          <div className="relic-preset-slot-groups" aria-label="유물 프리셋 슬롯">
            <section className="relic-preset-slot-section">
              <h4>일반 유물</h4>
              <div className="relic-preset-slots">
                {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) =>
                  renderPresetSlotButton(slotLabel, slotIndex),
                )}
              </div>
            </section>
            <section className="relic-preset-slot-section">
              <h4>깊은 밤 유물</h4>
              <div className="relic-preset-slots">
                {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) =>
                  renderPresetSlotButton(slotLabel, slotIndex + 3),
                )}
              </div>
            </section>
          </div>
          <div className="relic-preset-slots is-legacy-hidden" aria-label="유물 프리셋 슬롯">
            {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) => {
              const slotColor = slotColors[slotIndex];
              const placedRelic = selectedRelics[slotIndex];
              const isActive = activeSlotIndex === slotIndex;

              return (
                <button
                  key={slotLabel}
                  type="button"
                  className={`relic-preset-slot-button${isActive ? ' is-active' : ''}${placedRelic ? ' has-relic' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => setActiveSlotIndex(slotIndex)}
                >
                  <span>{slotLabel}</span>
                  <strong>{getRelicColorLabel(slotColor)}</strong>
                  <em>{placedRelic?.itemName || '비어 있음'}</em>
                </button>
              );
            })}
          </div>

          {activeSlotIndex !== null ? (
            <section className="calc-panel relic-preset-candidates" aria-label="배치 가능한 보유 유물">
              <div className="relic-preset-candidates-heading">
                <div>
                  <span>
                    {getPresetSlotModeLabel(activeSlotIndex)} {getPresetSlotDisplayIndex(activeSlotIndex)}번 슬롯
                  </span>
                  <strong>{getRelicColorLabel(activeSlotColor)} 세이브/제작 유물</strong>
                </div>
                <em>
                  {visibleCandidateRelics.length} / {activeSlotCandidateCount}
                </em>
              </div>

              {!authUserId && !ownedRelics.length ? (
                <p className="storage-notice">로그인 후 보유 유물을 불러올 수 있습니다.</p>
              ) : ownedRelicNotice && !ownedRelics.length ? (
                <p className="storage-notice">{ownedRelicNotice}</p>
              ) : isLoadingOwnedRelics ? (
                <p className="muted-text">보유 유물을 불러오는 중...</p>
              ) : visibleCandidateRelics.length ? (
                <div className="relic-preset-choice-grid">
                  {visibleCandidateRelics.map((relic) => {
                    const usedSlotIndex = placedRelicIds.findIndex(
                      (relicId, slotIndex) =>
                        relicId === relic.relicId && slotIndex !== activeSlotIndex,
                    );

                    return (
                      <StoredRelicPresetChoice
                        key={relic.relicId}
                        relic={relic}
                        isSelected={placedRelicIds[activeSlotIndex] === relic.relicId}
                        isDisabled={false}
                        includeDebuffs={shouldIncludePresetDebuffs(activeSlotIndex)}
                        disabledReason={
                          usedSlotIndex === -1
                            ? ''
                            : `${getPresetSlotModeLabel(usedSlotIndex)} ${getPresetSlotDisplayIndex(usedSlotIndex)}번 슬롯에 배치됨`
                        }
                        onSelect={handleSelectRelic}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="muted-text">배치 가능한 보유 유물이 없습니다.</p>
              )}
            </section>
          ) : null}

          <section className="calc-panel relic-preset-summary" aria-label="프리셋 결과">
            <div className="relic-builder-result-heading">
              <h3>배치 결과</h3>
              <span className={placedRelicCount === slotColors.length ? 'is-valid' : 'is-pending'}>
                {placedRelicCount === slotColors.length ? '완성' : '선택 중'}
              </span>
            </div>

            <div className="relic-preset-summary-groups">
              <section className="relic-preset-summary-group">
                <h4>일반 유물</h4>
                <ol className="relic-builder-result-list">
                  {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) =>
                    renderSummarySlotItem(slotLabel, slotIndex),
                  )}
                </ol>
              </section>
              <section className="relic-preset-summary-group">
                <h4>깊은 밤 유물</h4>
                <ol className="relic-builder-result-list">
                  {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) =>
                    renderSummarySlotItem(slotLabel, slotIndex + 3),
                  )}
                </ol>
              </section>
            </div>

            <ol className="relic-builder-result-list is-legacy-hidden">
              {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) => {
                const slotColor = slotColors[slotIndex];
                const placedRelic = selectedRelics[slotIndex];
                const optionGroups = placedRelic
                  ? getStoredRelicOptionGroups(placedRelic, shouldIncludePresetDebuffs(slotIndex))
                  : [];
                const isExpanded = expandedSummarySlotIndex === slotIndex;

                return (
                  <li
                    key={slotLabel}
                    className={`relic-preset-summary-slot${placedRelic ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}`}
                    role={placedRelic ? 'button' : undefined}
                    tabIndex={placedRelic ? 0 : undefined}
                    aria-expanded={placedRelic ? isExpanded : undefined}
                    onClick={() => toggleSummarySlot(slotIndex)}
                    onKeyDown={(event) => handleSummarySlotKeyDown(event, slotIndex)}
                  >
                    <span>{slotLabel}</span>
                    <div>
                      <div className="relic-preset-summary-top">
                        <strong>{getRelicColorLabel(slotColor)}</strong>
                        {placedRelic ? (
                          <button
                            type="button"
                            className="relic-preset-clear-slot"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleClearSlot(slotIndex);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            해제
                          </button>
                        ) : null}
                      </div>
                      {placedRelic ? (
                        <>
                          <p>{placedRelic.itemName || `유물 ${placedRelic.itemId}`}</p>
                          {isExpanded && optionGroups.length ? (
                            <ol className="relic-preset-summary-options">
                              {optionGroups.map((group) => (
                                <li key={group.slot}>
                                  <span>{group.slot}</span>
                                  <div>
                                    {group.option ? <strong>{group.option.name}</strong> : null}
                                    {group.option?.detail ? <p>{group.option.detail}</p> : null}
                                    {group.debuff ? (
                                      <div className="relic-builder-result-debuff">
                                        <em>디버프</em>
                                        <strong>{group.debuff.name}</strong>
                                        {group.debuff.detail ? <p>{group.debuff.detail}</p> : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : null}
                        </>
                      ) : (
                        <em>아직 배치되지 않았습니다.</em>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </section>
  );
}

function getPresetVesselName(vesselIndex: number) {
  return vessels.find((vessel) => vessel.index === vesselIndex)?.name ?? `현기 ${vesselIndex}`;
}

function getPresetVessel(vesselIndex: number) {
  return vessels.find((vessel) => vessel.index === vesselIndex);
}

function getPresetNightfarer(characterName: string) {
  return nightfarers.find((nightfarer) => nightfarer.name === characterName);
}

function getSavedPresetSlots(slots: RelicPresetSlotInput[]) {
  const slotsByIndex = new Map(slots.map((slot) => [slot.slotIndex, slot]));

  return EMPTY_PRESET_SLOTS.map((_, slotIndex) => slotsByIndex.get(slotIndex) ?? null);
}

function SavedPresetVesselPreview({ vessel }: { vessel: Vessel | undefined }) {
  const slotColors = getPresetVesselSlotColors(vessel);

  return (
    <div className="saved-preset-vessel-preview">
      <div className="saved-preset-vessel-colors" aria-hidden="true">
        {slotColors.slice(0, 6).map((color, colorIndex) => (
          <span
            key={`${color}-${colorIndex}`}
            className={`relic-preset-color-dot ${getRelicColorClass(color)}${colorIndex === 3 ? ' is-deep-start' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function getPresetSlotOptionGroups(slot: RelicPresetSlotInput, relicsById: Map<string, StoredRelic>) {
  const storedRelic = slot.relicRefType === 'stored' ? relicsById.get(slot.relicId) : undefined;
  const includeDebuffs = shouldIncludePresetDebuffs(slot.slotIndex);

  if (slot.relicRefType === 'stored' && storedRelic) {
    return getStoredRelicOptionGroups(storedRelic, includeDebuffs);
  }

  if (slot.relicRefType === 'save') {
    return getSavePresetSlotOptionGroups(slot.effectIds, includeDebuffs);
  }

  return [];
}

function getComparisonValueMatch(text: string) {
  const matches = [...text.matchAll(/([+-]?\d+(?:\.\d+)?)\s*(%)?/g)];
  return matches[matches.length - 1] ?? null;
}

function cleanComparisonBaseName(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[,:：，]\s*$/, '')
    .trim();
}

function getComparablePresetEffect(
  effect: StoredRelicOption,
  slotIndex: number,
): ComparablePresetEffect {
  const name = effect.name.trim();
  const detail = effect.detail.trim();
  const nameMatch = getComparisonValueMatch(name);
  const detailMatch = getComparisonValueMatch(detail);
  const valueMatch = nameMatch ?? detailMatch;
  const valueText = valueMatch?.[0].trim() ?? (detail || name || '-');
  const numericValue = valueMatch ? Number(valueMatch[1]) : null;
  const isPercent = Boolean(valueMatch?.[2] || valueText.includes('%'));
  const baseName = cleanComparisonBaseName(
    nameMatch
      ? name.slice(0, nameMatch.index).trim()
      : name || (detailMatch ? detail.slice(0, detailMatch.index).trim() : detail),
  );

  return {
    baseName: baseName || name || detail || 'Unknown option',
    displayName: name || detail || 'Unknown option',
    valueText,
    numericValue: Number.isFinite(numericValue) ? numericValue : null,
    isPercent,
    slotIndex,
    detail,
  };
}

function getComparisonKey(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[+\-−]?\d+(?:\.\d+)?\s*%?/g, '')
    .replace(/[\s,:：，()[\]{}]+/g, ' ')
    .trim();
}

function formatComparisonNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function getComparisonDifferenceText(
  presetA: ComparablePresetEffect | null,
  presetB: ComparablePresetEffect | null,
) {
  if (!presetA) return '오른쪽 프리셋에만 포함';
  if (!presetB) return '왼쪽 프리셋에만 포함';

  if (presetA.numericValue === null || presetB.numericValue === null) {
    return presetA.valueText === presetB.valueText
      ? '동일한 값'
      : '숫자 계산 불가, 값을 직접 비교';
  }

  const delta = presetB.numericValue - presetA.numericValue;
  if (delta === 0) return '동일한 수치';

  const isPercent = presetA.isPercent || presetB.isPercent;
  const amount = isPercent
    ? `${formatComparisonNumber(Math.abs(delta))}%p`
    : `+${formatComparisonNumber(Math.abs(delta))}`;
  return delta > 0 ? `오른쪽 프리셋이 ${amount} 높음` : `왼쪽 프리셋이 ${amount} 높음`;
}

function collectPresetComparableEffects(
  preset: RelicPreset,
  relicsById: Map<string, StoredRelic>,
) {
  const normalOptions: ComparablePresetEffect[] = [];
  const debuffs: ComparablePresetEffect[] = [];

  for (const slot of preset.slots) {
    const optionGroups = getPresetSlotOptionGroups(slot, relicsById);
    for (const group of optionGroups) {
      if (group.option) {
        normalOptions.push(getComparablePresetEffect(group.option, slot.slotIndex));
      }
      if (group.debuff) {
        debuffs.push(getComparablePresetEffect(group.debuff, slot.slotIndex));
      }
    }
  }

  return { normalOptions, debuffs };
}

function buildComparisonRows(
  presetAEffects: ComparablePresetEffect[],
  presetBEffects: ComparablePresetEffect[],
) {
  const groupedA = new Map<string, ComparablePresetEffect[]>();
  const groupedB = new Map<string, ComparablePresetEffect[]>();
  const orderedKeys: string[] = [];
  const namesByKey = new Map<string, string>();

  function addEffect(
    groupedEffects: Map<string, ComparablePresetEffect[]>,
    effect: ComparablePresetEffect,
  ) {
    const key = getComparisonKey(effect.baseName) || effect.baseName;
    if (!groupedA.has(key) && !groupedB.has(key) && !orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
    namesByKey.set(key, namesByKey.get(key) ?? effect.baseName);
    groupedEffects.set(key, [...(groupedEffects.get(key) ?? []), effect]);
  }

  presetAEffects.forEach((effect) => addEffect(groupedA, effect));
  presetBEffects.forEach((effect) => addEffect(groupedB, effect));

  return orderedKeys.flatMap((key): PresetComparisonRow[] => {
    const effectsA = groupedA.get(key) ?? [];
    const effectsB = groupedB.get(key) ?? [];
    const rowCount = Math.max(effectsA.length, effectsB.length);

    return Array.from({ length: rowCount }, (_, index) => {
      const presetA = effectsA[index] ?? null;
      const presetB = effectsB[index] ?? null;
      const name = index === 0 ? namesByKey.get(key) ?? key : `${namesByKey.get(key) ?? key} ${index + 1}`;

      return {
        key: `${key}-${index}`,
        name,
        presetA,
        presetB,
        differenceText: getComparisonDifferenceText(presetA, presetB),
      };
    });
  });
}

function comparePresets(
  presetA: RelicPreset,
  presetB: RelicPreset,
  relicsById: Map<string, StoredRelic>,
) {
  const effectsA = collectPresetComparableEffects(presetA, relicsById);
  const effectsB = collectPresetComparableEffects(presetB, relicsById);

  return {
    normalOptions: buildComparisonRows(effectsA.normalOptions, effectsB.normalOptions),
    debuffs: buildComparisonRows(effectsA.debuffs, effectsB.debuffs),
  };
}

function getPresetCompareLabel(preset: RelicPreset) {
  return `${preset.name} · ${preset.characterName}`;
}

function PresetComparePresetHeader({
  label,
  preset,
}: {
  label: string;
  preset: RelicPreset | null;
}) {
  const nightfarer = preset ? getPresetNightfarer(preset.characterName) : undefined;
  const nightfarerIconUrl = nightfarer ? getNightfarerIconUrl(nightfarer) : undefined;

  return (
    <article className="preset-compare-summary-card">
      <div className="preset-compare-summary-heading">
        <span>{label}</span>
        <strong>{preset?.name ?? '프리셋 선택 필요'}</strong>
      </div>
      {nightfarerIconUrl ? (
        <img className="preset-compare-character-icon" src={nightfarerIconUrl} alt="" aria-hidden="true" />
      ) : null}
    </article>
  );
}

function PresetCompareEffectValue({ effect }: { effect: ComparablePresetEffect }) {
  return (
    <div className="preset-compare-value">
      <strong>{effect.valueText}</strong>
      {effect.detail && effect.detail !== effect.valueText ? <p>{effect.detail}</p> : null}
    </div>
  );
}

function getPresetCompareSlot(
  preset: RelicPreset | null,
  slotIndex: number,
) {
  return preset ? getSavedPresetSlots(preset.slots)[slotIndex] : null;
}

function getPresetCompareGroup(
  optionGroups: ReturnType<typeof getPresetSlotOptionGroups>,
  optionSlot: number,
) {
  return optionGroups.find((group) => group.slot === optionSlot) ?? null;
}

function PresetCompareOptionCell({
  isDebuff = false,
  option,
}: {
  isDebuff?: boolean;
  option: StoredRelicOption | null | undefined;
}) {
  if (!option) {
    return <div className="preset-compare-slot-option is-empty" aria-hidden="true" />;
  }

  if (isDebuff) {
    return (
      <div className="preset-compare-slot-option is-debuff">
        <div className="relic-builder-result-debuff">
          <em>디버프</em>
          <strong>{option.name}</strong>
          {option.detail ? <p>{option.detail}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="preset-compare-slot-option">
      <strong>{option.name}</strong>
      {option.detail ? <p>{option.detail}</p> : null}
    </div>
  );
}

function PresetCompareRelicSlotPair({
  leftSlot,
  relicsById,
  rightSlot,
  slotIndex,
}: {
  leftSlot: RelicPresetSlotInput | null;
  relicsById: Map<string, StoredRelic>;
  rightSlot: RelicPresetSlotInput | null;
  slotIndex: number;
}) {
  const leftGroups = leftSlot ? getPresetSlotOptionGroups(leftSlot, relicsById) : [];
  const rightGroups = rightSlot ? getPresetSlotOptionGroups(rightSlot, relicsById) : [];
  const isDeepSlot = shouldIncludePresetDebuffs(slotIndex);

  return (
    <article className="preset-compare-relic-slot">
      <div className="preset-compare-slot-title">
        <span>
          {getPresetSlotModeLabel(slotIndex)} {getPresetSlotDisplayIndex(slotIndex)}
        </span>
      </div>
      <div className="preset-compare-slot-option-list">
        {[1, 2, 3].map((optionSlot) => {
          const leftGroup = getPresetCompareGroup(leftGroups, optionSlot);
          const rightGroup = getPresetCompareGroup(rightGroups, optionSlot);
          const hasDebuff = isDeepSlot && Boolean(leftGroup?.debuff || rightGroup?.debuff);

          return (
            <div className="preset-compare-slot-option-group" key={optionSlot}>
              <div className="preset-compare-slot-option-row">
                <PresetCompareOptionCell option={leftGroup?.option} />
                <PresetCompareOptionCell option={rightGroup?.option} />
              </div>
              {hasDebuff ? (
                <div className="preset-compare-slot-option-row is-debuff-row">
                  <PresetCompareOptionCell isDebuff option={leftGroup?.debuff} />
                  <PresetCompareOptionCell isDebuff option={rightGroup?.debuff} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function PresetCompareRelicSlotSection({
  leftPreset,
  relicsById,
  rightPreset,
  slotIndexes,
  title,
}: {
  leftPreset: RelicPreset | null;
  relicsById: Map<string, StoredRelic>;
  rightPreset: RelicPreset | null;
  slotIndexes: number[];
  title: string;
}) {
  return (
    <section className="preset-compare-slot-section">
      <h5>{title}</h5>
      <div className="preset-compare-slot-list">
        {slotIndexes.map((slotIndex) => (
          <PresetCompareRelicSlotPair
            key={slotIndex}
            leftSlot={getPresetCompareSlot(leftPreset, slotIndex)}
            rightSlot={getPresetCompareSlot(rightPreset, slotIndex)}
            relicsById={relicsById}
            slotIndex={slotIndex}
          />
        ))}
      </div>
    </section>
  );
}

function PresetCompareCommonRows({
  emptyText,
  rows,
  title,
}: {
  emptyText: string;
  rows: PresetComparisonRow[];
  title: string;
}) {
  const commonRows = rows.filter(
    (row): row is PresetComparisonRow & {
      presetA: ComparablePresetEffect;
      presetB: ComparablePresetEffect;
    } => Boolean(row.presetA && row.presetB),
  );

  return (
    <section className="preset-compare-common-group">
      <h5>{title}</h5>
      {commonRows.length ? (
        <div className="preset-compare-common-list">
          {commonRows.map((row) => (
            <article className="preset-compare-common-row" key={row.key}>
              <div className="preset-compare-common-name">
                <strong>{row.name}</strong>
                <span>{row.differenceText}</span>
              </div>
              <div className="preset-compare-common-values">
                <div>
                  <span>왼쪽 프리셋</span>
                  <PresetCompareEffectValue effect={row.presetA} />
                </div>
                <div>
                  <span>오른쪽 프리셋</span>
                  <PresetCompareEffectValue effect={row.presetB} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted-text">{emptyText}</p>
      )}
    </section>
  );
}

function PresetCompareSection({
  authUserId,
  storageRefreshKey,
}: {
  authUserId: string | null;
  storageRefreshKey: number;
}) {
  const [presets, setPresets] = useState<RelicPreset[]>([]);
  const [storedRelics, setStoredRelics] = useState<StoredRelic[]>([]);
  const [selectedPresetAId, setSelectedPresetAId] = useState('');
  const [selectedPresetBId, setSelectedPresetBId] = useState('');
  const [isLoadingCompareData, setIsLoadingCompareData] = useState(false);
  const [compareNotice, setCompareNotice] = useState<string | null>(null);
  const relicsById = useMemo(
    () => new Map(storedRelics.map((relic) => [relic.relicId, relic])),
    [storedRelics],
  );
  const selectedPresetA = useMemo(
    () => presets.find((preset) => preset.presetId === selectedPresetAId) ?? null,
    [presets, selectedPresetAId],
  );
  const selectedPresetB = useMemo(
    () => presets.find((preset) => preset.presetId === selectedPresetBId) ?? null,
    [presets, selectedPresetBId],
  );
  const comparison = useMemo(
    () =>
      selectedPresetA && selectedPresetB
        ? comparePresets(selectedPresetA, selectedPresetB, relicsById)
        : null,
    [relicsById, selectedPresetA, selectedPresetB],
  );

  useEffect(() => {
    let isCurrentRequest = true;

    if (!authUserId) {
      window.alert(LOGIN_REQUIRED_MESSAGE);
      setPresets([]);
      setStoredRelics([]);
      setCompareNotice('로그인이 필요합니다.');
      setIsLoadingCompareData(false);
      return () => {
        isCurrentRequest = false;
      };
    }

    setIsLoadingCompareData(true);
    setCompareNotice(null);

    Promise.all([listRelicPresets(authUserId), listRelics(authUserId, 'all')])
      .then(([nextPresets, nextRelics]) => {
        if (!isCurrentRequest) return;

        setPresets(Array.isArray(nextPresets) ? nextPresets : []);
        setStoredRelics(Array.isArray(nextRelics) ? nextRelics : []);
      })
      .catch((error) => {
        if (!isCurrentRequest) return;

        setPresets([]);
        setStoredRelics([]);
        setCompareNotice(getStorageErrorMessage(error, '프리셋 비교 데이터를 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingCompareData(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [authUserId, storageRefreshKey]);

  useEffect(() => {
    if (selectedPresetAId && !presets.some((preset) => preset.presetId === selectedPresetAId)) {
      setSelectedPresetAId('');
    }
    if (selectedPresetBId && !presets.some((preset) => preset.presetId === selectedPresetBId)) {
      setSelectedPresetBId('');
    }
  }, [presets, selectedPresetAId, selectedPresetBId]);

  return (
    <section className="calc-panel preset-compare-section" aria-labelledby="preset-compare-title">
      <div className="relic-builder-result-heading">
        <div>
          <h4 id="preset-compare-title">프리셋 비교</h4>
        </div>
        <span className={comparison ? 'is-valid' : 'is-pending'}>
          {comparison ? '비교 가능' : '2개 선택'}
        </span>
      </div>

      {compareNotice ? <p className="storage-notice">{compareNotice}</p> : null}
      {isLoadingCompareData ? <p className="muted-text">저장된 프리셋을 불러오는 중...</p> : null}

      <div className="preset-compare-selectors">
        <label>
          <span>왼쪽 프리셋</span>
          <select
            value={selectedPresetAId}
            disabled={!authUserId || isLoadingCompareData}
            onChange={(event) => {
              const nextPresetId = event.target.value;
              setSelectedPresetAId(nextPresetId);
              if (nextPresetId && nextPresetId === selectedPresetBId) {
                setSelectedPresetBId('');
              }
            }}
          >
            <option value="">프리셋 선택</option>
            {presets.map((preset) => (
              <option key={preset.presetId} value={preset.presetId} disabled={preset.presetId === selectedPresetBId}>
                {getPresetCompareLabel(preset)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>오른쪽 프리셋</span>
          <select
            value={selectedPresetBId}
            disabled={!authUserId || isLoadingCompareData}
            onChange={(event) => {
              const nextPresetId = event.target.value;
              setSelectedPresetBId(nextPresetId);
              if (nextPresetId && nextPresetId === selectedPresetAId) {
                setSelectedPresetAId('');
              }
            }}
          >
            <option value="">프리셋 선택</option>
            {presets.map((preset) => (
              <option key={preset.presetId} value={preset.presetId} disabled={preset.presetId === selectedPresetAId}>
                {getPresetCompareLabel(preset)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!comparison && presets.length < 2 && !isLoadingCompareData ? (
        <p className="muted-text">비교하려면 저장된 프리셋이 2개 이상 필요합니다.</p>
      ) : null}
      {!comparison && presets.length >= 2 ? (
        <p className="muted-text">비교할 프리셋 2개를 선택하세요.</p>
      ) : null}

      {comparison ? (
        <div className="preset-compare-results">
          <div className="preset-compare-sides">
            <PresetComparePresetHeader
              label="왼쪽 프리셋"
              preset={selectedPresetA}
            />
            <PresetComparePresetHeader
              label="오른쪽 프리셋"
              preset={selectedPresetB}
            />
          </div>

          <PresetCompareRelicSlotSection
            title="일반 유물"
            leftPreset={selectedPresetA}
            rightPreset={selectedPresetB}
            relicsById={relicsById}
            slotIndexes={[0, 1, 2]}
          />
          <PresetCompareRelicSlotSection
            title="심도 유물"
            leftPreset={selectedPresetA}
            rightPreset={selectedPresetB}
            relicsById={relicsById}
            slotIndexes={[3, 4, 5]}
          />

          <section className="preset-compare-common">
            <div className="preset-compare-common-heading">
              <span>공통 옵션</span>
              <h5>겹치는 옵션 상세 비교</h5>
            </div>
            <PresetCompareCommonRows
              title="일반 옵션"
              rows={comparison.normalOptions}
              emptyText="두 프리셋에 함께 들어간 일반 옵션이 없습니다."
            />
            <PresetCompareCommonRows
              title="디버프"
              rows={comparison.debuffs}
              emptyText="두 프리셋에 함께 들어간 디버프가 없습니다."
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}

function RelicPresetOptionList({
  optionGroups,
}: {
  optionGroups: ReturnType<typeof getPresetSlotOptionGroups>;
}) {
  if (!optionGroups.length) {
    return <em>옵션 정보 없음</em>;
  }

  return (
    <ol className="relic-preset-summary-options">
      {optionGroups.map((group) => (
        <li key={group.slot}>
          <span>{group.slot}</span>
          <div>
            {group.option ? <strong>{group.option.name}</strong> : null}
            {group.option?.detail ? <p>{group.option.detail}</p> : null}
            {group.debuff ? (
              <div className="relic-builder-result-debuff">
                <em>디버프</em>
                <strong>{group.debuff.name}</strong>
                {group.debuff.detail ? <p>{group.debuff.detail}</p> : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SavedPresetSlotSummary({
  isPopoverOpen,
  onTogglePopover,
  relicsById,
  slot,
  slotIndex,
}: {
  isPopoverOpen: boolean;
  onTogglePopover: () => void;
  relicsById: Map<string, StoredRelic>;
  slot: RelicPresetSlotInput | null;
  slotIndex: number;
}) {
  if (!slot) {
    return <li className="saved-preset-slot is-empty" aria-label={`empty slot ${slotIndex + 1}`} />;
  }

  return (
    <RelicPresetSlotSummary
      isPopoverOpen={isPopoverOpen}
      onTogglePopover={onTogglePopover}
      relicsById={relicsById}
      slot={slot}
    />
  );
}

function RelicPresetSlotSummary({
  isPopoverOpen = false,
  onTogglePopover,
  relicsById,
  slot,
}: {
  isPopoverOpen?: boolean;
  onTogglePopover?: () => void;
  relicsById: Map<string, StoredRelic>;
  slot: RelicPresetSlotInput;
}) {
  const storedRelic = slot.relicRefType === 'stored' ? relicsById.get(slot.relicId) : undefined;
  const relicName =
    slot.relicRefType === 'stored'
      ? storedRelic?.itemName ?? `저장 유물 ${slot.relicId}`
      : getRelicNameByItemId(slot.itemId);
  const relicColor =
    slot.relicRefType === 'stored' ? storedRelic?.color ?? '' : getRelicColorByItemId(slot.itemId);
  const optionGroups = getPresetSlotOptionGroups(slot, relicsById);

  return (
    <li
      className={`saved-preset-slot${isPopoverOpen ? ' is-popover-open' : ''}`}
      role={onTogglePopover ? 'button' : undefined}
      tabIndex={onTogglePopover ? 0 : undefined}
      aria-expanded={onTogglePopover ? isPopoverOpen : undefined}
      onClick={onTogglePopover}
      onKeyDown={(event) => {
        if (!onTogglePopover) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTogglePopover();
        }
      }}
    >
      <span>{slot.slotIndex + 1}</span>
      <div>
        <div className="relic-preset-summary-top">
          <strong className={getRelicColorClass(relicColor)}>{getRelicColorLabel(relicColor)}</strong>
          <em>{slot.relicRefType === 'stored' ? '저장 유물' : '세이브 유물'}</em>
        </div>
        <p>{relicName}</p>
        {optionGroups.length ? (
          <ol className="relic-preset-summary-options">
            {optionGroups.map((group) => (
              <li key={group.slot}>
                <span>{group.slot}</span>
                <div>
                  {group.option ? <strong>{group.option.name}</strong> : null}
                  {group.option?.detail ? <p>{group.option.detail}</p> : null}
                  {group.debuff ? (
                    <div className="relic-builder-result-debuff">
                      <em>디버프</em>
                      <strong>{group.debuff.name}</strong>
                      {group.debuff.detail ? <p>{group.debuff.detail}</p> : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <em>옵션 정보 없음</em>
        )}
      </div>
      {isPopoverOpen ? (
        <div className="saved-preset-slot-popover" onClick={(event) => event.stopPropagation()}>
          <strong>{relicName}</strong>
          {optionGroups.length ? (
            <ol className="relic-preset-summary-options">
              {optionGroups.map((group) => (
                <li key={group.slot}>
                  <span>{group.slot}</span>
                  <div>
                    {group.option ? <strong>{group.option.name}</strong> : null}
                    {group.option?.detail ? <p>{group.option.detail}</p> : null}
                    {group.debuff ? (
                      <div className="relic-builder-result-debuff">
                        <em>디버프</em>
                        <strong>{group.debuff.name}</strong>
                        {group.debuff.detail ? <p>{group.debuff.detail}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <em>옵션 정보 없음</em>
          )}
        </div>
      ) : null}
    </li>
  );
}

function SavedRelicPresetsView({
  authUserId,
  storageRefreshKey,
}: {
  authUserId: string | null;
  storageRefreshKey: number;
}) {
  const [presets, setPresets] = useState<RelicPreset[]>([]);
  const [storedRelics, setStoredRelics] = useState<StoredRelic[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [activePresetSlotKey, setActivePresetSlotKey] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const relicsById = useMemo(
    () => new Map(storedRelics.map((relic) => [relic.relicId, relic])),
    [storedRelics],
  );
  const activePresetSlot = useMemo(() => {
    if (!activePresetSlotKey) return null;

    for (const preset of presets) {
      const savedSlots = getSavedPresetSlots(preset.slots);
      const activeSlot = savedSlots.find(
        (slot, slotIndex) => slot && activePresetSlotKey === `${preset.presetId}-${slotIndex}`,
      );
      if (activeSlot) return activeSlot;
    }

    return null;
  }, [activePresetSlotKey, presets]);
  const activePresetSlotOptionGroups = useMemo(
    () => (activePresetSlot ? getPresetSlotOptionGroups(activePresetSlot, relicsById) : []),
    [activePresetSlot, relicsById],
  );

  function refreshPresets() {
    setActivePresetSlotKey(null);

    if (!authUserId) {
      setPresets([]);
      setStoredRelics([]);
      setPresetNotice('로그인 후 저장된 프리셋을 불러올 수 있습니다.');
      setIsLoadingPresets(false);
      return;
    }

    setIsLoadingPresets(true);
    setPresetNotice(null);

    Promise.all([listRelicPresets(authUserId), listRelics(authUserId, 'all')])
      .then(([nextPresets, nextRelics]) => {
        setPresets(Array.isArray(nextPresets) ? nextPresets : []);
        setStoredRelics(Array.isArray(nextRelics) ? nextRelics : []);
      })
      .catch((error) => {
        setPresets([]);
        setStoredRelics([]);
        setPresetNotice(getStorageErrorMessage(error, '저장된 프리셋을 불러오지 못했습니다.'));
      })
      .finally(() => setIsLoadingPresets(false));
  }

  async function handleDeletePreset(preset: RelicPreset) {
    if (!authUserId || deletingPresetId) return;
    if (!window.confirm(`${preset.name || '이 프리셋'}을 삭제할까요?`)) return;

    setDeletingPresetId(preset.presetId);
    setPresetNotice(null);

    try {
      await deleteRelicPreset(authUserId, preset.presetId);
      setPresets((currentPresets) =>
        currentPresets.filter((currentPreset) => currentPreset.presetId !== preset.presetId),
      );
      setActivePresetSlotKey((currentKey) =>
        currentKey?.startsWith(`${preset.presetId}-`) ? null : currentKey,
      );
      setPresetNotice('프리셋을 삭제했습니다.');
    } catch (error) {
      setPresetNotice(getStorageErrorMessage(error, '프리셋을 삭제하지 못했습니다.'));
    } finally {
      setDeletingPresetId(null);
    }
  }

  useEffect(() => {
    refreshPresets();
  }, [authUserId, storageRefreshKey]);

  useEffect(() => {
    if (!activePresetSlotKey) return undefined;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setActivePresetSlotKey(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePresetSlotKey]);

  return (
    <section className="relic-saved-presets" aria-labelledby="saved-relic-presets-title">
      <div className="relic-preset-heading">
        <div>
          <p className="list-page-kicker">프리셋</p>
          <h3 id="saved-relic-presets-title">저장된 프리셋</h3>
        </div>
        <button
          type="button"
          className="relic-preset-toggle-button"
          disabled={isLoadingPresets}
          onClick={refreshPresets}
        >
          새로고침
        </button>
      </div>

      {presetNotice ? <p className="storage-notice">{presetNotice}</p> : null}
      {isLoadingPresets ? <p className="muted-text">저장된 프리셋을 불러오는 중...</p> : null}

      {!isLoadingPresets && !presetNotice && presets.length === 0 ? (
        <p className="muted-text">저장된 프리셋이 없습니다.</p>
      ) : null}

      <div className="saved-preset-grid">
        {presets.map((preset) => (
          <article className="option-card saved-preset-card" key={preset.presetId}>
              <div className="saved-preset-card-top">
                <div className="saved-preset-character-icon">
                  {(() => {
                    const nightfarer = getPresetNightfarer(preset.characterName);
                    const nightfarerIconUrl = nightfarer ? getNightfarerIconUrl(nightfarer) : undefined;

                  return nightfarerIconUrl ? <img src={nightfarerIconUrl} alt="" aria-hidden="true" /> : null;
                })()}
              </div>
              <div className="saved-preset-card-heading">
                <h3>{preset.name}</h3>
                <p>
                  {preset.characterName} 쨌 {getPresetVessel(preset.vesselIndex)?.name ?? getPresetVesselName(preset.vesselIndex)}
                </p>
              </div>
              <SavedPresetVesselPreview vessel={getPresetVessel(preset.vesselIndex)} />
              <button
                type="button"
                className="saved-preset-delete-button"
                disabled={deletingPresetId === preset.presetId}
                onClick={() => handleDeletePreset(preset)}
              >
                {deletingPresetId === preset.presetId ? '삭제 중' : '삭제'}
              </button>
            </div>
            <div className="option-card-header">
              <span className="option-category">
                {preset.slots.length > 3 ? '일반 + 깊은 밤' : preset.colorMode === 'deep' ? '깊은 밤' : '일반'}
              </span>
            </div>
            <div className="saved-preset-card-heading">
              <h3>{preset.name}</h3>
              <p>
                {preset.characterName} · {getPresetVesselName(preset.vesselIndex)}
              </p>
            </div>
            <ol className="relic-builder-result-list saved-preset-slot-list">
              {getSavedPresetSlots(preset.slots).map((slot, slotIndex) => (
                <SavedPresetSlotSummary
                  key={`${preset.presetId}-${slotIndex}`}
                  isPopoverOpen={false}
                  onTogglePopover={() => {
                    const slotKey = `${preset.presetId}-${slotIndex}`;
                    setActivePresetSlotKey((currentKey) => (currentKey === slotKey ? null : slotKey));
                  }}
                  slot={slot}
                  slotIndex={slotIndex}
                  relicsById={relicsById}
                />
              ))}
            </ol>
          </article>
        ))}
      </div>

      {activePresetSlot ? (
        <div
          className="saved-preset-modal-overlay"
          role="presentation"
          onClick={() => setActivePresetSlotKey(null)}
        >
          <div
            className="saved-preset-modal"
            role="dialog"
            aria-modal="true"
            aria-label="유물 옵션 상세"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="saved-preset-modal-close"
              aria-label="닫기"
              onClick={() => setActivePresetSlotKey(null)}
            >
              ×
            </button>
            <RelicPresetOptionList optionGroups={activePresetSlotOptionGroups} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RelicCard({ relic }: { relic: Relic }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const effects = getRelicEffects(relic);
  const effectDetails = getRelicEffectDetails(relic);
  const hasEffectDetails = effectDetails.length > 0;
  const relicImageUrl = resolveRelicImageUrl(relic.image);
  const toggleExpanded = () => {
    if (!hasEffectDetails) return;
    setIsExpanded((current) => !current);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!hasEffectDetails || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggleExpanded();
  };

  return (
    <article
      className={`option-card relic-card${hasEffectDetails ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}`}
      role={hasEffectDetails ? 'button' : undefined}
      tabIndex={hasEffectDetails ? 0 : undefined}
      aria-expanded={hasEffectDetails ? isExpanded : undefined}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
    >
      <div className="option-card-header">
        <span className={`option-category relic-color-${relic.color.toLowerCase()}`}>
          {getRelicColorLabel(relic.color)}
        </span>
      </div>

      <div className={`relic-card-main${relicImageUrl ? '' : ' has-no-image'}`}>
        {relicImageUrl ? (
          <img
            src={relicImageUrl}
            alt=""
            className="relic-catalog-image"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.closest('.relic-card-main')?.classList.add('has-no-image');
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <div>
          <h3>{relic.name}</h3>
          {relic.location ? <p>{relic.location}</p> : null}
        </div>
      </div>

      <div className="option-meta-row">
        {relic.type ? <span>{relic.type}</span> : null}
        {effects.length ? <span>효과 {effects.length}개</span> : null}
      </div>

      {isExpanded && hasEffectDetails ? (
        <ul className="relic-effect-list">
          {effectDetails.map((effect) => (
            <li key={effect.id}>
              <div>
                <strong>{effect.name}</strong>
              </div>
              {effect.desc ? <p>{effect.desc}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function RelicsPage({
  searchQuery,
  authUserId,
  storageRefreshKey,
  onRelicsChanged,
}: {
  searchQuery: string;
  authUserId: string | null;
  storageRefreshKey: number;
  onRelicsChanged: () => void;
}) {
  const [activeMode, setActiveMode] = useState<RelicPageMode>('catalog');
  const [collectionMode, setCollectionMode] = useState<RelicCollectionMode>('catalog');
  const filteredRelics = useMemo(
    () => relics.filter((relic) => matchesRelicSearch(relic, searchQuery)),
    [searchQuery],
  );

  const isPresetBuilderOpen = activeMode === 'builder';
  const isSavedPresetsOpen = activeMode === 'saved';
  const isPresetCompareOpen = activeMode === 'compare';

  useEffect(() => {
    if (!authUserId && activeMode !== 'catalog') {
      setActiveMode('catalog');
    }
  }, [activeMode, authUserId]);

  useEffect(() => {
    if (!authUserId && collectionMode === 'crafted') {
      setCollectionMode('catalog');
    }
  }, [authUserId, collectionMode]);

  function toggleProtectedMode(nextMode: ProtectedRelicPageMode) {
    setActiveMode((currentMode) => {
      if (currentMode === nextMode) return 'catalog';

      if (!authUserId) {
        window.alert(LOGIN_REQUIRED_MESSAGE);
        return currentMode;
      }

      return nextMode;
    });
  }

  function selectCollectionMode(nextMode: RelicCollectionMode) {
    setActiveMode('catalog');

    if (nextMode === 'crafted' && !authUserId) {
      window.alert(LOGIN_REQUIRED_MESSAGE);
      return;
    }

    setCollectionMode(nextMode);
  }

  return (
    <section className="options-page" aria-labelledby="relics-title">
      <div className="options-page-heading">
        <div>
          <h2 id="relics-title">유물</h2>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className={`relic-preset-toggle-button${collectionMode === 'catalog' && activeMode === 'catalog' ? ' is-active' : ''}`}
            aria-pressed={collectionMode === 'catalog' && activeMode === 'catalog'}
            onClick={() => selectCollectionMode('catalog')}
          >
            기본 유물
          </button>
          <button
            type="button"
            className={`relic-preset-toggle-button${collectionMode === 'crafted' && activeMode === 'catalog' ? ' is-active' : ''}`}
            aria-pressed={collectionMode === 'crafted' && activeMode === 'catalog'}
            onClick={() => selectCollectionMode('crafted')}
          >
            제작 유물
          </button>
          <button
            type="button"
            className={`relic-preset-toggle-button${isPresetBuilderOpen ? ' is-active' : ''}`}
            aria-expanded={isPresetBuilderOpen}
            onClick={() => toggleProtectedMode('builder')}
          >
            {isPresetBuilderOpen ? '프리셋 닫기' : '프리셋 만들기'}
          </button>
          <button
            type="button"
            className={`relic-preset-toggle-button${isSavedPresetsOpen ? ' is-active' : ''}`}
            aria-expanded={isSavedPresetsOpen}
            onClick={() => toggleProtectedMode('saved')}
          >
            {isSavedPresetsOpen ? '저장된 프리셋 닫기' : '저장된 프리셋 보기'}
          </button>
          <button
            type="button"
            className={`relic-preset-toggle-button${isPresetCompareOpen ? ' is-active' : ''}`}
            aria-expanded={isPresetCompareOpen}
            onClick={() => toggleProtectedMode('compare')}
          >
            {isPresetCompareOpen ? '프리셋 비교 닫기' : '프리셋 비교'}
          </button>
          {activeMode === 'catalog' && collectionMode === 'catalog' ? (
            <span className="option-count">
              {filteredRelics.length} / {relics.length}
            </span>
          ) : null}
        </div>
      </div>

      {activeMode === 'builder' ? (
        <RelicPresetBuilder
          authUserId={authUserId}
          searchQuery={searchQuery}
          storageRefreshKey={storageRefreshKey}
        />
      ) : activeMode === 'saved' ? (
        <SavedRelicPresetsView authUserId={authUserId} storageRefreshKey={storageRefreshKey} />
      ) : activeMode === 'compare' ? (
        <PresetCompareSection authUserId={authUserId} storageRefreshKey={storageRefreshKey} />
      ) : collectionMode === 'crafted' ? (
        <RelicStorageSection
          authUserId={authUserId}
          searchQuery={searchQuery}
          refreshKey={storageRefreshKey}
          sourceFilter="builder"
          showSourceFilters={false}
          emptyText="제작된 유물이 없습니다."
          onRelicsChanged={onRelicsChanged}
        />
      ) : (
        <div className="option-card-grid">
          {filteredRelics.map((relic) => (
            <RelicCard key={relic.id} relic={relic} />
          ))}
        </div>
      )}
    </section>
  );
}

export default RelicsPage;
