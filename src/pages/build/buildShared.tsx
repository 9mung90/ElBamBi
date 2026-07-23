/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react';
import { nightfarers, type Nightfarer } from '../../data/nightfarers';
import {
  type RelicPreset,
  type RelicPresetSlotInput,
  type StoredRelic,
  type StoredRelicOption,
} from '../../api/storageApi';
import {
  relicEffectsKo,
  relicItemColorMap,
  relicRollAppData,
  relics,
  type RelicRollEffect,
} from '../../data/relics';
import { vessels, type Vessel } from '../../data/vessels';
import {
  getRelicColorClass as getSharedRelicColorClass,
  getRelicColorLabel as getSharedRelicColorLabel,
} from '../../utils/relicColor';

export type WritableBuildPostCategory = 'Class Builds' | 'Strategy' | 'Questions' | 'Free Board';
const nightAssetUrls = import.meta.glob('../../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);

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

export type BuildPostDraft = {
  title: string;
  category: WritableBuildPostCategory;
  nightfarerIndex: number | null;
  content: string;
  preset: BuildPostPreset | null;
};

type PresetSlotRelics = Array<string | null>;

export type BuildPostPreset = {
  preset: RelicPreset;
  storedRelics: StoredRelic[];
};

export type BuildImage = {
  id: string;
  postId: string;
  imageUrl: string;
};

export type BuildComment = {
  id: string;
  postId: string;
  userId: string;
  authorNickname: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type BuildPost = {
  id: string;
  userId: string;
  authorNickname: string;
  title: string;
  content: string;
  viewCount: number;
  category: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  likeCount: number;
  bookmarkCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  comments: BuildComment[];
  images: BuildImage[];
};

const EMPTY_PRESET_SLOTS: PresetSlotRelics = [null, null, null, null, null, null];
const EMPTY_EFFECT_ID = 0xffffffff;
export const buildPostPresetMarkerPrefix = '[[NIGHTREIGN_BUILD_PRESET:';
export const buildPostPresetMarkerSuffix = ']]';
export const writeCategories: WritableBuildPostCategory[] = [
  'Class Builds',
  'Strategy',
  'Questions',
  'Free Board',
];

export const legacyCategoryLabels: Record<string, WritableBuildPostCategory> = {
  '빌드 공유': 'Class Builds',
  공략: 'Strategy',
  질문: 'Questions',
  '파티 모집': 'Free Board',
  기타: 'Free Board',
};

const categoryDisplayLabels: Record<string, string> = {
  'Class Builds': '캐릭터 빌드',
  'Weapon Builds': '무기 빌드',
  Strategy: '공략',
  Questions: '질문',
  'Free Board': '자유 게시판',
  free: '자유 게시판',
  '빌드 공유': '캐릭터 빌드',
  공략: '공략',
  질문: '질문',
  '파티 모집': '자유 게시판',
  기타: '자유 게시판',
};

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

export function getNightfarerIconUrl(nightfarer: Nightfarer) {
  return resolveNightAssetUrl(nightfarer.nameImageUrl);
}

function getRelicColorLabel(color: string | undefined) {
  return getSharedRelicColorLabel(color);
}

function getRelicColorClass(color: string | undefined) {
  return getSharedRelicColorClass(color);
}

function splitPresetList(value: string | undefined) {
  if (!value) return [];

  return value
    .split(/[|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getVesselColors(vessel: Vessel | undefined, colorMode: 'normal' | 'deep') {
  if (!vessel) return [];

  return splitPresetList(colorMode === 'deep' ? vessel.deepRelicColors : vessel.relicColors);
}

function getPresetVesselSlotColors(vessel: Vessel | undefined) {
  return [...getVesselColors(vessel, 'normal'), ...getVesselColors(vessel, 'deep')];
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

function getRelicNameByItemId(itemId: number) {
  return relicItemColorById.get(itemId)?.name ?? relicCatalogById.get(itemId)?.name ?? `유물 ${itemId}`;
}

function getRelicColorByItemId(itemId: number) {
  return relicItemColorById.get(itemId)?.color ?? relicCatalogById.get(itemId)?.color ?? '';
}

function shouldIncludePresetDebuffs(slotIndex: number) {
  return slotIndex >= 3;
}

function isUsableEffectId(effectId: number) {
  return effectId !== EMPTY_EFFECT_ID && effectId !== -1;
}

function toPresetRelicOption(effectId: number, slotIndex: number): StoredRelicOption | null {
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

function getSavePresetSlotOptionGroups(effectIds: number[], includeDebuffs = true) {
  return [1, 2, 3]
    .map((slot) => {
      const option = toPresetRelicOption(effectIds[slot - 1] ?? EMPTY_EFFECT_ID, slot - 1);
      const debuff = includeDebuffs
        ? toPresetRelicOption(effectIds[slot + 2] ?? EMPTY_EFFECT_ID, slot - 1)
        : null;

      if (!option && !debuff) return null;

      return { slot, option, debuff };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
}

function getStoredRelicOptionGroups(relic: StoredRelic, includeDebuffs = true) {
  return [1, 2, 3]
    .map((slot) => {
      const option = relic.options.find((candidate) => candidate.slot === slot);
      const debuff = includeDebuffs
        ? relic.debuffs?.find((candidate) => candidate.slot === slot)
        : undefined;

      if (!option && !debuff) return null;

      return { slot, option, debuff };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
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

function decodeBuildPostPreset(value: string): BuildPostPreset | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(value))) as BuildPostPreset;
    if (!parsed?.preset?.presetId || !Array.isArray(parsed.preset.slots)) return null;
    return {
      preset: parsed.preset,
      storedRelics: Array.isArray(parsed.storedRelics) ? parsed.storedRelics : [],
    };
  } catch {
    return null;
  }
}

export function getBuildPostContentParts(content: string) {
  if (!content.startsWith(buildPostPresetMarkerPrefix)) {
    return { preset: null as BuildPostPreset | null, content };
  }

  const markerEndIndex = content.indexOf(buildPostPresetMarkerSuffix, buildPostPresetMarkerPrefix.length);
  if (markerEndIndex === -1) {
    return { preset: null as BuildPostPreset | null, content };
  }

  const encodedPreset = content.slice(buildPostPresetMarkerPrefix.length, markerEndIndex);
  const preset = decodeBuildPostPreset(encodedPreset);
  if (!preset) {
    return { preset: null as BuildPostPreset | null, content };
  }

  return {
    preset,
    content: content.slice(markerEndIndex + buildPostPresetMarkerSuffix.length).replace(/^\r?\n/, ''),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getBuildContentImageCount(content: string) {
  if (typeof document === 'undefined') return 0;

  const container = document.createElement('div');
  container.innerHTML = content;
  return container.querySelectorAll('img').length;
}

export function sanitizeBuildPostHtml(content: string) {
  if (typeof document === 'undefined') return escapeHtml(content);

  const template = document.createElement('template');
  template.innerHTML = content;
  const allowedTags = new Set(['B', 'BR', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE', 'I', 'IMG', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'U', 'UL']);

  function cleanNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const element = node as HTMLElement;
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'style') {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === 'IMG') {
      const image = element as HTMLImageElement;
      const src = image.getAttribute('src') ?? '';
      const isAllowedSrc = src.startsWith('data:image/') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://');

      if (!isAllowedSrc) {
        image.remove();
        return;
      }

      Array.from(image.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (!['alt', 'class', 'src'].includes(name)) {
          image.removeAttribute(attribute.name);
        }
      });
      image.classList.add('build-content-image');
    }

    Array.from(element.childNodes).forEach(cleanNode);
  }

  Array.from(template.content.childNodes).forEach(cleanNode);
  return template.innerHTML.trim();
}

export function getCategoryLabel(category: string) {
  const cleanCategory = category.trim();
  const normalizedCategory = legacyCategoryLabels[cleanCategory] ?? cleanCategory;
  return categoryDisplayLabels[normalizedCategory] ?? categoryDisplayLabels[cleanCategory] ?? (normalizedCategory || '캐릭터 빌드');
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getAuthorLabel(userId: string, nickname = '') {
  const cleanNickname = nickname.trim();
  if (cleanNickname) return cleanNickname;
  return userId ? `사용자 #${userId}` : '알 수 없음';
}

function BuildPresetVesselPreview({ vessel }: { vessel: Vessel | undefined }) {
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

function BuildPresetOptionList({
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

function BuildPresetSlotSummary({
  hideRelicSource = false,
  onSelect,
  relicsById,
  slot,
  slotIndex,
}: {
  hideRelicSource?: boolean;
  onSelect: () => void;
  relicsById: Map<string, StoredRelic>;
  slot: RelicPresetSlotInput | null;
  slotIndex: number;
}) {
  if (!slot) {
    return <li className="saved-preset-slot is-empty" aria-label={`empty slot ${slotIndex + 1}`} />;
  }

  const storedRelic = slot.relicRefType === 'stored' ? relicsById.get(slot.relicId) : undefined;
  const relicName =
    slot.relicRefType === 'stored'
      ? storedRelic?.itemName ?? `저장 유물 ${slot.relicId}`
      : getRelicNameByItemId(slot.itemId);
  const relicColor =
    slot.relicRefType === 'stored' ? storedRelic?.color ?? '' : getRelicColorByItemId(slot.itemId);

  return (
    <li
      className="saved-preset-slot"
      role="button"
      tabIndex={0}
      aria-label={`${relicName} 옵션 상세`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span>{slot.slotIndex + 1}</span>
      <div>
        <div className="relic-preset-summary-top">
          <strong className={getRelicColorClass(relicColor)}>{getRelicColorLabel(relicColor)}</strong>
          {hideRelicSource ? null : <em>{slot.relicRefType === 'stored' ? '저장 유물' : '세이브 유물'}</em>}
        </div>
        <p>{relicName}</p>
      </div>
    </li>
  );
}

export function BuildPresetCard({
  hideRelicSource = false,
  onSelectPreset,
  onSelectSlot,
  preset,
  relicsById,
}: {
  hideRelicSource?: boolean;
  onSelectPreset?: (preset: RelicPreset) => void;
  onSelectSlot?: (preset: RelicPreset, slotIndex: number) => void;
  preset: RelicPreset;
  relicsById: Map<string, StoredRelic>;
}) {
  const nightfarer = getPresetNightfarer(preset.characterName);
  const nightfarerIconUrl = nightfarer ? getNightfarerIconUrl(nightfarer) : undefined;
  const vessel = getPresetVessel(preset.vesselIndex);

  return (
    <article
      className={`option-card saved-preset-card build-preset-card${onSelectPreset ? ' is-selectable' : ''}`}
      role={onSelectPreset ? 'button' : undefined}
      tabIndex={onSelectPreset ? 0 : undefined}
      onClick={onSelectPreset ? () => onSelectPreset(preset) : undefined}
      onKeyDown={(event) => {
        if (!onSelectPreset || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onSelectPreset(preset);
      }}
    >
      <div className="saved-preset-card-top">
        <div className="saved-preset-character-icon">
          {nightfarerIconUrl ? <img src={nightfarerIconUrl} alt="" aria-hidden="true" /> : null}
        </div>
        <div className="saved-preset-card-heading">
          <h3>{preset.name}</h3>
        </div>
        <BuildPresetVesselPreview vessel={vessel} />
      </div>
      <ol className="relic-builder-result-list saved-preset-slot-list">
        {getSavedPresetSlots(preset.slots).map((slot, slotIndex) => (
          <BuildPresetSlotSummary
            key={`${preset.presetId}-${slotIndex}`}
            hideRelicSource={hideRelicSource}
            onSelect={() => (onSelectSlot ? onSelectSlot(preset, slotIndex) : onSelectPreset?.(preset))}
            relicsById={relicsById}
            slot={slot}
            slotIndex={slotIndex}
          />
        ))}
      </ol>
    </article>
  );
}

export function BuildPostPresetBlock({
  embeddedPreset,
  onRemove,
}: {
  embeddedPreset: BuildPostPreset;
  onRemove?: () => void;
}) {
  const [activePresetSlotKey, setActivePresetSlotKey] = useState<string | null>(null);
  const relicsById = useMemo(
    () => new Map(embeddedPreset.storedRelics.map((relic) => [relic.relicId, relic])),
    [embeddedPreset.storedRelics],
  );
  const activePresetSlot = useMemo(() => {
    if (!activePresetSlotKey) return null;

    const savedSlots = getSavedPresetSlots(embeddedPreset.preset.slots);
    return (
      savedSlots.find(
        (slot, slotIndex) => slot && activePresetSlotKey === `${embeddedPreset.preset.presetId}-${slotIndex}`,
      ) ?? null
    );
  }, [activePresetSlotKey, embeddedPreset.preset]);
  const activePresetSlotOptionGroups = useMemo(
    () => (activePresetSlot ? getPresetSlotOptionGroups(activePresetSlot, relicsById) : []),
    [activePresetSlot, relicsById],
  );

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
    <section className="build-inserted-preset">
      <div className="build-inserted-preset-heading">
        <strong>선택한 프리셋</strong>
        {onRemove ? (
          <button
            type="button"
            className="build-secondary-button is-danger"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            삭제
          </button>
        ) : null}
      </div>
      <BuildPresetCard
        onSelectSlot={(preset, slotIndex) => setActivePresetSlotKey(`${preset.presetId}-${slotIndex}`)}
        preset={embeddedPreset.preset}
        relicsById={relicsById}
      />

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
              x
            </button>
            <BuildPresetOptionList optionGroups={activePresetSlotOptionGroups} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
