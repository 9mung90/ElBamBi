import { useMemo, useState, type KeyboardEvent } from 'react';
import { nightfarers, type Nightfarer } from '../data/nightfarers';
import { getWeaponGroupIdByName } from './WeaponsPage';

type CharactersPageProps = {
  searchQuery: string;
  onSelectWeapon?: (weaponGroupId: number) => void;
};

const nightAssetUrls = import.meta.glob('../assets/images/night/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const nightAssetUrlsByLower = new Map(
  Object.entries(nightAssetUrls).map(([path, url]) => [path.toLowerCase(), url]),
);

const skinAssetUrls = import.meta.glob('../assets/images/skins/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const skinNames: Record<number, string> = {
  0: '일반',
  1: '여명',
  2: '암흑',
  3: '추억',
  4: '임시',
  5: '임시',
};

function resolveNightAssetUrl(url: string) {
  if (!url.startsWith('/assets/images/night/')) return url;

  const assetPath = url.replace('/assets/images/night/', '../assets/images/night/');
  return nightAssetUrls[assetPath] ?? nightAssetUrlsByLower.get(assetPath.toLowerCase()) ?? url;
}

function getSkinEntries(nightfarerIndex: number) {
  return Object.entries(skinAssetUrls)
    .map(([path, imageUrl]) => {
      const match = path.match(/\/skins\/(\d+)\/(\d+)\.png$/);
      if (!match) return null;

      const characterIndex = Number(match[1]);
      const skinIndex = Number(match[2]);
      if (characterIndex !== nightfarerIndex) return null;

      return {
        imageUrl,
        index: skinIndex,
        name: skinNames[skinIndex] ?? '임시',
      };
    })
    .filter((entry): entry is { imageUrl: string; index: number; name: string } => Boolean(entry))
    .sort((left, right) => left.index - right.index);
}

function splitUrls(urls: string) {
  return urls
    .split('|')
    .map((url) => url.trim())
    .filter(Boolean)
    .map(resolveNightAssetUrl);
}

function getSkillEntries(nightfarer: Nightfarer) {
  const names = [nightfarer.skills, nightfarer.skill1, nightfarer.skill2, nightfarer.skill3].filter(
    Boolean,
  );
  const descriptions = [
    nightfarer.description,
    nightfarer.description1,
    nightfarer.description2,
    '',
  ];
  const imageUrls = splitUrls(nightfarer.skillImageUrls);

  return names.map((name, index) => ({
    name,
    description: descriptions[index] ?? '',
    imageUrl: imageUrls[index] ?? '',
  }));
}

function getEquipmentEntries(nightfarer: Nightfarer) {
  const names = [nightfarer.equipment, nightfarer.equipment1, nightfarer.equipment2].filter(
    Boolean,
  );
  const imageUrls = splitUrls(nightfarer.equipmentImageUrls);

  return names.map((name, index) => ({
    name,
    imageUrl: imageUrls[index] ?? '',
  }));
}

function matchesCharacterSearch(nightfarer: Nightfarer, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    nightfarer.name,
    nightfarer.skills,
    nightfarer.skill1,
    nightfarer.skill2,
    nightfarer.skill3,
    nightfarer.description,
    nightfarer.description1,
    nightfarer.description2,
    nightfarer.equipment,
    nightfarer.equipment1,
    nightfarer.equipment2,
    nightfarer.rawText,
    nightfarer.aboutText,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function CharactersPage({ searchQuery, onSelectWeapon }: CharactersPageProps) {
  const [selectedNightfarerIndex, setSelectedNightfarerIndex] = useState<number | null>(null);
  const filteredCharacters = useMemo(
    () => nightfarers.filter((nightfarer) => matchesCharacterSearch(nightfarer, searchQuery)),
    [searchQuery],
  );
  const selectedNightfarer =
    selectedNightfarerIndex === null
      ? null
      : nightfarers.find((nightfarer) => nightfarer.index === selectedNightfarerIndex) ?? null;
  const selectedSkins = useMemo(
    () => (selectedNightfarer ? getSkinEntries(selectedNightfarer.index) : []),
    [selectedNightfarer],
  );

  function handleCharacterCardKeyDown(event: KeyboardEvent<HTMLElement>, nightfarerIndex: number) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    setSelectedNightfarerIndex(nightfarerIndex);
  }

  if (selectedNightfarer) {
    return (
      <section className="options-page" aria-labelledby="character-skins-title">
        <div className="options-page-heading">
          <div>
            <h2 id="character-skins-title">{selectedNightfarer.name} 스킨</h2>
          </div>
          <button type="button" className="skin-back-button" onClick={() => setSelectedNightfarerIndex(null)}>
            캐릭터 목록
          </button>
        </div>

        <div className="skin-card-grid">
          {selectedSkins.map((skin) => (
            <article className="skin-card" key={`${selectedNightfarer.index}-${skin.index}`}>
              <img src={skin.imageUrl} alt={`${selectedNightfarer.name} ${skin.name}`} />
              <span className="skin-card-name">{skin.name}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="options-page" aria-labelledby="characters-title">
      <div className="options-page-heading">
        <div>
          <h2 id="characters-title">캐릭터</h2>
        </div>
      </div>

      <div className="character-card-grid">
        {filteredCharacters.map((nightfarer) => {
          const skills = getSkillEntries(nightfarer);
          const equipment = getEquipmentEntries(nightfarer);

          return (
            <article
              className="character-card character-card-button"
              key={nightfarer.index}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedNightfarerIndex(nightfarer.index)}
              onKeyDown={(event) => handleCharacterCardKeyDown(event, nightfarer.index)}
            >
              <div className="character-card-top">
                <img
                  src={resolveNightAssetUrl(nightfarer.nameImageUrl)}
                  alt=""
                  className="character-portrait"
                />
                <div>
                  <h3>{nightfarer.name}</h3>
                  <p>{nightfarer.rawText}</p>
                </div>
              </div>

              {nightfarer.aboutText ? <p className="character-about">{nightfarer.aboutText}</p> : null}

              <div className="character-section">
                <h4>스킬</h4>
                <div className="character-list">
                  {skills.map((skill) => (
                    <div className="character-list-item" key={skill.name}>
                      {skill.imageUrl ? <img src={skill.imageUrl} alt="" /> : null}
                      <div>
                        <strong>{skill.name}</strong>
                        {skill.description ? <p>{skill.description}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {equipment.length ? (
                <div className="character-section">
                  <h4>장비</h4>
                  <div className="equipment-row">
                    {equipment.map((item) => {
                      const weaponGroupId = getWeaponGroupIdByName(item.name);
                      const content = (
                        <>
                          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                          {item.name}
                        </>
                      );

                      return weaponGroupId && onSelectWeapon ? (
                        <button
                          type="button"
                          className="equipment-pill equipment-pill-button"
                          key={item.name}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectWeapon(weaponGroupId);
                          }}
                        >
                          {content}
                        </button>
                      ) : (
                        <span className="equipment-pill" key={item.name}>
                          {content}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CharactersPage;
