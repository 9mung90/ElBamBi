import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  relicEffectsKo,
  relicItemColorMap,
  relics,
  type Relic,
  type RelicEffect,
} from '../data/relics';
import RelicStorageSection from '../components/RelicStorageSection';
import { getStorageErrorMessage, listRelics, type StoredRelic } from '../api/storageApi';
import { nightfarers } from '../data/nightfarers';
import { vessels, type Vessel } from '../data/vessels';

type PresetColorMode = 'normal' | 'deep';
type PresetSlotRelics = [string | null, string | null, string | null];

const ALL_CHARACTER_NAME = '전체 캐릭터';
const EMPTY_PRESET_SLOTS: PresetSlotRelics = [null, null, null];
const PRESET_SLOT_LABELS = ['1', '2', '3'];
const PRESET_COLOR_MODE_OPTIONS: Array<{ value: PresetColorMode; label: string }> = [
  { value: 'normal', label: '일반' },
  { value: 'deep', label: '깊은 밤' },
];

const relicItemColorById = new Map(relicItemColorMap.map((entry) => [entry.itemId, entry]));
const relicEffectById = new Map(relicEffectsKo.map((effect) => [String(effect.id), effect]));
const relicCatalogById = new Map(relics.map((relic) => [relic.id, relic]));

const relicAssetUrls = import.meta.glob('../assets/images/relics/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

function resolveRelicImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return undefined;
  if (!imageUrl.startsWith('/src/assets/images/relics/')) return imageUrl;

  const assetPath = imageUrl.replace('/src/assets/images/relics/', '../assets/images/relics/');
  return relicAssetUrls[assetPath] ?? imageUrl;
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

function canRelicFitSlot(relic: StoredRelic, slotColor: string | undefined) {
  const normalizedSlotColor = normalizeRelicColor(slotColor);
  if (!normalizedSlotColor) return false;
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

    return relic && canRelicFitSlot(relic, slotColor) ? relicId : null;
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

function getStoredRelicImageUrl(relic: StoredRelic) {
  return resolveRelicImageUrl(relicCatalogById.get(relic.itemId)?.image);
}

function getStoredRelicOptionSummary(relic: StoredRelic) {
  return [...relic.options]
    .sort((left, right) => left.slot - right.slot)
    .map((option) => option.name)
    .filter(Boolean);
}

function getStoredRelicSourceLabel(source: StoredRelic['source']) {
  return source === 'builder' ? '제작' : '세이브';
}

function StoredRelicPresetChoice({
  disabledReason,
  isDisabled,
  isSelected,
  onSelect,
  relic,
}: {
  disabledReason: string;
  isDisabled: boolean;
  isSelected: boolean;
  onSelect: (relic: StoredRelic) => void;
  relic: StoredRelic;
}) {
  const relicImageUrl = getStoredRelicImageUrl(relic);
  const optionSummary = getStoredRelicOptionSummary(relic);

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
          <strong>{relic.itemName || `Relic ${relic.itemId}`}</strong>
        </div>
      </div>

      {optionSummary.length ? (
        <ol className="relic-preset-choice-options">
          {optionSummary.slice(0, 3).map((optionName, index) => (
            <li key={`${optionName}-${index}`}>{optionName}</li>
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
  const [colorMode, setColorMode] = useState<PresetColorMode>('normal');
  const [selectedVesselIndex, setSelectedVesselIndex] = useState(
    getDefaultVesselIndex(initialCharacter),
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
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
  const slotColors = useMemo(
    () => getVesselColors(selectedVessel, colorMode),
    [colorMode, selectedVessel],
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
    ? ownedRelics.filter((relic) => canRelicFitSlot(relic, activeSlotColor)).length
    : 0;
  const visibleCandidateRelics = useMemo(
    () =>
      activeSlotIndex !== null && activeSlotColor
        ? ownedRelics.filter((relic) => {
            const isCurrentSlotRelic = relic.relicId === placedRelicIds[activeSlotIndex];
            return (
              canRelicFitSlot(relic, activeSlotColor) &&
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

        if (!authUserId) {
          setOwnedRelics([]);
          setOwnedRelicNotice(null);
          setIsLoadingOwnedRelics(false);
          setPlacedRelicIds(createEmptyPresetSlots());
          return null;
        }

        setIsLoadingOwnedRelics(true);
        return listRelics(authUserId, 'all');
      })
      .then((items) => {
        if (!isCurrentRequest || !items) return;

        const nextOwnedRelics = Array.isArray(items) ? items : [];
        setOwnedRelics(nextOwnedRelics);
        setPlacedRelicIds((currentSlots) =>
          removeMissingPresetRelics(currentSlots, nextOwnedRelics),
        );
        setOwnedRelicNotice(null);
      })
      .catch((error) => {
        if (!isCurrentRequest) return;
        setOwnedRelics([]);
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
  }

  function handleClearSlot(slotIndex: number) {
    setPlacedRelicIds((currentSlots) => {
      const nextSlots = [...currentSlots] as PresetSlotRelics;
      nextSlots[slotIndex] = null;
      return nextSlots;
    });
  }

  return (
    <section className="relic-preset-builder" aria-labelledby="relic-preset-title">
      <div className="relic-preset-heading">
        <div>
          <p className="list-page-kicker">Preset</p>
          <h3 id="relic-preset-title">프리셋 만들기</h3>
        </div>
        <span className="option-count">
          {placedRelicCount} / {slotColors.length || 3}
        </span>
      </div>

      <div className="relic-preset-layout">
        <section className="calc-panel relic-preset-controls" aria-label="프리셋 설정">
          <div className="calc-control-grid relic-preset-control-grid">
            <label>
              캐릭터
              <select
                value={selectedCharacter}
                onChange={(event) => {
                  const characterName = event.target.value;
                  const nextVesselIndex = getDefaultVesselIndex(characterName);
                  const nextVessel = getVesselsForCharacter(characterName).find(
                    (vessel) => vessel.index === nextVesselIndex,
                  );
                  const nextSlotColors = getVesselColors(nextVessel, colorMode);

                  setSelectedCharacter(characterName);
                  setSelectedVesselIndex(nextVesselIndex);
                  setActiveSlotIndex(null);
                  setPlacedRelicIds((currentSlots) =>
                    sanitizePresetSlots(currentSlots, nextSlotColors, ownedRelics),
                  );
                }}
              >
                {characterOptions.map((characterName) => (
                  <option key={characterName} value={characterName}>
                    {characterName}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="relic-builder-reset"
              onClick={() => setPlacedRelicIds(createEmptyPresetSlots())}
            >
              초기화
            </button>
          </div>

          <label className="relic-preset-select-label">
            현기
            <select
              value={selectedVessel?.index ?? -1}
              onChange={(event) => {
                const nextVesselIndex = Number(event.target.value);
                const nextVessel = availableVessels.find(
                  (vessel) => vessel.index === nextVesselIndex,
                );
                const nextSlotColors = getVesselColors(nextVessel, colorMode);

                setSelectedVesselIndex(nextVesselIndex);
                setActiveSlotIndex(null);
                setPlacedRelicIds((currentSlots) =>
                  sanitizePresetSlots(currentSlots, nextSlotColors, ownedRelics),
                );
              }}
            >
              {availableVessels.map((vessel) => (
                <option key={vessel.index} value={vessel.index}>
                  {vessel.character === ALL_CHARACTER_NAME ? '[전체] ' : ''}
                  {vessel.name}
                </option>
              ))}
            </select>
          </label>

          <div className="relic-preset-mode-row" aria-label="현기 색상 모드">
            {PRESET_COLOR_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={colorMode === option.value ? 'is-selected' : ''}
                aria-pressed={colorMode === option.value}
                onClick={() => {
                  const nextSlotColors = getVesselColors(selectedVessel, option.value);

                  setColorMode(option.value);
                  setActiveSlotIndex(null);
                  setPlacedRelicIds((currentSlots) =>
                    sanitizePresetSlots(currentSlots, nextSlotColors, ownedRelics),
                  );
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {selectedVessel ? (
            <div className="relic-preset-vessel-card">
              <div>
                <span>{selectedVessel.character}</span>
                <strong>{selectedVessel.name}</strong>
              </div>
              <div className="relic-preset-color-row">
                {slotColors.map((slotColor, slotIndex) => (
                  <span
                    key={`${slotColor}-${slotIndex}`}
                    className={`relic-preset-color-dot ${getRelicColorClass(slotColor)}`}
                    title={`${slotIndex + 1}번: ${getRelicColorLabel(slotColor)}`}
                  >
                    {slotIndex + 1}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relic-preset-owned-count">
            <span>보유 유물</span>
            <strong>{ownedRelics.length}개</strong>
          </div>
        </section>

        <div className="relic-preset-main">
          <div className="relic-preset-slots" aria-label="유물 프리셋 슬롯">
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
                  <span>{activeSlotIndex + 1}번 슬롯</span>
                  <strong>{getRelicColorLabel(activeSlotColor)} 세이브/제작 유물</strong>
                </div>
                <em>
                  {visibleCandidateRelics.length} / {activeSlotCandidateCount}
                </em>
              </div>

              {!authUserId ? (
                <p className="storage-notice">로그인 후 보유 유물을 불러올 수 있습니다.</p>
              ) : ownedRelicNotice ? (
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
                        disabledReason={
                          usedSlotIndex === -1 ? '' : `${usedSlotIndex + 1}번 슬롯에 배치됨`
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

            <ol className="relic-builder-result-list">
              {PRESET_SLOT_LABELS.map((slotLabel, slotIndex) => {
                const slotColor = slotColors[slotIndex];
                const placedRelic = selectedRelics[slotIndex];

                return (
                  <li key={slotLabel}>
                    <span>{slotLabel}</span>
                    <div>
                      <strong>{getRelicColorLabel(slotColor)}</strong>
                      {placedRelic ? (
                        <>
                          <p>{placedRelic.itemName || `Relic ${placedRelic.itemId}`}</p>
                          <button
                            type="button"
                            className="relic-preset-clear-slot"
                            onClick={() => handleClearSlot(slotIndex)}
                          >
                            해제
                          </button>
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
          {relic.color}
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
                {effect.category ? <span>{effect.category}</span> : null}
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
  const [isPresetBuilderOpen, setIsPresetBuilderOpen] = useState(false);
  const filteredRelics = useMemo(
    () => relics.filter((relic) => matchesRelicSearch(relic, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="relics-title">
      <div className="options-page-heading">
        <div>
          <h2 id="relics-title">유물</h2>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className={`relic-preset-toggle-button${isPresetBuilderOpen ? ' is-active' : ''}`}
            aria-expanded={isPresetBuilderOpen}
            onClick={() => setIsPresetBuilderOpen((isOpen) => !isOpen)}
          >
            {isPresetBuilderOpen ? '프리셋 닫기' : '프리셋 만들기'}
          </button>
          <span className="option-count">
            {filteredRelics.length} / {relics.length}
          </span>
        </div>
      </div>

      {isPresetBuilderOpen ? (
        <RelicPresetBuilder
          authUserId={authUserId}
          searchQuery={searchQuery}
          storageRefreshKey={storageRefreshKey}
        />
      ) : (
        <>
          <RelicStorageSection
            authUserId={authUserId}
            searchQuery={searchQuery}
            refreshKey={storageRefreshKey}
            onRelicsChanged={onRelicsChanged}
          />

          <div className="option-card-grid">
            {filteredRelics.map((relic) => (
              <RelicCard key={relic.id} relic={relic} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default RelicsPage;
