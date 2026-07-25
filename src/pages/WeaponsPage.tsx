import { useEffect, useMemo, useRef, type Ref } from 'react';
import { nightfarers } from '../data/nightfarers';
import { relicWeapons, type RelicWeapon } from '../data/relics';
import { weaponCatalog, weaponCatalogByTitle, type WeaponCatalogItem } from '../data/weaponCatalog';
import bloodIcon from '../assets/images/attribute/blood.png';
import fireIcon from '../assets/images/attribute/fire.png';
import frostIcon from '../assets/images/attribute/frost.png';
import gradeFrame0 from '../assets/images/grade/0.webp';
import gradeFrame1 from '../assets/images/grade/1.webp';
import gradeFrame2 from '../assets/images/grade/2.webp';
import gradeFrame3 from '../assets/images/grade/3.webp';
import holyIcon from '../assets/images/attribute/holy.png';
import lightningIcon from '../assets/images/attribute/lightning.png';
import magicIcon from '../assets/images/attribute/magic.png';
import poisonIcon from '../assets/images/attribute/poison.png';
import { isCatalogItemVisibleByName } from './catalogVisibility';

type WeaponGroup = {
  id: number;
  representative: RelicWeapon;
  weapons: RelicWeapon[];
  variants: RelicWeapon[];
};

type WeaponsPageProps = {
  searchQuery: string;
  filters: WeaponFilters;
  selectedGroupId: number | null;
  focusedGroupId: number | null;
  onSelectGroup: (groupId: number) => void;
  onBack: () => void;
};

export type WeaponFilters = {
  levels: number[];
  types: string[];
  genres: string[];
};

// 공격 속성 한글 이름
const damageLabels: Record<string, string> = {
  Phys: '물리',
  Magic: '마력',
  Fire: '화염',
  Lightning: '벼락',
  Holy: '신성',
};

// 능력치 한글 이름
const statLabels: Record<string, string> = {
  STR: '근력',
  DEX: '기량',
  INT: '지력',
  FAI: '신앙',
  ARC: '신비',
  VIG: '생명력',
  MND: '정신력',
  END: '지구력',
};

// 상태 이상 한글 이름
const statusLabels: Record<string, string> = {
  Poison: '독',
  Bloodloss: '출혈',
  Frostbite: '동상',
  ScarletRot: '붉은 부패',
  Sleep: '수면',
  Madness: '발광',
};

// 무기 변질 아이콘
const affinityIcons = [
  { prefix: '화염의 ', label: '화염', src: fireIcon },
  { prefix: '벼락의 ', label: '벼락', src: lightningIcon },
  { prefix: '신성한 ', label: '신성', src: holyIcon },
  { prefix: '마력의 ', label: '마력', src: magicIcon },
  { prefix: '차가운 ', label: '차가운', src: frostIcon },
  { prefix: '독의 ', label: '독', src: poisonIcon },
  { prefix: '피의 ', label: '피', src: bloodIcon },
];

