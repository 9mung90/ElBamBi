import { useMemo } from 'react';
import { nightfarers } from '../data/nightfarers';
import { relicWeapons, type RelicWeapon } from '../data/relics';
import { weaponCatalog, weaponCatalogByTitle, type WeaponCatalogItem } from '../data/weaponCatalog';
import bloodIcon from '../assets/images/attribute/blood.png';
import fireIcon from '../assets/images/attribute/fire.png';
import frostIcon from '../assets/images/attribute/frost.png';
import holyIcon from '../assets/images/attribute/holy.png';
import lightningIcon from '../assets/images/attribute/lightning.png';
import magicIcon from '../assets/images/attribute/magic.png';
import poisonIcon from '../assets/images/attribute/poison.png';

type WeaponGroup = {
  id: number;
  representative: RelicWeapon;
  weapons: RelicWeapon[];
  variants: RelicWeapon[];
};

type WeaponsPageProps = {
  searchQuery: string;
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number) => void;
  onBack: () => void;
};

const damageLabels: Record<string, string> = {
  Phys: '물리',
  Magic: '마력',
  Fire: '화염',
  Lightning: '벼락',
  Holy: '신성',
};

const statusLabels: Record<string, string> = {
  Poison: '독',
  Bloodloss: '출혈',
  Frostbite: '동상',
  ScarletRot: '붉은 부패',
  Sleep: '수면',
  Madness: '발광',
};

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

const weaponGroups = buildWeaponGroups(relicWeapons);

function getWeaponGroupId(weapon: RelicWeapon) {
  return Math.floor(weapon.id / 10000) * 10000;
}

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

function matchesWeaponSearch(weapon: RelicWeapon, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const damage = formatRecordValues(weapon.baseDamage, damageLabels);
  const scaling = formatRecordValues(weapon.scaling, {});
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

function matchesWeaponGroupSearch(group: WeaponGroup, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return true;

  return group.weapons.some((weapon) => matchesWeaponSearch(weapon, normalizedQuery));
}

function getWeaponAffinityIcon(weaponName: string) {
  return affinityIcons.find((icon) => weaponName.startsWith(icon.prefix)) ?? null;
}

function getBaseWeaponName(weaponName: string) {
  const prefix = affinityPrefixes.find((currentPrefix) => weaponName.startsWith(currentPrefix));
  return prefix ? weaponName.slice(prefix.length) : weaponName;
}

function splitImageUrls(urls: string) {
  return urls
    .split('|')
    .map((url) => url.trim())
    .filter(Boolean);
}

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

function normalizeWeaponCatalogName(weaponName: string) {
  return weaponName.replace(/(?:\s|[^\p{L}\p{N}])+$/gu, '').trim();
}

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

function WeaponCard({
  weapon,
  showAffinityIcon = false,
  variantCount,
  onClick,
}: {
  weapon: RelicWeapon;
  showAffinityIcon?: boolean;
  variantCount?: number;
  onClick?: () => void;
}) {
  const damage = formatRecordValues(weapon.baseDamage, damageLabels);
  const scaling = formatRecordValues(weapon.scaling, {});
  const status = formatRecordValues(weapon.statusDamage, statusLabels);
  const affinityIcon = showAffinityIcon ? getWeaponAffinityIcon(weapon.name) : null;
  const weaponImageUrl = getWeaponImageUrl(weapon.name);
  const content = (
    <>
      <div className="option-card-header">
        <span className="option-category">Lv. {weapon.requiredLevel ?? 0}</span>
        {affinityIcon ? (
          <img src={affinityIcon.src} alt={affinityIcon.label} className="weapon-affinity-icon" />
        ) : (
          <span className="option-id">#{weapon.id}</span>
        )}
      </div>
      <div className={`weapon-card-main${weaponImageUrl ? '' : ' has-no-image'}`}>
        {weaponImageUrl ? (
          <img src={weaponImageUrl} alt="" className="weapon-catalog-image" loading="lazy" />
        ) : null}
        <div>
          <h3>{weapon.name}</h3>
          <p>{damage.length ? damage.join(' · ') : '공격력 정보 없음'}</p>
        </div>
      </div>
      <div className="option-meta-row">
        {scaling.length ? <span>{scaling.join(' · ')}</span> : null}
        {status.length ? <span>{status.join(' · ')}</span> : null}
        {typeof variantCount === 'number' ? <span>파생 {variantCount}개</span> : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="option-card weapon-card-button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className="option-card">{content}</article>;
}

function WeaponsPage({
  searchQuery,
  selectedGroupId,
  onSelectGroup,
  onBack,
}: WeaponsPageProps) {
  const selectedGroup = useMemo(
    () => weaponGroups.find((group) => group.id === selectedGroupId) ?? null,
    [selectedGroupId],
  );

  const filteredGroups = useMemo(
    () => weaponGroups.filter((group) => matchesWeaponGroupSearch(group, searchQuery)),
    [searchQuery],
  );

  const filteredVariants = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.variants.filter((weapon) => matchesWeaponSearch(weapon, searchQuery));
  }, [searchQuery, selectedGroup]);

  if (selectedGroup) {
    return (
      <section className="options-page" aria-labelledby="weapon-variants-title">
        <div className="options-page-heading">
          <div>
            <p className="list-page-kicker">파생 무기</p>
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

  return (
    <section className="options-page" aria-labelledby="weapons-title">
      <div className="options-page-heading">
        <div>
          <p className="list-page-kicker">relics_weapons_raw</p>
          <h2 id="weapons-title">무기</h2>
        </div>
        <span className="option-count">
          {filteredGroups.length} / {weaponGroups.length}
        </span>
      </div>

      <div className="option-card-grid">
        {filteredGroups.map((group) => (
          <WeaponCard
            key={group.id}
            weapon={group.representative}
            variantCount={group.variants.length}
            onClick={() => onSelectGroup(group.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default WeaponsPage;