const affinityPrefixes = affinityIcons.map((icon) => icon.prefix);
const nightfarerEquipmentFallbackExclusions = new Set(['수호자의 검창']);
const normalizedWeaponCatalogByTitle = new Map(
  weaponCatalog.map((weapon) => [normalizeWeaponCatalogName(weapon.title), weapon]),
);
const nightAssetUrls = import.meta.glob('../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);
const nightfarerEquipmentImageByName = buildNightfarerEquipmentImageMap();
const nightfarerDefaultEquipmentImages = buildNightfarerDefaultEquipmentImages();

// 숨김 무기 제외
const visibleRelicWeapons = relicWeapons.filter(
  (weapon) => isCatalogItemVisibleByName(weapon) && isCatalogItemVisibleByName(getWeaponCatalogItem(weapon.name)),
);
const weaponGroups = buildWeaponGroups(visibleRelicWeapons);
export const weaponFilterOptions = buildWeaponFilterOptions(visibleRelicWeapons);
const weaponGroupIdAliases = new Map(
  [
    ["Raider's Greataxe", 23750000],
    ['복수자의 손톱', 21750000],
    ['성인', 34000000],
  ].map(([alias, groupId]) => [normalizeWeaponCatalogName(String(alias)), Number(groupId)]),
);

// 무기 번호에서 무기군 번호 찾기
function getWeaponGroupId(weapon: RelicWeapon) {
  return Math.floor(weapon.id / 10000) * 10000;
}

// 무기 이름으로 무기군 찾기
export function getWeaponGroupIdByName(weaponName: string) {
  const normalizedWeaponName = normalizeWeaponCatalogName(weaponName);
  const aliasGroupId = weaponGroupIdAliases.get(normalizedWeaponName);
  if (aliasGroupId) return aliasGroupId;

  const normalizedBaseWeaponName = normalizeWeaponCatalogName(getBaseWeaponName(weaponName));
  const targetNames = new Set([
    normalizedWeaponName,
    normalizedBaseWeaponName,
  ]);

  return (
    weaponGroups.find((group) =>
      group.weapons.some((weapon) => {
        const candidateName = normalizeWeaponCatalogName(weapon.name);
        const candidateBaseName = normalizeWeaponCatalogName(getBaseWeaponName(weapon.name));

        return targetNames.has(candidateName) || targetNames.has(candidateBaseName);
      }),
    )?.id ?? null
  );
}

// 기본 무기와 파생 무기 묶기
function buildWeaponGroups(weapons: RelicWeapon[]): WeaponGroup[] {
  const groupedWeapons = new Map<number, RelicWeapon[]>();

  weapons.forEach((weapon) => {
    const groupId = getWeaponGroupId(weapon);
    const group = groupedWeapons.get(groupId) ?? [];
    group.push(weapon);
    groupedWeapons.set(groupId, group);
  });

  return [...groupedWeapons.entries()]
    .map(([id, groupWeapons]) => {
      const sortedWeapons = [...groupWeapons].sort((left, right) => left.id - right.id);
      const representative =
        sortedWeapons.find((weapon) => weapon.id === id) ?? sortedWeapons[0];

      return {
        id,
        representative,
        weapons: sortedWeapons,
        variants: sortedWeapons.filter((weapon) => weapon.id !== representative.id),
      };
    })
    .sort((left, right) => left.representative.id - right.representative.id);
}

// 수치 목록을 표시 문구로 변환
function formatRecordValues(
  values: Record<string, number | number[]> | undefined,
  labels: Record<string, string>,
) {
  if (!values) return [];

  return Object.entries(values).map(([key, value]) => {
    const label = labels[key] ?? key;
    const formattedValue = Array.isArray(value) ? value.join('/') : value;
    return `${label} ${formattedValue}`;
  });
}

// 검색 함수
function matchesWeaponSearch(weapon: RelicWeapon, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  // 검색어가 없으면 전체 표시
  if (!normalizedQuery) return true;

  const damage = formatRecordValues(weapon.baseDamage, damageLabels);
  const scaling = formatRecordValues(weapon.scaling, statLabels);
  const status = formatRecordValues(weapon.statusDamage, statusLabels);

  return [
    weapon.id,
    weapon.name,
    weapon.requiredLevel,
    weapon.weaponType,
    weapon.rarity,
    weapon.attackType,
    weapon.swordArtsId,
    ...damage,
    ...scaling,
    ...status,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

// 선택한 필터와 무기 비교
function matchesWeaponFilters(weapon: RelicWeapon, filters: WeaponFilters) {
  const requiredLevel = weapon.requiredLevel ?? 0;
  const catalogItem = getWeaponCatalogItem(weapon.name);
  const catalogType = catalogItem?.type ? normalizeWeaponFilterText(catalogItem.type) : '';
  const catalogGenre = catalogItem?.genre ? normalizeWeaponFilterText(catalogItem.genre) : '';
  const matchesLevel = filters.levels.length === 0 || filters.levels.includes(requiredLevel);
  const matchesType =
    filters.types.length === 0 || Boolean(catalogType && filters.types.includes(catalogType));
  const matchesGenre =
    filters.genres.length === 0 || Boolean(catalogGenre && filters.genres.includes(catalogGenre));

  return matchesLevel && matchesType && matchesGenre;
}

// 무기군 안에서 검색과 필터 확인
function matchesWeaponGroupSearch(group: WeaponGroup, query: string, filters: WeaponFilters) {
  const normalizedQuery = query.trim();

  return group.weapons.some(
    (weapon) => matchesWeaponSearch(weapon, normalizedQuery) && matchesWeaponFilters(weapon, filters),
  );
}

// 무기 이름에 맞는 변질 아이콘
function getWeaponAffinityIcon(weaponName: string) {
  return affinityIcons.find((icon) => weaponName.startsWith(icon.prefix)) ?? null;
}

// 변질 이름을 뺀 기본 무기 이름
function getBaseWeaponName(weaponName: string) {
  const prefix = affinityPrefixes.find((currentPrefix) => weaponName.startsWith(currentPrefix));
  return prefix ? weaponName.slice(prefix.length) : weaponName;
}

// 이어진 이미지 주소 나누기
function splitImageUrls(urls: string) {
  return urls
    .split('|')
    .map((url) => url.trim())
    .filter(Boolean);
}

// 캐릭터 장비 이미지 경로 변환
function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

// 무기 이름 비교용 정리
function normalizeWeaponCatalogName(weaponName: string) {
  return weaponName.replace(/(?:\s|[^\p{L}\p{N}])+$/gu, '').trim();
}

// 필터 이름 표기 맞추기
function normalizeWeaponFilterText(value: string) {
  return value === '소형무기' ? '소형 무기' : value;
}

// 캐릭터 기본 장비 이미지 목록
function buildNightfarerEquipmentImageMap() {
  const equipmentImageByName = new Map<string, string>();

  nightfarers.forEach((nightfarer) => {
    const names = [nightfarer.equipment, nightfarer.equipment1, nightfarer.equipment2].filter(
      Boolean,
    );
    const imageUrls = splitImageUrls(nightfarer.equipmentImageUrls);

    names.forEach((name, index) => {
      const imageUrl = imageUrls[index];
      if (!imageUrl) return;

      equipmentImageByName.set(normalizeWeaponCatalogName(name), resolveNightAssetUrl(imageUrl));
    });
  });

  return equipmentImageByName;
}

// 캐릭터별 첫 장비 이미지 목록
function buildNightfarerDefaultEquipmentImages() {
  return nightfarers
    .map((nightfarer) => {
      const imageUrl = splitImageUrls(nightfarer.equipmentImageUrls)[0];

      return {
        characterName: nightfarer.name,
        imageUrl: imageUrl ? resolveNightAssetUrl(imageUrl) : '',
      };
    })
    .filter((entry) => entry.imageUrl);
}

// 무기 이름에 맞는 도감 정보
function getWeaponCatalogItem(weaponName: string): WeaponCatalogItem | undefined {
  const baseWeaponName = getBaseWeaponName(weaponName);
  const normalizedWeaponName = normalizeWeaponCatalogName(weaponName);
  const normalizedBaseWeaponName = normalizeWeaponCatalogName(baseWeaponName);

  return (
    weaponCatalogByTitle.get(weaponName) ??
    weaponCatalogByTitle.get(baseWeaponName) ??
    normalizedWeaponCatalogByTitle.get(normalizedWeaponName) ??
    normalizedWeaponCatalogByTitle.get(normalizedBaseWeaponName)
  );
}

// 무기 이름에 맞는 이미지
function getWeaponImageUrl(weaponName: string) {
  const baseWeaponName = getBaseWeaponName(weaponName);
  const normalizedWeaponName = normalizeWeaponCatalogName(weaponName);
  const normalizedBaseWeaponName = normalizeWeaponCatalogName(baseWeaponName);
  const catalogItem = getWeaponCatalogItem(weaponName);
  const isNightfarerEquipmentFallbackExcluded =
    nightfarerEquipmentFallbackExclusions.has(normalizedBaseWeaponName);
  const nightfarerExactImage =
    isNightfarerEquipmentFallbackExcluded
      ? undefined
      : nightfarerEquipmentImageByName.get(normalizedWeaponName) ??
        nightfarerEquipmentImageByName.get(normalizedBaseWeaponName);
  const nightfarerDefaultImage = isNightfarerEquipmentFallbackExcluded
    ? undefined
    : nightfarerDefaultEquipmentImages.find((entry) =>
        normalizedBaseWeaponName.includes(entry.characterName),
      );

  return (
    nightfarerExactImage ??
    nightfarerDefaultImage?.imageUrl ??
    catalogItem?.img
  );
}

// 무기 데이터에서 필터 목록 만들기
function buildWeaponFilterOptions(weapons: RelicWeapon[]) {
  const levels = [...new Set(weapons.map((weapon) => weapon.requiredLevel ?? 0))].sort(
    (left, right) => left - right,
  );
  const usedTypes = new Set<string>();
  const usedGenres = new Set<string>();

  weapons.forEach((weapon) => {
    const catalogItem = getWeaponCatalogItem(weapon.name);
    if (catalogItem?.type) usedTypes.add(normalizeWeaponFilterText(catalogItem.type));
    if (catalogItem?.genre) usedGenres.add(normalizeWeaponFilterText(catalogItem.genre));
  });

  const types: string[] = [];
  const genres: string[] = [];

  weaponCatalog.forEach((catalogItem) => {
    const type = catalogItem.type ? normalizeWeaponFilterText(catalogItem.type) : '';
    const genre = catalogItem.genre ? normalizeWeaponFilterText(catalogItem.genre) : '';

    if (type && usedTypes.has(type) && !types.includes(type)) types.push(type);
    if (genre && usedGenres.has(genre) && !genres.includes(genre)) genres.push(genre);
  });

  usedTypes.forEach((type) => {
    if (!types.includes(type)) types.push(type);
  });

  usedGenres.forEach((genre) => {
    if (!genres.includes(genre)) genres.push(genre);
  });

  return {
    levels,
    types,
    genres,
  };
}

// 빈 무기 필터 만들기
export function createEmptyWeaponFilters(): WeaponFilters {
  return {
    levels: [],
    types: [],
    genres: [],
  };
}

// 요구 레벨에 맞는 등급 테두리
function getWeaponGradeFrameUrl(requiredLevel: number) {
  if (requiredLevel === 10) return gradeFrame3;
  if (requiredLevel === 7) return gradeFrame2;
  if (requiredLevel === 3) return gradeFrame1;
  return gradeFrame0;
}

// 무기 카드
function WeaponCard({
  weapon,
  showAffinityIcon = false,
  isFocused = false,
  cardRef,
  onClick,
}: {
  weapon: RelicWeapon;
  showAffinityIcon?: boolean;
  isFocused?: boolean;
  cardRef?: Ref<HTMLButtonElement>;
  onClick?: () => void;
}) {
  const damage = formatRecordValues(weapon.baseDamage, damageLabels);
  const scaling = formatRecordValues(weapon.scaling, statLabels);
  const status = formatRecordValues(weapon.statusDamage, statusLabels);
  const affinityIcon = showAffinityIcon ? getWeaponAffinityIcon(weapon.name) : null;
  const catalogItem = getWeaponCatalogItem(weapon.name);
  const weaponImageUrl = getWeaponImageUrl(weapon.name);
  const requiredLevel = weapon.requiredLevel ?? 0;
  const gradeFrameUrl = getWeaponGradeFrameUrl(requiredLevel);
  const catalogMeta = [catalogItem?.genre, catalogItem?.type].filter(
    (value): value is string => Boolean(value),
  );
  const content = (
    <>
      <div className="option-card-header">
        <span className={`option-category weapon-level-badge weapon-level-${requiredLevel}`}>
          Lv. {requiredLevel}
        </span>
        {affinityIcon ? (
          <img src={affinityIcon.src} alt={affinityIcon.label} className="weapon-affinity-icon" />
        ) : null}
      </div>
      <div className={`weapon-card-main${weaponImageUrl ? '' : ' has-no-image'}`}>
        {weaponImageUrl ? (
          <span className="weapon-image-frame" aria-hidden="true">
            <img src={gradeFrameUrl} alt="" className="weapon-grade-frame" loading="lazy" />
            <img src={weaponImageUrl} alt="" className="weapon-catalog-image" loading="lazy" />
          </span>
        ) : null}
        <div className="weapon-card-copy">
          <h3>{weapon.name}</h3>
          <p>{damage.length ? damage.join(' · ') : '공격력 정보 없음'}</p>
        </div>
      </div>
      <div className="option-meta-row">
        {catalogMeta.map((value) => (
          <span key={value}>{value}</span>
        ))}
        {scaling.length ? <span>{scaling.join(' · ')}</span> : null}
        {status.length ? <span>{status.join(' · ')}</span> : null}
      </div>
    </>
  );

  // 파생 무기가 있으면 선택 버튼 사용
  if (onClick) {
    return (
      <button
        type="button"
        ref={cardRef}
        data-page-swipe-allowed
        className={`option-card weapon-card-button${isFocused ? ' is-focused' : ''}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <article className="option-card">{content}</article>;
}

// 무기 페이지 전체
function WeaponsPage({
  searchQuery,
  filters,
  selectedGroupId,
  focusedGroupId,
  onSelectGroup,
  onBack,
}: WeaponsPageProps) {
  const groupCardRefs = useRef(new Map<number, HTMLButtonElement>());
  const selectedGroup = useMemo(
    () => weaponGroups.find((group) => group.id === selectedGroupId) ?? null,
    [selectedGroupId],
  );

  // 검색과 필터 조건에 맞는 무기군
  const filteredGroups = useMemo(
    () => weaponGroups.filter((group) => matchesWeaponGroupSearch(group, searchQuery, filters)),
    [searchQuery, filters],
  );

  // 선택한 무기군의 파생 무기
  const filteredVariants = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.variants.filter(
      (weapon) => matchesWeaponSearch(weapon, searchQuery) && matchesWeaponFilters(weapon, filters),
    );
  }, [searchQuery, selectedGroup, filters]);

  // 캐릭터 장비에서 이동한 무기 카드 강조
  useEffect(() => {
    if (!focusedGroupId || selectedGroup) return;

    const timeoutId = window.setTimeout(() => {
      const focusedCard = groupCardRefs.current.get(focusedGroupId);
      focusedCard?.focus({ preventScroll: true });
      focusedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [focusedGroupId, selectedGroup, filteredGroups]);

  // 파생 무기 페이지
  if (selectedGroup) {
    return (
      <section className="options-page" aria-labelledby="weapon-variants-title">
        <div className="options-page-heading">
          <div>
            <h2 id="weapon-variants-title">{selectedGroup.representative.name}</h2>
          </div>
          <div className="heading-actions">
            <span className="option-count">
              {filteredVariants.length} / {selectedGroup.variants.length}
            </span>
            <button type="button" className="weapon-back-button" onClick={onBack}>
              목록
            </button>
          </div>
        </div>

        {filteredVariants.length ? (
          <div className="option-card-grid">
            {filteredVariants.map((weapon) => (
              <WeaponCard key={weapon.id} weapon={weapon} showAffinityIcon />
            ))}
          </div>
        ) : (
          <section className="list-page-panel">
            <div>
              <p className="list-page-kicker">파생 무기 없음</p>
              <h2>{selectedGroup.representative.name}</h2>
              <p>현재 검색어와 일치하는 파생 무기가 없습니다.</p>
            </div>
          </section>
        )}
      </section>
    );
  }

  // 기본 무기 목록 페이지
  return (
    <section className="options-page" aria-labelledby="weapons-title">
      <div className="options-page-heading">
        <div>
          <h2 id="weapons-title">무기</h2>
        </div>
        <span className="option-count">
          {filteredGroups.length} / {weaponGroups.length}
        </span>
      </div>

      {/* 대표 무기 카드 목록 */}
      <div className="option-card-grid">
        {filteredGroups.map((group) => (
          <WeaponCard
            key={group.id}
            weapon={group.representative}
            isFocused={group.id === focusedGroupId}
            cardRef={(element) => {
              if (element) {
                groupCardRefs.current.set(group.id, element);
              } else {
                groupCardRefs.current.delete(group.id);
              }
            }}
            onClick={group.variants.length ? () => onSelectGroup(group.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

export default WeaponsPage;
